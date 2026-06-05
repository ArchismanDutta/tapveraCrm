// File: src/pages/EmployeePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  GraduationCap,
  Mail,
  Phone,
  Plus,
  Save,
  Shield,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar";
import ContactInfo from "../components/employeeinfo/ContactInfo";
import PersonalInfo from "../components/employeeinfo/PersonalInfo";
import EmploymentDetails from "../components/employeeinfo/EmploymentDetails";
import SalaryCard from "../components/employeeinfo/SalaryCard";
import QualificationsSkills from "../components/employeeinfo/QualificationsSkills";
import ShiftDetails from "../components/employeeinfo/ShiftDetails";

const SIDEBAR_WIDTH = 250;
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const DEPARTMENTS = [
  { value: "", label: "Not assigned" },
  { value: "executives", label: "Executives" },
  { value: "development", label: "Development" },
  { value: "marketingAndSales", label: "Marketing & Sales" },
  { value: "humanResource", label: "Human Resource" },
];

const REGIONS = ["Global", "USA", "AUS", "CANADA", "IND"];
const JOB_LEVELS = ["intern", "junior", "mid", "senior", "lead", "director", "executive"];
const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const STATUSES = ["active", "inactive", "terminated", "absconded"];
const ROLES = ["employee", "admin", "hr", "super-admin"];
const GENDERS = ["male", "female", "other"];
const PAYMENT_MODES = ["bank", "cash"];
const SHIFT_TYPES = ["standard", "flexiblePermanent"];

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const normalizeEmployeeForForm = (employee) => ({
  employeeId: employee.employeeId || "",
  name: employee.name || "",
  email: employee.email || "",
  contact: employee.contact || "",
  dob: formatDateInput(employee.dob),
  gender: employee.gender || "",
  bloodGroup: employee.bloodGroup || "",
  permanentAddress: employee.permanentAddress || "",
  currentAddress: employee.currentAddress || "",
  emergencyContact: employee.emergencyContact || "",
  ps: employee.ps || "",
  location: employee.location || "",
  avatar: employee.avatar || employee.photo || "",
  timeZone: employee.timeZone || "Asia/Kolkata",
  doj: formatDateInput(employee.doj),
  ref: employee.ref || "",
  totalPl: employee.totalPl ?? 0,
  role: employee.role || "employee",
  status: employee.status || "active",
  department: employee.department || "",
  designation: employee.designation || "",
  position: employee.position || "",
  positionLevel: employee.positionLevel ?? 0,
  jobLevel: employee.jobLevel || "junior",
  employmentType: employee.employmentType || "full-time",
  regions: employee.regions?.length ? employee.regions : [employee.region || "Global"],
  shiftType: employee.shiftType || "standard",
  shift: {
    name: employee.shift?.name || "",
    start: employee.shift?.start || "",
    end: employee.shift?.end || "",
    durationHours: employee.shift?.durationHours ?? 9,
    isFlexible: Boolean(employee.shift?.isFlexible),
  },
  salary: {
    basic: employee.salary?.basic ?? 0,
    total: employee.salary?.total ?? employee.salary?.basic ?? 0,
    paymentMode: employee.salary?.paymentMode || "bank",
  },
  skillsText: (employee.skills || []).join(", "),
  qualifications: employee.qualifications?.length
    ? employee.qualifications.map((q) => ({
        school: q.school || "",
        degree: q.degree || "",
        year: q.year || "",
        marks: q.marks || "",
      }))
    : [],
});

