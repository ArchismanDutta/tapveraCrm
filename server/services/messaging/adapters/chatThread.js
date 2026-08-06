// services/messaging/adapters/chatThread.js
//
// Thread adapter backed by ChatMessage + Conversation (the ChatPage surface).
//
// Implements the common adapter interface — see ../messaging.service.js for
// the contract. Every method returns BOTH the raw Mongoose document(s) the
// existing REST responses already send, and a `normalized` projection in the
// shared shape. Routes keep returning raw so the live client sees byte-identical
// responses; the new `thread:*` socket events carry normalized. The client
// switches over in architecture Phases 2-4, and raw drops out in Phase 5.
//
// Schema quirks this adapter absorbs so callers never see them:
//   - conversationId / senderId / readBy entries are all **String**, not
//     ObjectId. Casting them silently matches nothing (there is a comment to
//     that effect on the original getUnreadCountsForUser).
//   - `readBy` is a flat array of id strings, whereas the project adapter's is
//     an array of { user, userModel, readAt } subdocuments.
'use strict';

const ChatMessage = require('../../../models/ChatMessage');
const Conversation = require('../../../models/Conversation');
const User = require('../../../models/User');
const { resolveMentions } = require('../mentions');

const SCOPE = 'chat';

/* ── Normalization ────────────────────────────────────────────────────── */

/** Map a ChatMessage document into the shared message shape. */
function normalize(doc) {
  if (!doc) return null;
  const m = doc.toObject ? doc.toObject() : doc;
  const sender = m.senderId && typeof m.senderId === 'object' ? m.senderId : null;

  return {
    id: String(m._id),
    threadId: String(m.conversationId),
    scope: SCOPE,
    sender: {
      id: String(sender?._id ?? m.senderId),
      name: sender?.name ?? null,
      kind: 'User',
    },
    body: m.message || '',
    attachments: m.attachments || [],
    replyTo: m.replyTo || null,
    forwarded: Boolean(m.forwarded),
    // Flat id array here; the project adapter emits the same shape from its
    // {user, userModel} subdocuments.
    mentions: (m.mentions || []).map((id) => ({ id: String(id?.user ?? id), kind: 'User' })),
    reactions: (m.reactions || []).map((r) => ({
      emoji: r.emoji,
      users: (r.users || []).map(String),
    })),
    readBy: (m.readBy || []).map((id) => ({ id: String(id), at: null })),
    deliveredTo: (m.deliveredTo || []).map((d) => ({ id: String(d.user), at: d.at || null })),
    clientMsgId: m.clientMsgId || null,
    // ChatMessage has no stored `status` column (the project schema does), so
    // this is always the baseline. The real tick state is derived from
    // deliveredTo/readBy against thread membership — see receipts.js on the
    // server and deriveStatus() on the client. Emitted regardless so both
    // adapters produce an identical key set.
    status: 'sent',
    pinned: false, // chat threads have no pin concept today
    createdAt: m.timestamp || m.createdAt,
  };
}

/* ── Members ──────────────────────────────────────────────────────────── */

async function getMemberIds(threadId) {
  const conv = await Conversation.findById(threadId).select('members').lean();
  return (conv?.members || []).map(String);
}

/* ── Reads ────────────────────────────────────────────────────────────── */

async function listThreads(user) {
  const userIdStr = String(user._id ?? user.id);
  const groups = await Conversation.find({ type: 'group', members: userIdStr });

  // One aggregate for every group, rather than a count per group inside the
  // map below — that would be N more round trips on a list the sidebar
  // refetches on every group change.
  const counts = await unreadCounts(user, groups.map((g) => g._id));

  const raw = await Promise.all(
    groups.map(async (group) => {
      const memberDetails = await User.find(
        {
          _id: { $in: group.members },
          status: { $nin: ['terminated', 'absconded'] },
        },
        'name role status'
      );
      return {
        ...group.toObject(),
        members: memberDetails,
        unreadCount: counts[String(group._id)] || 0,
      };
    })
  );

  return { raw, normalized: raw.map((t) => ({
    id: String(t._id),
    scope: SCOPE,
    type: t.type,
    name: t.name || null,
    members: (t.members || []).map((m) => ({ id: String(m._id), name: m.name, kind: 'User' })),
    unread: t.unreadCount || 0,
    updatedAt: t.createdAt,
  })) };
}

