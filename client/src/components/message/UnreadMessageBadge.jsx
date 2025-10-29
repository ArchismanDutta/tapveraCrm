import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * UnreadMessageBadge Component - Shows unread message count for a project
 *
 * Features:
 * - Fetches unread count from backend
 * - Auto-refreshes on interval
 * - Listens for WebSocket updates
 * - Shows red badge with count
 * - Hides when count is 0
 *
 * @param {String} projectId - Project ID to fetch unread count for
 * @param {Number} refreshInterval - Refresh interval in ms (default: 30000)
 * @param {String} className - Additional CSS classes
 * @param {Boolean} showZero - Show badge even when count is 0
 */
const UnreadMessageBadge = ({
  projectId,
  refreshInterval = 30000,
  className = '',
  showZero = false
}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!projectId) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(
        `/api/projects/${projectId}/messages/unread-count`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setUnreadCount(response.data.unreadCount || 0);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUnreadCount();
  }, [projectId]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [projectId, refreshInterval]);

  // Listen for WebSocket events
  useEffect(() => {
    const handleNewMessage = (event) => {
      if (event.detail?.projectId === projectId) {
        fetchUnreadCount();
      }
    };

    const handleMessageRead = (event) => {
      if (event.detail?.projectId === projectId) {
        fetchUnreadCount();
      }
    };

    window.addEventListener('project-message-received', handleNewMessage);
    window.addEventListener('project-messages-read', handleMessageRead);

    return () => {
      window.removeEventListener('project-message-received', handleNewMessage);
      window.removeEventListener('project-messages-read', handleMessageRead);
    };
  }, [projectId]);

  // Don't show badge if count is 0 and showZero is false
  if (!showZero && unreadCount === 0) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full ${className}`}
      style={{
        animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none'
      }}
    >
      {loading ? '...' : unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
};

export default UnreadMessageBadge;
