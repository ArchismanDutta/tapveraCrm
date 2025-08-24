// routes/userRoutes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middlewares/authMiddleware");
// NOTE: Your taskRoutes imported authorize from "../middlewares/roleMiddleware".
// To stay consistent, we do the same here:
const { authorize } = require("../middlewares/roleMiddleware");

const {
  createEmployee,
  getAllUsers,
  getMe,
} = require("../controllers/userController");

// List all users (for assigning tasks) — admin/super-admin only
router.get("/", protect, authorize("admin", "super-admin"), getAllUsers);

// Current user
router.get("/me", protect, getMe);

// Create employee
router.post("/create", protect, authorize("admin", "hr", "super-admin"), createEmployee);

module.exports = router;
