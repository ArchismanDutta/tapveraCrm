// controllers/chatController.js

const ChatMessage = require("../models/ChatMessage");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const dailyChatNotificationService = require("../services/dailyChatNotificationService");

// Parse @mentions from message text and return user IDs
// Mention token that targets every member of the conversation.
const EVERYONE_TOKEN = "everyone";

// A mention ends at end-of-string or at a character that can't be part of a
// name, so "@Anish, thoughts?" resolves. It must start at the beginning or
// after whitespace, so "ops@Anish.com" is an email address, not a mention.
const isNameChar = (ch) => ch !== undefined && /[\w']/.test(ch);
const isBoundaryBefore = (ch) => ch === undefined || /\s/.test(ch);

/**
 * Which of `candidates` are mentioned in `text`. Mirror of
 * client/src/utils/mentions.js findMentions — keep the two in step.
 *
 * ─── WHY THIS ISN'T A REGEX ───
 * It used to be: /@(\w+(?:\s+\w+)*)/g. It has to allow spaces, because people
 * have surnames ("@Sahil Kumar"), and once it does, nothing tells it where the
 * name ends. "@Anish please review this" captured the name as
 * "Anish please review this", matched no user, and the mention was silently
 * dropped — so mentions only worked when they were the last thing in the
 * message, which is almost never.
 *
 * No regex fixes that alone: "Sahil Kumar" is two words of a name and "please
 * review" is two words that aren't, and the text can't tell you which is which.
 * You need the candidate list, matched longest-first with matched spans masked
 * off so a member called "Sahil" can't also match inside "@Sahil Kumar".
 */
const findMentionedCandidates = (text, candidates) => {
  if (!text || !text.includes("@") || !candidates?.length) return [];

  const lower = text.toLowerCase();
  const claimed = new Array(text.length).fill(false);
  const byLongestName = [...candidates]
    .filter((c) => c?.name)
    .sort((a, b) => b.name.length - a.name.length);

  const hits = [];

  for (const candidate of byLongestName) {
    const needle = `@${candidate.name.toLowerCase()}`;
    let from = 0;

    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      from = idx + 1;

      const end = idx + needle.length;
      if (isNameChar(lower[end])) continue;
      if (!isBoundaryBefore(lower[idx - 1])) continue;

      let overlaps = false;
      for (let i = idx; i < end; i += 1) {
        if (claimed[i]) { overlaps = true; break; }
      }
      if (overlaps) continue;

      for (let i = idx; i < end; i += 1) claimed[i] = true;
      hits.push({ candidate, at: idx });
      break; // one hit per person — mentioning twice isn't two pings
    }
  }

  return hits.sort((a, b) => a.at - b.at).map((h) => h.candidate);
};

/**
 * Resolve @mentions in a message to user ids.
 *
 * Candidates are scoped to the conversation's own members: mentioning someone
 * who isn't in the group should do nothing, and a global User lookup would
 * happily notify a stranger who merely shares a first name.
 *
 * @everyone expands to every member except the author.
 */
const parseMentions = async (messageText, conversation, authorId) => {
  if (!messageText || !messageText.includes("@") || !conversation) return [];

  const memberIds = (conversation.members || []).map(String);
  const others = memberIds.filter((id) => id !== String(authorId));

  const users = await User.find({ _id: { $in: memberIds } }, "_id name").lean();

  const candidates = [
    { _id: EVERYONE_TOKEN, name: EVERYONE_TOKEN, isEveryone: true },
    ...users.filter((u) => String(u._id) !== String(authorId)),
  ];

  const matched = findMentionedCandidates(messageText, candidates);

  const ids = new Set();
  for (const m of matched) {
    if (m.isEveryone) others.forEach((id) => ids.add(id));
    else ids.add(String(m._id));
  }

  return [...ids];
};

