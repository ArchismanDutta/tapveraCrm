// utils/sendMessage.js
//
// The one way a message gets sent (S2).
//
// Every send follows the same three steps, in this order:
//   1. QUEUE   — persist to IndexedDB, so the message survives a crash, a
//                reload, or the user closing the tab mid-send.
//   2. RENDER  — put it on screen immediately as `sending`. The bubble exists
//                from keystroke zero; the composer clears straight away.
//   3. DRAIN   — attempt delivery. Success removes it from the queue; the
//                server's echo merges onto the same row by clientMsgId.
//
// Queue-before-render matters. Rendering first and queuing after leaves a
// window where the UI shows a message that isn't durable anywhere — close the
// tab in that window and it's gone with no trace.
import * as outbox from "./outbox";
import { drainOutbox } from "./outboxDrain";
import { newClientMsgId } from "../api/messagingApi";
import { enqueueOptimistic } from "../store/slices/threadsSlice";
import store from "../store";

/**
 * Queue, render, and attempt a send.
 *
 * @param {object} args
 * @param {string} args.scope
 * @param {string} args.threadId
 * @param {string} args.body
 * @param {File[]} [args.files]
 * @param {string} [args.replyTo]
 * @param {Array}  [args.mentions]
 * @param {string} [args.senderType]
 * @param {object} args.sender      { id, name } for the optimistic bubble
 * @returns {Promise<string>} the clientMsgId
 */
export async function queueAndSend({
  scope,
  threadId,
  body = "",
  files = [],
  replyTo = null,
  mentions = [],
  senderType,
  sender,
}) {
  const clientMsgId = newClientMsgId();

  const entry = {
    clientMsgId,
    scope,
    threadId: String(threadId),
    body,
    files,
    replyTo,
    mentions,
    senderType,
  };

  // 1. Durable first.
  try {
    await outbox.enqueue(entry);
  } catch (err) {
    // Private browsing can refuse IndexedDB outright. Rather than blocking the
    // send, fall through without persistence — the message still goes out, it
    // just won't survive a reload if it fails.
    console.warn("[outbox] not available, sending without persistence:", err.message);
  }

  // 2. On screen immediately.
  store.dispatch(
    enqueueOptimistic({
      scope,
      threadId,
      message: {
        clientMsgId,
        // No server id yet — the row is keyed on clientMsgId until the echo
        // arrives, which is exactly what upsertMessage merges on.
        id: null,
        sender: sender || null,
        body,
        // Enough for the bubble to render an attachment placeholder before
        // anything has uploaded.
        attachments: (files || []).map((f) => ({
          filename: f.name,
          size: f.size,
          mimeType: f.type,
          fileType: f.type?.startsWith("image/")
            ? "image"
            : f.type?.startsWith("video/")
            ? "video"
            : "other",
          _pending: true,
        })),
        replyTo,
        readBy: [],
        deliveredTo: [],
        status: "sending",
        createdAt: new Date().toISOString(),
      },
    })
  );

  // 3. Attempt now. Not awaited by the caller — the composer should clear the
  // instant the message is on screen, not when the network agrees.
  drainOutbox();

  return clientMsgId;
}

export default { queueAndSend };
