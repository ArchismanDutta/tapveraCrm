const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "senderModel",
      required: true,
    },
    senderModel: {
      type: String,
      required: true,
      enum: ["User", "Client"],
    },
    senderType: {
      type: String,
      enum: ["client", "employee", "super-admin"],
      required: true,
    },
    // Reply to another message (WhatsApp-style)
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
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
        isImportant: {
          type: Boolean,
          default: false,
        },
        s3Key: String, // AWS S3 object key for deletion
      },
    ],
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "readBy.userModel",
        },
        userModel: {
          type: String,
          enum: ["User", "Client"],
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Mentioned users (WhatsApp-style @mentions)
    mentions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "mentions.userModel",
        },
        userModel: {
          type: String,
          enum: ["User", "Client"],
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
            user: {
              type: mongoose.Schema.Types.ObjectId,
              refPath: "reactions.users.userModel",
            },
            userModel: {
              type: String,
              enum: ["User", "Client"],
            },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Message", messageSchema);
