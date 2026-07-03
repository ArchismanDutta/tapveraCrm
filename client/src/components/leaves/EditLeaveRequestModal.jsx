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

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

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

    const effectiveEndDate = formData.type === "halfDay"
      ? formData.startDate
      : formData.endDate || formData.startDate;

    if (effectiveEndDate < formData.startDate) {
      setError("End date cannot be before the start date");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("startDate", formData.startDate);
      form.append("endDate", effectiveEndDate);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-leave-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-5 backdrop-blur-xl dark:border-white/10 dark:bg-[#10131c]/95">
          <div className="flex items-center justify-between">
            <div><h2 id="edit-leave-title" className="text-lg font-semibold text-slate-950 dark:text-white">Edit leave request</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Pending requests can be updated before review</p></div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
              aria-label="Close edit leave request"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-400/20 dark:bg-rose-400/10">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
              <span className="text-sm text-rose-700 dark:text-rose-200">{error}</span>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Leave type
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={(event) => {
                handleInputChange(event);
                if (event.target.value === "halfDay") {
                  setFormData((previous) => ({ ...previous, type: "halfDay", endDate: previous.startDate }));
                }
              }}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Start date
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  required
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                End date
              </label>
              <div className="relative">
                <input
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  min={formData.startDate || undefined}
                  disabled={formData.type === "halfDay"}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                />
                <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Reason
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleInputChange}
              placeholder="Please provide a reason for your leave..."
              rows="3"
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              required
            />
          </div>

          {/* Document Upload */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Supporting document <span className="font-normal text-slate-400">(optional)</span>
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
                className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-blue-400/[0.06]"
              >
                <Upload size={16} />
                {formData.document ? formData.document.name : "Upload new document"}
              </label>
            </div>
            {leaveRequest?.document && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Current document: {leaveRequest.document.name}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 border-t border-slate-200 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="h-10 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLeaveRequestModal;
