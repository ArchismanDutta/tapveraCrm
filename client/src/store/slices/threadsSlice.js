import { createSlice, createAsyncThunk, createSelector } from "@reduxjs/toolkit";
import * as messagingApi from "../../api/messagingApi";

/**
 * Thread store — one slice for BOTH messaging surfaces.
 *
 * ─── WHY ONE SLICE ───
 * ChatPage and ProjectMessagePanel are the same problem twice: a list of
 * messages, an unread count, typing indicators, a read cursor. They diverged
 * only because the server spoke two dialects. Since Phase 1 it speaks one
 * (`thread:*`, scope-tagged), so the client can too. Threads are keyed
 * `"<scope>:<id>"` — e.g. `chat:665f…`, `project:6701…`.
 *
 * ─── WHAT THIS REPLACES ───
 * Component `useState` + `sessionStorage` mirrors + a 21-event
 * `window.CustomEvent` bus across 63 call sites. Nothing owned the truth, so a
 * component that mounted late or unmounted mid-stream silently missed updates.
 * That is the root cause of the unread-count desync.
 *
 * ─── DEDUP IS LOAD-BEARING ───
 * The server currently DUAL-EMITS: every message arrives as both the legacy
 * `chat:message`/`project:message` event and the new `thread:message`. During
 * Phases 2-4 both paths may feed this slice. `upsertMessage` is idempotent on
 * `id` and on `clientMsgId`, so a double delivery can never duplicate a bubble
 * or double-count a badge. This is also what will make the optimistic-send
 * reconciliation in the WhatsApp-parity work (S1/S2) safe.
 *
 * REST stays authoritative; socket events are the "make it instant" layer on
 * top — same discipline as notificationSlice.
 */

/* ── Helpers ──────────────────────────────────────────────────────────── */

export const threadKey = messagingApi.threadKey;

// How many messages a page holds. Chat threads were previously loaded in full
// on every open — a year-old group is a multi-megabyte payload and a long
// render for messages nobody scrolls back to.
export const PAGE_SIZE = 50;

const EMPTY = Object.freeze([]);

/**
 * Move a thread to "just active" for recency ordering.
 *
 * Both fields are written because the two surfaces read different ones: the
 * chat list sorts on `updatedAt` (the normalized shape) and the DM roster on
 * `lastMessageAt` (the raw one). Setting only one leaves the other stale, and
 * the resulting list is sorted correctly in one tab and not the other.
 *
 * No-op when the thread has not been listed yet — see the call site.
 */
function touchThread(state, key, message) {
  const thread = state.threads[key];
  if (!thread) return;

  const at = message?.createdAt ?? message?.timestamp ?? new Date().toISOString();
  // Never move a thread BACKWARDS. Out-of-order delivery is normal on a flaky
  // connection, and a late-arriving older message must not demote a
  // conversation below one that has been quiet for longer.
  const existing = thread.lastMessageAt ?? thread.updatedAt;
  if (existing && new Date(existing).getTime() > new Date(at).getTime()) return;

  thread.lastMessageAt = at;
  thread.updatedAt = at;
}

/** Ensure the per-thread buckets exist before writing to them. */
function ensure(state, key) {
  if (!state.messagesByKey[key]) state.messagesByKey[key] = [];
  if (state.unreadByKey[key] === undefined) state.unreadByKey[key] = 0;
  if (!state.typingByKey[key]) state.typingByKey[key] = {};
  if (!state.statusByKey[key]) state.statusByKey[key] = "idle";
  if (!state.olderStatusByKey) state.olderStatusByKey = {};
  if (!state.olderStatusByKey[key]) state.olderStatusByKey[key] = "idle";
}

/**
 * Drop every trace of a thread.
 *
 * The counterpart to `ensure`, and it has to clear ALL of the same buckets —
 * `unreadByKey` above all. `selectTotalUnread` sums that map without consulting
 * `state.threads`, so a leftover unread entry keeps feeding the nav badge for a
 * conversation the user can no longer open. That is a badge you cannot clear by
 * any action in the UI, which is precisely the failure this slice was written to
 * end; leaving one bucket behind reintroduces it one layer up.
 */
