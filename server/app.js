// =====================
// Load environment variables FIRST
// =====================
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");

const { initSocket } = require("./socket");

// Routes
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
const passwordRoutes = require("./routes/passwordRoutes"); // ✅ Forgot/Reset Password
const testRoutes = require("./routes/testRoutes");

const app = express();
const server = http.createServer(app);

// =====================
// Middleware
// =====================
app.use(express.json());

// HTTP CORS for REST API
app.use(
  cors({
    origin: [
      process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || "http://localhost:5173", // ✅ Use from .env
      "http://localhost:3000", // CRA dev
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(morgan("dev"));

// =====================
// Initialize Socket.IO
// =====================
initSocket(server);

// =====================
// API Routes
// =====================
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth", passwordRoutes); // ✅ Forgot/Reset Password
app.use("/api/test", testRoutes);
app.use("/api/users", userRoutes);

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
// Database & Server Start
// =====================
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    server.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
    console.log("🌐 FRONTEND_URL for emails:", process.env.FRONTEND_URL);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
