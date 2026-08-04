// socket/handlers/chat.handler.js
//
// Real-time chat + project-room events. This replaces the message-type
// switchboard that used to live inline inside the raw `wss.on("connection")`
// block in app.js (group messages, project messages, typing indicators).
//
// Two things changed on purpose while porting this over:
//   1. `project_message` used to be broadcast to EVERY connected socket
//      (server/app.js just looped `for (const userId in users)`), regardless
//      of whether that user had anything to do with the project. It's now
//      scoped to a `project:<id>` Socket.IO room that only members who called
//      `project:join` are in.
//   2. Typing indicators (`typing` / `stop_typing`) were sent by the client
//      but the old server switchboard had no case for them at all, so they
//      were silently dropped — the feature never worked for a second user.
//      They're wired up properly here.
'use strict';

const ChatController = require('../../controllers/chatController');

module.exports = (io, socket) => {
  const userId = socket.user.id;

  // ---- Chat conversations --------------------------------------------
  // Client calls this once after connecting (and again whenever its
  // conversation list changes) so this socket receives messages for every
  // conversation the user belongs to.
  socket.on('chat:subscribe', ({ conversationIds } = {}) => {
    if (!Array.isArray(conversationIds)) return;
    conversationIds.forEach((id) => socket.join(`conversation:${id}`));
  });

  socket.on('chat:message', async ({ conversationId, message, attachments, replyTo } = {}) => {
    if (!conversationId || (!message && !(attachments || []).length)) return;

    try {
      const savedMessage = await ChatController.saveMessage(
        conversationId,
        userId,
        message,
        attachments || [],
        replyTo || null
      );

      // signPayload turns stored /uploads/... paths into signed URLs. This path
      // never touches Express, so the res.json interceptor that normally does
      // it doesn't run here — without it every recipient of a message with an
      // attachment gets a raw path and a broken image.
      const { signPayload } = require('../../middlewares/signFileUrls');
      const payload = signPayload({
        _id: savedMessage._id,
        conversationId: savedMessage.conversationId,
        senderId: savedMessage.senderId,
        message: savedMessage.message,
        timestamp: savedMessage.timestamp,
        attachments: savedMessage.attachments || [],
        replyTo: savedMessage.replyTo || null,
      });

      // Everyone subscribed to this conversation (including the sender's
      // other tabs) gets the message instantly. Persisted "new message"
      // notifications for offline/other members are handled inside
      // ChatController.saveMessage via notificationService — not duplicated
      // here.
      io.to(`conversation:${conversationId}`).emit('chat:message', payload);

      // Belt-and-suspenders: also push directly to each member's personal
      // room in case their client hasn't (re)joined the conversation room
      // yet (e.g. right after being added to a group).
      try {
        const conv = await ChatController.getConversationById(conversationId);
        (conv?.members || []).forEach((memberId) => {
          io.to(`user:${memberId}`).emit('chat:message', payload);
        });
      } catch (err) {
        console.error('[chat.handler] Failed to fan out to member rooms:', err.message);
      }
    } catch (err) {
      console.error('[chat.handler] Failed to save/broadcast chat message:', err);
    }
  });

  socket.on('chat:typing', ({ conversationId, userName } = {}) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('chat:typing', {
      conversationId,
      userId,
      userName: userName || 'Someone',
    });
  });

  socket.on('chat:stop_typing', ({ conversationId } = {}) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('chat:stop_typing', {
      conversationId,
      userId,
    });
  });

  // ---- Project rooms ---------------------------------------------------
  // The message itself is created via REST (POST /api/projects/:id/messages);
  // the client pings this event afterwards purely so everyone else looking
  // at the project sees it appear without a refresh.
  socket.on('project:join', ({ projectId } = {}) => {
    if (projectId) socket.join(`project:${projectId}`);
  });

  socket.on('project:leave', ({ projectId } = {}) => {
    if (projectId) socket.leave(`project:${projectId}`);
  });

  socket.on('project:message', ({ projectId, messageData } = {}) => {
    if (!projectId) return;
    socket.to(`project:${projectId}`).emit('project:message', {
      projectId,
      messageData,
      timestamp: Date.now(),
    });
  });

  socket.on('project:typing', ({ projectId, userName } = {}) => {
    if (!projectId) return;
    socket.to(`project:${projectId}`).emit('project:typing', {
      projectId,
      userId,
      userName: userName || 'Someone',
    });
  });

  socket.on('project:stop_typing', ({ projectId } = {}) => {
    if (!projectId) return;
    socket.to(`project:${projectId}`).emit('project:stop_typing', { projectId, userId });
  });

  // ---- Task rooms --------------------------------------------------------
  // Joined while TaskRemarksModal is open for a given task, so a new remark
  // (added via REST — POST /api/tasks/:taskId/remarks) can be pushed live to
  // everyone else with that same task's modal open, instead of them polling
  // GET /api/tasks/:taskId every 5s.
  socket.on('task:join', ({ taskId } = {}) => {
    if (taskId) socket.join(`task:${taskId}`);
  });

  socket.on('task:leave', ({ taskId } = {}) => {
    if (taskId) socket.leave(`task:${taskId}`);
  });
};
