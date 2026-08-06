// services/messaging/pushPolicy.js
//
// Decides whether a web push should actually fire.
//
// This is the difference between notifications people keep switched on and
// notifications they disable within a week. The transport (services/pushService)
// only knows how to send; everything about WHETHER to send lives here, in one
// function, so the three notification channels — in-app socket, web push, and
// the daily digest email — can't drift into notifying about the same message
// three times.
//
// ─── THE RULES, IN ORDER OF HOW MUCH NOISE THEY REMOVE ───
//
// 1. GRACE DELAY (10s). The single highest-leverage rule. Hold the push, then
//    re-check whether the notification is still unread. If the user read it on
//    another device in those ten seconds, nothing fires. Without this, every
//    message you read on your phone also buzzes your laptop.
//
// 2. ACTIVELY VIEWING. A live socket in the thread's room AND a tab that is
//    actually in the foreground. Per-THREAD, not per-connection: being online
//    in a different conversation should still push. And per-VISIBILITY, not
//    per-connection: a minimised window is not viewing.
//
// 3. MUTED THREAD. Respects timed mutes without needing a sweeper.
//
// 4. QUIET HOURS — bypassed by a direct @mention, which is the one thing worth
//    waking someone for.
//
// 5. COALESCING (30s per thread). A burst of five messages becomes one
//    notification, not five. The OS `tag` then replaces the previous banner
//    rather than stacking.
'use strict';

const MessagingPrefs = require('../../models/MessagingPrefs');
const ThreadPref = require('../../models/ThreadPref');
const realtime = require('./realtime');

/** How long to wait before re-checking that a notification is still unread. */
const GRACE_MS = 10_000;

/** At most one push per user per thread per this window. */
const COALESCE_MS = 30_000;

/**
 * In-process coalescing window: `${userId}:${scope}:${threadId}` -> timestamp.
 *
 * Deliberately in-memory rather than Redis. Getting this wrong is cheap in
 * both directions — a duplicate notification across two instances, or one
 * suppressed — and it is a hot path on every message. If the app is ever scaled
 * such that one user's messages routinely land on different instances, move
 * this to a Redis SETNX with a TTL; the interface here doesn't change.
 */
const lastPushAt = new Map();

/** Keep the coalescing map from growing without bound on a long-lived process. */
function _sweep() {
  const cutoff = Date.now() - COALESCE_MS * 4;
  for (const [key, at] of lastPushAt) {
    if (at < cutoff) lastPushAt.delete(key);
  }
}
setInterval(_sweep, 5 * 60 * 1000).unref();

/* ── Quiet hours ──────────────────────────────────────────────────────── */

/**
 * Is `now` inside the user's quiet hours?
 *
 * Evaluated in the user's own IANA zone via Intl rather than by storing a UTC
 * offset — an offset is wrong for half the year anywhere with daylight saving,
 * and "don't notify me before 8am" has to mean 8am in January too.
 *
 * Handles the overnight case (21:00 → 08:00) by testing the union of the two
 * ranges rather than a single comparison, which would be false all night.
 */
