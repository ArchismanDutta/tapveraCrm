// src/api/holidayApi.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
export const fetchHolidays = async (shift = "ALL") => {
  try {
    const res = await axios.get(`${API_BASE}/api/holidays?shift=${shift}`);
    // Map the backend response to frontend-friendly format if needed
    return res.data.map((h) => ({
      name: h.name,
      date: new Date(h.date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      type: h.type,
    }));
  } catch (err) {
    console.error("Failed to fetch holidays:", err);
    return [];
  }
};
