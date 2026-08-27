const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  senderId: { type: String, required: true },
  message: { type: String, default: "" },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: String }], // array of user IDs who have read the message
  // Mentioned users (WhatsApp-style @mentions)
  mentions: [{ type: String }], // array of user IDs who were mentioned

  // Relayed from another conversation rather than composed here.
  //
  // Deliberately a bare flag and not a reference to the source. The recipient
  // may have no access to the conversation this came from, so naming it — or
  // storing an id someone could resolve — would leak the existence and
  // membership of a group they aren't in. "Forwarded" tells them the content
  // isn't the sender's own words, which is the part that matters.
  forwarded: { type: Boolean, default: false },
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

  // ─── Delivery receipts (S1) ───────────────────────────────────────────
  //
  // Both fields are additive and optional. Messages that predate this have
  // neither, and render as "sent" (✓) forever — which is correct: the absence
  // of a receipt genuinely means we do not know, and inventing ✓✓ for old
  // messages would be a lie.

  /**
   * Client-generated UUID, minted BEFORE the send leaves the browser.
   *
   * This one field is what makes optimistic sending, retries and the offline
   * outbox (S2) safe. The unique index below means a retry after a flaky
   * network is a no-op that returns the original message rather than creating
   * a twin — the classic "I hit send once and it posted three times" bug.
   *
   * ─── NO `default: null` — THIS IS LOAD-BEARING ───
   * It used to be `default: null`, paired with a `sparse` unique index. Sparse
   * only skips documents where the field is ABSENT; `null` is a stored value,
   * so every such document WAS indexed, and the unique constraint therefore
   * allowed exactly ONE message in the whole collection to have no client id.
   * Anything else created server-side — every forwarded copy, every message
   * from a client too old to send one — died on E11000 and surfaced as a 500.
   * Leaving the field undefined keeps it out of the index entirely, which is
   * what "sparse" was reaching for in the first place. The index below is now
   * partial on string values, so it is correct either way.
   */
  clientMsgId: { type: String },

  /**
   * Who has RECEIVED this on a device — distinct from `readBy`, which means
   * they actually looked at it. Delivery is acked automatically by the
   * recipient's socket; read requires genuine visibility.
   */
  deliveredTo: [
    {
      user: { type: String },
      at: { type: Date, default: Date.now },
      _id: false,
    },
  ],

  /**
   * When this message was last edited, or null if never.
   *
   * Additive and optional — every message that predates the feature has no
   * value here and correctly renders without an "edited" marker.
   *
   * Only the timestamp is kept, not the previous text. Storing edit history
   * would mean the server holds a copy of something the sender explicitly
   * retracted, which is the opposite of what editing is for; and surfacing it
   * would make the feature useless (nobody corrects a typo if the typo stays
   * visible). The marker exists so recipients know the words changed — that
   * is the honest minimum, and it is what WhatsApp shows too.
   */
  editedAt: { type: Date, default: null },
});

// Idempotency: at most one message per client-generated id.
//
// PARTIAL, not sparse. See the note on the field above: a sparse unique index
// still indexes documents whose value is literally `null`, so it capped the
// collection at one server-created message. Restricting the index to string
// values means only real client ids are constrained, and messages without one
// (forwards, server-side sends) are ignored by it entirely.
ChatMessageSchema.index(
  { clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: "string" } } }
);

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
