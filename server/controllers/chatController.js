// controllers/chatController.js

const ChatMessage = require("../models/ChatMessage");
const Conversation = require("../models/Conversation");

// Save a message (supports one-to-one and group messages)
exports.saveMessage = async (conversationId, senderId, message) => {
  const chatMessage = new ChatMessage({
    conversationId,
    senderId,
    message,
    readBy: [senderId], // Mark sender as having read
  });
  return await chatMessage.save();
};


exports.getConversationById = async (conversationId) => {
  return await Conversation.findById(conversationId);
};


// Get all messages for a conversation (ordered by time)
exports.getMessagesByConversation = async (conversationId) => {
  return await ChatMessage.find({ conversationId }).sort({ timestamp: 1 });
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
  return await Conversation.find({ type: "group", members: userId });
};

// Create a new group conversation (admin or super-admin only)
exports.createGroupConversation = async (name, memberIds, createdBy) => {
  const conversation = new Conversation({
    type: "group",
    name,
    members: memberIds,
    createdBy,
  });
  return await conversation.save();
};
