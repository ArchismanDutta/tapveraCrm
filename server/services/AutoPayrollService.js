// services/AutoPayrollService.js
// Automatic Payroll Service - Fetches attendance data and calculates salary automatically

const User = require("../models/User");
const Payslip = require("../models/Payslip");
const PayrollOverride = require("../models/PayrollOverride");
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
      `   ${summary.daysInMonth} days in month (${summary.weekendDays} weekend \u2014 not paid, ${summary.holidayDays} holiday \u2014 paid)`
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
      fullDays: summary.fullDays,
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
    // The highest slab this salary reaches.
    //
    // Matching `>= min && <= max` left four gaps between the slabs — 9,999 to
    // 10,000, 15,000 to 15,001, 25,000 to 25,001 and 40,000 to 40,001 — and a
    // salary landing in one matched nothing and fell through to ZERO tax. A
    // whole-rupee salary never lands there, but grossTotal is a float, so a
    // salary of ₹15,000.50 paid no professional tax at all instead of ₹110.
    // Walking to the last slab the salary reaches cannot have a gap, and
    // returns the same answer as before for every value that did match.
    let tax = 0;
    for (const slab of this.PTAX_SLABS) {
      if (monthlySalary >= slab.min) tax = slab.tax;
    }
    return tax;
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
    manualDeductions = {},
    absentDays = 0,
    eligibility = {}
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

    // Step 4: Net total — the gross actually earned for the days paid.
    //
    // Rounded to a whole rupee because it is a payable amount and everything
    // downstream subtracts from it: the sheet prints ₹17,307.00 for components
    // summing to ₹17,306.67, and its net payment follows from the rounded
    // figure. Leaving paise here put every later column a rupee out.
    const netTotal = Math.round(
      Object.values(grossComponents).reduce((sum, val) => sum + val, 0)
    );

    // Step 5: Statutory eligibility — the PF-Y/N and ESI-Y/N columns.
    //
    // An explicit per-employee flag wins; undefined means "apply the rule".
    // The flags exist because neither is purely a function of this month's
    // salary: an existing EPF member stays a member after a raise past the
    // wage ceiling ("once a member, always a member"), ESI coverage runs to
    // the end of a contribution period once it starts, and the ESI ceiling is
    // higher for employees with a disability. resolveStatutoryEligibility()
    // works those out; this method just applies the answer.
    // PF applies by default and the ₹15,000 ceiling CAPS the contribution
    // (see pfWage below) rather than removing the employee. It used to read
    // `basic <= PF_BASIC_LIMIT`, which meant anyone earning above the ceiling
    // had no PF deducted at all — wrong for the common case, an existing
    // member whose basic has since risen. Genuinely excluded employees are
    // marked pfEligible: false on their record.
    const pfEligible =
      typeof eligibility.pf === "boolean" ? eligibility.pf : true;

    const esiApplicable =
      typeof eligibility.esi === "boolean"
        ? eligibility.esi
        : grossTotal <= this.DEDUCTION_CONSTANTS.ESI_SALARY_LIMIT;

    // Step 6: Calculate deductions.
    //
    // CRITICAL FIX (2026-07-31): Added LWP (Leave Without Pay) deduction
    // LWP deduction = (Monthly Salary / Working Days) × Unpaid Leave Days
    //
    // Only used by the late-day rule below. Unpaid leave and unexcused absence
    // are NOT deducted here: they earn no credit in paidDays in the first
    // place (see AttendanceSummaryService.DAY_CREDIT), and taking them again
    // as a deduction line is what once made one day of unpaid leave cost
    // nearly three. `unpaidLeaveDays` and `absentDays` stay in the signature
    // because callers pass them and the payslip records them.
    const perDaySalary = monthlySalary / safeWorkingDays;

    // The wage PF is charged on: the paid basic, but never more than the
    // statutory ceiling for the same stretch of days.
    //
    // This used to be min(PF_CAP, 12% x paid basic) guarded by an eligibility
    // test of `basic <= 15000` — so anyone above the ceiling was EXCLUDED and
    // had zero PF deducted, and the cap was dead code that could never be
    // reached. The ceiling caps the contribution; it does not remove the
    // employee.
    const pfWage = Math.min(
      grossComponents.basic,
      this.DEDUCTION_CONSTANTS.PF_BASIC_LIMIT * (paidDays / safeWorkingDays)
    );

    const pfCapped = pfWage < grossComponents.basic - 0.005;

    // Late is its own deduction, not a silent passenger in "Other / Penalty".
    //
    // Folding it into Other produced a number in a column nobody had filled
    // in, with nothing on the row to account for it — which is exactly what
    // makes a payslip look like it is taking money for no reason. It now has
    // its own column, and an admin can overrule the rule: pass a number as
    // manualDeductions.late and that is what is charged. Omit it and the late
    // policy decides, as before.
    const manualOther = manualDeductions.other || 0;

    const lateOverride =
      manualDeductions.late === "" || manualDeductions.late == null
        ? null
        : Number(manualDeductions.late);

    const lateDeduction =
      lateOverride !== null && Number.isFinite(lateOverride)
        ? lateOverride
        : this.calculateLateDeduction(lateDays, perDaySalary);

    const lateIsOverridden =
      lateOverride !== null &&
      Number.isFinite(lateOverride) &&
      Math.abs(lateOverride - this.calculateLateDeduction(lateDays, perDaySalary)) > 0.005;

    // Rounding, matching the payroll sheet: statutory contributions go UP to
    // the next whole rupee, never to the nearest. On the sheet's own example
    // 12% of ₹8,653.33 is ₹1,038.40 and the figure printed is ₹1,039.
    // Carrying paise instead is why payslips did not reconcile with it.
    const deductions = {
      // Employee PF
      employeePF: pfEligible
        ? Math.ceil(pfWage * this.DEDUCTION_CONSTANTS.PF_RATE)
        : 0,

      // ESI
      esi: esiApplicable
        ? Math.ceil(netTotal * this.DEDUCTION_CONSTANTS.ESI_EMPLOYEE_RATE)
        : 0,

      // Professional Tax — charged on the payroll sheet's "Total (Salary
      // Component)" column, i.e. the full monthly component gross, NOT on
      // what was earned for the days paid. So it does not move with
      // attendance: a mid-month joiner pays the same slab as a full month.
      //
      // grossTotal rather than monthlySalary: identical today because the
      // component percentages sum to 100%, but this is the column the sheet
      // actually names, so it stays right if those percentages ever change.
      ptax: this.calculatePTax(grossTotal),

      // Manual deductions
      tds: manualDeductions.tds || 0,
      advance: manualDeductions.advance || 0,

      // Late — the late-arrival policy, in its own column. Rounded here so
      // the figure printed in the column is the figure added to the total; a
      // day's pay is rarely a whole number of rupees.
      late: Math.round(lateDeduction * 100) / 100,

      // Other / Penalty — what an admin typed, and nothing else. Attendance
      // itself is NOT deducted: absence, unpaid leave and half days already
      // reduce paidDays, which is the single mechanism for it.
      other: manualOther,
    };

    // Step 7: Calculate employer contributions.
    const employerContributions = {
      employerPF: pfEligible
        ? Math.ceil(pfWage * this.DEDUCTION_CONSTANTS.PF_RATE)
        : 0,
      employerESI: esiApplicable
        ? Math.ceil(netTotal * this.DEDUCTION_CONSTANTS.ESI_EMPLOYER_RATE)
        : 0,
    };

    // Step 8: Totals. The six deduction columns on the sheet, and nothing else.
    const totalDeductions =
      deductions.employeePF +
      deductions.esi +
      deductions.ptax +
      deductions.tds +
      deductions.late +
      deductions.other +
      deductions.advance;

    const netPayment = netTotal - totalDeductions;
    const ctc =
      totalDeductions +
      netPayment +
      employerContributions.employerPF +
      employerContributions.employerESI;

    // Two decimals on money that gets printed, so a payslip never shows
    // 8653.333333333332 where the sheet shows 8653.33.
    const round2 = (n) => Math.round(n * 100) / 100;
    const roundedComponents = Object.fromEntries(
      Object.entries(grossComponents).map(([k, v]) => [k, round2(v)])
    );

    // ─── WHY EACH FIGURE IS WHAT IT IS ──────────────────────────────────
    //
    // Built here, next to the rules that produce the numbers, so the reason
    // and the amount can never drift apart. Six deduction columns is not the
    // same as six explained deductions: PF and ESI are self-evident, but
    // professional tax appears without anyone entering it, and "Other /
    // Penalty" silently contains a late-day penalty the admin never typed. A
    // total larger than the columns a person recognises reads as money taken
    // for no reason.
    //
    // Nothing here changes a figure. It is the sentence next to it.
    const inr = (n) =>
      "\u20b9" + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        .format(round2(n));

    const ptaxSlab = this.PTAX_SLABS.filter((s) => grossTotal >= s.min).pop();

    const explanation = {
      perDaySalary: round2(perDaySalary),

      // What attendance cost, before a single deduction line. This is the
      // largest gap on most payslips and it is not in the deductions block at
      // all: unpaid days simply are not earned.
      unpaidDays: round2(safeWorkingDays - paidDays),
      notEarned: round2(grossTotal - netTotal),
      attendance: {
        workingDays: safeWorkingDays,
        paidDays: round2(paidDays),
        absentDays: round2(absentDays),
        unpaidLeaveDays: round2(unpaidLeaveDays),
        halfDays: round2(halfDays),
        lateDays: round2(lateDays),
      },

      // One entry per deduction column, in the order the sheet prints them.
      // Amounts are rounded the way they are printed, so the lines a person
      // reads add up to the total they are shown.
      deductions: [
        {
          key: "employeePF",
          label: "EE-PF",
          amount: deductions.employeePF,
          note: !pfEligible
            ? "PF-Y/N is N for this employee"
            : `12% of ${inr(pfWage)}${
                pfCapped
                  ? ` \u2014 the ${inr(this.DEDUCTION_CONSTANTS.PF_BASIC_LIMIT)} wage ceiling, prorated for ${round2(paidDays)} paid days`
                  : " paid basic"
              }, rounded up`,
        },
        {
          key: "esi",
          label: "ESI",
          amount: deductions.esi,
          note: !esiApplicable
            ? grossTotal > this.DEDUCTION_CONSTANTS.ESI_SALARY_LIMIT
              ? `not applicable \u2014 ${inr(grossTotal)} is above the ${inr(this.DEDUCTION_CONSTANTS.ESI_SALARY_LIMIT)} ESI ceiling`
              : "ESI-Y/N is N for this employee"
            : `0.75% of ${inr(netTotal)} gross earnings, rounded up`,
        },
        {
          key: "ptax",
          label: "Ptax",
          amount: deductions.ptax,
          note: `professional tax \u2014 the ${inr(ptaxSlab ? ptaxSlab.min : 0)}${
            ptaxSlab && Number.isFinite(ptaxSlab.max) ? `\u2013${inr(ptaxSlab.max)}` : "+"
          } slab, charged on the ${inr(grossTotal)} salary component total`,
        },
        {
          key: "tds",
          label: "TDS",
          amount: deductions.tds,
          note: deductions.tds ? "entered by hand on the register" : "none entered",
        },
        {
          key: "late",
          label: "Late",
          amount: deductions.late,
          note: lateIsOverridden
            ? `set by hand, overriding the ${inr(this.calculateLateDeduction(lateDays, perDaySalary))} the late rule produced for ${round2(lateDays)} late day${lateDays === 1 ? "" : "s"}`
            : !deductions.late
            ? `${round2(lateDays)} late day${lateDays === 1 ? "" : "s"} \u2014 within the ${this.DEDUCTION_CONSTANTS.LATE_FREE_DAYS} free`
            : `${round2(lateDays)} late day${lateDays === 1 ? "" : "s"}: first ${this.DEDUCTION_CONSTANTS.LATE_FREE_DAYS} free, then every ${this.DEDUCTION_CONSTANTS.LATE_CYCLE} lates cost a day's pay (${inr(perDaySalary)}) and each remaining late ${inr(this.DEDUCTION_CONSTANTS.EXTRA_LATE_PENALTY)}`,
          parts: {
            lateDays: round2(lateDays),
            fromRule: round2(this.calculateLateDeduction(lateDays, perDaySalary)),
            overridden: lateIsOverridden,
          },
        },
        {
          key: "other",
          label: "Other / Penalty",
          amount: deductions.other,
          note: deductions.other ? "entered by hand on the register" : "none entered",
        },
        {
          key: "advance",
          label: "Advance",
          amount: deductions.advance,
          note: deductions.advance ? "salary advance already paid out" : "none entered",
        },
      ].map((line) => ({ ...line, amount: round2(line.amount) })),
    };

    return {
      salaryComponents: Object.fromEntries(
        Object.entries(salaryComponents).map(([k, v]) => [k, round2(v)])
      ),
      grossComponents: roundedComponents,
      paidComponents: roundedComponents,
      grossTotal: Math.round(grossTotal * 100) / 100,
      netTotal: Math.round(netTotal * 100) / 100,
      eligibility: {
        pf: pfEligible,
        esi: esiApplicable,
      },
      bonuses: {
        perfectAttendanceBonus: 0,
      },
      // The six deduction columns on the payroll sheet, and nothing else.
      // Attendance is not deducted here — it is already carried by paidDays.
      deductions: {
        employeePF: deductions.employeePF,
        esi: deductions.esi,
        ptax: deductions.ptax,
        tds: deductions.tds,
        late: deductions.late,
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

      // Why each of the above is what it is. Display only — no figure is
      // derived from it.
      explanation,
    };
  }

  /**
   * Work out the PF-Y/N and ESI-Y/N answers for one employee and month.
   *
   * Neither is a pure function of this month's salary:
   *
   *  - PF: an employee already enrolled stays enrolled after a raise past the
   *    ₹15,000 wage ceiling. The contribution is then capped, not stopped.
   *  - ESI: coverage runs to the END of the contribution period it started in
   *    (Apr–Sep, Oct–Mar), so crossing the wage ceiling in November does not
   *    drop the employee until April.
   *
   * An explicit flag on the employee record always wins — that is what the
   * Y/N columns on the payroll sheet are. Otherwise the rule applies, with
   * the period lock checked against the payslip already issued for the first
   * month of the current contribution period.
   *
   * @param {Object} employee - User document
   * @param {number} monthlySalary
   * @param {string} payPeriod - "YYYY-MM"
   * @returns {Promise<{pf: boolean|undefined, esi: boolean|undefined}>}
   */
  async resolveStatutoryEligibility(employee = {}, monthlySalary = 0, payPeriod = "") {
    const resolved = {};

    if (typeof employee.pfEligible === "boolean") {
      resolved.pf = employee.pfEligible;
    }

    if (typeof employee.esiEligible === "boolean") {
      resolved.esi = employee.esiEligible;
      return resolved;
    }

    // ESI contribution-period lock. Only ever turns coverage ON: if the
    // employee was covered in the first month of this period, they stay
    // covered through it.
    const [year, month] = String(payPeriod).split("-").map(Number);
    if (!year || !month) return resolved;

    const periodStartMonth = month >= 4 && month <= 9 ? 4 : month >= 10 ? 10 : 10;
    const periodStartYear = month >= 4 ? year : year - 1;
    const periodStart = `${periodStartYear}-${String(periodStartMonth).padStart(2, "0")}`;

    if (periodStart === payPeriod) return resolved; // first month: rule applies

    try {
      const opening = await Payslip.findOne({
        employee: employee._id,
        payPeriod: periodStart,
      })
        .select("esiEligible")
        .lean();

      if (opening && opening.esiEligible) resolved.esi = true;
    } catch (err) {
      console.error("⚠️  ESI period lookup failed, applying the wage rule:", err.message);
    }

    return resolved;
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
        lateDeduction: d.late || 0,
        other: d.other || 0,
        advance: d.advance || 0,
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
      manualDeductions,
      attendanceData.absentDays,
      await this.resolveStatutoryEligibility(employee, monthlySalary, payPeriod)
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
      absentDays: attendanceData.absentDays,
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
   * The computed columns of one payroll-register row.
   *
   * Mirrors the payroll sheet exactly: the monthly Salary Component block,
   * the prorated Gross Earnings block, the PF-Y/N and ESI-Y/N flags, the six
   * deduction columns, net payment, employer contributions and CTC.
   *
   * @param {Object} calculations - output of calculateSalaryBreakdown()
   * @returns {Object} the derived half of a register row
   */
  registerFigures(calculations) {
    const d = calculations.deductions || {};
    const e = calculations.employerContributions || {};

    return {
      components: {
        ...calculations.salaryComponents,
        total: calculations.grossTotal,
      },
      earnings: {
        ...calculations.paidComponents,
        netTotal: calculations.netTotal,
      },
      pfEligible: Boolean(calculations.eligibility?.pf),
      esiEligible: Boolean(calculations.eligibility?.esi),
      deductions: {
        employeePF: d.employeePF || 0,
        esi: d.esi || 0,
        tds: d.tds || 0,
        ptax: d.ptax || 0,
        late: d.late || 0,
        other: d.other || 0,
        advance: d.advance || 0,
        total: calculations.totalDeductions,
      },
      netPayment: calculations.netPayment,
      employer: { pf: e.employerPF || 0, esi: e.employerESI || 0 },
      ctc: calculations.ctc,

      // Passed through so a row can account for its own total. See
      // calculateSalaryBreakdown.
      explanation: calculations.explanation,
    };
  }

  /**
   * Price one register row from its inputs.
   *
   * Deliberately pure — no database access — so an edited cell can be
   * re-priced on every keystroke without a lookup, and so the register can
   * never drift from the payslip: this runs the SAME calculateSalaryBreakdown
   * that generation runs. The admin screen used to re-implement the formula in
   * the browser, which is how a previewed figure and a saved figure came to
   * disagree.
   *
   * @param {Object} inputs - the editable half of a register row
   * @returns {Object} the derived half
   */
  priceRegisterRow(inputs = {}) {
    const n = (value, fallback = 0) =>
      value === "" || value == null || Number.isNaN(Number(value))
        ? fallback
        : Number(value);

    const days = Math.max(1, n(inputs.days, 30));

    const calculations = this.calculateSalaryBreakdown(
      n(inputs.salary),
      days,
      Math.min(n(inputs.paidDays), days),
      n(inputs.lateDays),
      n(inputs.halfDays),
      n(inputs.unpaidLeaveDays),
      {
        tds: n(inputs.tds),
        other: n(inputs.other),
        advance: n(inputs.advance),
        // Passed through raw: null/"" means "let the late rule decide", a
        // number means an admin overruled it.
        late: inputs.late,
      },
      n(inputs.absentDays),
      {
        pf: typeof inputs.pfEligible === "boolean" ? inputs.pfEligible : undefined,
        esi: typeof inputs.esiEligible === "boolean" ? inputs.esiEligible : undefined,
      }
    );

    return this.registerFigures(calculations);
  }

  /**
   * Issue a payslip from an edited register row.
   *
   * The row's inputs are priced by the same calculateSalaryBreakdown the
   * register displayed, so what an admin approved on screen is exactly what
   * gets saved — no second formula, no drift.
   *
   * @param {string} userId
   * @param {string} payPeriod - "YYYY-MM"
   * @param {Object} inputs - the editable half of the register row
   * @param {string} createdBy
   * @returns {Promise<Object>} the saved Payslip
   */
  async generatePayslipFromRegisterRow(userId, payPeriod, inputs = {}, createdBy) {
    const employee = await User.findById(userId).lean();
    if (!employee) throw new Error("Employee not found");

    const n = (value, fallback = 0) =>
      value === "" || value == null || Number.isNaN(Number(value))
        ? fallback
        : Number(value);

    const days = Math.max(1, n(inputs.days, 30));
    const paidDays = Math.min(n(inputs.paidDays), days);

    const calculations = this.calculateSalaryBreakdown(
      n(inputs.salary),
      days,
      paidDays,
      n(inputs.lateDays),
      n(inputs.halfDays),
      n(inputs.unpaidLeaveDays),
      {
        tds: n(inputs.tds),
        other: n(inputs.other),
        advance: n(inputs.advance),
        late: inputs.late,
      },
      n(inputs.absentDays),
      {
        pf: typeof inputs.pfEligible === "boolean" ? inputs.pfEligible : undefined,
        esi: typeof inputs.esiEligible === "boolean" ? inputs.esiEligible : undefined,
      }
    );

    const payslip = new Payslip({
      employee: userId,
      payPeriod,
      employeeSnapshot: this.buildEmployeeSnapshot(employee),
      monthlySalary: n(inputs.salary),
      totalDays: days,
      workingDays: days,
      paidDays,
      lwp: n(inputs.unpaidLeaveDays),
      lateDays: n(inputs.lateDays),
      halfDays: n(inputs.halfDays),
      absentDays: n(inputs.absentDays),
      ...this.mapCalculationsToPayslip(calculations),
      remarks: inputs.remarks || "Generated from the payroll register",
      createdBy,
    });

    await payslip.save();
    return payslip;
  }

  /**
   * The whole payroll register for a month — one row per employee.
   *
   * Each row carries its identity, its editable inputs and its derived
   * figures, so the admin screen can re-price a row locally through
   * priceRegisterRow() without refetching attendance.
   *
   * @param {string} payPeriod - "YYYY-MM"
   * @param {Object} [options]
   * @param {string[]} [options.employeeIds] - restrict to these employees
   * @returns {Promise<{payPeriod: string, rows: Object[], errors: Object[]}>}
   */
  async previewPayrollRegister(payPeriod, options = {}) {
    // Everyone on the payroll, whatever their role.
    //
    // This used to filter role: "employee", which silently left every hr,
    // admin and super-admin account off the register — a Country Head or an
    // HR manager is still someone who gets paid, and a payroll sheet that
    // quietly omits a person is the worst possible failure. `status` is the
    // right filter: it is what says whether somebody is still employed.
    const filter = { status: "active" };
    if (Array.isArray(options.employeeIds) && options.employeeIds.length) {
      filter._id = { $in: options.employeeIds };
    }

    const employees = await User.find(filter).sort({ employeeId: 1, name: 1 }).lean();

    // Which of them already have a payslip for this month.
    //
    // One query for the whole register rather than one per row, and it is what
    // lets the screen offer "Generate" or "Regenerate" per employee instead of
    // an all-or-nothing run: without it a single-employee generate is a guess
    // about whether it will create a payslip or silently skip one.
    const issued = await Payslip.find({
      payPeriod,
      employee: { $in: employees.map((e) => e._id) },
    })
      .select("employee netSalary isPublished updatedAt")
      .lean();

    const issuedByEmployee = new Map(issued.map((p) => [String(p.employee), p]));

    // Corrections a human already made to this month, so they survive a
    // reload. Without this the register re-derived every figure from
    // attendance on load and an edited paid-day count silently went back to
    // whatever attendance said. See models/PayrollOverride.js.
    const overrides = await PayrollOverride.find({
      payPeriod,
      employee: { $in: employees.map((e) => e._id) },
    }).lean();

    const overrideByEmployee = new Map(overrides.map((o) => [String(o.employee), o]));

    const rows = [];
    const errors = [];

    for (const employee of employees) {
      try {
        const monthlySalary = this.getMonthlySalary(employee);
        const attendance = await this.fetchAttendanceForMonth(employee._id, payPeriod);
        const eligibility = await this.resolveStatutoryEligibility(
          employee,
          monthlySalary,
          payPeriod
        );

        const inputs = {
          salary: monthlySalary,
          days: attendance.workingDays,
          paidDays: attendance.paidDays,
          lateDays: attendance.lateDays,
          halfDays: attendance.halfDays,
          unpaidLeaveDays: attendance.unpaidLeaveDays,
          absentDays: attendance.absentDays,
          tds: 0,

          // Seeded with what the late policy produced, so the column arrives
          // filled in rather than empty and can be edited like any other
          // deduction. Editing it overrules the rule for this employee and
          // month; it does not change the policy.
          late: this.calculateLateDeduction(
            attendance.lateDays,
            attendance.workingDays > 0 ? monthlySalary / attendance.workingDays : 0
          ),

          other: 0,
          advance: 0,
          // Resolved here so the Y/N cells show the real answer, including an
          // HR override or an ESI contribution-period lock, not just the rule.
          pfEligible:
            typeof eligibility.pf === "boolean"
              ? eligibility.pf
              : undefined,
          esiEligible:
            typeof eligibility.esi === "boolean"
              ? eligibility.esi
              : undefined,
        };

        // A saved correction wins over the derived figure — that is what makes
        // it a correction. Only the fields actually overridden are replaced,
        // so a row corrected on paid days still follows the employee record if
        // their salary changes.
        const override = overrideByEmployee.get(String(employee._id));
        const overriddenFields = override ? Object.keys(override.inputs || {}) : [];

        // What the figure WOULD be without the correction, so the screen can
        // show what was changed from and offer to put it back.
        const derived = {};
        for (const field of overriddenFields) derived[field] = inputs[field];

        Object.assign(inputs, override ? override.inputs : {});

        rows.push({
          employee: {
            _id: employee._id,
            employeeId: employee.employeeId || "",
            name: employee.name || "",
            designation: employee.designation || "",
            department: employee.department || "",
            bankAccountNumber: employee.bankAccountNumber || "",
            ifscCode: employee.ifscCode || "",
          },
          inputs,
          override: override
            ? {
                fields: overriddenFields,
                derived,
                updatedByName: override.updatedByName || "",
                updatedAt: override.updatedAt,
                note: override.note || "",
              }
            : null,
          payslip: (() => {
            const existing = issuedByEmployee.get(String(employee._id));
            return existing
              ? {
                  exists: true,
                  id: String(existing._id),
                  netSalary: existing.netSalary,
                  isPublished: Boolean(existing.isPublished),
                  updatedAt: existing.updatedAt,
                }
              : { exists: false };
          })(),
          attendance: {
            presentDays: attendance.presentDays,
            absentDays: attendance.absentDays,
            paidLeaveDays: attendance.paidLeaveDays,
            unpaidLeaveDays: attendance.unpaidLeaveDays,
            wfhDays: attendance.wfhDays,
            expectedWorkingDays: attendance.expectedWorkingDays,
          },
          ...this.priceRegisterRow(inputs),
        });
      } catch (err) {
        errors.push({
          employeeId: employee.employeeId || String(employee._id),
          name: employee.name || "",
          error: err.message,
        });
      }
    }

    return { payPeriod, rows, errors };
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

    // Get everyone still employed, whatever their role — same rule as the
    // register (see previewPayrollRegister). Filtering on role: "employee"
    // meant bulk generation skipped hr and admin staff without saying so.
    const filter = {
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
      manualDeductions,
      attendanceData.absentDays,
      await this.resolveStatutoryEligibility(employee, monthlySalary, payPeriod)
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
