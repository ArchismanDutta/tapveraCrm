import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
};

// ======================
// Shift Management API
// ======================

export const shiftApi = {
  // Get all shifts
  getAllShifts: async () => {
    const response = await axios.get(`${API_BASE}/api/shifts`, getAuthHeaders());
    return response.data;
  },

  // Create new shift
  createShift: async (shiftData) => {
    const response = await axios.post(`${API_BASE}/api/shifts`, shiftData, getAuthHeaders());
    return response.data;
  },

  // Update shift
  updateShift: async (shiftId, shiftData) => {
    const response = await axios.put(`${API_BASE}/api/shifts/${shiftId}`, shiftData, getAuthHeaders());
    return response.data;
  },

  // Delete shift
  deleteShift: async (shiftId) => {
    const response = await axios.delete(`${API_BASE}/api/shifts/${shiftId}`, getAuthHeaders());
    return response.data;
  },

  // Assign shift to employee
  assignShiftToEmployee: async (userId, shiftData) => {
    const response = await axios.put(`${API_BASE}/api/shifts/assign/${userId}`, shiftData, getAuthHeaders());
    return response.data;
  },

  // Get employees by shift
  getEmployeesByShift: async (shiftId) => {
    const response = await axios.get(`${API_BASE}/api/shifts/${shiftId}/employees`, getAuthHeaders());
    return response.data;
  },

  // Initialize default shifts
  initializeDefaultShifts: async () => {
    const response = await axios.post(`${API_BASE}/api/shifts/initialize`, {}, getAuthHeaders());
    return response.data;
  },
};

// ======================
// Flexible Shift Request API
// ======================

export const flexibleShiftApi = {
  // Get all flexible shift requests (HR/Admin)
  getAllRequests: async () => {
    const response = await axios.get(`${API_BASE}/api/flexible-shifts`, getAuthHeaders());
    return response.data;
  },

  // Get employee's own requests
  getMyRequests: async () => {
    const response = await axios.get(`${API_BASE}/api/flexible-shifts/my-requests`, getAuthHeaders());
    return response.data;
  },

  // Create flexible shift request
  createRequest: async (requestData) => {
    const response = await axios.post(`${API_BASE}/api/flexible-shifts/request`, requestData, getAuthHeaders());
    return response.data;
  },

  // Update request status (HR/Admin)
  updateRequestStatus: async (requestId, status) => {
    const response = await axios.put(`${API_BASE}/api/flexible-shifts/${requestId}/status`, { status }, getAuthHeaders());
    return response.data;
  },
};

export default { shiftApi, flexibleShiftApi };
