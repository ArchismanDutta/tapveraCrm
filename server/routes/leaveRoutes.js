const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const { protect, authorize } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/upload");

// Employee routes
router.post("/", protect, authorize("employee"), upload.single("document"), leaveController.createLeave);
router.get("/mine", protect, authorize("employee"), leaveController.getUserLeaves);
router.get("/team", protect, authorize("employee", "admin", "super-admin"), leaveController.getTeamLeaves);

// Admin routes
router.get("/", protect, authorize("admin", "super-admin"), leaveController.getAllLeaves);
router.patch("/:id", protect, authorize("admin", "super-admin"), leaveController.updateLeaveStatus);

// Delete leave request
router.delete("/:id", protect, leaveController.deleteLeave);

module.exports = router;
