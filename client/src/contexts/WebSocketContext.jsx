import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useDispatch } from "react-redux";
import notificationManager, { BrowserNotificationManager } from "../utils/browserNotifications";
import { receiveRealtime } from "../store/slices/notificationSlice";
import { AUTH_CHANGED_EVENT, readAuthToken } from "../utils/authEvents";
import * as messagingApi from "../api/messagingApi";
import { drainOutbox, startOutboxWatcher } from "../utils/outboxDrain";
// Messaging state lives in threadsSlice. This provider owns the socket and
// dispatches into the store; it does not hold message state of its own.
//
// As of Phase 5 the legacy layer is gone: the `chat:message` handler (which
// kept two message arrays and its own sessionStorage unread tally) and the nine
// `socket.on(...) -> window.dispatchEvent(CustomEvent)` re-broadcasts have all
// been removed, along with the server-side emits that fed them.
import {
  receiveMessage as receiveThreadMessage,
  receiveReceipt as receiveThreadReceipt,
  receiveThreadUpdated,
  receiveTyping as receiveThreadTyping,
  removeThread,
} from "../store/slices/threadsSlice";
import {
  receiveSnapshot as receivePresenceSnapshot,
  receiveChange as receivePresenceChange,
} from "../store/slices/presenceSlice";

const WebSocketContext = createContext(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider");
  }
  return context;
};

// Utility: resolve the Socket.IO server URL. Socket.IO's client wants an
// http(s) origin (it manages the upgrade to the websocket transport itself),
// unlike the raw `new WebSocket(wsUrl)` this used to feed a ws(s) URL to.
const resolveSocketUrl = () => {
  // 1) API base is already http(s) — the correct scheme for socket.io-client.
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }

  // 2) Fall back to VITE_WS_BASE, converting ws(s) -> http(s).
  if (import.meta.env.VITE_WS_BASE) {
    try {
      const url = new URL(import.meta.env.VITE_WS_BASE);
      url.protocol = url.protocol === "wss:" ? "https:" : "http:";
      return url.origin;
    } catch (err) {
      console.error("Failed to parse VITE_WS_BASE:", err);
    }
  }

  // 3) Fallback to window location with default port
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const host = window.location.hostname + ":5000";
    return `${protocol}://${host}`;
  }

  // 4) Final fallback
  return "http://localhost:5000";
};

// ─────────────────────────────────────────────────────────────────────────────
// AUTH → SOCKET LIFETIME
// ─────────────────────────────────────────────────────────────────────────────
// The socket's lifetime is tied to the TOKEN, not to this provider's mount.
//
// This provider is mounted in App.jsx above the router, so on a cold load it
// mounts while the user is still logged OUT and there is nothing to connect
// with. Logging in is pure SPA state, so nothing here changes when it happens.
// Read once at mount, the provider would therefore sit tokenless for the entire
// session, and every live feature in the app — chat, notifications, attendance,
// leave approvals — would silently degrade to needing a manual page refresh.
// Reloading was the only cure, because only a reload remounted this provider at
// a moment when the token already existed.
//
// See utils/authEvents.js for why the signal is a window event.

