import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/LoginPage';
import Signup from './pages/SignUp';
import EmployeeDashboardPage from './pages/EmployeeDashboard';

const App = () => {
  // Toggle this for development/demo purposes
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  const handleLogout = () => {
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
              <Login onLoginSuccess={() => setIsAuthenticated(true)} />
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
              <Signup onSignupSuccess={() => setIsAuthenticated(true)} />
            )
          }
        />

        {/* Dashboard Page */}
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

        {/* Redirect any unknown route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
