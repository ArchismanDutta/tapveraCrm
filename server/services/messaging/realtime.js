// services/messaging/realtime.js
//
// The single place messaging emits real-time events from.
//
// ─── WHY THIS EXISTS ───
// Before this, chat and project threads spoke different dialects: `chat:message`
// carried a flat message object, `project:message` wrapped one in
// `{ projectId, messageData, timestamp }`, and project threads had five extra
// one-off events (`project:message_read`, `_status`, `_pinned`, `_delivered`).
// Two surfaces, two payload shapes, no shared contract — so the client grew a
// separate handler per event and the two pages could never share code.
//
// ─── ONE DIALECT ───
// Everything emits the scope-tagged `thread:*` envelope and nothing else.
//
// Through Phases 2-4 this module dual-emitted: the new envelope AND the exact
// legacy `chat:*` / `project:*` events, so production clients kept working
// while the front end migrated page by page. Every consumer of those legacy
// events is now converted (verified by sweeping `addEventListener` across the
// client), so the second dialect is gone.
//
// Everything here is best-effort: if Socket.IO isn't up yet (startup) or nobody
// is connected, we log and move on. A real-time hiccup must never fail the HTTP
// request or the DB write that triggered it.
'use strict';

const SCOPES = { CHAT: 'chat', PROJECT: 'project' };

/** Lazily resolved so this module doesn't depend on socket init order. */
const io = () => require('../../socket').getIO();

/** Room name for a thread in a given scope. */
function roomOf(scope, threadId) {
  return scope === SCOPES.PROJECT ? `project:${threadId}` : `conversation:${threadId}`;
}

/** Run an emit, swallowing transport errors. Returns true if it went out. */
function safely(label, fn) {
  try {
    fn();
    return true;
  } catch (err) {
    console.error(`[realtime] ${label} failed: ${err.message}`);
    return false;
  }
}

/**
 * Sign any /uploads/... paths in a payload.
 *
 * Socket payloads bypass Express, so the res.json interceptor that normally
 * signs file URLs never runs on this path. Without it the sender's own HTTP
 * response has working image URLs while every recipient gets a raw path and a
 * broken image until they refresh. This bit both surfaces independently before
 * it was centralized here.
 */
function sign(payload) {
  try {
    const { signPayload } = require('../../middlewares/signFileUrls');
    return signPayload(payload);
  } catch (err) {
    console.error(`[realtime] signPayload failed, sending unsigned: ${err.message}`);
    return payload;
  }
}

/* ── Messages ─────────────────────────────────────────────────────────── */

/**
 * A new message landed in a thread.
 *
 * @param {object}   args
 * @param {string}   args.scope         'chat' | 'project'
 * @param {string}   args.threadId
 * @param {object}   args.message       normalized message (see adapters)
 * @param {string[]} [args.memberIds]   also delivered to each member's personal
 *                                      room, covering clients that haven't
 *                                      (re)joined the thread room yet — e.g.
 *                                      someone just added to a group
 */
function emitMessage({ scope, threadId, message, memberIds = [] }) {
  const room = roomOf(scope, threadId);

  safely('emitMessage', () => {
    const payload = sign({ scope, threadId: String(threadId), message });
    const server = io();
    server.to(room).emit('thread:message', payload);
    memberIds.forEach((id) => server.to(`user:${id}`).emit('thread:message', payload));
  });
}

/* ── Receipts (read / delivered / status) ─────────────────────────────── */

/**
 * A receipt changed on a message — read, delivered, or an explicit status
 * transition. One envelope carries all three; project threads used to split
 * these across `project:message_read` / `_delivered` / `_status`.
 *
 * @param {'read'|'delivered'|'status'} args.kind
 */
function emitReceipt({ scope, threadId, messageId, userId, kind, status, at = Date.now() }) {
  const room = roomOf(scope, threadId);

  safely('emitReceipt', () => {
    io().to(room).emit('thread:receipt', {
      scope,
      threadId: String(threadId),
      messageId: messageId ? String(messageId) : null,
      userId: userId ? String(userId) : null,
      kind,
      status: status || null,
      at,
    });
  });
}

/* ── Thread-level changes (pin, rename, membership, reactions) ─────────── */

/**
 * Something about the thread or one of its messages changed in a way the
 * client should patch in place rather than refetch.
 *
 * @param {object} args.patch  e.g. { pinned: true, messageId }
 *                                  { reactions: [...], messageId }
 *                                  { name: 'New group name' }
 */
function emitUpdated({ scope, threadId, patch, memberIds = [] }) {
  const room = roomOf(scope, threadId);

  safely('emitUpdated', () => {
    const payload = sign({ scope, threadId: String(threadId), patch });
    const server = io();
    server.to(room).emit('thread:updated', payload);
    memberIds.forEach((id) => server.to(`user:${id}`).emit('thread:updated', payload));
  });
}

/**
 * Conversation membership/details changed (create, rename, add/remove, delete).
 * Targeted at each member's personal room rather than the thread room: a
 * brand-new group has nobody in its room yet, and a just-removed member needs
 * to be told precisely because they are no longer in it.
 */
function emitConversationChanged(memberIds, data) {
  const payload = { ...data, timestamp: Date.now() };

  safely('emitConversationChanged', () => {
    const server = io();
    (memberIds || []).forEach((id) => {
      // `conversation:updated` is still the name the client listens for; it is
      // a thread-lifecycle event, not part of the retired message dialect.
      server.to(`user:${id}`).emit('conversation:updated', payload);
    });
  });
}

/* ── Typing ───────────────────────────────────────────────────────────── */

/**
 * Typing indicator. Ephemeral — never persisted, never queued.
 * `socket` is passed so the event goes to the room EXCLUDING the sender;
 * emitting from `io` would echo the indicator back to the person typing.
 */
function emitTyping(socket, { scope, threadId, userId, userName, stop = false }) {
  const room = roomOf(scope, threadId);

  safely('emitTyping', () => {
    socket.to(room).emit(stop ? 'thread:stop_typing' : 'thread:typing', {
      scope,
      threadId: String(threadId),
      userId: String(userId),
      userName: userName || 'Someone',
    });
  });
}

module.exports = {
  SCOPES,
  roomOf,
  emitMessage,
  emitReceipt,
  emitUpdated,
  emitConversationChanged,
  emitTyping,
};
