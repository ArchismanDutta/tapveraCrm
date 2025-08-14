import React, { useState } from "react";
import tapveraLogo from "../assets/tapvera.png"; // Adjust path if needed

export default function ForgetPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong");
      } else {
        setMessage("Password reset link sent to your email if it exists in our system.");
        setEmail("");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Server error, please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-yellow-50 p-4">
      <div className="flex flex-col items-center">
        {/* Logo above the box */}
        <img
          src={tapveraLogo}
          alt="Tapvera Logo"
          className="mb-6 w-40 h-auto"
        />

        {/* Card */}
        <div className="bg-gradient-to-b from-yellow-300 to-orange-400 shadow-lg rounded-lg p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-4">
            Forgot Password
          </h1>
          <p className="text-black-600 text-center mb-6">
            Enter your email to receive a password reset link.
          </p>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
          {message && <p className="text-green-700 text-sm mb-4">{message}</p>}

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full border border-black-500 rounded-md px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-md bg-yellow-200 hover:bg-white-500 transition text-background font-semibold shadow focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
