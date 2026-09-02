// services/AutoPayrollService.js
// Automatic Payroll Service - Fetches attendance data and calculates salary automatically

const User = require("../models/User");
const Payslip = require("../models/Payslip");
// Attendance counting lives in one place now; this service only turns the
// resulting figures into money.
const AttendanceSummaryService = require("./AttendanceSummaryService");

class AutoPayrollService {
  constructor() {
    // Salary component percentages
    this.SALARY_PERCENTAGES = {
      BASIC: 0.5, // 50%
      HRA: 0.35, // 35%
      CONVEYANCE: 0.05, // 5%
      MEDICAL: 0.05, // 5%
      SPECIAL_ALLOWANCE: 0.05, // 5%
    };

    // Deduction constants
    this.DEDUCTION_CONSTANTS = {
      PF_RATE: 0.12, // 12%
      PF_CAP: 1800, // Max PF deduction
      PF_BASIC_LIMIT: 15000, // Basic salary limit for PF
      ESI_EMPLOYEE_RATE: 0.0075, // 0.75%
      ESI_EMPLOYER_RATE: 0.0325, // 3.25%
      ESI_SALARY_LIMIT: 21000, // Salary limit for ESI
      LATE_FREE_DAYS: 2, // First 2 lates are free
      LATE_CYCLE: 3, // Every 3 lates = 1 day deduction
      EXTRA_LATE_PENALTY: 200, // ₹200 per extra late
      HALF_DAY_DEDUCTION_RATE: 0.5, // 50% of day salary
    };

    // Professional Tax slabs
    this.PTAX_SLABS = [
      { min: 0, max: 9999, tax: 0 },
      { min: 10000, max: 15000, tax: 110 },
      { min: 15001, max: 25000, tax: 130 },
      { min: 25001, max: 40000, tax: 150 },
      { min: 40001, max: Infinity, tax: 200 },
    ];
  }

  /**
   * Get monthly salary from employee object - handles multiple formats
   * @param {Object} employee
   * @returns {number} Monthly salary
   */
  getMonthlySalary(employee) {
    if (!employee || !employee.salary) {
      console.warn("Employee or salary is undefined:", employee);
      return 0;
    }

    // If salary is just a number
    if (typeof employee.salary === "number") {
      console.log(`💰 Salary is a number: ${employee.salary}`);
      return employee.salary;
    }

    // If salary is an object, try different possible fields
    if (typeof employee.salary === "object") {
      // Try common field names in order of preference
      if (employee.salary.total && typeof employee.salary.total === "number") {
        console.log(`💰 Using salary.total: ${employee.salary.total}`);
        return employee.salary.total;
      }

      if (
        employee.salary.monthly &&
        typeof employee.salary.monthly === "number"
      ) {
        console.log(`💰 Using salary.monthly: ${employee.salary.monthly}`);
        return employee.salary.monthly;
      }

      if (employee.salary.gross && typeof employee.salary.gross === "number") {
        console.log(`💰 Using salary.gross: ${employee.salary.gross}`);
        return employee.salary.gross;
      }

      if (employee.salary.basic && typeof employee.salary.basic === "number") {
        console.log(`💰 Using salary.basic: ${employee.salary.basic}`);
        return employee.salary.basic;
      }

      // If none of the above, try to find the largest numeric value
      const salaryValues = Object.entries(employee.salary)
        .filter(([key, val]) => typeof val === "number" && val > 0)
        .map(([key, val]) => ({ key, val }));

      if (salaryValues.length > 0) {
        const maxSalary = salaryValues.reduce((max, curr) =>
          curr.val > max.val ? curr : max
        );
        console.log(
          `💰 Using maximum salary value from ${maxSalary.key}: ${maxSalary.val}`
        );
        return maxSalary.val;
      }

      console.warn(
        "⚠️ Salary object has no valid numeric fields:",
        employee.salary
      );
    }

    console.warn("⚠️ Could not determine monthly salary, defaulting to 0");
    return 0;
  }

  /**
   * Get working days in a month (total days in the month)
   * @param {number} year
   * @param {number} month (1-12)
   * @returns {number} Total working days (all days in month)
   */
  getWorkingDaysInMonth(year, month) {
    // Return total number of days in the month (including all days)
    const daysInMonth = new Date(year, month, 0).getDate();
    return daysInMonth;
  }

