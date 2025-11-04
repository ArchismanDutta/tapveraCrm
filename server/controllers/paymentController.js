const Payment = require("../models/Payment");
const User = require("../models/User");
const Task = require("../models/Task");
const crypto = require("crypto");
const { convertToCloudFrontUrl, isS3Configured } = require("../config/s3Config");

/**
 * Get all employees with their task statistics
 * @route GET /api/payments/employees-stats
 * @access Super Admin only
 */
exports.getEmployeesWithTaskStats = async (req, res) => {
  try {
    // Get all employees (excluding super-admin and clients)
    const employees = await User.find({
      role: { $in: ["employee", "admin", "hr"] },
      status: "active",
    })
      .select("employeeId name email department designation avatar")
      .lean();

    // Calculate task statistics for each employee
    const employeesWithStats = await Promise.all(
      employees.map(async (employee) => {
        // Count due tasks (tasks that are past due date and not completed)
        const dueTasks = await Task.countDocuments({
          assignedTo: employee._id,
          status: { $in: ["pending", "in-progress"] },
          dueDate: { $lt: new Date() },
        });

        // Count rejected tasks
        const rejectedTasks = await Task.countDocuments({
          assignedTo: employee._id,
          status: "rejected",
        });

        // Count tasks with rejected submissions
        const rejectedSubmissions = await Task.countDocuments({
          assignedTo: employee._id,
          approvalStatus: "rejected",
        });

        // Total rejection count (rejected tasks + rejected submissions)
        const totalRejections = rejectedTasks + rejectedSubmissions;

        // Check if employee has an active payment pending
        const activePayment = await Payment.findOne({
          employee: employee._id,
          status: "pending",
        }).select("amount reason createdAt");

        return {
          ...employee,
          taskStats: {
            dueTasks,
            rejectedTasks: totalRejections,
          },
          activePayment: activePayment
            ? {
                _id: activePayment._id,
                amount: activePayment.amount,
                reason: activePayment.reason,
                activatedAt: activePayment.createdAt,
              }
            : null,
          hasActivePayment: !!activePayment,
        };
      })
    );

    // Sort by highest number of due tasks and rejections
    employeesWithStats.sort((a, b) => {
      const aScore = a.taskStats.dueTasks + a.taskStats.rejectedTasks;
      const bScore = b.taskStats.dueTasks + b.taskStats.rejectedTasks;
      return bScore - aScore;
    });

    res.status(200).json({
      success: true,
      data: employeesWithStats,
      count: employeesWithStats.length,
    });
  } catch (error) {
    console.error("Error fetching employees with task stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee statistics",
      error: error.message,
    });
  }
};

/**
 * Activate QR code payment for an employee
 * @route POST /api/payments/activate
 * @access Super Admin only
 */
