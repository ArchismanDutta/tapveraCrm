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
  ctc: {
    type: Number,
    required: true
  },
  basicSalary: {
    type: Number,
    required: true
  },
  grossSalary: {
    type: Number,
    required: true
  },
  netSalary: {
    type: Number,
    required: true
  },
  deductions: {
    pf: {
      type: Number,
      default: 0
    },
    esi: {
      type: Number,
      default: 0
    },
    ptax: {
      type: Number,
      default: 0
    },
    lateDeduction: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    }
  },
  totalDeductions: {
    type: Number,
    default: 0
  },
  workingDays: {
    type: Number,
    default: 22
  },
  presentDays: {
    type: Number,
    default: 0
  },
  lateDays: {
    type: Number,
    default: 0
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
  this.totalDeductions = (this.deductions.pf || 0) +
                        (this.deductions.esi || 0) +
                        (this.deductions.ptax || 0) +
                        (this.deductions.lateDeduction || 0) +
                        (this.deductions.other || 0);

  next();
});

module.exports = mongoose.model("Payslip", payslipSchema);