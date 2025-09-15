// controllers/chatController.js

const ChatMessage = require("../models/ChatMessage");
const Conversation = require("../models/Conversation");
const User = require("../models/User");

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


