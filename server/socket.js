// socket.js
let ioInstance;

function initSocket(server) {
  const { Server } = require("socket.io");

  const io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_ORIGIN || "http://localhost:5173", // Vite
        "http://localhost:3000", // CRA
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    },
    transports: ["websocket", "polling"], // fallback
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    socket.on("disconnect", (reason) => {
      console.log(`❌ Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  ioInstance = io;
  return io;
}

function getIO() {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized! Call initSocket(server) first.");
  }
  return ioInstance;
}

module.exports = { initSocket, getIO };
