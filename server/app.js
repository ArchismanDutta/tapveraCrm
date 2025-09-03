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
const statusRoutes = require("./routes/statusRoutes");
const summaryRoutes = require("./routes/summaryRoutes");
const wishRoutes = require("./routes/wishRoutes");
const flexibleShiftRoutes = require("./routes/flexibleShiftRoutes");
const adminAttendanceRoutes = require("./routes/adminAttendanceRoutes");
const holidayRoutes = require("./routes/holidayRoutes");

// Controllers
const ChatController = require("./controllers/chatController");

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
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

if (!frontendOrigins.length) {
  console.warn("⚠️ No FRONTEND_ORIGIN or FRONTEND_URL set. CORS may block requests.");
}

app.use(
  cors({
    origin: frontendOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// =====================
// Health check
// =====================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
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
app.use("/api/status", statusRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wishes", wishRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/flexible-shifts", flexibleShiftRoutes);
app.use("/api/admin", adminAttendanceRoutes);

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
  res.status(500).json({ error: "Internal Server Error" });
});

// =====================
// WebSocket Setup
// =====================
const wss = new WebSocket.Server({ server });
let users = {};
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
          users[user.id] = ws;

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
        // Save to DB
        const savedMessage = await ChatController.saveMessage(
          data.conversationId,
          ws.user.id,
          data.message
        );

        // Prepare payload for broadcast
        const payload = {
          type: "message",
          _id: savedMessage._id,
          conversationId: savedMessage.conversationId,
          senderId: savedMessage.senderId,
          message: savedMessage.message,
          timestamp: savedMessage.timestamp,
        };

        // Broadcast to all sockets in this conversation
        for (const userId of conversationMembersOnline[data.conversationId] ||
          []) {
          const recipientWs = users[userId];
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify(payload));
          }
        }
      } catch (err) {
        console.error("Failed to save/broadcast group message:", err);
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
        await ChatController.saveMessage(senderId, recipientId, msg);
        console.log(`Saved message from ${senderId} to ${recipientId}`);
      } catch (err) {
        console.error("Error saving message:", err);
      }
    }
  });

  ws.on("close", () => {
    if (ws.user) {
      console.log(`User disconnected: ${ws.user.id}`);
      delete users[ws.user.id];

      // Remove from conversation tracking
      for (const convId in conversationMembersOnline) {
        conversationMembersOnline[convId].delete(ws.user.id);
        if (conversationMembersOnline[convId].size === 0) {
          delete conversationMembersOnline[convId];
        }
      }
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
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
    console.log("🌐 FRONTEND_URL for emails:", process.env.FRONTEND_URL || "not set");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
