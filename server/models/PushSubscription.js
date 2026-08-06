// models/PushSubscription.js
//
// One row per DEVICE, not per user — a person with a laptop and a phone has two.
// The browser mints these via `registration.pushManager.subscribe()`; we store
// the opaque endpoint plus the two keys needed to encrypt a payload to it.
//
// ─── LIFECYCLE ───
// Subscriptions rot. A user clears site data, reinstalls the browser, or the
// push service simply expires the endpoint — and from then on every send to it
// returns 404/410. Left alone, dead endpoints accumulate forever and every
// notification pays the cost of failing against them. `services/pushService.js`
// deletes on those two status codes, which is the only reliable signal a push
// service gives you.
'use strict';

const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // The push service URL. Unique across the whole collection: the SAME device
    // re-subscribing must update its row rather than create a second one, or
    // the user gets duplicate notifications for every message.
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },

    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },

    // Purely diagnostic — useful when a user reports "my phone doesn't notify".
    userAgent: { type: String, default: '' },

    // Bumped on every successful send, so a cleanup job can reap endpoints that
    // have not accepted anything in months.
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

// The send path loads every subscription for a user.
pushSubscriptionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
