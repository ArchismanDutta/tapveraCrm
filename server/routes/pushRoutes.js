// routes/pushRoutes.js
//
// Web push subscription management + messaging preferences.
//
// Mounted at /api/push. Everything here is scoped to req.user — a subscription
// belongs to the device that created it and the person logged in on it, and
// there is no route that takes a userId.
'use strict';

const express = require('express');
const router = express.Router();

const { protect } = require('../middlewares/authMiddleware');
const pushService = require('../services/pushService');
const MessagingPrefs = require('../models/MessagingPrefs');
const ThreadPref = require('../models/ThreadPref');

router.use(protect);

/* ── Subscriptions ────────────────────────────────────────────────────── */

/**
 * GET /api/push/public-key
 * The VAPID public key the browser needs for pushManager.subscribe().
 * Returns enabled:false when the server has no keys configured, so the client
 * can skip the permission prompt entirely rather than asking for a permission
 * it cannot use.
 */
router.get('/public-key', (req, res) => {
  res.json({
    enabled: pushService.isConfigured(),
    publicKey: pushService.publicKey(),
  });
});

/** POST /api/push/subscribe  { subscription } */
router.post('/subscribe', async (req, res) => {
  try {
    const saved = await pushService.saveSubscription(
      req.user._id,
      req.body?.subscription,
      req.get('user-agent') || ''
    );
    res.status(201).json({ ok: true, id: saved._id });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to subscribe' });
  }
});

/**
 * POST /api/push/unsubscribe  { endpoint }
 *
 * Takes the endpoint rather than an id: the browser knows its own endpoint from
 * `registration.pushManager.getSubscription()` but has never seen our row id.
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const removed = await pushService.removeSubscription(req.body?.endpoint);
    res.json({ ok: true, removed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/* ── Preferences ──────────────────────────────────────────────────────── */

/** GET /api/push/prefs — always resolves, defaults for a user who has none. */
router.get('/prefs', async (req, res) => {
  try {
    res.json(await MessagingPrefs.forUser(req.user._id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to load preferences' });
  }
});

/** PATCH /api/push/prefs — partial update of the allowed fields only. */
router.patch('/prefs', async (req, res) => {
  try {
    const allowed = [
      'pushEnabled',
      'quietHours',
      'soundEnabled',
      'showReadReceipts',
      'showPresence',
    ];
    const update = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });

    const saved = await MessagingPrefs.findOneAndUpdate(
      { user: req.user._id },
      { $set: update, $setOnInsert: { user: req.user._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

/* ── Per-thread mute ──────────────────────────────────────────────────── */

/**
 * PATCH /api/push/threads/:scope/:threadId/mute  { muted, hours }
 *
 * `hours` gives a timed mute; omitting it mutes indefinitely. No membership
 * check: this only ever writes a row keyed to the caller's own user id, so the
 * worst a caller can do with someone else's thread id is silence themselves
 * about a thread they cannot see anyway.
 */
router.patch('/threads/:scope/:threadId/mute', async (req, res) => {
  try {
    const { scope, threadId } = req.params;
    if (!['chat', 'project'].includes(scope)) {
      return res.status(400).json({ error: 'Unknown scope' });
    }

    const { muted = true, hours } = req.body || {};
    const mutedUntil = muted && hours ? new Date(Date.now() + Number(hours) * 3600_000) : null;

    const saved = await ThreadPref.findOneAndUpdate(
      { user: req.user._id, scope, threadId },
      { $set: { muted: Boolean(muted), mutedUntil } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update mute setting' });
  }
});

module.exports = router;
