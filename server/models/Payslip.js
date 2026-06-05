const mongoose = require("mongoose");

// Snapshot of employee statutory details at payslip creation time
const employeeSnapshotSchema = new mongoose.Schema({
  name:              { type: String, default: "" },
  employeeId:        { type: String, default: "" },
  designation:       { type: String, default: "" },
  department:        { type: String, default: "" },
  location:          { type: String, default: "" },
  doj:               { type: Date },
  pan:               { type: String, default: "" },
  uan:               { type: String, default: "" },
  pfNumber:          { type: String, default: "" },
  esiNumber:         { type: String, default: "" },
  bankAccountNumber: { type: String, default: "" },
  bankName:          { type: String, default: "" },
  ifscCode:          { type: String, default: "" },
}, { _id: false });

const payslipSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  payPeriod: {
    type: String,   // "YYYY-MM"
    required: true,
  },

  // Snapshot of employee info at time of generation
  employeeSnapshot: {
    type: employeeSnapshotSchema,
    default: () => ({}),
  },

  // Attendance inputs
  totalDays:   { type: Number, required: true },
  workingDays: { type: Number, required: true },
  paidDays:    { type: Number, required: true },
  lwp:         { type: Number, default: 0 },

  // Salary input
  monthlySalary: { type: Number, required: true },

  // Salary components (monthly, before proration)
  salaryComponents: {
    basic:            { type: Number, default: 0 },
    hra:              { type: Number, default: 0 },
    conveyance:       { type: Number, default: 0 },
    medical:          { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
  },

  // Prorated paid components (component / workingDays * paidDays)
  paidComponents: {
    basic:            { type: Number, default: 0 },
    hra:              { type: Number, default: 0 },
    conveyance:       { type: Number, default: 0 },
    medical:          { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
  },

  grossTotal: { type: Number, default: 0 },
  netTotal:   { type: Number, default: 0 },

  // Eligibility flags
  pfEligible:  { type: Boolean, default: false },
  esiEligible: { type: Boolean, default: false },

  // Deductions
  deductions: {
    employeePF:  { type: Number, default: 0 },
    employeeESI: { type: Number, default: 0 },
    ptax:        { type: Number, default: 0 },
    tds:         { type: Number, default: 0 },
    advance:     { type: Number, default: 0 },
    other:       { type: Number, default: 0 },
    otherLabel:  { type: String, default: "" },
  },

  totalDeductions: { type: Number, default: 0 },

  // Employer contributions
  employerContributions: {
    employerPF:  { type: Number, default: 0 },
    employerESI: { type: Number, default: 0 },
  },

  // Final figures
  netSalary: { type: Number, required: true },
  ctc:       { type: Number, required: true },

  // Remarks
  remarks: { type: String, default: "" },

  // Status
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, {
  timestamps: true,
});

// Unique per employee-period
payslipSchema.index({ employee: 1, payPeriod: 1 }, { unique: true });

// Auto-compute totalDeductions on save
payslipSchema.pre("save", function (next) {
  const d = this.deductions || {};
  this.totalDeductions =
    (d.employeePF  || 0) +
    (d.employeeESI || 0) +
    (d.ptax        || 0) +
    (d.tds         || 0) +
    (d.advance     || 0) +
    (d.other       || 0);
  next();
});

module.exports = mongoose.model("Payslip", payslipSchema);
