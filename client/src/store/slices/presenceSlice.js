import { createSlice } from "@reduxjs/toolkit";

/**
 * Presence store — who is online, and when the rest were last seen.
 *
 * Server-driven only. Nothing here infers presence from message activity or
 * from typing events: those would make someone look online because they sent
 * something an hour ago, which is worse than showing nothing. The server's
 * Redis TTL is the only source (see services/messaging/presence.js).
 *
 * A user who has hidden their presence arrives as `{ hidden: true }` and is
 * rendered as nothing at all — not as "offline", which would leak the very
 * thing they turned off.
 */

const initialState = {
  // userId -> { online: boolean, lastSeenAt: string|null, hidden?: true }
  byUser: {},
};

const presenceSlice = createSlice({
  name: "presence",
  initialState,
  reducers: {
    /** Bulk state for a set of users, sent on subscribe. */
    receiveSnapshot(state, action) {
      const snapshot = action.payload?.presence || {};
      Object.entries(snapshot).forEach(([userId, value]) => {
        state.byUser[String(userId)] = value;
      });
    },

    /** One user's state changed. */
    receiveChange(state, action) {
      const { userId, online, lastSeenAt } = action.payload || {};
      if (!userId) return;
      const key = String(userId);

      // A change event is never sent for a hidden user, so if one arrives the
      // user must have just re-enabled presence — clear the hidden flag.
      state.byUser[key] = {
        online: Boolean(online),
        lastSeenAt: online ? null : lastSeenAt || state.byUser[key]?.lastSeenAt || null,
      };
    },

    resetPresence() {
      return initialState;
    },
  },
});

export const { receiveSnapshot, receiveChange, resetPresence } = presenceSlice.actions;

/* ── Selectors ────────────────────────────────────────────────────────── */

const UNKNOWN = Object.freeze({ online: false, lastSeenAt: null, unknown: true });

export const selectPresence = (userId) => (s) =>
  s.presence.byUser[String(userId)] || UNKNOWN;

/** How many of these users are online — for a group's "3 online" line. */
export const selectOnlineCount = (userIds = []) => (s) =>
  userIds.reduce((n, id) => n + (s.presence.byUser[String(id)]?.online ? 1 : 0), 0);

/* ── Formatting ───────────────────────────────────────────────────────── */

/**
 * Human "last seen" string. Returns null when there is nothing honest to say —
 * hidden, unknown, or currently online — so callers render nothing rather than
 * a misleading "last seen a long time ago".
 */
export function formatLastSeen(entry) {
  if (!entry || entry.hidden || entry.unknown || entry.online) return null;
  if (!entry.lastSeenAt) return null;

  const then = new Date(entry.lastSeenAt).getTime();
  if (Number.isNaN(then)) return null;

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return "last seen just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `last seen ${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `last seen ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "last seen yesterday";
  if (days < 7) return `last seen ${days}d ago`;

  return `last seen ${new Date(then).toLocaleDateString()}`;
}

export default presenceSlice.reducer;
