// routes/messageRoutes.js
//
// Message operations that are not scoped to one thread's router: search,
// reading the context around a result, and deletion.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS ITS OWN ROUTER
// ─────────────────────────────────────────────────────────────────────────────
// Search is the one message read that is not scoped to a thread the caller
// named — "find what was said about this six months ago" usually means
// searching everything the person can see, chat and projects together. Hanging
// that off /api/chat would make the project half look like an afterthought,
// and hanging it off /api/projects/:id would make the cross-thread case
// impossible to express.
//
// Deletion lives here for the same reason — one implementation for both
// scopes, rather than the same endpoint written twice under /api/chat and
// /api/projects/:id with two chances to disagree about the rules.
//
// It also sidesteps a real trap: `GET /api/chat/messages/search` sits under
// the existing `GET /api/chat/messages/:conversationId`, and Express matches
// in registration order — so a search route added below it would be captured
// with conversationId === "search" and 404 as a missing conversation.
//
// Authorization lives entirely in the service, which resolves the searchable
// thread set from membership. Nothing here trusts a thread id from the query
// string beyond passing it through to be checked.
'use strict';

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
const { sendAccessError } = require("../services/messaging/access");
const messagingService = require("../services/messaging/messaging.service");

const SCOPES = ["chat", "project", "all"];

/**
 * GET /api/messages/search
 *
 *   ?q=invoice                     required, >= 2 chars
 *   &scope=chat|project|all        default "all"
 *   &threadId=<id>                 optional; narrows to one thread
 *   &senderId=<id>                 optional
 *   &startDate=&endDate=           optional ISO dates
 *   &page=1&limit=25               limit clamped to 50
 *
 * -> { results, total, query, pagination }
 *
 * Each result carries its own thread id and name, so one list can mix a chat
 * group and a project thread and still tell the user where each hit lives.
 */
router.get("/search", protect, async (req, res) => {
  try {
    const { q, scope = "all", threadId, senderId, startDate, endDate, page, limit } = req.query;

    if (!SCOPES.includes(scope)) {
      return res.status(400).json({ error: `scope must be one of ${SCOPES.join(", ")}`, code: "BAD_SCOPE" });
    }
    if (threadId && !mongoose.Types.ObjectId.isValid(String(threadId))) {
      return res.status(400).json({ error: "threadId is not a valid thread id", code: "INVALID_THREAD_ID" });
    }
    if (senderId && !mongoose.Types.ObjectId.isValid(String(senderId))) {
      return res.status(400).json({ error: "senderId is not a valid user id", code: "INVALID_SENDER_ID" });
    }

    const out = await messagingService.searchMessages(req.user, {
      scope,
      threadId: threadId || null,
      query: q,
      senderId: senderId || null,
      startDate: startDate || null,
      endDate: endDate || null,
      page,
      limit,
    });

    return res.json(out);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error searching messages:", unexpected);
      return res.status(500).json({ error: "Search failed" });
    }
  }
});

/**
 * GET /api/messages/:scope/:messageId/context?before=5&after=5
 *
 * The handful of messages either side of one message, so a search hit can be
 * read in context without dragging the thread everyone else is looking at back
 * six months. See chatThread.contextAround for why it is a standalone window
 * rather than a jump.
 */
router.get("/:scope/:messageId/context", protect, async (req, res) => {
  try {
    const { scope, messageId } = req.params;

    if (scope !== "chat" && scope !== "project") {
      return res.status(400).json({ error: 'scope must be "chat" or "project"', code: "BAD_SCOPE" });
    }
    if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
      return res.status(400).json({ error: "messageId is not a valid message id", code: "INVALID_MESSAGE_ID" });
    }

    const before = Math.min(20, Math.max(0, parseInt(req.query.before, 10) || 5));
    const after = Math.min(20, Math.max(0, parseInt(req.query.after, 10) || 5));

    const context = await messagingService.getMessageContext(req.user, scope, messageId, { before, after });
    return res.json(context);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error loading message context:", unexpected);
      return res.status(500).json({ error: "Could not load the surrounding messages" });
    }
  }
});

/**
 * DELETE /api/messages/:scope/:messageId?mode=me|everyone
 *
 *   mode=me        hide it from you. Any message you can see, no time limit.
 *   mode=everyone  retract it for everyone. Sender only, inside the window.
 *
 * The two are separate modes rather than separate endpoints because they are
 * the same user intent ("remove this") with different blast radius, and the
 * client picks between them in one dialog.
 */
router.delete("/:scope/:messageId", protect, async (req, res) => {
  try {
    const { scope, messageId } = req.params;
    const mode = req.query.mode || "me";

    if (scope !== "chat" && scope !== "project") {
      return res.status(400).json({ error: 'scope must be "chat" or "project"', code: "BAD_SCOPE" });
    }
    if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
      return res.status(400).json({ error: "messageId is not a valid message id", code: "INVALID_MESSAGE_ID" });
    }

    const result = await messagingService.deleteMessage(req.user, scope, messageId, mode);

    // The adapter reports refusals as data rather than throwing, so they can
    // carry a reason the UI can act on — the same shape editMessage uses.
    if (result?.error) {
      const MESSAGES = {
        NOT_FOUND: "That message no longer exists.",
        NOT_SENDER: "You can only delete your own messages for everyone.",
        WINDOW_EXPIRED: "It has been too long to delete this for everyone. You can still delete it for yourself.",
        ALREADY_DELETED: "That message has already been deleted.",
        NO_TIMESTAMP: "That message cannot be deleted.",
      };
      return res
        .status(result.status || 400)
        .json({ error: MESSAGES[result.error] || "Could not delete that message.", code: result.error });
    }

    return res.json({
      messageId: String(messageId),
      threadId: result.threadId,
      mode: result.mode,
      deletedAt: result.normalized?.deletedAt || null,
    });
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error deleting message:", unexpected);
      return res.status(500).json({ error: "Could not delete that message." });
    }
  }
});

module.exports = router;
