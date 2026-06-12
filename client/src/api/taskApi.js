// File: src/api/taskApi.js
// Single source of truth for all task API calls.
// Auth token is attached automatically by the shared API instance.
import API from "../api";

const taskApi = {
  // List tasks (role-scoped by the backend). Optional filters: { project, status, priority }
  getTasks: (params = {}) => API.get("/api/tasks", { params }).then((r) => r.data),

  getTask: (taskId) => API.get(`/api/tasks/${taskId}`).then((r) => r.data),

  // payload: { title, description, assignedTo: [ids], dueDate, priority, project? }
  createTask: (payload) => API.post("/api/tasks", payload).then((r) => r.data),

  // Send only changed fields. assignedTo must be an array of user ids.
  updateTask: (taskId, payload) =>
    API.put(`/api/tasks/${taskId}`, payload).then((r) => r.data),

  // status: "pending" | "in-progress" | "completed" ("rejected" requires rejectTask)
  updateStatus: (taskId, status) =>
    API.patch(`/api/tasks/${taskId}/status`, { status }).then((r) => r.data),

  // Admin only; task must be completed; reason required
  rejectTask: (taskId, reason) =>
    API.patch(`/api/tasks/${taskId}/reject`, { reason }).then((r) => r.data),

  deleteTask: (taskId) => API.delete(`/api/tasks/${taskId}`).then((r) => r.data),

  getRemarks: (taskId) => API.get(`/api/tasks/${taskId}/remarks`).then((r) => r.data),

  addRemark: (taskId, comment) =>
    API.post(`/api/tasks/${taskId}/remarks`, { comment }).then((r) => r.data),

  getEmployeeAnalytics: (employeeId) =>
    API.get(`/api/tasks/analytics/employee/${employeeId}`).then((r) => r.data),
};

export default taskApi;
