import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { PhoneCall, Calendar, Clock, MessageSquare, User, Building2 } from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const AddCallback = ({ onLogout }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedLeadId = searchParams.get("leadId");

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [userRole, setUserRole] = useState("employee");
  const [currentUserId, setCurrentUserId] = useState("");

  const [formData, setFormData] = useState({
    leadId: preSelectedLeadId || "",
    callbackDate: "",
    callbackTime: "",
    callbackType: "Call",
    status: "Pending",
    assignedTo: "",
    remarks: "",
    priority: "Medium",
  });

  const [selectedLead, setSelectedLead] = useState(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
      setCurrentUserId(user._id);
      if (user.role !== "super-admin") {
        setFormData((prev) => ({ ...prev, assignedTo: user._id }));
      }
    }
    fetchLeads();
    if (["admin", "super-admin", "hr"].includes(user?.role)) {
      fetchEmployees();
    }
  }, []);

  useEffect(() => {
    if (formData.leadId) {
      const lead = leads.find((l) => l._id === formData.leadId);
      setSelectedLead(lead);
    }
  }, [formData.leadId, leads]);

  const fetchLeads = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/leads?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setLeads(data.data);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to fetch leads");
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      // Filter to only show Marketing & Sales employees
      const marketingSalesEmployees = data.filter(
        (emp) => emp.department === "marketingAndSales"
      );
      setEmployees(marketingSalesEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validation
    if (!formData.leadId || !formData.callbackDate || !formData.callbackTime) {
      toast.error("Please fill in all required fields");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/callbacks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create callback");
      }

      toast.success("Callback created successfully!");
      navigate("/callbacks");
    } catch (error) {
      console.error("Error creating callback:", error);
      toast.error(error.message || "Failed to create callback");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/callbacks");
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-56"} p-8`}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 relative">
            <button
              onClick={handleCancel}
              className="absolute -top-2 right-0 p-2 hover:bg-slate-700 rounded-lg transition-all group"
              title="Close"
            >
              <svg className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
              Add New Callback
            </h1>
            <p className="text-gray-400">Schedule a follow-up callback for a lead</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
            {/* Lead Selection */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Lead Information
              </h2>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Lead <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="leadId"
                    value={formData.leadId}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="">Select a lead</option>
                    {leads.map((lead) => (
                      <option key={lead._id} value={lead._id}>
                        {lead.leadId} - {lead.clientName} ({lead.businessName})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedLead && (
                  <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Client Name:</span>
                        <p className="text-white font-medium">{selectedLead.clientName}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Business Name:</span>
                        <p className="text-white font-medium">{selectedLead.businessName}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Email:</span>
                        <p className="text-white font-medium">{selectedLead.email}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Phone:</span>
                        <p className="text-white font-medium">{selectedLead.phone}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <p className="text-white font-medium">{selectedLead.status}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Priority:</span>
                        <p className="text-white font-medium">{selectedLead.priority}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Callback Schedule */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Callback Schedule
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Callback Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    name="callbackDate"
                    value={formData.callbackDate}
                    onChange={handleChange}
                    min={today}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Callback Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="time"
                    name="callbackTime"
                    value={formData.callbackTime}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Callback Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="callbackType"
                    value={formData.callbackType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Zoom">Zoom</option>
                    <option value="In-Person Meeting">In-Person Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Rescheduled">Rescheduled</option>
                    <option value="Not Reachable">Not Reachable</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                {userRole === "super-admin" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Assign To
                    </label>
                    <select
                      name="assignedTo"
                      value={formData.assignedTo}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    >
                      <option value="">Auto-assign (lead owner)</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.employeeId})
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-gray-400">
                      Leave empty to auto-assign to the lead's assigned employee
                    </p>
                  </div>
                )}
                {userRole !== "super-admin" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Assigned To
                    </label>
                    <p className="text-sm text-gray-400 bg-slate-700/30 border border-slate-600/50 rounded-lg px-4 py-3">
                      Callback will be assigned to you automatically
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Additional Information
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Remarks/Notes
                </label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={5}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                  placeholder="Add any notes or talking points for this callback..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all duration-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Callback"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AddCallback;