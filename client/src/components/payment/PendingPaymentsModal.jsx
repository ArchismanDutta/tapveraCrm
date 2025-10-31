import React, { useState, useEffect } from "react";
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  IndianRupee,
  Calendar,
  User,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import paytmQR from "../../assets/paytm.jpg";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const PendingPaymentsModal = ({ onClose, onPaymentUpdated }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(null);

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/payments/pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        setPayments(data.data);
      } else {
        toast.error(data.message || "Failed to fetch pending payments");
      }
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      toast.error("Failed to fetch pending payments");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (paymentId) => {
    try {
      setActionLoading(paymentId);
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/payments/${paymentId}/approve`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Payment approved successfully!");
        fetchPendingPayments();
        onPaymentUpdated();
      } else {
        toast.error(data.message || "Failed to approve payment");
      }
    } catch (error) {
      console.error("Error approving payment:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (paymentId) => {
    try {
      setActionLoading(paymentId);
      const token = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/api/payments/${paymentId}/reject`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            notes: rejectNotes || "Payment rejected by admin",
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success("Payment rejected");
        setShowRejectInput(null);
        setRejectNotes("");
        fetchPendingPayments();
        onPaymentUpdated();
      } else {
        toast.error(data.message || "Failed to reject payment");
      }
    } catch (error) {
      console.error("Error rejecting payment:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-800 border border-slate-600/30 rounded-xl p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="relative mx-auto w-12 h-12">
              <div className="w-12 h-12 border-4 border-cyan-300/40 rounded-full"></div>
              <div className="absolute top-0 left-0 w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="mt-4 text-gray-300">Loading pending payments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-600/30 rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-slate-600/30 px-6 py-4 flex items-center justify-between rounded-t-xl backdrop-blur-sm">
          <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-400" />
            Pending Payments ({payments.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPendingPayments}
              className="p-2 text-gray-300 hover:bg-slate-700/50 rounded-xl transition-all border border-slate-600/30"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-100 mb-2">
                No Pending Payments
              </h3>
              <p className="text-gray-400">
                All payments have been processed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment._id}
                  className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-6 hover:shadow-lg hover:shadow-cyan-500/10 transition-all"
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left Side - Details */}
                    <div className="space-y-4">
                      {/* Employee Info */}
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                            <span className="text-cyan-400 font-semibold text-lg">
                              {payment.employee.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-100">
                            {payment.employee.name}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {payment.employee.employeeId}
                          </p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-green-400 font-medium">
                            Amount
                          </span>
                          <span className="text-2xl font-bold text-green-300">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
                          Reason
                        </p>
                        <p className="text-sm text-gray-200">{payment.reason}</p>
                      </div>

                      {/* Task Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                          <p className="text-xs text-red-400">Due Tasks</p>
                          <p className="text-lg font-bold text-red-300">
                            {payment.taskStats.dueTasks}
                          </p>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                          <p className="text-xs text-orange-400">Rejections</p>
                          <p className="text-lg font-bold text-orange-300">
                            {payment.taskStats.rejectedTasks}
                          </p>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="text-xs text-gray-400 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span>Activated: {formatDate(payment.activatedAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3" />
                          <span>By: {payment.activatedBy.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <IndianRupee className="w-3 h-3" />
                          <span>TXN: {payment.transactionId}</span>
                        </div>
                      </div>

                      {payment.notes && (
                        <div className="bg-slate-800/50 border border-slate-600/30 rounded-lg p-3">
                          <p className="text-xs text-gray-400 font-semibold mb-1">
                            Notes:
                          </p>
                          <p className="text-sm text-gray-300">{payment.notes}</p>
                        </div>
                      )}
                    </div>

                    {/* Right Side - QR Code */}
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="bg-white p-4 rounded-xl border-2 border-slate-600/30 shadow-lg">
                        <img
                          src={paytmQR}
                          alt="Paytm Payment QR Code"
                          className="w-48 h-48 object-contain"
                        />
                      </div>
                      <p className="text-xs text-gray-400 text-center">
                        Paytm QR Code for Payment
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-6 border-t border-slate-600/30">
                    {showRejectInput === payment._id ? (
                      <div className="space-y-3">
                        <textarea
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="Reason for rejection (optional)..."
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/30 text-gray-200 placeholder-gray-500 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none transition-all"
                          rows="2"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowRejectInput(null);
                              setRejectNotes("");
                            }}
                            className="flex-1 px-4 py-3 border border-slate-600/30 text-gray-300 rounded-xl hover:bg-slate-700/50 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReject(payment._id)}
                            disabled={actionLoading === payment._id}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                          >
                            {actionLoading === payment._id ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                Rejecting...
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5" />
                                Confirm Reject
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowRejectInput(payment._id)}
                          disabled={actionLoading === payment._id}
                          className="flex-1 px-4 py-3 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(payment._id)}
                          disabled={actionLoading === payment._id}
                          className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                        >
                          {actionLoading === payment._id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              Approving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5" />
                              Approve Payment
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PendingPaymentsModal;
