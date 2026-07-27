import React, { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";

const PROJECT_TYPES = ["Website", "SEO", "Google Marketing", "SMO", "Hosting", "Invoice App"];
const PRIORITIES = ["Low", "Medium", "High"];
const STATUSES = ["new", "ongoing", "completed", "expired"];

const toDateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const emptyForm = {
  projectName: "",
  type: [],
  clients: [],
  assignedTo: [],
  startDate: "",
  endDate: "",
  priority: "Medium",
  status: "new",
  budget: "",
  description: "",
  remarks: "",
};

const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white";
const selectClass =
  "h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-[#151923] dark:text-white";
const textareaClass =
  "w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.035] dark:text-white";

const Field = ({ label, required, error, children }) => (
  <div>
    <label className={labelClass}>
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
  </div>
);

const Chip = ({ children, onRemove }) => (
  <div className="flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
    <span className="max-w-[160px] truncate">{children}</span>
    <button type="button" onClick={onRemove} className="text-blue-400 transition hover:text-blue-700 dark:hover:text-blue-100">
      <X className="h-3 w-3" />
    </button>
  </div>
);

const CheckboxList = ({ items, selectedIds, onToggle, getId, getLabel, getSubLabel, searchable, emptyText }) => {
  const [search, setSearch] = useState("");
  const filtered = searchable
    ? items.filter((item) => getLabel(item).toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#151923]">
      {searchable && (
        <div className="relative border-b border-slate-200 p-2 dark:border-white/10">
          <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-white"
          />
        </div>
      )}
      <div className="max-h-40 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-slate-400">{emptyText || "No results"}</div>
        )}
        {filtered.map((item) => {
          const id = getId(item);
          const checked = selectedIds.includes(id);
          return (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.04]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(id)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20"
              />
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{getLabel(item)}</span>
              {getSubLabel && <span className="shrink-0 text-xs text-slate-400">{getSubLabel(item)}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Add/Edit project modal. The backend contract (see server/routes/projectRoutes.js
 * POST "/" and PUT "/:id") requires projectName, type[], clients[], startDate,
 * endDate; assignedTo/budget/description/remarks/priority/status are optional
 * there but assignedTo is treated as required here since a project with nobody
 * assigned isn't a meaningful state to create from the UI.
 *
 * This component only builds the payload and validates it — the actual
 * POST/PUT call, success toast, and refetch are owned by the parent (passed
 * in as onSubmit), matching the pattern used by EmployeeFormModal.
 */
const ProjectFormModal = ({ isEditing, project, clients = [], employees = [], onClose, onSubmit }) => {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing && project) {
      setForm({
        projectName: project.projectName || "",
        type: Array.isArray(project.type) ? project.type : [],
        clients: (project.clients || []).map((c) => c?._id || c).filter(Boolean),
        assignedTo: (project.assignedTo || []).map((u) => u?._id || u).filter(Boolean),
        startDate: toDateInputValue(project.startDate),
        endDate: toDateInputValue(project.endDate),
        priority: project.priority || "Medium",
        status: project.status || "new",
        budget: project.budget ?? "",
        description: project.description || "",
        remarks: project.remarks || "",
      });
    } else {
      setForm(emptyForm);
    }
    setErrors({});
  }, [isEditing, project]);

  const toggleIn = (field, id) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id) ? prev[field].filter((x) => x !== id) : [...prev[field], id],
    }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.projectName.trim()) e.projectName = "Project name is required";
    if (form.type.length === 0) e.type = "Select at least one service";
    if (form.clients.length === 0) e.clients = "Select at least one client";
    if (form.assignedTo.length === 0) e.assignedTo = "Assign at least one employee";
    if (!form.startDate) e.startDate = "Start date is required";
    if (!form.endDate) e.endDate = "End date is required";
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      e.endDate = "End date must be after start date";
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      ...form,
      budget: form.budget === "" ? undefined : Number(form.budget),
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#10131c]">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
            {isEditing ? "Edit Project" : "Add New Project"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <Field label="Project Name" required error={errors.projectName}>
              <input
                type="text"
                value={form.projectName}
                onChange={(e) => setField("projectName", e.target.value)}
                className={inputClass}
                placeholder="e.g. Acme Corp Website Revamp"
              />
            </Field>

            <Field label="Services" required error={errors.type}>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TYPES.map((t) => {
                  const checked = form.type.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => toggleIn("type", t)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        checked
                          ? "border-blue-500 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Clients" required error={errors.clients}>
              <CheckboxList
                items={clients}
                selectedIds={form.clients}
                onToggle={(id) => toggleIn("clients", id)}
                getId={(c) => c._id}
                getLabel={(c) => c.businessName || c.clientName}
                getSubLabel={(c) => c.clientName && c.businessName ? c.clientName : ""}
                searchable
                emptyText="No clients found"
              />
              {form.clients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.clients.map((id) => {
                    const c = clients.find((x) => x._id === id);
                    if (!c) return null;
                    return (
                      <Chip key={id} onRemove={() => toggleIn("clients", id)}>
                        {c.businessName || c.clientName}
                      </Chip>
                    );
                  })}
                </div>
              )}
            </Field>

            <Field label="Assign To" required error={errors.assignedTo}>
              <CheckboxList
                items={employees}
                selectedIds={form.assignedTo}
                onToggle={(id) => toggleIn("assignedTo", id)}
                getId={(u) => u._id}
                getLabel={(u) => u.name}
                getSubLabel={(u) => u.designation || u.department || ""}
                searchable
                emptyText="No employees found"
              />
              {form.assignedTo.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.assignedTo.map((id) => {
                    const u = employees.find((x) => x._id === id);
                    if (!u) return null;
                    return (
                      <Chip key={id} onRemove={() => toggleIn("assignedTo", id)}>
                        {u.name}
                      </Chip>
                    );
                  })}
                </div>
              )}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Start Date" required error={errors.startDate}>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="End Date" required error={errors.endDate}>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Priority">
                <select value={form.priority} onChange={(e) => setField("priority", e.target.value)} className={selectClass}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(e) => setField("status", e.target.value)} className={selectClass}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </Field>
              <Field label="Budget">
                <input
                  type="number"
                  min="0"
                  value={form.budget}
                  onChange={(e) => setField("budget", e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className={textareaClass}
                placeholder="Project description..."
              />
            </Field>

            <Field label="Remarks">
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setField("remarks", e.target.value)}
                className={textareaClass}
                placeholder="Additional remarks..."
              />
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-5 mt-5 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 pb-1 pt-4 dark:border-white/10 dark:bg-[#10131c]">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.07]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectFormModal;
