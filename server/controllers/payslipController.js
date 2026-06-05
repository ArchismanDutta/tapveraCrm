const Payslip = require("../models/Payslip");
const User    = require("../models/User");
const { sendNotificationToUser } = require("../utils/websocket");

// West Bengal Professional Tax Slabs
function calculatePTax(monthlySalary) {
  if (monthlySalary < 10000) return 0;
  if (monthlySalary <= 15000) return 110;
  if (monthlySalary <= 25000) return 130;
  if (monthlySalary <= 40000) return 150;
  return 200;
}

// Core salary calculation (mirrors frontend calcBreakdown)
function calculateSalaryBreakdown(monthlySalary, totalDays, workingDays, paidDays, manualOverrides = {}, manualDeductions = {}) {
  const salaryComponents = {
    basic:            manualOverrides.basic            ?? Math.round(monthlySalary * 0.50),
    hra:              manualOverrides.hra              ?? Math.round(monthlySalary * 0.35),
    conveyance:       manualOverrides.conveyance       ?? Math.round(monthlySalary * 0.05),
    medical:          manualOverrides.medical          ?? Math.round(monthlySalary * 0.05),
    specialAllowance: manualOverrides.specialAllowance ?? Math.round(monthlySalary * 0.05),
  };

  const grossTotal = Object.values(salaryComponents).reduce((s, v) => s + v, 0);

  // Prorate by Total Days (calendar days), not working days
  const ratio = totalDays > 0 ? paidDays / totalDays : 0;
  const paidComponents = {
    basic:            Math.round(salaryComponents.basic            * ratio),
    hra:              Math.round(salaryComponents.hra              * ratio),
    conveyance:       Math.round(salaryComponents.conveyance       * ratio),
    medical:          Math.round(salaryComponents.medical          * ratio),
    specialAllowance: Math.round(salaryComponents.specialAllowance * ratio),
  };

  const netTotal = Object.values(paidComponents).reduce((s, v) => s + v, 0);

  const pfEligible  = salaryComponents.basic <= 15000;
  const esiEligible = grossTotal <= 21000;

  // ROUNDUP for PF (Math.ceil)
  const employeePF  = manualDeductions.employeePF  !== undefined ? manualDeductions.employeePF
                    : pfEligible  ? Math.min(1800, Math.ceil(paidComponents.basic * 0.12)) : 0;
  const employeeESI = manualDeductions.employeeESI !== undefined ? manualDeductions.employeeESI
                    : esiEligible ? Math.round(netTotal * 0.0075) : 0;
  const ptax        = manualDeductions.ptax    !== undefined ? manualDeductions.ptax    : calculatePTax(monthlySalary);
  const tds         = manualDeductions.tds     !== undefined ? manualDeductions.tds     : 0;
  const advance     = manualDeductions.advance !== undefined ? manualDeductions.advance : 0;
  const other       = manualDeductions.other   !== undefined ? manualDeductions.other   : 0;
  const otherLabel  = manualDeductions.otherLabel || "";

  const deductions = { employeePF, employeeESI, ptax, tds, advance, other, otherLabel };
  const totalDeductions = employeePF + employeeESI + ptax + tds + advance + other;

  const employerPF  = pfEligible  ? employeePF : 0;
  const employerESI = esiEligible ? Math.round(netTotal * 0.0325) : 0;

  const netSalary = netTotal - totalDeductions;
  const ctc = totalDeductions + netSalary + employerPF + employerESI;

  return {
    salaryComponents, paidComponents,
    grossTotal, netTotal,
    pfEligible, esiEligible,
    deductions, totalDeductions,
    employerContributions: { employerPF, employerESI },
    netSalary, ctc,
  };
}

