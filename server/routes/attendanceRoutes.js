// routes/attendanceRoutes.js
// Unified routes for the new attendance system

const express = require('express');
const router = express.Router();

// Import new controllers
const statusControllerNew = require('../controllers/statusControllerNew');
const summaryControllerNew = require('../controllers/summaryControllerNew');

// Import middleware
const { protect, authorize } = require('../middlewares/authMiddleware');

// ======================
// Status Routes (Employee & Admin)
// ======================

// Get today's status for authenticated user
router.get('/status/today', protect, statusControllerNew.getTodayStatus);

// Update today's status (punch in/out, breaks)
router.put('/status/today', protect, statusControllerNew.updateTodayStatus);

// Get employee status (admin only)
router.get(
  '/status/employee/:employeeId',
  protect,
  authorize('admin', 'super-admin', 'hr'),
  statusControllerNew.getEmployeeTodayStatus
);

// Manual sync to DailyWork (admin only) - DISABLED: DailyWork removed
// router.post(
//   '/status/sync/:userId?',
//   protect,
//   authorize('admin', 'super-admin', 'hr'),
//   statusControllerNew.syncDailyWork
// );

// ======================
// Summary Routes (Employee & Admin)
// ======================

// Get weekly summary for authenticated user or specific employee (admin)
router.get('/summary/week', protect, summaryControllerNew.getWeeklySummary);

// Get monthly summary for authenticated user
router.get('/summary/month', protect, summaryControllerNew.getMonthlySummary);

// ======================
// Utility Routes
// ======================

// Health check for attendance system
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      unifiedCalculations: true,
      realTimeSync: true,
      consistentData: true,
      comprehensiveValidation: true,
    },
  });
});

module.exports = router;