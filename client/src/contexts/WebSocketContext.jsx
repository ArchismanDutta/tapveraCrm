import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useDispatch } from "react-redux";
import notificationManager from "../utils/browserNotifications";
import { receiveRealtime } from "../store/slices/notificationSlice";
import { AUTH_CHANGED_EVENT, readAuthToken } from "../utils/authEvents";

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
  const [chatMessages, setChatMessages] = useState([]); // Messages for active conversation
  const [allChatMessages, setAllChatMessages] = useState([]); // All messages
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

  // Register notification handler
  const registerNotificationHandler = useCallback((handler) => {
    notificationHandlersRef.current.add(handler);
    return () => notificationHandlersRef.current.delete(handler);
  }, []);

  // Notification sound lives in NotificationBell (notisound.wav, gated on the
  // user's mute toggle and on audio being unlocked by a real interaction).
  // This provider used to own a second, competing sound for payslips only —
  // removed, so there is one sound for one notification.

  // Update active conversation
  const setActiveConversation = useCallback((conversationId) => {
    activeConversationIdRef.current = conversationId;
    setChatMessages([]); // Clear messages when switching conversations

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent("chat-active-conversation", {
      detail: { conversationId }
    }));
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

      // (Re)subscribe to whatever conversations we already know about.
      socket.emit("chat:subscribe", {
        conversationIds: conversationsRef.current.map((c) => c._id),
      });
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err.message);
    });

    // ---- Chat messages ---------------------------------------------------
    socket.on("chat:message", (data) => {
      console.log("[Socket] Chat message received:", data);

      const currentUserId = (() => {
        try {
          return JSON.parse(localStorage.getItem("user") || "{}")._id;
        } catch {
          return null;
        }
      })();

      const isFromSelf = String(data.senderId || "") === String(currentUserId || "");
      const isForActiveConv = String(data.conversationId || "") === String(activeConversationIdRef.current);

      // Add to all messages
      setAllChatMessages((prev) => {
        const ts = new Date(data.timestamp).getTime();
        const filtered = prev.filter((m) => {
          const mid = String(m._id || "");
          if (!mid.startsWith("local-")) return true;
          const sameText = m.message === data.message;
          const sameSender = String(m.senderId || "") === String(data.senderId || "");
          const mts = new Date(m.timestamp).getTime();
          const close = Math.abs(mts - ts) < 5000;
          return !(sameText && sameSender && close);
        });
        return [...filtered, data];
      });

      // Add to active conversation messages
      if (isForActiveConv) {
        setChatMessages((prev) => {
          const ts = new Date(data.timestamp).getTime();
          const filtered = prev.filter((m) => {
            const mid = String(m._id || "");
            if (!mid.startsWith("local-")) return true;
            const sameText = m.message === data.message;
            const sameSender = String(m.senderId || "") === String(data.senderId || "");
            const mts = new Date(m.timestamp).getTime();
            const close = Math.abs(mts - ts) < 5000;
            return !(sameText && sameSender && close);
          });
          return [...filtered, data];
        });
      }

      // Update unread counters if not from self and not for active conversation
      if (!isFromSelf && !isForActiveConv) {
        try {
          const rawMap = sessionStorage.getItem("chat_unread_map");
          const map = rawMap ? JSON.parse(rawMap) : {};
          const convId = String(data.conversationId || "");
          map[convId] = (map[convId] || 0) + 1;
          sessionStorage.setItem("chat_unread_map", JSON.stringify(map));

          const total = Object.values(map).reduce((a, b) => a + Number(b || 0), 0);
          sessionStorage.setItem("chat_unread_total", String(total));

          window.dispatchEvent(new CustomEvent("chat-unread-total", { detail: { total } }));
          window.dispatchEvent(new CustomEvent("chat-unread-map", { detail: { map } }));

          // Deliberately NOT raising a browser notification or dispatching
          // "ws-notification" here.
          //
          // Every chat message also produces a persisted notification
          // (chatController.saveMessage -> notificationService), which arrives
          // separately as "notification:new" and is handled further down. Doing
          // it in both places rang the bell twice and played the sound twice
          // for one message.
          //
          // The other copy is the better one to keep: it carries a
          // notificationId, and the server builds its title from the real
          // conversation name — whereas `conversationsRef` here is only
          // populated while the chat page is mounted, so everywhere else in the
          // app this fell back to the literal string "Group Chat".
          //
          // Division of labour: this handler owns message data and the unread
          // counter; "notification:new" owns telling the user about it.
        } catch (err) {
          console.error("Failed to update unread counters:", err);
        }
      }
    });

    // Typing indicators for internal team/group chat — bridged to window
    // CustomEvents the same way project:typing/project:stop_typing are,
    // so ChatWindow can pick them up without opening its own connection.
    socket.on("chat:typing", (data) => {
      window.dispatchEvent(new CustomEvent("chat-typing", { detail: data }));
    });
    socket.on("chat:stop_typing", (data) => {
      window.dispatchEvent(new CustomEvent("chat-stop-typing", { detail: data }));
    });

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
    socket.on("project:message", (data) => {
      window.dispatchEvent(new CustomEvent("project-message", { detail: data }));
    });
    socket.on("project:typing", (data) => {
      window.dispatchEvent(new CustomEvent("project-typing", { detail: data }));
    });
    socket.on("project:stop_typing", (data) => {
      window.dispatchEvent(new CustomEvent("project-stop-typing", { detail: data }));
    });
    socket.on("project:message_read", (data) => {
      window.dispatchEvent(new CustomEvent("project-message-read", { detail: data }));
    });
    socket.on("project:message_status", (data) => {
      window.dispatchEvent(new CustomEvent("project-message-status", { detail: data }));
    });
    socket.on("project:message_pinned", (data) => {
      window.dispatchEvent(new CustomEvent("project-message-pinned", { detail: data }));
    });
    socket.on("project:message_delivered", (data) => {
      window.dispatchEvent(new CustomEvent("project-message-delivered", { detail: data }));
    });
    socket.on("project:remark", (data) => {
      window.dispatchEvent(new CustomEvent("project-remark", { detail: data }));
    });
    socket.on("project:remark_deleted", (data) => {
      window.dispatchEvent(new CustomEvent("project-remark-deleted", { detail: data }));
    });
    socket.on("conversation:updated", (data) => {
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

      // Fallback to REST API
      const token = localStorage.getItem("token");
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:5000";

      fetch(`${apiBase}/api/chat/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId, message }),
      })
        .then(() => {
          // Optimistic update
          try {
            const currentUserId = JSON.parse(localStorage.getItem("user") || "{}")._id;
            const localMsg = {
              _id: `local-${Date.now()}`,
              conversationId,
              senderId: String(currentUserId || ""),
              message,
              timestamp: new Date().toISOString(),
            };
            setAllChatMessages((prev) => [...prev, localMsg]);
            setChatMessages((prev) => [...prev, localMsg]);
          } catch (err) {
            console.error("Failed to add optimistic message:", err);
          }
        })
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

  // ---- Project room helpers --------------------------------------------
  const joinProject = useCallback((projectId) => {
    if (projectId) socketRef.current?.emit("project:join", { projectId });
  }, []);

  const leaveProject = useCallback((projectId) => {
    if (projectId) socketRef.current?.emit("project:leave", { projectId });
  }, []);

  const sendProjectMessage = useCallback((projectId, messageData) => {
    socketRef.current?.emit("project:message", { projectId, messageData });
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
    chatMessages,
    allChatMessages,
    sendMessage,
    setActiveConversation,
    setConversations,
    registerNotificationHandler,
    sendChatTyping,
    sendChatStopTyping,
    joinProject,
    leaveProject,
    sendProjectMessage,
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
