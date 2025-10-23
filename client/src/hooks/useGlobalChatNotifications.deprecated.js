import { useEffect, useRef } from "react";
import notificationManager from "../utils/browserNotifications";

// Lightweight global WebSocket listener to maintain unread counters app-wide
const useGlobalChatNotifications = (jwtToken) => {
  const wsRef = useRef(null);
  const activeConvRef = useRef(null);
  const conversationsRef = useRef([]);

  useEffect(() => {
    if (!jwtToken) return;

    let cancelled = false;
    let conversationIds = [];

    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

    const resolveWsBase = () => {
      if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;
      const apiBase = import.meta.env.VITE_API_BASE;
      if (apiBase) {
        try {
          const u = new URL(apiBase);
          u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
          return `${u.protocol}//${u.host}`;
        } catch {}
      }
      if (typeof window !== "undefined") {
        const proto = window.location.protocol === "https:" ? "wss" : "ws";
        return `${proto}://${window.location.hostname}:5000`;
      }
      return import.meta.env.VITE_WS_BASE || "ws://localhost:5000";
    };

    const onActiveConv = (e) => {
      activeConvRef.current = e.detail?.conversationId || null;
    };
    window.addEventListener("chat-active-conversation", onActiveConv);

    const connect = () => {
      const WS_BASE = resolveWsBase();
      try {
        wsRef.current = new WebSocket(WS_BASE);
      } catch {
        return;
      }

      wsRef.current.onopen = () => {
        const authPayload = {
          type: "authenticate",
          token: jwtToken,
          conversationIds,
        };
        try { wsRef.current.send(JSON.stringify(authPayload)); } catch {}
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const currentUserId = (() => {
            try { return JSON.parse(localStorage.getItem("user") || "{}")._id; } catch { return null; }
          })();

          // Increment unread counter for incoming chat messages not from self and not for active conversation
          if (
            (data.type === "message" || data.type === "private_message") &&
            String(data.senderId || data.from || "") !== String(currentUserId || "") &&
            (!activeConvRef.current || String(data.conversationId || "") !== String(activeConvRef.current))
          ) {
            try {
              // Update per-conversation map
              const rawMap = sessionStorage.getItem("chat_unread_map");
              const map = rawMap ? JSON.parse(rawMap) : {};
              const convId = String(data.conversationId || "");
              map[convId] = (map[convId] || 0) + 1;
              sessionStorage.setItem("chat_unread_map", JSON.stringify(map));

              // Update total
              const total = Object.values(map).reduce((a, b) => a + Number(b || 0), 0);
              sessionStorage.setItem("chat_unread_total", String(total));

              // Broadcast events
              window.dispatchEvent(new CustomEvent("chat-unread-total", { detail: { total } }));
              window.dispatchEvent(new CustomEvent("chat-unread-map", { detail: { map } }));

              // ✅ NEW: Show browser/PC notification for incoming message
              const conversation = conversationsRef.current.find(c => c._id === convId);
              const conversationName = conversation?.name || "Group Chat";
              const messagePreview = (data.message || "").substring(0, 100);

              // Show browser notification
              if (notificationManager.isEnabled()) {
                notificationManager.showNotification(`New message in ${conversationName}`, {
                  body: messagePreview,
                  tag: `chat-${convId}`,
                  icon: "/favicon.ico",
                  data: { conversationId: convId, type: "chat" }
                });
              }

              // Also dispatch ws-notification for toast
              window.dispatchEvent(new CustomEvent("ws-notification", {
                detail: {
                  type: "notification",
                  channel: "chat",
                  title: `New message in ${conversationName}`,
                  body: messagePreview,
                  message: messagePreview,
                  from: data.senderId,
                  conversationId: convId
                }
              }));
            } catch {}
          }

          // Bubble notification event for toasts and update counters for chat notifications
          if (data.type === "notification") {
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

            // Handle chat notifications
            if ((data.channel || "").toLowerCase() === "chat") {
              const fromSelf = String(data.from || "") === String(currentUserId || "");
              const convId = String(data.conversationId || "");
              const isActive = activeConvRef.current && String(activeConvRef.current) === convId;
              if (!fromSelf && !isActive) {
                try {
                  const rawMap = sessionStorage.getItem("chat_unread_map");
                  const map = rawMap ? JSON.parse(rawMap) : {};
                  map[convId] = (map[convId] || 0) + 1;
                  sessionStorage.setItem("chat_unread_map", JSON.stringify(map));
                  const total = Object.values(map).reduce((a, b) => a + Number(b || 0), 0);
                  sessionStorage.setItem("chat_unread_total", String(total));
                  window.dispatchEvent(new CustomEvent("chat-unread-total", { detail: { total } }));
                  window.dispatchEvent(new CustomEvent("chat-unread-map", { detail: { map } }));

                  // ✅ Show browser notification for chat notification type
                  if (notificationManager.isEnabled()) {
                    const conversation = conversationsRef.current.find(c => c._id === convId);
                    const conversationName = conversation?.name || "Group Chat";
                    notificationManager.showNotification(data.title || `New message in ${conversationName}`, {
                      body: data.body || data.message,
                      tag: `chat-${convId}`,
                      icon: "/favicon.ico",
                      data: { conversationId: convId, type: "chat" }
                    });
                  }
                } catch {}
              }
            }
          }
        } catch {}
      };

      wsRef.current.onclose = () => {
        if (!cancelled) {
          // simple retry after delay
          setTimeout(connect, 2000);
        }
      };
    };

    const init = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/chat/groups`, {
          headers: { Authorization: `Bearer ${jwtToken}` },
        });
        if (res.ok) {
          const groups = await res.json();
          conversationIds = Array.isArray(groups) ? groups.map((g) => g._id) : [];
          conversationsRef.current = groups; // Store conversations for lookup
        }
      } catch {}
      if (!cancelled) connect();
    };

    init();

    return () => {
      cancelled = true;
      try { wsRef.current && wsRef.current.close(); } catch {}
      window.removeEventListener("chat-active-conversation", onActiveConv);
    };
  }, [jwtToken]);
};

export default useGlobalChatNotifications;


