// services/messaging/receipts.js
//
// The ✓ / ✓✓ / ✓✓-blue state machine.
//
//   sent       ✓         the server has it
//   delivered  ✓✓        it reached every recipient's DEVICE
//   read       ✓✓ blue   every recipient actually looked at it
//
// ─── DELIVERED IS NOT READ ───
// Delivery is acked automatically the moment a recipient's socket receives the
// message — it says nothing about whether anyone saw it. Read requires genuine
// visibility: thread open, window focused, row on screen. Conflating the two is
// the single most common way this feature gets built wrong, and it produces
// blue ticks for messages nobody looked at.
//
// ─── GROUP AGGREGATION ───
// In a group the aggregate only advances when EVERY member except the sender
// has reached that state — the same rule WhatsApp uses. Per-member detail stays
// available for a "Read by 3 of 5" view.
//
// ─── PRIVACY ───
// The read tick is governed by MessagingPrefs.showReadReceipts with the same
// reciprocity rule as presence: hide yours and you stop seeing others'. The
// DELIVERY tick is never hidden — it is infrastructure ("it reached their
// device"), not behaviour ("they read it at 11:47pm"). WhatsApp draws the line
// in exactly the same place: the privacy setting hides blue ticks, never grey.
'use strict';

const MessagingPrefs = require('../../models/MessagingPrefs');

const SCOPES = { CHAT: 'chat', PROJECT: 'project' };

/* ── Aggregation ──────────────────────────────────────────────────────── */

/**
 * Derive a message's status from its receipts.
 *
 * @param {object} args
 * @param {string[]} args.recipientIds  members EXCLUDING the sender
 * @param {string[]} args.deliveredIds
 * @param {string[]} args.readIds
 * @returns {'sent'|'delivered'|'read'}
 */
function aggregateStatus({ recipientIds = [], deliveredIds = [], readIds = [] }) {
  // A thread with no other members can never advance past sent — there is
  // nobody to deliver to. Without this guard `every()` on an empty array is
  // vacuously true and a note-to-self would instantly show as read.
  if (recipientIds.length === 0) return 'sent';

  const delivered = new Set(deliveredIds.map(String));
  const read = new Set(readIds.map(String));

  // Reading implies delivery — a recipient cannot read something that never
  // arrived. Old messages have readBy but no deliveredTo (the field postdates
  // them), so without this they would be stuck at ✓ despite being read.
  const allRead = recipientIds.every((id) => read.has(String(id)));
  if (allRead) return 'read';

  const allDelivered = recipientIds.every(
    (id) => delivered.has(String(id)) || read.has(String(id))
  );
  if (allDelivered) return 'delivered';

  return 'sent';
}

/**
 * Status as the VIEWER is allowed to see it.
 *
 * Downgrades 'read' to 'delivered' when receipts are hidden either way, so the
 * sender sees grey ✓✓ rather than nothing at all — the message did arrive, and
 * hiding that would be less informative than the truth without being any more
 * private.
 */
function visibleStatus(status, canSeeReadReceipts) {
  if (status === 'read' && !canSeeReadReceipts) return 'delivered';
  return status;
}

/**
 * May `viewer` see read receipts from `others`?
 * Reciprocal: opting out blinds you as well as hiding you.
 */
async function canSeeReadReceipts(viewerId, otherIds = []) {
  const viewer = await MessagingPrefs.forUser(viewerId);
  if (!viewer.showReadReceipts) return false;
  if (otherIds.length === 0) return true;

  const optedOut = await MessagingPrefs.countDocuments({
    user: { $in: otherIds },
    showReadReceipts: false,
  });
  // If ANY participant has opted out, the aggregate read tick would leak their
  // behaviour, so it is withheld for the whole thread.
  return optedOut === 0;
}

/* ── Recording ────────────────────────────────────────────────────────── */

/** Extract the recipient/delivered/read id sets from either schema. */
function receiptIds(scope, doc) {
  if (scope === SCOPES.PROJECT) {
    return {
      deliveredIds: (doc.deliveredTo || []).map((d) => String(d.user)),
      readIds: (doc.readBy || []).map((r) => String(r.user)),
      senderId: String(doc.sentBy?._id ?? doc.sentBy),
    };
  }
  return {
    deliveredIds: (doc.deliveredTo || []).map((d) => String(d.user)),
    readIds: (doc.readBy || []).map(String),
    senderId: String(doc.senderId?._id ?? doc.senderId),
  };
}