// Build employee snapshot (merge DB doc + admin overrides)
async function buildSnapshot(employee, snapshotOverrides = {}) {
  return {
    name:              snapshotOverrides.name              ?? employee.name              ?? "",
    employeeId:        snapshotOverrides.employeeId        ?? employee.employeeId        ?? "",
    designation:       snapshotOverrides.designation       ?? employee.designation       ?? "",
    department:        snapshotOverrides.department        ?? employee.department        ?? "",
    location:          snapshotOverrides.location          ?? employee.location          ?? "",
    doj:               snapshotOverrides.doj               ?? employee.doj,
    pan:               snapshotOverrides.pan               ?? employee.pan               ?? "",
    uan:               snapshotOverrides.uan               ?? employee.uan               ?? "",
    pfNumber:          snapshotOverrides.pfNumber          ?? employee.pfNumber          ?? "",
    esiNumber:         snapshotOverrides.esiNumber         ?? employee.esiNumber         ?? "",
    bankAccountNumber: snapshotOverrides.bankAccountNumber ?? employee.bankAccountNumber ?? "",
    bankName:          snapshotOverrides.bankName          ?? employee.bankName          ?? "",
    ifscCode:          snapshotOverrides.ifscCode          ?? employee.ifscCode          ?? "",
  };
}

// Write statutory edits back to User profile for next time
async function syncStatutoryToProfile(employeeId, overrides = {}) {
  const fields = ["pan","uan","pfNumber","esiNumber","bankAccountNumber","bankName","ifscCode"];
  const update = {};
  for (const f of fields) {
    if (overrides[f] !== undefined && overrides[f] !== "") update[f] = overrides[f];
  }
  if (Object.keys(update).length > 0) {
    await User.findByIdAndUpdate(employeeId, { $set: update });
  }
}

