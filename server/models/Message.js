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
      enum: ["client", "employee", "admin", "hr", "super-admin"],
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
          type: Date,  // Individual read timestamp for this user
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
    // Message Status Tracking
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    },
    // Delivery Tracking
    deliveredAt: {
      type: Date
    },
    // Read Tracking
    readAt: {
      type: Date  // Timestamp when message was first read by any recipient
    },
    // Pinned Messages (Admin only - Users can pin, not Clients)
    isPinned: {
      type: Boolean,
      default: false
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User' // Only Users (admins) can pin messages
    },
    pinnedAt: {
      type: Date
    },
    // Starred Messages
    starredBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'starredBy.userModel'
      },
      userModel: {
        type: String,
        enum: ['User', 'Client']
      }
    }]
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
messageSchema.index({ project: 1, createdAt: -1 });
messageSchema.index({ project: 1, isPinned: 1 });
messageSchema.index({ project: 1, status: 1 });
messageSchema.index({ 'readBy.user': 1 });
messageSchema.index({ starredBy: 1 });

module.exports = mongoose.model("Message", messageSchema);
