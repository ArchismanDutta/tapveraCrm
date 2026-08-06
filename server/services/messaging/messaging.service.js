// services/messaging/messaging.service.js
//
// The public messaging API. Routes and Socket.IO handlers call THIS and nothing
// below it — not the adapters, not the models.
//
// ─── THE CONTRACT ───
// Every operation takes (user, scope, threadId, ...) and, in this order:
//   1. AUTHORIZES via access.js — one answer for every transport;
//   2. delegates the storage work to the adapter for `scope`;
//   3. produces notifications through notificationService (the single producer);
//   4. emits real-time through realtime.js.
//
// Callers get back `{ raw, normalized, ... }`. `raw` is the exact document
// shape the REST responses return; `normalized` is the shared cross-scope shape
// carried by the `thread:*` socket events. Both come from the adapter, so the
// two transports can never describe the same message differently.
//
// Adapter interface (both adapters implement all of it):
//   normalize(doc)                       -> normalized message
//   getMemberIds(threadId)               -> [userId]
//   listThreads(user)                    -> { raw, normalized }
//   getMessages(user, threadId, opts)    -> { raw, normalized, total, pagination? }
//   unreadCounts(user, threadIds)        -> { [threadId]: n }
//   markRead(user, threadId)             -> { count }
//   sendMessage(user, threadId, payload) -> { raw, normalized, mentionIds }
//   react(user, messageId, emoji)        -> { raw, normalized, threadId }
'use strict';

const access = require('./access');
const realtime = require('./realtime');
const chatThread = require('./adapters/chatThread');
const projectThread = require('./adapters/projectThread');

const SCOPES = realtime.SCOPES;

/* ── Registry ─────────────────────────────────────────────────────────── */

const ADAPTERS = {
  [SCOPES.CHAT]: chatThread,
  [SCOPES.PROJECT]: projectThread,
};

function adapterFor(scope) {
  const adapter = ADAPTERS[scope];
  if (!adapter) {
    throw new access.AccessError(`Unknown messaging scope "${scope}"`, 400, 'BAD_SCOPE');
  }
  return adapter;
}

/** Authorize against the right rule set for the scope. */
function authorize(user, scope, threadId, action) {
  return scope === SCOPES.PROJECT
    ? access.assertProjectChatAccess(user, threadId, action)
    : access.assertChatAccess(user, threadId, action);
}

/* ── Reads ────────────────────────────────────────────────────────────── */

async function listThreads(user, scope = SCOPES.CHAT) {
  return adapterFor(scope).listThreads(user);
}

async function getMessages(user, scope, threadId, opts = {}) {
  await authorize(user, scope, threadId, 'read');
  return adapterFor(scope).getMessages(user, threadId, opts);
}

async function unreadCounts(user, scope, threadIds) {
  // Deliberately not authorized per-thread: the caller passes ids it already
  // owns (a user's own conversation list), and per-id authorization here would
  // mean N extra document loads on a route the sidebar hits constantly.
  return adapterFor(scope).unreadCounts(user, threadIds);
}

/* ── Writes ───────────────────────────────────────────────────────────── */

async function markRead(user, scope, threadId) {
  await authorize(user, scope, threadId, 'read');
  const result = await adapterFor(scope).markRead(user, threadId);

  if (result.count > 0) {
    realtime.emitReceipt({
      scope,
      threadId,
      messageId: null,
      userId: user._id ?? user.id,
      kind: 'read',
    });
  }

  return result;
}

/* ── Receipts (S1) ────────────────────────────────────────────────────── */

/**
 * Record that a user's device received these messages, and tell the senders.
 *
 * Own messages are filtered inside receipts.recordDelivered — a client acking
 * its own message would make a DM show ✓✓ the instant it was sent.
 */