function forget(state, key) {
  delete state.threads[key];
  delete state.messagesByKey[key];
  delete state.unreadByKey[key];
  delete state.typingByKey[key];
  delete state.statusByKey[key];
  delete state.paginationByKey[key];
  if (state.olderStatusByKey) delete state.olderStatusByKey[key];
  if (state.activeKey === key) state.activeKey = null;
}

/** Milliseconds for a message's sort position. Chat uses `timestamp`, project
 *  uses `createdAt`; the normalized shape uses `createdAt`. Accept all three. */
const timeOf = (m) => {
  const t = m?.createdAt ?? m?.timestamp;
  const ms = t ? new Date(t).getTime() : NaN;
  return Number.isNaN(ms) ? 0 : ms;
};

const idOf = (m) => String(m?.id ?? m?._id ?? "");

const senderIdOf = (m) =>
  String(m?.sender?.id ?? m?.senderId ?? m?.sentBy?._id ?? m?.sentBy ?? "");

/**
 * Derive a message's tick state from its receipts (S1).
 *
 * Mirrors server/services/messaging/receipts.js#aggregateStatus, which is the
 * authority — this exists so the sender's own ticks advance the instant a
 * receipt event lands, without waiting for a refetch.
 *
 * The two guards matter:
 *   - no recipients => "sent". `[].every()` is vacuously true, so without this
 *     a note-to-self would render as read the moment it was sent.
 *   - reading implies delivery. Messages predating `deliveredTo` have readBy
 *     populated and deliveredTo empty; without this they would be stuck at ✓
 *     forever despite having been read.
 */
export function deriveStatus(message, recipientIds = []) {
  if (message?.status === "sending" || message?.status === "failed") return message.status;
  if (!recipientIds.length) return "sent";

  const delivered = new Set((message?.deliveredTo || []).map((d) => String(d.id ?? d)));
  const read = new Set((message?.readBy || []).map((r) => String(r.id ?? r)));

  const others = recipientIds.map(String).filter((id) => id !== senderIdOf(message));
  if (!others.length) return "sent";

  if (others.every((id) => read.has(id))) return "read";
  if (others.every((id) => delivered.has(id) || read.has(id))) return "delivered";
  return "sent";
}

/**
 * Insert or replace a message, keeping the list ordered oldest-first.
 *
 * Out-of-order arrival is normal on a flaky connection, so this inserts at the
 * correct position rather than appending — appending is what makes messages
 * visibly jump around after a reconnect.
 */
function upsertMessage(list, message) {
  const id = idOf(message);
  const cid = message?.clientMsgId;

  const existing = list.findIndex(
    (m) => (id && idOf(m) === id) || (cid && m?.clientMsgId && m.clientMsgId === cid)
  );

  if (existing !== -1) {
    // Merge rather than replace: the optimistic copy may hold local-only fields
    // (upload progress, a pending File) the server echo doesn't know about.
    list[existing] = { ...list[existing], ...message };
    return false; // not new
  }

  const at = timeOf(message);
  let i = list.length;
  while (i > 0 && timeOf(list[i - 1]) > at) i -= 1;
  list.splice(i, 0, message);
  return true; // newly added
}

/* ── Thunks ───────────────────────────────────────────────────────────── */

export const fetchThreads = createAsyncThunk(
  "threads/fetchThreads",
  async (scope = messagingApi.SCOPES.CHAT) => {
    const threads = await messagingApi.listThreads(scope);
    return { scope, threads };
  }
);

export const fetchMessages = createAsyncThunk(
  "threads/fetchMessages",
  async ({ scope, threadId, params }) => {
    const { messages, pagination } = await messagingApi.fetchMessages(scope, threadId, params);
    return { key: threadKey(scope, threadId), messages, pagination };
  }
);

/**
 * Load the next OLDER page of a thread.
 *
 * Page 1 is the newest messages (see the chat adapter), so paging up through
 * history means page 2, 3, … Reads the current pagination from the store
 * rather than taking a page number, so a caller can't accidentally re-request
 * a page it already has or skip one.
 *
 * The "nothing older" and "already in flight" guards live in `condition`
 * below, NOT in the payload creator — see the comment there. A scroll
 * listener fires many times per gesture, so the in-flight guard is what stops
 * a burst of duplicate requests.
 */
