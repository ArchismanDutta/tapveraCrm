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

module.exports = {
  setWebSocketUsers,
  sendNotificationToUser,
  sendNotificationToMultipleUsers
};
