import React, { useEffect, useState } from "react";
import {
  Lock,
  IndianRupee,
  AlertCircle,
  Clock,
  RefreshCw,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import paytmQR from "../../assets/paytm.jpg";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const PaymentBlockOverlay = ({ payment, onPaymentCleared }) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!autoRefresh) return;

    // Check payment status every 30 seconds
    const interval = setInterval(async () => {
      await checkPaymentStatus();
    }, 30000);

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(countdownInterval);
    };
  }, [autoRefresh]);

  const checkPaymentStatus = async () => {
    try {
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/api/payments/my-active`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success && !data.hasActivePayment) {
        // Payment has been approved or cancelled
        toast.success("Payment processed! You can now continue working.");
        if (onPaymentCleared) {
          onPaymentCleared();
        }
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    }
  };

  const handleManualRefresh = () => {
    setCountdown(30);
    checkPaymentStatus();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const downloadQRCode = () => {
    const link = document.createElement("a");
    link.href = paytmQR;
    link.download = `paytm-qr-${payment.transactionId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("QR code downloaded");
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 z-50 overflow-auto">
      {/* Overlay Pattern */}
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      ></div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Lock Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500 rounded-full mb-4 animate-pulse">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              Account Temporarily Locked
            </h1>
            <p className="text-indigo-200 text-lg">
              Please complete the payment to continue
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-6 h-6" />
                  <h2 className="text-xl font-bold">Payment Required</h2>
                </div>
                <div className="text-sm opacity-90">
                  {payment.transactionId}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Alert */}
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <div className="flex gap-3">
                  <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-1">
                      All Activities Suspended
                    </h3>
                    <p className="text-sm text-red-700">
                      You cannot punch in/out, take breaks, or access other
                      sections until this payment is processed and approved by
                      the super admin.
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left - Details */}
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-700 font-medium mb-1">
                      Amount Due
                    </p>
                    <p className="text-3xl font-bold text-green-800">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
                      Reason
                    </p>
                    <p className="text-gray-900 font-medium">{payment.reason}</p>
                  </div>

                  {payment.notes && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-semibold mb-1">
                        Additional Notes
                      </p>
                      <p className="text-sm text-gray-700">{payment.notes}</p>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Activated: {formatDate(payment.activatedAt)}</span>
                    </div>
                    {payment.activatedBy && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <IndianRupee className="w-4 h-4" />
                        <span>By: {payment.activatedBy.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right - QR Code */}
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border-4 border-gray-200 shadow-lg">
                    <img
                      src={paytmQR}
                      alt="Paytm Payment QR Code"
                      className="w-64 h-64 object-contain"
                    />
                  </div>
                  <button
                    onClick={downloadQRCode}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download QR Code
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">
                  Payment Instructions:
                </h3>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Scan the QR code using your payment app (Paytm, Google Pay, PhonePe, etc.)</li>
                  <li>Complete the payment of {formatCurrency(payment.amount)}</li>
                  <li>
                    Wait for the super admin to verify and approve the payment
                  </li>
                  <li>
                    Once approved, you'll regain access to all features
                    automatically
                  </li>
                </ol>
              </div>

              {/* Auto-refresh Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-gray-600" />
                    <span className="text-sm text-gray-700">
                      Auto-checking status...
                    </span>
                  </div>
                  <span className="text-sm font-mono text-gray-600">
                    Next check in {countdown}s
                  </span>
                </div>
                <button
                  onClick={handleManualRefresh}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Check Now
                </button>
              </div>

              {/* Help Text */}
              <div className="text-center text-sm text-gray-600 pt-4 border-t">
                <p>
                  If you've completed the payment and still see this screen,
                  please contact your super admin or wait for approval.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center mt-6 text-indigo-200 text-sm">
            <p>
              This is an automated system. Your account will be unlocked
              automatically once the payment is approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentBlockOverlay;
