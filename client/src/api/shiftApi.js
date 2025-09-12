import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Shift API functions
export const shiftApi = {
  // Get all shifts
  getShifts: () => api.get("/shifts/shifts"),

  // Create new shift
  createShift: (data) => api.post("/shifts/shifts", data),

  // Assign shift to employee
  assignEmployeeShift: (data) => api.post("/shifts/employee-shift", data),

  // Submit shift change request
  submitShiftChangeRequest: (data) =>
    api.post("/shifts/shift-change-request", data),

  // Get effective shift for date
  getEffectiveShift: (date) =>
    api.get(`/shifts/employee-shift/effective/${date}`),
};

export default api;
