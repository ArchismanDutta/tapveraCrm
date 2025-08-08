const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");
const userController = require("../controllers/userController");

// Get own profile - any authenticated user
router.get("/me", protect, userController.getProfile);

// Update own profile - only employee (you can extend later if needed)
router.put("/me", protect, authorize("employee"), userController.updateProfile);

// Admin and Super Admin can get list of all users
router.get(
  "/",
  protect,
  authorize("admin", "super-admin"),
  userController.getUsers
);

module.exports = router;