// Save a message (supports one-to-one and group messages)
exports.saveMessage = async (conversationId, senderId, message, attachments = [], replyTo = null, mentions = []) => {
  // Loaded up front because mention resolution needs the member list — the
  // candidates for "@..." are this conversation's members and nobody else.
  // It's reused for the notification block further down rather than fetched
  // twice.
  const conversation = await Conversation.findById(conversationId);

  // The client sends the list it built from the composer's dropdown; that's
  // authoritative when present. Parsing the text is the fallback for clients
  // that don't (the socket path sends no mentions field) and for text typed
  // without using the picker.
  let mentionedUserIds = mentions;
  if ((!mentions || mentions.length === 0) && message) {
    mentionedUserIds = await parseMentions(message, conversation, senderId);
  }

  const chatMessage = new ChatMessage({
    conversationId,
    senderId,
    message: message || "",
    attachments,
    replyTo,
    readBy: [senderId], // Mark sender as having read
    mentions: mentionedUserIds,
  });

  const savedMessage = await chatMessage.save();

  // Send daily chat initiation email notifications (one per day per user)
  // This runs in the background and won't block message saving
  dailyChatNotificationService.processNewMessage(
    savedMessage,
    conversationId,
    senderId
  ).catch(err => {
    console.error('Failed to process daily chat notifications:', err);
  });

  // Send notifications to all conversation members
  const notificationService = require('../services/notificationService');
  const sender = await User.findById(senderId, 'name');

  if (conversation) {
    // Get conversation name/title for notification
    let conversationTitle = conversation.name;
    if (conversation.type === 'private') {
      // For private chats, show the other user's name
      const otherMemberId = conversation.members.find(m => String(m) !== String(senderId));
      if (otherMemberId) {
        const otherUser = await User.findById(otherMemberId, 'name');
        conversationTitle = otherUser?.name || 'Private Chat';
      }
    }

    // Safe preview — message is null for file-only sends
    const msgPreview = message
      ? (message.length > 100 ? message.slice(0, 100) + '...' : message)
      : '📎 Attachment';

    // Notify all members except the sender
    for (const memberId of conversation.members) {
      if (String(memberId) !== String(senderId)) {
        // Check if user was mentioned for priority
        const wasMentioned = mentionedUserIds.some(uid => String(uid) === String(memberId));
        const priority = wasMentioned ? 'high' : 'normal';

        try {
          await notificationService.createAndSend({
            userId: memberId,
            type: 'chat',
            channel: 'chat',   // must match client channel check in WebSocketContext
            title: wasMentioned
              ? `${sender?.name || 'Someone'} mentioned you in ${conversationTitle}`
              : `New message from ${sender?.name || 'Someone'} in ${conversationTitle}`,
            body: msgPreview,
            relatedData: {
              conversationId: conversationId,
            },
            priority: priority
          });
        } catch (notifError) {
          console.error('Failed to send chat notification:', notifError);
        }
      }
    }
  }

  return savedMessage;
};


exports.getConversationById = async (conversationId) => {
  return await Conversation.findById(conversationId);
};

// Mark every message in a conversation as read by this user (excluding their
// own messages, and skipping ones already marked). ChatMessage.readBy is a
// flat array of user-id strings (unlike Project Message's {user, userModel}
// sub-documents), so a plain $addToSet is enough — no elemMatch needed.
exports.markConversationAsRead = async (conversationId, userId) => {
  const result = await ChatMessage.updateMany(
    {
      conversationId,
      senderId: { $ne: String(userId) },
      readBy: { $ne: String(userId) },
    },
    { $addToSet: { readBy: String(userId) } }
  );
  return result.modifiedCount ?? result.nModified ?? 0;
};


// Get all messages for a conversation (ordered by time)
exports.getMessagesByConversation = async (conversationId) => {
  // Populate mentions with user details
  const messages = await ChatMessage.find({ conversationId })
    .populate({
      path: "replyTo",
      populate: {
        path: "senderId",
        select: "name email"
      }
    })
    .sort({ timestamp: 1 });

  // Manually populate mentions (since it's an array of user IDs)
  for (const message of messages) {
    if (message.mentions && message.mentions.length > 0) {
      const mentionedUsers = await User.find({ _id: { $in: message.mentions } }, 'name email');
      message._doc.mentionedUsers = mentionedUsers;
    }
  }

  return messages;
};

// Get or create a private conversation between two users
exports.getOrCreatePrivateConversation = async (userIdA, userIdB) => {
  let conversation = await Conversation.findOne({
    type: "private",
    members: { $all: [userIdA, userIdB], $size: 2 },
  });
  if (!conversation) {
    conversation = new Conversation({
      type: "private",
      members: [userIdA, userIdB],
    });
    await conversation.save();
  }
  return conversation;
};

// List all group conversations a user belongs to
/**
 * How many messages the user hasn't read, per conversation.
 *
 * The unread badge used to be a purely client-side tally: sessionStorage,
 * incremented by the live socket handler and nothing else. That meant it only
 * ever counted messages that arrived while the tab was open and watching —
 * anything sent while the user was logged out, on their phone, or simply in a
 * different browser tab was invisible, and a fresh login always started at
 * zero. This is the server-side truth that seeds it.
 *
 * A message is unread when it isn't yours and your id isn't in `readBy`
 * (matching markConversationAsRead's definition exactly, so opening a
 * conversation zeroes precisely what this counted).
 *
 * @param {String}   userId
 * @param {String[]} conversationIds
 * @returns {Promise<Object>} { [conversationId]: count } — omits zero counts
 */
