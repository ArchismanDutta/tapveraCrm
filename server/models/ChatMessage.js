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

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);
