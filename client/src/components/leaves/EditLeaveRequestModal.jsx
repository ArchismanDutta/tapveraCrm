import React, { useState, useEffect } from "react";
import { X, Upload, AlertCircle, Calendar } from "lucide-react";

const EditLeaveRequestModal = ({ isOpen, onClose, leaveRequest, onSave }) => {
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    type: "paid",
    reason: "",
    document: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Populate form when modal opens with existing data
  useEffect(() => {
    if (isOpen && leaveRequest) {
      const startDate = leaveRequest.period?.start
        ? new Date(leaveRequest.period.start).toISOString().split('T')[0]
        : "";
      const endDate = leaveRequest.period?.end
        ? new Date(leaveRequest.period.end).toISOString().split('T')[0]
        : "";

      setFormData({
        startDate,
        endDate,
        type: leaveRequest.type || "paid",
        reason: leaveRequest.reason || "",
        document: null, // Don't populate existing document, user can upload new one
      });
      setError("");
    }
  }, [isOpen, leaveRequest]);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "document") {
      setFormData(prev => ({ ...prev, document: files[0] }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.startDate || !formData.reason.trim()) {
      setError("Start date and reason are required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("startDate", formData.startDate);
      form.append("endDate", formData.endDate || formData.startDate);
      form.append("type", formData.type);
      form.append("reason", formData.reason);

      if (formData.document) {
        form.append("document", formData.document);
      }

      await onSave(leaveRequest._id, form);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update leave request");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[rgba(22,28,48,0.95)] border border-[rgba(84,123,209,0.13)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[rgba(22,28,48,0.95)] border-b border-[rgba(84,123,209,0.13)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-blue-100">Edit Leave Request</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-blue-300 text-sm font-medium mb-2">
              Leave Type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full p-3 bg-[rgba(36,44,92,0.4)] border border-[rgba(84,123,209,0.13)] rounded-lg text-blue-100 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
              required
            >
              <option value="paid">Paid Leave</option>
              <option value="unpaid">Unpaid Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="workFromHome">Work From Home</option>
              <option value="halfDay">Half Day</option>
              <option value="maternity">Maternity Leave</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-300 text-sm font-medium mb-2">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="w-full p-3 bg-[rgba(36,44,92,0.4)] border border-[rgba(84,123,209,0.13)] rounded-lg text-blue-100 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                  required
                />
                <Calendar size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-blue-300 text-sm font-medium mb-2">
                End Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  className="w-full p-3 bg-[rgba(36,44,92,0.4)] border border-[rgba(84,123,209,0.13)] rounded-lg text-blue-100 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                />
                <Calendar size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-blue-300 text-sm font-medium mb-2">
              Reason
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Please provide a reason for your leave..."
              rows="3"
              className="w-full p-3 bg-[rgba(36,44,92,0.4)] border border-[rgba(84,123,209,0.13)] rounded-lg text-blue-100 placeholder-blue-300/50 focus:ring-2 focus:ring-blue-500/50 focus:outline-none resize-none"
              required
            />
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-blue-300 text-sm font-medium mb-2">
              Supporting Document (Optional)
            </label>
            <div className="relative">
              <input
                type="file"
                name="document"
                onChange={handleInputChange}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
                id="document-upload"
              />
              <label
                htmlFor="document-upload"
                className="w-full p-3 bg-[rgba(36,44,92,0.4)] border border-[rgba(84,123,209,0.13)] rounded-lg text-blue-100 cursor-pointer hover:bg-[rgba(36,44,92,0.6)] transition-colors flex items-center gap-2"
              >
                <Upload size={16} />
                {formData.document ? formData.document.name : "Upload new document"}
              </label>
            </div>
            {leaveRequest?.document && (
              <p className="text-xs text-blue-300/70 mt-1">
                Current document: {leaveRequest.document.name}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 border border-gray-500/30 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {loading ? "Updating..." : "Update Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLeaveRequestModal;