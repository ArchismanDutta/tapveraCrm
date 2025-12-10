// controllers/autoPayrollController.js
// Controller for automatic payroll generation based on attendance

const AutoPayrollService = require('../services/AutoPayrollService');
const Payslip = require('../models/Payslip');
const { sendNotificationToUser } = require('../utils/websocket');

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

      // Check for perfect attendance and 6 months tenure
      const [year, month] = payPeriod.split('-').map(Number);
      const totalWorkingDaysExcludingWeekends = AutoPayrollService.getWorkingDaysExcludingWeekends(year, month);
      const hasPerfectAttendance = (result.payslip.paidDays >= totalWorkingDaysExcludingWeekends) &&
                                    (result.payslip.halfDays === 0);
      const hasCompletedSixMonths = AutoPayrollService.hasCompletedSixMonths(employee.doj, payPeriod);

      // Recalculate with manual values and bonus eligibility
      const calculations = AutoPayrollService.calculateSalaryBreakdown(
        monthlySalary,
        result.payslip.workingDays,
        result.payslip.paidDays,
        result.payslip.lateDays,
        result.payslip.halfDays,
        manualDeductions,
        hasPerfectAttendance,
        hasCompletedSixMonths
      );

      // Update payslip with new calculations
      result.payslip.bonuses = calculations.bonuses;
      result.payslip.salaryComponents = calculations.salaryComponents;
      result.payslip.grossComponents = calculations.grossComponents;
      result.payslip.grossTotal = calculations.grossTotal;
      result.payslip.deductions = calculations.deductions;
      result.payslip.totalDeductions = calculations.totalDeductions;
      result.payslip.employerContributions = calculations.employerContributions;
      result.payslip.netPayment = calculations.netPayment;
      result.payslip.ctc = calculations.ctc;
    }

    // Update remarks if provided
    if (remarks) {
      result.payslip.remarks = remarks;
    }

    await result.payslip.save();

    // Populate employee details
    await result.payslip.populate('employee', 'name employeeId email department designation');
    await result.payslip.populate('createdBy', 'name email');

    // Send notification to employee
    const notificationSent = sendNotificationToUser(employeeId.toString(), {
      channel: 'payslip',
      title: 'New Payslip Generated',
      message: `Your payslip for ${new Date(payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been generated automatically`,
      payPeriod: payPeriod,
      netPayment: result.calculations.netPayment,
      timestamp: Date.now(),
      action: 'view_payslip'
    });

    console.log(`Payslip notification sent to ${employeeId}: ${notificationSent ? 'Success' : 'User offline'}`);

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

    // Send notifications to all employees who got payslips
    const successfulGenerations = results.details.filter(d => d.status === 'success');
    for (const detail of successfulGenerations) {
      sendNotificationToUser(detail.employeeId.toString(), {
        channel: 'payslip',
        title: 'New Payslip Generated',
        message: `Your payslip for ${new Date(payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been generated automatically`,
        payPeriod: payPeriod,
        netPayment: detail.netPayment,
        timestamp: Date.now(),
        action: 'view_payslip'
      });
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

      // Check for perfect attendance and 6 months tenure
      const [year, month] = payPeriod.split('-').map(Number);
      const totalWorkingDaysExcludingWeekends = AutoPayrollService.getWorkingDaysExcludingWeekends(year, month);
      const hasPerfectAttendance = (result.payslip.paidDays >= totalWorkingDaysExcludingWeekends) &&
                                    (result.payslip.halfDays === 0);
      const hasCompletedSixMonths = AutoPayrollService.hasCompletedSixMonths(employee.doj, payPeriod);

      // Recalculate with manual values and bonus eligibility
      const calculations = AutoPayrollService.calculateSalaryBreakdown(
        monthlySalary,
        result.payslip.workingDays,
        result.payslip.paidDays,
        result.payslip.lateDays,
        result.payslip.halfDays,
        manualDeductions,
        hasPerfectAttendance,
        hasCompletedSixMonths
      );

      // Update payslip with new calculations
      result.payslip.bonuses = calculations.bonuses;
      result.payslip.salaryComponents = calculations.salaryComponents;
      result.payslip.grossComponents = calculations.grossComponents;
      result.payslip.grossTotal = calculations.grossTotal;
      result.payslip.deductions = calculations.deductions;
      result.payslip.totalDeductions = calculations.totalDeductions;
      result.payslip.employerContributions = calculations.employerContributions;
      result.payslip.netPayment = calculations.netPayment;
      result.payslip.ctc = calculations.ctc;
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

    // Send notification
    sendNotificationToUser(employeeId.toString(), {
      channel: 'payslip',
      title: 'Payslip Updated',
      message: `Your payslip for ${new Date(payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been recalculated`,
      payPeriod: payPeriod,
      netPayment: result.calculations.netPayment,
      timestamp: Date.now(),
      action: 'view_payslip'
    });

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
          description: '12% of basic salary (capped at ₹1800)',
          applicable: 'Only if basic salary ≤ ₹15,000'
        },
        esi: {
          description: '0.75% of gross total',
          applicable: 'Only if monthly salary ≤ ₹21,000'
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
          description: '50% of per-day salary per half-day'
        }
      },
      employerContributions: {
        employerPF: {
          description: '12% of basic salary (capped at ₹1800)',
          applicable: 'Only if basic salary ≤ ₹15,000'
        },
        employerESI: {
          description: '3.25% of gross total',
          applicable: 'Only if monthly salary ≤ ₹21,000'
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
        grossSalary: 'Sum of all salary components (prorated by paid days)',
        totalDeductions: 'Sum of all deductions',
        netPayment: 'Gross salary - Total deductions',
        ctc: 'Gross salary + Employer PF + Employer ESI'
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
          manual: manualPayslip.netPayment,
          automatic: autoPreview.calculations.netPayment,
          difference: autoPreview.calculations.netPayment - manualPayslip.netPayment
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
