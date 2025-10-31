const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    qrCodeData: {
      type: String,
      required: true,
    },
    transactionId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      default: "UPI", // Can be extended to support multiple payment methods
    },
    // Task statistics at the time of payment creation
    taskStats: {
      dueTasks: {
        type: Number,
        default: 0,
      },
      rejectedTasks: {
        type: Number,
        default: 0,
      },
    },
    // Payment lifecycle tracking
    activatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    activatedAt: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    // Additional metadata
    notes: {
      type: String,
      trim: true,
    },
    // Payment reference (if external payment system is used)
    paymentReference: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
paymentSchema.index({ employee: 1, status: 1 });
paymentSchema.index({ activatedBy: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

// Virtual to check if payment is active (pending)
paymentSchema.virtual("isActive").get(function () {
  return this.status === "pending";
});

// Method to approve payment
paymentSchema.methods.approve = function (adminId) {
  this.status = "approved";
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  return this.save();
};

// Method to reject payment
paymentSchema.methods.reject = function (adminId, notes) {
  this.status = "rejected";
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Method to cancel payment
paymentSchema.methods.cancel = function (notes) {
  this.status = "cancelled";
  if (notes) {
    this.notes = notes;
  }
  return this.save();
};

// Static method to get active payment for an employee
paymentSchema.statics.getActivePayment = async function (employeeId) {
  return this.findOne({
    employee: employeeId,
    status: "pending",
  }).populate("activatedBy", "name email employeeId");
};

// Static method to get payment history for an employee
paymentSchema.statics.getPaymentHistory = async function (employeeId, limit = 10) {
  return this.find({
    employee: employeeId,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("activatedBy", "name email employeeId")
    .populate("approvedBy", "name email employeeId");
};

// Ensure virtuals are included in JSON
paymentSchema.set("toJSON", { virtuals: true });
paymentSchema.set("toObject", { virtuals: true });

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
