import React, { useState } from "react";
import { X, IndianRupee, AlertCircle, FileText, Upload, Image } from "lucide-react";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ActivatePaymentModal = ({ employee, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: "",
    reason: "",
    notes: "",
  });
  const [qrCodeFile, setQrCodeFile] = useState(null);
  const [qrCodePreview, setQrCodePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleQrCodeChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size should be less than 5MB");
        return;
      }

      setQrCodeFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrCodePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Clear error
      if (errors.qrCode) {
        setErrors((prev) => ({ ...prev, qrCode: "" }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }

    if (!formData.reason || formData.reason.trim().length < 5) {
      newErrors.reason = "Please provide a reason (at least 5 characters)";
    }

    if (!qrCodeFile) {
      newErrors.qrCode = "Please upload a QR code image";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // Create FormData to handle file upload
      const formDataToSend = new FormData();
      formDataToSend.append("employeeId", employee._id);
      formDataToSend.append("amount", parseFloat(formData.amount));
      formDataToSend.append("reason", formData.reason.trim());
      if (formData.notes.trim()) {
        formDataToSend.append("notes", formData.notes.trim());
      }
      formDataToSend.append("qrCode", qrCodeFile);

      const response = await fetch(`${API_URL}/api/payments/activate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - browser will set it with boundary for FormData
        },
        body: formDataToSend,
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Payment QR code activated successfully!");
        onSuccess(data.data);
      } else {
        toast.error(data.message || "Failed to activate payment");
      }
    } catch (error) {
      console.error("Error activating payment:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-[#10131c]/95">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
            <IndianRupee className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            Activate payment QR code
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Close payment form"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Employee Info */}
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-white/10 dark:bg-white/[0.025]">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
                <span className="text-lg font-semibold text-white">
                  {employee.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-white">{employee.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{employee.employeeId}</p>
            </div>
          </div>

          {/* Task Stats */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="text-xs text-slate-500 dark:text-slate-400">Due tasks</p>
              <p className="text-lg font-semibold text-rose-600 dark:text-rose-300">
                {employee.taskStats.dueTasks}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.035]">
              <p className="text-xs text-slate-500 dark:text-slate-400">Rejections</p>
              <p className="text-lg font-semibold text-orange-600 dark:text-orange-300">
                {employee.taskStats.rejectedTasks}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Amount <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="font-semibold text-blue-600 dark:text-blue-300 sm:text-sm">₹</span>
              </div>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className={`block w-full rounded-xl border bg-slate-50 py-3 pl-7 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/15 dark:bg-white/[0.035] dark:text-white ${
                  errors.amount ? "border-rose-400" : "border-slate-200 focus:border-blue-500 dark:border-white/10"
                }`}
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.amount}
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows="3"
              placeholder="e.g., Performance bonus, Overtime payment, Advance payment"
              className={`block w-full resize-none rounded-xl border bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/15 dark:bg-white/[0.035] dark:text-white ${
                errors.reason ? "border-rose-400" : "border-slate-200 focus:border-blue-500 dark:border-white/10"
              }`}
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.reason}
              </p>
            )}
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              <FileText className="w-4 h-4" />
              Additional Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="2"
              placeholder="Any additional information..."
              className="block w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
            />
          </div>

          {/* QR Code Upload */}
          <div>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Image className="w-4 h-4" />
              Payment QR Code <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              {/* Upload Button */}
              <div className={`relative cursor-pointer rounded-xl border-2 border-dashed bg-slate-50 p-6 text-center transition-colors hover:border-blue-400 dark:bg-white/[0.025] ${
                errors.qrCode ? "border-rose-400" : "border-slate-300 dark:border-white/15"
              }`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrCodeChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {!qrCodePreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-slate-400" />
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Click to upload QR code image
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={qrCodePreview}
                      alt="QR Code Preview"
                      className="h-48 w-48 rounded-lg border border-slate-200 bg-white object-contain p-2"
                    />
                    <p className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-300">
                      <AlertCircle className="w-4 h-4" />
                      QR Code uploaded - Click to change
                    </p>
                  </div>
                )}
              </div>
              {errors.qrCode && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.qrCode}
                </p>
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">Important:</p>
                <p>
                  Once activated, the employee will be unable to punch in/out or
                  perform any actions until you approve the payment.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Activating...
                </>
              ) : (
                <>
                  <IndianRupee className="w-5 h-5" />
                  Activate QR Code
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivatePaymentModal;
