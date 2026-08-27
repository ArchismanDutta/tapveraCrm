// api/messagingApi.js
//
// One client-side API for both messaging surfaces, mirroring the server's
// services/messaging layer: callers pass a `scope` ('chat' | 'project') and a
// threadId, and never think about which URL shape or response envelope is
// involved.
//
// ─── WHY THIS EXISTS ───
// ChatPage, chatWindow and ProjectMessagePanel each called `fetch()` directly
// with a hand-built `Authorization: Bearer ${localStorage.getItem("token")}`
// header — 15 call sites, no shared error handling, no interceptors, and a
// second dead API module (src/api/api.js) pointing at endpoints that don't
// exist. Everything here goes through the configured axios instance in
// src/api.js, which already attaches the token and handles auth failures.
//
// The two scopes genuinely differ in URL shape and response envelope; those
// differences are absorbed here and nowhere else:
//
//            chat                                  project
//   list     GET  /api/chat/groups                 (n/a — opened from a project)
//   fetch    GET  /api/chat/messages/:id           GET  /api/projects/:id/messages
//            -> Message[]                          -> { messages, pagination }
//   send     POST /api/chat/messages               POST /api/projects/:id/messages
//            (threadId in the body)                (threadId in the path)
//   read     POST /api/chat/:id/mark-read          PATCH /api/projects/:id/messages/mark-read
//   unread   (comes back on the list response)     GET  /api/projects/:id/messages/unread-count
//   react    POST /api/chat/messages/:mid/react    POST /api/projects/:id/messages/:mid/react
import API from "../api";

export const SCOPES = { CHAT: "chat", PROJECT: "project" };

/** Stable client-side key for a thread, matching the Redux slice. */
export const threadKey = (scope, threadId) => `${scope}:${threadId}`;

/** Parse a key back into its parts. */
export const parseKey = (key) => {
  const idx = String(key).indexOf(":");
  return { scope: key.slice(0, idx), threadId: key.slice(idx + 1) };
};

/**
 * The shared axios instance pins `Content-Type: application/json` at the
 * instance level. For a multipart upload that header must be unset so the
 * browser can generate the multipart boundary — without this, attachments
 * upload as a malformed body the server can't parse.
 */
const MULTIPART = { headers: { "Content-Type": undefined } };

/**
 * Client-generated message id, minted BEFORE the request leaves the browser.
 *
 * This is the keystone for S1/S2: the server has a unique sparse index on it,
 * so a retry after a flaky network returns the ORIGINAL message rather than
 * creating a twin. Without it, "I pressed send once and it posted three times"
 * is a matter of when, not if.
 *
 * crypto.randomUUID isn't available on http:// origins or older Safari, hence
 * the fallback — a collision here would silently drop a message as a duplicate,
 * so the fallback still needs real entropy, not a timestamp alone.
 */
export const newClientMsgId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/* ── Reads ────────────────────────────────────────────────────────────── */

/** Conversations the current user belongs to. Chat only. */
export async function listThreads(scope = SCOPES.CHAT) {
  if (scope !== SCOPES.CHAT) return [];
  const { data } = await API.get("/api/chat/groups");
  return Array.isArray(data) ? data : [];
}

/**
 * Thread history.
 * @returns {{ messages: Array, pagination: object|null }} — normalized envelope
 *          regardless of which scope produced it.
 */
export async function fetchMessages(scope, threadId, params = {}) {
  if (scope === SCOPES.PROJECT) {
    const { data } = await API.get(`/api/projects/${threadId}/messages`, { params });
    return { messages: data?.messages || [], pagination: data?.pagination || null };
  }

  // Chat responds in one of two shapes, depending on whether pagination was
  // requested: a bare array (the historical, whole-thread response) or
  // { messages, pagination }. Both are handled so callers that don't paginate
  // keep working unchanged.
  const { data } = await API.get(`/api/chat/messages/${threadId}`, { params });

  if (Array.isArray(data)) return { messages: data, pagination: null };

  return {
    messages: Array.isArray(data?.messages) ? data.messages : [],
    pagination: data?.pagination || null,
  };
}

