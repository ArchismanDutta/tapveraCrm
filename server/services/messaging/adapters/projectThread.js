// services/messaging/adapters/projectThread.js
//
// Thread adapter backed by Message + Project (the ProjectMessagePanel surface).
//
// Same interface as chatThread.js — see ../messaging.service.js for the
// contract. Returns raw documents (byte-identical to what the REST routes
// already send) alongside the shared normalized shape.
//
// Schema quirks this adapter absorbs:
//   - `project` and `sentBy` are real ObjectId refs, and senders are
//     polymorphic across User | Client via `senderModel` / refPath. The chat
//     adapter's ids are plain strings and always Users.
//   - `readBy` holds { user, userModel, readAt } subdocuments rather than a
//     flat id array.
//   - `mentions` holds { user, userModel } subdocuments, not ids.
//   - Extra features chat doesn't have: status, pinning, starring.
'use strict';

const Message = require('../../../models/Message');
const Project = require('../../../models/Project');
const User = require('../../../models/User');
const Client = require('../../../models/Client');
const { resolveMentions } = require('../mentions');
const { buildSnippet } = require('../search');

const SCOPE = 'project';

/** The populate chain every read path uses — kept in one place so the shapes
 *  the client already receives can't drift between list and send. */
const POPULATE = [
  { path: 'sentBy', select: 'name email clientName designation' },
  {
    path: 'replyTo',
    select: 'message sentBy createdAt senderType',
    populate: { path: 'sentBy', select: 'name email clientName designation' },
  },
  { path: 'mentions.user', select: 'name email clientName' },
];

const applyPopulate = (q) => POPULATE.reduce((acc, p) => acc.populate(p), q);

/* ── Normalization ────────────────────────────────────────────────────── */

function normalize(doc) {
  if (!doc) return null;
  const m = doc.toObject ? doc.toObject() : doc;
  const sender = m.sentBy && typeof m.sentBy === 'object' ? m.sentBy : null;

  return {
    id: String(m._id),
    threadId: String(m.project),
    scope: SCOPE,
    sender: {
      id: String(sender?._id ?? m.sentBy),
      name: sender?.name ?? sender?.clientName ?? null,
      kind: m.senderModel || 'User',
    },
    body: m.deletedForEveryone ? '' : m.message || '',
    attachments: m.deletedForEveryone ? [] : m.attachments || [],
    deleted: Boolean(m.deletedForEveryone),
    deletedAt: m.deletedAt || null,
    replyTo: m.replyTo || null,
    // Project threads have no forward feature — messagingApi rejects the scope
    // outright — but the key is emitted anyway, exactly as chatThread emits
    // `pinned: false` for a pin concept chat doesn't have. The normalized shape
    // is a CLIENT contract: one consumer has to be able to read both scopes
    // without asking which one it got, and a key that exists on one shape and
    // is absent from the other breaks that. This was the sole difference
    // between the two key sets, and the parity assertion in
    // tests/messaging-service.test.js has been failing on it.
    forwarded: Boolean(m.forwarded),
    mentions: (m.mentions || []).map((x) => ({
      id: String(x.user?._id ?? x.user),
      kind: x.userModel || 'User',
    })),
    reactions: (m.reactions || []).map((r) => ({
      emoji: r.emoji,
      users: (r.users || []).map((u) => String(u.user ?? u)),
    })),
    readBy: (m.readBy || []).map((r) => ({ id: String(r.user), at: r.readAt || null })),
    deliveredTo: (m.deliveredTo || []).map((d) => ({ id: String(d.user), at: d.at || null })),
    clientMsgId: m.clientMsgId || null,
    status: m.status || 'sent',
    pinned: Boolean(m.isPinned),
    // Always null today — project messages have no edit path yet. Emitted
    // regardless so both adapters produce an identical key set, which is what
    // lets the client treat a normalized message the same whichever scope it
    // came from (and is asserted by messaging-service.test.js).
    editedAt: m.editedAt || null,
    createdAt: m.createdAt,
  };
}

/* ── Members ──────────────────────────────────────────────────────────── */

/**
 * Everyone who should receive this thread's messages: assigned employees plus
 * clients. Both the current `clients` array and the legacy single `client`
 * field are read — see the schema comments in models/Project.js.
 */
async function getMemberIds(threadId) {
  const project = await Project.findById(threadId).select('assignedTo clients client').lean();
  if (!project) return [];

  const ids = new Set();
  (project.assignedTo || []).forEach((id) => ids.add(String(id)));
  (project.clients || []).forEach((id) => ids.add(String(id)));
  if (project.client) ids.add(String(project.client));
  return [...ids];
}

/* ── Reads ────────────────────────────────────────────────────────────── */

