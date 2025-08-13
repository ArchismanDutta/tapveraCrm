let ioInstance;

function initSocket(server) {
  const { Server } = require("socket.io");

  const io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_ORIGIN || "http://localhost:3000",
        "http://localhost:5173"
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
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
