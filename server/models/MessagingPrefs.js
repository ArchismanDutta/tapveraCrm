// models/MessagingPrefs.js
//
// Per-user messaging preferences. A new collection rather than fields on User,
// so this ships without migrating a live collection (see the constraints in
// MESSAGING-ARCHITECTURE-PLAN.md).
//
// Everything defaults to the permissive value, and a missing document means
// "all defaults" — so a user who has never opened settings behaves exactly as
// they did before this existed.
'use strict';

const mongoose = require('mongoose');

const messagingPrefsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    /* ── Push ─────────────────────────────────────────────────────────── */

    pushEnabled: { type: Boolean, default: true },

    // Outside these hours a push is held unless the message @-mentions the
    // user directly. Stored as local "HH:mm" plus the user's IANA zone, NOT as
    // UTC offsets — an offset breaks twice a year under daylight saving, and
    // "don't wake me before 8am" has to mean 8am all year round.
    quietHours: {
      enabled: { type: Boolean, default: false },
      from: { type: String, default: '21:00' },
      to: { type: String, default: '08:00' },
      tz: { type: String, default: 'Asia/Kolkata' },
    },

    soundEnabled: { type: Boolean, default: true },

    /* ── Receipts & presence (S1 / S3) ────────────────────────────────── */

    // Reciprocity is enforced server-side: turning yours off also stops you
    // seeing everyone else's. Doing it client-side would be decorative — the
    // data would still be on the wire.
    //
    // Scope note: this governs READ receipts (the blue ticks) and presence.
    // Delivery ticks are infrastructure ("it reached their device"), not
    // behavioural ("they read it at 11:47pm"), and stay visible — matching
    // WhatsApp, where the privacy toggle never hides the grey double-tick.
    showReadReceipts: { type: Boolean, default: true },
    showPresence: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

/** Defaults for a user who has never saved preferences. */
messagingPrefsSchema.statics.defaults = function defaults() {
  return {
    pushEnabled: true,
    quietHours: { enabled: false, from: '21:00', to: '08:00', tz: 'Asia/Kolkata' },
    soundEnabled: true,
    showReadReceipts: true,
    showPresence: true,
  };
};

/** Load a user's prefs, falling back to defaults. Never returns null. */
messagingPrefsSchema.statics.forUser = async function forUser(userId) {
  const doc = await this.findOne({ user: userId }).lean();
  return { ...this.defaults(), ...(doc || {}) };
};

module.exports = mongoose.model('MessagingPrefs', messagingPrefsSchema);