async function listThreads(user) {
  // Project threads are not browsed as a list the way chat conversations are —
  // the panel is always opened from a project the user already navigated to.
  // Present for interface parity; the service exposes it, nothing calls it yet.
  return { raw: [], normalized: [] };
}

async function getMessages(user, threadId, opts = {}) {
  const { search, startDate, endDate, senderName, page, limit } = opts;

  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 50;
  const skip = (pageNum - 1) * limitNum;

  // See the note in chatThread.getMessages — filtered at the query so the
  // pagination totals stay honest.
  const viewerId = String(user?._id ?? user?.id ?? '');
  const filter = { project: threadId };
  if (viewerId) filter.deletedFor = { $ne: viewerId };
  if (search) filter.message = { $regex: search, $options: 'i' };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const total = await Message.countDocuments(filter);

  const messages = await applyPopulate(Message.find(filter))
    .sort({ createdAt: -1 }) // newest first for pagination…
    .skip(skip)
    .limit(limitNum);

  // senderName filters the fetched page only — matching the existing behaviour
  // exactly. It is applied post-query because the name lives on the populated
  // sender, not on Message.
  let filtered = messages;
  if (senderName) {
    filtered = messages.filter((msg) => {
      const name = msg.sentBy?.name || msg.sentBy?.clientName || '';
      return name.toLowerCase().includes(senderName.toLowerCase());
    });
  }

  // …then reversed so the UI renders oldest-first.
  filtered = filtered.reverse();

  return {
    raw: filtered,
    normalized: filtered.map(normalize),
    total,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      hasMore: skip + filtered.length < total,
    },
  };
}

async function unreadCounts(user, threadIds) {
  const userId = String(user._id ?? user.id);
  const out = {};
  for (const id of threadIds || []) {
    out[String(id)] = await Message.countDocuments({
      project: id,
      sentBy: { $ne: userId },
      'readBy.user': { $ne: userId },
    });
  }
  return out;
}

/* ── Writes ───────────────────────────────────────────────────────────── */

async function markRead(user, threadId) {
  const userId = String(user._id ?? user.id);
  const userModel = user.role === 'client' || user.userType === 'Client' ? 'Client' : 'User';

  // $push, not $addToSet: addToSet compares the whole subdocument, and readAt
  // is a fresh Date every call, so it could never actually dedupe. The filter
  // is what guarantees at-most-one entry per user — it only matches messages
  // this user is not already in readBy for.
  //
  // One updateMany replaces the previous read-N-documents-then-save-each-one
  // loop, which cost N round trips on every thread open.
  const result = await Message.updateMany(
    {
      project: threadId,
      sentBy: { $ne: userId },
      'readBy.user': { $ne: userId },
    },
    { $push: { readBy: { user: userId, userModel, readAt: new Date() } } }
  );

  return { count: result.modifiedCount ?? result.nModified ?? 0 };
}

async function sendMessage(user, threadId, { body, attachments = [], replyTo = null, mentions, sentBy, senderType, clientMsgId = null } = {}) {
  const senderId = String(sentBy || user._id || user.id);

  // Idempotency — see the matching block in chatThread.js.
  if (clientMsgId) {
    const existing = await applyPopulate(Message.findOne({ clientMsgId }));
    if (existing) {
      return {
        raw: existing,
        normalized: normalize(existing),
        mentionIds: (existing.mentions || []).map((m) => String(m.user)),
        duplicate: true,
      };
    }
  }
  const senderModel = user.role === 'client' || user.userType === 'Client' ? 'Client' : 'User';

  // Client-supplied mention list wins; otherwise resolve from the text against
  // this project's own members. The old parseMentionsFromMessage searched every
  // User and Client in the database, so "@John" could notify an unrelated John
  // — see services/messaging/mentions.js for why that is now scoped.
  let mentionDocs = [];
  if (mentions && mentions.length) {
    mentionDocs = mentions.map((m) =>
      typeof m === 'object' && m.user
        ? { user: m.user, userModel: m.userModel || 'User' }
        : { user: m, userModel: 'User' }
    );
  } else if (body) {
    const memberIds = await getMemberIds(threadId);
    const [users, clients] = await Promise.all([
      User.find({ _id: { $in: memberIds } }, '_id name').lean(),
      Client.find({ _id: { $in: memberIds } }, '_id clientName').lean(),
    ]);
    const candidates = [
      ...users.map((u) => ({ _id: u._id, name: u.name, kind: 'User' })),
      ...clients.map((c) => ({ _id: c._id, name: c.clientName, kind: 'Client' })),
    ];
    mentionDocs = resolveMentions(body, { members: candidates, authorId: senderId })
      .map((m) => ({ user: m.id, userModel: m.kind }));
  }

  let created;
  try {
    created = await Message.create({
      project: threadId,
      message: (body || '').trim(),
      sentBy: senderId,
      senderModel,
      senderType: senderType || user.role,
      replyTo: replyTo || null,
      attachments,
      mentions: mentionDocs,
      clientMsgId,
      deliveredTo: [],
    });
  } catch (err) {
    // Concurrent retries race past the check above; the unique index is what
    // actually enforces uniqueness. Turn the loser into "already sent".
    if (err?.code === 11000 && clientMsgId) {
      const existing = await applyPopulate(Message.findOne({ clientMsgId }));
      if (existing) {
        return {
          raw: existing,
          normalized: normalize(existing),
          mentionIds: (existing.mentions || []).map((m) => String(m.user)),
          duplicate: true,
        };
      }
    }
    throw err;
  }

  const populated = await applyPopulate(Message.findById(created._id));

  return {
    raw: populated,
    normalized: normalize(populated),
    mentionIds: mentionDocs.map((m) => String(m.user)),
  };
}

