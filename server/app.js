require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");

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

// Today Status route
const statusRoutes = require("./routes/statusRoutes");

// Summary routes
const summaryRoutes = require("./routes/summaryRoutes");

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
    "⚠️ No FRONTEND_ORIGIN or FRONTEND_URL set, please check your environment variables"
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

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// API Routes
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

// Serve frontend (production)
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Unexpected error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server and connect DB
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
