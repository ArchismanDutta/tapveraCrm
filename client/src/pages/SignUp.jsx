// src/pages/Signup.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import tapveraLogo from "../assets/tapvera.png";
import { FaUser, FaEnvelope, FaPhone, FaLock, FaCheck, FaBriefcase, FaMapMarkerAlt, FaGraduationCap, FaCog } from "react-icons/fa";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com";

// ─── Shared field components ───────────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 bg-[#141a29] border border-[#2a2d48] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition text-sm";
const selectCls = "w-full px-3 py-2.5 bg-[#141a29] border border-[#2a2d48] rounded-lg text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition text-sm";
const labelCls = "block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide";

const Field = ({ label, required, error, children }) => (
  <div>
    <label className={labelCls}>
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

const PasswordInput = ({ name, value, onChange, placeholder, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete || "new-password"}
        className={`${inputCls} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-400 transition"
      >
        {show ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
      </button>
    </div>
  );
};

// ─── Step definitions ──────────────────────────────────────────────────────
const STEPS = [
  { id: "basic",          label: "Basic Info",     icon: FaUser },
  { id: "personal",       label: "Personal",       icon: FaMapMarkerAlt },
  { id: "employment",     label: "Employment",     icon: FaBriefcase },
  { id: "shift",          label: "Shift & Skills", icon: FaCog },
  { id: "qualifications", label: "Qualifications", icon: FaGraduationCap },
  { id: "email",          label: "Email Setup",    icon: FaEnvelope },
];

// ─── Main component ────────────────────────────────────────────────────────
const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    email: "",
    contact: "",
    password: "",
    dob: "",
    gender: "",
    bloodGroup: "",
    location: "India",
    permanentAddress: "",
    currentAddress: "",
    emergencyNo: "",
    ps: "",
    employeeRole: "employee",
    department: "",
    designation: "",
    jobLevel: "junior",
    employmentType: "full-time",
    doj: "",
    salary: "",
    ref: "",
    status: "active",
    totalPl: 0,
    shiftType: "standard",
    selectedShiftId: "",
    outlookEmail: "",
    outlookAppPassword: "",
    qualifications: [{ school: "", degree: "", marks: "", year: "" }],
  });

  const [skillsInput, setSkillsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState(null);
  const [availableShifts, setAvailableShifts] = useState([]);
  const [loadingShifts, setLoadingShifts] = useState(true);
  const [fetchingId, setFetchingId] = useState(false);
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  const todayISO = new Date().toISOString().split("T")[0];

  useEffect(() => {
    const savedRole = JSON.parse(localStorage.getItem("user"))?.role || localStorage.getItem("role");
    if (savedRole) setRole(savedRole.toLowerCase());
    else navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (role && !["hr", "admin", "super-admin"].includes(role)) {
      toast.error("Access denied. Only HR/Admin/Super Admin can register employees.");
      navigate("/login");
    }
  }, [role, navigate]);

  // Auto-fetch next employee ID
  useEffect(() => {
    if (!role || !["hr", "admin", "super-admin"].includes(role)) return;
    const fetchNextId = async () => {
      setFetchingId(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/api/users/next-id`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { nextId } = await res.json();
          setForm(prev => ({ ...prev, employeeId: nextId }));
        }
      } catch (err) {
        console.error("Failed to fetch next employee ID:", err);
      } finally {
        setFetchingId(false);
      }
    };
    fetchNextId();
  }, [role]);

  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const response = await fetch(`${API_BASE}/api/shifts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const shifts = await response.json();
          setAvailableShifts(shifts);
          if (shifts.length > 0 && !form.selectedShiftId) {
            setForm(prev => ({ ...prev, selectedShiftId: shifts[0]._id }));
          }
        } else {
          toast.info("Please initialize shifts from the Shift Management page first.");
        }
      } catch (error) {
        console.error("Error fetching shifts:", error);
      } finally {
        setLoadingShifts(false);
      }
    };
    if (role && ["hr", "admin", "super-admin"].includes(role)) fetchShifts();
  }, [role]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const handleQualificationChange = (index, field, value) => {
    const updated = [...form.qualifications];
    updated[index][field] = value;
    setForm(prev => ({ ...prev, qualifications: updated }));
  };

  const addQualification = () => {
    setForm(prev => ({
      ...prev,
      qualifications: [...prev.qualifications, { school: "", degree: "", marks: "", year: "" }],
    }));
  };

  const removeQualification = (index) => {
    const updated = form.qualifications.filter((_, i) => i !== index);
    setForm(prev => ({ ...prev, qualifications: updated }));
  };

  // ─── Per-step validation ─────────────────────────────────────────────────
  const validateStep = (stepIdx) => {
    const e = {};
    if (stepIdx === 0) {
      if (!form.employeeId.trim()) e.employeeId = "Required";
      if (!form.name.trim()) e.name = "Required";
      if (!form.email.trim()) e.email = "Required";
      else if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
      if (!form.contact.trim()) e.contact = "Required";
      if (!form.password.trim()) e.password = "Required";
    }
    if (stepIdx === 1) {
      if (!form.dob) e.dob = "Required";
      if (!form.gender) e.gender = "Required";
    }
    if (stepIdx === 2) {
      if (!form.doj) e.doj = "Required";
    }
    return e;
  };

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setCompletedSteps(prev => new Set([...prev, step]));
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => { setErrors({}); setStep(s => Math.max(s - 1, 0)); };

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const requiredFields = ["employeeId", "name", "email", "contact", "dob", "gender", "password", "doj"];
    const isIncomplete = requiredFields.some(f => !String(form[f] || "").trim());
    if (isIncomplete) {
      toast.error("⚠️ Please fill in all required fields.");
      setLoading(false);
      return;
    }

    const skillsArray = skillsInput.split(",").map(s => s.trim()).filter(Boolean);
    const validQualifications = form.qualifications.filter(q => q.school || q.degree || q.marks || q.year);

    const payload = {
      employeeId: String(form.employeeId).trim(),
      name: String(form.name).trim(),
      email: String(form.email).toLowerCase().trim(),
      contact: String(form.contact).trim(),
      dob: form.dob || null,
      gender: form.gender,
      role: form.employeeRole || "employee",
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

    if (form.shiftType === "standard" && form.selectedShiftId) {
      payload.shift = { shiftId: form.selectedShiftId };
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
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

  if (!["hr", "admin", "super-admin"].includes(role)) return null;

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-start py-10 px-4">
      {/* Logo + Title */}
      <div className="flex items-center gap-4 mb-8">
        <img src={tapveraLogo} alt="Tapvera" className="h-12 w-auto rounded-lg bg-white/5 p-1" />
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Employee Registration</h1>
          <p className="text-xs text-slate-500 mt-0.5">Onboard a new team member</p>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        {/* ─── Step progress bar ─── */}
        <div className="flex items-center mb-8 gap-0">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = completedSteps.has(i);
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => { if (isDone || i < step) setStep(i); }}
                  className={`flex flex-col items-center gap-1 group ${isDone || i < step ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                    isActive
                      ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/30"
                      : isDone
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-[#1a1f2e] border-[#2a2d48] text-slate-500"
                  }`}>
                    {isDone ? <FaCheck size={10} /> : <Icon size={10} />}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap hidden sm:block ${
                    isActive ? "text-orange-400" : isDone ? "text-green-400" : "text-slate-600"
                  }`}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 transition-all ${isDone ? "bg-green-500/60" : "bg-[#2a2d48]"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ─── Form card ─── */}
        <div className="bg-[#181d2f] border border-[#2a2d48] rounded-2xl shadow-2xl overflow-hidden">
          {/* Card header */}
          <div className="px-6 py-4 border-b border-[#2a2d48] bg-[#1a1f30]">
            <h2 className="text-base font-bold text-white">
              {STEPS[step].label}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Step {step + 1} of {STEPS.length}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="px-6 py-6 space-y-5">

              {/* ── STEP 0: Basic Info ─────────────────────────────────── */}
              {step === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Employee ID" required error={errors.employeeId}>
                      <div className="relative">
                        <input
                          type="text"
                          name="employeeId"
                          value={fetchingId ? "" : form.employeeId}
                          onChange={e => { setIdManuallyEdited(true); handleChange(e); }}
                          placeholder={fetchingId ? "Generating..." : "e.g. EMP001"}
                          readOnly={!idManuallyEdited && !fetchingId}
                          className={`${inputCls} pr-20 ${errors.employeeId ? "border-red-500" : ""} ${!idManuallyEdited && !fetchingId ? "text-orange-300 font-semibold" : ""}`}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {fetchingId ? (
                            <span className="text-slate-500 text-xs animate-pulse">auto…</span>
                          ) : idManuallyEdited ? (
                            <button type="button" title="Reset to auto-generated ID"
                              onClick={async () => {
                                setIdManuallyEdited(false);
                                setFetchingId(true);
                                try {
                                  const token = localStorage.getItem("token");
                                  const res = await fetch(`${API_BASE}/api/users/next-id`, { headers: { Authorization: `Bearer ${token}` } });
                                  if (res.ok) { const { nextId } = await res.json(); setForm(prev => ({ ...prev, employeeId: nextId })); }
                                } finally { setFetchingId(false); }
                              }}
                              className="text-xs text-slate-400 hover:text-orange-400 transition px-1 py-0.5 rounded border border-[#2a2d48] hover:border-orange-500">
                              ↺
                            </button>
                          ) : (
                            <span className="text-xs text-orange-400 font-semibold">auto</span>
                          )}
                        </div>
                      </div>
                    </Field>
                    <Field label="Full Name" required error={errors.name}>
                      <input type="text" name="name" value={form.name}
                        onChange={handleChange} placeholder="Full legal name"
                        className={`${inputCls} ${errors.name ? "border-red-500" : ""}`} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Email Address" required error={errors.email}>
                      <input type="email" name="email" value={form.email}
                        onChange={handleChange} placeholder="employee@company.com"
                        className={`${inputCls} ${errors.email ? "border-red-500" : ""}`} />
                    </Field>
                    <Field label="Contact Number" required error={errors.contact}>
                      <input type="tel" name="contact" value={form.contact}
                        onChange={handleChange} placeholder="+91 9876543210"
                        className={`${inputCls} ${errors.contact ? "border-red-500" : ""}`} />
                    </Field>
                  </div>
                  <Field label="Password" required error={errors.password}>
                    <PasswordInput name="password" value={form.password} onChange={handleChange} placeholder="Create a strong password" />
                  </Field>
                  <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 text-xs text-orange-300">
                    Password will be given to the employee for their first login. They can change it later.
                  </div>
                </>
              )}

              {/* ── STEP 1: Personal ──────────────────────────────────── */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date of Birth" required error={errors.dob}>
                      <input type="date" name="dob" value={form.dob} max={todayISO}
                        onChange={handleChange}
                        className={`${inputCls} ${errors.dob ? "border-red-500" : ""}`} />
                    </Field>
                    <Field label="Gender" required error={errors.gender}>
                      <select name="gender" value={form.gender} onChange={handleChange}
                        className={`${selectCls} ${errors.gender ? "border-red-500" : ""}`}>
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Blood Group">
                      <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange} className={selectCls}>
                        <option value="">Select</option>
                        {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => <option key={g}>{g}</option>)}
                      </select>
                    </Field>
                    <Field label="Location">
                      <input type="text" name="location" value={form.location} onChange={handleChange}
                        placeholder="City, Country" className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Permanent Address">
                    <textarea name="permanentAddress" value={form.permanentAddress} onChange={handleChange}
                      placeholder="Street, City, State, PIN" rows={2}
                      className={`${inputCls} resize-none`} />
                  </Field>
                  <Field label="Current Address">
                    <textarea name="currentAddress" value={form.currentAddress} onChange={handleChange}
                      placeholder="Same as permanent or different" rows={2}
                      className={`${inputCls} resize-none`} />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Emergency Contact">
                      <input type="tel" name="emergencyNo" value={form.emergencyNo} onChange={handleChange}
                        placeholder="+91 9876543210" className={inputCls} />
                    </Field>
                    <Field label="P.S. (Personal Statement)">
                      <input type="text" name="ps" value={form.ps} onChange={handleChange}
                        placeholder="Optional note" className={inputCls} />
                    </Field>
                  </div>
                </>
              )}

              {/* ── STEP 2: Employment ────────────────────────────────── */}
              {step === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Department">
                      <select name="department" value={form.department} onChange={handleChange} className={selectCls}>
                        <option value="">Select department</option>
                        <option value="executives">Executives</option>
                        <option value="development">Development</option>
                        <option value="marketingAndSales">Marketing & Sales</option>
                        <option value="humanResource">Human Resource</option>
                      </select>
                    </Field>
                    <Field label="Designation">
                      <input type="text" name="designation" value={form.designation} onChange={handleChange}
                        placeholder="e.g. Senior Developer" className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Role" required>
                      <select name="employeeRole" value={form.employeeRole} onChange={handleChange} className={selectCls}>
                        <option value="employee">Employee</option>
                        <option value="hr">HR</option>
                        {role === "super-admin" && <option value="admin">Admin</option>}
                      </select>
                    </Field>
                    <div className="flex items-end pb-0.5">
                      <div className={`w-full px-3 py-2 rounded-lg text-xs font-medium border ${
                        form.employeeRole === "super-admin" ? "bg-purple-500/10 border-purple-500/30 text-purple-300" :
                        form.employeeRole === "admin" ? "bg-blue-500/10 border-blue-500/30 text-blue-300" :
                        form.employeeRole === "hr" ? "bg-teal-500/10 border-teal-500/30 text-teal-300" :
                        "bg-slate-700/30 border-[#2a2d48] text-slate-400"
                      }`}>
                        {form.employeeRole === "admin" && "🛡️ Manage employees, tasks, clients & reports"}
                        {form.employeeRole === "hr" && "👥 Manage HR — attendance, payroll & onboarding"}
                        {form.employeeRole === "employee" && "👤 Standard access — dashboard, tasks & attendance"}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Job Level">
                      <select name="jobLevel" value={form.jobLevel} onChange={handleChange} className={selectCls}>
                        <option value="intern">Intern</option>
                        <option value="junior">Junior</option>
                        <option value="mid">Mid</option>
                        <option value="senior">Senior</option>
                        <option value="lead">Lead</option>
                        <option value="director">Director</option>
                        <option value="executive">Executive</option>
                      </select>
                    </Field>
                    <Field label="Employment Type">
                      <select name="employmentType" value={form.employmentType} onChange={handleChange} className={selectCls}>
                        <option value="full-time">Full-Time</option>
                        <option value="part-time">Part-Time</option>
                        <option value="contract">Contract</option>
                        <option value="internship">Internship</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Date of Joining" required error={errors.doj}>
                      <input type="date" name="doj" value={form.doj} onChange={handleChange}
                        className={`${inputCls} ${errors.doj ? "border-red-500" : ""}`} />
                    </Field>
                    <Field label="Salary (₹)">
                      <input type="number" name="salary" value={form.salary} onChange={handleChange}
                        placeholder="0" min="0" className={inputCls} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Status">
                      <select name="status" value={form.status} onChange={handleChange} className={selectCls}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </Field>
                    <Field label="Total PL (Paid Leaves)">
                      <input type="number" name="totalPl" value={form.totalPl} onChange={handleChange}
                        placeholder="0" min="0" className={inputCls} />
                    </Field>
                  </div>
                  <Field label="Reference">
                    <input type="text" name="ref" value={form.ref} onChange={handleChange}
                      placeholder="Referred by (optional)" className={inputCls} />
                  </Field>
                </>
              )}

              {/* ── STEP 3: Shift & Skills ────────────────────────────── */}
              {step === 3 && (
                <>
                  <div className="space-y-3">
                    <Field label="Shift Type">
                      <select name="shiftType" value={form.shiftType} onChange={handleChange} className={selectCls}>
                        <option value="standard">Standard Shift</option>
                        <option value="flexiblePermanent">Permanent Flexible Shift</option>
                      </select>
                    </Field>

                    {form.shiftType === "standard" && (
                      <div>
                        <label className={labelCls}>
                          Select Shift {loadingShifts && <span className="text-slate-500 normal-case">(Loading...)</span>}
                        </label>
                        {loadingShifts ? (
                          <div className={`${inputCls} text-slate-500`}>Loading available shifts...</div>
                        ) : availableShifts.length === 0 ? (
                          <div className="space-y-2">
                            <div className="px-3 py-2 bg-red-900/20 text-red-400 border border-red-500/30 rounded-lg text-sm">
                              ⚠️ No shifts available. Please initialize shifts from the Shift Management page first.
                            </div>
                            <button type="button" onClick={() => navigate("/shift-management")}
                              className="text-orange-400 hover:underline text-sm">
                              Go to Shift Management →
                            </button>
                          </div>
                        ) : (
                          <>
                            <select name="selectedShiftId" value={form.selectedShiftId}
                              onChange={handleChange} className={selectCls}>
                              <option value="">Choose a shift</option>
                              {availableShifts.map(shift => (
                                <option key={shift._id} value={shift._id}>
                                  {shift.name} ({shift.start} – {shift.end}, {shift.durationHours}h)
                                </option>
                              ))}
                            </select>
                            {form.selectedShiftId && (
                              <div className="mt-2 bg-green-900/20 border border-green-500/30 rounded-lg px-3 py-2 text-xs text-green-300">
                                {(() => {
                                  const s = availableShifts.find(s => s._id === form.selectedShiftId);
                                  return s ? <><strong>{s.name}</strong>: {s.start} – {s.end}{s.description && ` • ${s.description}`}</> : null;
                                })()}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {form.shiftType === "flexiblePermanent" && (
                      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg px-3 py-3 text-xs text-blue-300">
                        <strong>Flexible Permanent Shift:</strong> Employee can work any 9 hours within a 24-hour period. No fixed timing required.
                      </div>
                    )}
                  </div>

                  <Field label="Skills (comma-separated)">
                    <input type="text" name="skills" value={skillsInput}
                      onChange={e => setSkillsInput(e.target.value)}
                      placeholder="e.g. JavaScript, React, Node.js"
                      className={inputCls} />
                    {skillsInput && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {skillsInput.split(",").map(s => s.trim()).filter(Boolean).map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-full text-xs">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </Field>
                </>
              )}

              {/* ── STEP 4: Qualifications ────────────────────────────── */}
              {step === 4 && (
                <div className="space-y-4">
                  {form.qualifications.map((q, index) => (
                    <div key={index} className="border border-[#2a2d48] rounded-xl p-4 bg-[#141a29] space-y-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                          Qualification {index + 1}
                        </span>
                        {form.qualifications.length > 1 && (
                          <button type="button" onClick={() => removeQualification(index)}
                            className="text-red-400 hover:text-red-300 text-xs font-semibold transition">
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={q.school}
                          onChange={e => handleQualificationChange(index, "school", e.target.value)}
                          placeholder="School / University" className={inputCls} />
                        <input type="text" value={q.degree}
                          onChange={e => handleQualificationChange(index, "degree", e.target.value)}
                          placeholder="Degree / Certification" className={inputCls} />
                        <input type="text" value={q.marks}
                          onChange={e => handleQualificationChange(index, "marks", e.target.value)}
                          placeholder="Marks / Percentage / CGPA" className={inputCls} />
                        <input type="number" value={q.year}
                          onChange={e => handleQualificationChange(index, "year", e.target.value)}
                          placeholder="Year of Passing" className={inputCls} />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addQualification}
                    className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 text-sm font-semibold transition">
                    <span className="text-lg leading-none">+</span> Add Qualification
                  </button>
                </div>
              )}

              {/* ── STEP 5: Email Setup ───────────────────────────────── */}
              {step === 5 && (
                <>
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300 mb-2">
                    These are optional. Used for integrating the employee's work email with the CRM.
                  </div>
                  <Field label="Work Email">
                    <input type="email" name="outlookEmail" value={form.outlookEmail}
                      onChange={handleChange} placeholder="work@company.com" className={inputCls} />
                  </Field>
                  <Field label="Email App Password">
                    <PasswordInput name="outlookAppPassword" value={form.outlookAppPassword}
                      onChange={handleChange} placeholder="App-specific password" autoComplete="off" />
                  </Field>
                </>
              )}

            </div>

            {/* ─── Footer navigation ───────────────────────────────── */}
            <div className="px-6 py-4 border-t border-[#2a2d48] bg-[#161b2a] flex items-center justify-between rounded-b-2xl">
              <button type="button" onClick={goBack} disabled={step === 0}
                className="px-4 py-2 rounded-lg border border-[#2a2d48] text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm font-medium">
                ← Back
              </button>

              <span className="text-xs text-slate-600 font-medium">{step + 1} / {STEPS.length}</span>

              {isLastStep ? (
                <button type="submit" disabled={loading}
                  className="px-6 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-semibold text-sm shadow-lg shadow-orange-900/30 disabled:opacity-50 transition">
                  {loading ? "Registering..." : "Register Employee"}
                </button>
              ) : (
                <button type="button" onClick={goNext}
                  className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition">
                  Next →
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
