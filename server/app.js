// File: server/app.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

// =====================
// Routes
// =====================
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
const passwordRoutes = require("./routes/passwordRoutes");
const testRoutes = require("./routes/testRoutes");
const emailRoutes = require("./routes/emailRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const todoTaskRoutes = require("./routes/todoTaskRoutes");
const chatRoutes = require("./routes/chatRoutes");
// OLD SYSTEM ROUTES - DEPRECATED
// const statusRoutes = require("./routes/statusRoutes");
// const summaryRoutes = require("./routes/summaryRoutes");
const wishRoutes = require("./routes/wishRoutes");
const flexibleShiftRoutes = require("./routes/flexibleShiftRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const adminAttendanceRoutes = require("./routes/adminAttendanceRoutes");
const manualAttendanceRoutes = require("./routes/manualAttendanceRoutes");
const holidayRoutes = require("./routes/holidayRoutes");
const newAttendanceRoutes = require("./routes/newAttendanceRoutes"); // New date-centric attendance system
const superAdminRoutes = require("./routes/superAdminRoutes"); // Make sure this file exists
const payslipRoutes = require("./routes/payslipRoutes");
const autoPayrollRoutes = require("./routes/autoPayrollRoutes"); // Automatic payroll generation
const celebrationRoutes = require("./routes/celebrationRoutes");
const leadRoutes = require("./routes/leadRoutes");
const callbackRoutes = require("./routes/callbackRoutes");
const notepadRoutes = require("./routes/notepadRoutes");
const clientRoutes = require("./routes/clientRoutes");
const projectRoutes = require("./routes/projectRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const aiAnalyticsRoutes = require("./routes/aiAnalyticsRoutes");
const tapRoutes = require("./routes/tapRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const keywordRoutes = require("./routes/keywordRoutes");
const blogRoutes = require("./routes/blogRoutes");
const backlinkRoutes = require("./routes/backlinkRoutes");
const screenshotRoutes = require("./routes/screenshotRoutes");
const projectReportRoutes = require("./routes/projectReportRoutes");
const clientRemarkRoutes = require("./routes/clientRemarkRoutes");
const sheetRoutes = require("./routes/sheetRoutes");

// Controllers
const ChatController = require("./controllers/chatController");
const { setWebSocketUsers } = require("./utils/websocket");

const app = express();
const server = http.createServer(app);

// =====================
// Middleware
// =====================
app.use(express.json());
app.use(morgan("dev"));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// CORS setup
const frontendOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  "http://tapvera-crm-frontend.s3-website.ap-south-1.amazonaws.com",
]
.filter(Boolean)
.flatMap(origin => origin.split(',').map(o => o.trim()))
.filter(Boolean);


if (!frontendOrigins.length) {
  console.warn(
    "⚠️ No FRONTEND_ORIGIN or FRONTEND_URL set. CORS may block requests."
  );
}

console.log("🌐 CORS configured for origins:", frontendOrigins);

app.use(
  cors({
    origin: frontendOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
    ],
    credentials: true,
  })
);

// =====================
// Health check & Diagnostics
// =====================
app.get("/", (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push(middleware.route.path);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push(handler.route.path);
        }
      });
    }
  });

  res.json({
    status: "ok",
    message: "Your server is up and running",
    timestamp: Date.now(),
    version: "v2.3-email-service-fix", // Updated version
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
    routesLoaded: routes,
  });
});

