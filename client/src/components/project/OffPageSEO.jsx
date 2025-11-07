import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Link as LinkIcon,
  Plus,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  User,
  X,
  Search,
  Filter,
  CheckSquare,
  Square,
  Undo2,
} from "lucide-react";
import SectionRemarks from "./SectionRemarks";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Social Media Platform Logos with improved styling
const getSocialMediaIcon = (platform) => {
  const icons = {
    Facebook: (
      <div className="w-8 h-8 flex items-center justify-center bg-[#1877F2] rounded-lg shadow-lg hover:shadow-blue-500/50 transition-all">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      </div>
    ),
    Twitter: (
      <div className="w-8 h-8 flex items-center justify-center bg-black rounded-lg shadow-lg hover:shadow-gray-500/50 transition-all">
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      </div>
    ),
    Instagram: (
      <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#FCAF45] rounded-lg shadow-lg hover:shadow-pink-500/50 transition-all">
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" strokeWidth="2"/>
          <circle cx="12" cy="12" r="4" strokeWidth="2"/>
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor"/>
        </svg>
      </div>
    ),
    LinkedIn: (
      <div className="w-8 h-8 flex items-center justify-center bg-[#0A66C2] rounded-lg shadow-lg hover:shadow-blue-700/50 transition-all">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      </div>
    ),
    YouTube: (
      <div className="w-8 h-8 flex items-center justify-center bg-[#FF0000] rounded-lg shadow-lg hover:shadow-red-500/50 transition-all">
        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      </div>
    ),
    Pinterest: (
      <div className="w-8 h-8 flex items-center justify-center bg-[#E60023] rounded-lg shadow-lg hover:shadow-red-600/50 transition-all">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0a12 12 0 0 0-4.37 23.172c-.059-.547-.113-1.387.024-1.985.123-.544.802-3.406.802-3.406s-.205-.41-.205-.998c0-.935.543-1.633 1.218-1.633.574 0 .852.431.852.948 0 .578-.368 1.442-.558 2.243-.159.671.337 1.218 1 1.218 1.2 0 2.123-1.266 2.123-3.092 0-1.616-1.16-2.747-2.818-2.747-1.92 0-3.047 1.44-3.047 2.929 0 .58.223 1.201.502 1.539.055.067.063.125.046.193-.051.205-.164.67-.187.764-.03.123-.098.149-.226.09-1.37-.637-2.226-2.637-2.226-4.244 0-3.458 2.513-6.633 7.244-6.633 3.804 0 6.76 2.713 6.76 6.337 0 3.779-2.382 6.819-5.687 6.819-1.11 0-2.155-.577-2.513-1.258 0 0-.549 2.093-.683 2.606-.247.95-.917 2.14-1.366 2.866A12 12 0 1 0 12 0z"/>
        </svg>
      </div>
    ),
    TikTok: (
      <div className="w-8 h-8 flex items-center justify-center bg-black rounded-lg shadow-lg hover:shadow-cyan-500/50 transition-all">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" fill="#00F7EF"/>
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" fill="#FF004F"/>
        </svg>
      </div>
    ),
    Reddit: (
      <div className="w-8 h-8 flex items-center justify-center bg-[#FF4500] rounded-lg shadow-lg hover:shadow-orange-500/50 transition-all">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
        </svg>
      </div>
    ),
    GitHub: (
      <div className="w-8 h-8 flex items-center justify-center bg-[#181717] rounded-lg shadow-lg hover:shadow-gray-700/50 transition-all border border-gray-700">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      </div>
    ),
    Medium: (
      <div className="w-8 h-8 flex items-center justify-center bg-black rounded-lg shadow-lg hover:shadow-white/20 transition-all">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
        </svg>
      </div>
    ),
  };

  return icons[platform] || null;
};