async function getMessages(user, threadId, { page, limit } = {}) {
  // ─── PAGE 1 IS THE NEWEST MESSAGES, NOT THE OLDEST ───
  //
  // Matches projectThread: query newest-first so page 1 is what the user
  // actually wants to see on open, then reverse so the UI still renders
  // oldest-at-top. Paging *up* through history is page 2, 3, …
  //
  // The naive alternative — sort ascending and skip — makes page 1 the oldest
  // messages in the thread, so opening a conversation would show its first
  // ever messages and the user would have to page forward to reach today.
  //
  // Omitting both page and limit still returns the entire thread, because
  // callers that predate pagination rely on it.
  const filter = { conversationId: String(threadId) };
  const paginated = Boolean(page || limit);

  const limitNum = Number(limit) || 50;
  const pageNum = Number(page) || 1;
  const skip = (pageNum - 1) * limitNum;

  let query = ChatMessage.find(filter).populate({
    path: 'replyTo',
    populate: { path: 'senderId', select: 'name email' },
  });

  let total;
  if (paginated) {
    total = await ChatMessage.countDocuments(filter);
    query = query.sort({ timestamp: -1 }).skip(skip).limit(limitNum);
  } else {
    query = query.sort({ timestamp: 1 });
  }

  let messages = await query;

  // Back to oldest-first for rendering. Only when paginated — the unpaginated
  // branch is already ascending.
  if (paginated) messages = messages.reverse();

  // mentions is a flat id array, so it can't be .populate()d — resolve in one
  // batched lookup rather than the original per-message query in a loop.
  const allIds = [...new Set(messages.flatMap((m) => (m.mentions || []).map(String)))];
  const users = allIds.length
    ? await User.find({ _id: { $in: allIds } }, 'name email').lean()
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));

  for (const message of messages) {
    if (message.mentions?.length) {
      message._doc.mentionedUsers = message.mentions
        .map((id) => byId.get(String(id)))
        .filter(Boolean);
    }
  }

  return {
    raw: messages,
    normalized: messages.map(normalize),
    total: total ?? messages.length,
    // Only present when paginated, so an unpaginated caller sees no pagination
    // block and keeps its existing behaviour. Same shape as projectThread.
    pagination: paginated
      ? {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          // `skip + returned < total` — i.e. are there older messages beyond
          // this page. Since page 1 is the newest, "more" always means older.
          hasMore: skip + messages.length < total,
        }
      : null,
  };
}

async function unreadCounts(user, threadIds) {
  const ids = (threadIds || []).map(String).filter(Boolean);
  if (ids.length === 0) return {};

  const userIdStr = String(user._id ?? user.id);

  // conversationId / senderId / readBy are all String in ChatMessage, so no
  // ObjectId casting here — adding any would silently match nothing.
  const rows = await ChatMessage.aggregate([
    {
      $match: {
        conversationId: { $in: ids },
        senderId: { $ne: userIdStr },
        readBy: { $ne: userIdStr },
      },
    },
    { $group: { _id: '$conversationId', count: { $sum: 1 } } },
  ]);

  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
}

/* ── Writes ───────────────────────────────────────────────────────────── */

async function markRead(user, threadId) {
  const userIdStr = String(user._id ?? user.id);
  const result = await ChatMessage.updateMany(
    {
      conversationId: String(threadId),
      senderId: { $ne: userIdStr },
      readBy: { $ne: userIdStr },
    },
    { $addToSet: { readBy: userIdStr } }
  );
  return { count: result.modifiedCount ?? result.nModified ?? 0 };
}

