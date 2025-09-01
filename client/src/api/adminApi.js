import axios from "axios";

const api = axios.create({
  baseURL: "/api/admin",
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchEmployees = (filters) =>
  api.get("/employees", { params: filters });

export const fetchEmployeeSummary = (employeeId, startDate, endDate) =>
  api.get("/employee-summary", { params: { employeeId, startDate, endDate } });
