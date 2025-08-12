require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const chatRoutes = require("./routes/chatRoutes");

const ChatMessage = require("./models/ChatMessage");
const socketAuth = require("./middlewares/socketAuth");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // set frontend URL in production
    methods: ["GET", "POST"],
  },
});

io.use(socketAuth);

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

// API routes
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

// Serve frontend build for production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}, user: ${socket.user.name}`);

  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User ${socket.user.name} joined room ${room}`);
  });

  socket.on("sendMessage", async (data) => {
    try {
      const newMsg = new ChatMessage({
        sender: socket.user._id,  // use authenticated socket user
        receiver: data.receiverId || null,
        message: data.message,
        room: data.room || null,
      });

      const saved = await newMsg.save();
      const populated = await saved.populate("sender", "name email");

      if (data.room) {
        io.to(data.room).emit("receiveMessage", populated);
      }
    } catch (err) {
      console.error("Error saving message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(PORT, () =>
      console.log(`Server running on port ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
