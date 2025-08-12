// sockets/index.js
const socketAuth = require("../middlewares/socketAuth");
const ChatMessage = require("../models/ChatMessage");
const Conversation = require("../models/conversation");

module.exports = (io) => {
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${socket.id} user:${user._id}`);

    socket.on("joinConversation", async (conversationId) => {
      try {
        const convo = await Conversation.findById(conversationId);
        if (!convo) return socket.emit("error", { message: "Conversation not found" });
        const isMember = convo.members.find((m) => m.toString() === user._id.toString());
        if (!isMember) return socket.emit("error", { message: "Not a member of conversation" });
        socket.join(`conversation:${conversationId}`);
      } catch (err) {
        console.error("joinConversation error:", err);
      }
    });

    socket.on("leaveConversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // payload: { conversationId, content, attachments }
    socket.on("sendMessage", async (payload) => {
      try {
        const { conversationId, content, attachments = [] } = payload;
        if (!conversationId || !content) {
          return socket.emit("error", { message: "conversationId and content required" });
        }

        const convo = await Conversation.findById(conversationId);
        if (!convo) return socket.emit("error", { message: "Conversation not found" });
        if (!convo.members.find((m) => m.toString() === user._id.toString())) {
          return socket.emit("error", { message: "Not authorized to send in this conversation" });
        }

        const newMsg = new ChatMessage({
          conversationId: convo._id,
          sender: user._id,
          content,
          attachments
        });

        await newMsg.save();
        // update lastMessage
        convo.lastMessage = newMsg._id;
        await convo.save();

        const populated = await newMsg.populate("sender", "name email");

        // Emit to all members who joined the socket room
        io.to(`conversation:${conversationId}`).emit("receiveMessage", populated);
      } catch (err) {
        console.error("socket sendMessage error:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    socket.on("typing", ({ conversationId, isTyping = true }) => {
      socket.to(`conversation:${conversationId}`).emit("typing", {
        userId: user._id,
        isTyping,
      });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