  /**
   * Fetch attendance data for an employee for a specific month.
   *
   * The counting itself lives in AttendanceSummaryService, which the
   * attendance screens read too. Payroll and the attendance page have to
   * agree about what a month looked like, and the only way to guarantee that
   * is for there to be a single calculation. This method adapts the canonical
   * summary to the field names the rest of the payroll pipeline and the admin
   * payroll screen already use.
   *
   * @param {string} userId - Employee ID
   * @param {string} payPeriod - Format: "YYYY-MM"
   * @returns {Object} Attendance summary
   */
  async fetchAttendanceForMonth(userId, payPeriod) {
    const summary = await AttendanceSummaryService.getMonthlySummary(userId, payPeriod);

    console.log(`\u2705 Attendance summary for ${userId} \u2014 ${payPeriod}:`);
    console.log(
      `   ${summary.daysInMonth} days in month (${summary.weekendDays} weekend, ${summary.holidayDays} holiday \u2014 all paid)`
    );
    console.log(`   Expected working days: ${summary.expectedWorkingDays}`);
    console.log(
      `   Present ${summary.presentDays} | Half days ${summary.halfDays} | WFH ${summary.wfhDays}`
    );
    console.log(
      `   Paid leave ${summary.paidLeaveDays} | Unpaid leave ${summary.unpaidLeaveDays}`
    );
    console.log(`   Absent (unexcused) ${summary.absentDays} | Late ${summary.lateDays}`);
    console.log(
      `   Break-policy flagged ${summary.breakPolicyFlaggedDays} (not deducted)`
    );
    console.log(`   => Paid days ${summary.paidDays} of ${summary.daysInMonth}`);

    if (summary.upcomingDays > 0) {
      console.warn(
        `\u26a0\ufe0f  ${payPeriod} has not finished \u2014 ${summary.upcomingDays} day(s) have not happened yet and earn nothing.`
      );
    }
    if (summary.absentDays > summary.expectedWorkingDays * 0.5) {
      console.warn(
        `\u26a0\ufe0f  ${summary.absentDays} of ${summary.expectedWorkingDays} working days have neither attendance nor approved leave for ${userId}. Verify the attendance data before issuing this payslip.`
      );
    }

    return {
      // The canonical summary, for anything that wants the full picture
      // (including the per-day breakdown in `days`).
      ...summary,

      // Payroll-facing names. workingDays is the proration divisor, which is
      // every day of the month \u2014 see calculateSalaryBreakdown.
      workingDays: summary.daysInMonth,
      fullDays: summary.presentDays,
      totalWorkingDaysExcludingWeekends: summary.expectedWorkingDays,
      attendanceDetails: summary.days,

      summary: {
        totalDays: summary.daysInMonth,
        paidDays: summary.paidDays,
        unpaidDays: Math.round((summary.daysInMonth - summary.paidDays) * 100) / 100,
        absentDays: summary.absentDays,
        lateCount: summary.lateDays,
        halfDayCount: summary.halfDays,
        // Half days are already counted at 0.5 in paidDays.
        effectivePaidDays: summary.paidDays,
      },
    };
  }

  /**
   * Get working days in a month excluding weekends (Saturday & Sunday)
   * @param {number} year
   * @param {number} month (1-12)
   * @returns {number} Working days count
   */
  getWorkingDaysExcludingWeekends(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      // Monday = 1, Friday = 5 (exclude Saturday = 6, Sunday = 0)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
    }

