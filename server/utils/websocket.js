// WebSocket utility for sending notifications
let wsUsers = {};

function setWebSocketUsers(users) {
  wsUsers = users;
}

function sendNotificationToUser(userId, notification) {
  const userWs = wsUsers[userId];
  if (userWs && userWs.readyState === 1) { // WebSocket.OPEN
    userWs.send(JSON.stringify({
      type: "notification",
      ...notification
    }));
    return true;
  }
  return false;
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
