const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const taskController = require("../controllers/taskController");

// Only admin and super-admin can create tasks
router.post(
  "/",
  protect,
  authorize("admin", "super-admin"),
  taskController.createTask
);

// Any authenticated user can view their tasks
router.get("/", protect, taskController.getTasks);

module.exports = router;