export const WebSocketProvider = ({ children }) => {
  const dispatch = useDispatch();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const activeConversationIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const notificationHandlersRef = useRef(new Set());

  // The token drives the connection — see the AUTH → SOCKET LIFETIME note above.
  const [token, setToken] = useState(readAuthToken);

  useEffect(() => {
    const sync = () => setToken(readAuthToken());

    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    // `storage` fires only in OTHER tabs, which is precisely the case the custom
    // event cannot reach: logging out in one tab should drop this tab's socket
    // too, rather than leaving it authenticated as the previous user.
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Retry the outbox on `online` / tab focus as well — a send can fail with
  // the socket still up (a single request timing out), and those events are
  // the cheapest signal that it is worth another go.
  useEffect(() => startOutboxWatcher(), []);

  // Register notification handler
  const registerNotificationHandler = useCallback((handler) => {
    notificationHandlersRef.current.add(handler);
    return () => notificationHandlersRef.current.delete(handler);
  }, []);

  // Notification sound lives in NotificationBell (notisound.wav, gated on the
  // user's mute toggle and on audio being unlocked by a real interaction).
  // This provider used to own a second, competing sound for payslips only —
  // removed, so there is one sound for one notification.

  // Track which conversation is on screen. The ref is still read by callers
  // that need it; the `chat-active-conversation` CustomEvent this used to
  // broadcast had no listeners left once ChatPage moved to `setActiveThread`.
  const setActiveConversation = useCallback((conversationId) => {
    activeConversationIdRef.current = conversationId;
  }, []);

  // Set conversations — also refreshes which conversation rooms this socket
  // is subscribed to server-side. Unlike the old raw-ws version (which only
  // sent this once, at initial connect, so conversations loaded afterwards
  // were never subscribed), this re-subscribes any time the list changes.
  const setConversations = useCallback((conversations) => {
    conversationsRef.current = conversations;
    if (socketRef.current?.connected) {
      socketRef.current.emit("chat:subscribe", {
        conversationIds: conversations.map((c) => c._id),
      });
    }
  }, []);

  // Connect to the Socket.IO server.
  // Re-runs whenever the token changes, so login connects and logout tears down.
  useEffect(() => {
    if (!token) {
      console.log("[Socket] No auth token — not connecting");
      // Otherwise a logout would leave the UI showing a stale "connected" state.
      setIsConnected(false);
      return undefined;
    }

    const socketUrl = resolveSocketUrl();
    console.log("[Socket] Connecting to:", socketUrl);

    const socket = io(socketUrl, {
      auth: { token },
      // Let socket.io-client negotiate transports itself (HTTP polling
      // first, then upgrade to a websocket) instead of forcing
      // websocket-only. Forcing websocket-only skips that negotiation and
      // fails outright on any network path that doesn't cleanly proxy the
      // raw WS upgrade on the first try (corporate proxies, some reverse
      // proxy configs, certain browser/network combos) — the client then
      // just cycles reconnect attempts forever, which is exactly the
      // permanent "Reconnecting" state this was causing. Polling has no
      // such requirement since it's just regular HTTP requests.
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setIsConnected(true);

      // Anything composed while offline goes out now (S2). A reconnected
      // socket is a stronger signal than the browser's `online` event, which
      // also fires behind a captive portal that can't actually reach us.
      drainOutbox();

      // (Re)subscribe to whatever conversations we already know about.
      socket.emit("chat:subscribe", {
        conversationIds: conversationsRef.current.map((c) => c._id),
      });
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
    });

    // Presence heartbeat. The server marks a user online with a 45s Redis TTL
    // and this is what pushes it out; miss two beats and they expire, which is
    // what makes a closed laptop go offline without a `disconnect` ever
    // arriving. Interval is 20s against that 45s TTL — two full beats of slack.
    const presenceBeat = setInterval(() => {
      if (socket.connected) socket.emit("presence:ping");
    }, 20000);

    // ---- Foreground reporting -------------------------------------------
    // Tells the server whether this tab is actually in front, which is what
    // lets pushPolicy decide between "their tab is open" and "they can see it".
    //
    // Both halves matter. `visibilityState` alone misses the case that prompted
    // this: Chrome minimised behind Photoshop reports "visible" in some
    // configurations, and a CRM window sitting unfocused on a second monitor
    // reports "visible" always. `hasFocus()` is what distinguishes the window
    // you are typing into from the four behind it.
    //
    // Being wrong here is asymmetric, so it is worth being slightly eager:
    // a spurious banner for a thread you were looking at is a small annoyance
    // and the server's 10s grace re-check usually swallows it anyway (you will
    // have read the message, so it is no longer unread). A suppressed banner is
    // a message you never find out about.
    const isForeground = () =>
      document.visibilityState === "visible" && document.hasFocus();

    let lastReported = null;
    const reportForeground = () => {
      const active = isForeground();
      // Only on transition. focus/blur/visibilitychange can fire in bursts
      // (clicking between windows fires several), and this is a socket write.
      if (active === lastReported) return;
      lastReported = active;
      if (socket.connected) socket.emit("presence:active", active);
    };

    // Report the current state as soon as the socket is up. A reconnect that
    // happens while minimised must not inherit the server's optimistic
    // `active: true` default and go on suppressing pushes.
    socket.on("connect", () => {
      lastReported = null;
      reportForeground();
    });

    document.addEventListener("visibilitychange", reportForeground);
    window.addEventListener("focus", reportForeground);
    window.addEventListener("blur", reportForeground);

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });

    // ---- Unified thread events (Phase 2) ---------------------------------
    // One handler per event for BOTH scopes, feeding the threads slice. These
    // run in parallel with the legacy handlers further down; the slice is
    // idempotent on message id, so the dual-emit lands once. When Phases 3-4
    // convert ChatPage and ProjectMessagePanel to read from Redux, the legacy
    // handlers and their CustomEvent re-broadcasts go away (Phase 5).
    // Named to avoid shadowing the `currentUserId` the legacy chat:message
    // handler declares inside its own callback.
    const readCurrentUserId = () => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}")._id || null;
      } catch {
        return null;
      }
    };

    socket.on("thread:message", ({ scope, threadId, message }) => {
      const me = readCurrentUserId();
      dispatch(receiveThreadMessage({ scope, threadId, message, currentUserId: me }));

      // Browser notification for project messages. This used to live in
      // ProjectDetailPage, which meant it only fired if you already had that
      // exact project open — the one situation where you least need telling.
      // Here it fires app-wide.
      //
      // Chat messages are deliberately NOT notified here: every chat message
      // also produces a persisted notification that arrives as
      // `notification:new` and is handled below. Doing both rang the bell twice
      // for one message.
      if (scope === "project" && message && String(message.sender?.id) !== String(me)) {
        try {
          const who =
            message.sender?.kind === "Client" ? "Client" : message.sender?.name || "Team Member";
          BrowserNotificationManager.getInstance().show(
            "New Project Message",
            `${who}: ${message.body || "Sent an attachment"}`,
            { tag: `project-${threadId}`, icon: "/icon.png", requireInteraction: false }
          );
        } catch (err) {
          console.error("[Socket] project notification failed:", err.message);
        }
      }
    });

    socket.on("thread:receipt", ({ scope, threadId, messageId, userId, kind, status, at }) => {
      dispatch(receiveThreadReceipt({ scope, threadId, messageId, userId, kind, status, at }));
    });

    socket.on("thread:updated", ({ scope, threadId, patch }) => {
      dispatch(receiveThreadUpdated({ scope, threadId, patch }));
    });

    socket.on("thread:typing", ({ scope, threadId, userId, userName }) => {
      dispatch(receiveThreadTyping({ scope, threadId, userId, userName }));
    });

    socket.on("thread:stop_typing", ({ scope, threadId, userId }) => {
      dispatch(receiveThreadTyping({ scope, threadId, userId, stop: true }));
    });

    // Surfaced so a rejected join/send is visible rather than a silent no-op.
    // ---- Presence (S3) ---------------------------------------------------
    socket.on("presence:snapshot", (payload) => {
      dispatch(receivePresenceSnapshot(payload));
    });

    socket.on("presence:changed", (payload) => {
      dispatch(receivePresenceChange(payload));
    });

    socket.on("thread:error", ({ scope, threadId, code, message }) => {
      console.warn(`[Socket] thread:error (${scope}:${threadId}) ${code}: ${message}`);
    });

    // ---- Chat messages ---------------------------------------------------
    // The legacy `chat:message` handler is gone (Phase 5).
    //
    // It maintained two local message arrays with a hand-written de-dup that
    // matched optimistic rows on (same text, same sender, timestamps within
    // 5s), and it kept its own unread tally in sessionStorage — one of four
    // independent counts. `thread:message` above does both jobs in the store,
    // de-duping on message id rather than guessing by text-and-time.

    // Typing indicators for internal team/group chat — bridged to window
    // CustomEvents the same way project:typing/project:stop_typing are,
    // so ChatWindow can pick them up without opening its own connection.

    // ---- Notifications -----------------------------------------------
    socket.on("notification:new", (data) => {
      console.log("[Socket] Notification received:", data);

      // Sound is intentionally NOT played here. NotificationBell already plays
      // notisound.wav for every "ws-notification" (dispatched below), so the
      // payslip-only chime that used to live here meant payslips played two
      // different sounds at once while task, chat and wish played one.
      // One notification, one sound — the bell owns it.

      // Feed the Redux store (single source of truth for the bell's unread
      // count — see store/slices/notificationSlice.js).
      dispatch(receiveRealtime(data));

      // Call registered handlers
      notificationHandlersRef.current.forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error("Notification handler error:", err);
        }
      });

      // Dispatch event
      window.dispatchEvent(new CustomEvent("ws-notification", { detail: data }));

      // Handle task notifications
      if ((data.channel || "").toLowerCase() === "task") {
        if (notificationManager.isEnabled()) {
          notificationManager.showNotification(data.title || "New Task", {
            body: data.body || data.message,
            tag: `task-${data.taskId}`,
            icon: "/favicon.ico",
            data: { taskId: data.taskId, type: "task" }
          });
        }
      }

      // Handle chat notifications —
      // Only show browser notification here; do NOT update the unread counter
      // because the chat:message handler above already does that — incrementing
      // here too causes the badge to show 2× the real unread count.
      if ((data.channel || "").toLowerCase() === "chat") {
        const fromSelf = String(data.from || "") === String((() => {
          try {
            return JSON.parse(localStorage.getItem("user") || "{}")._id;
          } catch {
            return null;
          }
        })() || "");
        const convId = String(data.conversationId || "");
        const isActive = activeConversationIdRef.current && String(activeConversationIdRef.current) === convId;

        if (!fromSelf && !isActive && notificationManager.isEnabled()) {
          try {
            const conversation = conversationsRef.current.find(c => c._id === convId);
            const conversationName = conversation?.name || "Group Chat";
            notificationManager.showNotification(data.title || `New message in ${conversationName}`, {
              body: data.body || data.message,
              tag: `chat-${convId}`,
              icon: "/favicon.ico",
              data: { conversationId: convId, type: "chat" }
            });
          } catch (err) {
            console.error("Failed to handle chat notification:", err);
          }
        }
      }
    });

    // ---- Project rooms -------------------------------------------------
    // Bridged to window CustomEvents so ProjectDetailPage / ProjectMessagePanel
    // can listen without each opening their own socket connection (that
    // duplicate-connection pattern is what this replaces).
    socket.on("project:remark", (data) => {
      window.dispatchEvent(new CustomEvent("project-remark", { detail: data }));
    });
    socket.on("project:remark_deleted", (data) => {
      window.dispatchEvent(new CustomEvent("project-remark-deleted", { detail: data }));
    });
    socket.on("conversation:updated", (data) => {
      // Drop the thread from the store the moment we learn it's gone.
      //
      // The `action` discriminator has always been on this payload and nothing
      // read it — every listener just refetched. A refetch now prunes correctly
      // too (see fetchThreads.fulfilled), so this is about latency rather than
      // correctness: acting on the event means the conversation disappears
      // immediately instead of one round trip later, and no message can land in
      // a thread the user has already lost access to in the meantime.
      const me = readCurrentUserId();
      const mineToDrop =
        data?.action === "deleted" ||
        (data?.action === "member_removed" && String(data?.memberId) === String(me));

      if (mineToDrop && data?.conversationId) {
        dispatch(removeThread("chat", data.conversationId));
      }

      window.dispatchEvent(new CustomEvent("conversation-updated", { detail: data }));
    });
    socket.on("task:remark", (data) => {
      window.dispatchEvent(new CustomEvent("task-remark", { detail: data }));
    });
    socket.on("leave:updated", (data) => {
      window.dispatchEvent(new CustomEvent("leave-updated", { detail: data }));
    });
    socket.on("attendance:updated", (data) => {
      window.dispatchEvent(new CustomEvent("attendance-updated", { detail: data }));
    });
    socket.on("payment:updated", (data) => {
      window.dispatchEvent(new CustomEvent("payment-updated", { detail: data }));
    });

    return () => {
      clearInterval(presenceBeat);
      document.removeEventListener("visibilitychange", reportForeground);
      window.removeEventListener("focus", reportForeground);
      window.removeEventListener("blur", reportForeground);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, dispatch]);

  // Send a chat message
  const sendMessage = useCallback((conversationId, message) => {
    if (socketRef.current?.connected) {
      console.log("[Socket] Sending message:", { conversationId, message });
      socketRef.current.emit("chat:message", { conversationId, message });
    } else {
      console.warn("[Socket] Cannot send message - not connected. Using REST fallback.");

      // Fallback to REST. No local optimistic row is written any more: the
      // server echoes the saved message back as `thread:message`, which the
      // store applies. The previous version pushed a `local-<timestamp>` row
      // into two context arrays that nothing reads since Phase 3.
      messagingApi
        .sendMessage(messagingApi.SCOPES.CHAT, conversationId, { body: message })
        .catch((err) => {
          console.error("Failed to send message via REST:", err);
        });
    }
  }, []);

  // ---- Chat conversation typing helpers ---------------------------------
  const sendChatTyping = useCallback((conversationId, userName) => {
    if (conversationId) socketRef.current?.emit("chat:typing", { conversationId, userName });
  }, []);

  const sendChatStopTyping = useCallback((conversationId) => {
    if (conversationId) socketRef.current?.emit("chat:stop_typing", { conversationId });
  }, []);

  // ---- Receipt helpers (S1) ---------------------------------------------
  // Typed emitters rather than exposing the raw socket, matching the rest of
  // this context — a component that could emit anything would make the socket
  // contract impossible to reason about.
  const ackDelivered = useCallback((scope, threadId, messageIds) => {
    if (threadId && Array.isArray(messageIds) && messageIds.length) {
      socketRef.current?.emit("thread:delivered", { scope, threadId, messageIds });
    }
  }, []);

  const sendReadCursor = useCallback((scope, threadId, upToMessageId) => {
    if (threadId && upToMessageId) {
      socketRef.current?.emit("thread:read", { scope, threadId, upToMessageId });
    }
  }, []);

  // ---- Presence helpers -------------------------------------------------
  const watchPresence = useCallback((userIds) => {
    if (Array.isArray(userIds) && userIds.length) {
      socketRef.current?.emit("presence:subscribe", { userIds });
    }
  }, []);

  const unwatchPresence = useCallback((userIds) => {
    if (Array.isArray(userIds) && userIds.length) {
      socketRef.current?.emit("presence:unsubscribe", { userIds });
    }
  }, []);

  // ---- Project room helpers --------------------------------------------
  const joinProject = useCallback((projectId) => {
    if (projectId) socketRef.current?.emit("project:join", { projectId });
  }, []);

  const leaveProject = useCallback((projectId) => {
    if (projectId) socketRef.current?.emit("project:leave", { projectId });
  }, []);


  const sendProjectTyping = useCallback((projectId, userName) => {
    socketRef.current?.emit("project:typing", { projectId, userName });
  }, []);

  const sendProjectStopTyping = useCallback((projectId) => {
    socketRef.current?.emit("project:stop_typing", { projectId });
  }, []);

  // ---- Task room helpers ------------------------------------------------
  const joinTask = useCallback((taskId) => {
    if (taskId) socketRef.current?.emit("task:join", { taskId });
  }, []);

  const leaveTask = useCallback((taskId) => {
    if (taskId) socketRef.current?.emit("task:leave", { taskId });
  }, []);

  const value = {
    isConnected,
    sendMessage,
    setActiveConversation,
    setConversations,
    watchPresence,
    unwatchPresence,
    ackDelivered,
    sendReadCursor,
    registerNotificationHandler,
    sendChatTyping,
    sendChatStopTyping,
    joinProject,
    leaveProject,
    sendProjectTyping,
    sendProjectStopTyping,
    joinTask,
    leaveTask,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
