// utils/websocket.js
//
// Real-time broadcast helpers, now backed by Socket.IO rooms instead of a
// hand-rolled `userId -> ws[]` map. Kept as the same public API
// (sendNotificationToUser, broadcastMessageRead, etc.) that controllers
// already import, so callers didn't need to change — only the transport
// underneath did.
//
// Every function here is best-effort: if Socket.IO hasn't initialized yet
// (e.g. called during startup) or nobody's connected, we log and return
// rather than throwing, so a real-time hiccup never fails the HTTP request
// that triggered it.
'use strict';

const _io = () => require('../socket').getIO();

function sendNotificationToUser(userId, notification) {
  try {
    _io().to(`user:${userId}`).emit('notification:new', {
      type: 'notification',
      ...notification,
    });
    return true;
  } catch (err) {
    console.error(`Failed to send notification to user ${userId}:`, err.message);
    return false;
  }
}

function sendNotificationToMultipleUsers(userIds, notification) {
  const results = {};
  userIds.forEach((userId) => {
    results[userId] = sendNotificationToUser(userId, notification);
  });
  return results;
}

function broadcastMessageToConversation(conversationId, memberIds, messageData) {
  try {
    // Socket payloads bypass Express, so the res.json interceptor that signs
    // /uploads/... paths never sees them. Without this the sender's own HTTP
    // response has working image URLs while every recipient gets the raw path
    // and a broken image until they refresh.
    const { signPayload } = require('../middlewares/signFileUrls');
    const payload = signPayload({ type: 'message', ...messageData });
    const io = _io();
    io.to(`conversation:${conversationId}`).emit('chat:message', payload);
    (memberIds || []).forEach((userId) => io.to(`user:${userId}`).emit('chat:message', payload));
    return true;
  } catch (err) {
    console.error(`Failed to broadcast message to conversation ${conversationId}:`, err.message);
    return false;
  }
}

/**
 * Broadcast project message to all project members in real-time.
 * Scoped to the `project:<id>` Socket.IO room (joined via the `project:join`
 * event — see socket/handlers/chat.handler.js) instead of every connected
 * socket, unlike the old raw-ws version.
 */
function broadcastProjectMessage(projectId, memberIds, messageData) {
  try {
    // See broadcastMessageToConversation — socket payloads don't pass through
    // the res.json signing interceptor.
    const { signPayload } = require('../middlewares/signFileUrls');
    const payload = signPayload({ projectId, messageData, timestamp: Date.now() });
    const io = _io();
    io.to(`project:${projectId}`).emit('project:message', payload);
    (memberIds || []).forEach((userId) => io.to(`user:${userId}`).emit('project:message', payload));
    console.log(`[Socket.IO] Broadcasted project message for project ${projectId}`);
    return true;
  } catch (err) {
    console.error(`Failed to broadcast project message for project ${projectId}:`, err.message);
    return false;
  }
}

function broadcastMessageRead(projectId, readData) {
  try {
    _io().to(`project:${projectId}`).emit('project:message_read', { projectId, ...readData });
    return true;
  } catch (err) {
    console.error(`Failed to broadcast message-read for project ${projectId}:`, err.message);
    return false;
  }
}

function broadcastMessageStatusUpdate(projectId, statusData) {
  try {
    _io().to(`project:${projectId}`).emit('project:message_status', { projectId, ...statusData });
    return true;
  } catch (err) {
    console.error(`Failed to broadcast message-status-update for project ${projectId}:`, err.message);
    return false;
  }
}

function broadcastMessagePinned(projectId, pinData) {
  try {
    _io().to(`project:${projectId}`).emit('project:message_pinned', { projectId, ...pinData });
    return true;
  } catch (err) {
    console.error(`Failed to broadcast message-pinned for project ${projectId}:`, err.message);
    return false;
  }
}

function broadcastUserTyping(projectId, typingData) {
  try {
    _io().to(`project:${projectId}`).emit('project:typing', { projectId, ...typingData });
    return true;
  } catch (err) {
    console.error(`Failed to broadcast user-typing for project ${projectId}:`, err.message);
    return false;
  }
}

