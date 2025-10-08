// routes/notepadRoutes.js
const express = require("express");
const router = express.Router();
const notepadController = require("../controllers/notepadController");
const { protect } = require("../middlewares/authMiddleware");

// User routes (employee, admin, hr)
router.get("/my-notepad", protect, notepadController.getMyNotepad);
router.put("/my-notepad", protect, notepadController.updateMyNotepad);
router.get("/stats", protect, notepadController.getNotepadStats);

// Super Admin routes
router.get("/all-users", protect, notepadController.getAllUserNotepads);
router.get("/user/:userId", protect, notepadController.getUserNotepad);

module.exports = router;