const OffPageSEO = ({ projectId, userRole, userId }) => {
  const [backlinks, setBacklinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBacklink, setSelectedBacklink] = useState(null);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedBacklinks, setSelectedBacklinks] = useState([]);
  const [undoStack, setUndoStack] = useState([]);

  const [formData, setFormData] = useState({
    url: "",
    category: "Others",
    notes: "",
  });

  const canEdit = ["admin", "super-admin", "superadmin", "employee"].includes(userRole);

  useEffect(() => {
    if (projectId) {
      fetchBacklinks();
      fetchStats();
    }
  }, [projectId]);

  const fetchBacklinks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/backlinks`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setBacklinks(response.data.data || []);
    } catch (error) {
      console.error("Error fetching backlinks:", error);
      showNotification("Error fetching backlinks", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/backlinks/stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setStats(response.data.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleAddBacklink = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE}/api/projects/${projectId}/backlinks`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Backlink added successfully!", "success");
      setShowAddModal(false);
      resetForm();
      fetchBacklinks();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error adding backlink",
        "error"
      );
    }
  };

  const handleEditBacklink = async (e) => {
    e.preventDefault();
    if (!selectedBacklink) return;

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/projects/${projectId}/backlinks/${selectedBacklink._id}`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Backlink updated successfully!", "success");
      setShowEditModal(false);
      setSelectedBacklink(null);
      resetForm();
      fetchBacklinks();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error updating backlink",
        "error"
      );
    }
  };

  const handleDeleteBacklink = async (backlinkId) => {
    if (!window.confirm("Are you sure you want to delete this backlink?"))
      return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE}/api/projects/${projectId}/backlinks/${backlinkId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Backlink deleted successfully!", "success");
      fetchBacklinks();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error deleting backlink",
        "error"
      );
    }
  };

  const handleSelectBacklink = (backlinkId) => {
    setSelectedBacklinks((prev) => {
      if (prev.includes(backlinkId)) {
        return prev.filter((id) => id !== backlinkId);
      }
      return [...prev, backlinkId];
    });
  };

  const handleSelectAll = () => {
    if (selectedBacklinks.length === filteredBacklinks.length) {
      setSelectedBacklinks([]);
    } else {
      setSelectedBacklinks(filteredBacklinks.map((b) => b._id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedBacklinks.length === 0) {
      showNotification("No backlinks selected", "error");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedBacklinks.length} backlink(s)?`
      )
    )
      return;

    try {
      const token = localStorage.getItem("token");
      const deletedBacklinks = backlinks.filter((b) =>
        selectedBacklinks.includes(b._id)
      );

      // Save to undo stack
      setUndoStack((prev) => [
        ...prev,
        { items: deletedBacklinks, timestamp: Date.now() },
      ]);

      // Delete all selected backlinks
      await Promise.all(
        selectedBacklinks.map((backlinkId) =>
          axios.delete(
            `${API_BASE}/api/projects/${projectId}/backlinks/${backlinkId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        )
      );

      showNotification(
        `${selectedBacklinks.length} backlink(s) deleted successfully!`,
        "success"
      );
      setSelectedBacklinks([]);
      fetchBacklinks();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error deleting backlinks",
        "error"
      );
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0) {
      showNotification("No actions to undo", "error");
      return;
    }

    const lastAction = undoStack[undoStack.length - 1];
    try {
      const token = localStorage.getItem("token");

      // Restore deleted backlinks by re-adding them
      await Promise.all(
        lastAction.items.map((backlink) =>
          axios.post(
            `${API_BASE}/api/projects/${projectId}/backlinks`,
            {
              url: backlink.url,
              category: backlink.category,
              notes: backlink.notes || "Restored via undo",
            },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          )
        )
      );

      showNotification(
        `${lastAction.items.length} backlink(s) restored!`,
        "success"
      );
      setUndoStack((prev) => prev.slice(0, -1));
      fetchBacklinks();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error restoring backlinks",
        "error"
      );
    }
  };

  const resetForm = () => {
    setFormData({
      url: "",
      category: "Others",
      notes: "",
    });
  };

  const openEditModal = (backlink) => {
    setSelectedBacklink(backlink);
    setFormData({
      url: backlink.url,
      category: backlink.category,
      notes: backlink.notes || "",
    });
    setShowEditModal(true);
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getCategoryColor = (category) => {
    return category === "Social Media"
      ? "bg-purple-600/20 text-purple-400 border-purple-500/50"
      : "bg-blue-600/20 text-blue-400 border-blue-500/50";
  };

  // Filter backlinks
  const filteredBacklinks = backlinks.filter((backlink) => {
    const matchesSearch =
      backlink.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      backlink.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filterCategory === "all" || backlink.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            notification.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-blue-400" />
            Backlinks Tracking
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Manage backlinks and social media profiles
          </p>
          {selectedBacklinks.length > 0 && (
            <p className="text-xs text-blue-400 mt-1">
              {selectedBacklinks.length} backlink(s) selected
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && selectedBacklinks.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-medium shadow-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedBacklinks.length})
            </button>
          )}
          {canEdit && undoStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all font-medium shadow-lg"
              title="Undo last deletion"
            >
              <Undo2 className="w-4 h-4" />
              Undo
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Add Backlink
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Backlinks</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.totalBacklinks}
                </p>
              </div>
              <LinkIcon className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Social Media</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">
                  {stats.socialMedia}
                </p>
              </div>
              <div className="text-2xl">🌐</div>
            </div>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Others</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">
                  {stats.others}
                </p>
              </div>
              <LinkIcon className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search backlinks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="Social Media">Social Media</option>
          <option value="Others">Others</option>
        </select>
      </div>

      {/* Backlinks Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : filteredBacklinks.length === 0 ? (
        <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-8 text-center">
          <LinkIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No backlinks found</p>
          {canEdit && (
            <p className="text-sm text-gray-500 mt-2">
              Click "Add Backlink" to start tracking backlinks
            </p>
          )}
        </div>
      ) : (
        <div className="bg-[#0f1419] border border-[#232945] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#141a21] border-b border-[#232945]">
                <tr>
                  {canEdit && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">
                      <button
                        onClick={handleSelectAll}
                        className="p-1 hover:bg-[#232945] rounded transition-colors"
                        title={
                          selectedBacklinks.length === filteredBacklinks.length
                            ? "Deselect All"
                            : "Select All"
                        }
                      >
                        {selectedBacklinks.length === filteredBacklinks.length ? (
                          <CheckSquare className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Platform/URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Date Added
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Added By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232945]">
                {filteredBacklinks.map((backlink) => (
                  <tr
                    key={backlink._id}
                    className="hover:bg-[#141a21] transition-colors"
                  >
                    {canEdit && (
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleSelectBacklink(backlink._id)}
                          className="p-1 hover:bg-[#232945] rounded transition-colors"
                        >
                          {selectedBacklinks.includes(backlink._id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-400" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {backlink.category === "Social Media" &&
                          backlink.platform &&
                          getSocialMediaIcon(backlink.platform)}
                        <div className="flex-1">
                          {backlink.platform && (
                            <div className="text-sm font-medium text-white mb-1">
                              {backlink.platform}
                            </div>
                          )}
                          <a
                            href={backlink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 group"
                          >
                            <LinkIcon className="w-3 h-3" />
                            <span className="truncate max-w-md">
                              {backlink.url}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                          {backlink.notes && (
                            <div className="text-xs text-gray-500 mt-1">
                              {backlink.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded border text-xs font-medium ${getCategoryColor(
                          backlink.category
                        )}`}
                      >
                        {backlink.category}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(backlink.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <User className="w-4 h-4" />
                        {backlink.addedBy?.name || "Unknown"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={backlink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="Open Link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => openEditModal(backlink)}
                              className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBacklink(backlink._id)}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Backlink Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Add Backlink</h3>
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

              <form onSubmit={handleAddBacklink} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="https://example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Social Media">Social Media</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows="3"
                  />
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
                    Add Backlink
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Backlink Modal */}
      {showEditModal && selectedBacklink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Edit Backlink</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedBacklink(null);
                    resetForm();
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleEditBacklink} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Social Media">Social Media</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedBacklink(null);
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
                    Update Backlink
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Client Feedback for Backlinks */}
      <SectionRemarks
        projectId={projectId}
        section="backlinks"
        userRole={userRole}
        userId={userId}
        title="Client Feedback on Backlinks"
      />
    </div>
  );
};

export default OffPageSEO;