function inQuietHours(prefs, now = new Date()) {
  const q = prefs?.quietHours;
  if (!q?.enabled) return false;

  let hhmm;
  try {
    hhmm = new Intl.DateTimeFormat('en-GB', {
      timeZone: q.tz || 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);
  } catch {
    return false; // a bad tz string must not suppress every notification
  }

  const toMinutes = (s) => {
    const [h, m] = String(s || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };

  const nowM = toMinutes(hhmm);
  const fromM = toMinutes(q.from);
  const toM = toMinutes(q.to);
  if (nowM === null || fromM === null || toM === null) return false;

  // Overnight window wraps midnight.
  return fromM <= toM ? nowM >= fromM && nowM < toM : nowM >= fromM || nowM < toM;
}

/* ── Active-thread check ──────────────────────────────────────────────── */

/**
 * Is this user actually LOOKING at the thread right now?
 *
 * ─── AN OPEN TAB IS NOT A PAIR OF EYES ───
 * This used to return true for any socket joined to the thread's room, which
 * meant leaving the CRM open in a background window suppressed every push for
 * the conversation you last had selected. Minimise Chrome, work in another app,
 * and the one case where you most want a desktop banner was the one case that
 * was silenced — `reason: 'actively_viewing'` for a window nobody could see.
 *
 * Socket-room membership answers "is the tab open". Whether the user can see it
 * is a separate fact only the client knows, so the client reports it
 * (`presence:active`) and it is read back off `socket.data` here.
 *
 * Two subtleties worth keeping:
 *
 * 1. READ FROM socket.data, NOT socket.user. `fetchSockets()` returns a
 *    RemoteSocket for every socket on another instance behind the Redis
 *    adapter, and a RemoteSocket carries only { id, handshake, rooms, data }.
 *    The old `s.user?.id` read as undefined for those, so on a multi-instance
 *    deployment this check quietly answered "not viewing" for everyone not on
 *    the local process. `socket.user` is still read as a fallback for a socket
 *    that connected before this change shipped.
 *
 * 2. `active === undefined` COUNTS AS VIEWING. Only an explicit `false` — the
 *    client telling us the tab is hidden or unfocused — releases the push. An
 *    older cached bundle that never reports keeps the previous behaviour
 *    instead of suddenly notifying someone mid-conversation.
 *
 * Best-effort overall: if Socket.IO isn't up we assume NOT viewing and let the
 * push through. Failing open is right — a redundant notification is a minor
 * annoyance, a silently swallowed one is a missed message.
 */
async function isViewingThread(userId, scope, threadId) {
  try {
    const { getIO } = require('../../socket');
    const sockets = await getIO().in(realtime.roomOf(scope, threadId)).fetchSockets();
    return sockets.some((s) => {
      const socketUserId = s.data?.userId ?? s.user?.id ?? s.user?._id;
      if (String(socketUserId) !== String(userId)) return false;
      return s.data?.active !== false;
    });
  } catch {
    return false;
  }
}

/* ── The decision ─────────────────────────────────────────────────────── */

/**
 * Should we push this to this user?
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string} args.scope
 * @param {string} args.threadId
 * @param {boolean} [args.mentioned]  a direct @mention bypasses quiet hours
 *                                    and coalescing
 * @returns {Promise<{ push: boolean, reason: string }>}  reason is for logging
 *          and for the tests; nothing branches on it.
 */
async function shouldPush({ userId, scope, threadId, mentioned = false }) {
  const prefs = await MessagingPrefs.forUser(userId);

  if (!prefs.pushEnabled) return { push: false, reason: 'push_disabled' };

  if (await isViewingThread(userId, scope, threadId)) {
    return { push: false, reason: 'actively_viewing' };
  }

  if (await ThreadPref.isMuted(userId, scope, threadId)) {
    return { push: false, reason: 'thread_muted' };
  }

  if (!mentioned && inQuietHours(prefs)) {
    return { push: false, reason: 'quiet_hours' };
  }

  // A mention is worth interrupting a burst for; ordinary chatter is not.
  if (!mentioned) {
    const key = `${userId}:${scope}:${threadId}`;
    const last = lastPushAt.get(key) || 0;
    if (Date.now() - last < COALESCE_MS) {
      return { push: false, reason: 'coalesced' };
    }
    lastPushAt.set(key, Date.now());
  }

  return { push: true, reason: 'ok' };
}

/**
 * Should we push a notification that isn't attached to a thread?
 *
 * Task assigned, leave approved, remark added — these have no room to check
 * membership of and no conversation to coalesce against, so the thread rules
 * simply don't apply. What does carry over is the part users actually care
 * about: their master push switch and their quiet hours.
 *
 * Quiet hours are bypassed by high/urgent priority, mirroring how a direct
 * @mention bypasses them for chat. "Your leave was rejected" at 2am can wait;
 * an urgent task genuinely cannot.
 *
 * No coalescing window here on purpose. These events are naturally rare — you
 * do not get assigned forty tasks a minute — so the burst problem coalescing
 * exists to solve doesn't arise, and suppressing a second distinct task
 * assignment because it landed 20 seconds after the first would be a bug.
 */
async function shouldPushGeneral({ userId, priority = 'normal' }) {
  const prefs = await MessagingPrefs.forUser(userId);

  if (!prefs.pushEnabled) return { push: false, reason: 'push_disabled' };

  const urgent = priority === 'high' || priority === 'urgent';
  if (!urgent && inQuietHours(prefs)) return { push: false, reason: 'quiet_hours' };

  return { push: true, reason: 'ok' };
}

/**
 * Wait out the grace window, then confirm the notification is still unread.
 *
 * Returns false if the user read it in the meantime — on any device. This is
 * what stops a laptop buzzing about a message already read on a phone.
 */
async function stillUnread(notificationId) {
  await new Promise((r) => setTimeout(r, GRACE_MS));
  try {
    const Notification = require('../../models/Notification');
    const row = await Notification.findById(notificationId).select('read').lean();
    return Boolean(row) && !row.read;
  } catch {
    return false; // if we can't confirm, don't wake anyone
  }
}

module.exports = {
  GRACE_MS,
  COALESCE_MS,
  inQuietHours,
  isViewingThread,
  shouldPush,
  shouldPushGeneral,
  stillUnread,
  _lastPushAt: lastPushAt, // exposed for tests
};
