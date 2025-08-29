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

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

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
      if (!res.ok) {
        setError(data.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("role", data.user.role);

      const role = data.user.role?.toLowerCase();
      if (role === "admin" || role === "super-admin") {
        navigate("/admin/tasks");
      } else {
        navigate("/dashboard");
      }

      onLoginSuccess(data.token);
    } catch (err) {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f121a] via-[#141a1f] to-[#181d26] px-4 py-8">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-8 border border-white/20">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={tapveraLogo}
            alt="Tapvera Logo"
            className="h-20 w-auto mb-3 drop-shadow-[0_0_8px_rgba(255,128,0,0.6)]"
          />
          <h1 className="text-2xl md:text-3xl font-bold text-center text-white tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-400 mt-1 text-center">
            Log in to continue to your account
          </p>
        </div>

        {/* Form */}
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
            className="bg-[#10141c] border border-white/20 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ff8000] focus:border-[#ff8000]"
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
            showTogglePassword={true}
            icon={FaLock}
            className="bg-[#10141c] border border-white/20 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ff8000] focus:border-[#ff8000]"
          />

          {error && (
            <div className="text-sm text-red-400 bg-red-900/40 border border-red-700 p-2 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#ff8000] hover:bg-[#ff9500] transition text-black font-semibold shadow-md focus:ring-4 focus:ring-[#ff9c33]/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <span className="text-gray-400 text-sm">
            Forgot your password?
            <a
              href="/forgot-password"
              className="ml-2 text-[#ff8000] font-medium hover:underline"
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
  onLoginSuccess: PropTypes.func.isRequired,
};

export default Login;
