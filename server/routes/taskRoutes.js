// File: routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const taskController = require("../controllers/taskController");

// ------------------- ANALYTICS -------------------
// Admin / Super-admin only. Registered before /:taskId routes for clarity.
router.get(
  "/analytics/employee/:employeeId",
  protect,
  authorize("admin", "super-admin"),
  taskController.getEmployeeTaskAnalytics
);

// ------------------- REMARKS -------------------
// Involved users (assignee, creator) or admins — enforced in controller
router.post("/:taskId/remarks", protect, taskController.addRemark);
router.get("/:taskId/remarks", protect, taskController.getRemarks);

// ------------------- TASKS -------------------

// Create task — any authenticated user can create and assign tasks
router.post("/", protect, taskController.createTask);

// List tasks
// Admin/Super-admin: all | Client: their projects' tasks | Others: own tasks
router.get("/", protect, taskController.getTasks);

// Get single task (assignee, creator, or admin — enforced in controller)
router.get("/:taskId", protect, taskController.getTaskById);

// Update task status (assignee, creator, or admin — enforced in controller)
// "rejected" is not allowed here; use the reject endpoint
router.patch("/:taskId/status", protect, taskController.updateTaskStatus);

// Reject a completed task with a reason (Admin / Super-admin only)
router.patch(
  "/:taskId/reject",
  protect,
  authorize("admin", "super-admin"),
  taskController.rejectTask
);

// Edit task (Admin / Super-admin or creator — enforced in controller)
router.put("/:taskId", protect, taskController.editTask);

// Delete task (Admin / Super-admin or creator — enforced in controller)
router.delete("/:taskId", protect, taskController.deleteTask);

module.exports = router;
