const Payslip = require("../models/Payslip");
const User = require("../models/User");
const { sendNotificationToUser } = require("../utils/websocket");

/**
 * Calculate all salary components automatically
 * Based on the salary structure:
 * - Basic = 50% of salary
 * - HRA = 35% of salary
 * - Conveyance = 5% of salary
 * - Medical = 5% of salary
 * - Special Allowance = 5% of salary
 */
function calculateSalaryBreakdown(monthlySalary, workingDays, paidDays, lateDays, manualDeductions = {}) {
  // Step 1: Calculate salary components (monthly breakdown)
  const salaryComponents = {
    basic: monthlySalary * 0.50,
    hra: monthlySalary * 0.35,
    conveyance: monthlySalary * 0.05,
    medical: monthlySalary * 0.05,
    specialAllowance: monthlySalary * 0.05
  };

  // Step 2: Calculate gross components (prorated by paid days)
  const grossComponents = {
    basic: (salaryComponents.basic / workingDays) * paidDays,
    hra: (salaryComponents.hra / workingDays) * paidDays,
    conveyance: (salaryComponents.conveyance / workingDays) * paidDays,
    medical: (salaryComponents.medical / workingDays) * paidDays,
    specialAllowance: (salaryComponents.specialAllowance / workingDays) * paidDays
  };

  // Step 3: Calculate gross total
  const grossTotal = Object.values(grossComponents).reduce((sum, val) => sum + val, 0);

  // Step 3.5: Determine ESI eligibility based on monthly salary
  const esiApplicable = monthlySalary <= 21000;

  // Step 4: Calculate late deduction
  // Formula: Every 3 lates = 1 day salary deduction
  // For lates not in multiples of 3 (4, 5, 7, 8, etc.), add ₹200 per extra late day
  // Examples:
  // 3 lates = 1 day deduction
  // 4 lates = 1 day deduction + ₹200
  // 5 lates = 1 day deduction + ₹400
  // 6 lates = 2 days deduction
  // 7 lates = 2 days deduction + ₹200
  // 9 lates = 3 days deduction
  const perDaySalary = monthlySalary / workingDays;
  const fullLateDays = Math.floor(lateDays / 3); // Number of full 3-day cycles
  const extraLateDays = lateDays % 3; // Remaining lates (1 or 2)
  const lateDeduction = (fullLateDays * perDaySalary) + (extraLateDays * 200);

  // Step 5: Calculate deductions
  const deductions = {
    // Employee PF: MIN(1800, ROUNDUP(Basic * 12%, 0)) if basic <= 15000, else 0
    employeePF: salaryComponents.basic <= 15000
      ? Math.min(1800, Math.ceil(salaryComponents.basic * 0.12))
      : 0,

    // ESI: ROUND(Gross Total * 0.75%, 0) if salary <= 21000, else 0
    esi: esiApplicable ? Math.round(grossTotal * 0.0075) : 0,

    // Professional Tax based on slabs
    ptax: calculatePTax(monthlySalary),

    // Manual entries (optional)
    tds: manualDeductions.tds || 0,
    other: manualDeductions.other || 0,
    advance: manualDeductions.advance || 0,

    // Late deduction
    lateDeduction: lateDeduction
  };

  // Step 6: Calculate employer contributions
  const employerContributions = {
    // Employer PF: MIN(1800, ROUNDUP(Basic * 12%, 0)) if basic <= 15000, else 0
    employerPF: salaryComponents.basic <= 15000
      ? Math.min(1800, Math.ceil(salaryComponents.basic * 0.12))
      : 0,

    // Employer ESI: ROUND(Gross Total * 3.25%, 0) if salary <= 21000, else 0
    employerESI: esiApplicable ? Math.round(grossTotal * 0.0325) : 0
  };

  // Step 7: Calculate totals
  const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);
  const netPayment = grossTotal - totalDeductions;
  const ctc = grossTotal + employerContributions.employerPF + employerContributions.employerESI;

  return {
    salaryComponents,
    grossComponents,
    grossTotal,
    deductions,
    totalDeductions,
    employerContributions,
    netPayment,
    ctc
  };
}

/**
 * Calculate Professional Tax based on salary slabs
 */
