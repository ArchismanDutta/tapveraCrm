// routes/controlMachineRoutes.js
//
// Per-user break-timer speed factor. Backs the hidden maintenance page at
// /control-machine-sync.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE URL IS NOT THE SECURITY
// ─────────────────────────────────────────────────────────────────────────────
// The page's path is obscure, and that is worth exactly nothing as access
// control: React route strings ship inside the JS bundle, so anyone can find
// it with a text search of the deployed app, and it leaks further through
// browser history, bookmarks and Referer headers. Hiding the link only stops
// people stumbling in by accident.
//
// So this router enforces super-admin server-side and does not consult the
// caller's role as reported by the client. The obscure path is convenience;
// this check is the actual boundary.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS SEPARATE FROM THE ATTENDANCE ROUTER
// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/manual-attendance is open to admin + HR + anyone with
// attendance:manage. Adjusting how fast someone's break accrues is a
// different order of change from correcting a punch time — it silently alters
// every future day for that person — so it gets a narrower gate rather than
// inheriting that one.
'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AttendanceService = require('../services/AttendanceService');
const { protect } = require('../middlewares/authMiddleware');

const attendanceService = new AttendanceService();

/** Super-admin only. Deliberately not widened to `attendance:manage`. */
router.use(protect);
router.use((req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase().replace(/\s+/g, '-');
  if (role === 'super-admin' || role === 'superadmin') return next();
  // 404 rather than 403: a 403 confirms the endpoint exists to anyone probing.
  return res.status(404).json({ success: false, message: 'Not found' });
});

/**
 * GET /api/admin/control-machine
 * Everyone who can be configured, with their current factor.
 */
router.get('/', async (req, res) => {
  try {
    const users = await User.find(
      { status: 'active' },
      'name email employeeId department role controlMachineFactor controlMachineMeta'
    )
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: users.map((u) => ({
        _id: String(u._id),
        name: u.name,
        email: u.email,
        employeeId: u.employeeId || null,
        department: u.department || null,
        role: u.role,
        // Normalised on the way out so the UI never has to reason about
        // accounts that predate the field.
        controlMachineFactor: attendanceService.normalizeControlMachineFactor(u.controlMachineFactor),
        controlMachineMeta: u.controlMachineMeta || null,
      })),
    });
  } catch (error) {
    console.error('Error listing break speed factors:', error);
    res.status(500).json({ success: false, message: 'Failed to load users' });
  }
});

/**
 * POST /api/admin/control-machine
 * Body: { userId, factor, reason }
 *
 * Takes effect from the NEXT attendance day created for that user. Days
 * already in existence keep the factor they snapshotted — see
 * AttendanceRecord.controlMachineFactor for why that matters.
 */
router.post('/', async (req, res) => {
  try {
    const { userId, factor, reason } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const raw = Number(factor);
    if (!Number.isFinite(raw) || raw < 0.1 || raw > 10) {
      // Validated rather than silently clamped: someone who typed 100 meant
      // something, and quietly storing 10 would leave them believing a very
      // different setting is live.
      return res.status(400).json({
        success: false,
        message: 'Factor must be a number between 0.1 and 10',
      });
    }

    // A reason is required for anything other than a reset to normal. This
    // changes recorded attendance for a specific person indefinitely, and an
    // unexplained one is precisely what an audit trail exists to prevent.
    if (raw !== 1 && !String(reason || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required when setting a factor other than 1',
      });
    }

    const user = await User.findById(userId).select('name controlMachineFactor');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const previous = attendanceService.normalizeControlMachineFactor(user.controlMachineFactor);
    user.controlMachineFactor = raw;
    user.controlMachineMeta = {
      reason: raw === 1 ? String(reason || '').trim() || 'Reset to real time' : String(reason).trim(),
      setBy: req.user._id,
      setByName: req.user.name,
      setAt: new Date(),
    };
    await user.save();

    console.log(
      `[control-machine] ${req.user.name} set ${user.name} from ${previous}x to ${raw}x — ${user.controlMachineMeta.reason}`
    );

    res.json({
      success: true,
      message:
        raw === 1
          ? `${user.name} is back to the standard rate`
          : `${user.name} is now set to ${raw}x`,
      data: {
        userId: String(user._id),
        previousFactor: previous,
        controlMachineFactor: raw,
        controlMachineMeta: user.controlMachineMeta,
        // Stated explicitly so the UI can say it rather than leaving the
        // operator to discover that today is unchanged.
        appliesFrom: 'the next attendance day created for this user',
      },
    });
  } catch (error) {
    console.error('Error setting break speed factor:', error);
    res.status(500).json({ success: false, message: 'Failed to update factor' });
  }
});

module.exports = router;
