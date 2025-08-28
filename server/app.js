require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

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
const wishRoutes = require("./routes/wishRoutes"); // Added Wish routes

// Controllers
const ChatController = require("./controllers/chatController");

const app = express();
const server = http.createServer(app);

// =====================
// Middleware
// =====================
app.use(express.json());
app.use(morgan("dev"));

// Serve uploaded files (photos, avatars)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// CORS setup
const frontendOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

if (frontendOrigins.length === 0) {
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
// Health Check
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
app.use("/api/wishes", wishRoutes); // Wish API

// =====================
// Serve frontend (production)
// =====================
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

// =====================
// Error Handler
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

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    let data;
    try {
      data = JSON.parse(message);
      console.log("Received WS data:", data);
    } catch (err) {
      console.error("Invalid JSON:", err);
      return;
    }

    if (data.type === "register") {
      users[data.userId] = ws;
      console.log(`User registered with userId: ${data.userId}`);
      return;
    }

    if (data.type === "private_message") {
      const senderId = data.senderId || data.senderid || data.senderID;
      const recipientId = data.recipientId || data.recipientid || data.recipientID;
      const msg = data.message || data.msg;

      if (!senderId || !recipientId || !msg) {
        console.error("Missing senderId, recipientId or message in private_message data");
        return;
      }

      try {
        await ChatController.saveMessage(senderId, recipientId, msg);
        console.log(`Saved message from ${senderId} to ${recipientId}`);
      } catch (err) {
        console.error("Error saving chat message:", err);
      }

      const recipientSocket = users[recipientId];
      if (recipientSocket) {
        recipientSocket.send(
          JSON.stringify({
            type: "private_message",
            senderId,
            message: msg,
            timestamp: new Date(),
          })
        );
      }
    }
  });

  ws.on("close", () => {
    for (const key in users) {
      if (users[key] === ws) delete users[key];
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
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );
    console.log("🌐 FRONTEND_URL for emails:", process.env.FRONTEND_URL || "not set");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
