require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");

// Routes
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

// Controllers
const ChatController = require("./controllers/chatController");

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const frontendOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

if (frontendOrigins.length === 0) {
  console.warn(
    "⚠️ No FRONTEND_ORIGIN or FRONTEND_URL set in .env. CORS may block requests."
  );
}

app.use(
  cors({
    origin: frontendOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(morgan("dev"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// API routes
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/test", testRoutes);
app.use("/api/users", userRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/todos", todoTaskRoutes);
app.use("/api/status", statusRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/chat", chatRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Unexpected error:", err.stack || err);
  res.status(500).json({ error: "Internal Server Error" });
});

// WebSocket Server Setup
const wss = new WebSocket.Server({ server });

// Store connected users: userId -> ws
let users = {};

// Track online users per conversation: conversationId -> Set of userIds
let conversationMembersOnline = {};

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

    // Handle authentication
    if (!ws.isAuthenticated) {
      if (data.type === "authenticate" && data.token) {
        try {
          const user = jwt.verify(data.token, process.env.JWT_SECRET);
          ws.isAuthenticated = true;
          ws.user = user;
          users[user.id] = ws;
          console.log(user);
          console.log(`User authenticated: ${user.id}`);

          // Track which conversations the user is currently viewing
          if (Array.isArray(data.conversationIds)) {
            data.conversationIds.forEach((convId) => {
              if (!conversationMembersOnline[convId]) {
                conversationMembersOnline[convId] = new Set();
              }
              conversationMembersOnline[convId].add(user.id);
            });
          }

          ws.send(JSON.stringify({ type: "authenticated", userId: user.id }));
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

    // Handle chat message
    if (data.type === "message") {
      const { conversationId, message: msgText } = data;
      const senderId = ws.user.id;

      if (!conversationId || !msgText) {
        console.error("Missing conversationId or message");
        return;
      }

      try {
        // Save the message
        const savedMessage = await ChatController.saveMessage(
          conversationId,
          senderId,
          msgText
        );
        console.log(
          `Saved message from ${senderId} in conversation ${conversationId}`
        );

        // Broadcast to all online members of the conversation
        const conversation = await ChatController.getConversationById(
          conversationId
        );
        if (!conversation) {
          console.error(`Conversation ${conversationId} not found`);
          return;
        }

        conversation.members.forEach((memberId) => {
          const memberWs = users[memberId];
          if (memberWs && memberWs.readyState === WebSocket.OPEN) {
            memberWs.send(
              JSON.stringify({
                type: "message",
                conversationId,
                senderId,
                message: msgText,
                timestamp: savedMessage.timestamp,
                messageId: savedMessage._id,
              })
            );
          }
        });
      } catch (err) {
        console.error("Error handling message:", err);
      }
    }
  });

  ws.on("close", () => {
    if (ws.user) {
      console.log(`User disconnected: ${ws.user.id}`);

      // Remove user from users map
      delete users[ws.user.id];

      // Remove user from conversationMembersOnline tracking
      for (const convId in conversationMembersOnline) {
        conversationMembersOnline[convId].delete(ws.user.id);
        if (conversationMembersOnline[convId].size === 0) {
          delete conversationMembersOnline[convId];
        }
      }
    }
  });
});


// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in .env file");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );
    console.log(
      "🌐 FRONTEND_URL for emails:",
      process.env.FRONTEND_URL || "not set"
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