/**
 * Record that `userId` received these messages on a device.
 *
 * Own messages are filtered out server-side rather than trusted to the client:
 * a sender acking their own message would make a one-to-one chat show ✓✓ the
 * instant it was sent, regardless of the recipient.
 *
 * @returns {Promise<Array<{messageId, status}>>} messages whose aggregate moved
 */
async function recordDelivered(scope, threadId, userId, messageIds = []) {
  if (!messageIds.length) return [];

  const uid = String(userId);
  const changed = [];

  if (scope === SCOPES.PROJECT) {
    const Message = require('../../models/Message');
    const docs = await Message.find({
      _id: { $in: messageIds },
      project: threadId,
      sentBy: { $ne: uid },
      'deliveredTo.user': { $ne: uid },
    }).select('_id sentBy deliveredTo readBy');

    if (!docs.length) return [];

    await Message.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $push: { deliveredTo: { user: uid, userModel: 'User', at: new Date() } } }
    );

    const recipientIds = await _recipientIds(scope, threadId);
    docs.forEach((doc) => {
      const { deliveredIds, readIds, senderId } = receiptIds(scope, doc);
      const status = aggregateStatus({
        recipientIds: recipientIds.filter((id) => id !== senderId),
        deliveredIds: [...deliveredIds, uid],
        readIds,
      });
      changed.push({ messageId: String(doc._id), status });
    });
  } else {
    const ChatMessage = require('../../models/ChatMessage');
    const docs = await ChatMessage.find({
      _id: { $in: messageIds },
      conversationId: String(threadId),
      senderId: { $ne: uid },
      'deliveredTo.user': { $ne: uid },
    }).select('_id senderId deliveredTo readBy');

    if (!docs.length) return [];

    await ChatMessage.updateMany(
      { _id: { $in: docs.map((d) => d._id) } },
      { $push: { deliveredTo: { user: uid, at: new Date() } } }
    );

    const recipientIds = await _recipientIds(scope, threadId);
    docs.forEach((doc) => {
      const { deliveredIds, readIds, senderId } = receiptIds(scope, doc);
      const status = aggregateStatus({
        recipientIds: recipientIds.filter((id) => id !== senderId),
        deliveredIds: [...deliveredIds, uid],
        readIds,
      });
      changed.push({ messageId: String(doc._id), status });
    });
  }

  return changed;
}

/**
 * Mark everything up to and including `upToMessageId` as read by this user.
 *
 * A CURSOR, not a per-message event. The client sends one id when its scroll
 * settles; sending an event per visible message would be dozens of round trips
 * for one glance at a thread.
 */
async function recordReadUpTo(scope, threadId, userId, upToMessageId) {
  const uid = String(userId);

  if (scope === SCOPES.PROJECT) {
    const Message = require('../../models/Message');
    const anchor = await Message.findById(upToMessageId).select('createdAt').lean();
    if (!anchor) return { count: 0 };

    const res = await Message.updateMany(
      {
        project: threadId,
        createdAt: { $lte: anchor.createdAt },
        sentBy: { $ne: uid },
        'readBy.user': { $ne: uid },
      },
      { $push: { readBy: { user: uid, userModel: 'User', readAt: new Date() } } }
    );
    return { count: res.modifiedCount ?? 0 };
  }

  const ChatMessage = require('../../models/ChatMessage');
  const anchor = await ChatMessage.findById(upToMessageId).select('timestamp').lean();
  if (!anchor) return { count: 0 };

  const res = await ChatMessage.updateMany(
    {
      conversationId: String(threadId),
      timestamp: { $lte: anchor.timestamp },
      senderId: { $ne: uid },
      readBy: { $ne: uid },
    },
    { $addToSet: { readBy: uid } }
  );
  return { count: res.modifiedCount ?? 0 };
}

/** Thread membership, via the scope's adapter. */
async function _recipientIds(scope, threadId) {
  const adapter =
    scope === SCOPES.PROJECT
      ? require('./adapters/projectThread')
      : require('./adapters/chatThread');
  return (await adapter.getMemberIds(threadId)).map(String);
}

module.exports = {
  SCOPES,
  aggregateStatus,
  visibleStatus,
  canSeeReadReceipts,
  receiptIds,
  recordDelivered,
  recordReadUpTo,
};
