import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Plus,
  Link as LinkIcon,
  ExternalLink,
  Edit2,
  Trash2,
  Calendar,
  User,
  FileText,
  TrendingUp,
  X,
  Search,
  Filter,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const BlogUpdates = ({ projectId, userRole, userId }) => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    url: "",
    description: "",
    category: "Blog Post",
    status: "Published",
    publishedDate: new Date().toISOString().split("T")[0],
    wordCount: "",
    targetKeywords: "",
    notes: "",
  });

  const canEdit = ["admin", "super-admin", "superadmin", "employee"].includes(userRole);

  const categories = [
    "Blog Post",
    "Article",
    "News",
    "Tutorial",
    "Case Study",
    "Other",
  ];
  const statuses = ["Published", "Draft", "Updated", "Archived"];

  useEffect(() => {
    if (projectId) {
      fetchBlogs();
      fetchStats();
    }
  }, [projectId]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/blogs`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setBlogs(response.data.data || []);
    } catch (error) {
      console.error("Error fetching blogs:", error);
      showNotification("Error fetching blog updates", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/blogs/stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setStats(response.data.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleAddBlog = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const dataToSend = {
        ...formData,
        targetKeywords: formData.targetKeywords
          ? formData.targetKeywords.split(",").map((k) => k.trim())
          : [],
        wordCount: formData.wordCount ? parseInt(formData.wordCount) : null,
      };

      await axios.post(
        `${API_BASE}/api/projects/${projectId}/blogs`,
        dataToSend,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Blog update added successfully!", "success");
      setShowAddModal(false);
      resetForm();
      fetchBlogs();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error adding blog update",
        "error"
      );
    }
  };

  const handleEditBlog = async (e) => {
    e.preventDefault();
    if (!selectedBlog) return;

    try {
      const token = localStorage.getItem("token");
      const dataToSend = {
        ...formData,
        targetKeywords: formData.targetKeywords
          ? formData.targetKeywords.split(",").map((k) => k.trim())
          : [],
        wordCount: formData.wordCount ? parseInt(formData.wordCount) : null,
      };

      await axios.put(
        `${API_BASE}/api/projects/${projectId}/blogs/${selectedBlog._id}`,
        dataToSend,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Blog update updated successfully!", "success");
      setShowEditModal(false);
      setSelectedBlog(null);
      resetForm();
      fetchBlogs();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error updating blog update",
        "error"
      );
    }
  };

  const handleDeleteBlog = async (blogId) => {
    if (!window.confirm("Are you sure you want to delete this blog update?"))
      return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE}/api/projects/${projectId}/blogs/${blogId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Blog update deleted successfully!", "success");
      fetchBlogs();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error deleting blog update",
        "error"
      );
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      url: "",
      description: "",
      category: "Blog Post",
      status: "Published",
      publishedDate: new Date().toISOString().split("T")[0],
      wordCount: "",
      targetKeywords: "",
      notes: "",
    });
  };

  const openEditModal = (blog) => {
    setSelectedBlog(blog);
    setFormData({
      title: blog.title,
      url: blog.url,
      description: blog.description || "",
      category: blog.category,
      status: blog.status,
      publishedDate: blog.publishedDate
        ? new Date(blog.publishedDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      wordCount: blog.wordCount || "",
      targetKeywords: blog.targetKeywords?.join(", ") || "",
      notes: blog.notes || "",
    });
    setShowEditModal(true);
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Published":
        return "bg-green-600/20 text-green-400 border-green-500/50";
      case "Draft":
        return "bg-yellow-600/20 text-yellow-400 border-yellow-500/50";
      case "Updated":
        return "bg-blue-600/20 text-blue-400 border-blue-500/50";
      case "Archived":
        return "bg-gray-600/20 text-gray-400 border-gray-500/50";
      default:
        return "bg-gray-600/20 text-gray-400 border-gray-500/50";
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "Blog Post":
        return "bg-purple-600/20 text-purple-400";
      case "Article":
        return "bg-blue-600/20 text-blue-400";
      case "News":
        return "bg-red-600/20 text-red-400";
      case "Tutorial":
        return "bg-green-600/20 text-green-400";
      case "Case Study":
        return "bg-orange-600/20 text-orange-400";
      default:
        return "bg-gray-600/20 text-gray-400";
    }
  };

  // Filter blogs
  const filteredBlogs = blogs.filter((blog) => {
    const matchesSearch =
      blog.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      blog.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      blog.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || blog.status === filterStatus;

    const matchesCategory =
      filterCategory === "all" || blog.category === filterCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6">
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
            <FileText className="w-6 h-6 text-blue-400" />
            Blog Updates
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Track blog posts and content updates
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Blog
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Blogs</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.totalBlogs}
                </p>
              </div>
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Published</p>
                <p className="text-2xl font-bold text-green-400 mt-1">
                  {stats.published}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-400" />
            </div>
          </div>
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg Words</p>
                <p className="text-2xl font-bold text-purple-400 mt-1">
                  {stats.avgWordCount}
                </p>
              </div>
              <FileText className="w-8 h-8 text-purple-400" />
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
            placeholder="Search blogs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Status</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Blogs Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : filteredBlogs.length === 0 ? (
        <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-8 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No blog updates found</p>
          {canEdit && (
            <p className="text-sm text-gray-500 mt-2">
              Click "Add Blog" to track your first blog post
            </p>
          )}
        </div>
      ) : (
        <div className="bg-[#0f1419] border border-[#232945] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#141a21] border-b border-[#232945]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Title & URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Published
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
                {filteredBlogs.map((blog) => (
                  <tr
                    key={blog._id}
                    className="hover:bg-[#141a21] transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-white mb-1">
                          {blog.title}
                        </div>
                        <a
                          href={blog.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 group"
                        >
                          <LinkIcon className="w-3 h-3" />
                          <span className="truncate max-w-xs">
                            {blog.url}
                          </span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                        {blog.wordCount && (
                          <div className="text-xs text-gray-500 mt-1">
                            {blog.wordCount.toLocaleString()} words
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(
                          blog.category
                        )}`}
                      >
                        {blog.category}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 rounded border text-xs font-medium ${getStatusColor(
                          blog.status
                        )}`}
                      >
                        {blog.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(blog.publishedDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Added{" "}
                        {new Date(blog.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-400">
                        <User className="w-4 h-4" />
                        {blog.addedBy?.name || "Unknown"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={blog.url}
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
                              onClick={() => openEditModal(blog)}
                              className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBlog(blog._id)}
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

      {/* Add Blog Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Add Blog Update</h3>
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

              <form onSubmit={handleAddBlog} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

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
                    placeholder="https://example.com/blog-post"
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
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Published Date
                    </label>
                    <input
                      type="date"
                      value={formData.publishedDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          publishedDate: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Word Count
                    </label>
                    <input
                      type="number"
                      value={formData.wordCount}
                      onChange={(e) =>
                        setFormData({ ...formData, wordCount: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.targetKeywords}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetKeywords: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="seo, digital marketing, web development"
                  />
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
                    rows="2"
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
                    Add Blog
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Blog Modal */}
      {showEditModal && selectedBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Edit Blog Update</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedBlog(null);
                    resetForm();
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleEditBlog} className="space-y-4">
                {/* Same form fields as Add Modal */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

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
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Published Date
                    </label>
                    <input
                      type="date"
                      value={formData.publishedDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          publishedDate: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Word Count
                    </label>
                    <input
                      type="number"
                      value={formData.wordCount}
                      onChange={(e) =>
                        setFormData({ ...formData, wordCount: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Target Keywords (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={formData.targetKeywords}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetKeywords: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
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
                    rows="2"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedBlog(null);
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
                    Update Blog
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlogUpdates;
