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

/**
 * Broadcast project message to all project members in real-time
 * @param {string} projectId - The project ID
 * @param {Array} memberIds - Array of user/client IDs who are project members
 * @param {Object} messageData - The message data to broadcast
 * @returns {boolean} - Whether the broadcast was successful
 */
function broadcastProjectMessage(projectId, memberIds, messageData) {
  const payload = JSON.stringify({
    type: "project_message",
    projectId: projectId,
    messageData: messageData
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
            console.log(`[WebSocket] Sent project_message to user ${userId} for project ${projectId}`);
          } catch (error) {
            console.error(`Failed to broadcast project message to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`[WebSocket] Broadcasted project message to ${sentCount} connections for project ${projectId}`);
  return sentCount > 0;
}

/**
 * Broadcast message read status to all project members
 * @param {string} projectId - The project ID
 * @param {Object} readData - Read receipt data { messageId, userId, readAt }
 * @returns {boolean} - Whether the broadcast was successful
 */
function broadcastMessageRead(projectId, readData) {
  const payload = JSON.stringify({
    type: "message-read",
    projectId: projectId,
    ...readData
  });

  let sentCount = 0;
  // Broadcast to all connected users (they can filter by projectId on client side)
  Object.keys(wsUsers).forEach(userId => {
    const userConnections = wsUsers[userId];
    if (userConnections && Array.isArray(userConnections)) {
      userConnections.forEach(ws => {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(payload);
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast message-read to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`[WebSocket] Broadcasted message-read to ${sentCount} connections for project ${projectId}`);
  return sentCount > 0;
}

/**
 * Broadcast message status update to all project members
 * @param {string} projectId - The project ID
 * @param {Object} statusData - Status update data { messageId, status, timestamp }
 * @returns {boolean} - Whether the broadcast was successful
 */
function broadcastMessageStatusUpdate(projectId, statusData) {
  const payload = JSON.stringify({
    type: "message-status-update",
    projectId: projectId,
    ...statusData
  });

  let sentCount = 0;
  // Broadcast to all connected users (they can filter by projectId on client side)
  Object.keys(wsUsers).forEach(userId => {
    const userConnections = wsUsers[userId];
    if (userConnections && Array.isArray(userConnections)) {
      userConnections.forEach(ws => {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(payload);
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast message-status-update to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`[WebSocket] Broadcasted message-status-update to ${sentCount} connections for project ${projectId}`);
  return sentCount > 0;
}

/**
 * Broadcast message pinned/unpinned status to all project members
 * @param {string} projectId - The project ID
 * @param {Object} pinData - Pin data { messageId, isPinned, pinnedBy?, pinnedAt? }
 * @returns {boolean} - Whether the broadcast was successful
 */
function broadcastMessagePinned(projectId, pinData) {
  const payload = JSON.stringify({
    type: "message-pinned",
    projectId: projectId,
    ...pinData
  });

  let sentCount = 0;
  // Broadcast to all connected users (they can filter by projectId on client side)
  Object.keys(wsUsers).forEach(userId => {
    const userConnections = wsUsers[userId];
    if (userConnections && Array.isArray(userConnections)) {
      userConnections.forEach(ws => {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(payload);
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast message-pinned to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`[WebSocket] Broadcasted message-pinned to ${sentCount} connections for project ${projectId}`);
  return sentCount > 0;
}

/**
 * Broadcast user typing indicator to all project members
 * @param {string} projectId - The project ID
 * @param {Object} typingData - Typing data { userId, userName, timestamp }
 * @returns {boolean} - Whether the broadcast was successful
 */
function broadcastUserTyping(projectId, typingData) {
  const payload = JSON.stringify({
    type: "user-typing",
    projectId: projectId,
    ...typingData
  });

  let sentCount = 0;
  // Broadcast to all connected users (they can filter by projectId on client side)
  Object.keys(wsUsers).forEach(userId => {
    const userConnections = wsUsers[userId];
    if (userConnections && Array.isArray(userConnections)) {
      userConnections.forEach(ws => {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(payload);
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast user-typing to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`[WebSocket] Broadcasted user-typing to ${sentCount} connections for project ${projectId}`);
  return sentCount > 0;
}

/**
 * Broadcast user stopped typing to all project members
 * @param {string} projectId - The project ID
 * @param {Object} typingData - Typing data { userId, timestamp }
 * @returns {boolean} - Whether the broadcast was successful
 */
function broadcastUserStoppedTyping(projectId, typingData) {
  const payload = JSON.stringify({
    type: "user-stopped-typing",
    projectId: projectId,
    ...typingData
  });

  let sentCount = 0;
  // Broadcast to all connected users (they can filter by projectId on client side)
  Object.keys(wsUsers).forEach(userId => {
    const userConnections = wsUsers[userId];
    if (userConnections && Array.isArray(userConnections)) {
      userConnections.forEach(ws => {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(payload);
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast user-stopped-typing to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`[WebSocket] Broadcasted user-stopped-typing to ${sentCount} connections for project ${projectId}`);
  return sentCount > 0;
}

/**
 * Broadcast message delivered status to all project members
 * @param {string} projectId - The project ID
 * @param {Object} deliveryData - Delivery data { messageId, userId, deliveredAt }
 * @returns {boolean} - Whether the broadcast was successful
 */
function broadcastMessageDelivered(projectId, deliveryData) {
  const payload = JSON.stringify({
    type: "message-delivered",
    projectId: projectId,
    ...deliveryData
  });

  let sentCount = 0;
  // Broadcast to all connected users (they can filter by projectId on client side)
  Object.keys(wsUsers).forEach(userId => {
    const userConnections = wsUsers[userId];
    if (userConnections && Array.isArray(userConnections)) {
      userConnections.forEach(ws => {
        if (ws && ws.readyState === 1) { // WebSocket.OPEN
          try {
            ws.send(payload);
            sentCount++;
          } catch (error) {
            console.error(`Failed to broadcast message-delivered to user ${userId}:`, error);
          }
        }
      });
    }
  });

  console.log(`[WebSocket] Broadcasted message-delivered to ${sentCount} connections for project ${projectId}`);
  return sentCount > 0;
}

module.exports = {
  setWebSocketUsers,
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  getWebSocketUsers,
  broadcastMessageToConversation,
  broadcastProjectMessage,
  broadcastMessageRead,
  broadcastMessageStatusUpdate,
  broadcastMessagePinned,
  broadcastUserTyping,
  broadcastUserStoppedTyping,
  broadcastMessageDelivered
};
