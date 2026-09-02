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
const search = require('./search');
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

/**
 * Which scopes may a forward travel BETWEEN.
 *
 * ─── THIS TABLE IS THE POLICY ───
 * Forwarding is no longer same-scope. A project thread can hand a message to a
 * chat group, which is how something raised with a client gets to the team who
 * has to act on it — today that happens by screenshot, which loses the author
 * and the timestamp.
 *
 * What is deliberately NOT here:
 *   chat -> project    A project thread has CLIENTS in it. Internal chatter
 *                      must not be one mis-click away from a client seeing it.
 *   project -> project The same message reappearing in another client's thread
 *                      is a confidentiality question, not a convenience one.
 *
 * Adding a route is a one-line change here plus a `createForwardedCopies` on
 * the destination adapter. Both halves are required on purpose: a scope with
 * no writer cannot become a destination by accident.
 */
const FORWARD_DESTINATIONS = {
  [SCOPES.CHAT]: [SCOPES.CHAT],
  [SCOPES.PROJECT]: [SCOPES.CHAT],
};

/**
 * Forward messages into other conversations, possibly in another scope.
 *
 * ─── AUTHORIZATION IS PER END, AND PER DESTINATION ───
 * Read access to the source is checked once IN THE SOURCE'S OWN SCOPE; write
 * access is checked for EVERY destination independently in the DESTINATION's
 * scope. Forwarding to four groups where you've since been removed from one
 * should deliver to the other three and tell you about the one, not silently
 * deliver nothing.
 *
 * On top of that, the destination adapter gets a veto (`forwardDestinationGate`)
 * for rules that depend on where the message came FROM — which is what refuses
 * a project message into a one-to-one chat while leaving chat -> chat alone.
 *
 * Each copy is broadcast live exactly like an ordinary send, so a forward is
 * not a lesser kind of message. Notifications are batched PER DESTINATION
 * rather than per copy — see _notifyForwardBatch for why that matters.
 *
 * @param {Object}   user
 * @param {String}   sourceScope     'chat' | 'project'
 * @param {String}   sourceThreadId  where the messages are being taken from
 * @param {String[]} messageIds
 * @param {String[]} destThreadIds   all in the destination scope for
 *                                   `sourceScope`, per FORWARD_DESTINATIONS
 * @param {String}   [forwardToken]  identifies one forward ACTION, so a retry
 *                                   after a client-side timeout returns the
 *                                   copies already written instead of writing
 *                                   a second set. Minted by the client; see
 *                                   messagingApi.newForwardToken.
 * @returns {Promise<{ delivered, failed }>}
 */
