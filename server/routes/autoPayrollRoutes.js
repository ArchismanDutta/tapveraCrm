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

// ── Payroll register ──────────────────────────────────────────────────
// The spreadsheet view: every employee for a month as one editable row.

router.get(
  '/register/:payPeriod',
  protect,
  requireSalaryManage,
  autoPayrollController.previewPayrollRegister
);

router.post(
  '/register/price',
  protect,
  requireSalaryManage,
  autoPayrollController.priceRegisterRows
);

router.post(
  '/register/generate',
  protect,
  requireSalaryManage,
  autoPayrollController.generateFromRegister
);

// Publishing. A payslip issued from the register is a draft until this runs,
// and a draft is invisible on the employee's own Payslips page.

router.post(
  '/register/publish',
  protect,
  requireSalaryManage,
  autoPayrollController.publishFromRegister
);

// Corrections made on the register, stored so they survive a reload.
// A change to paid days is a change to somebody's pay, so it is written down
// and attributed rather than kept in the browser.

router.put(
  '/register/override',
  protect,
  requireSalaryManage,
  autoPayrollController.saveRegisterOverride
);

router.delete(
  '/register/override',
  protect,
  requireSalaryManage,
  autoPayrollController.clearRegisterOverride
);

module.exports = router;
