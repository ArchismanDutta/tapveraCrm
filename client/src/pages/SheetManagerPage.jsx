// pages/SheetManagerPage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FileSpreadsheet,
  Plus,
  Edit2,
  Trash2,
  Share2,
  ExternalLink,
  Search,
  Filter,
  Eye,
  Users,
  Calendar,
  Tag,
  X,
  Check,
  AlertCircle,
  Activity,
} from "lucide-react";
import SheetViewer from "../components/sheets/SheetViewer";
import ShareSheetModal from "../components/sheets/ShareSheetModal";
import AccessHistoryModal from "../components/sheets/AccessHistoryModal";
import Sidebar from "../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const SheetManagerPage = ({ onLogout }) => {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAccessHistory, setShowAccessHistory] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [user, setUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    originalUrl: "",
    category: "",
    tags: "",
  });

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
    fetchSheets();
  }, []);

  const isSuperAdmin = () => {
    return user && (user.role === "super-admin" || user.role === "superadmin");
  };

  const canEdit = (sheet) => {
    if (!user) return false;
    if (isSuperAdmin()) return true;
    return sheet.addedBy?._id === user._id;
  };

  const fetchSheets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE}/api/sheets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSheets(response.data.data || []);
    } catch (error) {
      console.error("Error fetching sheets:", error);
      showNotification(
        error.response?.data?.message || "Error fetching sheets",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddSheet = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.originalUrl) {
      showNotification("Name and URL are required", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const tagsArray = formData.tags
        ? formData.tags.split(",").map((tag) => tag.trim())
        : [];

      await axios.post(
        `${API_BASE}/api/sheets`,
        {
          ...formData,
          tags: tagsArray,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showNotification("Sheet added successfully!", "success");
      setShowAddModal(false);
      resetForm();
      fetchSheets();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error adding sheet",
        "error"
      );
    }
  };

  const handleEditSheet = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");
      const tagsArray = formData.tags
        ? formData.tags.split(",").map((tag) => tag.trim())
        : [];

      await axios.put(
        `${API_BASE}/api/sheets/${selectedSheet._id}`,
        {
          ...formData,
          tags: tagsArray,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showNotification("Sheet updated successfully!", "success");
      setShowEditModal(false);
      setSelectedSheet(null);
      resetForm();
      fetchSheets();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error updating sheet",
        "error"
      );
    }
  };

  const handleDeleteSheet = async (sheetId) => {
    if (!window.confirm("Are you sure you want to delete this sheet?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE}/api/sheets/${sheetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      showNotification("Sheet deleted successfully!", "success");
      fetchSheets();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error deleting sheet",
        "error"
      );
    }
  };

  const openEditModal = (sheet) => {
    setSelectedSheet(sheet);
    setFormData({
      name: sheet.name,
      description: sheet.description || "",
      originalUrl: sheet.originalUrl,
      category: sheet.category || "",
      tags: sheet.tags?.join(", ") || "",
    });
    setShowEditModal(true);
  };

  const openShareModal = (sheet) => {
    setSelectedSheet(sheet);
    setShowShareModal(true);
  };

  const openAccessHistory = (sheet) => {
    setSelectedSheet(sheet);
    setShowAccessHistory(true);
  };

  const openViewer = (sheet) => {
    setSelectedSheet(sheet);
    setShowViewer(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      originalUrl: "",
      category: "",
      tags: "",
    });
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const filteredSheets = sheets.filter((sheet) => {
    const matchesSearch =
      sheet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sheet.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sheet.tags?.some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesType =
      filterType === "all" || sheet.type === filterType;

    return matchesSearch && matchesType;
  });

  const getSheetIcon = (type) => {
    return type === "google" ? (
      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
        <FileSpreadsheet className="w-5 h-5 text-green-400" />
      </div>
    ) : (
      <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
        <FileSpreadsheet className="w-5 h-5 text-blue-400" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={onLogout}
        userRole={user?.role}
      />

      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 ${
          sidebarCollapsed ? "ml-16" : "ml-56"
        }`}
      >
        {/* Notification */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
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

        {/* Header */}
        <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1419] border-b border-[#232945] p-6">
          <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-blue-400" />
                Sheet Manager
              </h1>
              <p className="text-gray-400 mt-1">
                Manage and collaborate on Google Sheets and Excel Online
              </p>
            </div>
            {isSuperAdmin() && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Add Sheet
              </button>
            )}
          </div>

          {/* Search and Filters */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search sheets by name, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="google">Google Sheets</option>
                <option value="excel">Excel Online</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sheets Grid */}
      <div className="max-w-7xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : filteredSheets.length === 0 ? (
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-12 text-center">
            <FileSpreadsheet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">
              {searchTerm || filterType !== "all"
                ? "No sheets found matching your filters"
                : "No sheets added yet"}
            </p>
            {isSuperAdmin() && !searchTerm && filterType === "all" && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Add Your First Sheet
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSheets.map((sheet) => (
              <div
                key={sheet._id}
                className="bg-[#0f1419] border border-[#232945] rounded-lg overflow-hidden hover:border-purple-500/50 transition-all group"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-[#232945]">
                  <div className="flex items-start justify-between gap-3">
                    {getSheetIcon(sheet.type)}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {sheet.name}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">
                        {sheet.type} Sheet
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  {sheet.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                      {sheet.description}
                    </p>
                  )}

                  {/* Tags */}
                  {sheet.tags && sheet.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {sheet.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-purple-600/20 text-purple-400 rounded border border-purple-500/50"
                        >
                          {tag}
                        </span>
                      ))}
                      {sheet.tags.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-gray-500">
                          +{sheet.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(sheet.createdAt).toLocaleDateString()}
                    </div>
                    {sheet.isShared && (
                      <div className="flex items-center gap-1 text-blue-400">
                        <Users className="w-3 h-3" />
                        Shared
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openViewer(sheet)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      Open
                    </button>
                    <a
                      href={sheet.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:bg-gray-700/30 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    {canEdit(sheet) && (
                      <>
                        <button
                          onClick={() => openEditModal(sheet)}
                          className="p-2 text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isSuperAdmin() && (
                          <button
                            onClick={() => openShareModal(sheet)}
                            className="p-2 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors"
                            title="Share"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        )}
                        {(isSuperAdmin() || user?.role === "admin") && (
                          <button
                            onClick={() => openAccessHistory(sheet)}
                            className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                            title="View Access History"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSheet(sheet._id)}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-2 bg-[#0a0e14] border-t border-[#232945] flex items-center gap-2 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  Added by {sheet.addedBy?.name || "Unknown"}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Add Sheet Modal */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Add New Sheet</h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
                    }}
                    className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleAddSheet} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sheet Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g., Sales Dashboard 2024"
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sheet URL *
                    </label>
                    <input
                      type="url"
                      value={formData.originalUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, originalUrl: e.target.value })
                      }
                      placeholder="Paste Google Sheets or Excel Online link here"
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Make sure the sheet is shared with "Anyone with the link can edit"
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Brief description of this sheet..."
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Category
                      </label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        placeholder="e.g., Sales, Finance"
                        className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) =>
                          setFormData({ ...formData, tags: e.target.value })
                        }
                        placeholder="sales, dashboard, 2024"
                        className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        resetForm();
                      }}
                      className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] text-white rounded-lg hover:bg-[#141a21] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium"
                    >
                      Add Sheet
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Sheet Modal */}
        {showEditModal && selectedSheet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-2xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Edit Sheet</h3>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedSheet(null);
                      resetForm();
                    }}
                    className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <form onSubmit={handleEditSheet} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sheet Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Sheet URL *
                    </label>
                    <input
                      type="url"
                      value={formData.originalUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, originalUrl: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      rows="3"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Category
                      </label>
                      <input
                        type="text"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) =>
                          setFormData({ ...formData, tags: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setSelectedSheet(null);
                        resetForm();
                      }}
                      className="flex-1 px-4 py-2 bg-[#0f1419] border border-[#232945] text-white rounded-lg hover:bg-[#141a21] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all font-medium"
                    >
                      Update Sheet
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && selectedSheet && (
          <ShareSheetModal
          sheet={selectedSheet}
          onClose={() => {
            setShowShareModal(false);
            setSelectedSheet(null);
            fetchSheets();
          }}
          onSuccess={() => {
            showNotification("Sheet shared successfully!", "success");
            fetchSheets();
          }}
        />
      )}

        {/* Access History Modal */}
        {showAccessHistory && selectedSheet && (
          <AccessHistoryModal
            sheet={selectedSheet}
            onClose={() => {
              setShowAccessHistory(false);
              setSelectedSheet(null);
            }}
          />
        )}

        {/* Viewer */}
        {showViewer && selectedSheet && (
          <SheetViewer
            sheet={selectedSheet}
            onClose={() => {
              setShowViewer(false);
              setSelectedSheet(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default SheetManagerPage;