export const fetchOlderMessages = createAsyncThunk(
  "threads/fetchOlderMessages",
  async ({ scope, threadId, limit = PAGE_SIZE }, { getState }) => {
    const key = threadKey(scope, threadId);
    const pagination = getState().threads.paginationByKey[key];
    const nextPage = (pagination?.page || 1) + 1;

    const { messages, pagination: next } = await messagingApi.fetchMessages(
      scope,
      threadId,
      { page: nextPage, limit }
    );

    return { key, messages, pagination: next, skipped: false };
  },
  {
    /**
     * These guards MUST live here rather than inside the payload creator.
     *
     * createAsyncThunk dispatches `pending` — whose reducer sets
     * olderStatusByKey[key] = "loading" — BEFORE it invokes the creator. A
     * creator that checks that flag therefore always sees its own pending
     * action and bails. That is not a hypothetical: "Load earlier messages"
     * issued no network request at all, in every chat, group and project
     * thread, with no error and no spinner to show for it — the click simply
     * did nothing.
     *
     * `condition` is evaluated BEFORE `pending` is dispatched, which is the
     * whole reason it exists. Returning false here skips the thunk silently,
     * dispatching neither pending nor rejected.
     */
    condition: ({ scope, threadId }, { getState }) => {
      const key = threadKey(scope, threadId);
      const state = getState().threads;

      if (!state.paginationByKey[key]?.hasMore) return false;
      if (state.olderStatusByKey[key] === "loading") return false;
      return true;
    },
  }
);

export const sendMessage = createAsyncThunk(
  "threads/sendMessage",
  async ({ scope, threadId, ...payload }) => {
    const saved = await messagingApi.sendMessage(scope, threadId, payload);
    return { key: threadKey(scope, threadId), message: saved };
  }
);

/**
 * Forward messages to other conversations.
 *
 * `sourceScope` is where the messages are being taken FROM ('chat' or
 * 'project'); the copies always land in chat conversations, so the destination
 * side of the store is always keyed on the chat scope.
 *
 * No optimistic insert: the copies land in threads the user isn't necessarily
 * looking at, and the server broadcasts each one over `thread:message` anyway,
 * so the store fills in through the normal live path. Optimism here would risk
 * showing a message in a destination that then rejected it. It also means
 * forwarding OUT of a project needs no special handling here at all — the
 * chat-scoped `thread:message` events do the work.
 */
export const forwardMessages = createAsyncThunk(
  "threads/forwardMessages",
  async ({ sourceScope, sourceThreadId, messageIds, destinationThreadIds, forwardToken }) => {
    const result = await messagingApi.forwardMessages(
      sourceScope,
      sourceThreadId,
      messageIds,
      destinationThreadIds,
      forwardToken
    );
    return result;
  }
);

export const markThreadRead = createAsyncThunk(
  "threads/markRead",
  async ({ scope, threadId }) => {
    const count = await messagingApi.markRead(scope, threadId);
    return { key: threadKey(scope, threadId), count };
  }
);

export const fetchUnreadCount = createAsyncThunk(
  "threads/fetchUnreadCount",
  async ({ scope, threadId }) => {
    const count = await messagingApi.fetchUnreadCount(scope, threadId);
    return { key: threadKey(scope, threadId), count: count || 0 };
  }
);

/* ── Slice ────────────────────────────────────────────────────────────── */

const initialState = {
  threads: {},        // key -> thread summary
  messagesByKey: {},  // key -> Message[] (oldest first)
  unreadByKey: {},    // key -> number
  typingByKey: {},    // key -> { [userId]: userName }
  statusByKey: {},    // key -> idle | loading | ready | error
  paginationByKey: {},
  // Separate from statusByKey: loading an older page must not put the thread
  // into "loading" and blank the messages already on screen.
  olderStatusByKey: {},
  activeKey: null,
};

