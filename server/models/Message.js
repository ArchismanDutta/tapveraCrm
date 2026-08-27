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
      /**
       * Required — UNLESS the message has been retracted.
       *
       * ─── WHY THIS IS CONDITIONAL ───
       * "Delete for everyone" clears the body and saves, which ran straight
       * into a flat `required: true` and failed validation with "Path
       * `message` is required" — surfacing as an opaque 500 ("Could not
       * delete that message") because a ValidationError is not an AccessError
       * and falls through the route's outer catch.
       *
       * Chat did not hit this: ChatMessage declares `message` with
       * `default: ""` and no required flag, so retraction worked there and
       * failed only on project threads.
       *
       * The constraint is worth keeping for ordinary messages — but a
       * tombstone is precisely a message whose text has been taken away, so
       * the rule is "must have text unless it has been deleted", and that is
       * what this now says. The send route enforces non-empty independently
       * (projectRoutes: "Message content is required"), so nothing depends on
       * this alone.
       */
      required: function () {
        return !this.deletedForEveryone;
      },
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
    // ─── Delivery receipts (S1) ─────────────────────────────────────────
    // Additive and optional; see the matching block in ChatMessage.js for why
    // clientMsgId is the keystone for optimistic send / retry / offline outbox.
    // No `default: null` — see the long note in ChatMessage.js. A null default
    // paired with a sparse unique index capped the collection at one message
    // without a client id and made every server-created message fail E11000.
    clientMsgId: { type: String },

    /**
     * Who has RECEIVED this on a device. Distinct from `readBy` — delivery is
     * acked automatically by the recipient's socket, read requires the message
     * to have actually been visible on screen.
     */
    deliveredTo: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, refPath: 'deliveredTo.userModel' },
        userModel: { type: String, enum: ['User', 'Client'] },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    // Message Status Tracking
    //
    // Now DERIVED rather than asserted: services/messaging/receipts.js computes
    // it from deliveredTo/readBy against the thread's membership. It was
    // previously defaulted to 'sent' and only ever changed by an explicit
    // status call, so it never reflected reality.
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
    editedAt: { type: Date, default: null },

    /**
     * ─── DELETION ───
     * Two different things, deliberately kept as two different fields, because
     * they are two different claims.
     *
     * `deletedFor` is "delete for me": this message is hidden from these users
     * and nobody else. Everyone else's copy is untouched, and the sender is not
     * told. It is a view preference, so it is always available, on anyone's
     * message, forever.
     *
     * `deletedForEveryone` is a RETRACTION. The body and attachments are cleared
     * from the document — not merely hidden — so nothing can serve them again.
     * Only the sender can do it, and only inside the window (see
     * DELETE_WINDOW_MS in the adapter), which is the same reasoning the edit
     * window rests on: a message people have already acted on cannot be
     * un-said.
     *
     * The document SURVIVES a retraction rather than being removed. A hard
     * delete would break every reply pointing at it, leave read cursors
     * addressing a message that no longer exists, and silently renumber the
     * thread for anyone paging through it. A tombstone holds its place and
     * renders as "This message was deleted", which is also what recipients
     * expect to see — a message vanishing without trace reads as a bug.
     */
    deletedFor: { type: [String], default: [] },
    deletedForEveryone: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
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
// Idempotency: at most one message per client-generated id. Partial rather than
// sparse — sparse still indexes an explicit `null`. See ChatMessage.js.
messageSchema.index(
  { clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: "string" } } }
);

module.exports = mongoose.model("Message", messageSchema);
