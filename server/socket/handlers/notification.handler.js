// socket/handlers/notification.handler.js
//
// Notifications are read/written over REST (server/routes/notificationRoutes.js) —
// that's the authoritative path the notification centre and unread badge use.
// This handler only exists for optional low-latency acks; it never mutates
// the database itself, so there's no risk of it drifting out of sync with
// the REST path.
'use strict';

module.exports = (io, socket) => {
  socket.on('notification:mark_read', ({ notificationId } = {}) => {
    socket.emit('notification:marked_read', { notificationId });
  });
};
