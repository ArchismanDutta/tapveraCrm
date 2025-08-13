let ioInstance;

function initSocket(server) {
  const { Server } = require("socket.io");

  const io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_ORIGIN || "http://localhost:3000",
        "http://localhost:5173",
      ],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.emit("connected", { id: socket.id });

    socket.on("disconnect", (reason) => {
      console.log(`Client disconnected: ${socket.id} (${reason})`);
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