function broadcastUserStoppedTyping(projectId, typingData) {
  try {
    _io().to(`project:${projectId}`).emit('project:stop_typing', { projectId, ...typingData });
    return true;
  } catch (err) {
    console.error(`Failed to broadcast user-stopped-typing for project ${projectId}:`, err.message);
    return false;
  }
}

function broadcastMessageDelivered(projectId, deliveryData) {
  try {
    _io().to(`project:${projectId}`).emit('project:message_delivered', { projectId, ...deliveryData });
    return true;
  } catch (err) {
    console.error(`Failed to broadcast message-delivered for project ${projectId}:`, err.message);
    return false;
  }
}

/**
 * Broadcast a newly-added client remark in real-time.
 *
 * Two audiences need this, and both are covered by one chained `.to().to()`
 * call (chaining, not separate `.emit()` calls, so a socket that happens to
 * match more than one of these rooms — e.g. an admin who also has this exact
 * project open — gets the event exactly once, not once per matching room):
 *   1. Anyone with this specific project open (`project:<id>` room) — e.g.
 *      SectionRemarks.jsx appends the remark live instead of waiting on a
 *      refetch.
 *   2. Every admin/super-admin, regardless of which project(s) they have
 *      open — so the live remark-count badge on the projects list
 *      (ProjectCard.jsx) updates even for projects they haven't opened.
 */
function broadcastProjectRemark(projectId, remarkData) {
  try {
    const payload = { projectId, ...remarkData, timestamp: Date.now() };
    _io()
      .to(`project:${projectId}`)
      .to('role:admin')
      .to('role:super-admin')
      .to('role:superadmin')
      .emit('project:remark', payload);
    console.log(`[Socket.IO] Broadcasted new remark for project ${projectId}`);
    return true;
  } catch (err) {
    console.error(`Failed to broadcast project remark for project ${projectId}:`, err.message);
    return false;
  }
}

/**
 * Broadcast a remark deletion (soft-delete) in real-time — same audience/
 * dedup reasoning as broadcastProjectRemark above.
 */
function broadcastProjectRemarkDeleted(projectId, remarkData) {
  try {
    const payload = { projectId, ...remarkData, timestamp: Date.now() };
    _io()
      .to(`project:${projectId}`)
      .to('role:admin')
      .to('role:super-admin')
      .to('role:superadmin')
      .emit('project:remark_deleted', payload);
    return true;
  } catch (err) {
    console.error(`Failed to broadcast project remark deletion for project ${projectId}:`, err.message);
    return false;
  }
}

/**
 * Broadcast that a group conversation's membership/details changed (create,
 * add/remove member, rename). Targeted at `user:<id>` rather than a
 * `conversation:<id>` room, because the consumer (Sidebar.jsx's group-name
 * cache, populated from GET /api/chat/groups) needs to refresh for every
 * member regardless of whether they currently have that specific
 * conversation open — including a brand-new group nobody's joined the room
 * for yet, and a just-removed member who needs the group to disappear from
 * their own list.
 *
 * `memberIds` should be the full set of users who need to know: pass the
 * conversation's current members, plus (for a removal) the removed user.
 */
function broadcastConversationUpdated(memberIds, data) {
  try {
    const io = _io();
    const payload = { ...data, timestamp: Date.now() };
    (memberIds || []).forEach((userId) => io.to(`user:${userId}`).emit('conversation:updated', payload));
    return true;
  } catch (err) {
    console.error('Failed to broadcast conversation update:', err.message);
    return false;
  }
}

/**
 * Broadcast a newly-added task remark/comment in real-time. Targets the
 * `task:<id>` room (joined only while TaskRemarksModal is open for that task
 * — see socket/handlers/chat.handler.js's task:join/task:leave) plus the
 * task's assignee(s) and assigner directly via their `user:<id>` rooms, so
 * the modal updates live even for someone who opens it a moment later.
 */
