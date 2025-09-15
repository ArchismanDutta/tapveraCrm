import { useEffect, useRef, useState } from "react";

const useChatWebSocket = (
  jwtToken,
  activeConversationId,
  allConversations = []
) => {
  const ws = useRef(null);
  const [messages, setMessages] = useState([]); // Messages for active conversation
  const [allMessages, setAllMessages] = useState([]); // All messages from any conversation
  const [notifications, setNotifications] = useState([]); // lightweight notifications

  useEffect(() => {
    if (!jwtToken) {
      console.warn("[WebSocket] No JWT token, skipping connection.");
      return;
    }

    console.log("[WebSocket] Connecting...");

    // Determine WS endpoint: prefer env, else infer from window location; avoid hardcoded /ws path
    const WS_BASE = (() => {
      // 1) Explicit WS base overrides everything
      if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;

      // 2) Prefer API base if provided; convert http(s) -> ws(s)
      const apiBase = import.meta.env.VITE_API_BASE;
      if (apiBase) {
        try {
          const u = new URL(apiBase);
          u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
          // Use origin (no path) since server upgrades at root
          return `${u.protocol}//${u.host}`;
        } catch {}
      }

      // 3) Fallback to window origin (but this is usually the Vite dev port; not ideal)
      if (typeof window !== "undefined" && window.location) {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        // Prefer backend default port when running Vite dev server
        const defaultHost = window.location.hostname + ":5000";
        return `${protocol}://${defaultHost}`;
      }
      // 4) Final fallback
      return "ws://localhost:5000";
    })();

    console.log("[WebSocket] Connecting to:", WS_BASE);
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      console.log("[WebSocket] Connected.");

      // Subscribe to all conversations the user is part of
      const allConversationIds = allConversations.map((conv) => conv._id);

      const authPayload = {
        type: "authenticate",
        token: jwtToken,
        conversationIds: allConversationIds, // Subscribe to all conversations
      };
      console.log("[WebSocket] Sending authentication:", authPayload);
      ws.current.send(JSON.stringify(authPayload));
    };

    ws.current.onmessage = (event) => {
      console.log("[WebSocket] Raw message received:", event.data);
      try {
        const data = JSON.parse(event.data);
        console.log("[WebSocket] Parsed message:", data);

        if (data.type === "message") {
          console.log("[WebSocket] New message received:", data);

          // Add to allMessages for unread tracking
          setAllMessages((prev) => {
            // Drop matching optimistic local duplicates (same text within 5s)
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

          // Add to messages only if it's for the active conversation
          if (data.conversationId === activeConversationId) {
            console.log(
              "[WebSocket] New message for active conversation:",
              data
            );
            setMessages((prev) => {
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
        }
        if (data.type === "private_message") {
          // Treat private messages similarly for UI update
          setAllMessages((prev) => {
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
          if (data.conversationId === activeConversationId) {
            setMessages((prev) => {
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
        }
        if (data.type === "notification") {
          setNotifications((prev) => [...prev, data]);
          // Optionally show a toast
          if (window?.toast) {
            try { window.toast(`${data.title}: ${data.body}`); } catch {}
          }
          // Dispatch a DOM event others can listen to
          window.dispatchEvent(new CustomEvent("ws-notification", { detail: data }));
        }
      } catch (err) {
        console.error("[WebSocket] Failed to parse message:", err);
      }
    };

    ws.current.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    ws.current.onclose = (event) => {
      console.warn("[WebSocket] Connection closed:", event.code, event.reason);
    };

    return () => {
      console.log("[WebSocket] Cleaning up and closing connection.");
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [jwtToken, activeConversationId, allConversations]);

  // Clear messages when active conversation changes
  useEffect(() => {
    setMessages([]);
  }, [activeConversationId]);

  const sendMessage = (conversationId, message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const msgPayload = {
        type: "message",
        conversationId,
        message,
      };
      console.log("[WebSocket] Sending message:", msgPayload);
      ws.current.send(JSON.stringify(msgPayload));
      // Do not optimistically append when WS is open; server echo will update UI to avoid duplicates
    } else {
      console.warn(
        "[WebSocket] Cannot send message - socket not open. ReadyState:",
        ws.current?.readyState
      );
      // Fallback to REST send; ensures messages still go through if WS not ready
      try {
        const token = localStorage.getItem("token");
        fetch((import.meta.env.VITE_API_BASE || "http://localhost:5000") + "/api/chat/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ conversationId, message }),
        }).then(() => {
          // Optimistic append on REST fallback as well
          try {
            const currentUserId = JSON.parse(localStorage.getItem("user") || "{}")._id;
            const localMsg = {
              _id: `local-${Date.now()}`,
              conversationId,
              senderId: String(currentUserId || ""),
              message,
              timestamp: Date.now(),
            };
            setAllMessages((p) => [...p, localMsg]);
            setMessages((p) => [...p, localMsg]);
          } catch {}
        }).catch(() => {});
      } catch {}
    }
  };

  return {
    messages, // Messages for active conversation only
    allMessages, // All messages from any conversation (for unread tracking)
    notifications,
    sendMessage,
  };
};

export default useChatWebSocket;
