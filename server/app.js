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
const testRoutes = require("./routes/testRoutes");

const app = express();
const server = http.createServer(app);

// ========================
// Initialize Socket.IO
// ========================
initSocket(server); // ensure initialized before controllers use getIO()

// ========================
// Middleware
// ========================
app.use(express.json());
app.use(
  cors({
    origin: [
      process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);
app.use(morgan("dev"));

// ========================
// API Routes
// ========================
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/users", userRoutes);

// ========================
// Serve frontend build (Production)
// ========================
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

// ========================
// Connect DB and Start Server
// ========================
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
