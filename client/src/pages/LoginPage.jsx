import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import AuthInput from "../components/AuthInput";
import tapveraLogo from "../assets/tapvera.png";
import { FaEnvelope, FaLock } from "react-icons/fa";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const Login = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle input change
  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!form.email || !form.password) {
      setError("Please enter both email and password.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      console.log("Login response:", data);

      if (!res.ok) {
        setError(data.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Save token & user info
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("role", data.user.role);

      // Role-based navigation
      const role = data.user.role?.toLowerCase();
      if (role === "admin" || role === "super-admin") {
        navigate("/admin/tasks");
      } else {
        navigate("/dashboard");
      }

      if (onLoginSuccess) onLoginSuccess(data.token);
    } catch (err) {
      console.error("Login Error:", err);
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#141a29] via-[#181d2a] to-[#1b2233] px-4 py-8">
      {/* Logo */}
      <img
        src={tapveraLogo}
        alt="Tapvera Logo"
        className="h-24 w-auto mb-6 drop-shadow-[0_0_6px_rgba(255,128,0,0.75)]"
      />

      <div className="bg-[#181d2a]/80 backdrop-blur-xl rounded-xl shadow-lg p-8 w-full max-w-md border border-white">
        <h2 className="text-2xl font-bold text-[#ff8000] mb-6 text-center">
          Log in to your account
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <AuthInput
            label="Email Address"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            autoComplete="username"
            required
            error={error && !form.email ? "Email is required." : ""}
            icon={FaEnvelope}
            className="bg-[#141a29] border border-white text-blue-100 placeholder-blue-500 focus:ring-2 focus:ring-[#ff8000] focus:border-[#ff8000]"
          />

          <AuthInput
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            error={error && !form.password ? "Password is required." : ""}
            showTogglePassword
            icon={FaLock}
            className="bg-[#141a29] border border-white text-blue-100 placeholder-blue-500 focus:ring-2 focus:ring-[#ff8000] focus:border-[#ff8000]"
          />

          {error && (
            <div className="text-sm text-red-500 bg-[#3b1a1a] border border-red-700 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-[#ff8000] hover:bg-[#ff9500] transition text-black font-semibold shadow focus:ring-2 focus:ring-[#ff9c33] focus:ring-offset-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-blue-400 text-sm">
            Forgot your password?
            <a
              href="/forgot-password"
              className="ml-2 text-[#ff8000] hover:underline"
            >
              Click here
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};

Login.propTypes = {
  onLoginSuccess: PropTypes.func,
};

export default Login;
