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
};
