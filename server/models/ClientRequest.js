const mongoose = require("mongoose");

const clientRequestSchema = new mongoose.Schema(
  {
    // Client who made the request
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },

    // Request type: 'quote' or 'support'
    type: {
      type: String,
      enum: ["quote", "support"],
      required: true,
    },

    // Request status
    status: {
      type: String,
      enum: ["pending", "in-progress", "resolved", "closed"],
      default: "pending",
    },

    // Priority (for support requests)
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Common fields
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    // Quote-specific fields
    projectType: {
      type: String,
      enum: ["Website", "SEO", "Google Marketing", "SMO", "Hosting", "Invoice App", "Other", ""],
      default: "",
    },

    budget: {
      type: String,
      default: "",
    },

    currency: {
      type: String,
      enum: ["USD", "AUD", "INR", "EUR", "GBP", "CAD"],
      default: "USD",
    },

    timeline: {
      type: String,
      default: "",
    },

    // Support-specific fields
    category: {
      type: String,
      enum: ["Technical Issue", "Billing Question", "Project Inquiry", "Account Access", "Feature Request", "Other", ""],
      default: "",
    },

    // Assigned admin (who's handling the request)
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Chat messages for this request
    messages: [
      {
        sentBy: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: "messages.senderModel",
          required: true,
        },
        senderModel: {
          type: String,
          required: true,
          enum: ["User", "Client"],
        },
        senderName: {
          type: String,
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        read: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // Resolution details
    resolution: {
      type: String,
      default: "",
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    resolvedAt: {
      type: Date,
    },

    // Metadata
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    unreadCount: {
      admin: { type: Number, default: 0 },
      client: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
clientRequestSchema.index({ client: 1, status: 1 });
clientRequestSchema.index({ type: 1, status: 1 });
clientRequestSchema.index({ assignedTo: 1, status: 1 });
clientRequestSchema.index({ createdAt: -1 });

// Update lastMessageAt when new message is added
clientRequestSchema.pre("save", function (next) {
  if (this.isModified("messages") && this.messages.length > 0) {
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

module.exports = mongoose.model("ClientRequest", clientRequestSchema);
