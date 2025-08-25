require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");

const app = express();
const server = http.createServer(app);

// =====================
// Middleware
// =====================
app.use(express.json());

// Serve uploaded files (e.g., employee photos, avatars)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Allowed frontend origins
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

// =====================
// Health Check
// =====================
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// =====================
// API Routes
// =====================
app.use("/api/auth", require("./routes/authRoutes")); // ✅ login only (signup removed from frontend use)
app.use("/api/password", require("./routes/passwordRoutes"));
app.use("/api/users", require("./routes/userRoutes")); // includes /directory
app.use("/api/tasks", require("./routes/taskRoutes"));
app.use("/api/email", require("./routes/emailRoutes"));
app.use("/api/leaves", require("./routes/leaveRoutes"));
app.use("/api/todos", require("./routes/todoTaskRoutes"));
app.use("/api/status", require("./routes/statusRoutes"));
app.use("/api/summary", require("./routes/summaryRoutes"));
app.use("/api/notices", require("./routes/noticeRoutes"));
app.use("/api/test", require("./routes/testRoutes"));

// =====================
// Serve frontend (production only)
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
// Start server & connect DB
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
