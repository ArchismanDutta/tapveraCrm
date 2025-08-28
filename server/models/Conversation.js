// server/models/Conversation.js
const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  type: { type: String, enum: ["private", "group"], required: true },
  members: [{ type: String, required: true }], // user IDs
  name: { type: String }, // For group chats
  createdBy: { type: String }, // Admin/super-admin ID for groups
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Conversation", ConversationSchema);
