import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import notificationManager from "../utils/browserNotifications";

const WebSocketContext = createContext(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider");
  }
  return context;
};

// Utility: Resolve WebSocket URL consistently
const resolveWebSocketUrl = () => {
  // 1) Explicit WS base overrides everything
  if (import.meta.env.VITE_WS_BASE) {
    return import.meta.env.VITE_WS_BASE;
  }

  // 2) Convert API base to WebSocket URL
  const apiBase = import.meta.env.VITE_API_BASE;
  if (apiBase) {
    try {
      const url = new URL(apiBase);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return `${url.protocol}//${url.host}`;
    } catch (err) {
      console.error("Failed to parse VITE_API_BASE:", err);
    }
  }

  // 3) Fallback to window location with default port
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.hostname + ":5000";
    return `${protocol}://${host}`;
  }

  // 4) Final fallback
  return "ws://localhost:5000";
};

export const WebSocketProvider = ({ children }) => {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const activeConversationIdRef = useRef(null);
  const conversationsRef = useRef([]);
  const [chatMessages, setChatMessages] = useState([]); // Messages for active conversation
  const [allChatMessages, setAllChatMessages] = useState([]); // All messages
  const notificationHandlersRef = useRef(new Set());

  // Register notification handler
  const registerNotificationHandler = useCallback((handler) => {
    notificationHandlersRef.current.add(handler);
    return () => notificationHandlersRef.current.delete(handler);
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("Failed to play notification sound:", error);
    }
  }, []);

  // Update active conversation
  const setActiveConversation = useCallback((conversationId) => {
    activeConversationIdRef.current = conversationId;
    setChatMessages([]); // Clear messages when switching conversations

    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent("chat-active-conversation", {
      detail: { conversationId }
    }));
  }, []);

  // Set conversations
  const setConversations = useCallback((conversations) => {
    conversationsRef.current = conversations;
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.log("[WebSocket] No token found, skipping connection");
      return;
    }

    const wsUrl = resolveWebSocketUrl();
    console.log("[WebSocket] Connecting to:", wsUrl);

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);

        // Authenticate with conversation subscriptions
        const conversationIds = conversationsRef.current.map(c => c._id);
        const authPayload = {
          type: "authenticate",
          token,
          conversationIds,
        };

        wsRef.current.send(JSON.stringify(authPayload));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[WebSocket] Message received:", data);

          const currentUserId = (() => {
            try {
              return JSON.parse(localStorage.getItem("user") || "{}")._id;
            } catch {
              return null;
            }
          })();

          // Handle chat messages
          if (data.type === "message" || data.type === "private_message") {
            const isFromSelf = String(data.senderId || data.from || "") === String(currentUserId || "");
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

                // Show browser notification
                const conversation = conversationsRef.current.find(c => c._id === convId);
                const conversationName = conversation?.name || "Group Chat";
                const messagePreview = (data.message || "").substring(0, 100);

                if (notificationManager.isEnabled()) {
                  notificationManager.showNotification(`New message in ${conversationName}`, {
                    body: messagePreview,
                    tag: `chat-${convId}`,
                    icon: "/favicon.ico",
                    data: { conversationId: convId, type: "chat" }
                  });
                }

                // Dispatch ws-notification for toast
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
              } catch (err) {
                console.error("Failed to update unread counters:", err);
              }
            }
          }

          // Handle notifications
          if (data.type === "notification") {
            console.log("[WebSocket] Notification received:", data);

            // Play sound for payslip notifications
            if (data.channel === "payslip") {
              playNotificationSound();
            }

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

            // Handle chat notifications
            if ((data.channel || "").toLowerCase() === "chat") {
              const fromSelf = String(data.from || "") === String(currentUserId || "");
              const convId = String(data.conversationId || "");
              const isActive = activeConversationIdRef.current && String(activeConversationIdRef.current) === convId;

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
                } catch (err) {
                  console.error("Failed to handle chat notification:", err);
                }
              }
            }
          }
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
      };

      wsRef.current.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        setIsConnected(false);

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("[WebSocket] Attempting to reconnect...");
          connect();
        }, 5000);
      };
    } catch (err) {
      console.error("[WebSocket] Failed to create connection:", err);
    }
  }, [playNotificationSound]);

  // Send message
  const sendMessage = useCallback((conversationId, message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msgPayload = {
        type: "message",
        conversationId,
        message,
      };
      console.log("[WebSocket] Sending message:", msgPayload);
      wsRef.current.send(JSON.stringify(msgPayload));
    } else {
      console.warn("[WebSocket] Cannot send message - socket not open. Using REST fallback.");

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

  // Initialize connection
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const value = {
    isConnected,
    chatMessages,
    allChatMessages,
    sendMessage,
    setActiveConversation,
    setConversations,
    registerNotificationHandler,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
