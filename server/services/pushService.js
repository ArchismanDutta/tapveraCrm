// services/pushService.js
//
// Web Push transport. Encrypts a payload to a browser's push endpoint so a
// notification can arrive with the app CLOSED — which the existing
// `Notification` API cannot do, since it only runs in an open tab.
//
// ─── CONFIGURATION ───
// Needs a VAPID keypair:
//
//   node -e "console.log(require('web-push').generateVAPIDKeys())"
//
// then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: or
// https: URL identifying the sender). Unset, this module degrades to a no-op
// and logs once — same posture as the email/SMS services, so a missing key
// never breaks a notification path, it just means no push.
//
// ─── DEAD ENDPOINTS ───
// Push subscriptions rot: cleared site data, reinstalled browser, expired
// endpoint. A dead one returns 404 or 410 forever. Those two codes are the only
// reliable "this is gone" signal a push service gives, so they delete the row.
// Everything else (network blip, 5xx, rate limit) is left alone to retry next
// time — deleting on a transient error would silently unsubscribe a live device.
'use strict';

const PushSubscription = require('../models/PushSubscription');

let webpush = null;
let configured = false;
let warned = false;

function _init() {
  if (configured || warned) return configured;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    warned = true;
    console.warn(
      '[push] VAPID keys not set — web push disabled. Generate a pair with:\n' +
        '       node -e "console.log(require(\'web-push\').generateVAPIDKeys())"\n' +
        '       then set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT.'
    );
    return false;
  }

  try {
    webpush = require('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:support@tapvera.io',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    configured = true;
    console.log('✅ Web push configured');
    return true;
  } catch (err) {
    warned = true;
    console.error(`[push] failed to initialise web-push: ${err.message}`);
    return false;
  }
}

/** Is push available? Used by the routes to advertise the public key. */
function isConfigured() {
  return _init();
}

/** The key the browser needs to call pushManager.subscribe(). */
function publicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/* ── Subscriptions ────────────────────────────────────────────────────── */

/**
 * Store (or refresh) a device subscription.
 *
 * Upserted on `endpoint`, not on (user, endpoint): the same physical device can
 * be handed to a different user account, and the endpoint is the device. Keying
 * on the pair would leave the previous user's row behind, still receiving.
 */
async function saveSubscription(userId, subscription, userAgent = '') {
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    const err = new Error('Invalid push subscription');
    err.status = 400;
    throw err;
  }

  return PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      user: userId,
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      userAgent,
      lastSeenAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function removeSubscription(endpoint) {
  if (!endpoint) return 0;
  const res = await PushSubscription.deleteOne({ endpoint });
  return res.deletedCount || 0;
}

/* ── Sending ──────────────────────────────────────────────────────────── */

/**
 * Push to every device a user has registered.
 *
 * @param {string} userId
 * @param {object} payload  { title, body, tag, url, icon, data }
 * @returns {Promise<{sent: number, failed: number, pruned: number}>}
 *
 * Never throws. A push failure must not fail the request that produced the
 * notification — the notification row is already persisted and the in-app
 * badge will show it regardless.
 */
async function sendToUser(userId, payload) {
  if (!_init()) return { sent: 0, failed: 0, pruned: 0 };

  const subs = await PushSubscription.find({ user: userId }).lean();
  if (subs.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  const body = JSON.stringify({
    title: payload.title || 'New notification',
    body: payload.body || '',
    tag: payload.tag || undefined,
    url: payload.url || '/',
    icon: payload.icon || '/icon.png',
    data: payload.data || {},
  });

  let sent = 0;
  let failed = 0;
  const dead = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body,
          { TTL: 60 * 60 } // an hour-old chat notification is noise, not news
        );
        sent += 1;
      } catch (err) {
        // 404/410 is the push service saying the endpoint is permanently gone.
        if (err.statusCode === 404 || err.statusCode === 410) {
          dead.push(sub.endpoint);
        } else {
          failed += 1;
          console.error(`[push] send failed (${err.statusCode || '?'}): ${err.message}`);
        }
      }
    })
  );

  if (dead.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: dead } }).catch(() => {});
  }

  if (sent > 0) {
    PushSubscription.updateMany(
      { user: userId, endpoint: { $nin: dead } },
      { $set: { lastSeenAt: new Date() } }
    ).catch(() => {});
  }

  return { sent, failed, pruned: dead.length };
}

module.exports = {
  isConfigured,
  publicKey,
  saveSubscription,
  removeSubscription,
  sendToUser,
};
