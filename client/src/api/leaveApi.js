const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

// Helper to build headers including JWT token stored in localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

// Labels
const leaveTypeLabels = {
  annual: "Annual Leave",
  maternity: "Maternity Leave",
  halfDay: "Half Day",
  paid: "Paid Leave",
  unpaid: "Unpaid Leave",
  sick: "Sick Leave",
  workFromHome: "Work From Home",
};
export const formatLeaveType = (type) => leaveTypeLabels[type] || type;

// Duration helper
function formatDuration(type, period) {
  if (!period || !period.start || !period.end) return "";
  if (type === "halfDay") return "0.5 Day";
  const days =
    Math.ceil(
      (new Date(period.end) - new Date(period.start)) / (1000 * 60 * 60 * 24)
    ) + 1;
  return `${days} Days`;
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

// ------------------ Employee API ------------------

// Fetch leave requests for logged-in employee
export async function fetchLeavesForEmployee() {
  const res = await fetch(`${API_BASE}/leaves/mine`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch leave requests");
  }
  const data = await res.json();

  return data.map((r) => ({
    id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    date:
      r?.period?.start && r?.period?.end
        ? `${new Date(r.period.start).toLocaleDateString()} - ${new Date(
            r.period.end
          ).toLocaleDateString()}`
        : "",
    duration: formatDuration(r.type, r.period),
    createdAt: r.createdAt || null,
    adminRemarks: r.adminRemarks || "",
  }));
}

// Submit a new leave request
export async function submitLeaveRequest(formData) {
  const startDate = formData.startDate;
  const endDate =
    formData.type === "halfDay"
      ? formData.startDate
      : formData.endDate || formData.startDate;

  const payload = {
    type: formData.type,
    startDate,
    endDate,
    reason: formData.reason,
    document: formData.document || undefined,
  };

  const res = await fetch(`${API_BASE}/leaves`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to submit leave request");
  }

  const r = await res.json();
  return {
    id: r._id,
    type: r.type,
    status: r.status,
    period: r.period,
    reason: r.reason,
    document: r.document,
    employee: r.employee,
    date:
      r?.period?.start && r?.period?.end
        ? `${new Date(r.period.start).toLocaleDateString()} - ${new Date(
            r.period.end
          ).toLocaleDateString()}`
        : "",
    duration: formatDuration(r.type, r.period),
    createdAt: r.createdAt || null,
    adminRemarks: r.adminRemarks || "",
  };
}

// ------------------ Admin API ------------------

// Fetch all leave requests (admin)
export async function fetchAllLeaveRequests() {
  const res = await fetch(`${API_BASE}/leaves`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch leave requests");
  }

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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update leave request status");
  }

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
    date:
      r?.period?.start && r?.period?.end
        ? `${new Date(r.period.start).toLocaleDateString()} - ${new Date(
            r.period.end
          ).toLocaleDateString()}`
        : "",
    duration: formatDuration(r.type, r.period),
    createdAt: r.createdAt || null,
  };
}

// ------------------ Team Leaves (for modal) ------------------

// Fetch team leaves for a specific department, excluding a specific email
export async function fetchTeamLeaves(department, excludeEmail) {
  const res = await fetch(`${API_BASE}/leaves/team?department=${encodeURIComponent(department)}&excludeEmail=${encodeURIComponent(excludeEmail)}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch team leaves");
  }

  const data = await res.json();
  return data.map((r) => ({
    _id: r._id,
    employee: r.employee,
    period: r.period,
    type: r.type,
    status: r.status,
  }));
}
