// File: src/api/flexibleShiftApi.js

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const getAuthHeaders = (isJson = true) => {
  const token = localStorage.getItem("token");
  const headers = { Authorization: token ? `Bearer ${token}` : "" };
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
};

// ======================
// Employee Functions
// ======================

/**
 * Submit a new flexible shift request
 * @param {Object} requestData - { requestedDate, requestedStartTime, durationHours, reason }
 * @returns {Object} Created request
 */
export async function submitFlexibleShiftRequest(requestData) {
  const response = await fetch(`${API_BASE}/api/flexible-shifts/request`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(requestData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to submit flexible shift request");
  }

  return await response.json();
}

/**
 * Fetch employee's own flexible shift requests
 * @returns {Array} Array of flexible shift requests
 */
export async function fetchMyFlexibleRequests() {
  const response = await fetch(`${API_BASE}/api/flexible-shifts/my-requests`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch flexible shift requests");
  }

  return await response.json();
}

/**
 * Delete a flexible shift request
 * @param {string} requestId - Request ID to delete
 * @returns {Object} Success message
 */
export async function deleteFlexibleRequest(requestId) {
  const response = await fetch(`${API_BASE}/api/flexible-shifts/${requestId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to delete request");
  }

  return await response.json();
}

// ======================
// HR/Admin Functions
// ======================

/**
 * Fetch all flexible shift requests (HR/Admin)
 * @param {Object} filters - { status, startDate, endDate }
 * @returns {Array} Array of all flexible shift requests
 */
export async function fetchAllFlexibleRequests(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.status) params.append("status", filters.status);
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);

  const queryString = params.toString();
  const url = `${API_BASE}/api/flexible-shifts${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch flexible shift requests");
  }

  return await response.json();
}

/**
 * Update flexible shift request status (HR/Admin)
 * @param {string} requestId - Request ID to update
 * @param {string} status - "approved" | "rejected" | "pending"
 * @param {string} remarks - Optional remarks
 * @returns {Object} Updated request
 */
export async function updateFlexibleRequestStatus(requestId, status, remarks = "") {
  const response = await fetch(`${API_BASE}/api/flexible-shifts/${requestId}/status`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, remarks }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to update request status");
  }

  return await response.json();
}

// ======================
// Helper Functions
// ======================

/**
 * Format request status for display
 * @param {string} status - Request status
 * @returns {Object} { text, color, bgColor }
 */
export function formatRequestStatus(status) {
  const statusMap = {
    pending: { text: "Pending", color: "text-yellow-600", bgColor: "bg-yellow-100" },
    approved: { text: "Approved", color: "text-green-600", bgColor: "bg-green-100" },
    rejected: { text: "Rejected", color: "text-red-600", bgColor: "bg-red-100" }
  };
  
  return statusMap[status] || { text: status, color: "text-gray-600", bgColor: "bg-gray-100" };
}

/**
 * Calculate end time from start time and duration
 * @param {string} startTime - Start time in HH:MM format
 * @param {number} durationHours - Duration in hours
 * @returns {string} End time in HH:MM format
 */
export function calculateEndTime(startTime, durationHours) {
  const [startH, startM] = startTime.split(":").map(Number);
  
  let endH = startH + Math.floor(durationHours);
  let endM = startM + Math.round((durationHours % 1) * 60);
  
  if (endM >= 60) {
    endH += Math.floor(endM / 60);
    endM = endM % 60;
  }
  
  if (endH >= 24) {
    endH = endH % 24;
  }
  
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/**
 * Check if a date is in the past
 * @param {string|Date} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isDateInPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(date) < today;
}

/**
 * Check if request can be edited/deleted
 * @param {Object} request - Flexible shift request
 * @param {string} userRole - Current user's role
 * @param {string} userId - Current user's ID
 * @returns {Object} { canEdit, canDelete, reason }
 */
export function getRequestPermissions(request, userRole, userId) {
  const isOwner = request.employee._id === userId;
  const isAuthorized = ["hr", "admin", "super-admin"].includes(userRole);
  const isPastDate = isDateInPast(request.requestedDate);
  const isApproved = request.status === "approved";
  
  if (isApproved && isPastDate) {
    return {
      canEdit: false,
      canDelete: false,
      reason: "Cannot modify approved requests for past dates"
    };
  }
  
  if (isApproved && !isAuthorized) {
    return {
      canEdit: false,
      canDelete: false,
      reason: "Only HR/Admin can modify approved requests"
    };
  }
  
  if (!isOwner && !isAuthorized) {
    return {
      canEdit: false,
      canDelete: false,
      reason: "Not authorized to modify this request"
    };
  }
  
  return {
    canEdit: !isPastDate,
    canDelete: true,
    reason: null
  };
}
