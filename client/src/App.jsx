import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Pages
import Login from "./pages/LoginPage";
import Signup from "./pages/SignUp";
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import MyProfile from "./pages/MyProfile";
import Tasks from "./pages/Tasks";
import AdminTaskPage from "./pages/AdminTaskPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedRole = localStorage.getItem("role");

    if (token && token.trim() !== "") {
      setIsAuthenticated(true);
      setRole(storedRole);
    } else {
      setIsAuthenticated(false);
      setRole(null);
    }

    setLoading(false);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setRole(localStorage.getItem("role")); // stored in Login.jsx
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setRole(null);
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
            ) : role === "admin" || role === "super-admin" ? (
              <Navigate to="/admin/tasks" replace />
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
            ) : role === "admin" || role === "super-admin" ? (
              <Navigate to="/admin/tasks" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Public Routes */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Employee Routes */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated && role !== "admin" && role !== "super-admin" ? (
              <EmployeeDashboardPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />

        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <MyProfile
                onLogout={handleLogout}
                userType={role || "Employee"}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/tasks"
          element={
            isAuthenticated && role !== "admin" && role !== "super-admin" ? (
              <Tasks onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/tasks"
          element={
            isAuthenticated && (role === "admin" || role === "super-admin") ? (
              <AdminTaskPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />

        {/* Catch-all */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                isAuthenticated
                  ? role === "admin" || role === "super-admin"
                    ? "/admin/tasks"
                    : "/dashboard"
                  : "/login"
              }
              replace
            />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