function broadcastTaskRemark(taskId, memberIds, remarkData) {
  try {
    const payload = { taskId, ...remarkData, timestamp: Date.now() };
    // Array form of `.to()` — Socket.IO unions the rooms and dedupes delivery
    // per-socket, same guarantee as chaining `.to(a).to(b)` (see
    // broadcastProjectRemark above), just built dynamically since memberIds
    // is a runtime-length list here.
    const rooms = [`task:${taskId}`, ...(memberIds || []).map((id) => `user:${id}`)];
    _io().to(rooms).emit('task:remark', payload);
    return true;
  } catch (err) {
    console.error(`Failed to broadcast task remark for task ${taskId}:`, err.message);
    return false;
  }
}

/**
 * Broadcast that a leave request was created or had its status changed
 * (approve/reject). Two audiences, one chained call: every admin/super-admin/
 * hr (whoever can see the approval queue — PollingLeaveRequestsTable.jsx via
 * AdminLeaveRequests.jsx) plus the requester themselves (so their own
 * HolidaysAndLeaves.jsx list picks up the new status). Both "super-admin"
 * and "superadmin" are targeted defensively, same reasoning as
 * broadcastProjectRemark above — this codebase isn't 100% consistent about
 * which literal string a super-admin's JWT role claim holds.
 */
function broadcastLeaveUpdated(requesterId, data) {
  try {
    const payload = { ...data, timestamp: Date.now() };
    const rooms = [
      'role:admin',
      'role:super-admin',
      'role:superadmin',
      'role:hr',
      ...(requesterId ? [`user:${requesterId}`] : []),
    ];
    _io().to(rooms).emit('leave:updated', payload);
    return true;
  } catch (err) {
    console.error('Failed to broadcast leave update:', err.message);
    return false;
  }
}

/**
 * Broadcast that an employee's attendance changed — a self-service punch/
 * break action (AttendanceController.punchAction) or an admin's manual
 * correction (manualPunchAction). Targets the affected employee's own
 * `user:<id>` room (so their own TodayStatusPage picks it up on another
 * device/tab) plus every admin/super-admin/hr (so SuperAdminDashboard's
 * workforce snapshot, SuperAdminAttendancePortal's employee detail view, and
 * the active-employees count all stay live) in one chained/array call.
 */
function broadcastAttendanceUpdated(userId, data) {
  try {
    const payload = { userId, ...data, timestamp: Date.now() };
    const rooms = [
      `user:${userId}`,
      'role:admin',
      'role:super-admin',
      'role:superadmin',
      'role:hr',
    ];
    _io().to(rooms).emit('attendance:updated', payload);
    return true;
  } catch (err) {
    console.error(`Failed to broadcast attendance update for user ${userId}:`, err.message);
    return false;
  }
}

/**
 * Broadcast that an employee's blocking payment was activated/approved/
 * rejected/cancelled. Targeted purely at that employee's own `user:<id>`
 * room — unlike the attendance/leave broadcasts above, nobody else's UI
 * (admin dashboards, etc.) reacts to this in real time today, so there's no
 * role room to also fan out to.
 */
function broadcastPaymentUpdated(userId, data) {
  try {
    const payload = { ...data, timestamp: Date.now() };
    _io().to(`user:${userId}`).emit('payment:updated', payload);
    return true;
  } catch (err) {
    console.error(`Failed to broadcast payment update for user ${userId}:`, err.message);
    return false;
  }
}

// --- Deprecated no-ops -------------------------------------------------
// The old raw-ws transport tracked connections in a plain object and handed
// it around via these two functions. Nothing needs to call them anymore
// (Socket.IO owns connection tracking via rooms), but they're kept as
// harmless stubs in case anything still imports them.
function setWebSocketUsers() {}
function getWebSocketUsers() {
  return {};
}

module.exports = {
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  broadcastMessageToConversation,
  broadcastProjectMessage,
  broadcastMessageRead,
  broadcastMessageStatusUpdate,
  broadcastMessagePinned,
  broadcastUserTyping,
  broadcastUserStoppedTyping,
  broadcastMessageDelivered,
  broadcastProjectRemark,
  broadcastProjectRemarkDeleted,
  broadcastConversationUpdated,
  broadcastTaskRemark,
  broadcastLeaveUpdated,
  broadcastAttendanceUpdated,
  broadcastPaymentUpdated,
  setWebSocketUsers,
  getWebSocketUsers,
};
