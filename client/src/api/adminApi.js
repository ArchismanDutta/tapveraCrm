import axios from "axios";

const api = axios.create({
  baseURL: "/api/admin",
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach token to every request if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Fetch list of employees
 * @param {Object} filters Optional filters, e.g., { department: "HR", status: "active" }
 * @returns {Array} Array of employee objects
 */
export const fetchEmployees = async (filters = {}) => {
  try {
    const response = await api.get("/employees", { params: filters });
    // Backend sends { success: true, data: [...] }
    if (response.data.success) {
      return response.data.data;
    } else {
      console.error("Failed to fetch employees:", response.data.message);
      return [];
    }
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
};

/**
 * Fetch employee summary for a specific date range
 * @param {string} employeeId Employee _id
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Object} { attendanceRecords, leaves, summary }
 */
export const fetchEmployeeSummary = async (employeeId, startDate, endDate) => {
  try {
    const response = await api.get("/employee-summary", {
      params: { employeeId, startDate, endDate },
    });
    if (response.data.success) {
      return response.data; // { attendanceRecords, leaves, summary }
    } else {
      console.error("Failed to fetch summary:", response.data.message);
      return { attendanceRecords: [], leaves: [], summary: null };
    }
  } catch (error) {
    console.error("Error fetching employee summary:", error);
    return { attendanceRecords: [], leaves: [], summary: null };
  }
};

export default api;