exports.activatePayment = async (req, res) => {
  try {
    const { employeeId, amount, reason, notes } = req.body;
    const adminId = req.user._id;
    const qrCodeFile = req.file;

    // Validate input
    if (!employeeId || !amount || !reason) {
      return res.status(400).json({
        success: false,
        message: "Employee ID, amount, and reason are required",
      });
    }

    if (!qrCodeFile) {
      return res.status(400).json({
        success: false,
        message: "QR code image is required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // Check if employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if employee already has an active payment
    const existingPayment = await Payment.findOne({
      employee: employeeId,
      status: "pending",
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "Employee already has an active payment pending",
        payment: existingPayment,
      });
    }

    // Generate unique transaction ID
    const transactionId = `TXN-${Date.now()}-${crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()}`;

    // Get task statistics
    const dueTasks = await Task.countDocuments({
      assignedTo: employeeId,
      status: { $in: ["pending", "in-progress"] },
      dueDate: { $lt: new Date() },
    });

    const rejectedTasks = await Task.countDocuments({
      assignedTo: employeeId,
      status: "rejected",
    });

    const rejectedSubmissions = await Task.countDocuments({
      assignedTo: employeeId,
      approvalStatus: "rejected",
    });

    // Get QR code URL from uploaded file
    let qrCodeUrl;
    if (isS3Configured) {
      // S3 upload - convert to CloudFront URL
      qrCodeUrl = convertToCloudFrontUrl(qrCodeFile.location);
      console.log(`QR code uploaded to S3: ${qrCodeUrl}`);
    } else {
      // Local upload - use relative path
      qrCodeUrl = `/uploads/${qrCodeFile.filename}`;
      console.log(`QR code uploaded locally: ${qrCodeUrl}`);
    }

    // Create payment record
    const payment = await Payment.create({
      employee: employeeId,
      amount,
      reason,
      transactionId,
      qrCodeData: qrCodeUrl,
      taskStats: {
        dueTasks,
        rejectedTasks: rejectedTasks + rejectedSubmissions,
      },
      activatedBy: adminId,
      notes,
    });

    // Populate employee and admin details
    await payment.populate([
      { path: "employee", select: "employeeId name email department avatar" },
      { path: "activatedBy", select: "name email employeeId" },
    ]);

    res.status(201).json({
      success: true,
      message: "Payment QR code activated successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Error activating payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to activate payment",
      error: error.message,
    });
  }
};

/**
 * Get active payment for current user
 * @route GET /api/payments/my-active
 * @access Employee
 */
exports.getMyActivePayment = async (req, res) => {
  try {
    const userId = req.user._id;

    const payment = await Payment.findOne({
      employee: userId,
      status: "pending",
    }).populate("activatedBy", "name email employeeId");

    res.status(200).json({
      success: true,
      data: payment,
      hasActivePayment: !!payment,
    });
  } catch (error) {
    console.error("Error fetching active payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch active payment",
      error: error.message,
    });
  }
};

/**
 * Get all pending payments (for super admin)
 * @route GET /api/payments/pending
 * @access Super Admin only
 */
exports.getPendingPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ status: "pending" })
      .populate("employee", "employeeId name email department avatar")
      .populate("activatedBy", "name email employeeId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    console.error("Error fetching pending payments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending payments",
      error: error.message,
    });
  }
};

/**
 * Approve payment
 * @route PATCH /api/payments/:paymentId/approve
 * @access Super Admin only
 */
exports.approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;
    const adminId = req.user._id;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status}`,
      });
    }

    // Approve the payment
    await payment.approve(adminId);

    if (notes) {
      payment.notes = notes;
      await payment.save();
    }

    // Populate details
    await payment.populate([
      { path: "employee", select: "employeeId name email department avatar" },
      { path: "activatedBy", select: "name email employeeId" },
      { path: "approvedBy", select: "name email employeeId" },
    ]);

    res.status(200).json({
      success: true,
      message: "Payment approved successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Error approving payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve payment",
      error: error.message,
    });
  }
};

/**
 * Reject payment
 * @route PATCH /api/payments/:paymentId/reject
 * @access Super Admin only
 */
exports.rejectPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;
    const adminId = req.user._id;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Payment is already ${payment.status}`,
      });
    }

    // Reject the payment
    await payment.reject(adminId, notes);

    // Populate details
    await payment.populate([
      { path: "employee", select: "employeeId name email department avatar" },
      { path: "activatedBy", select: "name email employeeId" },
      { path: "approvedBy", select: "name email employeeId" },
    ]);

    res.status(200).json({
      success: true,
      message: "Payment rejected successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Error rejecting payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject payment",
      error: error.message,
    });
  }
};

/**
 * Cancel payment (by super admin)
 * @route DELETE /api/payments/:paymentId
 * @access Super Admin only
 */
exports.cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel payment that is ${payment.status}`,
      });
    }

    // Cancel the payment
    await payment.cancel(notes);

    res.status(200).json({
      success: true,
      message: "Payment cancelled successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Error cancelling payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel payment",
      error: error.message,
    });
  }
};

/**
 * Get payment history for an employee
 * @route GET /api/payments/history/:employeeId
 * @access Super Admin or Employee (own history)
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user._id;

    // Check if user is accessing their own history or is admin
    if (req.user.role !== "super-admin" && employeeId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own payment history",
      });
    }

    const payments = await Payment.getPaymentHistory(employeeId, limit);

    res.status(200).json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment history",
      error: error.message,
    });
  }
};

/**
 * Get payment by ID
 * @route GET /api/payments/:paymentId
 * @access Super Admin or Employee (if payment belongs to them)
 */
exports.getPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findById(paymentId)
      .populate("employee", "employeeId name email department avatar")
      .populate("activatedBy", "name email employeeId")
      .populate("approvedBy", "name email employeeId");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check if user has access to this payment
    if (
      req.user.role !== "super-admin" &&
      payment.employee._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this payment",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error fetching payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment",
      error: error.message,
    });
  }
};
