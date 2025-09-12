import { useEffect, useRef, useState } from "react";

const useChatWebSocket = (
  jwtToken,
  activeConversationId,
  allConversations = []
) => {
  const ws = useRef(null);
  const [messages, setMessages] = useState([]); // Messages for active conversation
  const [allMessages, setAllMessages] = useState([]); // All messages from any conversation

  useEffect(() => {
    if (!jwtToken) {
      console.warn("[WebSocket] No JWT token, skipping connection.");
      return;
    }

    console.log("[WebSocket] Connecting...");

    const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:5000/ws";

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
          setAllMessages((prev) => [...prev, data]);

          // Add to messages only if it's for the active conversation
          if (data.conversationId === activeConversationId) {
            console.log(
              "[WebSocket] New message for active conversation:",
              data
            );
            setMessages((prev) => [...prev, data]);
          }
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
    } else {
      console.warn(
        "[WebSocket] Cannot send message - socket not open. ReadyState:",
        ws.current?.readyState
      );
    }
  };

  return {
    messages, // Messages for active conversation only
    allMessages, // All messages from any conversation (for unread tracking)
    sendMessage,
  };
};

export default useChatWebSocket;
