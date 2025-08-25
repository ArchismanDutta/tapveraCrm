const ChatMessage = require("../models/ChatMessage");

exports.saveMessage = async (senderId, recipientId, message) => {
  const chatMessage = new ChatMessage({ senderId, recipientId, message });
  return await chatMessage.save();
};

exports.getMessages = async (userId, otherUserId) => {
  return await ChatMessage.find({
    $or: [
      { senderId: userId, recipientId: otherUserId },
      { senderId: otherUserId, recipientId: userId },
    ],
  }).sort({ timestamp: 1 });
};
