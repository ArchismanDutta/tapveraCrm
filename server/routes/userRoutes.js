// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const userController = require("../controllers/userController");

// Route to create new employee (admin/hr/super-admin only)
router.post(
  "/create",
  protect,
  authorize("admin", "super-admin", "hr"),
  userController.createEmployee
);

// Route to get current logged-in user
router.get("/me", protect, userController.getMe);

module.exports = router;
