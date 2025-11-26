// server/models/Conversation.js
const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  type: { type: String, enum: ["private", "group"], required: true },
  members: [{ type: String, required: true }], // user IDs
  name: { type: String }, // For group chats
  createdBy: { type: String }, // Admin/super-admin ID for groups
  createdAt: { type: Date, default: Date.now },
});

// =====================================================
// PERFORMANCE INDEXES
// =====================================================

// Compound index for finding conversations by type and members
// This is critical for finding existing private conversations between users
ConversationSchema.index({ type: 1, members: 1 });

// Index for member-based queries (finding all conversations a user is part of)
// Array index for efficient membership queries
ConversationSchema.index({ members: 1 });

// Index for group conversations created by a specific user
ConversationSchema.index({ createdBy: 1, type: 1 });

// Index for recent conversations (sorted by creation time)
ConversationSchema.index({ createdAt: -1 });

// Compound index for group conversations with recent-first sorting
ConversationSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