async function markDelivered(user, scope, threadId, messageIds = []) {
  await authorize(user, scope, threadId, 'read');
  const receipts = require('./receipts');

  const changed = await receipts.recordDelivered(
    scope,
    threadId,
    user._id ?? user.id,
    messageIds
  );

  changed.forEach(({ messageId, status }) => {
    realtime.emitReceipt({
      scope,
      threadId,
      messageId,
      userId: user._id ?? user.id,
      kind: 'delivered',
      status,
    });
  });

  return { updated: changed.length };
}

/**
 * Advance this user's read cursor to `upToMessageId`.
 *
 * A cursor rather than per-message events: the client sends one id when its
 * scroll settles, instead of one round trip per visible row.
 */
async function markReadUpTo(user, scope, threadId, upToMessageId) {
  await authorize(user, scope, threadId, 'read');
  const receipts = require('./receipts');

  const result = await receipts.recordReadUpTo(
    scope,
    threadId,
    user._id ?? user.id,
    upToMessageId
  );

  if (result.count > 0) {
    realtime.emitReceipt({
      scope,
      threadId,
      messageId: upToMessageId,
      userId: user._id ?? user.id,
      kind: 'read',
    });
  }

  return result;
}

/**
 * Send a message.
 *
 * @param {object} payload  { body, attachments, replyTo, mentions, sentBy,
 *                            senderType, clientMsgId }
 * @param {object} [opts]
 * @param {boolean} [opts.notify=true]  persist + push notifications
 * @param {boolean} [opts.emit=true]    broadcast in real time
 */
async function sendMessage(user, scope, threadId, payload = {}, { notify = true, emit = true } = {}) {
  await authorize(user, scope, threadId, 'write');

  const adapter = adapterFor(scope);
  const sent = await adapter.sendMessage(user, threadId, payload);

  // A retry that matched an existing clientMsgId. The message already exists,
  // was already broadcast, and already notified everyone — doing any of it
  // again would double-notify and double-push for one user action. Return the
  // original so the caller still gets a normal-looking success.
  if (sent.duplicate) return sent;

  const memberIds = await adapter.getMemberIds(threadId);

  if (notify) {
    // Never allowed to fail the send — the message is already persisted.
    await _notifyMembers(user, scope, threadId, sent, memberIds).catch((err) =>
      console.error(`[messaging] notification fan-out failed: ${err.message}`)
    );
  }

  if (emit) {
    realtime.emitMessage({
      scope,
      threadId,
      message: sent.normalized,
      memberIds,
    });
  }

  return sent;
}

async function react(user, scope, messageId, emoji) {
  const adapter = adapterFor(scope);

  // The thread isn't known until the message is loaded, so this authorizes
  // after the lookup but before returning anything — reacting must not become
  // a way to confirm that an arbitrary message id exists.
  const result = await adapter.react(user, messageId, emoji);
  if (!result) return null;

  await authorize(user, scope, result.threadId, 'write');

  const memberIds = await adapter.getMemberIds(result.threadId);
  realtime.emitUpdated({
    scope,
    threadId: result.threadId,
    patch: { messageId, reactions: result.raw.reactions },
    memberIds,
  });

  return result;
}

/* ── Notifications ────────────────────────────────────────────────────── */

/**
 * One persisted notification per member except the sender, mentions promoted
 * to high priority. Routed through notificationService, which is already the
 * single producer for in-app notifications.
 */
