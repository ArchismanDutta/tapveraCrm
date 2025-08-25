// File: src/App.jsx
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Pages
import Login from "./pages/LoginPage";
import Signup from "./pages/Signup"; // ✅ Only Admin/HR/Super Admin
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import MyProfile from "./pages/MyProfile";
import Tasks from "./pages/Tasks";
import AdminTaskPage from "./pages/AdminTaskPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EmployeeManagementPage from "./pages/EmployeeManagement";
import HolidaysAndLeaves from "./pages/HolidaysAndLeaves";
import AdminLeaveRequests from "./pages/AdminLeaveRequests";
import TodayStatusPage from "./pages/TodayStatusPage";
import AttendancePage from "./pages/AttendancePage";
import NoticeBoard from "./pages/NoticeBoard";
import TodoPage from "./pages/TodoPage";
import EmployeeDirectory from "./pages/EmployeeDirectory"; 
import EmployeePage from "./pages/EmployeePage";

const AppWrapper = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Load auth state on mount
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
    toast.success("✅ Login successful!");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    sessionStorage.removeItem("noticesDismissed");
    setIsAuthenticated(false);
    setRole(null);
    toast.info("👋 Logged out successfully!");
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">Loading...</div>
    );
  }

  const isAdmin = ["admin", "super-admin", "hr"].includes(role);

  return (
    <>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : isAdmin ? (
              <Navigate to="/admin/tasks" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Signup (Restricted to HR, Admin, Super Admin) */}
        <Route
          path="/signup"
          element={
            isAuthenticated &&
            ["admin", "super-admin", "hr"].includes(role) ? (
              <Signup onLoginSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
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
            isAuthenticated && !isAdmin ? (
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

        {/* Employee Page - Only Admin/HR/SuperAdmin */}
        <Route
          path="/employee/:id"
          element={
            isAuthenticated &&
            !["admin", "super-admin", "hr"].includes(role) ? (
              <Tasks onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Admin Pages */}
        <Route
          path="/admin/tasks"
          element={
            isAuthenticated &&
            !["admin", "super-admin", "hr"].includes(role) ? (
              <TodayStatusPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/employees"
          element={
            isAuthenticated &&
            !["admin", "super-admin", "hr"].includes(role) ? (
              <TodayStatusPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/leaves"
          element={
            isAuthenticated &&
            !["admin", "super-admin", "hr"].includes(role) ? (
              <AttendancePage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />
        <Route
          path="/admin/notices"
          element={
            isAuthenticated &&
            !["admin", "super-admin", "hr"].includes(role) ? (
              <TodoPage />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />

        {/* Employee Pages */}
        <Route
          path="/tasks"
          element={
            isAuthenticated && !isAdmin ? (
              <Tasks onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
            )
          }
        />
        <Route
          path="/today-status"
          element={
            isAuthenticated && !isAdmin ? (
              <TodayStatusPage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
            )
          }
        />
        <Route
          path="/attendance"
          element={
            isAuthenticated && !isAdmin ? (
              <AttendancePage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
            )
          }
        />
        <Route
          path="/todo"
          element={
            isAuthenticated && !isAdmin ? <TodoPage /> : <Navigate to="/admin/tasks" replace />
          }
        />
        <Route
          path="/leaves"
          element={
            isAuthenticated && !["admin", "super-admin"].includes(role) ? (
              <HolidaysAndLeaves onLogout={handleLogout} />
            ) : (
              <Navigate to="/admin/tasks" replace />
            )
          }
        />
        <Route
          path="/directory"
          element={
            isAuthenticated ? <EmployeeDirectory onLogout={handleLogout} /> : <Navigate to="/login" replace />
          }
        />

        {/* Catch-All */}
        <Route
          path="*"
          element={
            <Navigate
              to={isAuthenticated ? (isAdmin ? "/admin/tasks" : "/dashboard") : "/login"}
              replace
            />
          }
        />
      </Routes>

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
};

const App = () => (
  <Router>
    <AppWrapper />
  </Router>
);

export default App;
