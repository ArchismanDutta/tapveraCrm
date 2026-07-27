import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * UnreadMessageBadge Component - Shows unread message count for a project
 *
 * Fetches the authoritative unread count ONCE on mount (or when projectId
 * changes) — after that, it's event-driven, not polled. project:message /
 * project:message_read (bridged to window events by WebSocketContext.jsx)
 * already fire in real time for the message list itself; this just
 * increments/decrements the same local count off those instead of re-hitting
 * the server on a timer.
 *
 * project:message_read is a GLOBAL (not per-user) status flag — see
 * messageController.markMessageRead — so any read event for this project
 * means one fewer unread message for every viewer, this one included.
 *
 * @param {String} projectId - Project ID to fetch unread count for
 * @param {String} className - Additional CSS classes
 * @param {Boolean} showZero - Show badge even when count is 0
 */
const UnreadMessageBadge = ({
  projectId,
  className = '',
  showZero = false
}) => {
  const [unreadCount, setUnreadCount] = useState(0);

  // Authoritative baseline — one REST call, not a poll.
  useEffect(() => {
    if (!projectId) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `/api/projects/${projectId}/messages/unread-count`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!cancelled) setUnreadCount(response.data.unreadCount || 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    })();

    return () => { cancelled = true; };
  }, [projectId]);

  // Live updates from here on — no interval, just react to the same
  // real-time events the message list already relies on.
  useEffect(() => {
    const currentUserId = (() => {
      try { return JSON.parse(localStorage.getItem('user') || '{}')._id; } catch { return null; }
    })();

    const handleNewMessage = (event) => {
      const data = event.detail || {};
      if (data.projectId !== projectId) return;
      const senderId = data.messageData?.sentBy?._id || data.messageData?.sentBy;
      if (String(senderId) === String(currentUserId)) return; // don't count our own sends
      setUnreadCount((prev) => prev + 1);
    };

    const handleMessageRead = (event) => {
      if (event.detail?.projectId !== projectId) return;
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    // Local-only event ProjectDetailPage/ProjectMessagePanel dispatch to
    // themselves right after their own bulk mark-read call — everything
    // unread in this project just got cleared at once.
    const handleBulkRead = (event) => {
      if (event.detail?.projectId !== projectId) return;
      setUnreadCount(0);
    };

    window.addEventListener('project-message', handleNewMessage);
    window.addEventListener('project-message-read', handleMessageRead);
    window.addEventListener('project-messages-read', handleBulkRead);

    return () => {
      window.removeEventListener('project-message', handleNewMessage);
      window.removeEventListener('project-message-read', handleMessageRead);
      window.removeEventListener('project-messages-read', handleBulkRead);
    };
  }, [projectId]);

  // Don't show badge if count is 0 and showZero is false
  if (!showZero && unreadCount === 0) {
    return null;
  }

  // Show just a red dot indicator (no count number)
  return (
    <span
      className={`inline-flex w-2 h-2 bg-red-500 rounded-full ${className}`}
      style={{
        animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none'
      }}
      title={`${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`}
    />
  );
};

export default UnreadMessageBadge;
