import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { toast } from "react-toastify";
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  List,
  Eye,
  Edit,
  Trash2,
  PhoneCall,
  Clock,
  CheckCircle,
  User,
  Mail,
  Phone,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "../styles/custom-scrollbar.css";
import "../styles/calendar-theme.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Setup the localizer for react-big-calendar
const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CallbackCalendar = ({ onLogout }) => {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [callbacks, setCallbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("employee");
  const [userDepartment, setUserDepartment] = useState("");

  // View state
  const [view, setView] = useState("month");
  const [date, setDate] = useState(new Date());

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [employees, setEmployees] = useState([]);

  // Modal state
  const [selectedCallback, setSelectedCallback] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserRole(user.role);
      setUserDepartment(user.department || "");
    }
    fetchCallbacks();
    if (["admin", "super-admin", "hr"].includes(user?.role)) {
      fetchEmployees();
    }
  }, []);

  const fetchCallbacks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/callbacks?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setCallbacks(data.data);
      }
    } catch (error) {
      console.error("Error fetching callbacks:", error);
      toast.error("Failed to fetch callbacks");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const marketingSalesEmployees = data.filter(
        (emp) => emp.department === "marketingAndSales"
      );
      setEmployees(marketingSalesEmployees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleDeleteCallback = async (id) => {
    if (!window.confirm("Are you sure you want to delete this callback?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/callbacks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete callback");
      }

      toast.success("Callback deleted successfully");
      setModalOpen(false);
      fetchCallbacks();
    } catch (error) {
      console.error("Error deleting callback:", error);
      toast.error(error.message || "Failed to delete callback");
    }
  };

  // Transform callbacks to calendar events
  const events = useMemo(() => {
    let filtered = callbacks;

    // Apply filters
    if (statusFilter) {
      filtered = filtered.filter((cb) => cb.status === statusFilter);
    }
    if (employeeFilter) {
      filtered = filtered.filter(
        (cb) => cb.assignedTo?._id === employeeFilter
      );
    }

    return filtered.map((callback) => {
      const [hours, minutes] = callback.callbackTime.split(":");
      const startDate = new Date(callback.callbackDate);
      startDate.setHours(parseInt(hours), parseInt(minutes), 0);

      const endDate = new Date(startDate);
      endDate.setHours(startDate.getHours() + 1); // 1 hour duration by default

      return {
        id: callback._id,
        title: `${callback.clientName} - ${callback.callbackType}`,
        start: startDate,
        end: endDate,
        resource: callback,
      };
    });
  }, [callbacks, statusFilter, employeeFilter]);

  // Event style based on status
  const eventStyleGetter = (event) => {
    const callback = event.resource;
    let backgroundColor = "#3b82f6"; // Default blue

    switch (callback.status) {
      case "Completed":
        backgroundColor = "#10b981"; // Green
        break;
      case "Pending":
        backgroundColor = "#f59e0b"; // Yellow/Orange
        break;
      case "Rescheduled":
        backgroundColor = "#06b6d4"; // Cyan
        break;
      case "Not Reachable":
        backgroundColor = "#f97316"; // Orange
        break;
      case "Cancelled":
        backgroundColor = "#ef4444"; // Red
        break;
    }

    // Check if overdue
    const now = new Date();
    const callbackDateTime = new Date(callback.callbackDate);
    if (callback.status === "Pending" && callbackDateTime < now) {
      backgroundColor = "#dc2626"; // Dark red for overdue
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "6px",
        opacity: 0.9,
        color: "white",
        border: "none",
        display: "block",
        fontSize: "0.85rem",
        padding: "2px 6px",
      },
    };
  };

  const handleSelectEvent = (event) => {
    setSelectedCallback(event.resource);
    setModalOpen(true);
  };

  const handleSelectSlot = ({ start }) => {
    const dateStr = format(start, "yyyy-MM-dd");
    navigate(`/callbacks/add?date=${dateStr}`);
  };

  const clearFilters = () => {
    setStatusFilter("");
    setEmployeeFilter("");
  };

  const getStatusColor = (status) => {
    const colors = {
      Pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      Completed: "bg-green-500/20 text-green-400 border-green-500/30",
      Rescheduled: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "Not Reachable": "bg-orange-500/20 text-orange-400 border-orange-500/30",
      Cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return colors[status] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-56"
        } p-8 max-w-full overflow-x-hidden`}
      >
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                Callback Calendar
              </h1>
              <p className="text-gray-400">
                Visualize and manage your callback schedule
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/callbacks")}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
              >
                <List className="h-4 w-4" />
                List View
              </button>
              {(userRole === "super-admin" ||
                userDepartment === "marketingAndSales") && (
                <button
                  onClick={() => navigate("/callbacks/add")}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-green-500/50"
                >
                  <Plus className="h-5 w-5" />
                  Add Callback
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-gray-400">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700 pr-10"
                >
                  <option value="">📊 All Status</option>
                  <option value="Pending">⏳ Pending</option>
                  <option value="Completed">✅ Completed</option>
                  <option value="Rescheduled">🔄 Rescheduled</option>
                  <option value="Not Reachable">📵 Not Reachable</option>
                  <option value="Cancelled">❌ Cancelled</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {userRole === "super-admin" && employees.length > 0 && (
                <div className="relative">
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all appearance-none cursor-pointer hover:bg-slate-700 pr-10"
                  >
                    <option value="">👥 All Employees</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {(statusFilter || employeeFilter) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-all"
                >
                  Clear Filters
                </button>
              )}

              {/* Legend */}
              <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-gray-400">Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-400">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded"></div>
                  <span className="text-gray-400">Overdue</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden p-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              popup
              views={["month", "week", "day", "agenda"]}
              defaultView="month"
            />
          )}
        </div>

        {/* Callback Details Modal */}
        {modalOpen && selectedCallback && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-b border-slate-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Callback Details
                    </h2>
                    <p className="text-green-400 font-medium">
                      {selectedCallback.callbackId}
                    </p>
                  </div>
                  <button
                    onClick={() => setModalOpen(false)}
                    className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-700 rounded-lg"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <SimpleBar
                style={{ maxHeight: "calc(90vh - 200px)" }}
                className="flex-1"
              >
                <div className="p-6 space-y-6">
                  {/* Client Information */}
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                    <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Client Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">
                          Client Name
                        </p>
                        <p className="text-white font-medium">
                          {selectedCallback.clientName}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">
                          Business Name
                        </p>
                        <p className="text-white font-medium">
                          {selectedCallback.businessName}
                        </p>
                      </div>
                      {selectedCallback.email && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Email</p>
                          <p className="text-white font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4 text-green-400" />
                            {selectedCallback.email}
                          </p>
                        </div>
                      )}
                      {selectedCallback.phone && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Phone</p>
                          <p className="text-white font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4 text-green-400" />
                            {selectedCallback.phone}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Callback Details */}
                  <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                    <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                      <PhoneCall className="h-5 w-5" />
                      Callback Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400 text-sm mb-1">
                          Callback Date
                        </p>
                        <p className="text-white font-medium flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-green-400" />
                          {new Date(
                            selectedCallback.callbackDate
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">
                          Callback Time
                        </p>
                        <p className="text-white font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-400" />
                          {selectedCallback.callbackTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Type</p>
                        <p className="text-white font-medium">
                          {selectedCallback.callbackType}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm mb-1">Status</p>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                            selectedCallback.status
                          )}`}
                        >
                          {selectedCallback.status}
                        </span>
                      </div>
                      {selectedCallback.priority && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">Priority</p>
                          <p className="text-white font-medium">
                            {selectedCallback.priority}
                          </p>
                        </div>
                      )}
                      {selectedCallback.assignedTo && (
                        <div>
                          <p className="text-gray-400 text-sm mb-1">
                            Assigned To
                          </p>
                          <p className="text-white font-medium">
                            {selectedCallback.assignedTo.name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remarks */}
                  {selectedCallback.remarks && (
                    <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600/50">
                      <h3 className="text-lg font-semibold text-green-400 mb-3">
                        Remarks
                      </h3>
                      <p className="text-gray-300 whitespace-pre-wrap">
                        {selectedCallback.remarks}
                      </p>
                    </div>
                  )}
                </div>
              </SimpleBar>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-end gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all"
                >
                  Close
                </button>
                {userRole === "super-admin" && (
                  <>
                    <button
                      onClick={() => {
                        setModalOpen(false);
                        navigate(`/callbacks/edit/${selectedCallback._id}`);
                      }}
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCallback(selectedCallback._id)}
                      className="px-6 py-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white rounded-lg transition-all flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
                {userRole !== "super-admin" &&
                  userDepartment === "marketingAndSales" &&
                  selectedCallback.assignedTo?._id ===
                    JSON.parse(localStorage.getItem("user"))?._id && (
                    <button
                      onClick={() => {
                        setModalOpen(false);
                        navigate(`/callbacks/edit/${selectedCallback._id}`);
                      }}
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg transition-all flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                  )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CallbackCalendar;
