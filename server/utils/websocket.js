// WebSocket utility for sending notifications
let wsUsers = {}; // userId -> Array of WebSocket connections

function setWebSocketUsers(users) {
  wsUsers = users;
}

function sendNotificationToUser(userId, notification) {
  const userConnections = wsUsers[userId];
  if (!userConnections || !Array.isArray(userConnections)) {
    return false;
  }

  let sent = false;
  const payload = JSON.stringify({
    type: "notification",
    ...notification
  });

  // Send to all active connections for this user
  userConnections.forEach(ws => {
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(payload);
        sent = true;
      } catch (error) {
        console.error(`Failed to send notification to user ${userId}:`, error);
      }
    }
  });

  return sent;
}

function sendNotificationToMultipleUsers(userIds, notification) {
  const results = {};
  userIds.forEach(userId => {
    results[userId] = sendNotificationToUser(userId, notification);
  });
  return results;
}

function getWebSocketUsers() {
  return wsUsers;
}

function broadcastMessageToConversation(conversationId, memberIds, messageData) {
  const payload = JSON.stringify({
    type: "message",
    ...messageData
  });

  let sentCount = 0;
  memberIds.forEach(userId => {
    const userConnections = wsUsers[String(userId)];
    if (userConnections && Array.isArray(userConnections)) {
      userConnections.forEach(ws => {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(payload);
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast message to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`Broadcasted message to ${sentCount} connections for conversation ${conversationId}`);
  return sentCount > 0;
}

module.exports = {
  setWebSocketUsers,
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  getWebSocketUsers,
  broadcastMessageToConversation
};
