// services/messaging/presence.js
//
// Online / last-seen, backed by Redis.
//
// ─── WHY TTL RATHER THAN disconnect ───
// The obvious design is "mark online on connect, offline on disconnect". It is
// also wrong, because `disconnect` is not guaranteed to arrive: a closed laptop
// lid, a dead wifi link or a killed browser process all leave the server
// believing the socket is live. Presence built that way accumulates users who
// are permanently "online" and never recovers without a restart.
//
// So online-ness is a key with a short TTL that the client's own heartbeat
// keeps alive. Stop hearing from someone and they simply expire. `disconnect`
// is still handled — it makes going offline instant when the browser *does*
// close cleanly — but nothing depends on it arriving.
//
//   presence:{userId}          "1", TTL 45s          — refreshed by heartbeat
//   presence:sockets:{userId}  SET of socket ids     — multi-tab / multi-device
//
// The socket set is what makes multiple tabs work: closing one tab must not
// mark you offline while another is still open. A user is online while the set
// is non-empty OR the TTL key is alive.
//
// TTL is 45s against Socket.IO's 25s ping interval — comfortably more than two
// missed beats, so a single slow round trip never flickers someone offline.
'use strict';

const { getRedis } = require('../../config/redis');

const ONLINE_TTL_SECONDS = 45;

const keyOnline = (userId) => `presence:${userId}`;
const keySockets = (userId) => `presence:sockets:${userId}`;

/** Redis is optional in dev; every call here degrades to "unknown" without it. */
function _redis() {
  try {
    return getRedis();
  } catch {
    return null;
  }
}

/* ── Writes ───────────────────────────────────────────────────────────── */

/**
 * Register a connected socket and mark the user online.
 * @returns {Promise<boolean>} true if this made them newly online (worth
 *          broadcasting), false if they already were on another device.
 */
async function addSocket(userId, socketId) {
  const redis = _redis();
  if (!redis) return false;

  try {
    const wasOnline = await redis.exists(keyOnline(userId));
    await redis
      .multi()
      .sadd(keySockets(userId), socketId)
      .expire(keySockets(userId), ONLINE_TTL_SECONDS * 4)
      .set(keyOnline(userId), '1', 'EX', ONLINE_TTL_SECONDS)
      .exec();
    return !wasOnline;
  } catch (err) {
    console.error(`[presence] addSocket failed: ${err.message}`);
    return false;
  }
}

/**
 * Drop a socket. Only reports "now offline" once the LAST one is gone.
 * @returns {Promise<boolean>} true if the user just went offline.
 */
async function removeSocket(userId, socketId) {
  const redis = _redis();
  if (!redis) return false;

  try {
    await redis.srem(keySockets(userId), socketId);
    const remaining = await redis.scard(keySockets(userId));
    if (remaining > 0) return false;

    await redis.del(keyOnline(userId), keySockets(userId));
    return true;
  } catch (err) {
    console.error(`[presence] removeSocket failed: ${err.message}`);
    return false;
  }
}

/** Heartbeat — pushes the TTL out. Cheap enough to run on every ping. */
async function touch(userId) {
  const redis = _redis();
  if (!redis) return;
  try {
    await redis.set(keyOnline(userId), '1', 'EX', ONLINE_TTL_SECONDS);
  } catch {
    /* a missed heartbeat just means they expire; not worth logging per-beat */
  }
}

/**
 * Persist last-seen. Written on final disconnect only, not per heartbeat —
 * a write per user per 25s would be a pointless load for a field only read
 * when someone is offline.
 */
async function recordLastSeen(userId) {
  try {
    const User = require('../../models/User');
    await User.updateOne({ _id: userId }, { $set: { lastSeenAt: new Date() } });
  } catch (err) {
    console.error(`[presence] recordLastSeen failed: ${err.message}`);
  }
}

/* ── Reads ────────────────────────────────────────────────────────────── */

/**
 * Presence for a set of users, honouring the privacy toggle in BOTH directions.
 *
 * Reciprocity, WhatsApp's rule: if you hide your presence you also stop seeing
 * everyone else's. Enforced here rather than in the client, because a client
 * that ignored the flag would otherwise still receive the data on the wire —
 * which makes the setting decorative rather than real.
 *
 * @param {string} viewerId  who is asking
 * @param {string[]} userIds
 * @returns {Promise<Object>} { [userId]: { online, lastSeenAt } | { hidden: true } }
 */
async function getPresence(viewerId, userIds = []) {
  const ids = [...new Set(userIds.map(String))].filter(Boolean);
  if (ids.length === 0) return {};

  const MessagingPrefs = require('../../models/MessagingPrefs');
  const viewerPrefs = await MessagingPrefs.forUser(viewerId);

  // Viewer opted out => sees nobody.
  if (!viewerPrefs.showPresence) {
    return Object.fromEntries(ids.map((id) => [id, { hidden: true }]));
  }

  const redis = _redis();
  const [prefRows, onlineFlags] = await Promise.all([
    MessagingPrefs.find({ user: { $in: ids } }).select('user showPresence').lean(),
    redis
      ? redis.mget(ids.map(keyOnline)).catch(() => ids.map(() => null))
      : Promise.resolve(ids.map(() => null)),
  ]);

  const hiddenBy = new Set(
    prefRows.filter((p) => p.showPresence === false).map((p) => String(p.user))
  );

  // lastSeenAt only for those we will actually show as offline.
  const User = require('../../models/User');
  const users = await User.find({ _id: { $in: ids } })
    .select('lastSeenAt')
    .lean();
  const lastSeenById = new Map(users.map((u) => [String(u._id), u.lastSeenAt || null]));

  const out = {};
  ids.forEach((id, i) => {
    if (hiddenBy.has(id)) {
      out[id] = { hidden: true };
      return;
    }
    const online = Boolean(onlineFlags[i]);
    out[id] = { online, lastSeenAt: online ? null : lastSeenById.get(id) || null };
  });

  return out;
}

/** Does this user allow their presence to be shown? */
async function isVisible(userId) {
  const MessagingPrefs = require('../../models/MessagingPrefs');
  const prefs = await MessagingPrefs.forUser(userId);
  return prefs.showPresence !== false;
}

module.exports = {
  ONLINE_TTL_SECONDS,
  addSocket,
  removeSocket,
  touch,
  recordLastSeen,
  getPresence,
  isVisible,
};
