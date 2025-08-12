import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Login from "./pages/LoginPage";
import Signup from "./pages/SignUp";
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import MyProfile from "./pages/MyProfile";
import Tasks from "./pages/Tasks";
import AdminTaskPage from "./pages/AdminTaskPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DailyEmailSender from "./pages/DailyEmailSender"; // ✅ New email sender page

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token && token.trim() !== "") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    setLoading(false);
  }, []);

  const handleLoginSuccess = (token) => {
    localStorage.setItem("token", token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Signup */}
        <Route
          path="/signup"
          element={
            !isAuthenticated ? (
              <Signup onSignupSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Public Routes */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <EmployeeDashboardPage onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <MyProfile onLogout={handleLogout} userType="Employee" />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/tasks"
          element={
            isAuthenticated ? (
              <Tasks onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/admin/tasks"
          element={
            isAuthenticated ? (
              <AdminTaskPage onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* ✅ Daily Email Sender */}
        <Route
          path="/daily-email"
          element={
            isAuthenticated ? (
              <DailyEmailSender onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch-all Redirect */}
        <Route
          path="*"
          element={
            <Navigate
              to={isAuthenticated ? "/dashboard" : "/login"}
              replace
            />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
