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
    jobLevel: "junior",
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
    shiftType: "standard",
    shift: { start: "09:00", end: "18:00" },
  });

  const [skillsInput, setSkillsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const savedRole =
      JSON.parse(localStorage.getItem("user"))?.role ||
      localStorage.getItem("role");
    if (savedRole) setRole(savedRole.toLowerCase());
    else navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (role && !["hr", "admin", "super-admin"].includes(role)) {
      toast.error(
        "Access denied. Only HR/Admin/Super Admin can register employees."
      );
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
      qualifications: [
        ...prev.qualifications,
        { school: "", degree: "", marks: "", year: "" },
      ],
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

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    if (sh === eh && sm === em) return false;

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const requiredFields = [
      "employeeId",
      "name",
      "email",
      "contact",
      "dob",
      "gender",
      "password",
      "doj",
    ];
    const isIncomplete = requiredFields.some(
      (field) => !String(form[field] || "").trim()
    );
    if (isIncomplete) {
      toast.error("⚠️ Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (form.shiftType === "standard") {
      if (!form.shift?.start || !form.shift?.end) {
        toast.error(
          "Please provide both shift start and end times for Standard shift."
        );
        setLoading(false);
        return;
      }
      if (!validateTimeOrder(form.shift.start, form.shift.end)) {
        toast.error("Shift end time must not be the same as start time.");
        setLoading(false);
        return;
      }
    }

    const skillsArray = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const validQualifications = form.qualifications.filter(
      (q) => q.school || q.degree || q.marks || q.year
    );

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

    if (form.shiftType === "standard") {
  // Use Date of Joining as base date (or any reference date)
  const baseDate = form.doj ? new Date(form.doj) : new Date();

  const [sh, sm] = form.shift.start.split(":").map(Number);
  const [eh, em] = form.shift.end.split(":").map(Number);

  // Create ISO timestamps
  const arrivalDate = new Date(baseDate);
  arrivalDate.setHours(sh, sm, 0, 0); // set start time

  const departureDate = new Date(baseDate);
  departureDate.setHours(eh, em, 0, 0); // set end time

  // If end is before start, assume next day
  if (departureDate <= arrivalDate) {
    departureDate.setDate(departureDate.getDate() + 1);
  }

  payload.shift = {
    arrivalTime: arrivalDate.toISOString(),
    departureTime: departureDate.toISOString(),
    durationHours: Math.round(
      (departureDate - arrivalDate) / (1000 * 60 * 60)
    ),
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
        const msg =
          data?.message ||
          (data?.errors && data.errors[0]?.msg) ||
          "Something went wrong.";
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

  // DARK THEME CLASSES - update ONLY UI theme
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#151a22] px-4 py-6">
      <img
        src={tapveraLogo}
        alt="Tapvera Logo"
        className="h-20 w-auto mb-6 mx-auto"
      />
      <div className="bg-[#222731] rounded-2xl shadow-lg border border-[#222531] p-8 w-full max-w-lg space-y-7">
        <h2 className="text-3xl font-bold text-white mb-4 text-center">
          Employee Registration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
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
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c] focus:border-orange-500"
              labelClass="text-gray-300"
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
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c] focus:border-orange-500"
              labelClass="text-gray-300"
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
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c] focus:border-orange-500"
              labelClass="text-gray-300"
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
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c] focus:border-orange-500"
              labelClass="text-gray-300"
            />
          </div>

          {/* DOB & Gender */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Date of Birth *
              </label>
              <input
                type="date"
                name="dob"
                value={form.dob}
                max={todayISO}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Gender *
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
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
              <label className="block text-sm text-gray-400 mb-1">
                Department
              </label>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
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
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c] focus:border-orange-500"
              labelClass="text-gray-300"
            />
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Job Level
              </label>
              <select
                name="jobLevel"
                value={form.jobLevel}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
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
            className="bg-[#232831] text-[#f7f9fa] border-[#31353c] focus:border-orange-500"
            labelClass="text-gray-300"
          />

          {/* Optional Personal Info */}
          <div className="space-y-3">
            <AuthInput
              label="Blood Group"
              type="text"
              name="bloodGroup"
              value={form.bloodGroup}
              onChange={handleChange}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
            <AuthInput
              label="Permanent Address"
              type="text"
              name="permanentAddress"
              value={form.permanentAddress}
              onChange={handleChange}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
            <AuthInput
              label="Current Address"
              type="text"
              name="currentAddress"
              value={form.currentAddress}
              onChange={handleChange}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
            <AuthInput
              label="Emergency Number"
              type="tel"
              name="emergencyNo"
              value={form.emergencyNo}
              onChange={handleChange}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
            <AuthInput
              label="P.S."
              type="text"
              name="ps"
              value={form.ps}
              onChange={handleChange}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
          </div>

          {/* Joining & Salary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Date of Joining *
              </label>
              <input
                type="date"
                name="doj"
                value={form.doj}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                required
              />
            </div>
            <AuthInput
              label="Salary"
              type="number"
              name="salary"
              value={form.salary}
              onChange={handleChange}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
          </div>

          <AuthInput
            label="Reference"
            type="text"
            name="ref"
            value={form.ref}
            onChange={handleChange}
            className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
            labelClass="text-gray-300"
          />

          {/* Status & Total PL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
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
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
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
            className="bg-[#232831] text-[#f7f9fa] border-[#31353c] focus:border-orange-500"
            labelClass="text-gray-300"
          />

          {/* Employment Type & Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Employment Type
              </label>
              <select
                name="employmentType"
                value={form.employmentType}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
              >
                <option value="full-time">Full-Time</option>
                <option value="part-time">Part-Time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Skills (comma separated)
              </label>
              <input
                type="text"
                name="skills"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                placeholder="e.g. JavaScript, React, Node.js"
                className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
              />
            </div>
          </div>

          {/* SHIFT: only two choices */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Shift Type
            </label>
            <select
              name="shiftType"
              value={form.shiftType}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
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
                <label className="block text-sm text-gray-400 mb-1">
                  Shift Start
                </label>
                <input
                  type="time"
                  value={form.shift.start}
                  onChange={(e) => handleShiftChange("start", e.target.value)}
                  className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Shift End
                </label>
                <input
                  type="time"
                  value={form.shift.end}
                  onChange={(e) => handleShiftChange("end", e.target.value)}
                  className="w-full px-4 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                />
              </div>
            </div>
          )}

          {/* Qualifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Qualification Details
            </h3>
            {form.qualifications.map((q, index) => (
              <div
                key={index}
                className="border border-[#31353c] rounded-lg p-4 bg-[#1b1f26] space-y-3 relative"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-200">
                    Qualification {index + 1}
                  </span>
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
                    className="w-full px-3 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                  />
                  <input
                    type="text"
                    value={q.degree}
                    onChange={(e) =>
                      handleQualificationChange(index, "degree", e.target.value)
                    }
                    placeholder="Degree/Certification"
                    className="w-full px-3 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                  />
                  <input
                    type="text"
                    value={q.marks}
                    onChange={(e) =>
                      handleQualificationChange(index, "marks", e.target.value)
                    }
                    placeholder="Marks/Percentage"
                    className="w-full px-3 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                  />
                  <input
                    type="number"
                    value={q.year}
                    onChange={(e) =>
                      handleQualificationChange(index, "year", e.target.value)
                    }
                    placeholder="Year of Passing"
                    className="w-full px-3 py-2 bg-[#232831] text-[#f7f9fa] border border-[#31353c] rounded-md"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addQualification}
              className="text-orange-400 hover:underline text-sm"
            >
              + Add Qualification
            </button>
          </div>

          {/* Optional Email Setup */}
          <div className="mt-6 pt-4 border-t border-[#31353c] space-y-3">
            <h3 className="text-lg font-semibold text-white">
              Optional: Email Setup
            </h3>
            <AuthInput
              label="Work Email"
              type="email"
              name="outlookEmail"
              value={form.outlookEmail}
              onChange={handleChange}
              icon={FaEnvelope}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
            <AuthInput
              label="Email App Password"
              type="password"
              name="outlookAppPassword"
              value={form.outlookAppPassword}
              onChange={handleChange}
              showTogglePassword
              icon={FaLock}
              className="bg-[#232831] text-[#f7f9fa] border-[#31353c]"
              labelClass="text-gray-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-[#ff9800] hover:bg-[#ffa726] hover:text-white transition text-[#232831] font-semibold shadow disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Register Employee"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;