async function react(user, messageId, emoji) {
  const userId = String(user._id ?? user.id);
  const userModel = user.role === 'client' || user.userType === 'Client' ? 'Client' : 'User';

  const message = await Message.findById(messageId);
  if (!message) return null;

  const existing = message.reactions.find((r) => r.emoji === emoji);

  if (existing) {
    const idx = existing.users.findIndex((u) => String(u.user) === userId);
    if (idx > -1) {
      existing.users.splice(idx, 1);
      if (existing.users.length === 0) {
        message.reactions = message.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      existing.users.push({ user: userId, userModel });
    }
  } else {
    message.reactions.push({ emoji, users: [{ user: userId, userModel }] });
  }

  await message.save();
  return { raw: message, normalized: normalize(message), threadId: String(message.project) };
}

/* ── Forwarding ───────────────────────────────────────────────────────── */

/**
 * Read messages so they can be copied elsewhere — the SOURCE half of a
 * forward.
 *
 * Project threads are a source only. They do not RECEIVE forwards, so there is
 * deliberately no `createForwardedCopies` here: a project thread has clients
 * in it, and internal chat arriving there is not something a member should be
 * able to do by accident. The service's scope table is the one place that
 * decides this — see FORWARD_DESTINATIONS in messaging.service.js.
 *
 * Returns exactly the shape chatThread.readForForward does. That parity is
 * what lets the service pair any source adapter with any destination adapter
 * without knowing which is which; the parity assertion lives in
 * tests/forward-messages.test.js.
 *
 * Ordered oldest-first on createdAt (the project schema's time field; chat
 * uses `timestamp`), so a multi-message forward lands in the order it was
 * originally said.
 *
 * @returns {Promise<Array<{ id, body, attachments }>>}
 */
async function readForForward(messageIds) {
  const docs = await Message.find({ _id: { $in: messageIds } })
    .sort({ createdAt: 1 })
    .lean();

  return docs.map((d) => ({
    id: String(d._id),
    body: d.message || '',
    // Passed through whole. The destination adapter narrows these to the
    // fields its own schema declares — see forwardableAttachment in
    // chatThread.js, which deliberately drops `s3Key` so a copy can never
    // authorise deleting the original's file.
    attachments: d.attachments || [],
  }));
}

/* ── Deletion ─────────────────────────────────────────────────────────── */

/**
 * Same seven minutes as chat. Project threads have no edit path, but they DO
 * have clients in them — which is exactly where a mis-sent message costs most,
 * so retraction matters here more than it does internally, not less.
 */
const DELETE_WINDOW_MS = Number(process.env.CHAT_DELETE_WINDOW_MINUTES || 7) * 60 * 1000;

/** See chatThread.deletability — same rules, same ordering, project fields. */
function deletability(message, userId, now = Date.now()) {
  if (!message) return { ok: false, reason: 'NOT_FOUND', status: 404 };
  if (message.deletedForEveryone) return { ok: false, reason: 'ALREADY_DELETED', status: 409 };

  // sentBy is polymorphic (User | Client) but the id comparison is the same
  // either way — a client retracting their own message is exactly as valid.
  const author = String(message.sentBy?._id ?? message.sentBy ?? '');
  if (author !== String(userId)) return { ok: false, reason: 'NOT_SENDER', status: 403 };

  const sentAt = new Date(message.createdAt).getTime();
  if (!Number.isFinite(sentAt)) return { ok: false, reason: 'NO_TIMESTAMP', status: 400 };

  if (now - sentAt > DELETE_WINDOW_MS) return { ok: false, reason: 'WINDOW_EXPIRED', status: 403 };

  return { ok: true };
}

async function deleteForMe(user, messageId) {
  const userId = String(user._id ?? user.id);
  const message = await Message.findById(messageId);
  if (!message) return { error: 'NOT_FOUND', status: 404 };

  await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });

  return { threadId: String(message.project), messageId: String(messageId), mode: 'me' };
}

