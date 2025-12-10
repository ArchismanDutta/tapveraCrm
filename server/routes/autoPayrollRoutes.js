// routes/autoPayrollRoutes.js
// Routes for automatic payroll generation based on attendance

const express = require('express');
const router = express.Router();
const autoPayrollController = require('../controllers/autoPayrollController');
const { protect, authorize } = require('../middlewares/authMiddleware');

/**
 * Preview salary calculation without saving
 * GET /api/auto-payroll/preview/:userId/:payPeriod
 * @access Super Admin, HR ONLY
 */
router.get(
  '/preview/:userId/:payPeriod',
  protect,
  authorize('super-admin', 'hr'),
  autoPayrollController.previewSalaryCalculation
);

/**
 * Get attendance summary for payroll
 * GET /api/auto-payroll/attendance-summary/:userId/:payPeriod
 * @access Super Admin, HR ONLY
 */
router.get(
  '/attendance-summary/:userId/:payPeriod',
  protect,
  authorize('super-admin', 'hr'),
  autoPayrollController.getAttendanceSummary
);

/**
 * Get payroll calculation rules and constants
 * GET /api/auto-payroll/calculation-rules
 * @access Super Admin, HR ONLY
 */
router.get(
  '/calculation-rules',
  protect,
  authorize('super-admin', 'hr'),
  autoPayrollController.getCalculationRules
);

/**
 * Compare automatic vs manual calculations
 * GET /api/auto-payroll/compare/:userId/:payPeriod
 * @access Super Admin, HR ONLY
 */
router.get(
  '/compare/:userId/:payPeriod',
  protect,
  authorize('super-admin', 'hr'),
  autoPayrollController.compareCalculations
);

/**
 * Generate payslip for a single employee
 * POST /api/auto-payroll/generate
 * @access Super Admin, HR ONLY
 */
router.post(
  '/generate',
  protect,
  authorize('super-admin', 'hr'),
  autoPayrollController.generateSinglePayslip
);

/**
 * Generate payslips for all employees (bulk)
 * POST /api/auto-payroll/generate-bulk
 * @access Super Admin, HR ONLY
 */
router.post(
  '/generate-bulk',
  protect,
  authorize('super-admin', 'hr'),
  autoPayrollController.generateBulkPayslips
);

/**
 * Recalculate existing payslip from attendance
 * PUT /api/auto-payroll/recalculate/:payslipId
 * @access Super Admin, HR ONLY
 */
router.put(
  '/recalculate/:payslipId',
  protect,
  authorize('super-admin', 'hr'),
  autoPayrollController.recalculatePayslip
);

module.exports = router;
