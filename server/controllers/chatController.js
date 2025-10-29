// controllers/chatController.js

const ChatMessage = require("../models/ChatMessage");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

// Parse @mentions from message text and return user IDs
const parseMentions = async (messageText) => {
  if (!messageText) return [];

  // Match @mentions in the format @Name or @FirstName LastName
  const mentionPattern = /@(\w+(?:\s+\w+)*)/g;
  const matches = [...messageText.matchAll(mentionPattern)];

  if (matches.length === 0) return [];

  // Extract mentioned names
  const mentionedNames = matches.map(match => match[1].toLowerCase());

  // Find users by name (case-insensitive)
  const users = await User.find({
    $or: mentionedNames.map(name => ({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    }))
  }, '_id');

  return users.map(user => String(user._id));
};

// Save a message (supports one-to-one and group messages)
exports.saveMessage = async (conversationId, senderId, message, attachments = [], replyTo = null, mentions = []) => {
  // Parse mentions from message text if not explicitly provided
  let mentionedUserIds = mentions;
  if (mentions.length === 0 && message) {
    mentionedUserIds = await parseMentions(message);
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

  // Send notifications to mentioned users
  if (mentionedUserIds.length > 0) {
    const notificationService = require('../services/notificationService');
    const conversation = await Conversation.findById(conversationId);
    const sender = await User.findById(senderId, 'name');

    for (const mentionedUserId of mentionedUserIds) {
      // Don't notify if user mentioned themselves
      if (String(mentionedUserId) !== String(senderId)) {
        await notificationService.createNotification({
          userId: mentionedUserId,
          type: 'chat',
          channel: 'mention',
          title: `${sender?.name || 'Someone'} mentioned you`,
          body: message.slice(0, 100) + (message.length > 100 ? '...' : ''),
          relatedData: {
            conversationId: conversationId,
            messageId: savedMessage._id
          },
          priority: 'high'
        });
      }
    }
  }

  return savedMessage;
};


exports.getConversationById = async (conversationId) => {
  return await Conversation.findById(conversationId);
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
exports.getGroupConversationsForUser = async (userId) => {
  // Ensure we compare as strings because Conversation.members is String[]
  const userIdStr = String(userId);
  const groups = await Conversation.find({ type: "group", members: userIdStr });

  // For each group, fetch user details for members manually
  const populatedGroups = await Promise.all(
    groups.map(async (group) => {
      const memberDetails = await User.find(
        { _id: { $in: group.members } },
        "name role"
      );
      return {
        ...group.toObject(),
        members: memberDetails,
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


