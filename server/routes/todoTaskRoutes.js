const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const todoTaskController = require("../controllers/todoTaskController");

// Get today's tasks
router.get("/", protect, todoTaskController.getTodoTasksByDate);

// Get upcoming tasks
router.get("/upcoming", protect, todoTaskController.getUpcomingTasks);

// Create a new task
router.post("/", protect, todoTaskController.createTodoTask);

// Update task fields (including marking complete/incomplete)
router.put("/:id", protect, todoTaskController.updateTodoTask);

// Move a task to another date
router.post("/:id/move", protect, todoTaskController.moveTodoTask);

// Delete a task
router.delete("/:id", protect, todoTaskController.deleteTodoTask);

module.exports = router;
