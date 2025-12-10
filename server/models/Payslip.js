const mongoose = require("mongoose");

const payslipSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  payPeriod: {
    type: String, // Format: "YYYY-MM"
    required: true
  },

  // Input fields (entered by Super Admin)
  monthlySalary: {
    type: Number,
    required: true
  },
  workingDays: {
    type: Number,
    required: true
  },
  paidDays: {
    type: Number,
    required: true
  },
  lateDays: {
    type: Number,
    default: 0
  },
  halfDays: {
    type: Number,
    default: 0
  },

  // Salary components (calculated from monthly salary)
  salaryComponents: {
    basic: { type: Number, default: 0 },           // 50%
    hra: { type: Number, default: 0 },             // 35%
    conveyance: { type: Number, default: 0 },      // 5%
    medical: { type: Number, default: 0 },         // 5%
    specialAllowance: { type: Number, default: 0 } // 5%
  },

  // Gross salary components (prorated based on paid days)
  grossComponents: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 }
  },

  grossTotal: {
    type: Number,
    required: true
  },

  // Bonuses
  bonuses: {
    perfectAttendanceBonus: { type: Number, default: 0 } // One day extra pay for perfect attendance (6+ months tenure)
  },

  // Deductions
  deductions: {
    employeePF: { type: Number, default: 0 },     // 12% of basic if basic <= 15000
    esi: { type: Number, default: 0 },            // 0.75% if total <= 21000
    ptax: { type: Number, default: 0 },           // Professional tax based on slabs
    tds: { type: Number, default: 0 },            // Manual entry
    other: { type: Number, default: 0 },          // Manual entry (penalty)
    advance: { type: Number, default: 0 },        // Manual entry
    lateDeduction: { type: Number, default: 0 },  // Auto-calculated
    halfDayDeduction: { type: Number, default: 0 } // Auto-calculated (50% of day salary per half-day)
  },

  totalDeductions: {
    type: Number,
    default: 0
  },

  // Employer contributions
  employerContributions: {
    employerPF: { type: Number, default: 0 },     // 12% of basic if basic <= 15000
    employerESI: { type: Number, default: 0 }     // 3.25% if total <= 21000
  },

  // Final amounts
  netPayment: {
    type: Number,
    required: true
  },
  ctc: {
    type: Number,
    required: true
  },

  remarks: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for unique employee-payPeriod combination
payslipSchema.index({ employee: 1, payPeriod: 1 }, { unique: true });

// Pre-save hook to calculate total deductions
payslipSchema.pre('save', function(next) {
  // Ensure deductions object exists
  if (!this.deductions) {
    this.deductions = {};
  }

  // Calculate total deductions
  this.totalDeductions = (this.deductions.employeePF || 0) +
                        (this.deductions.esi || 0) +
                        (this.deductions.ptax || 0) +
                        (this.deductions.tds || 0) +
                        (this.deductions.other || 0) +
                        (this.deductions.advance || 0) +
                        (this.deductions.lateDeduction || 0) +
                        (this.deductions.halfDayDeduction || 0);

  next();
});

module.exports = mongoose.model("Payslip", payslipSchema);