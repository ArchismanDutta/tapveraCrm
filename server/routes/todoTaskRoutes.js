// routes/todoRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const todoTaskController = require("../controllers/todoTaskController");

router.get("/", protect, todoTaskController.getTodoTasksByDate);
router.get("/upcoming", protect, todoTaskController.getUpcomingTasks); // Added route for upcoming tasks
router.post("/", protect, todoTaskController.createTodoTask);
router.put("/:id", protect, todoTaskController.updateTodoTask);
router.post("/:id/move", protect, todoTaskController.moveTodoTask);

module.exports = router;
