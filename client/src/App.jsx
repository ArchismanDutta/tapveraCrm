import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Pages
import Login from "./pages/LoginPage";
import Signup from "./pages/SignUp";
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import MyProfile from "./pages/MyProfile"; // Employee Profile Page

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if token exists on first load
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        {/* Login Page */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login onLoginSuccess={handleLoginSuccess} />
            )
          }
        />

        {/* Signup Page */}
        <Route
          path="/signup"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Signup onSignupSuccess={handleLoginSuccess} />
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

        {/* Catch-All Redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
