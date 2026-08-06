// utils/websocket.js
//
// Real-time broadcast helpers for NON-messaging features — notifications,
// project/task remarks, leave, attendance, payments.
//
// Messaging no longer lives here. Every chat/project message broadcaster
// (broadcastMessageToConversation, broadcastProjectMessage, the five
// project:message_* helpers, the typing pair) moved behind
// services/messaging/realtime.js, which is the single emitter for the
// `thread:*` contract. The two `setWebSocketUsers`/`getWebSocketUsers` no-op
// stubs left over from the pre-Socket.IO raw-ws transport are gone too.
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


module.exports = {
  sendNotificationToUser,
  sendNotificationToMultipleUsers,
  broadcastProjectRemark,
  broadcastProjectRemarkDeleted,
  broadcastConversationUpdated,
  broadcastTaskRemark,
  broadcastLeaveUpdated,
  broadcastAttendanceUpdated,
  broadcastPaymentUpdated,
};
