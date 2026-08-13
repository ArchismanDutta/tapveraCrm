const express = require("express");
const router = express.Router();
const fetch = require("node-fetch"); // Polyfill for Node.js < 18
const chatController = require("../controllers/chatController");
const { protect } = require("../middlewares/authMiddleware");
const { uploadToS3, getFileType, convertToCloudFrontUrl } = require("../config/s3Config");
// broadcastMessageToConversation is gone from this router — message delivery is
// the service layer's job now (services/messaging/realtime.js). Group
// membership changes still broadcast from here until group management moves
// behind the service too.
const { broadcastConversationUpdated } = require("../utils/websocket");
// Every conversation-scoped route below authorizes through this one module.
// Before it existed, `protect` (are you logged in) was the ONLY check on this
// router — any authenticated user could read, post into, summarize or delete
// any conversation by id. See services/messaging/access.js.
const { assertChatAccess, sendAccessError } = require("../services/messaging/access");
// Phase 1: thread reads/writes go through the service layer, which authorizes,
// persists, notifies and broadcasts in one place — so this router and the
// Socket.IO handler can no longer drift apart. Responses still send the raw
// document shape the live client expects; `normalized` rides the new
// `thread:*` events until the client migrates.
const messagingService = require("../services/messaging/messaging.service");
// Room eviction on membership changes — see evictFromThread / closeThreadRoom.
const realtime = require("../services/messaging/realtime");
const { CHAT } = messagingService.SCOPES;

// router.use(authMiddleware);

// Create a new group conversation (admin or super-admin)
router.post("/groups", protect, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const createdBy = req.user._id;
    const newGroup = await chatController.createGroupConversation(name, memberIds, createdBy);
    try {
      broadcastConversationUpdated(newGroup.members, { action: "created", conversationId: newGroup._id });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (group created):", wsError.message);
    }
    res.status(201).json(newGroup);
  } catch (error) {
    res.status(500).json({ error: "Failed to create group conversation" });
  }
});

// Get all group conversations for the logged-in user
router.get("/groups", protect, async (req, res) => {
  try {
    const { raw } = await messagingService.listThreads(req.user, CHAT);
    res.json(raw);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// Get messages by conversation ID (one-to-one or group)
router.get("/messages/:conversationId", protect, async (req, res) => {
  try {
    // Forward pagination when the client asks for it. Without page/limit the
    // adapter returns the whole thread, which is what every caller predating
    // pagination expects — so this stays backward compatible.
    const { page, limit } = req.query;
    const { raw, pagination } = await messagingService.getMessages(
      req.user,
      CHAT,
      req.params.conversationId,
      { page, limit }
    );

    // Shape depends on the request: a paginated caller needs `hasMore` to know
    // whether to keep loading, while an unpaginated one still receives the bare
    // array it has always received.
    return pagination ? res.json({ messages: raw, pagination }) : res.json(raw);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error fetching messages:", unexpected);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  }
});

// Send a message to a conversation (with optional file attachments)
router.post("/messages", protect, uploadToS3.array("files", 5), async (req, res) => {
  try {
    const { conversationId, message, replyTo, mentions, clientMsgId } = req.body;

    // Parse mentions if sent as JSON string (from FormData)
    let mentionedUserIds = [];
    if (mentions) {
      try {
        mentionedUserIds = typeof mentions === 'string' ? JSON.parse(mentions) : mentions;
      } catch (e) {
        console.warn('Failed to parse mentions:', e);
      }
    }

    // Process file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // `storedPath` — files are sharded under UPLOAD_ROOT, so the bare
        // `filename` leaf no longer locates them and produced a URL that 404'd
        // on download. `location` is the S3 branch and is unaffected.
        const fileUrl = file.location || `/uploads/${file.storedPath}`;
        const cloudFrontUrl = convertToCloudFrontUrl(fileUrl);

        attachments.push({
          filename: file.originalname,
          url: cloudFrontUrl,
          size: file.size,
          mimeType: file.mimetype,
          fileType: getFileType(file.mimetype),
          uploadedAt: new Date(),
        });
      }
    }

    // Authorization, persistence, notification fan-out and the real-time
    // broadcast all happen inside the service — identical to what the
    // Socket.IO `chat:message` path now does, because it is literally the
    // same call.
    const { raw } = await messagingService.sendMessage(req.user, CHAT, conversationId, {
      body: message,
      attachments,
      replyTo: replyTo || null,
      mentions: mentionedUserIds,
      clientMsgId: clientMsgId || null,
    });

    res.status(201).json(raw);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error sending message:", unexpected);
      return res.status(500).json({ error: "Failed to send message" });
    }
  }
});

// Mark all messages in a conversation as read by the current user.
// The client (ChatPage.jsx) has been calling this exact URL for a while;
// it previously 404'd because this route didn't exist yet.
router.post("/:conversationId/mark-read", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { count } = await messagingService.markRead(req.user, CHAT, conversationId);
    res.json({ message: "Messages marked as read", count });
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error marking conversation as read:", unexpected);
      return res.status(500).json({ error: "Failed to mark messages as read" });
    }
  }
});