/** See chatThread.deleteForEveryone, including what is NOT done about files. */
async function deleteForEveryone(user, messageId) {
  const userId = String(user._id ?? user.id);
  const message = await Message.findById(messageId);

  const check = deletability(message, userId);
  if (!check.ok) return { error: check.reason, status: check.status };

  message.message = '';
  message.attachments = [];
  message.mentions = [];
  message.deletedForEveryone = true;
  message.deletedAt = new Date();
  message.deletedBy = userId;
  await message.save();

  return {
    raw: message,
    normalized: normalize(message),
    threadId: String(message.project),
    messageId: String(messageId),
    mode: 'everyone',
  };
}

/* ── Search ───────────────────────────────────────────────────────────── */

/**
 * Full-history search across project threads.
 *
 * @param {string[]|null} opts.threadIds  projects the user may read. `null`
 *        means UNRESTRICTED — an admin or projects:manage holder — and the id
 *        filter is omitted entirely rather than sending every project id in
 *        the tenant as an `$in` on every keystroke. See
 *        access.accessibleProjectIds.
 */
async function searchMessages(user, { query, pattern, threadIds, senderId, startDate, endDate, page, limit, skip }) {
  const unrestricted = threadIds === null;
  const ids = unrestricted ? null : (threadIds || []).map(String).filter(Boolean);

  if (!unrestricted && ids.length === 0) {
    return { results: [], total: 0, pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } };
  }

  const filter = {
    message: pattern,
    deletedForEveryone: { $ne: true },
    deletedFor: { $ne: String(user._id ?? user.id) },
  };
  if (!unrestricted) filter.project = { $in: ids };
  if (senderId) filter.sentBy = senderId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const [total, rows] = await Promise.all([
    Message.countDocuments(filter),
    Message.find(filter)
      .populate({ path: 'sentBy', select: 'name email clientName designation' })
      .populate({ path: 'project', select: 'projectName name' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const results = rows.map((row) => ({
    scope: SCOPE,
    threadId: String(row.project?._id ?? row.project),
    threadName: row.project?.projectName || row.project?.name || 'Project',
    messageId: String(row._id),
    sender: {
      id: String(row.sentBy?._id ?? row.sentBy ?? ''),
      // Clients carry clientName rather than name — the same fallback chain
      // the bubbles render with, so a result reads like the message does.
      name: row.sentBy?.name || row.sentBy?.clientName || 'Unknown',
    },
    senderType: row.senderType || null,
    createdAt: row.createdAt,
    hasAttachments: Boolean(row.attachments?.length),
    snippet: buildSnippet(row.message, query),
  }));

  return {
    results,
    total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + rows.length < total,
    },
  };
}

/** A few messages either side of one message. See chatThread.contextAround. */
async function contextAround(user, messageId, { before = 5, after = 5 } = {}) {
  const target = await Message.findById(messageId).lean();
  if (!target) return null;

  const projectId = String(target.project);
  const at = target.createdAt;

  const withSender = (q) => q.populate({ path: 'sentBy', select: 'name email clientName designation' });

  const viewerId = String(user?._id ?? user?.id ?? '');
  const hidden = viewerId ? { deletedFor: { $ne: viewerId } } : {};

  const [older, newer] = await Promise.all([
    withSender(Message.find({ project: target.project, createdAt: { $lt: at }, ...hidden }))
      .sort({ createdAt: -1 })
      .limit(before)
      .lean(),
    withSender(Message.find({ project: target.project, createdAt: { $gt: at }, ...hidden }))
      .sort({ createdAt: 1 })
      .limit(after)
      .lean(),
  ]);

  const targetPopulated = await withSender(Message.findById(messageId)).lean();
  const window = [...older.reverse(), targetPopulated, ...newer];

  return {
    scope: SCOPE,
    threadId: projectId,
    messages: window.map((m) => ({
      id: String(m._id),
      body: m.deletedForEveryone ? '' : m.message || '',
      deleted: Boolean(m.deletedForEveryone),
      sender: {
        id: String(m.sentBy?._id ?? m.sentBy ?? ''),
        name: m.sentBy?.name || m.sentBy?.clientName || 'Unknown',
      },
      senderType: m.senderType || null,
      createdAt: m.createdAt,
      hasAttachments: !m.deletedForEveryone && Boolean(m.attachments?.length),
      isMatch: String(m._id) === String(messageId),
    })),
  };
}

module.exports = {
  SCOPE,
  normalize,
  readForForward,
  searchMessages,
  contextAround,
  deletability,
  deleteForMe,
  deleteForEveryone,
  DELETE_WINDOW_MS,
  getMemberIds,
  listThreads,
  getMessages,
  unreadCounts,
  markRead,
  sendMessage,
  react,
  applyPopulate,
  POPULATE,
};
