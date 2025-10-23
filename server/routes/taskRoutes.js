// File: routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const taskController = require("../controllers/taskController");

// ------------------- REMARK ROUTES -------------------
// Placed BEFORE :taskId to avoid shadowing
router.post("/:taskId/remarks", protect, taskController.addRemark);
router.get("/:taskId/remarks", protect, taskController.getRemarks);

// ------------------- TASK ROUTES -------------------

// Create task (Admin / Super-admin only)
router.post("/", protect, authorize("admin", "super-admin"), taskController.createTask);

// Get all tasks
// Users see their own tasks; Admin/Super-admin see all tasks
router.get("/", protect, taskController.getTasks);

// Get single task by ID
// Only assigned users, assignedBy, or Admin/Super-admin can access
router.get("/:taskId", protect, taskController.getTaskById);

// Update task status
// Only assigned users or assignedBy can update
router.patch("/:taskId/status", protect, taskController.updateTaskStatus);

// Reject task (Admin / Super-admin only)
router.patch("/:taskId/reject", protect, authorize("admin", "super-admin"), taskController.rejectTask);

// ------------------- SUBMISSION ROUTES -------------------
// Submit task details (Employee - assigned users only)
router.post("/:taskId/submit", protect, taskController.submitTaskDetails);

// Approve task submission (Admin / Super-admin only)
router.patch("/:taskId/approve", protect, authorize("admin", "super-admin"), taskController.approveTaskSubmission);

// Reject task submission (Admin / Super-admin only)
router.patch("/:taskId/reject-submission", protect, authorize("admin", "super-admin"), taskController.rejectTaskSubmission);

// Edit task
// Admin / Super-admin or assignedBy can edit (authorization handled in controller)
router.put("/:taskId", protect, taskController.editTask);

// Delete task
// Admin / Super-admin or assignedBy can delete (authorization handled in controller)
router.delete("/:taskId", protect, taskController.deleteTask);

// Get employee task analytics
// Admin / Super-admin only
router.get("/analytics/employee/:employeeId", protect, authorize("admin", "super-admin"), taskController.getEmployeeTaskAnalytics);

module.exports = router;
