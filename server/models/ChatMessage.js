const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  senderId: { type: String, required: true },
  message: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String }], // array of user IDs who have read the message
  // Mentioned users (WhatsApp-style @mentions)
  mentions: [{ type: String }], // array of user IDs who were mentioned
  // Reply to another message (WhatsApp-style)
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChatMessage",
    default: null,
  },
  // Enhanced attachments with type and metadata
  attachments: [
    {
      filename: String,
      url: String,
      size: Number,
      mimeType: String,
      fileType: {
        type: String,
        enum: ["image", "document", "video", "audio", "other"],
        default: "other",
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  reactions: [
    {
      emoji: {
        type: String,
        required: true,
      },
      users: [
        {
          type: String, // user ID
        },
      ],
    },
  ],
});

// =====================================================
// PERFORMANCE INDEXES
// =====================================================

// Primary compound index for fetching messages by conversation with timestamp sorting
// This is the most common query: fetching messages for a conversation ordered by time
ChatMessageSchema.index({ conversationId: 1, timestamp: -1 });

// Index for sender-based queries (e.g., finding all messages by a user)
ChatMessageSchema.index({ senderId: 1, timestamp: -1 });

// Index for unread messages queries (messages not in readBy array)
ChatMessageSchema.index({ readBy: 1 });

// Index for mention-based queries (finding messages where user is mentioned)
ChatMessageSchema.index({ mentions: 1, timestamp: -1 });

// Index for reply threads (finding all replies to a message)
ChatMessageSchema.index({ replyTo: 1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
