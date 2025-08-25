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
import Signup from "./pages/Signup"; // Admin/HR/Super Admin only
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
import ChatPage from "./pages/ChatPage";
import EmployeeDirectory from "./pages/EmployeeDirectory"; // NEW

const AppWrapper = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Load auth state on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    let storedRole = JSON.parse(userStr)?.role || localStorage.getItem("role");

    if (storedRole) storedRole = storedRole.toLowerCase();

    if (token && token.trim() !== "") {
      setIsAuthenticated(true);
      setRole(storedRole);
      setCurrentUser(userStr ? JSON.parse(userStr) : null);
    } else {
      setIsAuthenticated(false);
      setRole(null);
      setCurrentUser(null);
    }
    setLoading(false);
  }, []);


  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
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
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : ["admin", "super-admin", "hr"].includes(role) ? (
              <Navigate to="/admin/tasks" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Signup (Admin/HR/Super Admin only) */}
        <Route
          path="/signup"
          element={
            isAuthenticated && ["admin", "super-admin", "hr"].includes(role) ? (
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
            isAuthenticated &&
            !["admin", "super-admin", "hr"].includes(role) ? (
              <EmployeeDashboardPage onLogout={handleLogout} role={role} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />


      <Route
        path="/messages"
        element={
          isAuthenticated ? (
            <ChatPage onLogout={handleLogout} currentUser={currentUser} />
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
            <Navigate
              to={isAuthenticated ? "/admin/tasks" : "/login"}
              replace
            />
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


        {/* Employee Tasks */}
        <Route
          path="/tasks"
          element={
            isAuthenticated && !["admin", "super-admin", "hr"].includes(role) ? (
              <Tasks onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />

        {/* Today Status */}
        <Route
          path="/today-status"
          element={
            isAuthenticated ? (
              <TodayStatusPage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
            )
          }
        />
        <Route
          path="/tasks-status"
          element={
            isAuthenticated && !["admin", "super-admin", "hr"].includes(role) ? (
              <TodayStatusPage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/admin/tasks" : "/login"} replace />
            )
          }
        />

        {/* Attendance */}
        <Route
          path="/attendance"
          element={
            isAuthenticated && !["admin", "super-admin", "hr"].includes(role) ? (
              <AttendancePage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />

        {/* Todo Page */}
        <Route
          path="/todo"
          element={
            isAuthenticated && !["admin", "super-admin", "hr"].includes(role) ? (
              <TodoPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />

        {/* Holidays & Leaves */}
        <Route
          path="/leaves"
          element={
            isAuthenticated && !["admin", "super-admin"].includes(role) ? (
              <HolidaysAndLeaves onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/admin/tasks" : "/login"}
                replace
              />
            )
          }
        />

        {/* Employee Directory (All Authenticated Users) */}
        <Route
          path="/directory"
          element={
            isAuthenticated ? (
              <EmployeeDirectory onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Admin Task Page */}
        <Route
          path="/admin/tasks"
          element={
            isAuthenticated && ["admin", "super-admin", "hr"].includes(role) ? (
              <AdminTaskPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />


      {/* Admin Notices */}
      <Route
        path="/admin/notices"
        element={
          isAuthenticated && (role === "admin" || role === "super-admin") ? (
            <NoticeBoard onLogout={handleLogout} />
          ) : (
            <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
          )
        }
      />

        {/* Employee Management */}
        <Route
          path="/admin/employees"
          element={
            isAuthenticated && ["admin", "super-admin", "hr"].includes(role) ? (
              <EmployeeManagementPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />

        {/* Admin Leave Requests */}
        <Route
          path="/admin/leaves"
          element={
            isAuthenticated && ["admin", "super-admin", "hr"].includes(role) ? (
              <AdminLeaveRequests onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />

        {/* Admin Notices */}
        <Route
          path="/admin/notices"
          element={
            isAuthenticated && ["admin", "super-admin", "hr"].includes(role) ? (
              <NoticeBoard />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />

        {/* Catch-All Redirect */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                isAuthenticated
                  ? ["admin", "super-admin", "hr"].includes(role)
                    ? "/admin/tasks"
                    : "/dashboard"
                  : "/login"
              }
              replace
            />
          }
        />
      </Routes>

      {/* Toastify Notifications */}
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
