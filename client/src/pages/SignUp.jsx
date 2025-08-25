import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthInput from "../components/AuthInput";
import tapveraLogo from "../assets/tapvera.png";
import { FaUser, FaEnvelope, FaPhone, FaLock } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

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
  });

  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(null);

  // ✅ Restrict access to HR/Admin/Superadmin
  useEffect(() => {
    const savedRole = JSON.parse(localStorage.getItem("user"))?.role || localStorage.getItem("role");
    if (savedRole) {
      setRole(savedRole.toLowerCase());
    } else {
      navigate("/login");
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Required fields validation
    const requiredFields = ["employeeId", "name", "email", "contact", "dob", "gender", "password", "doj"];
    const isIncomplete = requiredFields.some((field) => !String(form[field] || "").trim());

    if (isIncomplete) {
      toast.error("⚠️ Please fill in all required fields.");
      setLoading(false);
      return;
    }

    const payload = { ...form, totalPl: Number(form.totalPl), salary: Number(form.salary) };

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("No auth token found. Please login again.");
        navigate("/login");
        return;
      }

      const res = await fetch(`${API_BASE}/users/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (Array.isArray(data?.errors) && data.errors.length > 0) {
          toast.error(data.errors[0].msg || "Validation error.");
        } else {
          toast.error(data.message || "Something went wrong.");
        }
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

  if (!["hr", "admin", "super-admin"].includes(role)) return null; // hide page until role loaded

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-6">
      <img src={tapveraLogo} alt="Tapvera Logo" className="h-20 w-auto mb-6" />

      <div className="bg-surface rounded-xl shadow-lg shadow-[0_0_15px_rgba(255,153,0,0.4)] border border-border p-6 w-full max-w-lg">
        <h2 className="text-2xl font-bold text-textMain mb-5 text-center">
          Employee Registration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <AuthInput label="Employee ID *" type="text" name="employeeId" value={form.employeeId} onChange={handleChange} placeholder="Enter employee ID" required icon={FaUser} />
          <AuthInput label="Full Name *" type="text" name="name" value={form.name} onChange={handleChange} placeholder="Enter full name" required icon={FaUser} />
          <AuthInput label="Email Address *" type="email" name="email" value={form.email} onChange={handleChange} placeholder="Enter email" autoComplete="email" required icon={FaEnvelope} />
          <AuthInput label="Contact Number *" type="tel" name="contact" value={form.contact} onChange={handleChange} placeholder="Enter contact number" autoComplete="tel" required icon={FaPhone} />

          <div>
            <label htmlFor="dob" className="block text-sm text-textMuted mb-1">Date of Birth *</label>
            <input type="date" id="dob" name="dob" value={form.dob} onChange={handleChange} required max={todayISO} className="w-full px-4 py-2 rounded-md bg-background border border-border text-textMain focus:outline-none focus:border-primary transition" />
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm text-textMuted mb-1">Gender *</label>
            <select id="gender" name="gender" value={form.gender} onChange={handleChange} required className="w-full px-4 py-2 rounded-md bg-background border border-border text-textMain focus:outline-none focus:border-primary">
              <option value="" disabled>Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="department" className="block text-sm text-textMuted mb-1">Department</label>
            <select id="department" name="department" value={form.department} onChange={handleChange} className="w-full px-4 py-2 rounded-md bg-background border border-border text-textMain">
              <option value="">Select a department</option>
              <option value="development">Development</option>
              <option value="marketingAndSales">Marketing & Sales</option>
              <option value="humanResource">Human Resource</option>
            </select>
          </div>

          <AuthInput label="Designation" type="text" name="designation" value={form.designation} onChange={handleChange} placeholder="Enter designation" />
          <AuthInput label="Location" type="text" name="location" value={form.location} onChange={handleChange} placeholder="Enter location" />
          <AuthInput label="Blood Group" type="text" name="bloodGroup" value={form.bloodGroup} onChange={handleChange} />
          <AuthInput label="Permanent Address" type="text" name="permanentAddress" value={form.permanentAddress} onChange={handleChange} />
          <AuthInput label="Current Address" type="text" name="currentAddress" value={form.currentAddress} onChange={handleChange} />
          <AuthInput label="Emergency Number" type="tel" name="emergencyNo" value={form.emergencyNo} onChange={handleChange} />
          <AuthInput label="P.S." type="text" name="ps" value={form.ps} onChange={handleChange} />

          <div>
            <label htmlFor="doj" className="block text-sm text-textMuted mb-1">Date of Joining *</label>
            <input type="date" id="doj" name="doj" value={form.doj} onChange={handleChange} required max={todayISO} className="w-full px-4 py-2 rounded-md bg-background border border-border text-textMain" />
          </div>

          <AuthInput label="Salary" type="number" name="salary" value={form.salary} onChange={handleChange} />
          <AuthInput label="Reference" type="text" name="ref" value={form.ref} onChange={handleChange} />

          <div>
            <label htmlFor="status" className="block text-sm text-textMuted mb-1">Status</label>
            <select id="status" name="status" value={form.status} onChange={handleChange} className="w-full px-4 py-2 rounded-md bg-background border border-border text-textMain">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <AuthInput label="Total PL" type="number" name="totalPl" value={form.totalPl} onChange={handleChange} />

          <AuthInput label="Password *" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Create a password" autoComplete="new-password" required showTogglePassword={true} icon={FaLock} />

          <div className="mt-6 pt-4 border-t border-border">
            <h3 className="text-lg font-semibold text-textMain mb-2">Optional: Email Sending Setup</h3>
            <AuthInput label="Work Email" type="email" name="outlookEmail" value={form.outlookEmail} onChange={handleChange} icon={FaEnvelope} />
            <AuthInput label="Email App Password" type="password" name="outlookAppPassword" value={form.outlookAppPassword} onChange={handleChange} showTogglePassword={true} icon={FaLock} />
          </div>

          <button type="submit" disabled={loading} className="w-full py-2 rounded-md bg-yellow-300 hover:bg-orange-500 hover:text-white transition text-background font-semibold shadow disabled:opacity-50">
            {loading ? "Creating Account..." : "Register Employee"}
          </button>
        </form>

        {/* <p className="mt-4 text-center text-textMuted text-sm">
          Already have an account?{" "}
          <a href="/login" className="text-primary hover:text-orangeDark">
            Log in
          </a>
        </p> */}
      </div>
    </div>
  );
};

export default Signup;
