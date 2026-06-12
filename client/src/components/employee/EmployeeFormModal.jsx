import React, { useState, useEffect } from "react";

const TABS = [
  { id: "personal", label: "Personal Info", icon: "👤" },
  { id: "employment", label: "Employment", icon: "💼" },
  { id: "address", label: "Address & Contact", icon: "📍" },
  { id: "salary", label: "Salary & Payroll", icon: "💰" },
  { id: "bank", label: "Bank Details", icon: "🏦" },
];

const initialFormData = {
  // Personal
  id: "",
  name: "",
  email: "",
  contact: "",
  dob: "",
  gender: "",
  bloodGroup: "",
  location: "India",
  avatar: "",
  // Employment
  department: "",
  designation: "",
  position: "",
  role: "employee",
  jobLevel: "junior",
  employmentType: "full-time",
  status: "Active",
  doj: "",
  // Address
  permanentAddress: "",
  currentAddress: "",
  emergencyContact: "",
  // Salary
  salaryBasic: "",
  salaryTotal: "",
  paymentMode: "bank",
  pan: "",
  uan: "",
  pfNumber: "",
  esiNumber: "",
  // Bank
  bankAccountNumber: "",
  bankName: "",
  ifscCode: "",
};

const inputClass =
  "w-full bg-[#161b2e] border border-[#2a2d48] rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm";

const labelClass = "block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wide";

const selectClass =
  "w-full bg-[#161b2e] border border-[#2a2d48] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition text-sm";

