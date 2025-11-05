// components/sheets/ShareSheetModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Users, UserPlus, Trash2, Shield, Check, AlertCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const ShareSheetModal = ({ sheet, onClose, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // Array of { userId, permission }
  const [selectedRoles, setSelectedRoles] = useState([]); // Array of { role, permission }
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUsers();
    initializeSelections();
  }, [sheet]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      showNotification("Error fetching users", "error");
    }
  };

  const initializeSelections = () => {
    // Pre-select already shared users with their permissions
    const sharedUsers = sheet.sharedWith?.map((s) => ({
      userId: s.user._id || s.user,
      permission: s.permission || "view"
    })) || [];
    setSelectedUsers(sharedUsers);

    // Pre-select already shared roles with their permissions
    const sharedRoles = sheet.sharedWithRoles?.map((s) => ({
      role: s.role,
      permission: s.permission || "view"
    })) || [];
    setSelectedRoles(sharedRoles);
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => {
      const existingIndex = prev.findIndex((u) => u.userId === userId);
      if (existingIndex >= 0) {
        // Remove user
        return prev.filter((u) => u.userId !== userId);
      } else {
        // Add user with default "view" permission
        return [...prev, { userId, permission: "view" }];
      }
    });
  };

  const updateUserPermission = (userId, permission) => {
    setSelectedUsers((prev) =>
      prev.map((u) =>
        u.userId === userId ? { ...u, permission } : u
      )
    );
  };

  const toggleRoleSelection = (role) => {
    setSelectedRoles((prev) => {
      const existingIndex = prev.findIndex((r) => r.role === role);
      if (existingIndex >= 0) {
        // Remove role
        return prev.filter((r) => r.role !== role);
      } else {
        // Add role with default "view" permission
        return [...prev, { role, permission: "view" }];
      }
    });
  };

  const updateRolePermission = (role, permission) => {
    setSelectedRoles((prev) =>
      prev.map((r) =>
        r.role === role ? { ...r, permission } : r
      )
    );
  };

  const handleShare = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      await axios.post(
        `${API_BASE}/api/sheets/${sheet._id}/share`,
        {
          userShares: selectedUsers,
          roleShares: selectedRoles,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showNotification("Sheet shared successfully!", "success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Error sharing sheet:", error);
      showNotification(
        error.response?.data?.message || "Error sharing sheet",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // Get currently shared users and roles
      const currentUserIds = sheet.sharedWith?.map((s) => s.user._id || s.user) || [];
      const currentRoles = sheet.sharedWithRoles?.map((s) => s.role) || [];

      // Find users and roles to remove
      const usersToRemove = currentUserIds.filter((id) => !selectedUsers.includes(id));
      const rolesToRemove = currentRoles.filter((role) => !selectedRoles.includes(role));

      if (usersToRemove.length === 0 && rolesToRemove.length === 0) {
        showNotification("No changes to remove", "error");
        return;
      }

      await axios.delete(`${API_BASE}/api/sheets/${sheet._id}/share`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          userIds: usersToRemove,
          roles: rolesToRemove,
        },
      });

      showNotification("Sharing removed successfully!", "success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Error removing share:", error);
      showNotification(
        error.response?.data?.message || "Error removing share",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const availableRoles = [
    { value: "admin", label: "Admins", icon: Shield },
    { value: "hr", label: "HR", icon: Users },
    { value: "employee", label: "Employees", icon: UserPlus },
  ];

  const filteredUsers = users.filter((user) => {
    // Don't show the sheet owner
    if (user._id === sheet.addedBy?._id) return false;

    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-[60] px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
            notification.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notification.type === "success" ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#232945]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-400" />
                Share Sheet
              </h3>
              <p className="text-sm text-gray-400 mt-1">{sheet.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#0f1419] rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Share with Roles */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              Share with Roles
            </h4>
            <div className="space-y-3">
              {availableRoles.map((roleOption) => {
                const Icon = roleOption.icon;
                const roleShare = selectedRoles.find((r) => r.role === roleOption.value);
                const isSelected = !!roleShare;
                return (
                  <div key={roleOption.value} className="flex items-center gap-3">
                    <button
                      onClick={() => toggleRoleSelection(roleOption.value)}
                      className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-purple-500 bg-purple-500/20"
                          : "border-[#232945] bg-[#0f1419] hover:border-purple-500/50"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          isSelected ? "text-purple-400" : "text-gray-500"
                        }`}
                      />
                      <div className="flex-1 text-left">
                        <p
                          className={`text-sm font-medium ${
                            isSelected ? "text-purple-300" : "text-gray-300"
                          }`}
                        >
                          {roleOption.label}
                        </p>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-purple-400" />}
                    </button>
                    {isSelected && (
                      <select
                        value={roleShare.permission}
                        onChange={(e) => updateRolePermission(roleOption.value, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                      >
                        <option value="view">View Only</option>
                        <option value="edit">Can Edit</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Share with Specific Users */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-green-400" />
              Share with Specific Users
            </h4>

            {/* Search */}
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full mb-3 px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />

            {/* User List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No users found
                </p>
              ) : (
                filteredUsers.map((user) => {
                  const userShare = selectedUsers.find((u) => u.userId === user._id);
                  const isSelected = !!userShare;
                  return (
                    <div key={user._id} className="flex items-center gap-2">
                      <button
                        onClick={() => toggleUserSelection(user._id)}
                        className={`flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          isSelected
                            ? "border-green-500 bg-green-500/20"
                            : "border-[#232945] bg-[#0f1419] hover:border-green-500/50"
                        }`}
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                          {user.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 text-left">
                          <p
                            className={`text-sm font-medium ${
                              isSelected ? "text-green-300" : "text-gray-300"
                            }`}
                          >
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {user.email} • {user.employeeId}
                          </p>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-green-400" />}
                      </button>
                      {isSelected && (
                        <select
                          value={userShare.permission}
                          onChange={(e) => updateUserPermission(user._id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white text-sm focus:outline-none focus:border-green-500"
                        >
                          <option value="view">View Only</option>
                          <option value="edit">Can Edit</option>
                        </select>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Currently Shared Info */}
          {(sheet.sharedWith?.length > 0 || sheet.sharedWithRoles?.length > 0) && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h5 className="text-sm font-medium text-blue-300 mb-2">
                Currently Shared With:
              </h5>
              <div className="text-xs text-blue-200 space-y-1">
                {sheet.sharedWithRoles?.map((share, idx) => (
                  <p key={idx}>
                    • Role: <span className="font-medium capitalize">{share.role}</span>
                  </p>
                ))}
                {sheet.sharedWith?.map((share, idx) => (
                  <p key={idx}>
                    • User: <span className="font-medium">{share.user?.name || "Unknown"}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#232945] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] text-white rounded-lg hover:bg-[#141a21] transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sharing..." : "Share Sheet"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareSheetModal;
