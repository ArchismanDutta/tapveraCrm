import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Upload,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit2,
  X,
  Download,
  Calendar,
  User,
  Copy,
  Check,
  ZoomIn,
  FileImage,
} from "lucide-react";
import SectionRemarks from "./SectionRemarks";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const Screenshot = ({ projectId, userRole, userId }) => {
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [notification, setNotification] = useState(null);
  const [stats, setStats] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    tags: "",
    file: null,
    preview: null,
  });

  const canEdit = ["admin", "super-admin", "superadmin", "employee"].includes(userRole);

  useEffect(() => {
    if (projectId) {
      fetchScreenshots();
      fetchStats();
    }
  }, [projectId]);

  const fetchScreenshots = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/screenshots`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setScreenshots(response.data.data || []);
    } catch (error) {
      console.error("Error fetching screenshots:", error);
      showNotification("Error fetching screenshots", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/screenshots/stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setStats(response.data.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file) => {
    if (!file.type.startsWith("image/")) {
      showNotification("Please select an image file", "error");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showNotification("File size must be less than 10MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({
        ...formData,
        file: file,
        preview: reader.result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          handleFile(blob);
          break;
        }
      }
    }
  };

  useEffect(() => {
    if (showUploadModal) {
      window.addEventListener("paste", handlePaste);
      return () => window.removeEventListener("paste", handlePaste);
    }
  }, [showUploadModal]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formData.file) {
      showNotification("Please select a file", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const uploadData = new FormData();
      uploadData.append("screenshot", formData.file);
      uploadData.append("title", formData.title);
      uploadData.append("description", formData.description);
      uploadData.append("tags", formData.tags);

      await axios.post(
        `${API_BASE}/api/projects/${projectId}/screenshots`,
        uploadData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      showNotification("Screenshot uploaded successfully!", "success");
      setShowUploadModal(false);
      resetForm();
      fetchScreenshots();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error uploading screenshot",
        "error"
      );
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedScreenshot) return;

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_BASE}/api/projects/${projectId}/screenshots/${selectedScreenshot._id}`,
        {
          title: formData.title,
          description: formData.description,
          tags: formData.tags,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      showNotification("Screenshot updated successfully!", "success");
      setShowEditModal(false);
      setSelectedScreenshot(null);
      resetForm();
      fetchScreenshots();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error updating screenshot",
        "error"
      );
    }
  };

  const handleDelete = async (screenshotId) => {
    if (!window.confirm("Are you sure you want to delete this screenshot?"))
      return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(
        `${API_BASE}/api/projects/${projectId}/screenshots/${screenshotId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      showNotification("Screenshot deleted successfully!", "success");
      fetchScreenshots();
      fetchStats();
    } catch (error) {
      showNotification(
        error.response?.data?.message || "Error deleting screenshot",
        "error"
      );
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      tags: "",
      file: null,
      preview: null,
    });
  };

  const openEditModal = (screenshot) => {
    setSelectedScreenshot(screenshot);
    setFormData({
      title: screenshot.title,
      description: screenshot.description || "",
      tags: screenshot.tags?.join(", ") || "",
      file: null,
      preview: null,
    });
    setShowEditModal(true);
  };

  const openViewModal = (screenshot) => {
    setSelectedScreenshot(screenshot);
    setShowViewModal(true);
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const copyImageUrl = (url) => {
    const fullUrl = `${API_BASE}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(url);
    showNotification("Image URL copied to clipboard!", "success");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadImage = (url, title) => {
    const link = document.createElement("a");
    link.href = `${API_BASE}${url}`;
    link.download = title || "screenshot";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            <ImageIcon className="w-6 h-6 text-blue-400" />
            Screenshots
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Upload, view, and manage project screenshots
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Upload Screenshot
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Screenshots</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {stats.totalScreenshots}
                </p>
              </div>
              <FileImage className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>
      )}

      {/* Screenshots Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : screenshots.length === 0 ? (
        <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-8 text-center">
          <ImageIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No screenshots uploaded yet</p>
          {canEdit && (
            <p className="text-sm text-gray-500 mt-2">
              Click "Upload Screenshot" to add your first screenshot
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {screenshots.map((screenshot) => (
            <div
              key={screenshot._id}
              className="bg-[#0f1419] border border-[#232945] rounded-lg overflow-hidden hover:border-purple-500/50 transition-all group"
            >
              {/* Image */}
              <div
                className="relative aspect-video bg-[#141a21] cursor-pointer"
                onClick={() => openViewModal(screenshot)}
              >
                <img
                  src={`${API_BASE}${screenshot.imageUrl}`}
                  alt={screenshot.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h4 className="text-white font-medium mb-1 truncate">
                  {screenshot.title}
                </h4>
                {screenshot.description && (
                  <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                    {screenshot.description}
                  </p>
                )}

                {/* Tags */}
                {screenshot.tags && screenshot.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {screenshot.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs bg-blue-600/20 text-blue-400 rounded border border-blue-500/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta Info */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(screenshot.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {screenshot.uploadedBy?.name || "Unknown"}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyImageUrl(screenshot.imageUrl)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                    title="Copy URL"
                  >
                    {copiedId === screenshot.imageUrl ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy URL
                      </>
                    )}
                  </button>
                  <button
                    onClick={() =>
                      downloadImage(screenshot.imageUrl, screenshot.title)
                    }
                    className="p-1.5 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => openEditModal(screenshot)}
                        className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(screenshot._id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  Upload Screenshot
                </h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                {/* File Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-[#232945] hover:border-blue-500/50"
                  }`}
                >
                  {formData.preview ? (
                    <div className="relative">
                      <img
                        src={formData.preview}
                        alt="Preview"
                        className="max-h-64 mx-auto rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, file: null, preview: null });
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                      <p className="text-white mb-1">
                        Drop an image here, paste from clipboard, or click to
                        browse
                      </p>
                      <p className="text-sm text-gray-500">
                        Supports: JPG, PNG, GIF, WebP (max 10MB)
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Description */}
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

                {/* Tags */}
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
                    placeholder="ui, mockup, homepage"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
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
                    Upload
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#191f2b] rounded-xl shadow-2xl border border-[#232945] w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  Edit Screenshot
                </h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedScreenshot(null);
                    resetForm();
                  }}
                  className="p-1 hover:bg-[#0f1419] rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-[#0f1419] border border-[#232945] rounded-lg text-white focus:outline-none focus:border-blue-500"
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

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedScreenshot(null);
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
                    Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
          onClick={() => setShowViewModal(false)}
        >
          <div
            className="relative max-w-7xl max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowViewModal(false)}
              className="absolute -top-10 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={`${API_BASE}${selectedScreenshot.imageUrl}`}
              alt={selectedScreenshot.title}
              className="max-w-full max-h-[90vh] rounded-lg"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
              <h4 className="text-white font-medium mb-1">
                {selectedScreenshot.title}
              </h4>
              {selectedScreenshot.description && (
                <p className="text-sm text-gray-300">
                  {selectedScreenshot.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Feedback for Screenshots */}
      <SectionRemarks
        projectId={projectId}
        section="screenshots"
        userRole={userRole}
        userId={userId}
        title="Client Feedback on Screenshots"
      />
    </div>
  );
};

export default Screenshot;
