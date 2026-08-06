// socket/handlers/chat.handler.js
//
// Real-time chat + project-room events. This replaces the message-type
// switchboard that used to live inline inside the raw `wss.on("connection")`
// block in app.js (group messages, project messages, typing indicators).
//
// Two things changed on purpose while porting this over:
//   1. `project_message` used to be broadcast to EVERY connected socket
//      (server/app.js just looped `for (const userId in users)`), regardless
//      of whether that user had anything to do with the project. It's now
//      scoped to a `project:<id>` Socket.IO room that only members who called
//      `project:join` are in.
//   2. Typing indicators (`typing` / `stop_typing`) were sent by the client
//      but the old server switchboard had no case for them at all, so they
//      were silently dropped — the feature never worked for a second user.
//      They're wired up properly here.
//
// ─── AUTHORIZATION (Phase 0 security patch) ───
// Every event below used to trust whatever id the client sent. `chat:subscribe`
// would join any room by id; `chat:message` would persist into any conversation;
// `project:join` would join any project's room. Being in a room is enough to
// receive every message broadcast to it, so an unauthorized join was a silent,
// permanent read of someone else's thread.
//
// Now:
//   - joins are verified against services/messaging/access.js before joining;
//   - the write path (`chat:message`) re-verifies on EVERY send, never trusting
//     the cached join, so a user removed from a group mid-session cannot keep
//     posting;
//   - ephemeral events (typing) check a per-connection cache of rooms this
//     socket already proved it can access, so the indicator doesn't cost a DB
//     round trip per keystroke.
'use strict';

const {
  assertChatAccess,
  assertProjectChatAccess,
  AccessError,
} = require('../../services/messaging/access');
// Phase 1: the socket send path and the REST send path are now literally the
// same call, so they cannot drift. Typing goes through realtime.js so the new
// `thread:typing` envelope and the legacy `chat:`/`project:` events stay in
// step automatically.
const messagingService = require('../../services/messaging/messaging.service');
const realtime = require('../../services/messaging/realtime');
const { CHAT, PROJECT } = messagingService.SCOPES;

