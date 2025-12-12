import React, { useState, useEffect } from "react";
import API from "../../api";
import Sidebar from "../../components/dashboard/Sidebar";
import {
  Briefcase,
  Plus,
  Edit2,
  Trash2,
  X,
  Users,
  TrendingUp,
  Shield,
  Search,
  Check,
  AlertCircle,
  UserCog,
} from "lucide-react";

const PositionManagement = ({ onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("positions"); // positions or users
  const [userRole, setUserRole] = useState("super-admin");

  // Positions state
  const [positions, setPositions] = useState([]);
  const [filteredPositions, setFilteredPositions] = useState([]);
  const [searchPosition, setSearchPosition] = useState("");
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);

  // Users state
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchUser, setSearchUser] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Form state
  const [positionForm, setPositionForm] = useState({
    name: "",
    level: 50,
    department: "all",
    description: "",
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageProjects: false,
      canAssignTasks: false,
      canApproveLeaves: false,
      canApproveShifts: false,
      canViewReports: false,
      canManageAttendance: false,
    },
  });

  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserRole(user.role || "admin");
    }
    fetchPositions();
    fetchUsers();
    fetchStats();
  }, []);

  useEffect(() => {
    // Filter positions
    if (searchPosition.trim()) {
      setFilteredPositions(
        positions.filter(
          (p) =>
            p.name.toLowerCase().includes(searchPosition.toLowerCase()) ||
            p.description.toLowerCase().includes(searchPosition.toLowerCase())
        )
      );
    } else {
      setFilteredPositions(positions);
    }
  }, [searchPosition, positions]);

  useEffect(() => {
    // Filter users
    if (searchUser.trim()) {
      setFilteredUsers(
        users.filter(
          (u) =>
            u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
            u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
            u.employeeId.toLowerCase().includes(searchUser.toLowerCase()) ||
            (u.position &&
              u.position.toLowerCase().includes(searchUser.toLowerCase()))
        )
      );
    } else {
      setFilteredUsers(users);
    }
  }, [searchUser, users]);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchPositions = async () => {
    try {
      const res = await API.get("/api/positions");
      setPositions(res.data);
    } catch (error) {
      console.error("Error fetching positions:", error);
      showNotification("Error fetching positions", "error");
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await API.get("/api/positions/users/list");
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification("Error fetching users", "error");
    }
  };

  const fetchStats = async () => {
    try {
      const res = await API.get("/api/positions/stats");
      setStats(res.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleCreatePosition = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post("/api/positions", positionForm);
      showNotification("Position created successfully!", "success");
      setShowPositionModal(false);
      resetPositionForm();
      fetchPositions();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Error creating position",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePosition = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.put(`/api/positions/${editingPosition._id}`, positionForm);
      showNotification("Position updated successfully!", "success");
      setShowPositionModal(false);
      setEditingPosition(null);
      resetPositionForm();
      fetchPositions();
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Error updating position",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePosition = async (positionId) => {
    if (!window.confirm("Are you sure you want to delete this position?"))
      return;

    try {
      await API.delete(`/api/positions/${positionId}`);
      showNotification("Position deleted successfully!", "success");
      fetchPositions();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Error deleting position",
        "error"
      );
    }
  };

  const handleAssignPosition = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      await API.patch(`/api/positions/users/${selectedUser._id}/assign`, {
        position: positionForm.name,
        positionLevel: positionForm.level,
      });
      showNotification("Position assigned successfully!", "success");
      setShowAssignModal(false);
      setSelectedUser(null);
      resetPositionForm();
      fetchUsers();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.error || "Error assigning position",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const openEditPosition = (position) => {
    setEditingPosition(position);
    setPositionForm({
      name: position.name,
      level: position.level,
      department: position.department,
      description: position.description,
      permissions: position.permissions || {},
    });
    setShowPositionModal(true);
  };

  const openAssignPosition = (user) => {
    setSelectedUser(user);
    if (user.position) {
      const existingPosition = positions.find((p) => p.name === user.position);
      if (existingPosition) {
        setPositionForm({
          name: existingPosition.name,
          level: existingPosition.level,
          department: existingPosition.department,
          description: existingPosition.description,
          permissions: existingPosition.permissions || {},
        });
      }
    }
    setShowAssignModal(true);
  };

  const resetPositionForm = () => {
    setPositionForm({
      name: "",
      level: 50,
      department: "all",
      description: "",
      permissions: {
        canManageUsers: false,
        canManageClients: false,
        canManageProjects: false,
        canAssignTasks: false,
        canApproveLeaves: false,
        canApproveShifts: false,
        canViewReports: false,
        canManageAttendance: false,
      },
    });
  };

  const togglePermission = (key) => {
    setPositionForm({
      ...positionForm,
      permissions: {
        ...positionForm.permissions,
        [key]: !positionForm.permissions[key],
      },
    });
  };

  return (
    <div className="flex bg-gradient-to-br from-[#141a21] via-[#191f2b] to-[#101218] font-sans text-blue-100 min-h-screen">
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={userRole}
      />

      <main
        className={`flex-1 p-8 overflow-y-auto transition-all duration-300 ${
          sidebarCollapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Notification */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-in ${
              notification.type === "success"
                ? "bg-green-600/90 border-green-500 text-white"
                : "bg-red-600/90 border-red-500 text-white"
            }`}
          >
            {notification.type === "success" ? (
              <Check className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Position Management
          </h1>
          <p className="text-blue-300">
            Manage organizational positions and assign them to users
          </p>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="w-6 h-6 text-purple-400" />
                <p className="text-sm text-gray-400">Total Positions</p>
              </div>
              <p className="text-3xl font-bold text-white">
                {stats.totalPositions}
              </p>
            </div>
            {/* 
            <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-green-400" />
                <p className="text-sm text-gray-400">Users with Positions</p>
              </div>
              <p className="text-3xl font-bold text-green-400">{stats.usersWithPositions}</p>
            </div> */}

            {/* <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
              <div className="flex items-center gap-3 mb-2">
                <UserCog className="w-6 h-6 text-blue-400" />
                <p className="text-sm text-gray-400">Without Positions</p>
              </div>
              <p className="text-3xl font-bold text-blue-400">{stats.usersWithoutPositions}</p>
            </div> */}

            <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
                <p className="text-sm text-gray-400">Active Positions</p>
              </div>
              <p className="text-3xl font-bold text-cyan-400">
                {stats.activePositions}
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab("positions")}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "positions"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                : "bg-[#191f2b]/70 text-gray-400 hover:text-white"
            }`}
          >
            <Briefcase className="w-4 h-4 inline mr-2" />
            Manage Positions
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === "users"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                : "bg-[#191f2b]/70 text-gray-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Assign to Users
          </button>
        </div>

        {/* Positions Tab */}
        {activeTab === "positions" && (
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="flex justify-between items-center mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search positions..."
                  value={searchPosition}
                  onChange={(e) => setSearchPosition(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <button
                onClick={() => {
                  resetPositionForm();
                  setEditingPosition(null);
                  setShowPositionModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all"
              >
                <Plus className="w-4 h-4" />
                Create Position
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#232945]">
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Position
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Level
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Department
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Description
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Permissions
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((position) => (
                    <tr
                      key={position._id}
                      className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors"
                    >
                      <td className="px-4 py-4 text-white font-semibold">
                        {position.name}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400">
                          Level {position.level}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-300 capitalize">
                        {position.department}
                      </td>
                      <td className="px-4 py-4 text-gray-400 text-sm">
                        {position.description || "-"}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-gray-400">
                          {
                            Object.values(position.permissions || {}).filter(
                              Boolean
                            ).length
                          }{" "}
                          enabled
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditPosition(position)}
                            className="p-2 rounded-lg text-blue-400 hover:bg-blue-500/10 transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePosition(position._id)}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-[#191f2b]/70 rounded-xl shadow-xl border border-[#232945] p-6">
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-[#232945]">
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Employee ID
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Name
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Role
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Department
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Current Position
                    </th>
                    <th className="text-left px-4 py-4 text-sm font-semibold text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user._id}
                      className="border-b border-[#232945] hover:bg-[#0f1419] transition-colors"
                    >
                      <td className="px-4 py-4 text-gray-300 font-mono text-sm">
                        {user.employeeId}
                      </td>
                      <td className="px-4 py-4 text-white font-semibold">
                        {user.name}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 capitalize">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-300 capitalize">
                        {user.department || "-"}
                      </td>
                      <td className="px-4 py-4">
                        {user.position ? (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                            {user.position}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">
                            Not assigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => openAssignPosition(user)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm transition-all"
                        >
                          Assign Position
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Position Modal */}
        {showPositionModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-purple-500/50 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">
                  {editingPosition ? "Edit Position" : "Create New Position"}
                </h3>
                <button
                  onClick={() => {
                    setShowPositionModal(false);
                    setEditingPosition(null);
                    resetPositionForm();
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={
                  editingPosition ? handleUpdatePosition : handleCreatePosition
                }
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Position Name *
                    </label>
                    <input
                      type="text"
                      value={positionForm.name}
                      onChange={(e) =>
                        setPositionForm({
                          ...positionForm,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="e.g., Team Lead, Manager, Web Consultant"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Level (0-100) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={positionForm.level}
                        onChange={(e) =>
                          setPositionForm({
                            ...positionForm,
                            level: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">
                        Department
                      </label>
                      <select
                        value={positionForm.department}
                        onChange={(e) =>
                          setPositionForm({
                            ...positionForm,
                            department: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                      >
                        <option value="all">All Departments</option>
                        <option value="executives">Executives</option>
                        <option value="development">Development</option>
                        <option value="marketingAndSales">
                          Marketing & Sales
                        </option>
                        <option value="humanResource">Human Resource</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Description
                    </label>
                    <textarea
                      value={positionForm.description}
                      onChange={(e) =>
                        setPositionForm({
                          ...positionForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                      rows={3}
                      placeholder="Brief description of this position..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-3">
                      Permissions
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries({
                        canManageUsers: "Manage Users",
                        canManageClients: "Manage Clients",
                        canManageProjects: "Manage Projects",
                        canAssignTasks: "Assign Tasks",
                        canApproveLeaves: "Approve Leaves",
                        canApproveShifts: "Approve Shifts",
                        canViewReports: "View Reports",
                        canManageAttendance: "Manage Attendance",
                      }).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center gap-3 p-3 rounded-lg bg-[#0f1419] border border-[#232945] cursor-pointer hover:border-purple-500/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={positionForm.permissions[key] || false}
                            onChange={() => togglePermission(key)}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                          />
                          <span className="text-sm text-gray-300">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPositionModal(false);
                      setEditingPosition(null);
                      resetPositionForm();
                    }}
                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    {loading
                      ? "Saving..."
                      : editingPosition
                      ? "Update Position"
                      : "Create Position"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Position Modal */}
        {showAssignModal && selectedUser && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-purple-500/50 p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white">
                  Assign Position
                </h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedUser(null);
                    resetPositionForm();
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-[#0f1419] rounded-lg p-4 border border-[#232945]">
                  <p className="text-sm text-gray-400 mb-1">Employee</p>
                  <p className="text-white font-semibold">
                    {selectedUser.name}
                  </p>
                  <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {selectedUser.employeeId}
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    Select Position *
                  </label>
                  <select
                    value={positionForm.name}
                    onChange={(e) => {
                      const selected = positions.find(
                        (p) => p.name === e.target.value
                      );
                      if (selected) {
                        setPositionForm({
                          ...positionForm,
                          name: selected.name,
                          level: selected.level,
                        });
                      } else {
                        setPositionForm({
                          ...positionForm,
                          name: "",
                          level: 0,
                        });
                      }
                    }}
                    className="w-full px-4 py-3 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  >
                    <option value="">-- Select Position --</option>
                    {positions
                      .filter((p) => p.status === "active")
                      .sort((a, b) => b.level - a.level)
                      .map((p) => (
                        <option key={p._id} value={p.name}>
                          {p.name} (Level {p.level})
                        </option>
                      ))}
                  </select>
                </div>

                {positionForm.name && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-300">
                        <p className="font-semibold mb-1">
                          Position Level: {positionForm.level}
                        </p>
                        <p className="text-xs">
                          This will update the user's position hierarchy level.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedUser(null);
                      resetPositionForm();
                    }}
                    className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignPosition}
                    disabled={loading || !positionForm.name}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    {loading ? "Assigning..." : "Assign Position"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PositionManagement;