/**
 * A client-generated token identifying one forward ACTION.
 *
 * The server derives each copy's clientMsgId from it, so pressing Forward
 * again after a failure returns the copies that already landed instead of
 * writing a second set. Mint it once per attempt-and-its-retries — see
 * ForwardMessagesModal, which holds it in a ref until the modal closes.
 */
export const newForwardToken = () => newClientMsgId();

/**
 * How long a forward may take, in milliseconds.
 *
 * The shared instance is pinned at 30s, which is right for an ordinary
 * request. A forward is one request that fans out into up to 30 x 20 message
 * writes plus a notification batch per destination, and aborting it
 * client-side does not stop the server — it just means the user is told it
 * failed while it goes on succeeding, and then retries. So this one call gets
 * a longer leash, and idempotency (above) covers the retry when it doesn't.
 */
const FORWARD_TIMEOUT_MS = 120000;

/**
 * Forward messages into other conversations.
 *
 * ─── THE SOURCE HAS A SCOPE; THE DESTINATION DOES NOT ───
 * Messages can be taken from a chat conversation OR a project thread, but they
 * always LAND in a chat conversation — that is the server's
 * FORWARD_DESTINATIONS policy, and the reason this posts to the chat router
 * whichever surface called it. `destinationThreadIds` are therefore always
 * conversation ids.
 *
 * A project message may only go to a GROUP; the server refuses a DM
 * destination (chatThread.forwardDestinationGate) and the picker doesn't offer
 * one. Chat -> chat is unrestricted.
 *
 * Returns { delivered, failed } — partial success is normal, since a
 * destination the user can no longer write to is skipped rather than failing
 * the whole call.
 *
 * @param {'chat'|'project'} sourceScope
 * @param {string} [forwardToken] see newForwardToken
 */
export async function forwardMessages(
  sourceScope,
  sourceThreadId,
  messageIds,
  destinationThreadIds,
  forwardToken = null
) {
  if (sourceScope !== SCOPES.CHAT && sourceScope !== SCOPES.PROJECT) {
    throw new Error(`Cannot forward from "${sourceScope}"`);
  }

  // A message still in the outbox has no server id, and there is nothing to
  // forward it BY. The UI already hides the action for those rows; this is the
  // backstop, because sending one produced an opaque 500 rather than anything
  // the user could act on.
  const ids = (messageIds || []).map(String).filter(Boolean);
  if (ids.length === 0) {
    throw new Error("Those messages haven't finished sending yet.");
  }

  try {
    const { data } = await API.post(
      `/api/chat/messages/forward`,
      {
        sourceScope,
        sourceThreadId,
        messageIds: ids,
        destinationConversationIds: destinationThreadIds,
        forwardToken,
      },
      { timeout: FORWARD_TIMEOUT_MS }
    );
    return { delivered: data?.delivered || [], failed: data?.failed || [] };
  } catch (err) {
    // Surface what the server actually said. Without this the modal renders
    // axios's own wording — "Request failed with status code 400" — for a
    // response whose body explains the problem in plain language.
    const serverMessage = err?.response?.data?.error;
    if (serverMessage) throw new Error(serverMessage);

    if (err?.code === "ECONNABORTED") {
      throw new Error(
        "This is taking longer than expected. The messages may still arrive — check the conversation before trying again."
      );
    }
    if (!err?.response) {
      throw new Error("Couldn't reach the server. Check your connection and try again.");
    }
    throw err;
  }
}

/** Unread count for a single thread. */
export async function fetchUnreadCount(scope, threadId) {
  if (scope !== SCOPES.PROJECT) return null; // chat unread rides on listThreads
  const { data } = await API.get(`/api/projects/${threadId}/messages/unread-count`);
  return data?.unreadCount || 0;
}

/* ── Writes ───────────────────────────────────────────────────────────── */

/**
 * Send a message.
 *
 * @param {object} payload
 * @param {string} payload.body
 * @param {Array}  [payload.files]    File objects -> sent as multipart
 * @param {string} [payload.replyTo]
 * @param {Array}  [payload.mentions]
 * @param {string} [payload.senderType]  project only
 */
