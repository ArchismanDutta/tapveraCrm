import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Login from "./pages/LoginPage";
import Signup from "./pages/SignUp";
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import MyProfile from "./pages/MyProfile";
import Tasks from "./pages/Tasks";
import AdminTaskPage from "./pages/AdminTaskPage";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true); // ✅ Prevent premature redirects

  useEffect(() => {
    const token = localStorage.getItem("token");

    // OPTIONAL: Validate token with backend here before setting auth
    if (token && token.trim() !== "") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }

    setLoading(false); // ✅ Allow routing after check
  }, []);

  const handleLoginSuccess = () => {
    localStorage.setItem("token", "dummy-token"); // You’ll replace with real token
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Login Page */}
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

        {/* Signup Page */}
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

        {/* Employee Dashboard */}
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

        {/* Employee Profile Page */}
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

        {/* Employee Tasks Page */}
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

        {/* Admin Task Management Page */}
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

        {/* Catch-All Redirect */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      </Routes>
    </Router>
  );
};

export default App;
