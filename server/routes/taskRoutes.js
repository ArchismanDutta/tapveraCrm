const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const taskController = require("../controllers/taskController");

// Create task (admin, super-admin)
router.post(
  "/",
  protect,
  authorize("admin", "super-admin"),
  taskController.createTask
);

// Get own tasks (all authenticated users)
router.get("/", protect, taskController.getTasks);

// Get task by ID (authorized users)
router.get("/:taskId", protect, taskController.getTaskById);

// Update task status (assignedBy or assignedTo)
router.patch("/:taskId/status", protect, taskController.updateTaskStatus);

// Edit task (only admin/super-admin who assigned)
router.put(
  "/:taskId",
  protect,
  authorize("admin", "super-admin"),
  taskController.editTask
);

// Delete task (only admin/super-admin who assigned)
router.delete(
  "/:taskId",
  protect,
  authorize("admin", "super-admin"),
  taskController.deleteTask
);

module.exports = router;