async function sendMessage(user, threadId, { body, attachments = [], replyTo = null, mentions, clientMsgId = null } = {}) {
  const senderId = String(user._id ?? user.id);

  // Idempotency. A retry after a flaky network — or the offline outbox (S2)
  // draining a message it already managed to send — arrives with the same
  // clientMsgId. Return the original rather than creating a twin.
  if (clientMsgId) {
    const existing = await ChatMessage.findOne({ clientMsgId }).populate('replyTo');
    if (existing) {
      return {
        raw: existing,
        normalized: normalize(existing),
        conversation: await Conversation.findById(threadId),
        mentionIds: (existing.mentions || []).map(String),
        duplicate: true,
      };
    }
  }
  const conversation = await Conversation.findById(threadId);

  // The client sends the list it built from the composer's dropdown; that's
  // authoritative when present. Resolving from text is the fallback for clients
  // that don't (the socket path sends no mentions field) and for text typed
  // without using the picker.
  let mentionIds = (mentions || []).map(String);
  if (mentionIds.length === 0 && body) {
    const memberIds = (conversation?.members || []).map(String);
    const members = await User.find({ _id: { $in: memberIds } }, '_id name').lean();
    mentionIds = resolveMentions(body, {
      members: members.map((u) => ({ ...u, kind: 'User' })),
      authorId: senderId,
    }).map((m) => m.id);
  }

  let saved;
  try {
    saved = await ChatMessage.create({
      conversationId: String(threadId),
      senderId,
      message: body || '',
      attachments,
      replyTo,
      readBy: [senderId], // sender has by definition read their own message
      deliveredTo: [], // recipients ack this themselves
      mentions: mentionIds,
      clientMsgId,
    });
  } catch (err) {
    // Two concurrent retries can both pass the check above and race to insert.
    // The unique index is what actually guarantees uniqueness; this turns the
    // loser of that race into a successful "already sent" rather than a 500.
    if (err?.code === 11000 && clientMsgId) {
      const existing = await ChatMessage.findOne({ clientMsgId }).populate('replyTo');
      if (existing) {
        return {
          raw: existing,
          normalized: normalize(existing),
          conversation,
          mentionIds: (existing.mentions || []).map(String),
          duplicate: true,
        };
      }
    }
    throw err;
  }

  if (saved.replyTo) await saved.populate('replyTo');

  // Daily chat-initiation email digest. This used to live inside
  // chatController.saveMessage; it moves with the send path so rewiring the
  // routes to the service layer doesn't silently drop it. Fire-and-forget by
  // design — an email problem must never fail the send.
  try {
    const dailyChatNotificationService = require('../../dailyChatNotificationService');
    dailyChatNotificationService
      .processNewMessage(saved, String(threadId), senderId)
      .catch((err) => console.error('Failed to process daily chat notifications:', err.message));
  } catch (err) {
    console.error(`[chatThread] daily digest hook unavailable: ${err.message}`);
  }

  return {
    raw: saved,
    normalized: normalize(saved),
    conversation,
    mentionIds,
  };
}

async function react(user, messageId, emoji) {
  const userId = String(user._id ?? user.id);
  const message = await ChatMessage.findById(messageId);
  if (!message) return null;

  const existing = message.reactions.find((r) => r.emoji === emoji);

  if (existing) {
    const idx = existing.users.indexOf(userId);
    if (idx > -1) {
      existing.users.splice(idx, 1);
      if (existing.users.length === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      existing.users.push(userId);
    }
  } else {
    message.reactions.push({ emoji, users: [userId] });
  }

  await message.save();
  return { raw: message, normalized: normalize(message), threadId: String(message.conversationId) };
}

/**
 * Copy messages into other conversations.
 *
 * ─── WHY COPIES AND NOT REFERENCES ───
 * A forward is a new message in the destination thread, not a pointer back to
 * the original. Pointing back would mean the destination's history depends on a
 * conversation its members may not be able to read — and would break outright
 * if the source were ever deleted.
 *
 * ─── ATTACHMENTS ARE SHARED, NOT DUPLICATED ───
 * The copy carries the SAME attachment records, so both messages point at one
 * file on disk. Forwarding a 200MB video to four groups costs nothing extra.
 *
 * The consequence to know about: a stored file can now be referenced by more
 * than one message, so anything that deletes files must check for OTHER
 * references first. Deleting the source conversation must not unlink a file a
 * forward still points at. See the orphan sweep.
 *
 * ─── WHAT IS DELIBERATELY DROPPED ───
 * `mentions`, `replyTo`, `reactions` and receipts do not travel. A mention of
 * someone who isn't in the destination would notify a stranger; a reply points
 * at a message that doesn't exist there; reactions and read state belong to the
 * conversation they happened in.
 *
 * @param {Object}   user
 * @param {String[]} messageIds     source messages, any thread the user can read
 * @param {String[]} destThreadIds  conversations to copy into
 * @returns {Promise<Array>} one { threadId, raw, normalized, conversation } per copy
 */
async function forwardMessages(user, messageIds, destThreadIds) {
  const senderId = String(user._id ?? user.id);

  // Oldest first, so a multi-message forward lands in the destination in the
  // order it was originally said rather than the order the ids happened to
  // arrive in.
  const sources = await ChatMessage.find({ _id: { $in: messageIds } })
    .sort({ timestamp: 1 })
    .lean();

  const results = [];

  for (const threadId of destThreadIds) {
    const conversation = await Conversation.findById(threadId);
    if (!conversation) continue;

    for (const source of sources) {
      const saved = await ChatMessage.create({
        conversationId: String(threadId),
        senderId,
        message: source.message || '',
        // Same attachment records — same files on disk.
        attachments: source.attachments || [],
        readBy: [senderId],
        deliveredTo: [],
        mentions: [],
        replyTo: null,
        forwarded: true,
      });

      results.push({
        threadId: String(threadId),
        raw: saved,
        normalized: normalize(saved),
        conversation,
      });
    }
  }

  return results;
}

module.exports = {
  SCOPE,
  normalize,
  forwardMessages,
  getMemberIds,
  listThreads,
  getMessages,
  unreadCounts,
  markRead,
  sendMessage,
  react,
};
