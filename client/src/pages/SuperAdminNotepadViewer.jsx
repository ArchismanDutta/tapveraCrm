// src/pages/SuperAdminNotepadViewer.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const SuperAdminNotepadViewer = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [notepadContent, setNotepadContent] = useState("");
  const [showNotepadModal, setShowNotepadModal] = useState(false);

  const token = localStorage.getItem("token");

  const getAxiosConfig = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  // Fetch all users with notepads
  const fetchUsersWithNotepads = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${API_BASE}/api/notepad/all-users`,
        getAxiosConfig()
      );

      if (response.data.success) {
        setUsers(response.data.data);
        setFilteredUsers(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersWithNotepads();
  }, []);

  // Filter users based on search and role
  useEffect(() => {
    let filtered = users;

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.department?.toLowerCase().includes(query)
      );
    }

    setFilteredUsers(filtered);
  }, [searchQuery, roleFilter, users]);

  // View user's notepad
  const viewNotepad = async (user) => {
    try {
      const response = await axios.get(
        `${API_BASE}/api/notepad/user/${user._id}`,
        getAxiosConfig()
      );

      if (response.data.success) {
        setSelectedUser(response.data.data.user);
        setNotepadContent(response.data.data.notepad.content || "");
        setShowNotepadModal(true);
      }
    } catch (error) {
      console.error("Error fetching notepad:", error);
      toast.error("Failed to load notepad");
    }
  };

  // Close modal
  const closeModal = () => {
    setShowNotepadModal(false);
    setSelectedUser(null);
    setNotepadContent("");
  };

  // Get role badge color
  const getRoleBadge = (role) => {
    const badges = {
      employee: "bg-blue-600 text-white",
      admin: "bg-purple-600 text-white",
      hr: "bg-green-600 text-white"
    };
    return badges[role] || "bg-gray-600 text-white";
  };

  return (
    <div className="flex min-h-screen bg-[#0f1419] text-gray-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="superadmin"
        onLogout={onLogout}
      />

      <main
        className={`flex-1 p-6 transition-all duration-300 ${
          collapsed ? "ml-20" : "ml-72"
        }`}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">User Notepads</h1>
          <p className="text-gray-400">View all employee, admin, and HR notepads</p>
        </div>

        {/* Filters */}
        <div className="bg-[#161c2c] rounded-xl shadow-lg border border-[#232945] p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search Users
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or department..."
                  className="w-full bg-[#0f1419] text-white rounded-lg pl-10 pr-4 py-2 border border-[#232945] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Role Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Filter by Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full bg-[#0f1419] text-white rounded-lg px-4 py-2 border border-[#232945] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
                <option value="hr">HR</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-400">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-[#161c2c] rounded-xl shadow-lg border border-[#232945] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading users...</p>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center p-12">
              <svg
                className="w-16 h-16 text-gray-600 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No users found</h3>
              <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#232945]">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Notepad Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Last Modified
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#232945]">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user._id}
                      className="hover:bg-[#232945]/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {user.profileImage ? (
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={`${API_BASE}${user.profileImage}`}
                                alt={user.name}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                {user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleBadge(
                            user.role
                          )}`}
                        >
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {user.department || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          {user.notepad.hasContent ? (
                            <div>
                              <div className="text-green-400 font-medium">
                                ● Has Content
                              </div>
                              <div className="text-gray-500 text-xs">
                                {user.notepad.wordCount} words, {user.notepad.characterCount} chars
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-500">
                              ○ Empty
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        {user.notepad.lastModified
                          ? new Date(user.notepad.lastModified).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => viewNotepad(user)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          View Notepad
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Notepad Modal */}
      {showNotepadModal && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-[#161c2c] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-[#232945]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#232945] px-6 py-4 flex items-center justify-between border-b border-[#232945]">
              <div className="flex items-center gap-4">
                {selectedUser.profileImage ? (
                  <img
                    className="h-12 w-12 rounded-full object-cover"
                    src={`${API_BASE}${selectedUser.profileImage}`}
                    alt={selectedUser.name}
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedUser.name}'s Notepad
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedUser.email} • {selectedUser.role}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-[#161c2c] rounded-lg transition-colors"
              >
                <svg
                  className="w-6 h-6 text-gray-400 hover:text-white"
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

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 120px)" }}>
              {notepadContent ? (
                <div className="bg-[#0f1419] rounded-lg p-6 border border-[#232945]">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed">
                    {notepadContent}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg
                    className="w-16 h-16 text-gray-600 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">
                    Empty Notepad
                  </h3>
                  <p className="text-gray-500">
                    This user hasn't written anything in their notepad yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminNotepadViewer;
