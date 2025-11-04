// components/chat/ManageGroupModal.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, UserPlus, UserMinus, Edit3, Users, AlertCircle, Check } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const ManageGroupModal = ({ isOpen, onClose, conversation, jwtToken, onGroupUpdated }) => {
  const [groupDetails, setGroupDetails] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]);

  useEffect(() => {
    if (isOpen && conversation) {
      fetchGroupDetails();
      fetchAllUsers();
    }
  }, [isOpen, conversation]);

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE}/api/chat/groups/${conversation._id}/details`,
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );
      setGroupDetails(response.data);
      setGroupName(response.data.name || "");
    } catch (error) {
      console.error("Error fetching group details:", error);
      showNotification("Failed to load group details", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/users`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      setAllUsers(response.data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleUpdateGroupName = async () => {
    try {
      await axios.put(
        `${API_BASE}/api/chat/groups/${conversation._id}`,
        { name: groupName },
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );
      setIsEditingName(false);
      showNotification("Group name updated successfully!", "success");
      onGroupUpdated();
    } catch (error) {
      showNotification(error.response?.data?.error || "Failed to update group name", "error");
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsersToAdd.length === 0) {
      showNotification("Please select at least one member to add", "error");
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/api/chat/groups/${conversation._id}/members`,
        { memberIds: selectedUsersToAdd },
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );
      setSelectedUsersToAdd([]);
      showNotification("Members added successfully!", "success");
      fetchGroupDetails();
      onGroupUpdated();
    } catch (error) {
      showNotification(error.response?.data?.error || "Failed to add members", "error");
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      await axios.delete(
        `${API_BASE}/api/chat/groups/${conversation._id}/members/${memberId}`,
        {
          headers: { Authorization: `Bearer ${jwtToken}` },
        }
      );
      showNotification("Member removed successfully!", "success");
      fetchGroupDetails();
      onGroupUpdated();
    } catch (error) {
      showNotification(error.response?.data?.error || "Failed to remove member", "error");
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsersToAdd((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const availableUsersToAdd = allUsers.filter(
    (user) => !groupDetails?.members?.includes(user._id)
  );

  if (!isOpen) return null;

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
                <Users className="w-6 h-6 text-blue-400" />
                Manage Group
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                {groupDetails?.name || "Loading..."}
              </p>
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
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400 text-sm">Loading group details...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Edit Group Name */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-purple-400" />
                  Group Name
                </h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={!isEditingName}
                    className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                  {isEditingName ? (
                    <button
                      onClick={handleUpdateGroupName}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Current Members */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  Current Members ({groupDetails?.memberDetails?.length || 0})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {groupDetails?.memberDetails?.map((member) => {
                    const isCreator = member._id === groupDetails.createdBy;
                    return (
                      <div
                        key={member._id}
                        className="flex items-center justify-between p-3 bg-[#0f1419] rounded-lg border border-[#232945]"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-medium">
                            {member.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-white font-medium flex items-center gap-2">
                              {member.name}
                              {isCreator && (
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/50">
                                  Creator
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500">
                              {member.email} • {member.employeeId}
                            </p>
                          </div>
                        </div>
                        {!isCreator && (
                          <button
                            onClick={() => handleRemoveMember(member._id)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                            title="Remove Member"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add New Members */}
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  Add New Members
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                  {availableUsersToAdd.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      All users are already in this group
                    </p>
                  ) : (
                    availableUsersToAdd.map((user) => {
                      const isSelected = selectedUsersToAdd.includes(user._id);
                      return (
                        <button
                          key={user._id}
                          onClick={() => toggleUserSelection(user._id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-500/20"
                              : "border-[#232945] bg-[#0f1419] hover:border-blue-500/50"
                          }`}
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                            {user.name?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 text-left">
                            <p className={`text-sm font-medium ${isSelected ? "text-blue-300" : "text-gray-300"}`}>
                              {user.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {user.email} • {user.employeeId}
                            </p>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-blue-400" />}
                        </button>
                      );
                    })
                  )}
                </div>
                {selectedUsersToAdd.length > 0 && (
                  <button
                    onClick={handleAddMembers}
                    className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg hover:from-blue-700 hover:to-green-700 transition-all font-medium"
                  >
                    Add {selectedUsersToAdd.length} Member{selectedUsersToAdd.length > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#232945] bg-[#0f1419]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-[#1a1f2e] border border-[#232945] text-white rounded-lg hover:bg-[#232945] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageGroupModal;