const Field = ({ label, required, children }) => (
  <div>
    <label className={labelClass}>
      {label} {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const EmployeeFormModal = ({ isEditing, employee, onClose, onSubmit, existingIds }) => {
  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("personal");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEditing && employee) {
      setFormData({
        ...initialFormData,
        ...employee,
        salaryBasic: employee.salary?.basic ?? employee.salary ?? "",
        salaryTotal: employee.salary?.total ?? "",
        paymentMode: employee.salary?.paymentMode ?? "bank",
      });
    } else {
      setFormData(initialFormData);
    }
    setActiveTab("personal");
    setErrors({});
  }, [isEditing, employee]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!formData.id) e.id = "Required";
    if (!formData.name) e.name = "Required";
    if (!formData.email) e.email = "Required";
    else if (!/^\S+@\S+\.\S+$/.test(formData.email)) e.email = "Invalid email";
    if (!formData.contact) e.contact = "Required";
    if (!formData.dob) e.dob = "Required";
    if (!formData.gender) e.gender = "Required";
    if (!formData.department) e.department = "Required";
    if (!formData.designation) e.designation = "Required";
    if (!formData.doj) e.doj = "Required";
    if (!isEditing && existingIds.includes(formData.id)) e.id = "ID already exists";
    return e;
  };

  const handleSave = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Jump to first tab with error
      const personalFields = ["id", "name", "email", "contact", "dob", "gender"];
      const employmentFields = ["department", "designation", "doj"];
      if (personalFields.some((f) => errs[f])) setActiveTab("personal");
      else if (employmentFields.some((f) => errs[f])) setActiveTab("employment");
      return;
    }
    onSubmit({
      ...formData,
      salary: {
        basic: Number(formData.salaryBasic) || 0,
        total: Number(formData.salaryTotal) || 0,
        paymentMode: formData.paymentMode,
      },
      attendance: Number(formData.attendance) || 0,
    });
    if (!isEditing) setFormData(initialFormData);
  };

  const tabHasError = (tabId) => {
    const tabFields = {
      personal: ["id", "name", "email", "contact", "dob", "gender"],
      employment: ["department", "designation", "doj"],
      address: [],
      salary: [],
      bank: [],
    };
    return (tabFields[tabId] || []).some((f) => errors[f]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-[#181d2f] border border-[#2a2d48] rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#2a2d48] flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isEditing ? "Edit Employee" : "Add New Employee"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing ? "Update employee information" : "Fill in the details to onboard a new employee"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 flex-shrink-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? "text-blue-400 border-blue-500 bg-blue-500/10"
                  : "text-slate-500 border-transparent hover:text-slate-300 hover:bg-white/5"
              } ${tabHasError(tab.id) ? "text-red-400 border-red-500" : ""}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tabHasError(tab.id) && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              )}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          <form id="employee-form" onSubmit={handleSave} noValidate>

            {/* ── PERSONAL INFO ── */}
            {activeTab === "personal" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Employee ID" required>
                  <input
                    type="text"
                    name="id"
                    value={formData.id}
                    onChange={handleChange}
                    disabled={isEditing}
                    placeholder="e.g. EMP001"
                    className={`${inputClass} ${errors.id ? "border-red-500" : ""} ${isEditing ? "opacity-50 cursor-not-allowed" : ""}`}
                  />
                  {errors.id && <p className="text-red-400 text-xs mt-1">{errors.id}</p>}
                </Field>

                <Field label="Full Name" required>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full Name"
                    className={`${inputClass} ${errors.name ? "border-red-500" : ""}`}
                  />
                  {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                </Field>

                <Field label="Email Address" required>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="employee@company.com"
                    className={`${inputClass} ${errors.email ? "border-red-500" : ""}`}
                  />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </Field>

                <Field label="Contact Number" required>
                  <input
                    type="tel"
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                    placeholder="+91 9876543210"
                    className={`${inputClass} ${errors.contact ? "border-red-500" : ""}`}
                  />
                  {errors.contact && <p className="text-red-400 text-xs mt-1">{errors.contact}</p>}
                </Field>

                <Field label="Date of Birth" required>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    className={`${inputClass} ${errors.dob ? "border-red-500" : ""}`}
                  />
                  {errors.dob && <p className="text-red-400 text-xs mt-1">{errors.dob}</p>}
                </Field>

                <Field label="Gender" required>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className={`${selectClass} ${errors.gender ? "border-red-500" : ""}`}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.gender && <p className="text-red-400 text-xs mt-1">{errors.gender}</p>}
                </Field>

                <Field label="Blood Group">
                  <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className={selectClass}>
                    <option value="">Select Blood Group</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Location">
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="City, Country"
                    className={inputClass}
                  />
                </Field>

                <Field label="Avatar URL">
                  <input
                    type="url"
                    name="avatar"
                    value={formData.avatar}
                    onChange={handleChange}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {/* ── EMPLOYMENT ── */}
            {activeTab === "employment" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Department" required>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className={`${selectClass} ${errors.department ? "border-red-500" : ""}`}
                  >
                    <option value="">Select Department</option>
                    <option value="executives">Executives</option>
                    <option value="development">Development</option>
                    <option value="marketingAndSales">Marketing & Sales</option>
                    <option value="humanResource">Human Resource</option>
                  </select>
                  {errors.department && <p className="text-red-400 text-xs mt-1">{errors.department}</p>}
                </Field>

                <Field label="Designation" required>
                  <input
                    type="text"
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    placeholder="e.g. Senior Developer"
                    className={`${inputClass} ${errors.designation ? "border-red-500" : ""}`}
                  />
                  {errors.designation && <p className="text-red-400 text-xs mt-1">{errors.designation}</p>}
                </Field>

                <Field label="Position / Title">
                  <input
                    type="text"
                    name="position"
                    value={formData.position}
                    onChange={handleChange}
                    placeholder="e.g. Tech Lead"
                    className={inputClass}
                  />
                </Field>

                <Field label="Date of Joining" required>
                  <input
                    type="date"
                    name="doj"
                    value={formData.doj}
                    onChange={handleChange}
                    className={`${inputClass} ${errors.doj ? "border-red-500" : ""}`}
                  />
                  {errors.doj && <p className="text-red-400 text-xs mt-1">{errors.doj}</p>}
                </Field>

                <Field label="Role">
                  <select name="role" value={formData.role} onChange={handleChange} className={selectClass}>
                    <option value="employee">Employee</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </Field>

                <Field label="Employment Type">
                  <select name="employmentType" value={formData.employmentType} onChange={handleChange} className={selectClass}>
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </Field>

                <Field label="Job Level">
                  <select name="jobLevel" value={formData.jobLevel} onChange={handleChange} className={selectClass}>
                    <option value="intern">Intern</option>
                    <option value="junior">Junior</option>
                    <option value="mid">Mid</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead</option>
                    <option value="director">Director</option>
                    <option value="executive">Executive</option>
                  </select>
                </Field>

                <Field label="Status">
                  <select name="status" value={formData.status} onChange={handleChange} className={selectClass}>
                    <option value="Active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </Field>
              </div>
            )}

            {/* ── ADDRESS & CONTACT ── */}
            {activeTab === "address" && (
              <div className="grid grid-cols-1 gap-4">
                <Field label="Permanent Address">
                  <textarea
                    name="permanentAddress"
                    value={formData.permanentAddress}
                    onChange={handleChange}
                    placeholder="Street, City, State, PIN"
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <Field label="Current Address">
                  <textarea
                    name="currentAddress"
                    value={formData.currentAddress}
                    onChange={handleChange}
                    placeholder="Street, City, State, PIN"
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Emergency Contact">
                    <input
                      type="tel"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      placeholder="+91 9876543210"
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Outlook / Work Email">
                    <input
                      type="email"
                      name="outlookEmail"
                      value={formData.outlookEmail || ""}
                      onChange={handleChange}
                      placeholder="work@company.com"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* ── SALARY & PAYROLL ── */}
            {activeTab === "salary" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Basic Salary (₹)">
                  <input
                    type="number"
                    name="salaryBasic"
                    value={formData.salaryBasic}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    className={inputClass}
                  />
                </Field>

                <Field label="Total / CTC (₹)">
                  <input
                    type="number"
                    name="salaryTotal"
                    value={formData.salaryTotal}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    className={inputClass}
                  />
                </Field>

                <Field label="Payment Mode">
                  <select name="paymentMode" value={formData.paymentMode} onChange={handleChange} className={selectClass}>
                    <option value="bank">Bank Transfer</option>
                    <option value="cash">Cash</option>
                  </select>
                </Field>

                <Field label="PAN Number">
                  <input
                    type="text"
                    name="pan"
                    value={formData.pan}
                    onChange={(e) => setFormData((p) => ({ ...p, pan: e.target.value.toUpperCase() }))}
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    className={inputClass}
                  />
                </Field>

                <Field label="UAN Number">
                  <input
                    type="text"
                    name="uan"
                    value={formData.uan}
                    onChange={handleChange}
                    placeholder="Universal Account Number"
                    className={inputClass}
                  />
                </Field>

                <Field label="PF Number">
                  <input
                    type="text"
                    name="pfNumber"
                    value={formData.pfNumber}
                    onChange={handleChange}
                    placeholder="Provident Fund Number"
                    className={inputClass}
                  />
                </Field>

                <Field label="ESI Number">
                  <input
                    type="text"
                    name="esiNumber"
                    value={formData.esiNumber}
                    onChange={handleChange}
                    placeholder="Employee State Insurance No."
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {/* ── BANK DETAILS ── */}
            {activeTab === "bank" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank Name">
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    placeholder="e.g. HDFC Bank"
                    className={inputClass}
                  />
                </Field>

                <Field label="Account Number">
                  <input
                    type="text"
                    name="bankAccountNumber"
                    value={formData.bankAccountNumber}
                    onChange={handleChange}
                    placeholder="Account Number"
                    className={inputClass}
                  />
                </Field>

                <Field label="IFSC Code">
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={(e) => setFormData((p) => ({ ...p, ifscCode: e.target.value.toUpperCase() }))}
                    placeholder="HDFC0001234"
                    maxLength={11}
                    className={inputClass}
                  />
                </Field>

                <div className="col-span-2">
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-xs text-blue-300">
                    <span className="font-semibold">Note:</span> Bank details are used for salary disbursement.
                    Ensure account information is verified before saving.
                  </div>
                </div>
              </div>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a2d48] flex items-center justify-between flex-shrink-0 bg-[#181d2f] rounded-b-2xl">
          {/* Tab navigation hint */}
          <div className="flex gap-1.5">
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-2 h-2 rounded-full transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-500 w-5"
                    : tabHasError(tab.id)
                    ? "bg-red-500"
                    : "bg-[#2a2d48] hover:bg-slate-500"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#2a2d48] text-slate-300 hover:bg-white/5 hover:text-white transition text-sm font-medium"
            >
              Cancel
            </button>

            {/* Prev / Next tab nav */}
            {activeTab !== TABS[0].id && (
              <button
                type="button"
                onClick={() => {
                  const idx = TABS.findIndex((t) => t.id === activeTab);
                  if (idx > 0) setActiveTab(TABS[idx - 1].id);
                }}
                className="px-4 py-2 rounded-lg border border-[#2a2d48] text-slate-300 hover:bg-white/5 transition text-sm font-medium"
              >
                ← Back
              </button>
            )}

            {activeTab !== TABS[TABS.length - 1].id ? (
              <button
                type="button"
                onClick={() => {
                  const idx = TABS.findIndex((t) => t.id === activeTab);
                  if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition text-sm font-semibold"
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                form="employee-form"
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-sm shadow-lg shadow-blue-900/30 transition"
              >
                {isEditing ? "Save Changes" : "Add Employee"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeFormModal;
