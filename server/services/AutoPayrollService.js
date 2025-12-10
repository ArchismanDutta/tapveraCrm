// services/AutoPayrollService.js
// Automatic Payroll Service - Fetches attendance data and calculates salary automatically

const AttendanceRecord = require("../models/AttendanceRecord");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const Payslip = require("../models/Payslip");
const AttendanceService = require("./AttendanceService");

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
   * Fetch attendance data for an employee for a specific month
   * @param {string} userId - Employee ID
   * @param {string} payPeriod - Format: "YYYY-MM"
   * @returns {Object} Attendance summary
   */
  async fetchAttendanceForMonth(userId, payPeriod) {
    const [year, month] = payPeriod.split("-").map(Number);

    // Get start and end dates for the month
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log(
      `📅 Fetching attendance for ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Fetch all attendance records for the month
    const attendanceRecords = await AttendanceRecord.find({
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    console.log(
      `📊 Found ${attendanceRecords.length} total attendance records for the period`
    );

    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;
    let fullDays = 0;
    let wfhDays = 0;
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;
    let totalWorkHours = 0;
    const attendanceDetails = [];
    let recordsWithEmployee = 0;

    // Process each attendance record
    for (const record of attendanceRecords) {
      const employeeData = record.employees?.find(
        (emp) => emp.userId && emp.userId.toString() === userId.toString()
      );

      if (employeeData) {
        recordsWithEmployee++;

        // ⭐ IMPORTANT: Recalculate employee data to ensure isLate and lateMinutes are consistent
        // This ensures we use the latest calculation logic, not cached data
        const attendanceService = new AttendanceService();
        attendanceService.recalculateEmployeeData(employeeData, record.date);

        const calc = employeeData.calculated || {};
        const leaveInfo = employeeData.leaveInfo || {};

        // Debug logging for tracking issues
        if (calc.isLate || calc.isHalfDay) {
          console.log(`   📅 ${record.date.toISOString().split('T')[0]}: isLate=${calc.isLate}, lateMinutes=${calc.lateMinutes}, isHalfDay=${calc.isHalfDay}, workHours=${(calc.workDurationSeconds / 3600).toFixed(2)}`);
        }

        // Track attendance details
        attendanceDetails.push({
          date: record.date,
          status: calc.isPresent
            ? "present"
            : calc.isAbsent
            ? "absent"
            : "unknown",
          isLate: calc.isLate || false,
          lateMinutes: calc.lateMinutes || 0,
          isHalfDay: calc.isHalfDay || false,
          isFullDay: calc.isFullDay || false,
          workHours: calc.workDurationSeconds
            ? calc.workDurationSeconds / 3600
            : 0,
          isWFH: leaveInfo.isWFH || false,
          isPaidLeave: leaveInfo.isPaidLeave || false,
          leaveType: leaveInfo.leaveType || null,
          arrivalTime: calc.arrivalTime,
          departureTime: calc.departureTime,
        });

        // Determine day type (priority order: WFH > Paid Leave > Unpaid Leave > Present/Absent)
        const isWFH = leaveInfo.isWFH || false;
        const isPaidLeave = leaveInfo.isPaidLeave || false;
        const isUnpaidLeave =
          leaveInfo.isOnLeave && leaveInfo.leaveType === "unpaid";

        // Count WFH days (full payment, counts as paid day)
        if (isWFH) {
          wfhDays++;
          console.log(`   🏠 ${record.date.toISOString().split('T')[0]}: WFH Day`);
        }
        // Count paid leave days (full payment, counts as paid day)
        else if (isPaidLeave) {
          paidLeaveDays++;
          console.log(`   🌴 ${record.date.toISOString().split('T')[0]}: Paid Leave (${leaveInfo.leaveType})`);
        }
        // Count unpaid leave days (no payment)
        else if (isUnpaidLeave) {
          unpaidLeaveDays++;
          console.log(`   ❌ ${record.date.toISOString().split('T')[0]}: Unpaid Leave`);
        }
        // Count present days (attendance-based payment)
        else if (calc.isPresent) {
          presentDays++;

          // Count late days (isLate is now guaranteed to be consistent with lateMinutes > 0)
          if (calc.isLate) {
            lateDays++;
            console.log(`   ⏰ ${record.date.toISOString().split('T')[0]}: Late Day (${calc.lateMinutes} min)`);
          }

          if (calc.isHalfDay) {
            halfDays++;
            console.log(`   🕐 ${record.date.toISOString().split('T')[0]}: Half Day (${(calc.workDurationSeconds / 3600).toFixed(2)} hrs)`);
          } else if (calc.isFullDay) {
            fullDays++;
          }

          // Add work hours
          totalWorkHours += calc.workDurationSeconds
            ? calc.workDurationSeconds / 3600
            : 0;
        } else {
          console.log(`   ❌ ${record.date.toISOString().split('T')[0]}: Absent or Not Processed - isPresent=${calc.isPresent}, isWFH=${isWFH}, isPaidLeave=${isPaidLeave}`);
        }
      }
    }

    console.log(
      `👤 Found ${recordsWithEmployee} attendance records for employee ${userId}`
    );

    const workingDays = this.getWorkingDaysInMonth(year, month);

    // Calculate weekend days (Saturdays and Sundays) in the month
    const weekendDays = this.getWeekendDaysInMonth(year, month);

    // Calculate paid days
    // Paid days = Present days + Paid leave days + WFH days + Weekend days
    // Note:
    // - WFH days receive full payment (no deduction)
    // - Paid leave days receive full payment (no deduction)
    // - Present days receive payment based on attendance (with half-day deductions if applicable)
    // - Weekend days (Saturday & Sunday) are always paid (no attendance required)
    // - Unpaid leave days receive NO payment
    const paidDays = presentDays + paidLeaveDays + wfhDays + weekendDays;

    // Log final summary
    console.log(`✅ Attendance Summary for ${userId}:`);
    console.log(`   Working Days (Total days in month): ${workingDays}`);
    console.log(`   Present Days: ${presentDays}`);
    console.log(`   Paid Leave Days: ${paidLeaveDays}`);
    console.log(`   WFH Days (Full Payment): ${wfhDays}`);
    console.log(`   Weekend Days (Sat & Sun - Always Paid): ${weekendDays}`);
    console.log(`   Unpaid Leave Days: ${unpaidLeaveDays}`);
    console.log(`   Total Paid Days: ${paidDays}`);
    console.log(`   Late Days: ${lateDays}`);
    console.log(`   Half Days: ${halfDays}`);

    // Warning if paid days are very low
    if (recordsWithEmployee === 0) {
      console.warn(
        `⚠️  WARNING: No attendance records found for employee ${userId} in ${payPeriod}`
      );
      console.warn(
        `⚠️  This will result in 0 paid days and minimal salary calculation!`
      );
      console.warn(
        `⚠️  Please ensure attendance records are properly maintained for this employee.`
      );
    } else if (paidDays < workingDays * 0.5) {
      console.warn(
        `⚠️  WARNING: Low paid days (${paidDays}/${workingDays}) for employee ${userId}`
      );
      console.warn(
        `⚠️  This will result in significantly reduced salary. Please verify attendance data.`
      );
    }

    // Check for perfect attendance (present all working days excluding weekends)
    const totalWorkingDaysExcludingWeekends =
      this.getWorkingDaysExcludingWeekends(year, month);
    const hasPerfectAttendance =
      presentDays + wfhDays + paidLeaveDays >=
        totalWorkingDaysExcludingWeekends &&
      unpaidLeaveDays === 0 &&
      halfDays === 0;

    return {
      workingDays,
      presentDays,
      lateDays,
      halfDays,
      fullDays,
      wfhDays,
      paidLeaveDays,
      unpaidLeaveDays,
      paidDays,
      totalWorkHours,
      attendanceDetails,
      hasPerfectAttendance, // New field for perfect attendance check
      totalWorkingDaysExcludingWeekends, // Working days excluding Sat & Sun
      summary: {
        totalDays: workingDays,
        paidDays: paidDays,
        unpaidDays: workingDays - paidDays,
        lateCount: lateDays,
        halfDayCount: halfDays,
        effectivePaidDays: paidDays - halfDays * 0.5, // Half-days count as 0.5 for some calculations
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
   * @param {number} monthlySalary
   * @param {number} workingDays
   * @param {number} paidDays
   * @param {number} lateDays
   * @param {number} halfDays
   * @param {Object} manualDeductions
   * @returns {Object} Complete salary calculation
   */
  calculateSalaryBreakdown(
    monthlySalary,
    workingDays,
    paidDays,
    lateDays,
    halfDays,
    manualDeductions = {},
    hasPerfectAttendance = false,
    hasCompletedSixMonths = false
  ) {
    // Step 1: Calculate salary components (monthly breakdown)
    const salaryComponents = {
      basic: monthlySalary * this.SALARY_PERCENTAGES.BASIC,
      hra: monthlySalary * this.SALARY_PERCENTAGES.HRA,
      conveyance: monthlySalary * this.SALARY_PERCENTAGES.CONVEYANCE,
      medical: monthlySalary * this.SALARY_PERCENTAGES.MEDICAL,
      specialAllowance:
        monthlySalary * this.SALARY_PERCENTAGES.SPECIAL_ALLOWANCE,
    };

    // Step 2: Calculate gross components (prorated by paid days)
    const grossComponents = {
      basic: (salaryComponents.basic / workingDays) * paidDays,
      hra: (salaryComponents.hra / workingDays) * paidDays,
      conveyance: (salaryComponents.conveyance / workingDays) * paidDays,
      medical: (salaryComponents.medical / workingDays) * paidDays,
      specialAllowance:
        (salaryComponents.specialAllowance / workingDays) * paidDays,
    };

    // Step 3: Calculate gross total
    let grossTotal = Object.values(grossComponents).reduce(
      (sum, val) => sum + val,
      0
    );

    // Step 3.5: Calculate perfect attendance bonus
    const perDaySalary = monthlySalary / workingDays;
    const perfectAttendanceBonus =
      hasPerfectAttendance && hasCompletedSixMonths
        ? perDaySalary // One day extra payment
        : 0;

    // Add bonus to gross total
    grossTotal += perfectAttendanceBonus;

    // Step 4: Check ESI eligibility
    const esiApplicable =
      monthlySalary <= this.DEDUCTION_CONSTANTS.ESI_SALARY_LIMIT;

    // Step 5: Calculate deductions
    const deductions = {
      // Employee PF
      employeePF:
        salaryComponents.basic <= this.DEDUCTION_CONSTANTS.PF_BASIC_LIMIT
          ? Math.min(
              this.DEDUCTION_CONSTANTS.PF_CAP,
              Math.ceil(
                salaryComponents.basic * this.DEDUCTION_CONSTANTS.PF_RATE
              )
            )
          : 0,

      // ESI
      esi: esiApplicable
        ? Math.round(grossTotal * this.DEDUCTION_CONSTANTS.ESI_EMPLOYEE_RATE)
        : 0,

      // Professional Tax
      ptax: this.calculatePTax(monthlySalary),

      // Late deduction
      lateDeduction: this.calculateLateDeduction(lateDays, perDaySalary),

      // Half-day deduction
      halfDayDeduction:
        halfDays *
        (perDaySalary * this.DEDUCTION_CONSTANTS.HALF_DAY_DEDUCTION_RATE),

      // Manual deductions
      tds: manualDeductions.tds || 0,
      other: manualDeductions.other || 0,
      advance: manualDeductions.advance || 0,
    };

    // Step 6: Calculate employer contributions
    const employerContributions = {
      employerPF:
        salaryComponents.basic <= this.DEDUCTION_CONSTANTS.PF_BASIC_LIMIT
          ? Math.min(
              this.DEDUCTION_CONSTANTS.PF_CAP,
              Math.ceil(
                salaryComponents.basic * this.DEDUCTION_CONSTANTS.PF_RATE
              )
            )
          : 0,
      employerESI: esiApplicable
        ? Math.round(grossTotal * this.DEDUCTION_CONSTANTS.ESI_EMPLOYER_RATE)
        : 0,
    };

    // Step 7: Calculate totals
    const totalDeductions = Object.values(deductions).reduce(
      (sum, val) => sum + val,
      0
    );
    const netPayment = grossTotal - totalDeductions;
    const ctc =
      grossTotal +
      employerContributions.employerPF +
      employerContributions.employerESI;

    return {
      salaryComponents,
      grossComponents,
      grossTotal: Math.round(grossTotal * 100) / 100,
      bonuses: {
        perfectAttendanceBonus: Math.round(perfectAttendanceBonus * 100) / 100,
      },
      deductions: {
        employeePF: Math.round(deductions.employeePF * 100) / 100,
        esi: Math.round(deductions.esi * 100) / 100,
        ptax: deductions.ptax,
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
    const calculations = this.calculateSalaryBreakdown(
      monthlySalary,
      attendanceData.workingDays,
      attendanceData.paidDays,
      attendanceData.lateDays,
      attendanceData.halfDays,
      manualDeductions,
      attendanceData.hasPerfectAttendance,
      hasCompletedSixMonths
    );

    console.log(
      `✅ Salary calculated - Net Payment: ₹${calculations.netPayment}`
    );

    // Step 4: Create payslip
    let remarks = "Auto-generated from attendance system";
    if (calculations.bonuses.perfectAttendanceBonus > 0) {
      remarks +=
        " | Perfect Attendance Bonus applied (6+ months tenure + 100% attendance)";
    }

    const payslip = new Payslip({
      employee: userId,
      payPeriod,
      monthlySalary,
      workingDays: attendanceData.workingDays,
      paidDays: attendanceData.paidDays,
      lateDays: attendanceData.lateDays,
      halfDays: attendanceData.halfDays,
      bonuses: calculations.bonuses,
      salaryComponents: calculations.salaryComponents,
      grossComponents: calculations.grossComponents,
      grossTotal: calculations.grossTotal,
      deductions: calculations.deductions,
      totalDeductions: calculations.totalDeductions,
      employerContributions: calculations.employerContributions,
      netPayment: calculations.netPayment,
      ctc: calculations.ctc,
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
    const calculations = this.calculateSalaryBreakdown(
      monthlySalary,
      attendanceData.workingDays,
      attendanceData.paidDays,
      attendanceData.lateDays,
      attendanceData.halfDays,
      manualDeductions
    );

    return {
      employee,
      attendanceData,
      calculations,
    };
  }
}

module.exports = new AutoPayrollService();