async function forwardMessages(
  user,
  sourceScope,
  sourceThreadId,
  messageIds,
  destThreadIds,
  forwardToken = null
) {
  const [destScope] = FORWARD_DESTINATIONS[sourceScope] || [];
  if (!destScope) {
    throw new access.AccessError(
      `Messages in "${sourceScope}" threads cannot be forwarded`,
      400,
      'UNSUPPORTED'
    );
  }

  const sourceAdapter = adapterFor(sourceScope);
  const destAdapter = adapterFor(destScope);

  // Both halves, checked before anything is read or written. A scope listed in
  // the table above but missing its writer is a programming error, not a user
  // one — but it must still fail as a 400 rather than a bare 500.
  if (
    typeof sourceAdapter.readForForward !== 'function' ||
    typeof destAdapter.createForwardedCopies !== 'function'
  ) {
    throw new access.AccessError(
      `Forwarding from "${sourceScope}" to "${destScope}" is not supported`,
      400,
      'UNSUPPORTED'
    );
  }

  await authorize(user, sourceScope, sourceThreadId, 'read');

  // Check every destination BEFORE writing anything, so a partial failure can't
  // leave messages copied into some threads and rejected by others mid-run.
  const allowed = [];
  const failed = [];
  for (const threadId of destThreadIds || []) {
    try {
      const ctx = await authorize(user, destScope, threadId, 'write');

      // Costs no extra query: assertChatAccess already loaded the thread and
      // handed it back precisely so callers don't refetch it.
      const gate =
        typeof destAdapter.forwardDestinationGate === 'function'
          ? destAdapter.forwardDestinationGate(ctx, { fromScope: sourceScope })
          : { ok: true };

      if (!gate.ok) {
        failed.push({ threadId: String(threadId), reason: gate.reason });
        continue;
      }

      allowed.push(String(threadId));
    } catch (err) {
      failed.push({ threadId: String(threadId), reason: err.message });
    }
  }

  if (allowed.length === 0) return { delivered: [], failed };

  const sources = await sourceAdapter.readForForward(messageIds);
  if (sources.length === 0) return { delivered: [], failed };

  const { copies, missing } = await destAdapter.createForwardedCopies(
    user,
    sources,
    allowed,
    forwardToken
  );

  // A destination that vanished between the authorization check and the write
  // is reported, not swallowed. The adapter used to skip it silently, so it
  // showed up in neither list and the user was simply never told.
  for (const threadId of missing || []) {
    failed.push({ threadId, reason: 'Conversation no longer exists' });
  }

  // Members are resolved once per destination, not once per copied message —
  // forwarding 10 messages to 5 groups is 5 lookups, not 50.
  const membersByThread = new Map();
  for (const threadId of allowed) {
    membersByThread.set(threadId, await destAdapter.getMemberIds(threadId));
  }

  // ─── WHY THIS IS GROUPED BY DESTINATION ───
  // This used to call _notifyMembers once per COPY, and _notifyMembers awaits
  // notificationService.createAndSend once per MEMBER — which is two round
  // trips each (create, then save() to set delivered) — and re-resolved the
  // thread title every time. Forwarding 10 messages to 5 groups of 12 was
  // ~1,100 sequential writes plus 50 redundant title lookups, all inside the
  // HTTP request, with no server-side timeout to stop it. On a slower database
  // link that runs past the client's 30s axios timeout, the browser aborts,
  // and the user sees a connection error for a forward that is still running
  // and will eventually succeed.
  //
  // One batch per destination instead: one title lookup, one insertMany, and
  // one notification describing the whole forward rather than N of them
  // arriving as a burst.
  const copiesByThread = new Map();
  for (const copy of copies) {
    if (!copiesByThread.has(copy.threadId)) copiesByThread.set(copy.threadId, []);
    copiesByThread.get(copy.threadId).push(copy);
  }

  for (const [threadId, threadCopies] of copiesByThread) {
    const memberIds = membersByThread.get(threadId) || [];

    // Everything below is in the DESTINATION's scope — that is where the copies
    // now live, and it is the room their recipients are listening in.
    await _notifyForwardBatch(user, destScope, threadId, threadCopies, memberIds).catch((err) =>
      console.error(`[messaging] forward notification failed: ${err.message}`)
    );

    // Still one event per message — each copy has to appear in the thread.
    // These are cheap and synchronous; it was never the emits that were slow.
    for (const copy of threadCopies) {
      realtime.emitMessage({
        scope: destScope,
        threadId,
        message: copy.normalized,
        memberIds,
      });
    }
  }

  return {
    delivered: copies.map((c) => ({ threadId: c.threadId, id: String(c.raw._id) })),
    failed,
  };
}

/**
 * Edit a message's text, within the sender's edit window.
 *
 * The adapter owns the two rules that decide this (you sent it; it is recent),
 * because both depend on fields only it knows how to read. What happens here
 * is the part every write shares: verify the caller can still write to the
 * thread at all, then broadcast.
 *
 * That second check matters and is not redundant — someone removed from a
 * group after posting must not be able to keep rewriting what they left
 * behind.
 */
