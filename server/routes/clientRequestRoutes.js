const express = require("express");
const router = express.Router();
const {
  createRequest,
  getAllRequests,
  getMyRequests,
  getRequestById,
  updateRequest,
  sendMessage,
  markMessagesAsRead,
  deleteRequest,
  getRequestStats,
} = require("../controllers/clientRequestController");
const { protect } = require("../middlewares/authMiddleware");

// Client routes (protected - client role)
router.post("/", protect, createRequest); // Create quote or support request
router.get("/my-requests", protect, getMyRequests); // Get client's own requests

// Shared routes (client and admin can access)
router.get("/:id", protect, getRequestById); // Get single request
router.post("/:id/messages", protect, sendMessage); // Send message in request chat
router.put("/:id/read", protect, markMessagesAsRead); // Mark messages as read

// Admin routes (protected - admin/super-admin/hr)
router.get("/", protect, getAllRequests); // Get all requests
router.put("/:id", protect, updateRequest); // Update request status/assignment
router.delete("/:id", protect, deleteRequest); // Delete request (super admin only)
router.get("/stats/overview", protect, getRequestStats); // Get statistics

module.exports = router;
