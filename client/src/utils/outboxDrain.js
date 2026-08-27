// utils/outboxDrain.js
//
// Sends whatever is sitting in the outbox (S2).
//
// ─── ONE AT A TIME, IN ORDER ───
// The drain is strictly serial. Firing the queue off in parallel would let a
// later message win the race and land first, permanently reordering the thread
// for everyone — a message the user typed second appearing above one they typed
// first, forever, in the database.
//
// ─── REPLAY IS SAFE ───
// Every entry carries the `clientMsgId` minted when it was queued, and never
// regenerates it. The server's unique sparse index turns a re-send of something
// that actually made it through into a no-op returning the original (S1). That
// is what makes it safe to retry aggressively rather than agonising over
// whether a timed-out request succeeded.
//
// ─── FAILURE IS VISIBLE, NEVER SILENT ───
// A failed entry stays in the queue and the message stays on screen marked
// failed. Losing what someone typed because the network blinked is the worst
// thing this subsystem could do, so nothing is ever dropped without the user
// choosing to discard it.
import * as outbox from "./outbox";
import * as messagingApi from "../api/messagingApi";
// Direct store import. No cycle: the store imports slices, slices import
// messagingApi, and none of them import this module.
import store from "../store";
import { markSendFailed, markSendRetrying } from "../store/slices/threadsSlice";
import { hasLiveSession } from "./session";
import { AUTH_CHANGED_EVENT } from "./authEvents";

let draining = false;

/**
 * The session is gone, not the message.
 *
 * Split out of isPermanent, where 401 used to live. A 401 says nothing about
 * whether the message is sendable — only that nobody is currently signed in to
 * send it. Treating it as permanent threw away a perfectly good message that
 * would have gone out the moment the user signed back in.
 *
 * 403 joins it: on this API that means the membership check failed, which is
 * usually a stale token rather than a genuinely forbidden message, and the
 * cost of being wrong is one extra retry versus a discarded message.
 */
function isSessionError(err) {
  const status = err?.response?.status;
  return status === 401 || status === 403;
}

/**
 * A 4xx means the request itself is wrong — bad thread id, no longer a member,
 * message too long. Retrying is pointless and would loop forever, blocking
 * every message queued behind it. 5xx and network errors are worth retrying.
 * 409 is excluded because the server uses it for a duplicate, which is success.
 * Auth failures are excluded too — see isSessionError.
 */
function isPermanent(err) {
  const status = err?.response?.status;
  if (!status) return false; // network error — retry
  if (isSessionError(err)) return false;
  return status >= 400 && status < 500 && status !== 408 && status !== 429 && status !== 409;
}

/**
 * Drain the queue. Safe to call concurrently — subsequent calls no-op while a
 * drain is already running, so a reconnect storm doesn't start five drains.
 *
 * @returns {Promise<{sent: number, failed: number}>}
 */
