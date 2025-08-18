import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

// Pages
import Login from "./pages/LoginPage";
import Signup from "./pages/SignUp"; // ← fixed
import EmployeeDashboardPage from "./pages/EmployeeDashboard";
import MyProfile from "./pages/MyProfile";
import Tasks from "./pages/Tasks";
import AdminTaskPage from "./pages/AdminTaskPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import EmployeeManagementPage from "./pages/EmployeeManagement";

const AppWrapper = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    let storedRole =
      JSON.parse(localStorage.getItem("user"))?.role ||
      localStorage.getItem("role");

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
    setIsAuthenticated(false);
    setRole(null);
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
    <Routes>
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

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route
        path="/dashboard"
        element={
          isAuthenticated && role !== "admin" && role !== "super-admin" ? (
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
        path="/profile"
        element={
          isAuthenticated ? (
            <MyProfile onLogout={handleLogout} userType={role || "employee"} />
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
      <Route
        path="/admin/employees"
        element={
          isAuthenticated && (role === "admin" || role === "super-admin") ? (
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