// Colleagues available to direct-message. Powers the DM tab's roster — see
// chatController.listDirectory for why it returns everyone rather than only
// people you have already spoken to.
router.get("/directory", protect, async (req, res) => {
  try {
    res.json(await chatController.listDirectory(req.user._id));
  } catch (error) {
    console.error("Error listing chat directory:", error);
    res.status(500).json({ error: "Failed to load directory" });
  }
});

// Get or create private conversation between two users
router.post("/private-conversation", protect, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    if (!otherUserId) {
      return res.status(400).json({ error: "otherUserId is required" });
    }

    const conversation = await chatController.getOrCreatePrivateConversation(
      req.user._id,
      otherUserId
    );
    res.json(conversation);
  } catch (error) {
    // The controller distinguishes "you can't DM yourself" and "that account
    // is gone" from a genuine fault. Collapsing those into 500 told the user
    // the server broke when in fact their request was simply not valid.
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error creating private conversation:", error);
    res.status(500).json({ error: "Failed to get or create private conversation" });
  }
});

// Delete a conversation and its messages
router.delete("/conversations/:id", protect, async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Deleting drops every message for every member, so this is the most
    // destructive route on the router — and until now it had no check at all.
    // Private: either participant may delete. Group: creator or an admin.
    const { conversation: existing } = await assertChatAccess(
      req.user,
      conversationId,
      "delete"
    );

    // Members are read BEFORE deleting — afterwards there is no document left
    // to work out who needs telling.
    const memberIds = existing?.members || [];

    const deletedConversation = await chatController.deleteConversation(
      conversationId
    );

    if (!deletedConversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Every other member is still showing this conversation in their list, and
    // clicking it now 404s. Creation, rename and membership changes all
    // broadcast; deletion was the one that didn't, so a deleted group lingered
    // for everyone else until they happened to reload.
    try {
      broadcastConversationUpdated(memberIds, {
        action: "deleted",
        conversationId,
      });

      // Nobody should keep receiving anything for a conversation that no longer
      // exists, so empty the room rather than evicting member by member.
      realtime.closeThreadRoom(realtime.SCOPES.CHAT, conversationId);
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (conversation deleted):", wsError.message);
    }

    res.json({ message: "Conversation and its messages deleted successfully" });
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Delete conversation error:", unexpected);
      return res.status(500).json({ error: "Failed to delete conversation" });
    }
  }
});