    return workingDays;
  }

  /**
   * Get count of weekend days (Saturday & Sunday) in a month
   * @param {number} year
   * @param {number} month (1-12)
   * @returns {number} Weekend days count
   */
  getWeekendDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let weekendDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      // Saturday = 6, Sunday = 0
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendDays++;
      }
    }

    return weekendDays;
  }

  /**
   * Check if employee has completed 6 months from joining date
   * @param {Date} joiningDate - Employee's date of joining (doj)
   * @param {string} payPeriod - Pay period in format "YYYY-MM"
   * @returns {boolean} True if completed 6 months
   */
  hasCompletedSixMonths(joiningDate, payPeriod) {
    if (!joiningDate) {
      return false;
    }

    const doj = new Date(joiningDate);
    const [year, month] = payPeriod.split("-").map(Number);
    // Get the last day of the pay period month
    const payPeriodEndDate = new Date(year, month, 0); // Last day of the month

    // Calculate 6 months from joining date
    const sixMonthsAfterJoining = new Date(doj);
    sixMonthsAfterJoining.setMonth(sixMonthsAfterJoining.getMonth() + 6);

    // Employee has completed 6 months if the pay period end date is >= 6 months after joining
    return payPeriodEndDate >= sixMonthsAfterJoining;
  }

  /**
   * Calculate Professional Tax based on salary
   * @param {number} monthlySalary
   * @returns {number} PTax amount
   */
  calculatePTax(monthlySalary) {
    for (const slab of this.PTAX_SLABS) {
      if (monthlySalary >= slab.min && monthlySalary <= slab.max) {
        return slab.tax;
      }
    }
    return 0;
  }

  /**
   * Calculate late deductions based on late days
   * @param {number} lateDays
   * @param {number} perDaySalary
   * @returns {number} Late deduction amount
   */
  calculateLateDeduction(lateDays, perDaySalary) {
    if (lateDays < this.DEDUCTION_CONSTANTS.LATE_FREE_DAYS + 1) {
      return 0;
    }

    const fullLateCycles = Math.floor(
      lateDays / this.DEDUCTION_CONSTANTS.LATE_CYCLE
    );
    const extraLates = lateDays % this.DEDUCTION_CONSTANTS.LATE_CYCLE;

    return (
      fullLateCycles * perDaySalary +
      extraLates * this.DEDUCTION_CONSTANTS.EXTRA_LATE_PENALTY
    );
  }

  /**
   * Calculate complete salary breakdown with all deductions
   *
   * CRITICAL FIX (2026-07-31): Added unpaidLeaveDays parameter to calculate LWP deduction
   *
   * @param {number} monthlySalary
   * @param {number} workingDays
   * @param {number} paidDays
   * @param {number} lateDays
   * @param {number} halfDays
   * @param {number} unpaidLeaveDays - Leave Without Pay days (will be deducted)
   * @param {Object} manualDeductions
   * @returns {Object} Complete salary calculation
   */
  calculateSalaryBreakdown(
    monthlySalary,
    workingDays,
    paidDays,
    lateDays,
    halfDays,
    unpaidLeaveDays = 0,
    manualDeductions = {}
  ) {
    const safeWorkingDays = workingDays > 0 ? workingDays : 1;

    // Step 1: Calculate salary components (monthly breakdown)
    const salaryComponents = {
      basic: monthlySalary * this.SALARY_PERCENTAGES.BASIC,
      hra: monthlySalary * this.SALARY_PERCENTAGES.HRA,
      conveyance: monthlySalary * this.SALARY_PERCENTAGES.CONVEYANCE,
      medical: monthlySalary * this.SALARY_PERCENTAGES.MEDICAL,
      specialAllowance:
        monthlySalary * this.SALARY_PERCENTAGES.SPECIAL_ALLOWANCE,
    };

    // Step 2: Calculate gross total before attendance proration.
    const grossTotal = Object.values(salaryComponents).reduce(
      (sum, val) => sum + val,
      0
    );

    // Step 3: Calculate paid components (component / days * paid days).
    const grossComponents = {
      basic: (salaryComponents.basic / safeWorkingDays) * paidDays,
      hra: (salaryComponents.hra / safeWorkingDays) * paidDays,
      conveyance: (salaryComponents.conveyance / safeWorkingDays) * paidDays,
      medical: (salaryComponents.medical / safeWorkingDays) * paidDays,
      specialAllowance:
        (salaryComponents.specialAllowance / safeWorkingDays) * paidDays,
    };

    // Step 4: Calculate net total (sum of paid components).
    const netTotal = Object.values(grossComponents).reduce(
      (sum, val) => sum + val,
      0
    );

    // Step 5: Check statutory eligibility.
    const pfEligible =
      salaryComponents.basic <= this.DEDUCTION_CONSTANTS.PF_BASIC_LIMIT;
    const esiApplicable =
      grossTotal <= this.DEDUCTION_CONSTANTS.ESI_SALARY_LIMIT;

    // Step 6: Calculate deductions.
    //
    // CRITICAL FIX (2026-07-31): Added LWP (Leave Without Pay) deduction
    // LWP deduction = (Monthly Salary / Working Days) × Unpaid Leave Days
    //
    const lwpDeduction = unpaidLeaveDays > 0
      ? (monthlySalary / safeWorkingDays) * unpaidLeaveDays
      : 0;

    const deductions = {
      // Employee PF
      employeePF: pfEligible
        ? Math.min(
            this.DEDUCTION_CONSTANTS.PF_CAP,
            grossComponents.basic * this.DEDUCTION_CONSTANTS.PF_RATE
          )
        : 0,

      // ESI
      esi: esiApplicable
        ? netTotal * this.DEDUCTION_CONSTANTS.ESI_EMPLOYEE_RATE
        : 0,

      // Professional Tax
      ptax: this.calculatePTax(monthlySalary),

      // LWP (Leave Without Pay) deduction
      // CRITICAL FIX (2026-07-31): This was previously always 0
      lwpDeduction: lwpDeduction,

      // Manual deductions
      tds: manualDeductions.tds || 0,
      other: manualDeductions.other || 0,
      advance: manualDeductions.advance || 0,

      // Late policy (DEDUCTION_CONSTANTS): the first LATE_FREE_DAYS lates
      // cost nothing, then every LATE_CYCLE lates costs a day's pay and each
      // leftover late costs EXTRA_LATE_PENALTY. calculateLateDeduction had
      // been written but never called, so lateDays was shown on payslips
      // while changing no money.
      lateDeduction: this.calculateLateDeduction(
        lateDays,
        monthlySalary / safeWorkingDays
      ),

      // Half days are already paid at half rate through paidDays, so
      // charging here as well would take the same half day twice.
      halfDayDeduction: 0,
    };

    // Step 7: Calculate employer contributions.
    const employerContributions = {
      employerPF: pfEligible
        ? Math.min(
            this.DEDUCTION_CONSTANTS.PF_CAP,
            grossComponents.basic * this.DEDUCTION_CONSTANTS.PF_RATE
          )
        : 0,
      employerESI: esiApplicable
        ? netTotal * this.DEDUCTION_CONSTANTS.ESI_EMPLOYER_RATE
        : 0,
    };

    // Step 8: Calculate totals using the requested formula.
    // CRITICAL FIX (2026-07-31): Added lwpDeduction to total deductions
    const totalDeductions =
      deductions.employeePF +
      deductions.esi +
      deductions.tds +
      deductions.ptax +
      deductions.lwpDeduction +
      deductions.lateDeduction +
      deductions.other +
      deductions.advance;
    const netPayment = netTotal - totalDeductions;
    const ctc =
      totalDeductions +
      netPayment +
      employerContributions.employerPF +
      employerContributions.employerESI;

    return {
      salaryComponents,
      grossComponents,
      paidComponents: grossComponents,
      grossTotal: Math.round(grossTotal * 100) / 100,
      netTotal: Math.round(netTotal * 100) / 100,
      eligibility: {
        pf: pfEligible,
        esi: esiApplicable,
      },
      bonuses: {
        perfectAttendanceBonus: 0,
      },
      deductions: {
        employeePF: Math.round(deductions.employeePF * 100) / 100,
        esi: Math.round(deductions.esi * 100) / 100,
        ptax: deductions.ptax,
        // Leave-without-pay: was counted in totalDeductions but never
        // returned, so it never showed up on the payslip breakdown.
        lwpDeduction: Math.round(deductions.lwpDeduction * 100) / 100,
        lateDeduction: Math.round(deductions.lateDeduction * 100) / 100,
        halfDayDeduction: Math.round(deductions.halfDayDeduction * 100) / 100,
        tds: deductions.tds,
        other: deductions.other,
        advance: deductions.advance,
      },
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      employerContributions: {
        employerPF: Math.round(employerContributions.employerPF * 100) / 100,
        employerESI: Math.round(employerContributions.employerESI * 100) / 100,
      },
      netPayment: Math.round(netPayment * 100) / 100,
      ctc: Math.round(ctc * 100) / 100,
    };
  }

  /**
   * Map a calculateSalaryBreakdown() result onto the Payslip schema shape.
   *
   * The calculation object keeps the names the payroll preview UI expects
   * (netPayment / grossComponents / eligibility / deductions.esi); the
   * stored document uses the schema's names (netSalary / paidComponents /
   * pfEligible / esiEligible / deductions.employeeESI). Without this map,
   * Mongoose strips the unknown keys and rejects the save because the
   * required netSalary is missing.
   *
   * @param {Object} calculations - Output of calculateSalaryBreakdown()
   * @returns {Object} Payslip-schema-shaped fields
   */
  mapCalculationsToPayslip(calculations = {}) {
    const d = calculations.deductions || {};
    const eligibility = calculations.eligibility || {};

    return {
      salaryComponents: calculations.salaryComponents,
      paidComponents: calculations.paidComponents || calculations.grossComponents,
      grossTotal: calculations.grossTotal,
      netTotal: calculations.netTotal,
      pfEligible: Boolean(eligibility.pf),
      esiEligible: Boolean(eligibility.esi),
      deductions: {
        employeePF: d.employeePF || 0,
        employeeESI: d.employeeESI != null ? d.employeeESI : (d.esi || 0),
        ptax: d.ptax || 0,
        tds: d.tds || 0,
        advance: d.advance || 0,
        lwpDeduction: d.lwpDeduction || 0,
        lateDeduction: d.lateDeduction || 0,
        halfDayDeduction: d.halfDayDeduction || 0,
        other: d.other || 0,
        otherLabel: d.otherLabel || "",
      },
      totalDeductions: calculations.totalDeductions,
      employerContributions: calculations.employerContributions,
      netSalary: calculations.netSalary != null ? calculations.netSalary : calculations.netPayment,
      ctc: calculations.ctc,
    };
  }

  /**
   * Snapshot the employee's statutory details at generation time, so a
   * later profile edit never rewrites an already-issued payslip.
   * @param {Object} employee - User document
   * @returns {Object} employeeSnapshot
   */
  buildEmployeeSnapshot(employee = {}) {
    return {
      name: employee.name || "",
      employeeId: employee.employeeId || "",
      designation: employee.designation || "",
      department: employee.department || "",
      location: employee.location || "",
      doj: employee.doj,
      pan: employee.pan || "",
      uan: employee.uan || "",
      pfNumber: employee.pfNumber || "",
      esiNumber: employee.esiNumber || "",
      bankAccountNumber: employee.bankAccountNumber || "",
      bankName: employee.bankName || "",
      ifscCode: employee.ifscCode || "",
    };
  }

  /**
   * Generate automatic payslip for an employee
   * @param {string} userId - Employee ID
   * @param {string} payPeriod - Format: "YYYY-MM"
   * @param {Object} manualDeductions - Optional manual deductions
   * @param {string} createdBy - Admin user ID
   * @returns {Object} Generated payslip
   */
  async generateAutoPayslip(
    userId,
    payPeriod,
    manualDeductions = {},
    createdBy
  ) {
    console.log(
      `🚀 Starting automatic payslip generation for ${userId} - ${payPeriod}`
    );

    // Step 1: Fetch employee data
    const employee = await User.findById(userId).lean();
    if (!employee) {
      throw new Error("Employee not found");
    }

    const monthlySalary = this.getMonthlySalary(employee);
    if (monthlySalary <= 0) {
      throw new Error("Employee salary not configured or is zero");
    }

    console.log(`💰 Employee salary: ₹${monthlySalary}`);

    // Step 2: Fetch attendance data
    const attendanceData = await this.fetchAttendanceForMonth(
      userId,
      payPeriod
    );
    console.log(`📊 Attendance data:`, {
      workingDays: attendanceData.workingDays,
      paidDays: attendanceData.paidDays,
      lateDays: attendanceData.lateDays,
      halfDays: attendanceData.halfDays,
      hasPerfectAttendance: attendanceData.hasPerfectAttendance,
    });

    // Step 2.5: Check if employee has completed 6 months
    const hasCompletedSixMonths = this.hasCompletedSixMonths(
      employee.doj,
      payPeriod
    );
    console.log(`📅 Employee tenure check:`, {
      joiningDate: employee.doj,
      hasCompleted6Months: hasCompletedSixMonths,
      hasPerfectAttendance: attendanceData.hasPerfectAttendance,
      eligibleForBonus:
        hasCompletedSixMonths && attendanceData.hasPerfectAttendance,
    });

    // Step 3: Calculate salary with bonus eligibility
    // CRITICAL FIX (2026-07-31): Pass unpaidLeaveDays to enable LWP deduction
    const calculations = this.calculateSalaryBreakdown(
      monthlySalary,
      attendanceData.workingDays,
      attendanceData.paidDays,
      attendanceData.lateDays,
      attendanceData.halfDays,
      attendanceData.unpaidLeaveDays,
      manualDeductions
    );

    console.log(
      `✅ Salary calculated - Net Payment: ₹${calculations.netPayment}`
    );

    // Step 4: Create payslip
    const remarks = "Auto-generated from attendance system";

    const payslip = new Payslip({
      employee: userId,
      payPeriod,
      employeeSnapshot: this.buildEmployeeSnapshot(employee),
      monthlySalary,
      // fetchAttendanceForMonth() returns the calendar days of the month as
      // workingDays, and that is the divisor the proration above used, so
      // both schema fields are set from it to keep the payslip self-consistent.
      totalDays: attendanceData.workingDays,
      workingDays: attendanceData.workingDays,
      paidDays: attendanceData.paidDays,
      lwp: attendanceData.unpaidLeaveDays || 0,
      lateDays: attendanceData.lateDays,
      halfDays: attendanceData.halfDays,
      ...this.mapCalculationsToPayslip(calculations),
      remarks,
      createdBy,
    });

    await payslip.save();

    return {
      payslip,
      attendanceData,
      calculations,
    };
  }

  /**
   * Generate payslips for all employees for a month
   * @param {string} payPeriod - Format: "YYYY-MM"
   * @param {string} createdBy - Admin user ID
   * @param {Object} options - Generation options
   * @returns {Object} Generation results
   */
  async generateBulkPayslips(payPeriod, createdBy, options = {}) {
    const { skipExisting = true, employeeIds = null } = options;

    console.log(`🚀 Starting bulk payslip generation for ${payPeriod}`);

    // Get all active employees
    const filter = {
      role: "employee",
      status: "active",
    };

    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      filter._id = { $in: employeeIds };
    }

    const employees = await User.find(filter).lean();
    console.log(`👥 Found ${employees.length} employees to process`);

    const results = {
      total: employees.length,
      generated: 0,
      skipped: 0,
      failed: 0,
      details: [],
    };

    for (const employee of employees) {
      try {
        // Check if payslip already exists
        if (skipExisting) {
          const existing = await Payslip.findOne({
            employee: employee._id,
            payPeriod,
          });

          if (existing) {
            console.log(
              `⏭️  Skipping ${employee.name} - Payslip already exists`
            );
            results.skipped++;
            results.details.push({
              employeeId: employee._id,
              employeeName: employee.name,
              status: "skipped",
              reason: "Payslip already exists",
            });
            continue;
          }
        }

        // Generate payslip
        const result = await this.generateAutoPayslip(
          employee._id,
          payPeriod,
          {},
          createdBy
        );

        results.generated++;
        results.details.push({
          employeeId: employee._id,
          employeeName: employee.name,
          status: "success",
          netPayment: result.calculations.netPayment,
          paidDays: result.attendanceData.paidDays,
          lateDays: result.attendanceData.lateDays,
        });

        console.log(`✅ Generated payslip for ${employee.name}`);
      } catch (error) {
        console.error(
          `❌ Failed to generate payslip for ${employee.name}:`,
          error.message
        );
        results.failed++;
        results.details.push({
          employeeId: employee._id,
          employeeName: employee.name,
          status: "failed",
          error: error.message,
        });
      }
    }

    console.log(`✨ Bulk generation complete:`, {
      generated: results.generated,
      skipped: results.skipped,
      failed: results.failed,
    });

    return results;
  }

  /**
   * Preview salary calculation without saving
   * @param {string} userId - Employee ID
   * @param {string} payPeriod - Format: "YYYY-MM"
   * @param {Object} manualDeductions - Optional manual deductions
   * @returns {Object} Salary preview
   */
  async previewSalaryCalculation(userId, payPeriod, manualDeductions = {}) {
    // Fetch employee data
    const employee = await User.findById(userId)
      .select("name employeeId email department designation salary")
      .lean();
    if (!employee) {
      throw new Error("Employee not found");
    }

    const monthlySalary = this.getMonthlySalary(employee);
    if (monthlySalary <= 0) {
      throw new Error("Employee salary not configured or is zero");
    }

    // Fetch attendance data
    const attendanceData = await this.fetchAttendanceForMonth(
      userId,
      payPeriod
    );

    // Calculate salary
    // CRITICAL FIX (2026-07-31): Pass unpaidLeaveDays to enable LWP deduction
    const calculations = this.calculateSalaryBreakdown(
      monthlySalary,
      attendanceData.workingDays,
      attendanceData.paidDays,
      attendanceData.lateDays,
      attendanceData.halfDays,
      attendanceData.unpaidLeaveDays,
      manualDeductions
    );

    return {
      employee,
      payPeriod,
      monthlySalary,
      calculationBasis: {
        perDaySalary:
          attendanceData.workingDays > 0
            ? Math.round((monthlySalary / attendanceData.workingDays) * 100) /
              100
            : 0,
        paidDayRatio:
          attendanceData.workingDays > 0
            ? Math.round(
                (attendanceData.paidDays / attendanceData.workingDays) * 10000
              ) / 100
            : 0,
        salaryPercentages: this.SALARY_PERCENTAGES,
        deductionConstants: this.DEDUCTION_CONSTANTS,
      },
      attendanceData,
      calculations,
    };
  }
}

module.exports = new AutoPayrollService();
