// socket/handlers/presence.handler.js
//
// Presence over the socket: register on connect, refresh on heartbeat, clear on
// disconnect, and let clients subscribe to the people they can actually see.
//
// ─── SCOPED FAN-OUT ───
// A presence change is broadcast only to users who share a thread with the
// subject, via `presence:watch:{userId}` rooms that watchers opt into. At the
// current headcount a global broadcast would work fine, but it is O(users²) in
// the limit and there is no reason to write it that way — a watcher room costs
// nothing and the shape is right from the start.
//
// A user who has hidden their presence is never broadcast at all, so the
// privacy setting holds even for a client that ignores the flag.
'use strict';

const presence = require('../../services/messaging/presence');

const watchRoom = (userId) => `presence:watch:${userId}`;

module.exports = (io, socket) => {
  const userId = String(socket.user.id ?? socket.user._id);

  /** Tell everyone watching this user that their state changed. */
  async function broadcast(online) {
    if (!(await presence.isVisible(userId))) return;
    io.to(watchRoom(userId)).emit('presence:changed', {
      userId,
      online,
      lastSeenAt: online ? null : new Date().toISOString(),
    });
  }

  // ---- Connect -------------------------------------------------------
  (async () => {
    const becameOnline = await presence.addSocket(userId, socket.id);
    // Only broadcast on the transition. A second tab opening is not news, and
    // firing per-connection would spam every watcher on every page navigation.
    if (becameOnline) await broadcast(true);
  })().catch((err) => console.error(`[presence] connect failed: ${err.message}`));

  // ---- Heartbeat -----------------------------------------------------
  // Client pings on a timer; this pushes the TTL out. The TTL is what actually
  // decides online-ness, so a client that stops beating expires on its own
  // whether or not we ever see a disconnect.
  socket.on('presence:ping', () => {
    presence.touch(userId).catch(() => {});
  });

  // ---- Foreground / background ---------------------------------------
  /**
   * The client reports whether its tab is actually in front.
   *
   * ─── DELIBERATELY SEPARATE FROM ONLINE/OFFLINE ───
   * This does NOT touch presence and does NOT broadcast. Someone who alt-tabs
   * to Photoshop is still online — showing them as offline to their colleagues
   * because they switched windows would be wrong, and would make the green dot
   * flicker all day.
   *
   * The only consumer is pushPolicy.isViewingThread, which needs to tell "this
   * user has a tab open on the thread" apart from "this user is looking at the
   * thread". Without it, leaving the CRM open in a background window suppresses
   * every push for the conversation you last had selected — which is exactly
   * when a desktop notification is most wanted.
   */
  socket.on('presence:active', (active) => {
    // Coerce explicitly. A malformed payload must not park the socket in a
    // state where it is neither true nor false and the policy has to guess.
    socket.data.active = active !== false;
  });

  // ---- Watching ------------------------------------------------------
  /**
   * Subscribe to presence for a set of users, and get their current state back
   * immediately — otherwise a freshly-opened thread shows everyone as offline
   * until they each happen to change state.
   */
  socket.on('presence:subscribe', async ({ userIds } = {}) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return;
    try {
      const ids = userIds.map(String).filter(Boolean).slice(0, 200);
      ids.forEach((id) => socket.join(watchRoom(id)));

      // getPresence applies the reciprocity rule for this viewer.
      const snapshot = await presence.getPresence(userId, ids);
      socket.emit('presence:snapshot', { presence: snapshot });
    } catch (err) {
      console.error(`[presence] subscribe failed: ${err.message}`);
    }
  });

  socket.on('presence:unsubscribe', ({ userIds } = {}) => {
    if (!Array.isArray(userIds)) return;
    userIds.forEach((id) => socket.leave(watchRoom(String(id))));
  });

  // ---- Disconnect ----------------------------------------------------
  // Makes going offline instant when the browser closes cleanly. Nothing
  // depends on it arriving — the TTL covers the cases where it doesn't.
  socket.on('disconnect', () => {
    (async () => {
      const wentOffline = await presence.removeSocket(userId, socket.id);
      if (!wentOffline) return; // another tab still open
      await presence.recordLastSeen(userId);
      await broadcast(false);
    })().catch((err) => console.error(`[presence] disconnect failed: ${err.message}`));
  });
};
