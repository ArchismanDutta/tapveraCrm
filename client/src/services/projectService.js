
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

class ProjectService {
  async getAllProjects(filters = {}) {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams(filters).toString();
    const res = await axios.get(`${API_BASE}/api/projects?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async getProjectStats() {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${API_BASE}/api/projects/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async getProjectById(id) {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${API_BASE}/api/projects/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async createProject(projectData) {
    const token = localStorage.getItem("token");
    const res = await axios.post(`${API_BASE}/api/projects`, projectData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async updateProject(id, projectData) {
    const token = localStorage.getItem("token");
    const res = await axios.put(`${API_BASE}/api/projects/${id}`, projectData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async deleteProject(id) {
    const token = localStorage.getItem("token");
    const res = await axios.delete(`${API_BASE}/api/projects/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async toggleProjectStatus(id) {
    const token = localStorage.getItem("token");
    const res = await axios.patch(`${API_BASE}/api/projects/${id}/status`, {}, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async addNote(id, content) {
    const token = localStorage.getItem("token");
    const res = await axios.post(
      `${API_BASE}/api/projects/${id}/notes`,
      { content },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }

  async addMilestone(id, milestoneData) {
    const token = localStorage.getItem("token");
    const res = await axios.post(
      `${API_BASE}/api/projects/${id}/milestones`,
      milestoneData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }

  async getEmployeeProjects(employeeId) {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${API_BASE}/api/projects/employee/${employeeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async getClientProjects(clientId) {
    const token = localStorage.getItem("token");
    const res = await axios.get(`${API_BASE}/api/projects/client/${clientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }
}

export default new ProjectService();