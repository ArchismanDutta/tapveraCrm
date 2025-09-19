// src/App.jsx
import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/toastify-custom.css";

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
import HolidaysAndLeaves from "./pages/HolidaysAndLeaves";
import AdminLeaveRequests from "./pages/AdminLeaveRequests";
import TodayStatusPage from "./pages/TodayStatusPage";
import AttendancePage from "./pages/AttendancePage";
import NoticeBoard from "./pages/NoticeBoard";
import TodoPage from "./pages/TodoPage";
import ChatPage from "./pages/ChatPage";
import EmployeeDirectory from "./pages/EmployeeDirectory";
import EmployeePage from "./pages/EmployeePage";
import HRDashboard from "./pages/HRDashboard";
import AdminAttendancePage from "./pages/AdminAttendancePage";
import HolidayManagementPage from "./pages/HolidayManagementPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminAttendancePortal from "./pages/SuperAdminAttendancePortal";
import ShiftManagement from "./components/humanResource/ShiftManagement";
import ManualAttendanceManagement from "./pages/admin/ManualAttendanceManagement";

import { resetChat } from "./store/slices/chatSlice";
import { useDispatch } from "react-redux";
import useGlobalChatNotifications from "./hooks/useGlobalChatNotifications";

// Unified role normalization function
const normalizeRole = (role) => {
  if (!role) return "employee";
  const r = role.toLowerCase().replace(/\s+/g, "-");
  if (r === "superadmin" || r === "super-admin") return "super-admin";
  return r;
};

const AppWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const dispatch = useDispatch();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) setCurrentUser(JSON.parse(userStr));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    let storedRole = userStr ? JSON.parse(userStr)?.role : null;
    storedRole = normalizeRole(storedRole);
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
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setCurrentUser(savedUser);
    setIsAuthenticated(true);
    setRole(normalizeRole(savedUser?.role));
    toast.success("✅ Login successful!");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    sessionStorage.removeItem("noticesDismissed");
    dispatch(resetChat());
    setCurrentUser(null);
    setIsAuthenticated(false);
    setRole(null);
    toast.info("👋 Logged out successfully!");
    navigate("/login", { replace: true });
  };
  // Global chat notifications & unread counter hook
  useGlobalChatNotifications(localStorage.getItem("token"));

  // Clear active conversation hint when leaving Messages page
  useEffect(() => {
    const onRoute = () => {
      if (location.pathname !== "/messages") {
        window.dispatchEvent(new CustomEvent("chat-active-conversation", { detail: { conversationId: null } }));
      }
    };
    onRoute();
  }, [location.pathname]);


  // Bridge WS notifications to toast UI globally
  useEffect(() => {
    // Expose toast globally for hooks/utilities
    window.toast = toast;

    const onWsNotification = (e) => {
      try {
        const n = e.detail || {};
        const title = n.title || "Notification";
        const body = n.body || "";
        const channel = n.channel ? ` [${n.channel}]` : "";
        // Force unique toastId to avoid any dedupe by identical content
        const tid = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        toast.info(`${title}${channel}: ${body}` , { toastId: tid });

        // Also increment global unread counter for chat notifications
        if ((n.channel || "").toLowerCase() === "chat") {
          try {
            const prev = Number(sessionStorage.getItem("chat_unread_total") || 0) || 0;
            const next = prev + 1;
            sessionStorage.setItem("chat_unread_total", String(next));
            window.dispatchEvent(new CustomEvent("chat-unread-total", { detail: { total: next } }));
          } catch {}
        }
      } catch {}
    };

    window.addEventListener("ws-notification", onWsNotification);
    return () => window.removeEventListener("ws-notification", onWsNotification);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  const roleNorm = normalizeRole(role);
  const isSuperAdmin = roleNorm === "super-admin";
  const isAdmin = roleNorm === "admin" || isSuperAdmin;
  const isHR = roleNorm === "hr";

  return (
    <>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : isSuperAdmin ? (
              <Navigate to="/super-admin" replace />
            ) : isHR ? (
              <Navigate to="/hrdashboard" replace />
            ) : isAdmin ? (
              <Navigate to="/admin/tasks" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* Super Admin Dashboard */}
        <Route
          path="/super-admin"
          element={
            isAuthenticated && (isHR || isSuperAdmin) ? (
              <SuperAdminDashboard onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Super Admin Attendance Portal */}
        <Route
          path="/super-admin/attendance"
          element={
            isAuthenticated && (isHR || isSuperAdmin) ? (
              <SuperAdminAttendancePortal onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* HR Dashboard */}
        <Route
          path="/hrdashboard"
          element={
            isAuthenticated && (isHR || isSuperAdmin) ? (
              <HRDashboard onLogout={handleLogout} currentUser={currentUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* ChatPage / Messages */}
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

        {/* Signup */}
        <Route
          path="/signup"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <Signup onLoginSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to={isAuthenticated ? "/" : "/login"} replace />
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
            isAuthenticated && !isAdmin && !isHR ? (
              <EmployeeDashboardPage onLogout={handleLogout} role={role} />
            ) : (
              <Navigate
                to={
                  isAuthenticated
                    ? isAdmin
                      ? "/admin/tasks"
                      : "/login"
                    : "/login"
                }
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
              <MyProfile
                onLogout={handleLogout}
                userType={role || "employee"}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Employee Page */}
        <Route
          path="/employee/:id"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <EmployeePage userRole={role} onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />

        {/* Admin/HR/Super Admin Routes */}
        <Route
          path="/admin/tasks"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <AdminTaskPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/shift"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <ShiftManagement onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/employees"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <EmployeeManagementPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/leaves"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <AdminLeaveRequests onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/notices"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <NoticeBoard onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin-attendance"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <AdminAttendancePage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/manual-attendance"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <ManualAttendanceManagement onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/holidays"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <HolidayManagementPage onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/shifts"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <ShiftManagement onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />
        <Route
          path="/admin/shifts"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <ShiftManagement onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Employee pages */}
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
          path="/today-status"
          element={
            isAuthenticated ? (
              <TodayStatusPage onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/attendance"
          element={
            isAuthenticated ? (
              <AttendancePage onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/todo"
          element={
            isAuthenticated ? (
              <TodoPage onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/leaves"
          element={
            isAuthenticated ? (
              <HolidaysAndLeaves onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
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

        {/* Catch-All */}
        <Route
          path="*"
          element={
            <Navigate
              to={
                isAuthenticated
                  ? isSuperAdmin
                    ? "/super-admin"
                    : isHR
                    ? "/hrdashboard"
                    : isAdmin
                    ? "/admin/tasks"
                    : "/dashboard"
                  : "/login"
              }
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
