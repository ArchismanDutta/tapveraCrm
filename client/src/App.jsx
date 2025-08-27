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
import EmployeeDirectory from "./pages/EmployeeDirectory";
import EmployeePage from "./pages/EmployeePage";
import HRDashboard from "./pages/HRDashboard";

import { resetChat } from "./store/slices/chatSlice";
import { useDispatch } from "react-redux";

const AppWrapper = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const dispatch = useDispatch();

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) setCurrentUser(JSON.parse(userStr));
  }, []);

  // Load auth state and role on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    let storedRole = JSON.parse(userStr)?.role || localStorage.getItem("role");
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
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setCurrentUser(savedUser);
    setIsAuthenticated(true);
    setRole(savedUser?.role?.toLowerCase() || null);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  const isAdmin = role === "admin" || role === "super-admin";
  const isHR = role === "hr";

  return (
    <>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : isHR ? (
              <Navigate to="/hrdashboard" replace />
            ) : isAdmin ? (
              <Navigate to="/admin/tasks" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />

        {/* HR Dashboard */}
        <Route
          path="/hrdashboard"
          element={
            isAuthenticated && isHR ? (
              <HRDashboard onLogout={handleLogout} currentUser={currentUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* ChatPage / Messages - authenticated only */}
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

        {/* Signup - Admin/HR/Super Admin only */}
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

        {/* Employee Dashboard (non admin, non HR) */}
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

        {/* Profile - any authenticated user */}
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

        {/* Employee Page - Admin/HR/Super Admin only */}
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

        {/* Admin routes */}
        <Route
          path="/admin/tasks"
          element={
            isAuthenticated && isAdmin ? (
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
          path="/admin/employees"
          element={
            isAuthenticated && isAdmin ? (
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
            isAuthenticated && isAdmin ? (
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
            isAuthenticated && isAdmin ? (
              <NoticeBoard onLogout={handleLogout} />
            ) : (
              <Navigate
                to={isAuthenticated ? "/dashboard" : "/login"}
                replace
              />
            )
          }
        />

        {/* Employee pages accessible to any authenticated user */}
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
        {/* <Route
          path="*"
          element={
            <Navigate
              to={
                isAuthenticated
                  ? isHR
                    ? "/hrdashboard"
                    : isAdmin
                    ? "/admin/tasks"
                    : "/dashboard"
                  : "/login"
              }
              replace
            />
          }
        /> */}
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
