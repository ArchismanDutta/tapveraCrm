// src/pages/NotepadPage.jsx
import React, { useState, useCallback } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import MyNotepad from "../components/notepad/MyNotepad";
import PaymentBlockOverlay from "../components/payment/PaymentBlockOverlay";
import usePaymentCheck from "../hooks/usePaymentCheck";

const NotepadPage = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);

  // Payment check hook
  const { activePayment, checkingPayment, clearPayment } = usePaymentCheck();

  // Get user role from localStorage or context
  const getUserRole = () => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        return user.role || "employee";
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }
    return "employee";
  };

  const userRole = getUserRole();

  // Handle payment cleared
  const handlePaymentCleared = useCallback(() => {
    clearPayment();
  }, [clearPayment]);

  // Show loading while checking payment
  if (checkingPayment) {
    return (
      <div className="app-shell min-h-screen items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-cyan-300/40 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Show payment block if active payment exists
  if (activePayment) {
    return (
      <PaymentBlockOverlay
        payment={activePayment}
        onPaymentCleared={handlePaymentCleared}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole}
        onLogout={onLogout}
      />

      <main
        className={`app-main h-[100dvh] overflow-y-auto px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="app-page space-y-5 pb-8">
          <header className="app-header">
            <p className="app-eyebrow">Personal workspace</p>
            <h1 className="app-title">My notepad</h1>
            <p className="app-description">Capture quick notes and keep important details close at hand.</p>
          </header>
          <MyNotepad />
        </div>
      </main>
    </div>
  );
};

export default NotepadPage;
