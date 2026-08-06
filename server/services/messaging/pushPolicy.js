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
// 2. ACTIVELY VIEWING. If the user has a live socket in that thread's room,
//    they are looking at it. Note this is per-THREAD, not per-connection: being
//    online in a different conversation should still push.
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
 * Does this user have a socket currently joined to the thread's room?
 *
 * Best-effort: if Socket.IO isn't up, we assume NOT viewing and let the push
 * through. Failing open here is right — a redundant notification is a minor
 * annoyance, a silently swallowed one is a missed message.
 */
async function isViewingThread(userId, scope, threadId) {
  try {
    const { getIO } = require('../../socket');
    const sockets = await getIO().in(realtime.roomOf(scope, threadId)).fetchSockets();
    return sockets.some((s) => String(s.user?.id ?? s.user?._id) === String(userId));
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
  stillUnread,
  _lastPushAt: lastPushAt, // exposed for tests
};
