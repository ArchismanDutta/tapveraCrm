import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

export const fetchUsers = async () => {
  const res = await axios.get(`${API_BASE}/chat/users`, { headers: getAuthHeaders() });
  return res.data;
};

export const getOrCreateConversation = async (userId) => {
  const res = await axios.post(
    `${API_BASE}/chat/conversation`,
    { userId }, // ✅ correct key
    { headers: getAuthHeaders() }
  );
  return res.data;
};

export const fetchMessages = async (conversationId) => {
  const res = await axios.get(`${API_BASE}/chat/messages/${conversationId}`, { headers: getAuthHeaders() });
  return res.data;
};

export const sendMessage = async (conversationId, content) => {
  const res = await axios.post(
    `${API_BASE}/chat/messages/${conversationId}`,
    { content },
    { headers: getAuthHeaders() }
  );
  return res.data;
};