function calculatePTax(monthlySalary) {
  if (monthlySalary < 10000) {
    return 0;
  } else if (monthlySalary <= 15000) {
    return 110;
  } else if (monthlySalary <= 25000) {
    return 130;
  } else if (monthlySalary <= 40000) {
    return 150;
  } else {
    return 200;
  }
}

// Create payslip with automated calculation
// Super Admin only needs to enter: monthlySalary, workingDays, paidDays, lateDays
exports.createPayslip = async (req, res) => {
  try {
    const {
      employeeId,
      payPeriod, // Format: "YYYY-MM"
      monthlySalary,
      workingDays,
      paidDays,
      lateDays = 0,
      manualDeductions = {}, // Optional: { tds, other, advance }
      remarks = ""
    } = req.body;

    // Validate required fields
    if (!employeeId || !payPeriod || !monthlySalary || !workingDays || paidDays === undefined) {
      return res.status(400).json({
        error: "Employee ID, pay period, monthly salary, working days, and paid days are required"
      });
    }

    // Validate numeric values
    if (monthlySalary <= 0 || workingDays <= 0 || paidDays < 0 || lateDays < 0) {
      return res.status(400).json({
        error: "Invalid numeric values provided"
      });
    }

    if (paidDays > workingDays) {
      return res.status(400).json({
        error: "Paid days cannot exceed working days"
      });
    }

    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check if payslip already exists
    const existingPayslip = await Payslip.findOne({
      employee: employeeId,
      payPeriod: payPeriod
    });

    if (existingPayslip) {
      return res.status(409).json({
        error: "Payslip already exists for this employee and month. Use update endpoint to modify.",
        payslipId: existingPayslip._id
      });
    }

    // Calculate all salary components automatically
    const calculations = calculateSalaryBreakdown(
      monthlySalary,
      workingDays,
      paidDays,
      lateDays,
      manualDeductions
    );

    // Create payslip
    const payslip = new Payslip({
      employee: employeeId,
      payPeriod,
      monthlySalary,
      workingDays,
      paidDays,
      lateDays,
      salaryComponents: calculations.salaryComponents,
      grossComponents: calculations.grossComponents,
      grossTotal: calculations.grossTotal,
      deductions: calculations.deductions,
      totalDeductions: calculations.totalDeductions,
      employerContributions: calculations.employerContributions,
      netPayment: calculations.netPayment,
      ctc: calculations.ctc,
      remarks,
      createdBy: req.user._id
    });

    await payslip.save();

    // Populate employee details
    await payslip.populate('employee', 'name employeeId email department designation');
    await payslip.populate('createdBy', 'name email');

    // Send real-time notification to employee
    const notificationSent = sendNotificationToUser(employeeId.toString(), {
      channel: "payslip",
      title: "New Payslip Generated",
      message: `Your payslip for ${new Date(payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been generated`,
      payPeriod: payPeriod,
      netPayment: calculations.netPayment,
      timestamp: Date.now(),
      action: "view_payslip"
    });

    console.log(`Payslip notification sent to ${employeeId}: ${notificationSent ? 'Success' : 'User offline'}`);

    res.status(201).json({
      success: true,
      message: "Payslip generated successfully",
      payslip,
      calculations: {
        breakdown: calculations
      }
    });

  } catch (error) {
    console.error("Error generating payslip:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
};

// Update payslip record
exports.updatePayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const payslip = await Payslip.findById(id);
    if (!payslip) {
      return res.status(404).json({ error: "Payslip not found" });
    }

    // Store employee ID before update
    const employeeId = payslip.employee.toString();

    // Update the payslip
    Object.keys(updateData).forEach(key => {
      if (key !== 'employee' && key !== 'payPeriod') { // Prevent changing employee and period
        payslip[key] = updateData[key];
      }
    });

    await payslip.save();

    // Populate employee details
    await payslip.populate('employee', 'name employeeId email department designation');
    await payslip.populate('createdBy', 'name email');

    // Send real-time notification to employee about update
    const notificationSent = sendNotificationToUser(employeeId, {
      channel: "payslip",
      title: "Payslip Updated",
      message: `Your payslip for ${new Date(payslip.payPeriod + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} has been updated`,
      payPeriod: payslip.payPeriod,
      netPayment: payslip.netPayment,
      timestamp: Date.now(),
      action: "view_payslip"
    });

    console.log(`Payslip update notification sent to ${employeeId}: ${notificationSent ? 'Success' : 'User offline'}`);

    res.json(payslip);
  } catch (error) {
    console.error("Error updating payslip:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get payslip by employee and month (for employees)
exports.getMyPayslip = async (req, res) => {
  try {
    const { month } = req.params;
    const employeeId = req.user._id;

    const payslip = await Payslip.findOne({
      employee: employeeId,
      payPeriod: month
    }).populate('employee', 'name employeeId email department designation');

    if (!payslip) {
      return res.status(404).json({ error: "Payslip not found for the specified month" });
    }

    res.json(payslip);
  } catch (error) {
    console.error("Error fetching payslip:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get payslip by employee ID and month (for admins)
exports.getEmployeePayslip = async (req, res) => {
  try {
    const { employeeId, month } = req.params;

    const payslip = await Payslip.findOne({
      employee: employeeId,
      payPeriod: month
    }).populate('employee', 'name employeeId email department designation');

    if (!payslip) {
      return res.status(404).json({ error: "Payslip not found for the specified employee and month" });
    }

    res.json(payslip);
  } catch (error) {
    console.error("Error fetching employee payslip:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all payslips (for admins) with filters
exports.getAllPayslips = async (req, res) => {
  try {
    const { search, month, department, page = 1, limit = 50 } = req.query;

    // Build filter query
    let filter = {};

    if (month) {
      filter.payPeriod = month;
    }

    // Build aggregation pipeline
    let pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'employee',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $unwind: '$employee'
      }
    ];

    // Add department filter
    if (department) {
      pipeline.push({
        $match: { 'employee.department': department }
      });
    }

    // Add search filter
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'employee.name': { $regex: search, $options: 'i' } },
            { 'employee.employeeId': { $regex: search, $options: 'i' } },
            { 'employee.email': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add month filter
    if (month) {
      pipeline.push({
        $match: { payPeriod: month }
      });
    }

    // Add sorting
    pipeline.push({
      $sort: { createdAt: -1 }
    });

    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });

    // Project fields
    pipeline.push({
      $project: {
        employee: {
          _id: 1,
          name: 1,
          employeeId: 1,
          email: 1,
          department: 1,
          designation: 1
        },
        payPeriod: 1,
        ctc: 1,
        basicSalary: 1,
        grossSalary: 1,
        netSalary: 1,
        deductions: 1,
        totalDeductions: 1,
        workingDays: 1,
        presentDays: 1,
        lateDays: 1,
        remarks: 1,
        generatedAt: 1,
        createdAt: 1
      }
    });

    const payslips = await Payslip.aggregate(pipeline);

    res.json(payslips);
  } catch (error) {
    console.error("Error fetching payslips:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get employee's payslip history
exports.getEmployeePayslipHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payslips = await Payslip.find({ employee: employeeId })
      .populate('employee', 'name employeeId email department designation')
      .sort({ payPeriod: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payslip.countDocuments({ employee: employeeId });

    res.json({
      payslips,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error("Error fetching payslip history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete payslip
exports.deletePayslip = async (req, res) => {
  try {
    const { id } = req.params;

    const payslip = await Payslip.findById(id);
    if (!payslip) {
      return res.status(404).json({ error: "Payslip not found" });
    }

    await payslip.deleteOne();

    res.json({ message: "Payslip deleted successfully" });
  } catch (error) {
    console.error("Error deleting payslip:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get payslip statistics
exports.getPayslipStats = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const stats = await Payslip.aggregate([
      {
        $group: {
          _id: null,
          totalPayslips: { $sum: 1 },
          currentMonthPayslips: {
            $sum: { $cond: [{ $eq: ['$payPeriod', currentMonth] }, 1, 0] }
          },
          totalSalaryPaid: { $sum: '$netSalary' },
          averageSalary: { $avg: '$netSalary' },
          totalDeductions: { $sum: '$totalDeductions' }
        }
      }
    ]);

    const result = stats[0] || {
      totalPayslips: 0,
      currentMonthPayslips: 0,
      totalSalaryPaid: 0,
      averageSalary: 0,
      totalDeductions: 0
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching payslip stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};