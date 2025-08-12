// models/Conversation.js
const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String },
    isGroup: { type: Boolean, default: false },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "ChatMessage" },
    metadata: { type: Object }
  },
  { timestamps: true }
);

conversationSchema.index({ members: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);
