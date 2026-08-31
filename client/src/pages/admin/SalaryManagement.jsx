import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  DollarSign, Plus, Edit2, Eye, Search, Trash2,
  Save, X, ChevronDown, ChevronUp, Check, FileText,
  Calendar, CreditCard, User, Send, AlertCircle,
  RotateCcw, BadgeCheck, Clock
} from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../../components/dashboard/Sidebar";
import { formatDepartment, formatEmploymentType } from "../../utils/formatters";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const fmt = (n) => (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function authHeaders() {
  return { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` };
}
function getDaysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function monthLabel(ym) {
  if (!ym) return "";
  return new Date(ym + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function calcPTax(ms) {
  if (ms < 10000) return 0;
  if (ms <= 15000) return 110;
  if (ms <= 25000) return 130;
  if (ms <= 40000) return 150;
  return 200;
}
function calcBreakdown(monthlySalary, totalDays, workingDays, paidDays, co = {}, dd = {}) {
  if (!monthlySalary || !totalDays || !workingDays || paidDays === "") return null;
  const ms = Number(monthlySalary), wd = Number(workingDays), pd = Number(paidDays);
  const sc = {
    basic:            co.basic            !== undefined ? Number(co.basic)            : Math.round(ms * 0.50),
    hra:              co.hra              !== undefined ? Number(co.hra)              : Math.round(ms * 0.35),
    conveyance:       co.conveyance       !== undefined ? Number(co.conveyance)       : Math.round(ms * 0.05),
    medical:          co.medical          !== undefined ? Number(co.medical)          : Math.round(ms * 0.05),
    specialAllowance: co.specialAllowance !== undefined ? Number(co.specialAllowance) : Math.round(ms * 0.05),
  };
  const grossTotal = Object.values(sc).reduce((s, v) => s + v, 0);
  // Prorate by Working Days: deduction only when paidDays < workingDays (weekends don't reduce pay)
  const ratio = wd > 0 ? pd / wd : 0;
  const pc = {
    basic:            Math.round(sc.basic            * ratio),
    hra:              Math.round(sc.hra              * ratio),
    conveyance:       Math.round(sc.conveyance       * ratio),
    medical:          Math.round(sc.medical          * ratio),
    specialAllowance: Math.round(sc.specialAllowance * ratio),
  };
  const netTotal = Object.values(pc).reduce((s, v) => s + v, 0);
  const pfEligible  = sc.basic <= 15000;
  const esiEligible = grossTotal <= 21000;
  // ROUNDUP for PF (Math.ceil per formula)
  const defEmpPF  = pfEligible  ? Math.min(1800, Math.ceil(pc.basic * 0.12)) : 0;
  const defEmpESI = esiEligible ? Math.round(netTotal * 0.0075) : 0;
  const d = {
    employeePF:  dd.employeePF  !== undefined ? Number(dd.employeePF)  : defEmpPF,
    employeeESI: dd.employeeESI !== undefined ? Number(dd.employeeESI) : defEmpESI,
    ptax:        dd.ptax        !== undefined ? Number(dd.ptax)        : calcPTax(ms),
    tds:     Number(dd.tds     || 0),
    advance: Number(dd.advance || 0),
    other:   Number(dd.other   || 0),
    otherLabel: dd.otherLabel || "",
  };
  const totalDeductions = d.employeePF + d.employeeESI + d.ptax + d.tds + d.advance + d.other;
  // Employer PF always equals Employee PF (per formula: Employer PF = Employee PF)
  const employerPF  = pfEligible  ? d.employeePF : 0;
  const employerESI = esiEligible ? Math.round(netTotal * 0.0325) : 0;
  const netSalary = netTotal - totalDeductions;
  const ctc = totalDeductions + netSalary + employerPF + employerESI;
  return { salaryComponents: sc, grossTotal, paidComponents: pc, netTotal, pfEligible, esiEligible, deductions: d, totalDeductions, employerContributions: { employerPF, employerESI }, netSalary, ctc };
}

function Field({ label, value, onChange, type = "text", readOnly = false, suffix, className = "", error = false }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className={`text-xs font-medium ${error ? "text-rose-600 dark:text-rose-300" : "text-slate-600 dark:text-slate-300"}`}>{label}{error && <span className="ml-1">*</span>}</label>
      <div className="relative">
        <input type={type} value={value ?? ""} onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          className={`h-10 w-full rounded-xl border bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:ring-2 dark:bg-[#151923] dark:text-white ${error ? "border-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15 dark:border-white/10"} ${readOnly ? "cursor-default opacity-60" : ""} ${suffix ? "pr-7" : ""}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">{suffix}</span>}
      </div>
      {error && <span className="text-xs text-red-400">This field is required</span>}
    </div>
  );
}

function Section({ title, icon: Icon, children, collapsible = false, defaultOpen = true, overflow = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.025] ${overflow ? "overflow-visible" : "overflow-hidden"}`}>
      <button type="button" onClick={() => collapsible && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between px-4 py-3 ${collapsible ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.04]" : "cursor-default"}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-blue-600 dark:text-blue-300" />}
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        </div>
        {collapsible && (open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />)}
      </button>
      {(!collapsible || open) && <div className="px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
}

function CalcRow({ label, value, highlight = false, dim = false }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 py-1.5 last:border-0 dark:border-white/10">
      <span className={`text-sm ${dim ? "text-slate-400" : highlight ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>{label}</span>
      <span className={`font-mono text-sm ${highlight ? "text-base font-bold text-emerald-600 dark:text-emerald-300" : dim ? "text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>
        {"₹"}{fmt(value)}
      </span>
    </div>
  );
}

function PayslipForm({ employees, onSaved, onClose, editPayslip = null }) {
  const isEdit = !!editPayslip;
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [empSearch, setEmpSearch]      = useState("");
  const [empDropOpen, setEmpDropOpen]  = useState(false);
  const [selectedEmp, setSelectedEmp]  = useState(null);
  const [saving, setSaving]            = useState(false);
  const [payPeriod, setPayPeriod]      = useState(currentPeriod);
  const [totalDays, setTotalDays]      = useState(() => getDaysInMonth(currentPeriod).toString());
  const [workingDays, setWorkingDays]  = useState("");
  const [paidDays, setPaidDays]        = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [co, setCo] = useState({});
  const [dd, setDd] = useState({});
  const [snap, setSnap] = useState({ pan: "", uan: "", pfNumber: "", esiNumber: "", bankAccountNumber: "", bankName: "", ifscCode: "" });
  const [remarks, setRemarks] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!editPayslip) return;
    setPayPeriod(editPayslip.payPeriod || currentPeriod);
    setTotalDays(editPayslip.totalDays?.toString() || "");
    setWorkingDays(editPayslip.workingDays?.toString() || "");
    setPaidDays(editPayslip.paidDays?.toString() || "");
    setMonthlySalary(editPayslip.monthlySalary?.toString() || "");
    setRemarks(editPayslip.remarks || "");
    const sc = editPayslip.salaryComponents || {};
    setCo({ basic: sc.basic, hra: sc.hra, conveyance: sc.conveyance, medical: sc.medical, specialAllowance: sc.specialAllowance });
    const d = editPayslip.deductions || {};
    // Only restore manual fields; let PF/ESI/PTax recalculate fresh from the updated formula
    setDd({ tds: d.tds, advance: d.advance, other: d.other, otherLabel: d.otherLabel });
    const sn = editPayslip.employeeSnapshot || {};
    setSnap({ pan: sn.pan||"", uan: sn.uan||"", pfNumber: sn.pfNumber||"", esiNumber: sn.esiNumber||"", bankAccountNumber: sn.bankAccountNumber||"", bankName: sn.bankName||"", ifscCode: sn.ifscCode||"" });
    if (editPayslip.employee) setSelectedEmp(editPayslip.employee);
  }, [editPayslip, currentPeriod]);

  useEffect(() => {
    if (!selectedEmp || isEdit) return;
    setSnap({ pan: selectedEmp.pan||"", uan: selectedEmp.uan||"", pfNumber: selectedEmp.pfNumber||"", esiNumber: selectedEmp.esiNumber||"", bankAccountNumber: selectedEmp.bankAccountNumber||"", bankName: selectedEmp.bankName||"", ifscCode: selectedEmp.ifscCode||"" });
    if (selectedEmp.salary?.total) setMonthlySalary(selectedEmp.salary.total.toString());
  }, [selectedEmp, isEdit]);

  useEffect(() => { setTotalDays(getDaysInMonth(payPeriod).toString()); }, [payPeriod]);

  const calc = useMemo(() => calcBreakdown(monthlySalary, totalDays, workingDays, paidDays, co, dd), [monthlySalary, totalDays, workingDays, paidDays, co, dd]);
  const filteredEmps = useMemo(() => {
    if (!empSearch.trim()) return employees;
    const s = empSearch.toLowerCase();
    return employees.filter((e) => e.name.toLowerCase().includes(s) || (e.employeeId || "").toLowerCase().includes(s));
  }, [employees, empSearch]);
  const lwp = workingDays && paidDays ? Math.max(0, Number(workingDays) - Number(paidDays)) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate and collect field errors
    const errs = {};
    if (!isEdit && !selectedEmp) errs.employee = true;
    if (!monthlySalary || Number(monthlySalary) <= 0) errs.monthlySalary = true;
    if (!workingDays) errs.workingDays = true;
    if (paidDays === "" || paidDays === undefined) errs.paidDays = true;
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const missing = Object.keys(errs).join(", ");
      console.error("[Payslip] Missing required fields:", missing, "| values:", { selectedEmp: selectedEmp?._id, monthlySalary, workingDays, paidDays });
      toast.error("Please fill in all required fields (highlighted in red)");
      return;
    }
    if (Number(paidDays) > Number(workingDays)) { toast.error("Paid days cannot exceed working days"); return; }
    setFieldErrors({});
    setSaving(true);
    try {
      const payload = {
        employee: isEdit ? (editPayslip.employee._id || editPayslip.employee) : selectedEmp._id,
        payPeriod, totalDays: Number(totalDays), workingDays: Number(workingDays), paidDays: Number(paidDays),
        monthlySalary: Number(monthlySalary),
        componentOverrides: Object.fromEntries(Object.entries(co).filter(([, v]) => v !== undefined).map(([k, v]) => [k, Number(v)])),
        deductionOverrides: { employeePF: dd.employeePF !== undefined ? Number(dd.employeePF) : undefined, employeeESI: dd.employeeESI !== undefined ? Number(dd.employeeESI) : undefined, ptax: dd.ptax !== undefined ? Number(dd.ptax) : undefined, tds: Number(dd.tds || 0), advance: Number(dd.advance || 0), other: Number(dd.other || 0), otherLabel: dd.otherLabel || "" },
        snapshotOverrides: snap, remarks,
      };
      const url = isEdit ? `${API_BASE}/api/payslips/${editPayslip._id}` : `${API_BASE}/api/payslips`;
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers: authHeaders(), body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(isEdit ? "Payslip updated" : "Draft created");
      onSaved(data.data);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!isEdit ? (
        <Section title="Employee" icon={User} overflow>
          <div className="relative">
            <div onClick={() => setEmpDropOpen((o) => !o)} className={`flex items-center justify-between px-3 py-2 rounded-lg bg-[#141a21] border cursor-pointer text-sm text-white ${fieldErrors.employee ? "border-red-500" : "border-[#2a3340]"}`}>
              {selectedEmp ? <span>{selectedEmp.name} <span className="text-gray-500">({selectedEmp.employeeId})</span></span> : <span className="text-gray-500">Select employee…</span>}
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
            {empDropOpen && (
              <div className="absolute z-50 mt-1 w-full bg-[#0f1419] border border-[#2a3340] rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[#2a3340]">
                  <input autoFocus placeholder="Search…" value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none" />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredEmps.map((emp) => (
                    <div key={emp._id} onClick={() => { setSelectedEmp(emp); setEmpDropOpen(false); setEmpSearch(""); }} className="px-3 py-2 hover:bg-[#1e2a35] cursor-pointer flex items-center justify-between">
                      <div><p className="text-sm text-white">{emp.name}</p><p className="text-xs text-gray-500">{emp.designation || formatDepartment(emp.department)} · {emp.employeeId}</p></div>
                      {selectedEmp?._id === emp._id && <Check className="w-4 h-4 text-blue-400" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {fieldErrors.employee && !selectedEmp && <p className="text-xs text-red-400 mt-1">* Please select an employee</p>}
          {selectedEmp && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 text-xs">
              {[["Department", formatDepartment(selectedEmp.department)||"—"],["Designation",selectedEmp.designation||"—"],["DOJ", selectedEmp.doj ? new Date(selectedEmp.doj).toLocaleDateString("en-IN"):"—"],["Type",formatEmploymentType(selectedEmp.employmentType)||"—"]].map(([k,v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-[#1e2a35]"><span className="text-gray-500">{k}</span><span className="text-gray-300">{v}</span></div>
              ))}
            </div>
          )}
        </Section>
      ) : (
        <div className="bg-[#0f1419] border border-[#1e2a35] rounded-xl px-4 py-3">
          <p className="text-sm text-gray-400">Editing: <span className="text-white font-semibold">{editPayslip.employeeSnapshot?.name || editPayslip.employee?.name || "Employee"}</span></p>
          <p className="text-xs text-gray-500">{monthLabel(editPayslip.payPeriod)}</p>
        </div>
      )}

      <Section title="Statutory & Bank Details" icon={CreditCard} collapsible defaultOpen>
        <p className="text-xs text-blue-400 mb-3">Auto-filled from employee profile. Changes here are saved back to the profile for next time.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PAN"          value={snap.pan}               onChange={(v) => setSnap((s) => ({ ...s, pan: v.toUpperCase() }))} />
          <Field label="UAN"          value={snap.uan}               onChange={(v) => setSnap((s) => ({ ...s, uan: v }))} />
          <Field label="PF Number"    value={snap.pfNumber}          onChange={(v) => setSnap((s) => ({ ...s, pfNumber: v }))} />
          <Field label="ESI Number"   value={snap.esiNumber}         onChange={(v) => setSnap((s) => ({ ...s, esiNumber: v }))} />
          <Field label="Bank A/c No." value={snap.bankAccountNumber} onChange={(v) => setSnap((s) => ({ ...s, bankAccountNumber: v }))} />
          <Field label="Bank Name"    value={snap.bankName}          onChange={(v) => setSnap((s) => ({ ...s, bankName: v }))} />
          <Field label="IFSC Code"    value={snap.ifscCode}          onChange={(v) => setSnap((s) => ({ ...s, ifscCode: v.toUpperCase() }))} className="col-span-2" />
        </div>
      </Section>

      <Section title="Pay Period & Attendance" icon={Calendar}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">Pay Period</label>
            <input type="month" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm border text-white bg-[#141a21] border-[#2a3340] focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <Field label="Total Days in Month" value={totalDays}   onChange={setTotalDays}   type="number" />
          <Field label="Working Days"        value={workingDays} onChange={(v) => { setWorkingDays(v); setFieldErrors((fe) => ({ ...fe, workingDays: false })); }} type="number" error={!!fieldErrors.workingDays} />
          <Field label="Paid Days"           value={paidDays}    onChange={(v) => { setPaidDays(v);    setFieldErrors((fe) => ({ ...fe, paidDays: false }));    }} type="number" error={!!fieldErrors.paidDays} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 font-medium">LWP (auto)</label>
            <div className="px-3 py-2 rounded-lg text-sm bg-[#141a21] border border-[#2a3340] text-gray-400">{lwp}</div>
          </div>
        </div>
      </Section>

      <Section title="Monthly CTC Input" icon={DollarSign}>
        <Field label="Monthly Salary (CTC)" value={monthlySalary} onChange={(v) => { setMonthlySalary(v); setCo({}); setFieldErrors((fe) => ({ ...fe, monthlySalary: false })); }} type="number" suffix="&#8377;" error={!!fieldErrors.monthlySalary} />
        {calc && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className={`rounded-lg px-3 py-2 border ${calc.pfEligible ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-gray-500/10 border-gray-500/30 text-gray-400"}`}>PF Eligible: <strong>{calc.pfEligible ? "Yes (Basic ≤ ₹15,000)" : "No"}</strong></div>
            <div className={`rounded-lg px-3 py-2 border ${calc.esiEligible ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-gray-500/10 border-gray-500/30 text-gray-400"}`}>ESI Eligible: <strong>{calc.esiEligible ? "Yes (Gross ≤ ₹21,000)" : "No"}</strong></div>
          </div>
        )}
      </Section>

      {calc && (
        <Section title="Earnings Components" icon={FileText} collapsible defaultOpen>
          <p className="text-xs text-gray-500 mb-3">Override any component — applies to this payslip only.</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[["Basic (50%)", "basic"], ["HRA (35%)", "hra"], ["Conveyance (5%)", "conveyance"], ["Medical (5%)", "medical"], ["Special Allowance (5%)", "specialAllowance"]].map(([label, key]) => (
              <Field key={key} label={label} type="number" suffix="&#8377;"
                value={co[key] !== undefined ? co[key] : calc.salaryComponents[key]}
                onChange={(v) => setCo((o) => ({ ...o, [key]: v === "" ? undefined : v }))} />
            ))}
          </div>
          <div className="border-t border-[#2a3340] pt-2 space-y-1">
            <CalcRow label="Gross Total (full month)" value={calc.grossTotal} />
            <CalcRow label={`Net Total (${paidDays||0} / ${workingDays||0} working days)`} value={calc.netTotal} highlight />
          </div>
        </Section>
      )}

      {calc && (
        <Section title="Deductions" icon={AlertCircle} collapsible defaultOpen>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[["Employee PF","employeePF"],["Employee ESI","employeeESI"],["Professional Tax","ptax"],["TDS","tds"],["Advance","advance"],["Other","other"]].map(([label,key]) => (
              <Field key={key} label={label} type="number" suffix="&#8377;"
                value={dd[key] !== undefined ? dd[key] : (calc.deductions[key] || 0)}
                onChange={(v) => setDd((o) => ({ ...o, [key]: v }))} />
            ))}
            {Number(dd.other || 0) > 0 && (
              <Field label="Other — Label" value={dd.otherLabel || ""} onChange={(v) => setDd((o) => ({ ...o, otherLabel: v }))} className="col-span-2" />
            )}
          </div>
          <div className="border-t border-[#2a3340] pt-2"><CalcRow label="Total Deductions" value={calc.totalDeductions} /></div>
        </Section>
      )}

      {calc && (
        <Section title="Payroll Summary" icon={DollarSign}>
          <div className="space-y-1">
            <CalcRow label="Net Salary (Take-home)"  value={calc.netSalary} highlight />
            <CalcRow label="Employer PF"             value={calc.employerContributions.employerPF} dim />
            <CalcRow label="Employer ESI"            value={calc.employerContributions.employerESI} dim />
            <CalcRow label="CTC (Cost to Company)"   value={calc.ctc} highlight />
          </div>
        </Section>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 font-medium">Remarks (optional)</label>
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm border text-white bg-[#141a21] border-[#2a3340] focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
      </div>

      <div className="flex gap-3 pt-2 border-t border-[#1e2a35]">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-[#2a3340] text-gray-300 text-sm hover:bg-[#141a21] transition">Cancel</button>
        <button type="submit" disabled={saving || !calc} className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />{saving ? "Saving…" : isEdit ? "Update Payslip" : "Save as Draft"}
        </button>
      </div>
    </form>
  );
}

function PayslipViewer({ payslip }) {
  const sn = payslip.employeeSnapshot || {}, pc = payslip.paidComponents || {}, d = payslip.deductions || {}, ec = payslip.employerContributions || {}, emp = payslip.employee || {};
  return (
    <div className="space-y-4">
      <div className="text-center py-2">
        <p className="text-lg font-bold text-white">Pay Slip for {monthLabel(payslip.payPeriod)}</p>
        <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${payslip.isPublished ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"}`}>
          {payslip.isPublished ? "Published" : "Draft"}
        </span>
      </div>
      <div className="bg-[#0f1419] border border-[#1e2a35] rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
        {[["Name",sn.name||emp.name],["Employee ID",sn.employeeId||emp.employeeId],["Designation",sn.designation||"—"],["Department",formatDepartment(sn.department)||"—"],["Location",sn.location||"—"],["Date of Joining",sn.doj?new Date(sn.doj).toLocaleDateString("en-IN"):"—"],["PAN",sn.pan||"—"],["UAN",sn.uan||"—"],["PF No.",sn.pfNumber||"—"],["ESI No.",sn.esiNumber||"—"],["Bank A/c",sn.bankAccountNumber||"—"],["Bank",sn.bankName||"—"]].map(([k,v]) => (
          <div key={k} className="flex justify-between py-1 border-b border-[#1e2a35]"><span className="text-gray-500">{k}</span><span className="text-gray-200 font-medium">{v||"—"}</span></div>
        ))}
      </div>
      <div className="bg-[#0f1419] border border-[#1e2a35] rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 mb-2">Attendance</p>
        <div className="flex gap-6 text-sm flex-wrap">
          {[["Total Days",payslip.totalDays],["Working",payslip.workingDays],["Paid",payslip.paidDays],["LWP",payslip.lwp??0]].map(([k,v]) => (
            <div key={k}><span className="text-gray-500">{k}: </span><span className="text-white font-semibold">{v}</span></div>
          ))}
        </div>
      </div>
      <div className="bg-[#0f1419] border border-[#1e2a35] rounded-xl overflow-hidden">
        <div className="grid grid-cols-2">
          <div className="border-r border-[#1e2a35]">
            <div className="bg-[#141a21] px-3 py-2 text-xs font-semibold text-gray-300 flex justify-between"><span>Earnings</span><span>Amount</span></div>
            {[["Basic",pc.basic],["HRA",pc.hra],["Conveyance",pc.conveyance],["Medical",pc.medical],["Special Allowance",pc.specialAllowance]].map(([k,v]) => (
              <div key={k} className="px-3 py-1.5 flex justify-between text-xs border-b border-[#1e2a35]"><span className="text-gray-400">{k}</span><span className="text-gray-200 font-mono">{fmt(v)}</span></div>
            ))}
            <div className="px-3 py-2 flex justify-between text-xs font-semibold bg-[#141a21]"><span className="text-white">Net Total</span><span className="text-green-400 font-mono">{fmt(payslip.netTotal)}</span></div>
          </div>
          <div>
            <div className="bg-[#141a21] px-3 py-2 text-xs font-semibold text-gray-300 flex justify-between"><span>Deductions</span><span>Amount</span></div>
            {[["Employee PF",d.employeePF],["Employee ESI",d.employeeESI],["Professional Tax",d.ptax],...(d.tds?[["TDS",d.tds]]:[]),...(d.advance?[["Advance",d.advance]]:[]),...(d.other?[[d.otherLabel||"Other",d.other]]:[])].map(([k,v]) => (
              <div key={k} className="px-3 py-1.5 flex justify-between text-xs border-b border-[#1e2a35]"><span className="text-gray-400">{k}</span><span className="text-red-400 font-mono">{fmt(v)}</span></div>
            ))}
            <div className="px-3 py-2 flex justify-between text-xs font-semibold bg-[#141a21]"><span className="text-white">Total Deductions</span><span className="text-red-400 font-mono">{fmt(payslip.totalDeductions)}</span></div>
          </div>
        </div>
      </div>
      <div className="bg-[#0f1419] border border-[#1e2a35] rounded-xl p-4 space-y-2">
        <div className="flex justify-between font-bold"><span className="text-white">Net Salary</span><span className="text-green-400 font-mono text-base">&#8377;{fmt(payslip.netSalary)}</span></div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e2a35] text-xs">
          <div className="flex justify-between"><span className="text-gray-500">Employer PF</span><span className="text-gray-300">&#8377;{fmt(ec.employerPF)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Employer ESI</span><span className="text-gray-300">&#8377;{fmt(ec.employerESI)}</span></div>
          <div className="flex justify-between col-span-2 border-t border-[#1e2a35] pt-2"><span className="text-gray-400 font-semibold">CTC</span><span className="text-blue-400 font-semibold">&#8377;{fmt(payslip.ctc)}</span></div>
        </div>
      </div>
      {payslip.remarks && <div className="text-xs text-gray-400 bg-[#0f1419] border border-[#1e2a35] rounded-xl px-4 py-3"><span className="font-semibold text-gray-300">Remarks: </span>{payslip.remarks}</div>}
    </div>
  );
}

const SalaryManagement = ({ onLogout }) => {
  const [collapsed, setCollapsed]      = useState(false);
  const [employees, setEmployees]      = useState([]);
  const [payslips, setPayslips]        = useState([]);
  const [loading, setLoading]          = useState(true);
  const [panel, setPanel]              = useState(null);
  const [activePayslip, setActivePayslip] = useState(null);
  const [filterMonth, setFilterMonth]  = useState("");
  const [filterStatus, setFilterStatus]= useState("all");
  const [searchQuery, setSearchQuery]  = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/api/users?role=employee&limit=500`, { headers: authHeaders() })
      .then((r) => r.json()).then((data) => setEmployees(Array.isArray(data) ? data : (data.users || data.data || []))).catch(() => {});
  }, []);

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterMonth) params.set("month", filterMonth);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`${API_BASE}/api/payslips?${params}`, { headers: authHeaders() });
      const data = await res.json();
      setPayslips(data.data || []);
    } finally { setLoading(false); }
  }, [filterMonth, filterStatus]);

  useEffect(() => { fetchPayslips(); }, [fetchPayslips]);

  const handleTogglePublish = async (payslip) => {
    try {
      const res = await fetch(`${API_BASE}/api/payslips/${payslip._id}/publish`, { method: "PATCH", headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const updated = json.data;
      toast.success(updated.isPublished ? "Published — employee notified" : "Unpublished");
      setPayslips((prev) => prev.map((p) => p._id === payslip._id ? { ...p, isPublished: updated.isPublished } : p));
      if (activePayslip?._id === payslip._id) setActivePayslip((p) => ({ ...p, isPublished: updated.isPublished }));
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this payslip permanently?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/payslips/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted");
      setPayslips((prev) => prev.filter((p) => p._id !== id));
      if (activePayslip?._id === id) setPanel(null);
    } catch (err) { toast.error(err.message); }
  };

  const handleSaved = (saved) => {
    setPayslips((prev) => { const i = prev.findIndex((p) => p._id === saved._id); if (i >= 0) { const c = [...prev]; c[i] = saved; return c; } return [saved, ...prev]; });
    setPanel(null);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return payslips;
    const s = searchQuery.toLowerCase();
    return payslips.filter((p) => { const sn = p.employeeSnapshot||{}, em = p.employee||{}; return (sn.name||em.name||"").toLowerCase().includes(s)||(sn.employeeId||em.employeeId||"").toLowerCase().includes(s); });
  }, [payslips, searchQuery]);

  const stats = useMemo(() => ({ total: payslips.length, published: payslips.filter((p) => p.isPublished).length, draft: payslips.filter((p) => !p.isPublished).length }), [payslips]);

  return (
    <div className="salary-theme relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} onLogout={onLogout} userRole="admin" />
      <main className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${collapsed ? "app-offset app-offset-collapsed" : "app-offset"}`}>
        <header className="mx-auto mb-4 flex w-full max-w-[1500px] flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300"><DollarSign className="h-5 w-5" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payroll operations</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Salary management</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create, review, and publish employee payslips.</p></div>
          </div>
          <button onClick={() => { setPanel("create"); setActivePayslip(null); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"><Plus className="h-4 w-4" /> New payslip</button>
        </header>
        <div className="mx-auto w-full max-w-[1500px] space-y-4 pb-8">
          <div className="space-y-4">
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Payslip summary">
              {[{label:"Total",value:stats.total,icon:FileText},{label:"Published",value:stats.published,icon:BadgeCheck},{label:"Drafts",value:stats.draft,icon:Clock}].map(({label,value,icon:Icon})=>(
                <article key={label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
                  <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">{React.createElement(Icon, { className: "h-5 w-5" })}</div>
                  <div><p className="text-2xl font-semibold text-slate-950 dark:text-white">{value}</p><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p></div>
                </article>
              ))}
            </section>
            <section className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input placeholder="Search employee…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0f1419] border border-[#1e2a35] text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 rounded-lg bg-[#0f1419] border border-[#1e2a35] text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg bg-[#0f1419] border border-[#1e2a35] text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="all">All Status</option><option value="published">Published</option><option value="draft">Draft</option>
              </select>
            </section>
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-500"><DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No payslips found. Click "New Payslip" to get started.</p></div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#10131c]">
                <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-white/[0.025] dark:text-slate-400">
                    <tr><th className="px-4 py-3 text-left">Employee</th><th className="px-4 py-3 text-left">Period</th><th className="px-4 py-3 text-right">Net Salary</th><th className="px-4 py-3 text-right">CTC</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                    {filtered.map((p) => {
                    // Light-mode remaps in index.css match class substrings and cannot see the
                    // dark:/hover: prefix, so a bg-white/... , bg-gray-800 or bg-slate-700/30
                    // spelling here gets repainted in light mode and this row's selected/
                    // highlight tint is lost. The rgb()/rgba() arbitrary value is the same
                    // colour the rule cannot match. Do not "tidy" it back.
                      const sn = p.employeeSnapshot||{}, em = p.employee||{};
                      return (
                        <tr key={p._id} className={`cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[rgba(255,255,255,0.025)] ${activePayslip?._id===p._id?"bg-blue-50/60 dark:bg-blue-400/[0.05]":""}`}>
                          <td className="px-4 py-3" onClick={() => { setActivePayslip(p); setPanel("view"); }}><p className="text-white font-medium">{sn.name||em.name||"—"}</p><p className="text-xs text-gray-500">{sn.employeeId||em.employeeId}</p></td>
                          <td className="px-4 py-3 text-gray-300" onClick={() => { setActivePayslip(p); setPanel("view"); }}>{monthLabel(p.payPeriod)}</td>
                          <td className="px-4 py-3 text-right font-mono text-green-400">&#8377;{fmt(p.netSalary)}</td>
                          <td className="px-4 py-3 text-right font-mono text-blue-400">&#8377;{fmt(p.ctc)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${p.isPublished?"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300":"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300"}`}>
                              {p.isPublished?<BadgeCheck className="w-3 h-3"/>:<Clock className="w-3 h-3"/>}{p.isPublished?"Published":"Draft"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => { setActivePayslip(p); setPanel("view"); }} className="p-1.5 rounded hover:bg-[#2a3340] text-gray-400 hover:text-white transition" title="View"><Eye className="w-4 h-4" /></button>
                              <button onClick={() => { setActivePayslip(p); setPanel("edit"); }} className="p-1.5 rounded hover:bg-[#2a3340] text-gray-400 hover:text-white transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleTogglePublish(p)} className={`p-1.5 rounded transition ${p.isPublished?"hover:bg-red-500/20 text-green-400 hover:text-red-400":"hover:bg-green-500/20 text-gray-400 hover:text-green-400"}`} title={p.isPublished?"Unpublish":"Publish"}>
                                {p.isPublished?<RotateCcw className="w-4 h-4"/>:<Send className="w-4 h-4"/>}
                              </button>
                              <button onClick={() => handleDelete(p._id)} className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table></div>
              </div>
            )}
          </div>
          {panel && (
            <>
            <button type="button" className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm" onClick={() => setPanel(null)} aria-label="Close payslip panel" />
            <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-slate-50 shadow-2xl dark:border-white/10 dark:bg-[#0b0d12]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#10131c]">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">{panel==="create"?"New payslip":panel==="edit"?"Edit payslip":"Payslip detail"}</h2>
                <div className="flex items-center gap-2">
                  {panel==="view"&&activePayslip&&(
                    <button onClick={() => handleTogglePublish(activePayslip)} className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${activePayslip.isPublished?"border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-400/25 dark:bg-rose-400/10 dark:text-rose-300":"border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300"}`}>
                      {activePayslip.isPublished?<><RotateCcw className="w-3 h-3"/>Unpublish</>:<><Send className="w-3 h-3"/>Publish</>}
                    </button>
                  )}
                  <button onClick={() => setPanel(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/[0.05] dark:hover:text-white"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {panel==="view"&&activePayslip&&<PayslipViewer payslip={activePayslip}/>}
                {panel==="create"&&<PayslipForm employees={employees} editPayslip={null} onSaved={handleSaved} onClose={() => setPanel(null)}/>}
                {panel==="edit"&&activePayslip&&<PayslipForm employees={employees} editPayslip={activePayslip} onSaved={handleSaved} onClose={() => setPanel(null)}/>}
              </div>
            </aside>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SalaryManagement;
