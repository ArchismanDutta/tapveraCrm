const Payslip = require("../models/Payslip");
const User = require("../models/User");

// Create or update payslip record
exports.createPayslip = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      ctc,
      basicSalary,
      grossSalary,
      netSalary,
      deductions,
      workingDays,
      presentDays,
      lateDays,
      remarks
    } = req.body;

    // Validate required fields
    if (!employeeId || !month || !ctc || !basicSalary || !grossSalary || !netSalary) {
      return res.status(400).json({
        error: "Employee ID, month, CTC, basic salary, gross salary, and net salary are required"
      });
    }

    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Check if payslip already exists for this employee and month
    const existingPayslip = await Payslip.findOne({
      employee: employeeId,
      payPeriod: month
    });

    if (existingPayslip) {
      return res.status(409).json({
        error: "Payslip already exists for this employee and month. Use update endpoint to modify."
      });
    }

    // Create new payslip
    const payslip = new Payslip({
      employee: employeeId,
      payPeriod: month,
      ctc,
      basicSalary,
      grossSalary,
      netSalary,
      deductions: deductions || {},
      workingDays,
      presentDays,
      lateDays,
      remarks,
      createdBy: req.user._id
    });

    await payslip.save();

    // Populate employee details
    await payslip.populate('employee', 'name employeeId email department designation');
    await payslip.populate('createdBy', 'name email');

    res.status(201).json(payslip);
  } catch (error) {
    console.error("Error creating payslip:", error);
    res.status(500).json({ error: "Internal server error" });
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