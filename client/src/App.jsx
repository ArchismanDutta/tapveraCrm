import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
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
import EmployeeManagementPage from "./pages/EmployeeManagement";
import HolidaysAndLeaves from "./pages/HolidaysAndLeaves"; // Employee & Superadmin Leaves Page
import AdminLeaveRequests from "./pages/AdminLeaveRequests"; // Admin Leave Requests Management
import TodayStatusPage from "./pages/TodayStatusPage"; // Today's Status Page
import AttendancePage from "./pages/AttendancePage"; // Attendance Page
import NoticeForm from "./components/admintask/NoticeForm";
import TodoPage from "./pages/TodoPage"; // Import the TodoPage

// Import ChatPage for chat system
import ChatPage from "./pages/ChatPage";

const AppWrapper = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    let storedRole =
      JSON.parse(localStorage.getItem("user"))?.role || localStorage.getItem("role");

    if (storedRole) storedRole = storedRole.toLowerCase();

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
    const savedRole = (localStorage.getItem("role") || "").toLowerCase();
    setIsAuthenticated(true);
    setRole(savedRole);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    sessionStorage.removeItem("noticesDismissed");
    setIsAuthenticated(false);
    setRole(null);
    navigate("/login", { replace: true });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <Routes>
      {/* Login & Signup */}
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
      <Route
        path="/signup"
        element={
          !isAuthenticated ? (
            <Signup onLoginSuccess={handleLoginSuccess} />
          ) : role === "admin" || role === "super-admin" ? (
            <Navigate to="/admin/tasks" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      {/* Forgot & Reset Password */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Employee Dashboard */}
      <Route
        path="/dashboard"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
            <EmployeeDashboardPage onLogout={handleLogout} role={role} />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Profile */}
      <Route
        path="/profile"
        element={
          isAuthenticated ? (
            <MyProfile onLogout={handleLogout} userType={role || "employee"} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Tasks */}
      <Route
        path="/tasks"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
            <Tasks onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Today Status Page */}
      <Route
        path="/today-status"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
            <TodayStatusPage onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Tasks Status */}
      <Route
        path="/tasks-status"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
            <TodayStatusPage onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Attendance Page */}
      <Route
        path="/attendance"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
            <AttendancePage onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Todo Page */}
      <Route
        path="/todo"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
            <TodoPage />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Chat Page */}
      <Route
        path="/chat"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
            <ChatPage />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Holidays & Leaves */}
      <Route
        path="/leaves"
        element={
          isAuthenticated && role !== "admin" ? (
            <HolidaysAndLeaves onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
          )
        }
      />

      {/* Admin Task Page */}
      <Route
        path="/admin/tasks"
        element={
          isAuthenticated && (role === "admin" || role === "super-admin") ? (
            <AdminTaskPage onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          )
        }
      />

      {/* Employee Management */}
      <Route
        path="/admin/employees"
        element={
          isAuthenticated && (role === "admin" || role === "super-admin") ? (
            <EmployeeManagementPage onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          )
        }
      />

      {/* Admin Leave Requests Management Page */}
      <Route
        path="/admin/leaves"
        element={
          isAuthenticated && (role === "admin" || role === "super-admin") ? (
            <AdminLeaveRequests onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          )
        }
      />

      {/* Admin Notices */}
      <Route
        path="/admin/notices"
        element={
          isAuthenticated && (role === "admin" || role === "super-admin") ? (
            <NoticeForm />
          ) : (
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          )
        }
      />

      {/* Default Catch-All Redirect */}
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
  );
};

const App = () => (
  <Router>
    <AppWrapper />
  </Router>
);

export default App;
