import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

// -------------------- USERS --------------------
export const fetchUsers = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/chat/users`, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    console.error("fetchUsers error:", err.response?.data || err.message);
    throw err;
  }
};

// -------------------- CONVERSATIONS --------------------

// Fetch all conversations for the logged-in user
export const fetchConversations = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/chat/conversations`, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    console.error("fetchConversations error:", err.response?.data || err.message);
    throw err;
  }
};

// Create 1:1 or group conversation
export const createConversation = async (memberIds, groupName = null) => {
  try {
    const res = await axios.post(
      `${API_BASE}/chat/conversations/create`,
      { memberIds, groupName },
      { headers: getAuthHeaders() }
    );
    return res.data;
  } catch (err) {
    console.error("createConversation error:", err.response?.data || err.message);
    throw err;
  }
};

// -------------------- MESSAGES --------------------

// Fetch messages for a conversation
export const fetchMessages = async (conversationId) => {
  try {
    const res = await axios.get(`${API_BASE}/api/chat/messages/${conversationId}`, { headers: getAuthHeaders() });
    return res.data;
  } catch (err) {
    console.error("fetchMessages error:", err.response?.data || err.message);
    throw err;
  }
};

// Send a message to a conversation
export const sendMessage = async (conversationId, content) => {
  try {
    const res = await axios.post(
      `${API_BASE}/chat/messages/${conversationId}`,
      { content },
      { headers: getAuthHeaders() }
    );
    return res.data;
  } catch (err) {
    console.error("sendMessage error:", err.response?.data || err.message);
    throw err;
  }
};