// AWS Elastic Beanstalk health check endpoint
app.get("/health", (req, res) => {
  const healthCheck = {
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: process.env.PORT || 5000,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  };

  // Return 200 if everything is OK, 503 if database is down
  const statusCode = mongoose.connection.readyState === 1 ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// =====================
// API Routes
// =====================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/test", testRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/todos", todoTaskRoutes);
// OLD SYSTEM ROUTES - DEPRECATED - Use /api/attendance-new instead
// app.use("/api/status", statusRoutes);
// app.use("/api/summary", summaryRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wishes", wishRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/flexible-shifts", flexibleShiftRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/admin", adminAttendanceRoutes);
app.use("/api/admin/manual-attendance", manualAttendanceRoutes);
app.use("/api/attendance-new", newAttendanceRoutes); // New date-centric attendance system
app.use("/api/super-admin", superAdminRoutes); // Super admin route added
app.use("/api/payslips", payslipRoutes);
app.use("/api/auto-payroll", autoPayrollRoutes); // Automatic payroll generation
app.use("/api/celebrations", celebrationRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/callbacks", callbackRoutes);
app.use("/api/notepad", notepadRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/ai-analytics", aiAnalyticsRoutes);
app.use("/api/tap", tapRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/sheets", sheetRoutes);
// Mount specific project sub-routes BEFORE the main projectRoutes
// This ensures routes like /:projectId/blogs are matched before /:id
app.use("/api/projects", keywordRoutes);
app.use("/api/projects", blogRoutes);
app.use("/api/projects", backlinkRoutes);
app.use("/api/projects", screenshotRoutes);
app.use("/api/projects", projectReportRoutes);
app.use("/api/projects", clientRemarkRoutes);
// Mount general project routes LAST
app.use("/api/projects", projectRoutes);

// =====================
// Serve frontend in production
// =====================
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

// =====================
// Error handler
// =====================
app.use((err, req, res, next) => {
  console.error("❌ Unexpected error:", err.stack || err);
  console.error("Request path:", req.path);
  console.error("Request method:", req.method);

  // In development, send more details
  if (process.env.NODE_ENV === 'development') {
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      stack: err.stack
    });
  } else {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =====================
// WebSocket Setup
// =====================
const wss = new WebSocket.Server({ server });
let users = {}; // userId -> Array of WebSocket connections
let conversationMembersOnline = {}; // conversationId -> Set of userIds

wss.on("connection", (ws) => {
  ws.isAuthenticated = false;

  ws.on("message", async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error("Invalid JSON:", err);
      ws.close();
      return;
    }

    // Authentication
    if (!ws.isAuthenticated) {
      if (data.type === "authenticate" && data.token) {
        try {
          const user = jwt.verify(data.token, process.env.JWT_SECRET);
          ws.isAuthenticated = true;
          ws.user = user;

          // Support multiple connections per user
          if (!users[user.id]) {
            users[user.id] = [];
          }
          users[user.id].push(ws);

          // Track conversation membership
          if (Array.isArray(data.conversationIds)) {
            data.conversationIds.forEach((convId) => {
              if (!conversationMembersOnline[convId]) {
                conversationMembersOnline[convId] = new Set();
              }
              conversationMembersOnline[convId].add(user.id);
            });
          }

          ws.send(JSON.stringify({ type: "authenticated", userId: user.id }));
          console.log(`User authenticated: ${user.id}`);

          // Update WebSocket utility with current users
          setWebSocketUsers(users);
        } catch (err) {
          ws.send(
            JSON.stringify({ type: "auth_failed", message: "Invalid Token" })
          );
          ws.close();
        }
      } else {
        ws.send(
          JSON.stringify({ type: "auth_required", message: "Token Required" })
        );
        ws.close();
      }
      return;
    }

    // --- HANDLE GROUP MESSAGES ---
    if (data.type === "message" && data.conversationId && data.message) {
      try {
        const savedMessage = await ChatController.saveMessage(
          data.conversationId,
          ws.user.id,
          data.message,
          data.attachments || [],
          data.replyTo || null
        );

        const payload = {
          type: "message",
          _id: savedMessage._id,
          conversationId: savedMessage.conversationId,
          senderId: savedMessage.senderId,
          message: savedMessage.message,
          timestamp: savedMessage.timestamp,
          attachments: savedMessage.attachments || [],
          replyTo: savedMessage.replyTo || null,
        };

        // Determine recipients: prefer actual conversation members from DB, fallback to tracked set
        let recipientIds = [];
        try {
          const conv = await ChatController.getConversationById(
            savedMessage.conversationId
          );
          if (conv && Array.isArray(conv.members)) {
            recipientIds = conv.members.map(String);
          }
        } catch {}
        if (!recipientIds.length) {
          recipientIds = Array.from(
            conversationMembersOnline[data.conversationId] || []
          );
        }

        for (const userId of recipientIds) {
          const recipientConnections = users[userId];
          if (recipientConnections && Array.isArray(recipientConnections)) {
            recipientConnections.forEach((recipientWs) => {
              if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                recipientWs.send(JSON.stringify(payload));
                if (String(userId) !== String(ws.user.id)) {
                  // Lightweight notification for recipients (not the sender)
                  recipientWs.send(
                    JSON.stringify({
                      type: "notification",
                      channel: "chat",
                      title: "New group message",
                      body: savedMessage.message,
                      from: ws.user.id,
                      conversationId: savedMessage.conversationId,
                      timestamp: savedMessage.timestamp,
                    })
                  );
                }
              }
            });
          }
        }

        // Also echo to sender so they see their message immediately even if not tracked in the set
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
          // And notify sender's other tabs
          ws.send(
            JSON.stringify({
              type: "notification",
              channel: "chat",
              title: "Message sent",
              body: savedMessage.message,
              from: ws.user.id,
              conversationId: savedMessage.conversationId,
              timestamp: savedMessage.timestamp,
            })
          );
        }
      } catch (err) {
        console.error("Failed to save/broadcast group message:", err);
      }
      return;
    }

    // Handle project messages
    if (data.type === "project_message" && data.projectId) {
      try {
        const payload = {
          type: "project_message",
          projectId: data.projectId,
          message: data.messageData,
          timestamp: Date.now(),
        };

        // Broadcast to all users connected to this project
        // The client should filter based on their project access
        for (const userId in users) {
          const userConnections = users[userId];
          if (userConnections && Array.isArray(userConnections)) {
            userConnections.forEach((userWs) => {
              if (userWs && userWs.readyState === WebSocket.OPEN) {
                userWs.send(JSON.stringify(payload));
              }
            });
          }
        }

        console.log(`Broadcasted project message for project: ${data.projectId}`);
      } catch (err) {
        console.error("Error broadcasting project message:", err);
      }
      return;
    }

    // Handle private messages
    if (data.type === "private_message") {
      const senderId = data.senderId || data.senderid || data.senderID;
      const recipientId =
        data.recipientId || data.recipientid || data.recipientID;
      const msg = data.message || data.msg;

      if (!senderId || !recipientId || !msg) {
        console.error(
          "Missing senderId, recipientId, or message in private_message"
        );
        return;
      }

      try {
        const saved = await ChatController.saveMessage(
          senderId,
          recipientId,
          msg
        );
        const payload = {
          type: "private_message",
          _id: saved?._id,
          senderId,
          recipientId,
          message: msg,
          timestamp: saved?.timestamp || Date.now(),
        };

        // Echo to sender so UI updates immediately
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(payload));
        }

        // Deliver to recipient in real time (all connections)
        const recipientConnections = users[recipientId];
        if (recipientConnections && Array.isArray(recipientConnections)) {
          recipientConnections.forEach((recipientWs) => {
            if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
              recipientWs.send(JSON.stringify(payload));
              // Lightweight notification event
              recipientWs.send(
                JSON.stringify({
                  type: "notification",
                  channel: "chat",
                  title: "New message",
                  body: msg,
                  from: senderId,
                  timestamp: payload.timestamp,
                })
              );
            }
          });
        }

        console.log(`Delivered message from ${senderId} to ${recipientId}`);
      } catch (err) {
        console.error("Error saving/broadcasting private message:", err);
      }
    }
  });

  ws.on("close", () => {
    if (ws.user) {
      console.log(`User connection closed: ${ws.user.id}`);

      // Remove this specific connection from the array
      if (users[ws.user.id]) {
        users[ws.user.id] = users[ws.user.id].filter((conn) => conn !== ws);

        // If no more connections for this user, clean up
        if (users[ws.user.id].length === 0) {
          delete users[ws.user.id];
          console.log(`User fully disconnected: ${ws.user.id}`);

          // Remove from conversation tracking
          for (const convId in conversationMembersOnline) {
            conversationMembersOnline[convId].delete(ws.user.id);
            if (conversationMembersOnline[convId].size === 0) {
              delete conversationMembersOnline[convId];
            }
          }
        }
      }

      // Update WebSocket utility
      setWebSocketUsers(users);
    }
  });
});

// =====================
// MongoDB Connection & Server Start
// =====================
const PORT = process.env.PORT || 5000;

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in .env file");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds instead of hanging
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");

    // Initialize cron jobs after DB connection
    try {
      const { initializeCronJobs } = require("./jobs/cronJobs");
      initializeCronJobs();
    } catch (error) {
      console.error("⚠️  Cron jobs initialization failed:", error.message);
      console.log("   Install node-cron: npm install node-cron");
    }

    // Start server immediately (don't wait for email service)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);

      // Initialize Email Service in background (non-blocking)
      const emailService = require('./services/email/emailService');
      emailService.initialize().then(() => {
        console.log('✅ Email service ready');
      }).catch(err => {
        console.error('❌ Email service initialization failed:', err.message);
      });
    });
    console.log(
      "🌐 FRONTEND_URL for emails:",
      process.env.FRONTEND_URL || "not set"
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
