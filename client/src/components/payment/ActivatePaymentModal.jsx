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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-600/30 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-slate-600/30 px-6 py-4 flex items-center justify-between backdrop-blur-sm">
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <IndianRupee className="w-6 h-6 text-cyan-400" />
            Activate Payment QR Code
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Employee Info */}
        <div className="px-6 py-4 bg-slate-700/30 border-b border-slate-600/30">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                <span className="text-cyan-400 font-semibold text-lg">
                  {employee.name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-100">{employee.name}</h3>
              <p className="text-sm text-gray-400">{employee.employeeId}</p>
            </div>
          </div>

          {/* Task Stats */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-600/30">
              <p className="text-xs text-gray-400">Due Tasks</p>
              <p className="text-lg font-bold text-red-400">
                {employee.taskStats.dueTasks}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-600/30">
              <p className="text-xs text-gray-400">Rejections</p>
              <p className="text-lg font-bold text-orange-400">
                {employee.taskStats.rejectedTasks}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Amount <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-cyan-400 sm:text-sm font-semibold">₹</span>
              </div>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                min="0"
                step="0.01"
                placeholder="0.00"
                className={`block w-full pl-7 pr-4 py-3 bg-slate-700/50 border ${
                  errors.amount ? "border-red-400" : "border-slate-600/30"
                } text-gray-200 placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all`}
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              rows="3"
              placeholder="e.g., Performance bonus, Overtime payment, Advance payment"
              className={`block w-full px-4 py-3 bg-slate-700/50 border ${
                errors.reason ? "border-red-400" : "border-slate-600/30"
              } text-gray-200 placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none transition-all`}
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
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Additional Notes (Optional)
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows="2"
              placeholder="Any additional information..."
              className="block w-full px-4 py-3 bg-slate-700/50 border border-slate-600/30 text-gray-200 placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none transition-all"
            />
          </div>

          {/* QR Code Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-1">
              <Image className="w-4 h-4" />
              Payment QR Code <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              {/* Upload Button */}
              <div className={`relative border-2 border-dashed ${
                errors.qrCode ? "border-red-400" : "border-slate-600/30"
              } rounded-xl p-6 text-center hover:border-cyan-500/50 transition-colors cursor-pointer bg-slate-700/20`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrCodeChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {!qrCodePreview ? (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <p className="text-sm text-gray-400">
                      Click to upload QR code image
                    </p>
                    <p className="text-xs text-gray-500">
                      PNG, JPG up to 5MB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={qrCodePreview}
                      alt="QR Code Preview"
                      className="w-48 h-48 object-contain border border-slate-600/30 rounded-lg bg-white p-2"
                    />
                    <p className="text-sm text-green-400 flex items-center gap-1">
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
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-300">
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
              className="flex-1 px-4 py-3 border border-slate-600/30 text-gray-300 rounded-xl hover:bg-slate-700/50 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
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
