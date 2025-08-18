// src/pages/Signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthInput from "../components/AuthInput";
import tapveraLogo from "../assets/tapvera.png";
import { FaUser, FaEnvelope, FaPhone, FaLock } from "react-icons/fa";

const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    contact: "",
    dob: "",
    gender: "",
    department: "",
    designation: "",
    location: "India",
    password: "",
    // NEW FIELDS
    outlookEmail: "",
    outlookAppPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const requiredFields = ["name", "email", "contact", "dob", "gender", "password"];
    const isIncomplete = requiredFields.some((field) => !String(form[field] || "").trim());

    if (isIncomplete) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("role", data.user.role); // Recommended to store role explicitly

      navigate("/profile");
    } catch (err) {
      console.error("Signup Error:", err);
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-6">
      <img src={tapveraLogo} alt="Tapvera Logo" className="h-20 w-auto mb-6" />

      <div className="bg-surface rounded-xl shadow-lg shadow-[0_0_15px_rgba(255,153,0,0.4)] border border-border p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold text-textMain mb-5 text-center">Create an account</h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthInput
            label="Full Name"
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
            error={error && !form.name ? "Full Name is required." : ""}
            icon={FaUser}
          />

          <AuthInput
            label="Email Address"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter your email"
            autoComplete="email"
            required
            error={error && !form.email ? "Email is required." : ""}
            icon={FaEnvelope}
          />

          <AuthInput
            label="Contact Number"
            type="tel"
            name="contact"
            value={form.contact}
            onChange={handleChange}
            placeholder="Enter your contact number"
            autoComplete="tel"
            required
            error={error && !form.contact ? "Contact number is required." : ""}
            icon={FaPhone}
          />

          <div>
            <label htmlFor="dob" className="block text-sm text-textMuted mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              id="dob"
              name="dob"
              value={form.dob}
              onChange={handleChange}
              required
              max={new Date().toISOString().split("T")[0]}
              className={`w-full px-4 py-2 rounded-md bg-background border ${
                error && !form.dob ? "border-red-500" : "border-border"
              } text-textMain placeholder:text-textMuted focus:outline-none focus:border-primary transition`}
            />
            {error && !form.dob && (
              <p className="mt-1 text-xs text-red-500">Date of Birth is required.</p>
            )}
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm text-textMuted mb-1">
              Gender *
            </label>
            <select
              id="gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              required
              className={`w-full px-4 py-2 pr-10 rounded-md bg-background border ${
                error && !form.gender ? "border-red-500" : "border-border"
              } text-textMain focus:outline-none focus:border-primary appearance-none transition`}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg fill='%23000' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
                backgroundSize: "1.2em",
              }}
            >
              <option value="" disabled>
                Select your gender
              </option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
            {error && !form.gender && (
              <p className="mt-1 text-xs text-red-500">Please select your gender.</p>
            )}
          </div>

          <div>
            <label htmlFor="department" className="block text-sm text-textMuted mb-1">
              Department
            </label>
            <select
              id="department"
              name="department"
              value={form.department}
              onChange={handleChange}
              className="w-full px-4 py-2 pr-10 rounded-md bg-background border border-border text-textMain focus:outline-none focus:border-primary appearance-none transition"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg fill='%23000' height='24' viewBox='0_0_24_24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
                backgroundSize: "1.2em",
              }}
            >
              <option value="">Select a department</option>
              <option value="development">Development</option>
              <option value="marketingAndSales">Marketing & Sales</option>
              <option value="humanResource">Human Resource</option>
            </select>
          </div>

          <div>
            <label htmlFor="designation" className="block text-sm text-textMuted mb-1">
              Designation
            </label>
            <input
              type="text"
              id="designation"
              name="designation"
              value={form.designation}
              onChange={handleChange}
              placeholder="Enter your designation"
              className="w-full px-4 py-2 rounded-md bg-background border border-border text-textMain placeholder:text-textMuted focus:outline-none focus:border-primary transition"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm text-textMuted mb-1">
              Location
            </label>
            <input
              type="text"
              id="location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Enter your location"
              className="w-full px-4 py-2 rounded-md bg-background border border-border text-textMain placeholder:text-textMuted focus:outline-none focus:border-primary transition"
            />
          </div>

          <AuthInput
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a password"
            autoComplete="new-password"
            required
            error={error && !form.password ? "Password is required." : ""}
            showTogglePassword={true}
            icon={FaLock}
          />

          {/* Optional per-user credentials */}
          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-lg font-semibold text-textMain mb-2">
              Optional: Email Sending Setup
            </h3>
            <p className="text-sm text-textMuted mb-3">
              Add your work email and app password to send emails from your own account (encrypted and stored securely).
            </p>

            <AuthInput
              label="Work Email (Outlook/Gmail)"
              type="email"
              name="outlookEmail"
              value={form.outlookEmail}
              onChange={handleChange}
              placeholder="Enter your work email"
              icon={FaEnvelope}
            />

            <AuthInput
              label="Email App Password"
              type="password"
              name="outlookAppPassword"
              value={form.outlookAppPassword}
              onChange={handleChange}
              placeholder="Enter your email app password"
              showTogglePassword={true}
              icon={FaLock}
            />

            <p className="text-xs text-textMuted mt-2">
              We recommend creating an <span className="font-semibold">App Password</span> from your email provider’s security settings.
              This will be encrypted before storage.
            </p>
          </div>

          {error && <div className="text-sm text-red-500 text-center">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-yellow-300 hover:bg-orange-500 hover:text-white transition text-background font-semibold shadow focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-4 text-center text-textMuted text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:text-orangeDark">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
};

export default Signup;