const threadsSlice = createSlice({
  name: "threads",
  initialState,
  reducers: {
    /** The thread the user is currently looking at. Drives whether an incoming
     *  message bumps the unread badge. */
    setActiveThread: {
      reducer(state, action) {
        state.activeKey = action.payload;
        if (action.payload) {
          ensure(state, action.payload);
          state.unreadByKey[action.payload] = 0;
        }
      },
      prepare: (scope, threadId) => ({
        payload: scope && threadId ? threadKey(scope, threadId) : null,
      }),
    },

    /**
     * A message arrived over the socket — from either the new `thread:message`
     * or a legacy `chat:`/`project:message` event. Idempotent (see the dedup
     * note at the top), so wiring both paths at once is safe.
     */
    receiveMessage(state, action) {
      const { scope, threadId, message, currentUserId } = action.payload || {};
      if (!threadId || !message) return;

      const key = threadKey(scope, threadId);
      ensure(state, key);

      const isNew = upsertMessage(state.messagesByKey[key], message);
      if (!isNew) return;

      const senderId = String(message?.sender?.id ?? message?.senderId ?? message?.sentBy?._id ?? message?.sentBy ?? "");
      const mine = currentUserId && senderId === String(currentUserId);

      // Don't badge a thread the user is actively reading, and never badge your
      // own message echoing back from your other tabs.
      if (!mine && key !== state.activeKey) {
        state.unreadByKey[key] = (state.unreadByKey[key] || 0) + 1;
      }

      // ─── KEEP THE THREAD'S RECENCY CURRENT ───
      //
      // The conversation list sorts on this. Without it the timestamp only
      // moved when `fetchThreads` refetched, so a DM that just arrived left
      // its sender wherever they already were in the list — and the ordering
      // silently corrected itself on the next refresh, which reads as the
      // list being wrong until you reload.
      //
      // Guarded rather than created: `ensure` deliberately does not make a
      // `threads[key]` entry, and inventing a half-formed one here would put
      // a nameless row in the sidebar. A thread we have never listed will
      // arrive complete from the next fetch.
      touchThread(state, key, message);

      // Someone who just sent a message is definitionally no longer typing.
      if (senderId && state.typingByKey[key]) delete state.typingByKey[key][senderId];
    },

    /** Read/delivered receipt. Stored on the message so the ticks can render. */
    receiveReceipt(state, action) {
      const { scope, threadId, messageId, userId, kind, at, status } = action.payload || {};
      if (!threadId) return;
      const key = threadKey(scope, threadId);
      ensure(state, key);

      const list = state.messagesByKey[key];
      // A null messageId means "everything up to now" — the thread-level
      // mark-read signal.
      const targets = messageId ? list.filter((m) => idOf(m) === String(messageId)) : list;

      targets.forEach((m) => {
        if (kind === "read") {
          m.readBy = m.readBy || [];
          if (!m.readBy.some((r) => String(r.id ?? r) === String(userId))) {
            m.readBy.push({ id: String(userId), at: at || null });
          }
        } else if (kind === "delivered") {
          m.deliveredTo = m.deliveredTo || [];
          if (!m.deliveredTo.some((r) => String(r.id ?? r) === String(userId))) {
            m.deliveredTo.push({ id: String(userId), at: at || null });
          }
        } else if (kind === "status") {
          m.status = status;
        }

        // The server sends its own aggregate alongside a delivery receipt.
        // Trust it over the locally derived one: this client may not know the
        // full membership of the thread.
        if (status && kind !== "status") m.status = status;
      });
    },

    /** Patch a message or the thread in place (pin, reactions, rename). */
    receiveThreadUpdated(state, action) {
      const { scope, threadId, patch } = action.payload || {};
      if (!threadId || !patch) return;
      const key = threadKey(scope, threadId);
      ensure(state, key);

      if (patch.messageId) {
        const list = state.messagesByKey[key];
        const idx = list.findIndex((m) => idOf(m) === String(patch.messageId));
        if (idx === -1) return;

        // "Delete for me" removes the row outright. Merging `removed: true`
        // onto it would leave a message on screen wearing a flag nothing
        // renders — the point is that it is gone, for this person, here and
        // in their other tabs. Only ever sent to that user (see
        // realtime.emitUpdatedToUsers), so this cannot hide a message from
        // anyone else.
        if (patch.removed) {
          list.splice(idx, 1);
          return;
        }

        // messageId is the addressing key, not a field to write onto the row.
        // A retraction arrives as `{ deleted: true, body: '', attachments: [] }`
        // and merges like any other patch, so the row keeps its place in the
        // order and anything replying to it still resolves.
        const { messageId: _messageId, ...fields } = patch;
        list[idx] = { ...list[idx], ...fields };
        return;
      }

      state.threads[key] = { ...(state.threads[key] || {}), ...patch };
    },

    receiveTyping(state, action) {
      const { scope, threadId, userId, userName, stop } = action.payload || {};
      if (!threadId || !userId) return;
      const key = threadKey(scope, threadId);
      ensure(state, key);
      if (stop) delete state.typingByKey[key][userId];
      else state.typingByKey[key][userId] = userName || "Someone";
    },

    /** Local-only clear, e.g. a typing indicator that timed out client-side. */
    clearTyping(state, action) {
      const { scope, threadId } = action.payload || {};
      const key = threadKey(scope, threadId);
      if (state.typingByKey[key]) state.typingByKey[key] = {};
    },

    setUnread(state, action) {
      const { scope, threadId, count } = action.payload || {};
      const key = threadKey(scope, threadId);
      ensure(state, key);
      state.unreadByKey[key] = count || 0;
    },

    /**
     * Show a message the instant the user hits send (S2).
     *
     * Rendered from `status: "sending"` with a clock icon, before any network
     * call. The server echo later merges onto this same row via clientMsgId —
     * see upsertMessage, which merges rather than replaces so local-only fields
     * (the pending File, upload progress) survive reconciliation.
     */
    enqueueOptimistic(state, action) {
      const { scope, threadId, message } = action.payload || {};
      if (!threadId || !message?.clientMsgId) return;
      const key = threadKey(scope, threadId);
      ensure(state, key);
      upsertMessage(state.messagesByKey[key], { ...message, status: "sending" });
      // Your own message counts as activity too. Without this, replying to
      // someone leaves them where they were in the list until their reply
      // arrives — the one moment you most expect them to jump to the top.
      touchThread(state, key, message);
    },

    /**
     * A queued message failed to send.
     *
     * It stays in the list, visibly failed and retryable — never silently
     * dropped. Losing someone's typed message because the network blinked is
     * the worst outcome this subsystem can produce.
     */
    markSendFailed(state, action) {
      const { scope, threadId, clientMsgId, error } = action.payload || {};
      if (!threadId || !clientMsgId) return;
      const key = threadKey(scope, threadId);
      ensure(state, key);
      const row = state.messagesByKey[key].find((m) => m.clientMsgId === clientMsgId);
      if (row) {
        row.status = "failed";
        row.sendError = error || null;
      }
    },

    /** Back to "sending" when a failed message is retried. */
    markSendRetrying(state, action) {
      const { scope, threadId, clientMsgId } = action.payload || {};
      if (!threadId || !clientMsgId) return;
      const key = threadKey(scope, threadId);
      ensure(state, key);
      const row = state.messagesByKey[key].find((m) => m.clientMsgId === clientMsgId);
      if (row) {
        row.status = "sending";
        row.sendError = null;
      }
    },

    /**
     * A thread the user no longer has — deleted, or they were removed from it.
     *
     * Driven by the `conversation:updated` socket event, which already carries
     * an `action` discriminator (`deleted` / `member_removed`) that nothing was
     * reading: all three listeners just refetched the list. A refetch alone
     * could never fix this, because `fetchThreads.fulfilled` only ever ADDED
     * keys — so the dead conversation stayed in the sidebar, stayed clickable,
     * and 404'd on open.
     *
     * Handling it here rather than only in the refetch means the thread vanishes
     * on the event itself, without waiting for a round trip.
     */
    removeThread: {
      reducer(state, action) {
        const key = action.payload;
        if (key) forget(state, key);
      },
      prepare: (scope, threadId) => ({
        payload: scope && threadId ? threadKey(scope, threadId) : null,
      }),
    },

    /** Drop an optimistic row the user chose to discard. */
    discardOptimistic(state, action) {
      const { scope, threadId, clientMsgId } = action.payload || {};
      if (!threadId || !clientMsgId) return;
      const key = threadKey(scope, threadId);
      if (!state.messagesByKey[key]) return;
      state.messagesByKey[key] = state.messagesByKey[key].filter(
        (m) => m.clientMsgId !== clientMsgId
      );
    },

    resetThreads() {
      return initialState;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchThreads.fulfilled, (state, action) => {
        const { scope, threads } = action.payload;

        const seen = new Set();
        threads.forEach((t) => {
          const key = threadKey(scope, String(t._id ?? t.id));
          seen.add(key);
          ensure(state, key);
          state.threads[key] = t;
          // The list response carries the server's authoritative unread count.
          if (typeof t.unreadCount === "number") state.unreadByKey[key] = t.unreadCount;
        });

        // ─── PRUNE WHAT THE SERVER NO LONGER LISTS ───
        //
        // This response is the complete set of threads the user has in this
        // scope, so anything held locally and absent from it is gone — deleted,
        // or they were removed from it. Without this the merge was additive
        // only and dead conversations accumulated for the life of the session.
        //
        // Scoped by prefix: a `fetchThreads('chat')` must not evict project
        // threads, which this response says nothing about.
        //
        // Only threads we have a RECORD for are candidates. `ensure()` creates
        // empty buckets speculatively — a `thread:message` for a group you were
        // just added to arrives before the list refetch that would name it — and
        // pruning on the bucket maps would delete that message a moment before
        // the thread it belongs to shows up.
        const prefix = `${scope}:`;
        Object.keys(state.threads).forEach((key) => {
          if (key.startsWith(prefix) && !seen.has(key)) forget(state, key);
        });
      })
      .addCase(fetchMessages.pending, (state, action) => {
        const { scope, threadId } = action.meta.arg;
        const key = threadKey(scope, threadId);
        ensure(state, key);
        state.statusByKey[key] = "loading";
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { key, messages, pagination } = action.payload;
        ensure(state, key);
        state.statusByKey[key] = "ready";

        // A page-1 refetch must not rewind how far back the thread has been
        // paged. Reconnects and several UI actions refetch page 1, and since
        // messages are merged rather than replaced, the older pages stay on
        // screen — but resetting `page` to 1 makes the next "Load earlier"
        // re-request a page that is already there. Every row dedupes away in
        // upsertMessage and the button appears to do nothing.
        //
        // hasMore is kept alongside it: it describes whether anything older
        // than the current position remains, and page 1's answer to that
        // question is about a position the thread has already moved past.
        if (pagination) {
          const previous = state.paginationByKey[key];
          const rewound =
            previous && (pagination.page || 1) < (previous.page || 1);

          state.paginationByKey[key] = rewound
            ? { ...pagination, page: previous.page, hasMore: previous.hasMore }
            : pagination;
        } else {
          state.paginationByKey[key] = pagination;
        }
        // REST is authoritative: merge server rows over whatever the socket
        // delivered, rather than clobbering — an optimistic message still in
        // flight must survive a concurrent refetch.
        messages.forEach((m) => upsertMessage(state.messagesByKey[key], m));
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const { scope, threadId } = action.meta.arg;
        state.statusByKey[threadKey(scope, threadId)] = "error";
      })

      // ── Older pages ──
      // Tracked in olderStatusByKey, NOT statusByKey: putting the thread into
      // "loading" while paging up would blank the messages already on screen,
      // which is the opposite of what the user asked for.
      .addCase(fetchOlderMessages.pending, (state, action) => {
        const { scope, threadId } = action.meta.arg;
        const key = threadKey(scope, threadId);
        ensure(state, key);
        state.olderStatusByKey[key] = "loading";
      })
      .addCase(fetchOlderMessages.fulfilled, (state, action) => {
        const { key, messages, pagination, skipped } = action.payload || {};
        if (!key) return;
        ensure(state, key);
        state.olderStatusByKey[key] = "idle";

        // A skipped call (nothing older, or already in flight) must not
        // overwrite pagination — doing so could clear hasMore and permanently
        // stop the thread from loading more.
        if (skipped) return;

        if (pagination) state.paginationByKey[key] = pagination;
        // upsertMessage inserts by timestamp, so older rows land at the front
        // without needing a separate prepend path.
        messages.forEach((m) => upsertMessage(state.messagesByKey[key], m));
      })
      .addCase(fetchOlderMessages.rejected, (state, action) => {
        const { scope, threadId } = action.meta.arg;
        state.olderStatusByKey[threadKey(scope, threadId)] = "idle";
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const { key, message } = action.payload;
        ensure(state, key);
        upsertMessage(state.messagesByKey[key], message);
      })
      .addCase(markThreadRead.fulfilled, (state, action) => {
        const { key } = action.payload;
        ensure(state, key);
        state.unreadByKey[key] = 0;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        const { key, count } = action.payload;
        ensure(state, key);
        state.unreadByKey[key] = count;
      });
  },
});

