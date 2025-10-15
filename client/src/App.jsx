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
import "./styles/custom-scrollbar.css";

// Achievement System
import { AchievementProvider } from "./contexts/AchievementContext";
import AchievementNotificationContainer from "./components/achievements/AchievementNotificationContainer";

// Notifications
import NotificationToast from "./components/NotificationToast";

// Redux
import { useDispatch } from "react-redux";
import { resetChat } from "./store/slices/chatSlice";

// Custom Hooks
import useGlobalChatNotifications from "./hooks/useGlobalChatNotifications";
import useWebSocket from "./hooks/useWebSocket";

// Browser Notifications
import notificationManager from "./utils/browserNotifications";

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
import HolidayManagementPage from "./pages/HolidayManagementPage";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminAttendancePortal from "./pages/SuperAdminAttendancePortal";
import ShiftManagement from "./components/humanResource/ShiftManagement";
import ManualAttendanceManagement from "./pages/admin/ManualAttendanceManagement";
import SalaryManagement from "./pages/admin/SalaryManagement";
import ClientsPage from "./pages/ClientsPage";
import ProjectsPage from "./pages/ProjectsPage";
import ClientPortal from "./pages/ClientPortal";
import EmployeePortal from "./pages/EmployeePortal";
import ProjectDetailPage from "./pages/ProjectDetailPage";
// Lead & Callback Management
import ViewLeads from "./pages/ViewLeads";
import AddLead from "./pages/AddLead";
import ViewCallbacks from "./pages/ViewCallbacks";
import AddCallback from "./pages/AddCallback";

// Notepad
import NotepadPage from "./pages/NotepadPage";
import SuperAdminNotepadViewer from "./pages/SuperAdminNotepadViewer";

// ------------------- Utility Functions -------------------
const normalizeRole = (role) => {
  if (!role) return "employee";
  const r = role.toLowerCase().replace(/\s+/g, "-");
  if (r === "superadmin" || r === "super-admin") return "super-admin";
  return r;
};

