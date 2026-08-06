// models/ThreadPref.js
//
// Per-user, per-thread preferences: mute, pin-to-top, and a saved draft.
//
// A separate collection rather than fields on Conversation, for two reasons:
//   1. These are per-USER settings about a shared object. Storing them on the
//      conversation would mean an array parallel to `members`, updated on every
//      mute — and `Conversation.members` is a bare `[String]`, with no room for
//      per-member metadata.
//   2. It covers both scopes. A project thread has no Conversation document at
//      all, so anything living there could never mute a project.
'use strict';

const mongoose = require('mongoose');

const threadPrefSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // 'chat' | 'project' — matches services/messaging/realtime.js SCOPES.
    scope: { type: String, required: true, enum: ['chat', 'project'] },

    // Conversation._id or Project._id. Kept as a String because the two
    // collections' ids are not interchangeable and this is only ever used as a
    // lookup key, never populated.
    threadId: { type: String, required: true },

    muted: { type: Boolean, default: false },

    // Set for a timed mute ("8 hours"). Null with muted:true means forever.
    // The check is `muted && (!mutedUntil || mutedUntil > now)`, so an expired
    // timed mute simply stops applying without needing a sweeper job.
    mutedUntil: { type: Date, default: null },

    pinned: { type: Boolean, default: false },

    // Unsent composer text, so switching threads doesn't lose what you typed.
    draft: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

// One row per user per thread.
threadPrefSchema.index({ user: 1, scope: 1, threadId: 1 }, { unique: true });

/**
 * Is this thread muted for this user right now?
 * Expired timed mutes return false without any cleanup pass.
 */
threadPrefSchema.statics.isMuted = async function isMuted(userId, scope, threadId) {
  const pref = await this.findOne({ user: userId, scope, threadId })
    .select('muted mutedUntil')
    .lean();
  if (!pref?.muted) return false;
  if (!pref.mutedUntil) return true;
  return new Date(pref.mutedUntil) > new Date();
};

module.exports = mongoose.model('ThreadPref', threadPrefSchema);
