const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  senderId: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String }], // array of user IDs who have read the message
});

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