async function _notifyMembers(user, scope, threadId, sent, memberIds) {
  const notificationService = require('../notificationService');
  const senderId = String(user._id ?? user.id);
  const senderName = user.name || user.clientName || 'Someone';
  const mentionIds = new Set((sent.mentionIds || []).map(String));

  const title = await _threadTitle(scope, threadId, senderId);
  const preview = sent.normalized.body
    ? sent.normalized.body.slice(0, 100) + (sent.normalized.body.length > 100 ? '...' : '')
    : '📎 Attachment';

  for (const memberId of memberIds) {
    if (String(memberId) === senderId) continue;

    const mentioned = mentionIds.has(String(memberId));
    const notifTitle = mentioned
      ? `${senderName} mentioned you in ${title}`
      : `New message from ${senderName} in ${title}`;

    try {
      const notification = await notificationService.createAndSend({
        userId: memberId,
        type: 'chat',
        // Must match the client's channel check in WebSocketContext.
        channel: mentioned ? 'mention' : 'chat',
        title: notifTitle,
        body: preview,
        relatedData:
          scope === SCOPES.PROJECT
            ? { projectId: String(threadId), messageId: String(sent.normalized.id) }
            : { conversationId: String(threadId), messageId: String(sent.normalized.id) },
        priority: mentioned ? 'high' : 'normal',
      });

      // Web push, so this reaches them with the app closed. Deliberately NOT
      // awaited: it holds a 10-second grace window before deciding (see
      // pushPolicy), and the send must not keep the caller's request open for
      // that long. The notification row is already persisted either way.
      _maybePush({
        userId: memberId,
        notificationId: notification?._id,
        scope,
        threadId,
        mentioned,
        title: notifTitle,
        body: preview,
      });
    } catch (err) {
      console.error(`[messaging] notify ${memberId} failed: ${err.message}`);
    }
  }
}

/**
 * Fire-and-forget web push, gated by pushPolicy.
 *
 * Order matters: the cheap synchronous checks (prefs, mute, actively-viewing,
 * coalescing) run FIRST, so the overwhelming majority of suppressed pushes cost
 * nothing. Only a push that has passed all of them pays the 10-second grace
 * wait to re-confirm the message is still unread.
 */
function _maybePush({ userId, notificationId, scope, threadId, mentioned, title, body }) {
  const pushPolicy = require('./pushPolicy');
  const pushService = require('../pushService');

  (async () => {
    const { push, reason } = await pushPolicy.shouldPush({ userId, scope, threadId, mentioned });
    if (!push) {
      console.debug?.(`[push] suppressed for ${userId} (${reason})`);
      return;
    }

    if (notificationId && !(await pushPolicy.stillUnread(notificationId))) {
      console.debug?.(`[push] suppressed for ${userId} (read_during_grace)`);
      return;
    }

    await pushService.sendToUser(userId, {
      title,
      body,
      // One banner per thread: the OS replaces rather than stacks, so a burst
      // reads as one conversation needing attention instead of five alerts.
      tag: `thread-${scope}-${threadId}`,
      url:
        scope === SCOPES.PROJECT
          ? `/projects/${threadId}`
          : `/messages?conversation=${threadId}`,
      data: { scope, threadId, notificationId: String(notificationId || '') },
    });
  })().catch((err) => console.error(`[push] pipeline failed: ${err.message}`));
}

/** Human-readable thread name for notification copy. */
async function _threadTitle(scope, threadId, viewerId) {
  try {
    if (scope === SCOPES.PROJECT) {
      const Project = require('../../models/Project');
      const p = await Project.findById(threadId).select('projectName name').lean();
      return p?.projectName || p?.name || 'a project';
    }

    const Conversation = require('../../models/Conversation');
    const conv = await Conversation.findById(threadId).lean();
    if (!conv) return 'a conversation';
    if (conv.type !== 'private') return conv.name || 'a group';

    // For a DM the useful title is the OTHER participant's name.
    const otherId = (conv.members || []).find((m) => String(m) !== String(viewerId));
    if (!otherId) return 'Private Chat';
    const User = require('../../models/User');
    const other = await User.findById(otherId).select('name').lean();
    return other?.name || 'Private Chat';
  } catch {
    return 'a conversation';
  }
}

module.exports = {
  SCOPES,
  adapterFor,
  authorize,
  listThreads,
  getMessages,
  unreadCounts,
  markRead,
  markDelivered,
  markReadUpTo,
  sendMessage,
  react,
};
