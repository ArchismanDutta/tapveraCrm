import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

/**
 * Notification store.
 *
 * The server (server/services/notificationService.js) is the source of
 * truth — it persists every notification before it ever reaches a socket.
 * The `notification:new` socket event (bridged in via
 * WebSocketContext -> receiveRealtime) is just a "something arrived, bump
 * the badge" signal; a full reconcile always happens over REST via
 * fetchUnreadCount / fetchLatestNotifications.
 *
 * This slice intentionally only tracks the unread count + a short list of
 * the most recent notifications (for the bell dropdown). The full
 * searchable/paginated history lives in NotificationCenterPage's own local
 * state, which talks to the same REST API directly — no need to duplicate
 * that here.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export const fetchUnreadCount = createAsyncThunk(
  "notifications/fetchUnreadCount",
  async () => {
    const res = await fetch(`${API_BASE}/api/notifications/unread-count`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch unread count");
    const data = await res.json();
    return data.count || 0;
  }
);

export const fetchLatestNotifications = createAsyncThunk(
  "notifications/fetchLatest",
  async (limit = 10) => {
    const res = await fetch(
      `${API_BASE}/api/notifications?limit=${limit}&page=1`,
      { headers: authHeaders() }
    );
    if (!res.ok) throw new Error("Failed to fetch notifications");
    const data = await res.json();
    return {
      items: data.notifications || [],
      unreadCount: data.unreadCount || 0,
    };
  }
);

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    items: [],
    unreadCount: 0,
    status: "idle", // idle | loading | ready | error
  },
  reducers: {
    /**
     * A live notification arrived over the socket (see
     * WebSocketContext.jsx). Dedup by notificationId so a reconnect replay
     * or a delivery that raced the REST fetch can never double-count the
     * badge or show the same row twice.
     */
    receiveRealtime: (state, action) => {
      const n = action.payload || {};
      const id = n.notificationId || n._id;
      if (id && state.items.some((i) => (i._id || i.notificationId) === id)) return;

      state.items = [
        {
          _id: id || `live-${Date.now()}`,
          type: n.channel,
          channel: n.channel,
          title: n.title,
          body: n.body || n.message,
          message: n.message || n.body,
          priority: n.priority,
          read: false,
          createdAt: n.timestamp || new Date().toISOString(),
          ...n,
        },
        ...state.items,
      ].slice(0, 20);
      state.unreadCount += 1;
    },
    markReadLocal: (state, action) => {
      const id = action.payload;
      const item = state.items.find((i) => i._id === id);
      if (item && !item.read) {
        item.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllReadLocal: (state) => {
      state.items = state.items.map((i) => ({ ...i, read: true }));
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(fetchLatestNotifications.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchLatestNotifications.fulfilled, (state, action) => {
        state.status = "ready";
        state.items = action.payload.items;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchLatestNotifications.rejected, (state) => {
        state.status = "error";
      });
  },
});

export const { receiveRealtime, markReadLocal, markAllReadLocal } =
  notificationSlice.actions;

export const selectNotificationItems = (s) => s.notifications.items;
export const selectUnreadCount = (s) => s.notifications.unreadCount;
export const selectNotificationStatus = (s) => s.notifications.status;

export default notificationSlice.reducer;