export const {
  enqueueOptimistic,
  markSendFailed,
  markSendRetrying,
  discardOptimistic,
  removeThread,
  setActiveThread,
  receiveMessage,
  receiveReceipt,
  receiveThreadUpdated,
  receiveTyping,
  clearTyping,
  setUnread,
  resetThreads,
} = threadsSlice.actions;

/* ── Selectors ────────────────────────────────────────────────────────── */

/**
 * Cache a per-thread selector so the same (scope, threadId) yields the SAME
 * function identity on every render.
 *
 * Without this each render built a fresh selector. For the plain lookups that
 * was merely wasteful — they return a reference straight out of state, so
 * useSelector's identity check still worked. For anything DERIVED it was a real
 * bug: selectPending ran .filter() and handed back a new array every call, so
 * useSelector saw a changed value on every store action and re-rendered the
 * composer whether or not anything it cared about had moved.
 *
 * The map is keyed by thread and grows with the number of distinct threads the
 * user opens in a session — bounded by their conversation list, not by time or
 * message volume.
 */
const perKey = (build) => {
  const cache = new Map();
  return (scope, threadId) => {
    const key = threadKey(scope, threadId);
    let selector = cache.get(key);
    if (!selector) {
      selector = build(key);
      cache.set(key, selector);
    }
    return selector;
  };
};

