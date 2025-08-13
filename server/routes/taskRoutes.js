const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const taskController = require("../controllers/taskController");

// Create task
router.post("/", protect, authorize("admin", "super-admin"), taskController.createTask);

// Get tasks
router.get("/", protect, taskController.getTasks);

// Get task by ID
router.get("/:taskId", protect, taskController.getTaskById);

// Update task status
router.patch("/:taskId/status", protect, taskController.updateTaskStatus);

// Edit task
router.put("/:taskId", protect, authorize("admin", "super-admin"), taskController.editTask);

// Delete task
router.delete("/:taskId", protect, authorize("admin", "super-admin"), taskController.deleteTask);

module.exports = router;