export async function drainOutbox() {
  if (draining) return { sent: 0, failed: 0 };
  if (!navigator.onLine) return { sent: 0, failed: 0 };

  // ─── NEVER DRAIN WITHOUT A SESSION ───
  // This watcher starts in WebSocketProvider, which is mounted ABOVE the
  // router — so it ran on the login page too, with no token to send. Every
  // queued message then 401'd, and the interceptor's response to a 401 is to
  // reload the page, which restarts the watcher, which drains again. One
  // stuck entry was enough to make the app impossible to open.
  //
  // The socket connect right below the watcher already had exactly this guard
  // (`if (!token) return`); the drain simply never got one. Nothing is lost by
  // waiting: entries stay queued, and a fresh login re-triggers the drain via
  // the socket's connect handler and the auth listener in startOutboxWatcher.
  if (!hasLiveSession()) return { sent: 0, failed: 0 };

  draining = true;
  let sent = 0;
  let failed = 0;

  try {
    // Entries the drain has already given up on are skipped HERE rather than
    // in outbox.all(), so they stay visible in the composer's failed strip
    // where the user can retry or copy them. Before this, `permanent` was
    // written and never read, so "stop retrying" only lasted until the loop
    // came round again.
    const pending = (await outbox.all()).filter((entry) => !entry.permanent);

    for (const entry of pending) {
      const { clientMsgId, scope, threadId } = entry;

      store.dispatch(markSendRetrying({ scope, threadId, clientMsgId }));

      try {
        await messagingApi.sendMessage(scope, threadId, {
          body: entry.body,
          files: entry.files || [],
          replyTo: entry.replyTo || null,
          mentions: entry.mentions || [],
          senderType: entry.senderType,
          // Never regenerated — this is the whole idempotency guarantee.
          clientMsgId,
        });

        await outbox.remove(clientMsgId);
        sent += 1;
        // No dispatch needed on success: the server echoes the saved message
        // back over the socket and it merges onto this row by clientMsgId.
      } catch (err) {
        failed += 1;
        const message = err?.response?.data?.error || err.message || "Failed to send";

        if (isSessionError(err)) {
          // Nobody is signed in. The message is fine and must survive — it
          // goes out on the next drain after a successful login. Stop the
          // whole pass rather than marching the rest of the queue into the
          // same wall.
          await outbox.markAttempt(clientMsgId, message);
          store.dispatch(markSendFailed({ scope, threadId, clientMsgId, error: message }));
          break;
        }

        if (isPermanent(err)) {
          // Will never succeed. Leave it visible and failed so the user can
          // copy the text out or discard it, but stop retrying — for real
          // this time, which is what the persisted flag buys.
          await outbox.markAttempt(clientMsgId, message, { permanent: true });
          store.dispatch(markSendFailed({ scope, threadId, clientMsgId, error: message }));
          continue;
        }

        await outbox.markAttempt(clientMsgId, message);
        store.dispatch(markSendFailed({ scope, threadId, clientMsgId, error: message }));

        // Stop the whole drain on a transient failure rather than carrying on.
        // If the network is down, every remaining entry will fail too — and
        // pushing through would reorder them relative to this one.
        break;
      }
    }
  } catch (err) {
    console.error("[outbox] drain failed:", err);
  } finally {
    draining = false;
  }

  return { sent, failed };
}

/**
 * Retry one specific failed message, on user request.
 *
 * Clears `permanent` first: the user has seen the error and is asking anyway,
 * and an explicit request beats the drain's own judgement. Without this, the
 * flag that stops the automatic retry loop would also disable the manual
 * retry button — trapping the text in a bubble with no way out, which is the
 * one outcome this whole subsystem exists to prevent.
 */
export async function retryOne(clientMsgId) {
  const pending = await outbox.all();
  const entry = pending.find((e) => e.clientMsgId === clientMsgId);
  if (!entry) return false;
  await outbox.clearPermanent(clientMsgId);
  await drainOutbox();
  return true;
}

/** Discard a message the user has given up on. */
export async function discard(clientMsgId) {
  await outbox.remove(clientMsgId);
}

/**
 * Drain on the events that mean "the network might be back".
 *
 * `online` alone is not enough — it fires on regaining a link, which may still
 * be a captive portal. A reconnected socket is the stronger signal, which is
 * why WebSocketContext also calls drainOutbox() on connect.
 */
export function startOutboxWatcher() {
  const attempt = () => drainOutbox();
  window.addEventListener("online", attempt);
  // Coming back to the tab is a good moment to retry anything stuck.
  window.addEventListener("focus", attempt);
  // Signing in is the other one. drainOutbox now refuses to run without a
  // session, so a message queued while logged out needs an explicit nudge
  // once there is one — the socket's connect handler usually gets there
  // first, but this doesn't depend on the socket coming up at all.
  window.addEventListener(AUTH_CHANGED_EVENT, attempt);
  attempt();

  return () => {
    window.removeEventListener("online", attempt);
    window.removeEventListener("focus", attempt);
    window.removeEventListener(AUTH_CHANGED_EVENT, attempt);
  };
}

export default { drainOutbox, retryOne, discard, startOutboxWatcher };
