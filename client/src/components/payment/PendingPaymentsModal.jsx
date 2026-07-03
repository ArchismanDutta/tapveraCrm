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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
        <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
          <div className="text-center">
            <div className="relative mx-auto w-12 h-12">
              <div className="h-12 w-12 rounded-full border-4 border-blue-100 dark:border-blue-400/20"></div>
              <div className="absolute left-0 top-0 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-300">Loading pending payments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm dark:border-white/10 dark:bg-[#10131c]/95">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-white">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            Pending payments ({payments.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchPendingPayments}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
              aria-label="Close pending payments"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                No pending payments
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                All payments have been processed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div
                  key={payment._id}
                  className="rounded-2xl border border-slate-200 p-5 transition hover:shadow-md dark:border-white/10 sm:p-6"
                >
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left Side - Details */}
                    <div className="space-y-4">
                      {/* Employee Info */}
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
                            <span className="text-lg font-semibold text-white">
                              {payment.employee.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {payment.employee.name}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {payment.employee.employeeId}
                          </p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            Amount
                          </span>
                          <span className="text-2xl font-semibold text-emerald-700 dark:text-emerald-200">
                            {formatCurrency(payment.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                          Reason
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-200">{payment.reason}</p>
                      </div>

                      {/* Task Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-400/20 dark:bg-rose-400/10">
                          <p className="text-xs text-rose-600 dark:text-rose-300">Due tasks</p>
                          <p className="text-lg font-semibold text-rose-700 dark:text-rose-200">
                            {payment.taskStats.dueTasks}
                          </p>
                        </div>
                        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-400/20 dark:bg-orange-400/10">
                          <p className="text-xs text-orange-600 dark:text-orange-300">Rejections</p>
                          <p className="text-lg font-semibold text-orange-700 dark:text-orange-200">
                            {payment.taskStats.rejectedTasks}
                          </p>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
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
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/[0.025]">
                          <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Notes:
                          </p>
                          <p className="text-sm text-slate-700 dark:text-slate-200">{payment.notes}</p>
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
                      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                        Paytm QR Code for Payment
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 border-t border-slate-200 pt-6 dark:border-white/10">
                    {showRejectInput === payment._id ? (
                      <div className="space-y-3">
                        <textarea
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          placeholder="Reason for rejection (optional)..."
                          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
                          rows="2"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setShowRejectInput(null);
                              setRejectNotes("");
                            }}
                            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.05]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReject(payment._id)}
                            disabled={actionLoading === payment._id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
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
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-400/20 dark:text-rose-300 dark:hover:bg-rose-400/10"
                        >
                          <XCircle className="w-5 h-5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(payment._id)}
                          disabled={actionLoading === payment._id}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
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