export const selectMessages = perKey((key) => (s) => s.threads.messagesByKey[key] || EMPTY);

export const selectOlderStatus = perKey(
  (key) => (s) => s.threads.olderStatusByKey?.[key] || "idle"
);

export const selectPagination = perKey((key) => (s) => s.threads.paginationByKey[key] || null);

export const selectThreadStatus = perKey((key) => (s) => s.threads.statusByKey[key] || "idle");

export const selectUnread = perKey((key) => (s) => s.threads.unreadByKey[key] || 0);

export const selectTyping = perKey((key) => (s) => s.threads.typingByKey[key] || null);

export const selectThread = perKey((key) => (s) => s.threads.threads[key] || null);

export const selectActiveKey = (s) => s.threads.activeKey;

/**
 * Messages still in flight or failed — drives the composer's outbox strip.
 *
 * createSelector because the result is derived: recomputed only when that
 * thread's message list actually changes, and the same array identity is
 * returned otherwise. Previously this allocated a new array per call and made
 * the composer re-render on every action in the app.
 */
export const selectPending = perKey((key) =>
  createSelector(
    (s) => s.threads.messagesByKey[key] || EMPTY,
    (list) => {
      const pending = list.filter((m) => m.status === "sending" || m.status === "failed");
      // Keep the frozen shared EMPTY when there is nothing pending — the common
      // case — so subscribers don't see a new [] each time.
      return pending.length ? pending : EMPTY;
    }
  )
);

/**
 * Total unread across every thread in a scope — drives the nav badge.
 *
 * Returns a number, so identity was never the issue, but it walked every thread
 * on every action. Memoised on the unread map so it recomputes only when an
 * unread count actually moves.
 */
const totalUnreadByScope = new Map();
export const selectTotalUnread = (scope) => {
  let selector = totalUnreadByScope.get(scope);
  if (!selector) {
    selector = createSelector(
      (s) => s.threads.unreadByKey,
      (unreadByKey) =>
        Object.entries(unreadByKey)
          .filter(([key]) => !scope || key.startsWith(`${scope}:`))
          .reduce((sum, [, n]) => sum + (n || 0), 0)
    );
    totalUnreadByScope.set(scope, selector);
  }
  return selector;
};

export default threadsSlice.reducer;
