// routes/autoPayrollRoutes.js
// Routes for automatic payroll generation based on attendance

const express = require('express');
const router = express.Router();
const autoPayrollController = require('../controllers/autoPayrollController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { can } = require('../utils/accessControl');

// Additive: hr/super-admin keep exactly what they had. Also allows any
// Position explicitly granted canManageSalary via Access Management.
const requireSalaryManage = async (req, res, next) => {
  if (await can(req.user, 'salary:manage')) return next();
  return authorize('super-admin', 'hr')(req, res, next);
};

router.get(
  '/preview/:userId/:payPeriod',
  protect,
  requireSalaryManage,
  autoPayrollController.previewSalaryCalculation
);

router.get(
  '/attendance-summary/:userId/:payPeriod',
  protect,
  requireSalaryManage,
  autoPayrollController.getAttendanceSummary
);

router.get(
  '/calculation-rules',
  protect,
  requireSalaryManage,
  autoPayrollController.getCalculationRules
);

router.get(
  '/compare/:userId/:payPeriod',
  protect,
  requireSalaryManage,
  autoPayrollController.compareCalculations
);

router.post(
  '/generate',
  protect,
  requireSalaryManage,
  autoPayrollController.generateSinglePayslip
);

router.post(
  '/generate-bulk',
  protect,
  requireSalaryManage,
  autoPayrollController.generateBulkPayslips
);

router.put(
  '/recalculate/:payslipId',
  protect,
  requireSalaryManage,
  autoPayrollController.recalculatePayslip
);

module.exports = router;