// ------------------- App Wrapper -------------------
const AppWrapper = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // Load user from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) setCurrentUser(JSON.parse(userStr));
  }, []);

  // Check authentication & role
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

  // Request browser notification permission when authenticated
  useEffect(() => {
    if (isAuthenticated && !loading) {
      // Request permission after a short delay to allow user interaction
      const timer = setTimeout(async () => {
        if (notificationManager.isSupported() && !notificationManager.isEnabled()) {
          const granted = await notificationManager.requestPermission();
          if (granted) {
            console.log("✅ Browser notifications enabled");
          } else {
            console.log("⚠️ Browser notifications denied");
          }
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, loading]);

  // Login handler
  const handleLoginSuccess = () => {
    const savedUser = JSON.parse(localStorage.getItem("user"));
    setCurrentUser(savedUser);
    setIsAuthenticated(true);
    setRole(normalizeRole(savedUser?.role));
    toast.success("✅ Login successful!");
  };

  // Logout handler
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

  // Global chat notifications
  useGlobalChatNotifications(localStorage.getItem("token"));

  // Handle WebSocket notifications
  const handleNotification = (notification) => {
    // Handle payslip notifications
    if (notification.channel === "payslip") {
      setNotifications(prev => [...prev, { ...notification, id: Date.now() }]);
    }

    // Handle task notifications - Show browser notifications
    if (notification.channel === "task") {
      // Show browser/PC notification
      if (notificationManager.isEnabled()) {
        notificationManager.showNotification(notification.title, {
          body: notification.body || notification.message,
          tag: `task-${notification.taskId}`,
          data: notification,
          icon: "/favicon.ico"
        });
      }

      // Also show in-app toast
      toast.info(`${notification.title}: ${notification.message}`);
    }

    // Handle chat notifications - Show browser notifications
    if (notification.channel === "chat") {
      // Show browser/PC notification
      if (notificationManager.isEnabled()) {
        notificationManager.showNotification(notification.title, {
          body: notification.body || notification.message,
          tag: `chat-${notification.from}`,
          data: notification,
          icon: "/favicon.ico"
        });
      }
    }
  };

  useWebSocket(handleNotification);

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Clear active conversation when leaving /messages
  useEffect(() => {
    if (location.pathname !== "/messages") {
      window.dispatchEvent(
        new CustomEvent("chat-active-conversation", { detail: { conversationId: null } })
      );
    }
  }, [location.pathname]);

  // Bridge WS notifications to toast globally and handle browser notifications
  useEffect(() => {
    window.toast = toast;

    const onWsNotification = (e) => {
      try {
        const n = e.detail || {};

        // Handle task notifications - Show browser notifications
        if (n.channel === "task") {
          // Show browser/PC notification
          if (notificationManager.isEnabled()) {
            notificationManager.showNotification(n.title, {
              body: n.body || n.message,
              tag: `task-${n.taskId}`,
              data: n,
              icon: "/favicon.ico"
            });
          }

          // Also show in-app toast
          const title = n.title || "Notification";
          const body = n.body || n.message || "";
          toast.info(`${title}: ${body}`, { toastId: `task-${Date.now()}` });
          return; // Don't show the generic toast below
        }

        // Handle chat notifications - Show browser notifications
        if ((n.channel || "").toLowerCase() === "chat") {
          // Show browser/PC notification
          if (notificationManager.isEnabled()) {
            notificationManager.showNotification(n.title, {
              body: n.body || n.message,
              tag: `chat-${n.from}`,
              data: n,
              icon: "/favicon.ico"
            });
          }

          // Update unread counter
          const prev = Number(sessionStorage.getItem("chat_unread_total") || 0) || 0;
          const next = prev + 1;
          sessionStorage.setItem("chat_unread_total", String(next));
          window.dispatchEvent(
            new CustomEvent("chat-unread-total", { detail: { total: next } })
          );

          // Show in-app toast
          const title = n.title || "Notification";
          const body = n.body || "";
          const tid = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          toast.info(`${title}: ${body}`, { toastId: tid });
          return; // Don't show the generic toast below
        }

        // Generic notification handling (for other channels like payslip)
        const title = n.title || "Notification";
        const body = n.body || "";
        const channel = n.channel ? ` [${n.channel}]` : "";
        const tid = `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        toast.info(`${title}${channel}: ${body}`, { toastId: tid });
      } catch {}
    };

    window.addEventListener("ws-notification", onWsNotification);
    return () => window.removeEventListener("ws-notification", onWsNotification);
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  // Role checks
  const roleNorm = normalizeRole(role);
  const isSuperAdmin = roleNorm === "super-admin";
  const isAdmin = roleNorm === "admin" || isSuperAdmin;
  const isHR = roleNorm === "hr";

  // Lead/Callback access
  const canAccessLeadManagement = () => {
    if (isSuperAdmin) return true;
    if (currentUser?.department === "marketingAndSales") return true;
    return false;
  };

  // ------------------- Routes -------------------
  return (
    <>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : role === "client" ? (
              <Navigate to="/client-portal" replace />
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

        {/* Super Admin */}
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
        <Route
          path="/super-admin/notepad"
          element={
            isAuthenticated && isSuperAdmin ? (
              <SuperAdminNotepadViewer onLogout={handleLogout} />
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

        {/* Chat */}
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

        {/* Lead Management */}
        <Route
          path="/leads"
          element={
            isAuthenticated && canAccessLeadManagement() ? (
              <ViewLeads onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />
        <Route
          path="/leads/add"
          element={
            isAuthenticated && canAccessLeadManagement() ? (
              <AddLead onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />
        <Route
          path="/leads/edit/:id"
          element={
            isAuthenticated && canAccessLeadManagement() ? (
              <AddLead onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Callback Management */}
        <Route
          path="/callbacks"
          element={
            isAuthenticated && canAccessLeadManagement() ? (
              <ViewCallbacks onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />
        <Route
          path="/callbacks/add"
          element={
            isAuthenticated && canAccessLeadManagement() ? (
              <AddCallback onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />
        <Route
          path="/callbacks/edit/:id"
          element={
            isAuthenticated && canAccessLeadManagement() ? (
              <AddCallback onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Salary/Payslip Management */}
        <Route
          path="/admin/salary-management"
          element={
            isAuthenticated && isSuperAdmin ? (
              <SalaryManagement onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Manual Attendance Management */}
        <Route
          path="/admin/manual-attendance"
          element={
            isAuthenticated && (isSuperAdmin || isHR || isAdmin) ? (
              <ManualAttendanceManagement onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Admin Task Assignment */}
        <Route
          path="/admin/tasks"
          element={
            isAuthenticated && (isSuperAdmin || isHR || isAdmin) ? (
              <AdminTaskPage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Admin Leave Requests */}
        <Route
          path="/admin/leaves"
          element={
            isAuthenticated && (isSuperAdmin || isHR || isAdmin) ? (
              <AdminLeaveRequests onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Shift Management */}
        <Route
          path="/admin/shifts"
          element={
            isAuthenticated && (isSuperAdmin || isHR || isAdmin) ? (
              <ShiftManagement onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Notice Board */}
        <Route
          path="/admin/notices"
          element={
            isAuthenticated && (isSuperAdmin || isHR || isAdmin) ? (
              <NoticeBoard onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Holiday Management */}
        <Route
          path="/admin/holidays"
          element={
            isAuthenticated && (isSuperAdmin || isHR || isAdmin) ? (
              <HolidayManagementPage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
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
            isAuthenticated && !isAdmin && !isHR && role !== "client" ? (
              <EmployeeDashboardPage onLogout={handleLogout} role={role} />
            ) : (
              <Navigate
                to={
                  isAuthenticated
                    ? role === "client"
                      ? "/client-portal"
                      : isAdmin
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
              <MyProfile onLogout={handleLogout} userType={role || "employee"} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Employee Pages */}
        <Route
          path="/employee/:id"
          element={
            isAuthenticated && (isAdmin || isHR) ? (
              <EmployeePage userRole={role} onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />
        <Route
          path="/tasks"
          element={isAuthenticated ? <Tasks onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/today-status"
          element={isAuthenticated ? <TodayStatusPage onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/attendance"
          element={isAuthenticated ? <AttendancePage onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/todo"
          element={isAuthenticated ? <TodoPage onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/leaves"
          element={isAuthenticated ? <HolidaysAndLeaves onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/directory"
          element={isAuthenticated ? <EmployeeDirectory onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/notepad"
          element={isAuthenticated ? <NotepadPage onLogout={handleLogout} /> : <Navigate to="/login" replace />}
        />

        {/* Client Management */}
        <Route
          path="/clients"
          element={
            isAuthenticated && isSuperAdmin ? (
              <ClientsPage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Project Management */}
        <Route
          path="/projects"
          element={
            isAuthenticated && isSuperAdmin ? (
              <ProjectsPage onLogout={handleLogout} />
            ) : (
              <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />
            )
          }
        />

        {/* Employee Portal */}
        <Route
          path="/employee-portal"
          element={
            isAuthenticated ? (
              <EmployeePortal onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Client Portal */}
        <Route
          path="/client-portal"
          element={
            isAuthenticated && role === "client" ? (
              <ClientPortal onLogout={handleLogout} clientId={currentUser?._id} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Project Detail Page */}
        <Route
          path="/project/:projectId"
          element={
            isAuthenticated ? (
              <ProjectDetailPage
                projectId={window.location.pathname.split('/').pop()}
                userRole={role}
                userId={currentUser?._id}
                onBack={() => window.history.back()}
              />
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
                  ? role === "client"
                    ? "/client-portal"
                    : isSuperAdmin
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

      {/* Payslip Notifications */}
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </>
  );
};

// ------------------- Main App -------------------
const App = () => (
  <Router>
    <AchievementProvider>
      <AppWrapper />
      <AchievementNotificationContainer />
    </AchievementProvider>
  </Router>
);

export default App;
