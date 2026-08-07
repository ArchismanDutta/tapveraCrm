import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import AuthInput from "../components/AuthInput";
import tapveraLogo from "../assets/tapvera.png";
import { FaEnvelope, FaLock, FaMapMarkerAlt } from "react-icons/fa";
// Geofenced login (2026-08-07)
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
import { getCurrentCoordinates, GeolocationError } from "../utils/geolocation";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const Login = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set only while the browser is resolving a fix, so the button can say
  // "Checking your location..." rather than sitting on "Logging in..." for the
  // ten-plus seconds a cold GPS lock can take. An unexplained pause of that
  // length reads as a hang, and people press the button again.
  const [locating, setLocating] = useState(false);

  // Handle input change
  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const postLogin = (payload) =>
    fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
      // Attempt 1 — no coordinates.
      //
      // This ordering is the reason the vast majority of people never see a
      // location permission prompt at all. Only the server knows whether an
      // account is geofenced, and only after the password is verified. Asking
      // the browser for a location up front would prompt every client, every
      // super-admin and every unfenced employee for a permission that will
      // never be read. So we ask first and let the server tell us if it
      // actually needs a location.
      let res = await postLogin(form);
      let data = await res.json();

      // 428 Precondition Required = "this account is fenced, send coordinates
      // and retry". Distinct from a 403 refusal, where retrying is pointless.
      if (res.status === 428) {
        setLocating(true);
        let coordinates;
        try {
          coordinates = await getCurrentCoordinates();
        } catch (geoErr) {
          setError(
            geoErr instanceof GeolocationError
              ? geoErr.message
              : "Could not read your location. Enable location services and try again."
          );
          return;
        } finally {
          setLocating(false);
        }

        // Attempt 2 — same credentials, now with a fix.
        res = await postLogin({ ...form, coordinates });
        data = await res.json();
      }

      if (!res.ok) {
        setError(data.message || "Invalid email or password.");
        return;
      }

      if (!data?.token || !data?.user?.role) {
        setError("The server returned an incomplete login response.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("role", data.user.role);

      const role = data.user.role?.toLowerCase();
      // Redirect based on user role
      if (role === "client") {
        navigate("/client-portal");
      } else if (role === "admin" || role === "super-admin") {
        navigate("/admin/tasks");
      } else {
        navigate("/dashboard");
      }

      if (onLoginSuccess) onLoginSuccess(data.token);
    } catch {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
      setLocating(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-[#0f121a] via-[#141a1f] to-[#181d26] px-4 py-8">
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
            showTogglePassword
            icon={FaLock}
            className="bg-[#10141c] border border-white/20 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#ff8000] focus:border-[#ff8000]"
          />

          {/* Only ever rendered for a geofenced account mid-retry — see the
              two-attempt flow in handleSubmit. Without it the browser's own
              permission prompt appears with no explanation of who asked or
              why, which is when people reflexively hit Block. */}
          {locating && (
            <div className="flex items-center gap-2 rounded-lg border border-[#ff8000]/40 bg-[#ff8000]/10 p-3 text-sm text-[#ffb366]">
              <FaMapMarkerAlt className="shrink-0" />
              <span>
                Your account is restricted to approved locations. Allow location
                access to continue.
              </span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-center text-sm font-medium text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#ff8000] hover:bg-[#ff9500] transition text-black font-semibold shadow-md focus:ring-4 focus:ring-[#ff9c33]/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {locating ? "Checking your location..." : loading ? "Logging in..." : "Log In"}
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
  onLoginSuccess: PropTypes.func,
};

export default Login;
