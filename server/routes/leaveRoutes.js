// routes/leaveRoutes.js
const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Employee routes
router.post("/", protect, authorize("employee"), leaveController.createLeave);
router.get("/mine", protect, authorize("employee"), leaveController.getUserLeaves);

// Team leaves route (now accessible to employees too)
router.get(
  "/team",
  protect,
  authorize("employee", "admin", "super-admin"), // allow employee to view their department leaves
  leaveController.getTeamLeaves
);

// Admin & Super-admin routes
router.get("/", protect, authorize("admin", "super-admin"), leaveController.getAllLeaves);
router.patch("/:id", protect, authorize("admin", "super-admin"), leaveController.updateLeaveStatus);

// Delete leave request (employee or admin)
router.delete("/:id", protect, leaveController.deleteLeave);

module.exports = router;