export async function sendMessage(scope, threadId, payload = {}) {
  const {
    body = "",
    files = [],
    replyTo = null,
    mentions = [],
    senderType,
    clientMsgId = newClientMsgId(),
  } = payload;
  const hasFiles = files && files.length > 0;

  if (scope === SCOPES.PROJECT) {
    if (hasFiles) {
      const form = new FormData();
      form.append("message", body);
      if (replyTo) form.append("replyTo", replyTo);
      if (mentions.length) form.append("mentions", JSON.stringify(mentions));
      if (senderType) form.append("senderType", senderType);
      form.append("clientMsgId", clientMsgId);
      files.forEach((f) => form.append("files", f));
      const { data } = await API.post(`/api/projects/${threadId}/messages`, form, MULTIPART);
      return data;
    }
    const { data } = await API.post(`/api/projects/${threadId}/messages`, {
      message: body,
      replyTo,
      mentions,
      senderType,
      clientMsgId,
    });
    return data;
  }

  // Chat carries the thread id in the body, not the path.
  if (hasFiles) {
    const form = new FormData();
    form.append("conversationId", threadId);
    form.append("message", body);
    if (replyTo) form.append("replyTo", replyTo);
    if (mentions.length) form.append("mentions", JSON.stringify(mentions));
    form.append("clientMsgId", clientMsgId);
    files.forEach((f) => form.append("files", f));
    const { data } = await API.post("/api/chat/messages", form, MULTIPART);
    return data;
  }

  const { data } = await API.post("/api/chat/messages", {
    conversationId: threadId,
    message: body,
    replyTo,
    mentions,
    clientMsgId,
  });
  return data;
}

/**
 * How long a sent message stays editable, in milliseconds.
 *
 * Mirrors CHAT_EDIT_WINDOW_MINUTES on the server. The server is the authority
 * and re-checks on every request — this copy exists only so the UI can stop
 * offering an edit it knows will be refused, which is kinder than a button
 * that fails.
 */
export const EDIT_WINDOW_MS = 7 * 60 * 1000;

/** Can the current user still edit this message? Presentation only. */
export function canEditMessage(message, currentUserId, now = Date.now()) {
  if (!message || !currentUserId) return false;
  // An optimistic row has no server id yet — there is nothing to PATCH until
  // the send lands.
  if (!(message.id || message._id)) return false;
  if (message.status === "sending" || message.status === "failed") return false;

  const senderId = String(
    message.sender?.id ?? message.senderId ?? message.sentBy?._id ?? message.sentBy ?? ""
  );
  if (senderId !== String(currentUserId)) return false;

  const sentAt = new Date(message.createdAt ?? message.timestamp ?? 0).getTime();
  if (!Number.isFinite(sentAt) || sentAt === 0) return false;

  return now - sentAt <= EDIT_WINDOW_MS;
}

/** Edit a message's text. Chat scope only — project threads have no edit path. */
export async function editMessage(scope, messageId, message) {
  if (scope === SCOPES.PROJECT) {
    throw new Error("Editing is not supported for project messages");
  }
  const { data } = await API.patch(`/api/chat/messages/${messageId}`, { message });
  return data;
}

/** Mark every message in the thread read for the current user. */
export async function markRead(scope, threadId) {
  if (scope === SCOPES.PROJECT) {
    const { data } = await API.patch(`/api/projects/${threadId}/messages/mark-read`);
    return data?.count || 0;
  }
  const { data } = await API.post(`/api/chat/${threadId}/mark-read`);
  return data?.count || 0;
}

/**
 * Mark a SINGLE message read. Project only — used by the viewport-visibility
 * read receipt. Chat advances a whole-thread cursor instead (`markRead`).
 */
export async function markMessageRead(scope, threadId, messageId) {
  if (scope !== SCOPES.PROJECT) return null;
  const { data } = await API.post(`/api/projects/${threadId}/messages/${messageId}/read`);
  return data;
}

/**
 * Download a message attachment and save it.
 *
 * The object URL is revoked on a later tick, not immediately after `click()`.
 * Revoking synchronously can invalidate the blob before the browser has begun
 * the download, which silently produces a zero-byte or missing file on some
 * browsers.
 */
