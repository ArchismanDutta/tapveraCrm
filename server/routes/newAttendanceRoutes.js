// routes/newAttendanceRoutes.js
// Routes for the new date-centric attendance system
const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/AttendanceController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Create an instance of the AttendanceController
const attendanceController = new AttendanceController();

// ======================
// Employee Routes - Authenticated users can access their own data
// ======================

/**
 * Record punch action (punch in/out, break start/end)
 * @route POST /api/attendance-new/punch
 * @access Private
 * @body { action: 'PUNCH_IN' | 'PUNCH_OUT' | 'BREAK_START' | 'BREAK_END', location?: string, notes?: string }
 */
router.post('/punch', protect, attendanceController.punchAction.bind(attendanceController));

/**
 * Get today's attendance status for authenticated user
 * @route GET /api/attendance-new/today
 * @access Private
 */
router.get('/today', protect, attendanceController.getTodayStatus.bind(attendanceController));

/**
 * Get weekly attendance summary for authenticated user
 * @route GET /api/attendance-new/my-weekly?startDate=2024-01-01&endDate=2024-01-07
 * @access Private
 */
router.get('/my-weekly', protect, attendanceController.getMyWeeklySummary.bind(attendanceController));

/**
 * Get employee's attendance for date range
 * @route GET /api/attendance-new/employee/:userId/range?startDate=2024-01-01&endDate=2024-01-31
 * @access Private (own data) / Admin (any employee)
 */
router.get('/employee/:userId/range', protect, attendanceController.getEmployeeAttendanceRange.bind(attendanceController));

/**
 * Get monthly attendance for employee
 * @route GET /api/attendance-new/employee/:userId/monthly/:year/:month
 * @access Private (own data) / Admin (any employee)
 */
router.get('/employee/:userId/monthly/:year/:month', protect, attendanceController.getEmployeeMonthly.bind(attendanceController));

// ======================
// Admin Routes - Require admin, hr, or super-admin privileges
// ======================

/**
 * Force recalculate attendance for a user on a specific date
 * @route PUT /api/attendance-new/recalculate/:userId/:date
 * @access Private (employees can recalculate own data, admins can recalculate any)
 */
router.put('/recalculate/:userId/:date', protect, attendanceController.recalculateAttendance.bind(attendanceController));

/**
 * Get daily attendance report for all employees
 * @route GET /api/attendance-new/daily/:date
 * @access Admin, HR, Super-Admin
 */
router.get('/daily/:date', protect, authorize('admin', 'super-admin', 'hr'), attendanceController.getDailyReport.bind(attendanceController));

/**
 * Get weekly attendance summary
 * @route GET /api/attendance-new/weekly?startDate=2024-01-01&endDate=2024-01-07
 * @access Admin, HR, Super-Admin
 */
router.get('/weekly', protect, authorize('admin', 'super-admin', 'hr'), attendanceController.getWeeklySummary.bind(attendanceController));

/**
 * Get current active employees (real-time)
 * @route GET /api/attendance-new/active
 * @access Admin, HR, Super-Admin
 */
router.get('/active', protect, authorize('admin', 'super-admin', 'hr'), attendanceController.getActiveEmployees.bind(attendanceController));

/**
 * Manual punch action for employees
 * @route POST /api/attendance-new/manual-punch
 * @access Admin, HR, Super-Admin
 * @body { userId, action, timestamp, location?, notes? }
 */
router.post('/manual-punch', protect, authorize('admin', 'super-admin', 'hr'), attendanceController.manualPunchAction.bind(attendanceController));

/**
 * Get attendance statistics
 * @route GET /api/attendance-new/stats?period=week|month&startDate=2024-01-01&endDate=2024-01-31
 * @access Admin, HR, Super-Admin
 */
router.get('/stats', protect, authorize('admin', 'super-admin', 'hr'), attendanceController.getAttendanceStats.bind(attendanceController));

// ======================
// System Routes - Health check and utilities
// ======================

/**
 * Health check for new attendance system
 * @route GET /api/attendance-new/health
 * @access Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'New Date-Centric Attendance System',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      dateCentricStorage: true,
      eventDrivenCalculations: true,
      realTimeTracking: true,
      performanceMetrics: true,
      departmentAnalytics: true,
      manualPunchCapability: true,
      auditTrail: true,
      bulkReporting: true
    },
    endpoints: {
      employee: [
        'POST /punch - Record punch actions',
        'GET /today - Get today\'s status',
        'GET /employee/:userId/range - Get date range data',
        'GET /employee/:userId/monthly/:year/:month - Get monthly data'
      ],
      admin: [
        'GET /daily/:date - Daily report',
        'GET /weekly - Weekly summary',
        'GET /active - Active employees',
        'POST /manual-punch - Manual punch entry',
        'GET /stats - Attendance statistics'
      ]
    }
  });
});

/**
 * System information and capabilities
 * @route GET /api/attendance-new/info
 * @access Public
 */
router.get('/info', (req, res) => {
  res.json({
    systemName: 'Date-Centric Attendance Management System',
    description: 'Advanced attendance tracking with single source of truth per date',
    capabilities: {
      storage: {
        model: 'Date-centric with embedded employee data',
        benefits: ['Single query per date', 'Atomic updates', 'Built-in analytics']
      },
      calculations: {
        source: 'Event-driven from punch timeline',
        realTime: true,
        accuracy: 'High - no data duplication issues'
      },
      reporting: {
        daily: 'Complete employee status and analytics',
        weekly: 'Trend analysis and insights',
        monthly: 'Performance metrics and patterns',
        realTime: 'Live employee status tracking'
      },
      features: {
        multipleShiftSupport: true,
        flexibleSchedules: true,
        breakTracking: true,
        overtimeDetection: true,
        performanceScoring: true,
        departmentAnalytics: true,
        holidayHandling: true,
        leaveIntegration: true,
        manualCorrections: true,
        auditLogging: true
      }
    },
    migration: {
      fromOldSystem: 'Migration script available',
      dataIntegrity: 'Events preserved with full history',
      rollback: 'Old system remains intact during transition'
    }
  });
});

module.exports = router;