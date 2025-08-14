import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import tapveraLogo from "../assets/tapvera.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { userId, token } = useParams(); // ✅ Matches /reset-password/:userId/:token

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match!");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/auth/reset-password/${userId}/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Error resetting password.");
      } else {
        alert("Password reset successful! Please log in.");
        navigate("/login");
      }
    } catch (err) {
      console.error("Reset Password Error:", err);
      setError("Server error, please try again.");
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
          <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>

          {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-3 border border-black-500 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full p-3 border border-black-500 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-300"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-md bg-yellow-200 hover:bg-white-500 transition text-background font-semibold shadow focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
