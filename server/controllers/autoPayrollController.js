// controllers/autoPayrollController.js
// Controller for automatic payroll generation based on attendance

const AutoPayrollService = require('../services/AutoPayrollService');
const Payslip = require('../models/Payslip');
const PayrollOverride = require('../models/PayrollOverride');
const notificationService = require('../services/notificationService');

/**
 * Preview salary calculation for an employee without saving
 * GET /api/auto-payroll/preview/:userId/:payPeriod
 */
exports.previewSalaryCalculation = async (req, res) => {
  try {
    const { userId, payPeriod } = req.params;
    const manualDeductions = req.query.manualDeductions ? JSON.parse(req.query.manualDeductions) : {};

    const preview = await AutoPayrollService.previewSalaryCalculation(
      userId,
      payPeriod,
      manualDeductions
    );

    res.json({
      success: true,
      message: 'Salary calculation preview generated successfully',
      data: preview
    });
  } catch (error) {
    console.error('Error generating salary preview:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Generate automatic payslip for a single employee
 * POST /api/auto-payroll/generate
 */
exports.generateSinglePayslip = async (req, res) => {
  try {
    const {
      employeeId,
      payPeriod,
      workingDays,
      paidDays,
      lateDays,
      halfDays,
      manualDeductions = {},
      remarks
    } = req.body;

    // Validate required fields
    if (!employeeId || !payPeriod) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID and pay period are required'
      });
    }

    // Validate pay period format
    const payPeriodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!payPeriodRegex.test(payPeriod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pay period format. Use YYYY-MM'
      });
    }

    // Check if payslip already exists
    const existingPayslip = await Payslip.findOne({
      employee: employeeId,
      payPeriod
    });

    if (existingPayslip) {
      return res.status(409).json({
        success: false,
        error: 'Payslip already exists for this employee and period',
        payslipId: existingPayslip._id
      });
    }

    // Generate payslip
    const result = await AutoPayrollService.generateAutoPayslip(
      employeeId,
      payPeriod,
      manualDeductions,
      req.user._id
    );

    // Apply manual attendance overrides if provided
    if (workingDays !== undefined && workingDays !== null) {
      result.payslip.workingDays = Number(workingDays);
    }
    if (paidDays !== undefined && paidDays !== null) {
      result.payslip.paidDays = Number(paidDays);
    }
    if (lateDays !== undefined && lateDays !== null) {
      result.payslip.lateDays = Number(lateDays);
    }
    if (halfDays !== undefined && halfDays !== null) {
      result.payslip.halfDays = Number(halfDays);
    }

    // If any attendance fields were overridden, recalculate salary
    if (workingDays !== undefined || paidDays !== undefined || lateDays !== undefined || halfDays !== undefined) {
      const User = require('../models/User');
      const employee = await User.findById(employeeId).lean();
      const monthlySalary = AutoPayrollService.getMonthlySalary(employee);

      // Recalculate with manual values
      // CRITICAL FIX (2026-07-31): Pass lwp (unpaidLeaveDays) to enable LWP deduction
      const calculations = AutoPayrollService.calculateSalaryBreakdown(
        monthlySalary,
        result.payslip.workingDays,
        result.payslip.paidDays,
        result.payslip.lateDays,
        result.payslip.halfDays,
        result.payslip.lwp || 0,
        manualDeductions,
        result.payslip.absentDays || 0
      );

      // Update payslip with new calculations, mapped onto the schema shape
      Object.assign(
        result.payslip,
        AutoPayrollService.mapCalculationsToPayslip(calculations)
      );
    }

    // Update remarks if provided
    if (remarks) {
      result.payslip.remarks = remarks;
    }

    await result.payslip.save();

    // Populate employee details
    await result.payslip.populate('employee', 'name employeeId email department designation');
    await result.payslip.populate('createdBy', 'name email');

    // Send notification to employee (persisted + real-time)
    notificationService
      .notifyUser({
        userId: employeeId.toString(),
        type: 'payslip',
        channel: 'payslip',
        title: 'New Payslip Generated',
        body: `Your payslip for ${new Date(payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been generated automatically`,
        relatedData: { payslipId: result.payslip._id, url: '/my-payslips' },
      })
      .catch((err) => console.error('Payslip-generated notification failed:', err));

    res.status(201).json({
      success: true,
      message: 'Payslip generated successfully',
      payslip: result.payslip,
      attendanceData: result.attendanceData,
      calculations: result.calculations
    });
  } catch (error) {
    console.error('Error generating payslip:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Generate payslips for all employees (bulk generation)
 * POST /api/auto-payroll/generate-bulk
 */
exports.generateBulkPayslips = async (req, res) => {
  try {
    const {
      payPeriod,
      employeeIds = null,
      skipExisting = true
    } = req.body;

    // Validate required fields
    if (!payPeriod) {
      return res.status(400).json({
        success: false,
        error: 'Pay period is required'
      });
    }

    // Validate pay period format
    const payPeriodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!payPeriodRegex.test(payPeriod)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pay period format. Use YYYY-MM'
      });
    }

    // Generate payslips
    const results = await AutoPayrollService.generateBulkPayslips(
      payPeriod,
      req.user._id,
      { skipExisting, employeeIds }
    );

    // Send notifications to all employees who got payslips (one persisted
    // row per employee via notifyUsers, instead of N unpersisted WS pings)
    const successfulGenerations = results.details.filter(d => d.status === 'success');
    if (successfulGenerations.length) {
      notificationService
        .notifyUsers(
          successfulGenerations.map((d) => d.employeeId.toString()),
          {
            type: 'payslip',
            channel: 'payslip',
            title: 'New Payslip Generated',
            body: `Your payslip for ${new Date(payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been generated automatically`,
            relatedData: { url: '/my-payslips' },
          }
        )
        .catch((err) => console.error('Bulk payslip notification failed:', err));
    }

    res.status(200).json({
      success: true,
      message: `Bulk payslip generation completed`,
      results
    });
  } catch (error) {
    console.error('Error in bulk payslip generation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get attendance summary for payroll calculation
 * GET /api/auto-payroll/attendance-summary/:userId/:payPeriod
 */
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { userId, payPeriod } = req.params;

    const attendanceData = await AutoPayrollService.fetchAttendanceForMonth(userId, payPeriod);

    res.json({
      success: true,
      data: attendanceData
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Recalculate and update existing payslip
 * PUT /api/auto-payroll/recalculate/:payslipId
 */
exports.recalculatePayslip = async (req, res) => {
  try {
    const { payslipId } = req.params;
    const {
      manualDeductions = {},
      remarks,
      workingDays,
      paidDays,
      lateDays,
      halfDays
    } = req.body;

    // Find existing payslip
    const payslip = await Payslip.findById(payslipId);
    if (!payslip) {
      return res.status(404).json({
        success: false,
        error: 'Payslip not found'
      });
    }

    const employeeId = payslip.employee;
    const payPeriod = payslip.payPeriod;

    // Regenerate with updated data
    const result = await AutoPayrollService.generateAutoPayslip(
      employeeId,
      payPeriod,
      manualDeductions,
      req.user._id
    );

    // Delete old payslip
    await Payslip.findByIdAndDelete(payslipId);

    // Apply manual overrides if provided
    if (workingDays !== undefined && workingDays !== null) {
      result.payslip.workingDays = Number(workingDays);
    }
    if (paidDays !== undefined && paidDays !== null) {
      result.payslip.paidDays = Number(paidDays);
    }
    if (lateDays !== undefined && lateDays !== null) {
      result.payslip.lateDays = Number(lateDays);
    }
    if (halfDays !== undefined && halfDays !== null) {
      result.payslip.halfDays = Number(halfDays);
    }

    // If any attendance fields were overridden, recalculate salary
    if (workingDays !== undefined || paidDays !== undefined || lateDays !== undefined || halfDays !== undefined) {
      const User = require('../models/User');
      const employee = await User.findById(employeeId).lean();
      const monthlySalary = AutoPayrollService.getMonthlySalary(employee);

      // Recalculate with manual values
      // CRITICAL FIX (2026-07-31): Pass lwp (unpaidLeaveDays) to enable LWP deduction
      const calculations = AutoPayrollService.calculateSalaryBreakdown(
        monthlySalary,
        result.payslip.workingDays,
        result.payslip.paidDays,
        result.payslip.lateDays,
        result.payslip.halfDays,
        result.payslip.lwp || 0,
        manualDeductions,
        result.payslip.absentDays || 0
      );

      // Update payslip with new calculations, mapped onto the schema shape
      Object.assign(
        result.payslip,
        AutoPayrollService.mapCalculationsToPayslip(calculations)
      );
    }

    // Update remarks if provided
    if (remarks) {
      result.payslip.remarks = remarks;
    } else {
      result.payslip.remarks = 'Recalculated and manually adjusted';
    }
    await result.payslip.save();

    // Populate employee details
    await result.payslip.populate('employee', 'name employeeId email department designation');
    await result.payslip.populate('createdBy', 'name email');

    // Send notification (persisted + real-time)
    notificationService
      .notifyUser({
        userId: employeeId.toString(),
        type: 'payslip',
        channel: 'payslip',
        title: 'Payslip Updated',
        body: `Your payslip for ${new Date(payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been recalculated`,
        relatedData: { payslipId: result.payslip._id, url: '/my-payslips' },
      })
      .catch((err) => console.error('Payslip-updated notification failed:', err));

    res.json({
      success: true,
      message: 'Payslip recalculated successfully',
      payslip: result.payslip,
      attendanceData: result.attendanceData,
      calculations: result.calculations
    });
  } catch (error) {
    console.error('Error recalculating payslip:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get payroll calculation rules and constants
 * GET /api/auto-payroll/calculation-rules
 */
/**
 * The payroll register for a month — every employee as one row.
 * GET /api/auto-payroll/register/:payPeriod
 */
exports.previewPayrollRegister = async (req, res) => {
  try {
    const { payPeriod } = req.params;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payPeriod)) {
      return res.status(400).json({ success: false, error: 'Invalid pay period format. Use YYYY-MM' });
    }

    const employeeIds = req.query.employeeIds
      ? String(req.query.employeeIds).split(',').filter(Boolean)
      : null;

    const register = await AutoPayrollService.previewPayrollRegister(payPeriod, { employeeIds });
    res.json({ success: true, ...register });
  } catch (error) {
    console.error('Error building payroll register:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Re-price edited register rows.
 *
 * Pure calculation, no database access — the same formula the register was
 * built with and the same one that will generate the payslips, so an edited
 * cell can never show a figure that generation would not produce.
 *
 * POST /api/auto-payroll/register/price
 */
exports.priceRegisterRows = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows must be a non-empty array' });
    }
    if (rows.length > 500) {
      return res.status(400).json({ success: false, error: 'Too many rows in one request (max 500)' });
    }

    const priced = rows.map((row) => ({
      employeeId: row.employeeId,
      ...AutoPayrollService.priceRegisterRow(row.inputs || {}),
    }));

    res.json({ success: true, rows: priced });
  } catch (error) {
    console.error('Error pricing register rows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Issue payslips from the edited register.
 * POST /api/auto-payroll/register/generate
 */
exports.generateFromRegister = async (req, res) => {
  try {
    const { payPeriod, rows, skipExisting = true } = req.body;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payPeriod || '')) {
      return res.status(400).json({ success: false, error: 'Invalid pay period format. Use YYYY-MM' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, error: 'rows must be a non-empty array' });
    }

    const results = { generated: 0, skipped: 0, failed: 0, details: [] };

    for (const row of rows) {
      const employeeId = row.employeeId;
      try {
        const existing = await Payslip.findOne({ employee: employeeId, payPeriod });
        if (existing && skipExisting) {
          results.skipped++;
          results.details.push({ employeeId, status: 'skipped', reason: 'Payslip already exists' });
          continue;
        }
        if (existing) await Payslip.deleteOne({ _id: existing._id });

        const payslip = await AutoPayrollService.generatePayslipFromRegisterRow(
          employeeId,
          payPeriod,
          row.inputs || {},
          req.user._id
        );

        results.generated++;
        results.details.push({ employeeId, status: 'generated', payslipId: payslip._id, netSalary: payslip.netSalary });
      } catch (error) {
        results.failed++;
        results.details.push({ employeeId, status: 'failed', error: error.message });
      }
    }

    res.status(201).json({ success: true, payPeriod, ...results });
  } catch (error) {
    console.error('Error generating from register:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCalculationRules = async (req, res) => {
  try {
    const rules = {
      salaryComponents: {
        basic: '50% of monthly salary',
        hra: '35% of monthly salary',
        conveyance: '5% of monthly salary',
        medical: '5% of monthly salary',
        specialAllowance: '5% of monthly salary'
      },
      deductions: {
        employeePF: {
          description: 'Min(1800, Basic Paid x 12%)',
          applicable: 'Only if basic salary ≤ ₹15,000'
        },
        esi: {
          description: 'Net Total x 0.75%',
          applicable: 'Only if Gross Total ≤ ₹21,000'
        },
        ptax: {
          description: 'Professional Tax based on salary slabs',
          slabs: [
            { range: '< ₹10,000', tax: '₹0' },
            { range: '₹10,000 - ₹15,000', tax: '₹110' },
            { range: '₹15,001 - ₹25,000', tax: '₹130' },
            { range: '₹25,001 - ₹40,000', tax: '₹150' },
            { range: '> ₹40,000', tax: '₹200' }
          ]
        },
        lateDeduction: {
          includedInFormula: false,
          description: 'Deduction for late arrivals',
          rules: [
            'First 2 late days: No deduction',
            'Every 3 lates: 1 day salary deduction',
            'Extra lates (not in multiples of 3): ₹200 per late'
          ],
          examples: [
            { lates: '0-2', deduction: 'No deduction' },
            { lates: '3', deduction: '1 day salary' },
            { lates: '4', deduction: '1 day salary + ₹200' },
            { lates: '5', deduction: '1 day salary + ₹400' },
            { lates: '6', deduction: '2 days salary' }
          ]
        },
        halfDayDeduction: {
          includedInFormula: false,
          description: '50% of per-day salary per half-day'
        }
      },
      employerContributions: {
        employerPF: {
          description: 'Same as Employee PF',
          applicable: 'Only if basic salary ≤ ₹15,000'
        },
        employerESI: {
          description: 'Net Total x 3.25%',
          applicable: 'Only if Gross Total ≤ ₹21,000'
        }
      },
      workingDays: {
        calculation: 'Total number of days in the month (including all days - weekends, holidays, etc.)',
        note: 'Working days = Total calendar days in the month'
      },
      leaveRules: {
        paidLeave: 'Full day salary credited (no deduction)',
        unpaidLeave: 'One day salary deduction (no payment for the day)',
        halfDay: 'Half of daily salary deducted (50% deduction)',
        workFromHome: 'Full day salary credited (no deduction)'
      },
      calculations: {
        grossTotal: 'Basic + HRA + Conveyance + Medical + Special Allowance',
        paidComponent: 'Component / Days x Paid Days',
        netTotal: 'Sum of paid components',
        totalDeductions: 'PF + ESI + TDS + PTax + Other + Advance',
        netPayment: 'Net Total - Total Deduction',
        ctc: 'Total Deduction + Net Salary + Employer PF + Employer ESI'
      }
    };

    res.json({
      success: true,
      rules
    });
  } catch (error) {
    console.error('Error fetching calculation rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Compare automatic vs manual payslip calculations
 * GET /api/auto-payroll/compare/:userId/:payPeriod
 */
exports.compareCalculations = async (req, res) => {
  try {
    const { userId, payPeriod } = req.params;

    // Get existing manual payslip if exists
    const manualPayslip = await Payslip.findOne({
      employee: userId,
      payPeriod
    }).lean();

    // Generate automatic calculation preview
    const autoPreview = await AutoPayrollService.previewSalaryCalculation(userId, payPeriod);

    const comparison = {
      manual: manualPayslip || null,
      automatic: autoPreview,
      differences: null
    };

    if (manualPayslip) {
      comparison.differences = {
        paidDays: {
          manual: manualPayslip.paidDays,
          automatic: autoPreview.attendanceData.paidDays,
          difference: autoPreview.attendanceData.paidDays - manualPayslip.paidDays
        },
        lateDays: {
          manual: manualPayslip.lateDays || 0,
          automatic: autoPreview.attendanceData.lateDays,
          difference: autoPreview.attendanceData.lateDays - (manualPayslip.lateDays || 0)
        },
        halfDays: {
          manual: manualPayslip.halfDays || 0,
          automatic: autoPreview.attendanceData.halfDays,
          difference: autoPreview.attendanceData.halfDays - (manualPayslip.halfDays || 0)
        },
        netPayment: {
          // .lean() skips virtuals, so read the stored field directly
          manual: manualPayslip.netSalary || 0,
          automatic: autoPreview.calculations.netPayment,
          difference: autoPreview.calculations.netPayment - (manualPayslip.netSalary || 0)
        }
      };
    }

    res.json({
      success: true,
      comparison
    });
  } catch (error) {
    console.error('Error comparing calculations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Save a correction made on the payroll register.
 * PUT /api/auto-payroll/register/override
 *
 * Body: { payPeriod, employeeId, inputs: { paidDays: 21, ... }, note? }
 *
 * Merges the given fields into whatever is already stored, so the register can
 * send one field at a time as cells are edited. A field sent as null or "" is
 * cleared and goes back to being derived from attendance; when the last field
 * is cleared the whole document is removed rather than left as an empty
 * override that looks like a correction but changes nothing.
 */
exports.saveRegisterOverride = async (req, res) => {
  try {
    const { payPeriod, employeeId, inputs = {}, note } = req.body;

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payPeriod || '')) {
      return res.status(400).json({ success: false, error: 'Invalid pay period format. Use YYYY-MM' });
    }
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'employeeId is required' });
    }

    const { inputs: clean, cleared } = PayrollOverride.sanitiseInputs(inputs);
    if (!Object.keys(clean).length && !cleared.length) {
      return res.status(400).json({ success: false, error: 'No recognised fields to override' });
    }

    const existing = await PayrollOverride.findOne({ employee: employeeId, payPeriod });
    const merged = { ...((existing && existing.inputs) || {}), ...clean };
    for (const field of cleared) delete merged[field];

    // Nothing left to override — remove it rather than storing an empty one.
    if (!Object.keys(merged).length) {
      if (existing) await PayrollOverride.deleteOne({ _id: existing._id });
      return res.json({ success: true, payPeriod, employeeId, inputs: {}, cleared: true });
    }

    const saved = await PayrollOverride.findOneAndUpdate(
      { employee: employeeId, payPeriod },
      {
        $set: {
          inputs: merged,
          updatedBy: req.user._id,
          updatedByName: req.user.name || '',
          ...(note !== undefined ? { note: String(note || '') } : {}),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      success: true,
      payPeriod,
      employeeId,
      inputs: saved.inputs,
      updatedByName: saved.updatedByName,
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    console.error('Error saving register override:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Drop every correction for one employee and month, so the row goes back to
 * being derived from attendance.
 * DELETE /api/auto-payroll/register/override
 */
exports.clearRegisterOverride = async (req, res) => {
  try {
    const { payPeriod, employeeId } = { ...req.body, ...req.query };

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payPeriod || '')) {
      return res.status(400).json({ success: false, error: 'Invalid pay period format. Use YYYY-MM' });
    }
    if (!employeeId) {
      return res.status(400).json({ success: false, error: 'employeeId is required' });
    }

    const result = await PayrollOverride.deleteOne({ employee: employeeId, payPeriod });
    res.json({ success: true, payPeriod, employeeId, removed: result.deletedCount > 0 });
  } catch (error) {
    console.error('Error clearing register override:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
