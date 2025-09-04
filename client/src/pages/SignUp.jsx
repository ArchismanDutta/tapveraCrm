// src/pages/Signup.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthInput from "../components/AuthInput";
import tapveraLogo from "../assets/tapvera.png";
import { FaUser, FaEnvelope, FaPhone, FaLock } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    email: "",
    contact: "",
    dob: "",
    gender: "",
    department: "",
    designation: "",
    jobLevel: "junior", // backend enum: intern|junior|mid|senior|lead|director|executive
    location: "India",
    password: "",
    bloodGroup: "",
    permanentAddress: "",
    currentAddress: "",
    emergencyNo: "",
    ps: "",
    doj: "",
    salary: "",
    ref: "",
    status: "active",
    totalPl: 0,
    outlookEmail: "",
    outlookAppPassword: "",
    employmentType: "full-time",
    qualifications: [{ school: "", degree: "", marks: "", year: "" }],
    // Only two choices presented to the user:
    // "standard" (fixed shift) and "flexiblePermanent" (permanent flexible)
    shiftType: "standard",
    shift: { start: "09:00", end: "18:00" },
  });

  const [skillsInput, setSkillsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const savedRole =
      JSON.parse(localStorage.getItem("user"))?.role || localStorage.getItem("role");
    if (savedRole) setRole(savedRole.toLowerCase());
    else navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (role && !["hr", "admin", "super-admin"].includes(role)) {
      toast.error("Access denied. Only HR/Admin/Super Admin can register employees.");
      navigate("/login");
    }
  }, [role, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQualificationChange = (index, field, value) => {
    const updated = [...form.qualifications];
    updated[index][field] = value;
    setForm((prev) => ({ ...prev, qualifications: updated }));
  };

  const addQualification = () => {
    setForm((prev) => ({
      ...prev,
      qualifications: [...prev.qualifications, { school: "", degree: "", marks: "", year: "" }],
    }));
  };

  const removeQualification = (index) => {
    const updated = form.qualifications.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, qualifications: updated }));
  };

  const handleShiftChange = (field, value) => {
    setForm((prev) => ({ ...prev, shift: { ...prev.shift, [field]: value } }));
  };

  const validateTimeOrder = (start, end) => {
    if (!start || !end) return false;
    // "HH:MM" -> compare strings or convert to minutes
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return eh > sh || (eh === sh && em > sm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Required basic fields
    const requiredFields = ["employeeId", "name", "email", "contact", "dob", "gender", "password", "doj"];
    const isIncomplete = requiredFields.some((field) => !String(form[field] || "").trim());
    if (isIncomplete) {
      toast.error("⚠️ Please fill in all required fields.");
      setLoading(false);
      return;
    }

    // If standard shift, require valid start and end times
    if (form.shiftType === "standard") {
      if (!form.shift?.start || !form.shift?.end) {
        toast.error("Please provide both shift start and end times for Standard shift.");
        setLoading(false);
        return;
      }
      if (!validateTimeOrder(form.shift.start, form.shift.end)) {
        toast.error("Shift end time must be after start time.");
        setLoading(false);
        return;
      }
    }

    // Skills array
    const skillsArray = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Filter out empty qualification entries
    const validQualifications = form.qualifications.filter(
      (q) => (q.school || q.degree || q.marks || q.year)
    );

    // Build payload
    const payload = {
      employeeId: String(form.employeeId).trim(),
      name: String(form.name).trim(),
      email: String(form.email).toLowerCase().trim(),
      contact: String(form.contact).trim(),
      dob: form.dob || null,
      gender: form.gender,
      department: form.department || "",
      designation: form.designation || "",
      jobLevel: form.jobLevel || "junior",
      location: form.location || "India",
      password: form.password || "Welcome123",
      bloodGroup: form.bloodGroup || "",
      permanentAddress: form.permanentAddress || "",
      currentAddress: form.currentAddress || "",
      emergencyContact: form.emergencyNo || "",
      ps: form.ps || "",
      doj: form.doj || null,
      salary: form.salary || 0,
      ref: form.ref || "",
      status: form.status || "active",
      totalPl: Number(form.totalPl) || 0,
      outlookEmail: form.outlookEmail || "",
      outlookAppPassword: form.outlookAppPassword || "",
      employmentType: form.employmentType || "full-time",
      qualifications: validQualifications,
      skills: skillsArray,
      shiftType: form.shiftType || "standard",
    };

    // Only attach shift when standard (backend expects shift for standard)
    if (form.shiftType === "standard") {
      payload.shift = {
        start: form.shift.start,
        end: form.shift.end,
        durationHours: (() => {
          const [sh, sm] = form.shift.start.split(":").map(Number);
          const [eh, em] = form.shift.end.split(":").map(Number);
          let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
          if (diffMinutes <= 0) diffMinutes += 24 * 60; // wrap-around safety
          return Math.round(diffMinutes / 60);
        })(),
      };
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("No auth token found. Please login again.");
        navigate("/login");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        // Prefer human-friendly messages
        const msg = data?.message || (data?.errors && data.errors[0]?.msg) || "Something went wrong.";
        toast.error(msg);
        setLoading(false);
        return;
      }

      toast.success("✅ Employee registered successfully!");
      navigate("/directory");
    } catch (err) {
      console.error("Signup Error:", err);
      toast.error("❌ Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const todayISO = new Date().toISOString().split("T")[0];

  if (!["hr", "admin", "super-admin"].includes(role)) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-6">
      <img src={tapveraLogo} alt="Tapvera Logo" className="h-20 w-auto mb-6" />
      <div className="bg-surface rounded-xl shadow-lg border border-border p-6 w-full max-w-lg space-y-6">
        <h2 className="text-2xl font-bold text-textMain mb-4 text-center">
          Employee Registration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Basic Info */}
          <div className="space-y-3">
            <AuthInput
              label="Employee ID *"
              type="text"
              name="employeeId"
              value={form.employeeId}
              onChange={handleChange}
              placeholder="Enter employee ID"
              required
              icon={FaUser}
            />
            <AuthInput
              label="Full Name *"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter full name"
              required
              icon={FaUser}
            />
            <AuthInput
              label="Email Address *"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter email"
              required
              icon={FaEnvelope}
            />
            <AuthInput
              label="Contact Number *"
              type="tel"
              name="contact"
              value={form.contact}
              onChange={handleChange}
              placeholder="Enter contact number"
              required
              icon={FaPhone}
            />
          </div>

          {/* DOB & Gender */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                name="dob"
                value={form.dob}
                max={todayISO}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">
                Gender *
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-md"
                required
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Department / Designation / Job Level */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">
                Department
              </label>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-md"
              >
                <option value="">Select a department</option>
                <option value="development">Development</option>
                <option value="marketingAndSales">Marketing & Sales</option>
                <option value="humanResource">Human Resource</option>
              </select>
            </div>

            <AuthInput
              label="Designation"
              type="text"
              name="designation"
              value={form.designation}
              onChange={handleChange}
              placeholder="Enter designation"
            />

            <div>
              <label className="block text-sm text-textMuted mb-1">
                Job Level
              </label>
              <select
                name="jobLevel"
                value={form.jobLevel}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-md"
              >
                <option value="intern">Intern</option>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="director">Director</option>
                <option value="executive">Executive</option>
              </select>
            </div>
          </div>

          <AuthInput
            label="Location"
            type="text"
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Enter location"
          />

          {/* Optional Personal Info */}
          <div className="space-y-3">
            <AuthInput
              label="Blood Group"
              type="text"
              name="bloodGroup"
              value={form.bloodGroup}
              onChange={handleChange}
            />
            <AuthInput
              label="Permanent Address"
              type="text"
              name="permanentAddress"
              value={form.permanentAddress}
              onChange={handleChange}
            />
            <AuthInput
              label="Current Address"
              type="text"
              name="currentAddress"
              value={form.currentAddress}
              onChange={handleChange}
            />
            <AuthInput
              label="Emergency Number"
              type="tel"
              name="emergencyNo"
              value={form.emergencyNo}
              onChange={handleChange}
            />
            <AuthInput
              label="P.S."
              type="text"
              name="ps"
              value={form.ps}
              onChange={handleChange}
            />
          </div>

          {/* Joining & Salary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">
                Date of Joining *
              </label>
              <input
                type="date"
                name="doj"
                value={form.doj}
                max={todayISO}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-md"
                required
              />
            </div>
            <AuthInput
              label="Salary"
              type="number"
              name="salary"
              value={form.salary}
              onChange={handleChange}
            />
          </div>

          <AuthInput
            label="Reference"
            type="text"
            name="ref"
            value={form.ref}
            onChange={handleChange}
          />

          {/* Status & Total PL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">
                Status
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-md"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <AuthInput
              label="Total PL"
              type="number"
              name="totalPl"
              value={form.totalPl}
              onChange={handleChange}
            />
          </div>

          <AuthInput
            label="Password *"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a password"
            autoComplete="new-password"
            required
            showTogglePassword
            icon={FaLock}
          />

          {/* Employment Type & Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-textMuted mb-1">
                Employment Type
              </label>
              <select
                name="employmentType"
                value={form.employmentType}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-border rounded-md"
              >
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-textMuted mb-1">
                Skills (comma separated)
              </label>
              <input
                type="text"
                name="skills"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="e.g. JavaScript, React, Node.js"
                className="w-full px-4 py-2 border border-border rounded-md"
              />
            </div>
          </div>

          {/* SHIFT: only two choices */}
          <div>
            <label className="block text-sm text-textMuted mb-1">
              Shift Type
            </label>
            <select
              name="shiftType"
              value={form.shiftType}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-border rounded-md"
            >
              <option value="standard">Standard Shift</option>
              <option value="flexiblePermanent">
                Permanent Flexible Shift
              </option>
            </select>
          </div>

          {/* Shift Timing only if Standard */}
          {form.shiftType === "standard" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-sm text-textMuted mb-1">
                  Shift Start
                </label>
                <input
                  type="time"
                  value={form.shift.start}
                  onChange={(e) => handleShiftChange("start", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-textMuted mb-1">
                  Shift End
                </label>
                <input
                  type="time"
                  value={form.shift.end}
                  onChange={(e) => handleShiftChange("end", e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-md"
                />
              </div>
            </div>
          )}

          {/* Qualifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-textMain">
              Qualification Details
            </h3>
            {form.qualifications.map((q, index) => (
              <div
                key={index}
                className="border border-border rounded-lg p-4 bg-backgroundAlt space-y-3 relative"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Qualification {index + 1}</span>
                  {form.qualifications.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQualification(index)}
                      className="text-red-500 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={q.school}
                    onChange={(e) =>
                      handleQualificationChange(index, "school", e.target.value)
                    }
                    placeholder="School/University"
                    className="w-full px-3 py-2 border border-border rounded-md"
                  />
                  <input
                    type="text"
                    value={q.degree}
                    onChange={(e) =>
                      handleQualificationChange(index, "degree", e.target.value)
                    }
                    placeholder="Degree/Certification"
                    className="w-full px-3 py-2 border border-border rounded-md"
                  />
                  <input
                    type="text"
                    value={q.marks}
                    onChange={(e) =>
                      handleQualificationChange(index, "marks", e.target.value)
                    }
                    placeholder="Marks/Percentage"
                    className="w-full px-3 py-2 border border-border rounded-md"
                  />
                  <input
                    type="number"
                    value={q.year}
                    onChange={(e) =>
                      handleQualificationChange(index, "year", e.target.value)
                    }
                    placeholder="Year of Passing"
                    className="w-full px-3 py-2 border border-border rounded-md"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addQualification}
              className="text-primary underline text-sm"
            >
              + Add Qualification
            </button>
          </div>

          {/* Optional Email Setup */}
          <div className="mt-6 pt-4 border-t border-border space-y-3">
            <h3 className="text-lg font-semibold text-textMain">
              Optional: Email Setup
            </h3>
            <AuthInput
              label="Work Email"
              type="email"
              name="outlookEmail"
              value={form.outlookEmail}
              onChange={handleChange}
              icon={FaEnvelope}
            />
            <AuthInput
              label="Email App Password"
              type="password"
              name="outlookAppPassword"
              value={form.outlookAppPassword}
              onChange={handleChange}
              showTogglePassword
              icon={FaLock}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2 rounded-md bg-yellow-300 hover:bg-orange-500 hover:text-white transition text-background font-semibold shadow disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Register Employee"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;
