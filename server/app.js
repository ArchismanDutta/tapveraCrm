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
const authRoutes = require("./routes/authRoutes");
const adminAttendanceRoutes = require("./routes/adminAttendanceRoutes");
const leaveRoutes = require("./routes/leaveRoutes"); // ✅ Add this
const flexibleShiftRoutes = require("./routes/flexibleShiftRoutes"); // ✅ Add this

const ChatController = require("./controllers/chatController");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const frontendOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

if (!frontendOrigins.length) {
  console.warn("⚠️ No FRONTEND_ORIGIN or FRONTEND_URL set. CORS may block requests.");
}

app.use(cors({
  origin: frontendOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// 🔹 Register all routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminAttendanceRoutes);
app.use("/api/leaves", leaveRoutes); // ✅ Leave routes
app.use("/api/flexible-shifts", flexibleShiftRoutes); // ✅ Flexible shift routes

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Unexpected error:", err.stack || err);
  res.status(500).json({ error: "Internal Server Error" });
});

// WebSocket setup (unchanged)
const wss = new WebSocket.Server({ server });
let users = {};
let conversationMembersOnline = {};

wss.on("connection", (ws) => {
  ws.isAuthenticated = false;

  ws.on("message", async (message) => {
    let data;
    try { data = JSON.parse(message); } 
    catch { ws.close(); return; }

    if (!ws.isAuthenticated) {
      if (data.type === "authenticate" && data.token) {
        try {
          const user = jwt.verify(data.token, process.env.JWT_SECRET);
          ws.isAuthenticated = true;
          ws.user = user;
          users[user.id] = ws;

          if (Array.isArray(data.conversationIds)) {
            data.conversationIds.forEach((convId) => {
              if (!conversationMembersOnline[convId]) conversationMembersOnline[convId] = new Set();
              conversationMembersOnline[convId].add(user.id);
            });
          }

          ws.send(JSON.stringify({ type: "authenticated", userId: user.id }));
        } catch {
          ws.send(JSON.stringify({ type: "auth_failed", message: "Invalid Token" }));
          ws.close();
        }
      } else {
        ws.send(JSON.stringify({ type: "auth_required", message: "Token Required" }));
        ws.close();
      }
      return;
    }

    if (data.type === "private_message") {
      try { await ChatController.saveMessage(data.senderId, data.recipientId, data.message); } 
      catch (err) { console.error("Error saving message:", err); }
    }
  });

  ws.on("close", () => {
    if (ws.user) {
      delete users[ws.user.id];
      for (const convId in conversationMembersOnline) {
        conversationMembersOnline[convId].delete(ws.user.id);
        if (conversationMembersOnline[convId].size === 0) delete conversationMembersOnline[convId];
      }
    }
  });
});

const PORT = process.env.PORT || 5000;

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in .env file");
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