module.exports = (io, socket) => {
  const userId = socket.user.id;

  // Rooms this connection has already proven access to. Used only to gate
  // ephemeral, non-persisting events (typing). Never used to authorize a
  // write — those re-check against the database every time.
  socket.data.authorizedRooms = socket.data.authorizedRooms || new Set();

  const remember = (room) => socket.data.authorizedRooms.add(room);
  const isRemembered = (room) => socket.data.authorizedRooms.has(room);

  /** Report an authorization failure to just this socket. */
  const denied = (scope, threadId, err) => {
    const isAccess = err instanceof AccessError;
    if (!isAccess) {
      console.error(`[chat.handler] ${scope} error for thread ${threadId}:`, err.message);
    }
    socket.emit('thread:error', {
      scope,
      threadId,
      code: isAccess ? err.code : 'INTERNAL',
      message: isAccess ? err.message : 'Something went wrong',
    });
  };

  // ---- Chat conversations --------------------------------------------
  // Client calls this once after connecting (and again whenever its
  // conversation list changes) so this socket receives messages for every
  // conversation the user belongs to. Each id is verified independently —
  // one unauthorized id in the array must not poison the whole batch, and
  // must not grant the room.
  socket.on('chat:subscribe', async ({ conversationIds } = {}) => {
    if (!Array.isArray(conversationIds)) return;

    for (const id of conversationIds) {
      try {
        await assertChatAccess(socket.user, id, 'read');
        const room = `conversation:${id}`;
        socket.join(room);
        remember(room);
      } catch (err) {
        // Silent per-id skip: a client whose cached conversation list is
        // stale (deleted group, removed from group) would otherwise get a
        // burst of errors on every reconnect. Genuine bugs still log.
        if (!(err instanceof AccessError)) {
          console.error(`[chat.handler] subscribe failed for ${id}:`, err.message);
        }
      }
    }
  });

  socket.on('chat:message', async ({ conversationId, message, attachments, replyTo } = {}) => {
    if (!conversationId || (!message && !(attachments || []).length)) return;

    try {
      // Authorization (re-checked on every send, never cached — membership can
      // be revoked mid-session), persistence, notification fan-out, URL signing
      // and the room + personal-room broadcast all live in the service now.
      await messagingService.sendMessage(socket.user, CHAT, conversationId, {
        body: message,
        attachments: attachments || [],
        replyTo: replyTo || null,
      });
    } catch (err) {
      denied('chat', conversationId, err);
    }
  });

  // ---- Delivery / read receipts (S1) -----------------------------------
  //
  // `thread:delivered` is fired automatically by the recipient's client the
  // moment a message arrives — it means "this reached a device", nothing about
  // whether anyone looked at it.
  socket.on('thread:delivered', async ({ scope, threadId, messageIds } = {}) => {
    if (!threadId || !Array.isArray(messageIds) || messageIds.length === 0) return;
    try {
      await messagingService.markDelivered(socket.user, scope || CHAT, threadId, messageIds);
    } catch (err) {
      denied(scope || CHAT, threadId, err);
    }
  });

  // `thread:read` carries a CURSOR — everything up to this message. The client
  // only sends it when the message was genuinely visible (thread open, window
  // focused, row intersecting the viewport).
  socket.on('thread:read', async ({ scope, threadId, upToMessageId } = {}) => {
    if (!threadId || !upToMessageId) return;
    try {
      await messagingService.markReadUpTo(socket.user, scope || CHAT, threadId, upToMessageId);
    } catch (err) {
      denied(scope || CHAT, threadId, err);
    }
  });

  // Typing is ephemeral and high-frequency. Gated on the per-connection cache
  // rather than a fresh lookup: `socket.to(room)` reaches a room whether or
  // not the sender is in it, so without this check any user could inject a
  // typing indicator into any conversation.
  socket.on('chat:typing', ({ conversationId, userName } = {}) => {
    if (!conversationId) return;
    if (!isRemembered(realtime.roomOf(CHAT, conversationId))) return;
    realtime.emitTyping(socket, { scope: CHAT, threadId: conversationId, userId, userName });
  });

  socket.on('chat:stop_typing', ({ conversationId } = {}) => {
    if (!conversationId) return;
    if (!isRemembered(realtime.roomOf(CHAT, conversationId))) return;
    realtime.emitTyping(socket, { scope: CHAT, threadId: conversationId, userId, stop: true });
  });

  // ---- Project rooms ---------------------------------------------------
  // The message itself is created via REST (POST /api/projects/:id/messages);
  // the client pings this event afterwards purely so everyone else looking
  // at the project sees it appear without a refresh.
  socket.on('project:join', async ({ projectId } = {}) => {
    if (!projectId) return;
    try {
      await assertProjectChatAccess(socket.user, projectId, 'read');
      const room = `project:${projectId}`;
      socket.join(room);
      remember(room);
    } catch (err) {
      denied('project', projectId, err);
    }
  });

  socket.on('project:leave', ({ projectId } = {}) => {
    if (!projectId) return;
    const room = `project:${projectId}`;
    socket.leave(room);
    socket.data.authorizedRooms.delete(room);
  });

  // `project:message` (a client-sent relay) is gone. It existed because project
  // messages were created over REST and the sender then had to nudge everyone
  // else. Since Phase 1 the server broadcasts `thread:message` itself, to the
  // project room AND to each member's personal room, so the relay was both
  // redundant and emitting a legacy event nothing listens for.

  socket.on('project:typing', ({ projectId, userName } = {}) => {
    if (!projectId) return;
    if (!isRemembered(realtime.roomOf(PROJECT, projectId))) return;
    realtime.emitTyping(socket, { scope: PROJECT, threadId: projectId, userId, userName });
  });

  socket.on('project:stop_typing', ({ projectId } = {}) => {
    if (!projectId) return;
    if (!isRemembered(realtime.roomOf(PROJECT, projectId))) return;
    realtime.emitTyping(socket, { scope: PROJECT, threadId: projectId, userId, stop: true });
  });

  // ---- Task rooms --------------------------------------------------------
  // Joined while TaskRemarksModal is open for a given task, so a new remark
  // (added via REST — POST /api/tasks/:taskId/remarks) can be pushed live to
  // everyone else with that same task's modal open, instead of them polling
  // GET /api/tasks/:taskId every 5s.
  //
  // NOTE: task rooms are not yet access-checked. Task remarks are outside the
  // messaging scope of this patch, and the REST route that creates them does
  // its own authorization — but joining this room still lets a user observe
  // remarks on a task they may not own. Tracked as follow-up; see
  // MESSAGING-ARCHITECTURE-PLAN.md.
  socket.on('task:join', ({ taskId } = {}) => {
    if (taskId) socket.join(`task:${taskId}`);
  });

  socket.on('task:leave', ({ taskId } = {}) => {
    if (taskId) socket.leave(`task:${taskId}`);
  });
};