export async function downloadAttachment(scope, threadId, messageId, attachmentId, filename) {
  const base =
    scope === SCOPES.PROJECT
      ? `/api/projects/${threadId}/messages/${messageId}/attachments/${attachmentId}/download`
      : null;
  if (!base) throw new Error("Attachment download is only supported for project threads");

  const { data } = await API.get(base, { responseType: "blob" });

  const url = window.URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

/** AI thread summary. Chat only — the project surface has its own endpoint. */
export async function summarize(scope, threadId, days = 7) {
  const url =
    scope === SCOPES.PROJECT
      ? `/api/projects/${threadId}/messages/summarize`
      : `/api/chat/conversations/${threadId}/summarize`;
  const { data } = await API.post(url, { days });
  return data?.summary || "";
}

/**
 * Colleagues you can direct-message — the whole active roster, not just
 * people you have already spoken to.
 *
 * Each entry carries `conversationId` when a thread already exists, and null
 * when it doesn't. Null is not an error state: it means "not spoken yet", and
 * `openDirectMessage` below creates the thread on demand.
 */
export async function listDirectory() {
  const { data } = await API.get("/api/chat/directory");
  return Array.isArray(data) ? data : [];
}

/**
 * Get (or lazily create) the one-to-one conversation with another user.
 * Idempotent server-side, so calling it for an existing DM returns that same
 * thread rather than a second one.
 */
export async function openDirectMessage(otherUserId) {
  const { data } = await API.post("/api/chat/private-conversation", { otherUserId });
  return data;
}

/** Create a group conversation. */
export async function createGroup(name, memberIds) {
  const { data } = await API.post("/api/chat/groups", { name, memberIds });
  return data;
}

/** Delete a conversation and its messages. */
export async function deleteConversation(conversationId) {
  const { data } = await API.delete(`/api/chat/conversations/${conversationId}`);
  return data;
}

/* ── Project-only message actions ─────────────────────────────────────── */
// These have no chat equivalent, so they take a projectId directly rather than
// pretending to be scope-generic.

/** Toggle a personal star (bookmark) on a message. */
export async function toggleStar(projectId, messageId) {
  const { data } = await API.post(`/api/projects/${projectId}/messages/${messageId}/star`);
  return data;
}

/** Messages the current user has starred in this project. */
export async function listStarred(projectId) {
  const { data } = await API.get(`/api/projects/${projectId}/messages/starred`);
  return Array.isArray(data) ? data : [];
}

/** Messages pinned in this project (admin-pinned, max 5 server-side). */
export async function listPinned(projectId) {
  const { data } = await API.get(`/api/projects/${projectId}/messages/pinned`);
  return Array.isArray(data) ? data : [];
}

/** Mark an attachment important so media cleanup won't reap it. */
export async function toggleAttachmentImportant(projectId, messageId, attachmentId) {
  const { data } = await API.patch(
    `/api/projects/${projectId}/messages/${messageId}/attachments/${attachmentId}/toggle-important`
  );
  return data;
}

/** Toggle a reaction. Returns the updated message. */
export async function react(scope, threadId, messageId, emoji) {
  if (scope === SCOPES.PROJECT) {
    const { data } = await API.post(`/api/projects/${threadId}/messages/${messageId}/react`, { emoji });
    return data;
  }
  const { data } = await API.post(`/api/chat/messages/${messageId}/react`, { emoji });
  return data;
}

export default {
  SCOPES,
  newClientMsgId,
  threadKey,
  parseKey,
  listThreads,
  fetchMessages,
  forwardMessages,
  newForwardToken,
  fetchUnreadCount,
  sendMessage,
  markRead,
  markMessageRead,
  downloadAttachment,
  toggleStar,
  listStarred,
  listPinned,
  toggleAttachmentImportant,
  react,
  summarize,
  createGroup,
  deleteConversation,
  listDirectory,
  openDirectMessage,
  editMessage,
  canEditMessage,
  EDIT_WINDOW_MS,
};