exports.getUnreadCountsForUser = async (userId, conversationIds) => {
  const ids = (conversationIds || []).map(String).filter(Boolean);
  if (ids.length === 0) return {};

  const userIdStr = String(userId);

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
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);

  return Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
};

exports.getGroupConversationsForUser = async (userId) => {
  // Ensure we compare as strings because Conversation.members is String[]
  const userIdStr = String(userId);
  const groups = await Conversation.find({ type: "group", members: userIdStr });

  // One aggregate for every group, rather than a count per group inside the
  // map below — that would be N more round trips on a list the sidebar
  // refetches on every group change.
  const unreadCounts = await exports.getUnreadCountsForUser(
    userIdStr,
    groups.map((g) => g._id)
  );

  // For each group, fetch user details for members manually (exclude terminated and absconded)
  const populatedGroups = await Promise.all(
    groups.map(async (group) => {
      const memberDetails = await User.find(
        {
          _id: { $in: group.members },
          status: { $nin: ["terminated", "absconded"] } // Exclude terminated and absconded employees
        },
        "name role status"
      );
      return {
        ...group.toObject(),
        members: memberDetails,
        // Lets the client render a correct badge straight from this one
        // response, with no separate unread request to fall out of step.
        unreadCount: unreadCounts[String(group._id)] || 0,
      };
    })
  );

  return populatedGroups;
};

// Create a new group conversation (admin or super-admin only)
exports.createGroupConversation = async (name, memberIds, createdBy) => {
  // Normalize to string IDs and ensure creator is a member
  const members = Array.from(
    new Set([...(memberIds || []).map(String), String(createdBy)])
  );

  const conversation = new Conversation({
    type: "group",
    name,
    members,
    createdBy: String(createdBy),
  });
  return await conversation.save();
};


// Delete conversation along with its messages
exports.deleteConversation = async (conversationId) => {
  // Delete all messages related to the conversation
  await ChatMessage.deleteMany({ conversationId });

  // Delete the conversation document by ID from the Conversation model
  const deletedConversation = await Conversation.findByIdAndDelete(conversationId);

  return deletedConversation;
};

// Add members to a group conversation
exports.addMembersToGroup = async (conversationId, memberIds, requestingUserId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Check if requesting user is the creator or an admin
  // For now, only creator can manage the group
  if (conversation.createdBy !== requestingUserId.toString()) {
    throw new Error("Only the group creator can add members");
  }

  // Add new members (avoid duplicates)
  const existingMembers = new Set(conversation.members);
  const newMembers = memberIds.filter(id => !existingMembers.has(id));

  conversation.members.push(...newMembers);
  await conversation.save();

  return conversation;
};

// Remove a member from a group conversation
exports.removeMemberFromGroup = async (conversationId, memberIdToRemove, requestingUserId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Check if requesting user is the creator
  if (conversation.createdBy !== requestingUserId.toString()) {
    throw new Error("Only the group creator can remove members");
  }

  // Don't allow removing the creator
  if (memberIdToRemove === conversation.createdBy) {
    throw new Error("Cannot remove the group creator");
  }

  // Remove the member
  conversation.members = conversation.members.filter(
    id => id !== memberIdToRemove
  );

  await conversation.save();

  return conversation;
};

// Update group details (name, etc.)
exports.updateGroupDetails = async (conversationId, updates, requestingUserId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Check if requesting user is the creator
  if (conversation.createdBy !== requestingUserId.toString()) {
    throw new Error("Only the group creator can update group details");
  }

  // Update allowed fields
  if (updates.name) {
    conversation.name = updates.name;
  }

  await conversation.save();

  return conversation;
};

// Get group details with populated member information
exports.getGroupDetails = async (conversationId) => {
  const conversation = await Conversation.findById(conversationId);

  if (!conversation || conversation.type !== "group") {
    throw new Error("Group conversation not found");
  }

  // Get member details
  const members = await User.find({
    _id: { $in: conversation.members }
  }).select('_id name email employeeId role');

  // Get creator details
  const creator = await User.findById(conversation.createdBy)
    .select('_id name email employeeId');

  return {
    ...conversation.toObject(),
    memberDetails: members,
    creatorDetails: creator
  };
};


