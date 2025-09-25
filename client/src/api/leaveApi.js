const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const getAuthHeaders = (isJson = true) => {
  const token = localStorage.getItem("token");
  const headers = { Authorization: token ? `Bearer ${token}` : "" };
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
};

// Format leave type to human-readable string
export const formatLeaveType = (type) => {
  const leaveTypeLabels = {
    annual: "Annual Leave",
    maternity: "Maternity Leave",
    halfDay: "Half Day",
    paid: "Paid Leave",
    unpaid: "Unpaid Leave",
    sick: "Sick Leave",
    workFromHome: "Work From Home",
  };
  return leaveTypeLabels[type] || type;
};

// Format leave duration
export function formatDuration(type, period) {
  if (!period || !period.start || !period.end) return "";
  if (type === "halfDay") return "0.5 Day";
  const days =
    Math.ceil(
      (new Date(period.end) - new Date(period.start)) / (1000 * 60 * 60 * 24)
    ) + 1;
  return `${days} Days`;
}

// Fetch leaves for logged-in employee
export async function fetchLeavesForEmployee() {
  const res = await fetch(`${API_BASE}/api/leaves/mine`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok)
    throw new Error(
      (await res.json()).message || "Failed to fetch leave requests"
    );
  const data = await res.json();
  return data.map((r) => ({
    _id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    duration: formatDuration(r.type, r.period),
    adminRemarks: r.adminRemarks || "",
    createdAt: r.createdAt || null,
  }));
}

// Submit a new leave request
export async function submitLeaveRequest(formData) {
  const res = await fetch(`${API_BASE}/api/leaves`, {
    method: "POST",
    headers: getAuthHeaders(false),
    body: formData,
  });
  if (!res.ok)
    throw new Error(
      (await res.json()).message || "Failed to submit leave request"
    );
  const r = await res.json();
  return {
    _id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    duration: formatDuration(r.type, r.period),
    adminRemarks: r.adminRemarks || "",
    createdAt: r.createdAt || null,
  };
}

// Admin: Fetch all leave requests
export async function fetchAllLeaveRequests() {
  const res = await fetch(`${API_BASE}/api/leaves`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok)
    throw new Error(
      (await res.json()).message || "Failed to fetch leave requests"
    );
  const data = await res.json();
  return data.map((r) => ({
    _id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    adminRemarks: r.adminRemarks || "",
    createdAt: r.createdAt || null,
    approvedBy: r.approvedBy || null,
  }));
}

// Admin: Update leave request status
export async function updateLeaveRequestStatus(_id, status, adminRemarks = "") {
  if (!_id) throw new Error("Leave request ID is required");
  const res = await fetch(`${API_BASE}/api/leaves/${_id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, adminRemarks }),
  });
  if (!res.ok)
    throw new Error(
      (await res.json()).message || "Failed to update leave request status"
    );
  const r = await res.json();
  return {
    _id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    adminRemarks: r.adminRemarks || "",
    createdAt: r.createdAt || null,
  };
}

// Update leave request (employee can only edit pending requests)
export async function updateLeaveRequest(leaveId, formData) {
  const res = await fetch(`${API_BASE}/api/leaves/${leaveId}`, {
    method: "PUT",
    headers: getAuthHeaders(false),
    body: formData,
  });
  if (!res.ok)
    throw new Error(
      (await res.json()).message || "Failed to update leave request"
    );
  const r = await res.json();
  return {
    _id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    duration: formatDuration(r.type, r.period),
    adminRemarks: r.adminRemarks || "",
    createdAt: r.createdAt || null,
  };
}

// Fetch team leaves (same department, excluding logged-in user)
export async function fetchTeamLeaves(department, excludeEmail) {
  const res = await fetch(
    `${API_BASE}/api/leaves/team?department=${encodeURIComponent(
      department
    )}&excludeEmail=${encodeURIComponent(excludeEmail)}`,
    { headers: getAuthHeaders() }
  );
  if (!res.ok)
    throw new Error(
      (await res.json()).message || "Failed to fetch team leaves"
    );
  const data = await res.json();
  return data.map((r) => ({
    _id: r._id,
    employee: r.employee,
    period: r.period,
    type: r.type,
    status: r.status,
    duration: formatDuration(r.type, r.period),
    formattedType: formatLeaveType(r.type),
  }));
}
