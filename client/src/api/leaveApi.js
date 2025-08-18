const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

// Helper to build headers including JWT token stored in localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

// Fetch leave requests for logged-in employee
export async function fetchLeavesForEmployee() {
  const res = await fetch(`${API_BASE}/leaves/mine`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch leave requests");
  const data = await res.json();

  return data.map((r) => ({
    id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    date: `${new Date(r.period.start).toLocaleDateString()} - ${new Date(
      r.period.end
    ).toLocaleDateString()}`,
    duration:
      Math.ceil(
        (new Date(r.period.end) - new Date(r.period.start)) /
          (1000 * 60 * 60 * 24)
      ) + 1 + " Days",
    createdAt: r.createdAt || null,
    adminRemarks: r.adminRemarks || "",
  }));
}

// Submit a new leave request
export async function submitLeaveRequest(data) {
  const res = await fetch(`${API_BASE}/leaves`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to submit leave request");

  const r = await res.json();
  return {
    id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    date: `${new Date(r.period.start).toLocaleDateString()} - ${new Date(
      r.period.end
    ).toLocaleDateString()}`,
    duration:
      Math.ceil(
        (new Date(r.period.end) - new Date(r.period.start)) /
          (1000 * 60 * 60 * 24)
      ) + 1 + " Days",
    createdAt: r.createdAt || null,
    adminRemarks: r.adminRemarks || "",
  };
}

// Fetch all leave requests (admin)
export async function fetchAllLeaveRequests() {
  const res = await fetch(`${API_BASE}/leaves`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch leave requests");

  const data = await res.json();
  return data.map((r) => ({
    id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    adminRemarks: r.adminRemarks || "",
    createdAt: r.createdAt || null,
  }));
}

// Update leave request status (admin)
export async function updateLeaveRequestStatus(id, status, adminRemarks = "") {
  const res = await fetch(`${API_BASE}/leaves/${id}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, adminRemarks }),
  });
  if (!res.ok) throw new Error("Failed to update leave request status");

  const r = await res.json();
  return {
    id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    adminRemarks: r.adminRemarks || "",
    date: `${new Date(r.period.start).toLocaleDateString()} - ${new Date(
      r.period.end
    ).toLocaleDateString()}`,
    duration:
      Math.ceil(
        (new Date(r.period.end) - new Date(r.period.start)) /
          (1000 * 60 * 60 * 24)
      ) + 1 + " Days",
    createdAt: r.createdAt || null,
  };
}

// Fetch team leaves (for TeamLeaveCalendar component)
export async function fetchTeamLeaves() {
  const res = await fetch(`${API_BASE}/leaves/team`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch team leaves");
  const data = await res.json();
  return data.map((r) => ({
    name: r.employee.name,
    dates: formatPeriod(r.period),
    type: capitalize(r.type),
  }));
}

// Utility function to format leave period for display
function formatPeriod(period) {
  if (!period?.start || !period?.end) return "";
  const start = new Date(period.start).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(period.end).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return start === end ? start : `${start}–${end}`;
}

// Utility function to capitalize a string
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