// CREATE PAYSLIP (draft)
exports.createPayslip = async (req, res) => {
  try {
    const {
      employee: employeeId,
      payPeriod,
      totalDays,
      workingDays,
      paidDays,
      lwp,
      monthlySalary,
      componentOverrides,
      deductionOverrides,
      snapshotOverrides,
      remarks,
    } = req.body;

    if (!employeeId || !payPeriod || !totalDays || !workingDays || !paidDays || !monthlySalary) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const employee = await User.findById(employeeId);
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    // Sync any statutory edits back to profile
    if (snapshotOverrides) await syncStatutoryToProfile(employeeId, snapshotOverrides);

    const snapshot  = await buildSnapshot(employee, snapshotOverrides || {});
    const calc      = calculateSalaryBreakdown(
      Number(monthlySalary),
      Number(totalDays),
      Number(workingDays),
      Number(paidDays),
      componentOverrides || {},
      deductionOverrides || {}
    );

    const payslip = await Payslip.create({
      employee: employeeId,
      payPeriod,
      employeeSnapshot: snapshot,
      totalDays:   Number(totalDays),
      workingDays: Number(workingDays),
      paidDays:    Number(paidDays),
      lwp:         Number(lwp || 0),
      monthlySalary: Number(monthlySalary),
      ...calc,
      remarks: remarks || "",
      isPublished: false,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: payslip });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "Payslip already exists for this employee and period" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// UPDATE PAYSLIP (in-place, stays published)
exports.updatePayslip = async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id);
    if (!payslip) return res.status(404).json({ error: "Payslip not found" });

    const {
      totalDays, workingDays, paidDays, lwp,
      monthlySalary, componentOverrides, deductionOverrides,
      snapshotOverrides, remarks,
    } = req.body;

    if (snapshotOverrides) await syncStatutoryToProfile(payslip.employee, snapshotOverrides);

    const employee = await User.findById(payslip.employee);
    if (snapshotOverrides && employee) {
      payslip.employeeSnapshot = await buildSnapshot(employee, snapshotOverrides);
    }

    const ms = Number(monthlySalary ?? payslip.monthlySalary);
    const td = Number(totalDays    ?? payslip.totalDays);
    const wd = Number(workingDays  ?? payslip.workingDays);
    const pd = Number(paidDays     ?? payslip.paidDays);
    const calc = calculateSalaryBreakdown(ms, td, wd, pd, componentOverrides || {}, deductionOverrides || {});

    Object.assign(payslip, {
      totalDays:    Number(totalDays    ?? payslip.totalDays),
      workingDays:  wd,
      paidDays:     pd,
      lwp:          Number(lwp          ?? payslip.lwp),
      monthlySalary: ms,
      ...calc,
      remarks: remarks !== undefined ? remarks : payslip.remarks,
    });

    await payslip.save();
    res.json({ success: true, data: payslip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// TOGGLE PUBLISH
exports.togglePublish = async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id).populate("employee", "name email");
    if (!payslip) return res.status(404).json({ error: "Payslip not found" });

    payslip.isPublished = !payslip.isPublished;
    payslip.publishedAt = payslip.isPublished ? new Date() : undefined;
    await payslip.save();

    if (payslip.isPublished && payslip.employee) {
      try {
        sendNotificationToUser(payslip.employee._id.toString(), {
          type: "payslip_published",
          message: "Your payslip for " + payslip.payPeriod + " is now available.",
          payslipId: payslip._id,
        });
      } catch (_) {}
    }

    res.json({ success: true, data: payslip });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// GET ALL PAYSLIPS (admin)
exports.getAllPayslips = async (req, res) => {
  try {
    const { month, status, search } = req.query;
    const filter = {};
    if (month)  filter.payPeriod   = month;
    if (status === "published") filter.isPublished = true;
    if (status === "draft")     filter.isPublished = false;

    let payslips = await Payslip.find(filter)
      .populate("employee", "name employeeId email designation department")
      .sort({ payPeriod: -1, createdAt: -1 });

    if (search) {
      const q = search.toLowerCase();
      payslips = payslips.filter(p =>
        (p.employee?.name       || "").toLowerCase().includes(q) ||
        (p.employee?.employeeId || "").toLowerCase().includes(q) ||
        (p.employeeSnapshot?.name || "").toLowerCase().includes(q)
      );
    }

    res.json({ success: true, data: payslips });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// GET PAYSLIP BY ID (admin)
exports.getPayslipById = async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id)
      .populate("employee", "name employeeId email designation department");
    if (!payslip) return res.status(404).json({ error: "Payslip not found" });
    res.json({ success: true, data: payslip });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// GET EMPLOYEE PAYSLIP HISTORY (admin)
exports.getEmployeePayslipHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const payslips = await Payslip.find({ employee: employeeId })
      .populate("employee", "name employeeId email designation department")
      .sort({ payPeriod: -1 });
    res.json({ success: true, data: payslips });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// MY PAYSLIP HISTORY (employee, published only)
exports.getMyPayslipHistory = async (req, res) => {
  try {
    const payslips = await Payslip.find({ employee: req.user._id, isPublished: true })
      .sort({ payPeriod: -1 });
    res.json({ success: true, data: payslips });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// GET SINGLE PAYSLIP BY MONTH (employee, published only)
exports.getMyPayslip = async (req, res) => {
  try {
    const { month } = req.params;
    const payslip = await Payslip.findOne({
      employee: req.user._id,
      payPeriod: month,
      isPublished: true,
    });
    if (!payslip) return res.status(404).json({ error: "Payslip not found" });
    res.json({ success: true, data: payslip });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// CALCULATE PREVIEW (no save)
exports.calculatePreview = async (req, res) => {
  try {
    const { monthlySalary, totalDays, workingDays, paidDays, componentOverrides, deductionOverrides } = req.body;
    if (!monthlySalary || !totalDays || !workingDays || paidDays === undefined) {
      return res.status(400).json({ error: "monthlySalary, totalDays, workingDays and paidDays are required" });
    }
    const calc = calculateSalaryBreakdown(
      Number(monthlySalary),
      Number(totalDays),
      Number(workingDays),
      Number(paidDays),
      componentOverrides || {},
      deductionOverrides || {}
    );
    res.json({ success: true, data: calc });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// GET PAYSLIP STATS (admin)
exports.getPayslipStats = async (req, res) => {
  try {
    const total     = await Payslip.countDocuments();
    const published = await Payslip.countDocuments({ isPublished: true });
    const drafts    = await Payslip.countDocuments({ isPublished: false });
    res.json({ success: true, data: { total, published, drafts } });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// DELETE PAYSLIP (admin)
exports.deletePayslip = async (req, res) => {
  try {
    const payslip = await Payslip.findByIdAndDelete(req.params.id);
    if (!payslip) return res.status(404).json({ error: "Payslip not found" });
    res.json({ success: true, message: "Payslip deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
