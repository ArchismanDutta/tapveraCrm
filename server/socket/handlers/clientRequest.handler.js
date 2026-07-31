// socket/handlers/clientRequest.handler.js
//
// WebSocket event handlers for client request chat functionality

'use strict';

module.exports = (io, socket) => {
  const { id: userId, role } = socket.user;

  // Join a specific request room for real-time chat
  socket.on('join-request', (requestId) => {
    if (!requestId) {
      console.warn(`[Socket.IO] User ${userId} tried to join-request without requestId`);
      return;
    }

    socket.join(`request:${requestId}`);
    console.log(`[Socket.IO] User ${userId} joined request room: ${requestId}`);
  });

  // Leave a specific request room
  socket.on('leave-request', (requestId) => {
    if (!requestId) return;

    socket.leave(`request:${requestId}`);
    console.log(`[Socket.IO] User ${userId} left request room: ${requestId}`);
  });

  // Broadcast a message to all participants in a request room
  socket.on('send-request-message', (data) => {
    const { requestId, message } = data;

    if (!requestId || !message) {
      console.warn(`[Socket.IO] Invalid send-request-message data from user ${userId}`);
      return;
    }

    // Broadcast to all clients in the request room (including sender)
    io.to(`request:${requestId}`).emit('request-message', {
      requestId,
      message,
    });

    console.log(`[Socket.IO] Message sent to request room ${requestId} by user ${userId}`);
  });

  // Broadcast request updates (status changes, etc.) to all participants
  socket.on('request-update', (data) => {
    const { requestId, status, ...updates } = data;

    if (!requestId) {
      console.warn(`[Socket.IO] Invalid request-update data from user ${userId}`);
      return;
    }

    // Broadcast to all clients in the request room
    io.to(`request:${requestId}`).emit('request-update', {
      requestId,
      status,
      ...updates,
    });

    console.log(`[Socket.IO] Request ${requestId} updated by user ${userId}`);
  });
};