// Summarize conversation messages
router.post("/conversations/:conversationId/summarize", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { days = 7 } = req.body; // Default to last 7 days

    // This route ships the thread's message history to a third-party AI
    // service (OpenRouter). Without a membership check it was an exfiltration
    // path: any authenticated user could summarize any conversation.
    await assertChatAccess(req.user, conversationId, "read");

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const ChatMessage = require("../models/ChatMessage");

    // Fetch messages from the last N days
    const messages = await ChatMessage.find({
      conversationId,
      timestamp: { $gte: startDate }
    })
    .sort({ timestamp: 1 })
    .populate("senderId", "firstName lastName email")
    .lean();

    if (!messages || messages.length === 0) {
      return res.json({ summary: "No messages found in the selected time period." });
    }

    // Format messages for AI
    const formattedMessages = messages.map(msg => {
      const sender = msg.senderId ? `${msg.senderId.firstName} ${msg.senderId.lastName}` : "Unknown";
      const timestamp = new Date(msg.timestamp).toLocaleDateString();
      const hasAttachments = msg.attachments && msg.attachments.length > 0 ? ` [${msg.attachments.length} attachment(s)]` : "";
      return `[${timestamp}] ${sender}: ${msg.message}${hasAttachments}`;
    }).join("\n");

    // Call OpenRouter API with Gemma model
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemma-2-9b-it:free",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that summarizes conversations. Provide a clear, concise summary highlighting key topics discussed, decisions made, action items, and important context. Keep it professional and organized."
          },
          {
            role: "user",
            content: `Please summarize the following conversation from the last ${days} days:\n\n${formattedMessages}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      return res.status(500).json({
        error: "Failed to generate summary from AI service",
        details: errorText,
        status: response.status
      });
    }

    const data = await response.json();
    let summary = data.choices?.[0]?.message?.content || "Unable to generate summary.";

    // Remove <think> tags and their content (AI reasoning artifacts)
    summary = summary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    res.json({
      summary,
      messageCount: messages.length,
      dateRange: {
        from: startDate.toISOString(),
        to: new Date().toISOString()
      }
    });

  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error summarizing conversation:", unexpected);
      return res.status(500).json({ error: "Failed to summarize conversation" });
    }
  }
});

// Get group details with members
router.get("/groups/:conversationId/details", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    // Group details expose the full member roster — members only.
    await assertChatAccess(req.user, conversationId, "read");
    const groupDetails = await chatController.getGroupDetails(conversationId);
    res.json(groupDetails);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error fetching group details:", unexpected);
      return res.status(500).json({ error: unexpected.message || "Failed to fetch group details" });
    }
  }
});

// Add members to a group
router.post("/groups/:conversationId/members", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { memberIds } = req.body;
    const requestingUserId = req.user._id;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: "memberIds array is required" });
    }

    const updatedGroup = await chatController.addMembersToGroup(
      conversationId,
      memberIds,
      requestingUserId
    );

    try {
      broadcastConversationUpdated(updatedGroup.members, { action: "members_added", conversationId });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (members added):", wsError.message);
    }

    res.json({
      message: "Members added successfully",
      group: updatedGroup
    });
  } catch (error) {
    console.error("Error adding members:", error);
    res.status(403).json({ error: error.message || "Failed to add members" });
  }
});

/**
 * Forward messages into other conversations.
 *
 * POST /api/chat/messages/forward
 *   { sourceConversationId, messageIds: [], destinationConversationIds: [] }
 *
 * Partial success is a normal outcome, not an error: destinations the user can
 * no longer write to are reported in `failed` while the rest are delivered. A
 * 403 for the whole request would throw away work that succeeded.
 */
router.post("/messages/forward", protect, async (req, res) => {
  try {
    const { sourceConversationId, messageIds, destinationConversationIds } = req.body;

    if (!sourceConversationId) {
      return res.status(400).json({ error: "sourceConversationId is required" });
    }
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: "messageIds must be a non-empty array" });
    }
    if (!Array.isArray(destinationConversationIds) || destinationConversationIds.length === 0) {
      return res.status(400).json({ error: "destinationConversationIds must be a non-empty array" });
    }

    // Bounded so one request can't fan out into thousands of writes.
    if (messageIds.length > 30) {
      return res.status(400).json({ error: "Cannot forward more than 30 messages at once" });
    }
    if (destinationConversationIds.length > 20) {
      return res.status(400).json({ error: "Cannot forward to more than 20 conversations at once" });
    }

    const result = await messagingService.forwardMessages(
      req.user,
      CHAT,
      sourceConversationId,
      messageIds,
      destinationConversationIds
    );

    return res.json(result);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error forwarding messages:", unexpected);
      return res.status(500).json({ error: "Failed to forward messages" });
    }
  }
});

// Remove a member from a group
router.delete("/groups/:conversationId/members/:memberId", protect, async (req, res) => {
  try {
    const { conversationId, memberId } = req.params;
    const requestingUserId = req.user._id;

    const updatedGroup = await chatController.removeMemberFromGroup(
      conversationId,
      memberId,
      requestingUserId
    );

    try {
      // Include the removed member — they're no longer in updatedGroup.members
      // but still need the "conversation:updated" event so the group
      // disappears from their own sidebar list.
      // `memberId` is in the payload so the removed member's client can tell
      // this event is about THEM. Every remaining member gets the same event
      // (their member list changed), and without it the recipient has no way to
      // distinguish "someone left" from "you were removed" — so the person who
      // needs to drop the conversation immediately can't, and has to wait for a
      // refetch to notice it's gone.
      broadcastConversationUpdated([...updatedGroup.members, memberId], {
        action: "member_removed",
        conversationId,
        memberId: String(memberId),
      });

      // Kick their socket out of the room.
      //
      // The broadcast above only tells their CLIENT to drop the group from the
      // sidebar. Their socket stays joined to conversation:<id>, so until they
      // happen to reconnect, every message the group sends is still delivered
      // to them. It never renders, which is exactly what makes it dangerous —
      // the leak is invisible to everyone, including them.
      realtime.evictFromThread(realtime.SCOPES.CHAT, conversationId, [memberId]);
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (member removed):", wsError.message);
    }

    res.json({
      message: "Member removed successfully",
      group: updatedGroup
    });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(403).json({ error: error.message || "Failed to remove member" });
  }
});

// Update group details (name, etc.)
router.put("/groups/:conversationId", protect, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const updates = req.body;
    const requestingUserId = req.user._id;

    const updatedGroup = await chatController.updateGroupDetails(
      conversationId,
      updates,
      requestingUserId
    );

    try {
      broadcastConversationUpdated(updatedGroup.members, { action: "updated", conversationId });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (group updated):", wsError.message);
    }

    res.json({
      message: "Group updated successfully",
      group: updatedGroup
    });
  } catch (error) {
    console.error("Error updating group:", error);
    res.status(403).json({ error: error.message || "Failed to update group" });
  }
});

// Edit a message's text, within the sender's edit window.
//
// The rules (you sent it, and it is still recent) live in the adapter and are
// re-checked here on every call — never trusted from the client, which cannot
// be relied on to have hidden the button.
router.patch("/messages/:messageId", protect, async (req, res) => {
  try {
    const result = await messagingService.editMessage(
      req.user,
      CHAT,
      req.params.messageId,
      req.body?.message
    );

    if (result?.error) {
      // Distinct, honest messages per reason. A single generic 403 would
      // leave someone staring at an edit that failed with no idea whether to
      // retry, and "the window closed" is genuinely actionable information.
      const messages = {
        NOT_FOUND: "Message not found",
        NOT_SENDER: "You can only edit your own messages",
        WINDOW_EXPIRED: "This message can no longer be edited",
        EMPTY: "An edited message cannot be empty",
        NO_TIMESTAMP: "This message cannot be edited",
      };
      return res
        .status(result.status || 400)
        .json({ error: messages[result.error] || "Unable to edit message", code: result.error });
    }

    res.json(result.raw);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error editing message:", unexpected);
      return res.status(500).json({ error: "Failed to edit message" });
    }
  }
});

// Add or remove reaction to a chat message
router.post("/messages/:messageId/react", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    // The service resolves the message's own conversation, authorizes against
    // it (reacting must not become a way to confirm an arbitrary message id
    // exists), toggles, and broadcasts.
    const result = await messagingService.react(req.user, CHAT, messageId, emoji);

    if (!result) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(result.raw);
  } catch (error) {
    try {
      return sendAccessError(res, error);
    } catch (unexpected) {
      console.error("Error adding reaction:", unexpected);
      return res.status(500).json({ error: "Failed to add reaction" });
    }
  }
});

module.exports = router;
