import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Building2, User, Mail, Phone, MapPin, Calendar, DollarSign, Tag } from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const AddLead = ({ onLogout }) => {
  const navigate = useNavigate();
  const { id: leadId } = useParams();
  const isEditMode = !!leadId;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [userRole, setUserRole] = useState("employee");

  const [formData, setFormData] = useState({
    clientName: "",
    businessName: "",
    email: "",
    phone: "",
    alternatePhone: "",
    source: "Website",
    status: "New",
    priority: "Medium",
    industry: "",
    websiteUrl: "",
    expectedRevenue: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    zipCode: "",
    assignedTo: "",
    notes: "",
    tags: "",
    nextFollowUpDate: "",
  });

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
      if (user.role !== "super-admin" && !isEditMode) {
        setFormData((prev) => ({ ...prev, assignedTo: user._id }));
      }
    }

    // Fetch lead data if editing
    if (isEditMode) {
      fetchLeadData();
    }
  }, []);

  useEffect(() => {
    if (["admin", "super-admin", "hr"].includes(userRole)) {
      fetchEmployees();
    }
  }, [userRole]);

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

  const fetchLeadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/leads/${leadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (data.success) {
        const lead = data.data;
        // Pre-populate form with lead data
        setFormData({
          clientName: lead.clientName || "",
          businessName: lead.businessName || "",
          email: lead.email || "",
          phone: lead.phone || "",
          alternatePhone: lead.alternatePhone || "",
          source: lead.source || "Website",
          status: lead.status || "New",
          priority: lead.priority || "Medium",
          industry: lead.industry || "",
          websiteUrl: lead.websiteUrl || "",
          expectedRevenue: lead.expectedRevenue || "",
          address: lead.address || "",
          city: lead.city || "",
          state: lead.state || "",
          country: lead.country || "India",
          zipCode: lead.zipCode || "",
          assignedTo: lead.assignedTo?._id || lead.assignedTo || "",
          notes: lead.notes || "",
          tags: Array.isArray(lead.tags) ? lead.tags.join(", ") : "",
          nextFollowUpDate: lead.nextFollowUpDate ? new Date(lead.nextFollowUpDate).toISOString().split("T")[0] : "",
        });
      } else {
        toast.error("Failed to fetch lead data");
      }
    } catch (error) {
      console.error("Error fetching lead data:", error);
      toast.error("Failed to load lead data");
    } finally {
      setLoading(false);
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
    if (!formData.clientName || !formData.businessName || !formData.email || !formData.phone) {
      toast.error("Please fill in all required fields");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const payload = {
        ...formData,
        tags: formData.tags ? formData.tags.split(",").map((tag) => tag.trim()) : [],
        expectedRevenue: formData.expectedRevenue ? parseFloat(formData.expectedRevenue) : 0,
      };

      const url = isEditMode
        ? `${API_BASE}/api/leads/${leadId}`
        : `${API_BASE}/api/leads`;
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to ${isEditMode ? 'update' : 'create'} lead`);
      }

      toast.success(`Lead ${isEditMode ? 'updated' : 'created'} successfully!`);
      navigate("/leads");
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} lead:`, error);
      toast.error(error.message || `Failed to ${isEditMode ? 'update' : 'create'} lead`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/leads");
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-56"} p-8`}>
        <div className="max-w-6xl mx-auto">
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent mb-2">
              {isEditMode ? "Edit Lead" : "Add New Lead"}
            </h1>
            <p className="text-gray-400">
              {isEditMode ? "Update lead details" : "Create a new lead entry for tracking and follow-up"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
            {/* Client Information */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Client Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Client Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Enter client name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Enter business name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="+91 1234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Alternate Phone
                  </label>
                  <input
                    type="tel"
                    name="alternatePhone"
                    value={formData.alternatePhone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="+91 0987654321"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Industry</label>
                  <input
                    type="text"
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="e.g., IT, Healthcare, Finance"
                  />
                </div>
              </div>
            </div>

            {/* Lead Details */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Lead Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Source</label>
                  <select
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  >
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Email Campaign">Email Campaign</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Proposal Sent">Proposal Sent</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Won">Won</option>
                    <option value="Lost">Lost</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    name="websiteUrl"
                    value={formData.websiteUrl}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="https://example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Expected Revenue (₹)
                  </label>
                  <input
                    type="number"
                    name="expectedRevenue"
                    value={formData.expectedRevenue}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Enter expected revenue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Next Follow-up Date
                  </label>
                  <input
                    type="date"
                    name="nextFollowUpDate"
                    value={formData.nextFollowUpDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Address Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Country"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Zip Code</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Zip code"
                  />
                </div>
              </div>
            </div>

            {/* Assignment & Additional Info */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-cyan-400 mb-4">Additional Information</h2>
              <div className="grid grid-cols-1 gap-6">
                {userRole === "super-admin" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Assign To
                    </label>
                    <select
                      name="assignedTo"
                      value={formData.assignedTo}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    >
                      <option value="">Select employee</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.name} ({emp.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {userRole !== "super-admin" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Assigned To
                    </label>
                    <p className="text-sm text-gray-400 bg-slate-700/30 border border-slate-600/50 rounded-lg px-4 py-3">
                      Lead will be assigned to you automatically
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="e.g., VIP, Hot Lead, Follow-up Required"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                    placeholder="Add any additional notes or comments..."
                  />
                </div>
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
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Lead" : "Create Lead")}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default AddLead;