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

let draining = false;

/**
 * A 4xx means the request itself is wrong — bad thread id, no longer a member,
 * message too long. Retrying is pointless and would loop forever, blocking
 * every message queued behind it. 5xx and network errors are worth retrying.
 * 409 is excluded because the server uses it for a duplicate, which is success.
 */
function isPermanent(err) {
  const status = err?.response?.status;
  if (!status) return false; // network error — retry
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

  draining = true;
  let sent = 0;
  let failed = 0;

  try {
    const pending = await outbox.all();

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

        if (isPermanent(err)) {
          // Will never succeed. Leave it visible and failed so the user can
          // copy the text out or discard it, but stop retrying.
          await outbox.markAttempt(clientMsgId, message);
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

/** Retry one specific failed message, on user request. */
export async function retryOne(clientMsgId) {
  const pending = await outbox.all();
  const entry = pending.find((e) => e.clientMsgId === clientMsgId);
  if (!entry) return false;
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
  attempt();

  return () => {
    window.removeEventListener("online", attempt);
    window.removeEventListener("focus", attempt);
  };
}

export default { drainOutbox, retryOne, discard, startOutboxWatcher };
