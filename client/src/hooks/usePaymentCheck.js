import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

/**
 * Custom hook to check for active payment that blocks employee activity
 * @returns {Object} { activePayment, checkingPayment, checkPaymentStatus, clearPayment }
 */
const usePaymentCheck = () => {
  const [activePayment, setActivePayment] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(true);

  const checkPaymentStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setCheckingPayment(false);
        return;
      }

      const response = await axios.get(`${API_BASE}/api/payments/my-active`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setActivePayment(response.data.data);
      } else {
        setActivePayment(null);
      }
    } catch (error) {
      console.error("Error checking active payment:", error);
      setActivePayment(null);
    } finally {
      setCheckingPayment(false);
    }
  }, []);

  const clearPayment = useCallback(() => {
    setActivePayment(null);
  }, []);

  // One authoritative check on mount, then event-driven: the server emits
  // "payment:updated" (bridged to this window event by WebSocketContext.jsx)
  // whenever this user's blocking payment is activated/approved/rejected/
  // cancelled, targeted at their own user:<id> room — so a blind 30s re-poll
  // (this hook is shared across ~6 pages) is redundant with it.
  useEffect(() => {
    checkPaymentStatus();

    window.addEventListener("payment-updated", checkPaymentStatus);
    return () => window.removeEventListener("payment-updated", checkPaymentStatus);
  }, [checkPaymentStatus]);

  return {
    activePayment,
    checkingPayment,
    checkPaymentStatus,
    clearPayment,
  };
};

export default usePaymentCheck;