const buildPayload = (formData) => ({
  employeeId: formData.employeeId?.trim(),
  name: formData.name?.trim(),
  email: formData.email?.trim(),
  contact: formData.contact?.trim(),
  dob: formData.dob || null,
  gender: formData.gender,
  bloodGroup: formData.bloodGroup?.trim(),
  permanentAddress: formData.permanentAddress?.trim(),
  currentAddress: formData.currentAddress?.trim(),
  emergencyContact: formData.emergencyContact?.trim(),
  ps: formData.ps?.trim(),
  location: formData.location?.trim(),
  avatar: formData.avatar?.trim(),
  timeZone: formData.timeZone?.trim(),
  doj: formData.doj || null,
  ref: formData.ref?.trim(),
  totalPl: Number(formData.totalPl) || 0,
  role: formData.role,
  status: formData.status,
  department: formData.department,
  designation: formData.designation?.trim(),
  position: formData.position?.trim(),
  positionLevel: Number(formData.positionLevel) || 0,
  jobLevel: formData.jobLevel,
  employmentType: formData.employmentType,
  regions: formData.regions?.length ? formData.regions : ["Global"],
  region: formData.regions?.[0] || "Global",
  shiftType: formData.shiftType,
  shift: {
    name: formData.shift?.name?.trim() || null,
    start: formData.shift?.start || null,
    end: formData.shift?.end || null,
    durationHours: Number(formData.shift?.durationHours) || 9,
    isFlexible: Boolean(formData.shift?.isFlexible),
  },
  salary: {
    basic: Number(formData.salary?.basic) || 0,
    total: Number(formData.salary?.total) || 0,
    paymentMode: formData.salary?.paymentMode || "bank",
  },
  skills: formData.skillsText
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean),
  qualifications: (formData.qualifications || [])
    .filter((q) => q.school || q.degree || q.year || q.marks)
    .map((q) => ({
      school: q.school?.trim() || "",
      degree: q.degree?.trim() || "",
      year: Number(q.year) || null,
      marks: q.marks?.trim() || "",
    })),
});

const Field = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {label}
    </span>
    {children}
  </label>
);

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20";

const textAreaClass = `${inputClass} min-h-24 resize-y`;

const InfoPill = ({ icon: Icon, label, value }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 px-4 py-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="truncate text-sm font-semibold text-slate-100">{value || "Not set"}</p>
    </div>
  </div>
);

const EmployeePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [formData, setFormData] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const fetchEmployee = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found. Please log in.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/users/${id}`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem("token");
            navigate("/login");
            return;
          }
          if (res.status === 403) {
            setError("You are not authorized to view this employee.");
            return;
          }
          if (res.status === 404) {
            setError("Employee not found.");
            return;
          }
          throw new Error("Failed to fetch employee.");
        }

        const data = await res.json();
        setSelectedEmployee(data);
        setFormData(normalizeEmployeeForForm(data));
      } catch (err) {
        setError(err.message || "An error occurred while fetching employee data.");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [id, navigate]);

  const summary = useMemo(() => {
    if (!selectedEmployee) return [];
    return [
      { icon: Mail, label: "Email", value: selectedEmployee.email },
      { icon: Phone, label: "Contact", value: selectedEmployee.contact },
      { icon: Briefcase, label: "Department", value: selectedEmployee.department },
      { icon: Calendar, label: "Joined", value: formatDateInput(selectedEmployee.doj) },
    ];
  }, [selectedEmployee]);

  const setField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const setNestedField = (group, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] || {}),
        [field]: value,
      },
    }));
  };

  const handleQualificationChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      qualifications: prev.qualifications.map((qualification, currentIndex) =>
        currentIndex === index ? { ...qualification, [field]: value } : qualification
      ),
    }));
  };

  const addQualification = () => {
    setFormData((prev) => ({
      ...prev,
      qualifications: [
        ...(prev.qualifications || []),
        { school: "", degree: "", year: "", marks: "" },
      ],
    }));
  };

  const removeQualification = (index) => {
    setFormData((prev) => ({
      ...prev,
      qualifications: prev.qualifications.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const toggleRegion = (region) => {
    setFormData((prev) => {
      const current = prev.regions || [];
      const next = current.includes(region)
        ? current.filter((item) => item !== region)
        : [...current, region];
      return { ...prev, regions: next.length ? next : ["Global"] };
    });
  };

  const openEditModal = () => {
    setFormData(normalizeEmployeeForForm(selectedEmployee));
    setActiveTab("personal");
    setSuccessMessage("");
    setIsEditing(true);
  };

  const closeEditModal = () => {
    setFormData(normalizeEmployeeForForm(selectedEmployee));
    setIsEditing(false);
    setSaving(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildPayload(formData)),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update employee");
      }

      setSelectedEmployee(data.user);
      setFormData(normalizeEmployeeForForm(data.user));
      setSuccessMessage("Employee details updated successfully.");
      setIsEditing(false);
    } catch (err) {
      setError(err.message || "Failed to update employee");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-white">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="admin" />
        <main className={`flex flex-1 items-center justify-center transition-all ${collapsed ? "ml-24" : "ml-72"}`}>
          <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-5 py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <span className="text-cyan-200">Loading employee details...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error && !selectedEmployee) {
    return (
      <div className="flex min-h-screen bg-slate-950 text-white">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} userRole="admin" />
        <main className={`flex flex-1 items-center justify-center transition-all ${collapsed ? "ml-24" : "ml-72"}`}>
          <div className="max-w-md rounded-lg border border-red-500/30 bg-red-950/20 p-8 text-center">
            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-300" />
            <h2 className="mb-2 text-xl font-bold text-red-100">Error Loading Employee</h2>
            <p className="mb-6 text-sm text-red-200">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <main
        style={{ marginLeft: SIDEBAR_WIDTH }}
        className="w-full px-4 py-8 sm:px-6 lg:px-10"
      >
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            {successMessage && (
              <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                {successMessage}
              </div>
            )}
          </div>

          <header className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
            <div className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-5">
                <img
                  src={
                    selectedEmployee.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployee.name || "Employee")}&background=0891b2&color=ffffff&size=128`
                  }
                  alt={selectedEmployee.name}
                  className="h-24 w-24 shrink-0 rounded-lg border border-slate-700 object-cover"
                />
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold uppercase text-cyan-200">
                      {selectedEmployee.employeeId || "No ID"}
                    </span>
                    <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold capitalize text-slate-300">
                      {selectedEmployee.status || "active"}
                    </span>
                  </div>
                  <h1 className="truncate text-3xl font-bold text-white">{selectedEmployee.name}</h1>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedEmployee.designation || "No designation"} at{" "}
                    {selectedEmployee.department || "Unassigned department"}
                  </p>
                </div>
              </div>
              <button
                onClick={openEditModal}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/40 hover:bg-cyan-500"
              >
                <Edit className="h-4 w-4" />
                Edit Details
              </button>
            </div>
            <div className="grid gap-3 border-t border-slate-800 bg-slate-950/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {summary.map((item) => (
                <InfoPill key={item.label} {...item} />
              ))}
            </div>
          </header>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <ContactInfo
              info={{
                email: selectedEmployee.email,
                phone: selectedEmployee.contact,
                address: selectedEmployee.currentAddress,
                emergencyContact: selectedEmployee.emergencyContact,
              }}
            />
            <PersonalInfo
              info={{
                dob: selectedEmployee.dob,
                gender: selectedEmployee.gender,
                location: selectedEmployee.location,
                bloodGroup: selectedEmployee.bloodGroup,
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <EmploymentDetails
              info={{
                employeeId: selectedEmployee.employeeId,
                designation: selectedEmployee.designation || selectedEmployee.jobTitle,
                department: selectedEmployee.department,
                dateOfJoining: selectedEmployee.doj || selectedEmployee.dateOfJoining,
                status: selectedEmployee.status,
                jobLevel: selectedEmployee.jobLevel,
              }}
            />
            <SalaryCard salary={selectedEmployee.salary} />
          </div>

          <QualificationsSkills
            info={{
              education: selectedEmployee.qualifications || [],
              skills: selectedEmployee.skills || [],
            }}
          />

          <ShiftDetails
            shift={selectedEmployee.shift}
            shiftType={selectedEmployee.shiftType}
            employeeId={selectedEmployee._id}
          />
        </div>
      </main>

      {isEditing && formData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-3 py-6 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-white">Edit Employee Details</h2>
                <p className="text-sm text-slate-400">{selectedEmployee.name}</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-slate-800 px-4 pt-3">
              <div className="flex gap-2 overflow-x-auto pb-3">
                {[
                  ["personal", User, "Personal"],
                  ["employment", Briefcase, "Employment"],
                  ["salary", Wallet, "Salary"],
                  ["shift", Clock, "Shift"],
                  ["skills", GraduationCap, "Skills"],
                ].map(([key, Icon, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      activeTab === key
                        ? "bg-cyan-500 text-white"
                        : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "personal" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Name">
                    <input className={inputClass} value={formData.name} onChange={(e) => setField("name", e.target.value)} required />
                  </Field>
                  <Field label="Employee ID">
                    <input className={inputClass} value={formData.employeeId} onChange={(e) => setField("employeeId", e.target.value.toUpperCase())} required />
                  </Field>
                  <Field label="Email">
                    <input className={inputClass} type="email" value={formData.email} onChange={(e) => setField("email", e.target.value)} required />
                  </Field>
                  <Field label="Contact">
                    <input className={inputClass} value={formData.contact} onChange={(e) => setField("contact", e.target.value)} required />
                  </Field>
                  <Field label="Date of Birth">
                    <input className={inputClass} type="date" value={formData.dob} onChange={(e) => setField("dob", e.target.value)} required />
                  </Field>
                  <Field label="Gender">
                    <select className={inputClass} value={formData.gender} onChange={(e) => setField("gender", e.target.value)} required>
                      <option value="">Select gender</option>
                      {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
                    </select>
                  </Field>
                  <Field label="Blood Group">
                    <input className={inputClass} value={formData.bloodGroup} onChange={(e) => setField("bloodGroup", e.target.value)} />
                  </Field>
                  <Field label="Location">
                    <input className={inputClass} value={formData.location} onChange={(e) => setField("location", e.target.value)} />
                  </Field>
                  <Field label="Emergency Contact">
                    <input className={inputClass} value={formData.emergencyContact} onChange={(e) => setField("emergencyContact", e.target.value)} />
                  </Field>
                  <Field label="Police Station">
                    <input className={inputClass} value={formData.ps} onChange={(e) => setField("ps", e.target.value)} />
                  </Field>
                  <Field label="Avatar URL" className="md:col-span-2">
                    <input className={inputClass} value={formData.avatar} onChange={(e) => setField("avatar", e.target.value)} />
                  </Field>
                  <Field label="Permanent Address" className="md:col-span-2">
                    <textarea className={textAreaClass} value={formData.permanentAddress} onChange={(e) => setField("permanentAddress", e.target.value)} />
                  </Field>
                  <Field label="Current Address" className="md:col-span-2">
                    <textarea className={textAreaClass} value={formData.currentAddress} onChange={(e) => setField("currentAddress", e.target.value)} />
                  </Field>
                </div>
              )}

              {activeTab === "employment" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Department">
                    <select className={inputClass} value={formData.department} onChange={(e) => setField("department", e.target.value)}>
                      {DEPARTMENTS.map((dept) => <option key={dept.value} value={dept.value}>{dept.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Designation">
                    <input className={inputClass} value={formData.designation} onChange={(e) => setField("designation", e.target.value)} />
                  </Field>
                  <Field label="Position">
                    <input className={inputClass} value={formData.position} onChange={(e) => setField("position", e.target.value)} />
                  </Field>
                  <Field label="Position Level">
                    <input className={inputClass} type="number" min="0" max="100" value={formData.positionLevel} onChange={(e) => setField("positionLevel", e.target.value)} />
                  </Field>
                  <Field label="Job Level">
                    <select className={inputClass} value={formData.jobLevel} onChange={(e) => setField("jobLevel", e.target.value)}>
                      {JOB_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </Field>
                  <Field label="Employment Type">
                    <select className={inputClass} value={formData.employmentType} onChange={(e) => setField("employmentType", e.target.value)}>
                      {EMPLOYMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={inputClass} value={formData.status} onChange={(e) => setField("status", e.target.value)}>
                      {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </Field>
                  <Field label="Role">
                    <select className={inputClass} value={formData.role} onChange={(e) => setField("role", e.target.value)}>
                      {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </Field>
                  <Field label="Date of Joining">
                    <input className={inputClass} type="date" value={formData.doj} onChange={(e) => setField("doj", e.target.value)} required />
                  </Field>
                  <Field label="Reference">
                    <input className={inputClass} value={formData.ref} onChange={(e) => setField("ref", e.target.value)} />
                  </Field>
                  <Field label="Total PL">
                    <input className={inputClass} type="number" min="0" value={formData.totalPl} onChange={(e) => setField("totalPl", e.target.value)} />
                  </Field>
                  <Field label="Time Zone">
                    <input className={inputClass} value={formData.timeZone} onChange={(e) => setField("timeZone", e.target.value)} />
                  </Field>
                  <div className="md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Region Access
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {REGIONS.map((region) => (
                        <button
                          key={region}
                          type="button"
                          onClick={() => toggleRegion(region)}
                          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                            formData.regions.includes(region)
                              ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                              : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          {region}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "salary" && (
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Basic">
                    <input className={inputClass} type="number" min="0" value={formData.salary.basic} onChange={(e) => setNestedField("salary", "basic", e.target.value)} />
                  </Field>
                  <Field label="Total Salary">
                    <input className={inputClass} type="number" min="0" value={formData.salary.total} onChange={(e) => setNestedField("salary", "total", e.target.value)} />
                  </Field>
                  <Field label="Payment Mode">
                    <select className={inputClass} value={formData.salary.paymentMode} onChange={(e) => setNestedField("salary", "paymentMode", e.target.value)}>
                      {PAYMENT_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              {activeTab === "shift" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Shift Type">
                    <select className={inputClass} value={formData.shiftType} onChange={(e) => setField("shiftType", e.target.value)}>
                      {SHIFT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Shift Name">
                    <input className={inputClass} value={formData.shift.name} onChange={(e) => setNestedField("shift", "name", e.target.value)} />
                  </Field>
                  <Field label="Start Time">
                    <input className={inputClass} type="time" value={formData.shift.start} onChange={(e) => setNestedField("shift", "start", e.target.value)} />
                  </Field>
                  <Field label="End Time">
                    <input className={inputClass} type="time" value={formData.shift.end} onChange={(e) => setNestedField("shift", "end", e.target.value)} />
                  </Field>
                  <Field label="Duration Hours">
                    <input className={inputClass} type="number" min="1" max="24" value={formData.shift.durationHours} onChange={(e) => setNestedField("shift", "durationHours", e.target.value)} />
                  </Field>
                  <label className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm font-semibold text-slate-200">
                    <input
                      type="checkbox"
                      checked={formData.shift.isFlexible}
                      onChange={(e) => setNestedField("shift", "isFlexible", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500"
                    />
                    Flexible shift
                  </label>
                </div>
              )}

              {activeTab === "skills" && (
                <div className="space-y-5">
                  <Field label="Skills">
                    <textarea
                      className={textAreaClass}
                      value={formData.skillsText}
                      onChange={(e) => setField("skillsText", e.target.value)}
                      placeholder="React, Node.js, Sales, SEO"
                    />
                  </Field>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">
                        Qualifications
                      </h3>
                      <button
                        type="button"
                        onClick={addQualification}
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                    <div className="space-y-3">
                      {formData.qualifications.map((qualification, index) => (
                        <div key={index} className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
                          <div className="mb-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeQualification(index)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-semibold text-red-200 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                          <div className="grid gap-4 md:grid-cols-4">
                            <Field label="School" className="md:col-span-2">
                              <input className={inputClass} value={qualification.school} onChange={(e) => handleQualificationChange(index, "school", e.target.value)} />
                            </Field>
                            <Field label="Degree">
                              <input className={inputClass} value={qualification.degree} onChange={(e) => handleQualificationChange(index, "degree", e.target.value)} />
                            </Field>
                            <Field label="Year">
                              <input className={inputClass} type="number" value={qualification.year} onChange={(e) => handleQualificationChange(index, "year", e.target.value)} />
                            </Field>
                            <Field label="Marks" className="md:col-span-4">
                              <input className={inputClass} value={qualification.marks} onChange={(e) => handleQualificationChange(index, "marks", e.target.value)} />
                            </Field>
                          </div>
                        </div>
                      ))}
                      {formData.qualifications.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                          No qualifications added.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <Shield className="h-4 w-4" />
                Changes are saved to the employee profile.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EmployeePage;