async function editMessage(user, scope, messageId, body) {
  const adapter = adapterFor(scope);
  if (typeof adapter.editMessage !== 'function') {
    throw new access.AccessError(`Editing is not supported for "${scope}" threads`, 400, 'UNSUPPORTED');
  }

  const result = await adapter.editMessage(user, messageId, body);
  if (result?.error) return result;

  await authorize(user, scope, result.threadId, 'write');

  const memberIds = await adapter.getMemberIds(result.threadId);
  realtime.emitUpdated({
    scope,
    threadId: result.threadId,
    // Both keys on purpose: `message` is the raw document shape the REST
    // responses use, `body` the normalized one carried by thread:* events.
    // Clients read whichever they were built against, and a patch that only
    // carried one would update some surfaces and not others.
    patch: {
      messageId: String(messageId),
      message: result.normalized.body,
      body: result.normalized.body,
      mentions: result.normalized.mentions,
      editedAt: result.normalized.editedAt,
    },
    memberIds,
  });

  return result;
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

/* ── Deletion ─────────────────────────────────────────────────────────── */

/**
 * Delete a message, in one of two quite different senses.
 *
 *   'me'       — hide it from the caller. Any message they can see, no window,
 *                nobody else affected and nobody else told.
 *   'everyone' — retract it. Sender only, inside the window, body and
 *                attachments cleared from the document. A tombstone stays in
 *                place so replies, read cursors and ordering survive; the
 *                thread renders it as "This message was deleted".
 *
 * ─── WHY THE AUTHORIZATION DIFFERS BY MODE ───
 * Hiding needs only READ on the thread: you cannot hide something you were
 * never allowed to see, and nothing about anyone else's copy changes.
 * Retracting is a write to a message everyone holds, so it needs WRITE — which
 * also means someone removed from the group after posting cannot reach back
 * in and retract what they left behind, the same rule editMessage enforces.
 *
 * Both authorize AFTER the lookup so this cannot be used to probe whether an
 * arbitrary message id exists — the ordering `react` and `getMessageContext`
 * already use.
 */
async function deleteMessage(user, scope, messageId, mode = 'me') {
  if (mode !== 'me' && mode !== 'everyone') {
    throw new access.AccessError('mode must be "me" or "everyone"', 400, 'BAD_MODE');
  }

  const adapter = adapterFor(scope);
  if (typeof adapter.deleteForMe !== 'function' || typeof adapter.deleteForEveryone !== 'function') {
    throw new access.AccessError(`Deleting is not supported for "${scope}" threads`, 400, 'UNSUPPORTED');
  }

  if (mode === 'me') {
    const result = await adapter.deleteForMe(user, messageId);
    if (result?.error) return result;

    await authorize(user, scope, result.threadId, 'read');

    // Only this person's own sessions. See emitUpdatedToUsers.
    realtime.emitUpdatedToUsers([String(user._id ?? user.id)], {
      scope,
      threadId: result.threadId,
      patch: { messageId: result.messageId, removed: true },
    });

    return result;
  }

  const result = await adapter.deleteForEveryone(user, messageId);
  if (result?.error) return result;

  await authorize(user, scope, result.threadId, 'write');

  const memberIds = await adapter.getMemberIds(result.threadId);
  realtime.emitUpdated({
    scope,
    threadId: result.threadId,
    // Both key spellings, for the same reason editMessage sends both: REST
    // responses carry the raw document shape and thread:* events carry the
    // normalized one, and clients read whichever they were built against.
    patch: {
      messageId: result.messageId,
      deleted: true,
      deletedAt: result.normalized.deletedAt,
      body: '',
      message: '',
      attachments: [],
    },
    memberIds,
  });

  return result;
}

/* ── Search ───────────────────────────────────────────────────────────── */

/**
 * Search message history.
 *
 * ─── WHAT THIS REPLACES ───
 * Every surface filtered its in-memory list, and only the newest 50 messages
 * are loaded when a thread opens — so "search" meant "highlight something
 * already on screen", and anything older than the last page was unfindable.
 * For a CRM that is the wrong way round: the reason to keep talk on the record
 * is to be able to find what was said about that record months later.
 *
 * ─── SCOPE RESOLUTION IS THE SECURITY BOUNDARY ───
 * When no `threadId` is given this searches EVERYTHING the user can read, and
 * that set is derived server-side from membership (access.accessible*Ids).
 * A thread list taken from the request would turn this endpoint into "read any
 * thread whose id you can guess".
 *
 * @param {object} opts
 * @param {'chat'|'project'|'all'} opts.scope
 * @param {string} [opts.threadId]  narrow to one thread; omit to search all
 * @param {string} opts.query
 * @returns {Promise<{ results, total, pagination, query }>}
 */
async function searchMessages(user, opts = {}) {
  const { scope = SCOPES.CHAT, threadId, query: rawQuery, senderId, startDate, endDate, page, limit } = opts;

  const parsed = search.parseQuery(rawQuery);
  if (!parsed.ok) throw new access.AccessError(parsed.reason, 400, 'BAD_QUERY');

  const paging = search.parsePaging({ page, limit });
  const range = {
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
  };

  const common = {
    query: parsed.query,
    pattern: parsed.pattern,
    senderId: senderId || null,
    ...range,
    ...paging,
  };

  // One named thread: authorize it directly and search only that.
  if (threadId) {
    if (scope === 'all') {
      throw new access.AccessError('Pick a scope when searching one thread', 400, 'BAD_REQUEST');
    }
    await authorize(user, scope, threadId, 'read');
    const adapter = adapterFor(scope);
    const out = await adapter.searchMessages(user, { ...common, threadIds: [String(threadId)] });
    return { ...out, query: parsed.query };
  }

  const runScope = async (s) => {
    const adapter = adapterFor(s);
    if (typeof adapter.searchMessages !== 'function') {
      return { results: [], total: 0, pagination: { ...paging, total: 0, totalPages: 0, hasMore: false } };
    }
    const threadIds =
      s === SCOPES.PROJECT
        ? await access.accessibleProjectIds(user)
        : await access.accessibleConversationIds(user);
    return adapter.searchMessages(user, { ...common, threadIds });
  };

  if (scope !== 'all') {
    const out = await runScope(scope);
    return { ...out, query: parsed.query };
  }

  // ─── SEARCHING EVERYWHERE ───
  // Two collections with no shared ordering key, so a true merged cursor would
  // need a union view. Instead each side is asked for everything up to the
  // requested depth, the two are merged by date and the page is cut from that.
  // Exact for the pages anyone actually pages to, and two queries rather than
  // a scan; it would degrade only for someone paging hundreds deep, which the
  // limit clamp already makes impractical.
  const deep = { ...common, skip: 0, limit: paging.skip + paging.limit };
  const [chat, project] = await Promise.all([
    (async () => {
      const ids = await access.accessibleConversationIds(user);
      return adapterFor(SCOPES.CHAT).searchMessages(user, { ...deep, threadIds: ids });
    })(),
    (async () => {
      const ids = await access.accessibleProjectIds(user);
      return adapterFor(SCOPES.PROJECT).searchMessages(user, { ...deep, threadIds: ids });
    })(),
  ]);

  const merged = [...chat.results, ...project.results].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const total = chat.total + project.total;
  const pageSlice = merged.slice(paging.skip, paging.skip + paging.limit);

  return {
    results: pageSlice,
    total,
    query: parsed.query,
    pagination: {
      page: paging.page,
      limit: paging.limit,
      total,
      totalPages: Math.ceil(total / paging.limit),
      hasMore: paging.skip + pageSlice.length < total,
    },
  };
}

/**
 * The conversation around one message, for previewing a search hit.
 *
 * Authorizes AFTER the lookup, deliberately — the same ordering `react` uses.
 * Checking first would need the thread id from the caller, which turns this
 * into a way to test whether an arbitrary message id exists.
 */
async function getMessageContext(user, scope, messageId, { before, after } = {}) {
  const adapter = adapterFor(scope);
  if (typeof adapter.contextAround !== 'function') {
    throw new access.AccessError(`Context is not available for "${scope}" threads`, 400, 'UNSUPPORTED');
  }

  const context = await adapter.contextAround(user, messageId, { before, after });
  if (!context) throw new access.AccessError('Message not found', 404, 'NOT_FOUND');

  await authorize(user, scope, context.threadId, 'read');
  return context;
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
 * Notification fan-out for ONE destination of a forward.
 *
 * Differs from _notifyMembers in two ways that matter at this volume:
 *   - one persisted row per member for the WHOLE batch, written with
 *     notifyUsers (a single insertMany) rather than a create+save per member;
 *   - one title lookup for the destination rather than one per copied message.
 *
 * Recipients get "Ana forwarded 6 messages to Design" instead of six separate
 * notifications landing at once, which is also just better behaviour.
 */
async function _notifyForwardBatch(user, scope, threadId, copies, memberIds) {
  const notificationService = require('../notificationService');
  const senderId = String(user._id ?? user.id);
  const senderName = user.name || user.clientName || 'Someone';

  const recipients = (memberIds || []).filter((id) => String(id) !== senderId);
  if (recipients.length === 0 || copies.length === 0) return;

  const title = await _threadTitle(scope, threadId, senderId);

  const first = copies[0].normalized;
  const firstPreview = first.body
    ? first.body.slice(0, 100) + (first.body.length > 100 ? '...' : '')
    : '📎 Attachment';
  const preview =
    copies.length === 1
      ? firstPreview
      : `${firstPreview} — and ${copies.length - 1} more`;

  const notifTitle =
    copies.length === 1
      ? `${senderName} forwarded a message to ${title}`
      : `${senderName} forwarded ${copies.length} messages to ${title}`;

  // Deep-link to the newest copy, which is what the thread scrolls to.
  const lastId = String(copies[copies.length - 1].normalized.id);

  await notificationService.notifyUsers(recipients, {
    type: 'chat',
    // Forwards are never mentions — the adapter drops the source's mention
    // list on purpose, so nobody is @-ed by a message being passed on.
    channel: 'chat',
    title: notifTitle,
    body: preview,
    relatedData:
      scope === SCOPES.PROJECT
        ? { projectId: String(threadId), messageId: lastId }
        : { conversationId: String(threadId), messageId: lastId },
    priority: 'normal',
  });

  // Web push, one banner per recipient for the whole batch. Not awaited — see
  // the note in _notifyMembers; pushPolicy holds a 10-second grace window and
  // the rows above are already persisted either way.
  for (const memberId of recipients) {
    _maybePush({
      userId: memberId,
      notificationId: null,
      scope,
      threadId,
      mentioned: false,
      title: notifTitle,
      body: preview,
    });
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
      // Both are real routes and both are read on arrival: the project
       // detail route is singular, and ChatPage opens ?conversation= on load.
      url:
        scope === SCOPES.PROJECT
          ? `/project/${threadId}`
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
  FORWARD_DESTINATIONS,
  adapterFor,
  authorize,
  listThreads,
  getMessages,
  unreadCounts,
  markRead,
  markDelivered,
  markReadUpTo,
  sendMessage,
  forwardMessages,
  editMessage,
  react,
  searchMessages,
  getMessageContext,
  deleteMessage,
};
