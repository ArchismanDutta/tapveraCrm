const WebSocket = require("ws");
const ChatController = require("./controllers/chatController");
const wss = new WebSocket.Server({ port: 8181 });

let users = {};

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    const data = JSON.parse(message);

    if (data.type === "register") {
      users[data.userId] = ws;
      return;
    }

    if (data.type === "private_message") {
      const { senderId, recipientId, message: msg } = data;

      // Save the message to DB
      await ChatController.saveMessage(senderId, recipientId, msg);

      const recipientSocket = users[recipientId];
      if (recipientSocket) {
        recipientSocket.send(
          JSON.stringify({
            type: "private_message",
            senderId,
            message: msg,
            timestamp: new Date(),
          })
        );
      }
    }
  });

  ws.on("close", () => {
    // Remove disconnected user
    Object.keys(users).forEach((id) => {
      if (users[id] === ws) {
        delete users[id];
      }
    });
  });
});

console.log("Chat WebSocket server running on port 8181");
