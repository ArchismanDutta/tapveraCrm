const ClientRequest = require("../models/ClientRequest");
const Client = require("../models/Client");
const User = require("../models/User");

// Create a new client request (quote or support)
exports.createRequest = async (req, res) => {
  try {
    const {
      type,
      title,
      description,
      projectType,
      budget,
      timeline,
      category,
      priority,
    } = req.body;

    // Get client ID from authenticated user
    const clientId = req.user._id;

    // Validate required fields
    if (!type || !title || !description) {
      return res.status(400).json({
        message: "Type, title, and description are required",
      });
    }

    // Validate type
    if (!["quote", "support"].includes(type)) {
      return res.status(400).json({
        message: "Type must be either 'quote' or 'support'",
      });
    }

    // Create request
    const request = new ClientRequest({
      client: clientId,
      type,
      title,
      description,
      projectType: projectType || "",
      budget: budget || "",
      timeline: timeline || "",
      category: category || "",
      priority: priority || "medium",
      status: "pending",
      unreadCount: {
        admin: 1, // Admin hasn't seen this yet
        client: 0,
      },
    });

    await request.save();

    // Populate client details
    await request.populate("client", "clientName businessName email");

    // Broadcast to super admins via WebSocket
    try {
      const { broadcastToSuperAdmins } = require("../utils/websocket");
      broadcastToSuperAdmins("new-client-request", {
        requestId: request._id,
        type: request.type,
        title: request.title,
        client: {
          _id: request.client._id,
          name: request.client.clientName || request.client.businessName,
        },
      });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (new request):", wsError.message);
    }

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error creating client request:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Get all requests (for super admin)
exports.getAllRequests = async (req, res) => {
  try {
    const { type, status, priority } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const requests = await ClientRequest.find(filter)
      .populate("client", "clientName businessName email contact")
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Get client's own requests
exports.getMyRequests = async (req, res) => {
  try {
    const clientId = req.user._id;
    const { type, status } = req.query;

    const filter = { client: clientId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const requests = await ClientRequest.find(filter)
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error("Error fetching client requests:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Get single request by ID
exports.getRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ClientRequest.findById(id)
      .populate("client", "clientName businessName email contact")
      .populate("assignedTo", "name email avatar")
      .populate("resolvedBy", "name email");

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    // Check authorization
    const isClient = req.user.role === "client";
    const isSuperAdmin = req.user.role === "super-admin";

    if (isClient && request.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Not authorized to view this request",
      });
    }

    if (!isClient && !isSuperAdmin && !["admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Not authorized to view this request",
      });
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error fetching request:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Update request status or assign to admin
exports.updateRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, assignedTo, resolution } = req.body;

    const request = await ClientRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    // Update fields
    if (status) request.status = status;
    if (priority) request.priority = priority;
    if (assignedTo) request.assignedTo = assignedTo;
    if (resolution) request.resolution = resolution;

    // If resolving/closing, set resolved details
    if (status === "resolved" || status === "closed") {
      request.resolvedBy = req.user._id;
      request.resolvedAt = new Date();
    }

    await request.save();

    await request.populate("client", "clientName businessName email");
    await request.populate("assignedTo", "name email");
    await request.populate("resolvedBy", "name email");

    // Broadcast update to relevant parties
    try {
      const { broadcastRequestUpdate } = require("../utils/websocket");
      broadcastRequestUpdate(request._id.toString(), {
        requestId: request._id,
        status: request.status,
        priority: request.priority,
      });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (request update):", wsError.message);
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error updating request:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Send message in request chat
exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        message: "Message cannot be empty",
      });
    }

    const request = await ClientRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    // Check authorization
    const isClient = req.user.role === "client";
    const isSuperAdmin = req.user.role === "super-admin";

    if (isClient && request.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Not authorized to send messages in this request",
      });
    }

    if (!isClient && !isSuperAdmin && !["admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Not authorized to send messages in this request",
      });
    }

    // Determine sender model and name
    const senderModel = isClient ? "Client" : "User";
    const senderName = isClient
      ? req.user.clientName || req.user.businessName
      : req.user.name;

    // Add message
    request.messages.push({
      sentBy: req.user._id,
      senderModel,
      senderName,
      message: message.trim(),
      timestamp: new Date(),
      read: false,
    });

    // Update unread count
    if (isClient) {
      request.unreadCount.admin += 1;
    } else {
      request.unreadCount.client += 1;
    }

    // Update status to in-progress if still pending
    if (request.status === "pending") {
      request.status = "in-progress";
    }

    await request.save();

    // Populate for response
    await request.populate("client", "clientName businessName email");
    await request.populate("assignedTo", "name email avatar");

    // Broadcast message via WebSocket
    try {
      const { broadcastRequestMessage } = require("../utils/websocket");
      const newMessage = request.messages[request.messages.length - 1];

      broadcastRequestMessage(request._id.toString(), {
        requestId: request._id,
        message: newMessage,
        senderType: isClient ? "client" : "admin",
      });
    } catch (wsError) {
      console.warn("WebSocket broadcast failed (request message):", wsError.message);
    }

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Mark messages as read
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ClientRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    const isClient = req.user.role === "client";

    // Mark all unread messages as read
    request.messages.forEach((msg) => {
      // Client marks admin messages as read
      if (isClient && msg.senderModel === "User") {
        msg.read = true;
      }
      // Admin marks client messages as read
      else if (!isClient && msg.senderModel === "Client") {
        msg.read = true;
      }
    });

    // Reset unread count
    if (isClient) {
      request.unreadCount.client = 0;
    } else {
      request.unreadCount.admin = 0;
    }

    await request.save();

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Delete request (super admin only)
exports.deleteRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await ClientRequest.findByIdAndDelete(id);

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    res.json({
      success: true,
      message: "Request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting request:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};

// Get request statistics (for super admin dashboard)
exports.getRequestStats = async (req, res) => {
  try {
    const stats = {
      total: await ClientRequest.countDocuments(),
      pending: await ClientRequest.countDocuments({ status: "pending" }),
      inProgress: await ClientRequest.countDocuments({ status: "in-progress" }),
      resolved: await ClientRequest.countDocuments({ status: "resolved" }),
      closed: await ClientRequest.countDocuments({ status: "closed" }),
      quotes: await ClientRequest.countDocuments({ type: "quote" }),
      support: await ClientRequest.countDocuments({ type: "support" }),
      urgent: await ClientRequest.countDocuments({ priority: "urgent", status: { $in: ["pending", "in-progress"] } }),
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error fetching request stats:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
};
