import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  RefreshCw,
  Play,
  AlertTriangle,
  Undo2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileText,
  Check,
  Loader2,
  X,
} from "lucide-react";

/**
 * The payroll register — every employee for a month as one editable row,
 * laid out like the payroll sheet.
 *
 * ─── WHY THE ARITHMETIC IS NOT DONE HERE ───
 * Editing a cell posts the row's inputs back to /register/price, which runs
 * the same calculateSalaryBreakdown that generation runs, and the response
 * replaces the derived columns. The browser deliberately does no payroll
 * maths: this screen previously re-implemented the formula locally, so an
 * admin could approve a figure the server would never have produced.
 *
 * Editable cells are the inputs an admin actually decides — days, paid days,
 * salary, the two statutory Y/N flags, and the three manual deductions.
 * Everything else is derived and read-only.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Which cells accept a double-click, and how each is parsed.
const EDITABLE = {
  days: { type: "number", min: 1, max: 31 },
  paidDays: { type: "number", min: 0, max: 31, step: 0.5 },
  salary: { type: "number", min: 0 },
  pfEligible: { type: "boolean" },
  esiEligible: { type: "boolean" },
  tds: { type: "number", min: 0 },
  // The late-arrival penalty. Arrives filled in with what the late policy
  // produced; editing it overrules the rule for this employee and month.
  late: { type: "number", min: 0 },
  other: { type: "number", min: 0 },
  advance: { type: "number", min: 0 },
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(value) || 0);

const plain = (value) => {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** "2026-08" + 1 -> "2026-09". Built from date parts so December rolls over. */
const shiftMonth = (period, delta) => {
  const [year, month] = String(period).split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (period) => {
  if (!MONTH_RE.test(period || "")) return period || "";
  const [year, month] = period.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

const PayrollRegister = ({ payPeriod, onClose, onPayPeriodChange }) => {
  // The month lives here, not only in the parent.
  //
  // This screen covers the whole viewport, so the month picker behind it is
  // unreachable while it is open — the register was locked to whatever month
  // happened to be selected when it was opened. Seeded from the prop and
  // pushed back through onPayPeriodChange, so the two never disagree.
  const [period, setPeriod] = useState(payPeriod);
  const [discarded, setDiscarded] = useState(null);

  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [pfFilter, setPfFilter] = useState("all");
  const [esiFilter, setEsiFilter] = useState("all");
  const [editedOnly, setEditedOnly] = useState(false);

  // employeeId -> the inputs it was loaded with, so edits can be reverted
  const [edited, setEdited] = useState({});
  const [editing, setEditing] = useState(null); // { employeeId, field }
  const [draft, setDraft] = useState("");
  const [pricing, setPricing] = useState({});

  // Per-employee generation: which row is in flight, and which row is waiting
  // for a second click before it replaces a payslip that already exists.
  const [rowBusy, setRowBusy] = useState({});
  const [confirmReplace, setConfirmReplace] = useState(null);

  // Which row has its "where did the money go" breakdown open.
  const [expanded, setExpanded] = useState(null);

  const inputRef = useRef(null);
  const pendingRef = useRef({});
  const timerRef = useRef(null);

  const token = localStorage.getItem("token");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/auto-payroll/register/${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not load the register");
      const loaded = data.rows || [];
      setRows(loaded);
      setErrors(data.errors || []);

      // Corrections saved earlier come back marked as edited, with the figure
      // they replaced, so the amber highlight and the undo arrow survive a
      // reload instead of the row looking untouched while carrying an
      // override.
      const restored = {};
      for (const row of loaded) {
        if (row.override && row.override.fields?.length) {
          restored[String(row.employee._id)] = row.override.derived || {};
        }
      }
      setEdited(restored);
    } catch (err) {
      setLoadError(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [period, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Follow the parent if it changes the month behind us.
  useEffect(() => {
    if (MONTH_RE.test(payPeriod || "")) setPeriod(payPeriod);
  }, [payPeriod]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  /** Send changed rows to the server to be re-priced. Debounced, batched. */
  const schedulePricing = useCallback(
    (employeeId, inputs) => {
      pendingRef.current[employeeId] = inputs;
      setPricing((prev) => ({ ...prev, [employeeId]: true }));

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const batch = Object.entries(pendingRef.current).map(([id, rowInputs]) => ({
          employeeId: id,
          inputs: rowInputs,
        }));
        pendingRef.current = {};
        if (!batch.length) return;

        try {
          const res = await fetch(`${API_BASE}/api/auto-payroll/register/price`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ rows: batch }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || "Could not re-price");

          const byId = new Map(data.rows.map((r) => [String(r.employeeId), r]));
          setRows((prev) =>
            prev.map((row) => {
              const priced = byId.get(String(row.employee._id));
              return priced ? { ...row, ...priced } : row;
            })
          );
        } catch (err) {
          setLoadError(err.message);
        } finally {
          setPricing((prev) => {
            const next = { ...prev };
            batch.forEach(({ employeeId: id }) => delete next[id]);
            return next;
          });
        }
      }, 350);
    },
    [token]
  );

  /**
   * Write one correction down.
   *
   * Editing a cell used to change React state and nothing else, so a paid-day
   * count corrected from 16.5 to 21 went straight back to 16.5 on the next
   * reload — silently, because the row looked untouched. A correction to paid
   * days is a correction to somebody's pay; it belongs in the database, with a
   * name against it.
   */
  const saveOverride = useCallback(
    async (employeeId, patch) => {
      try {
        const res = await fetch(`${API_BASE}/api/auto-payroll/register/override`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ payPeriod: period, employeeId, inputs: patch }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Could not save the change");
      } catch (err) {
        // Loud, because the alternative is an admin believing a correction was
        // kept when it was not.
        setLoadError(`Change not saved — ${err.message}`);
      }
    },
    [period, token]
  );

  const commit = useCallback(
    (row, field, rawValue) => {
      const spec = EDITABLE[field];
      if (!spec) return;

      let value;
      if (spec.type === "boolean") {
        value = rawValue === true || rawValue === "Y" || rawValue === "true";
      } else {
        const n = Number(rawValue);
        if (rawValue === "" || Number.isNaN(n)) return;
        value = Math.max(spec.min ?? -Infinity, Math.min(spec.max ?? Infinity, n));
      }

      const id = String(row.employee._id);
      if (row.inputs[field] === value) return;

      setEdited((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), [field]: prev[id]?.[field] ?? row.inputs[field] },
      }));

      const inputs = { ...row.inputs, [field]: value };
      setRows((prev) =>
        prev.map((r) => (String(r.employee._id) === id ? { ...r, inputs } : r))
      );
      schedulePricing(id, inputs);
      saveOverride(id, { [field]: value });
    },
    [schedulePricing, saveOverride]
  );

  const revertRow = useCallback(
    (row) => {
      const id = String(row.employee._id);
      const original = edited[id];
      if (!original) return;

      const inputs = { ...row.inputs, ...original };
      setRows((prev) =>
        prev.map((r) =>
          String(r.employee._id) === id ? { ...r, inputs, override: null } : r
        )
      );
      setEdited((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      schedulePricing(id, inputs);

      // Undo has to reach the database too, or the row comes back corrected.
      fetch(`${API_BASE}/api/auto-payroll/register/override`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ payPeriod: period, employeeId: id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.success) throw new Error(data.error || "Could not undo");
        })
        .catch((err) => setLoadError(`Undo not saved — ${err.message}`));
    },
    [edited, schedulePricing, period, token]
  );

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.employee.department).filter(Boolean))].sort(),
    [rows]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const e = row.employee;
      if (q && ![e.name, e.employeeId, e.designation, e.department]
        .some((v) => (v || "").toLowerCase().includes(q))) return false;
      if (department !== "all" && e.department !== department) return false;
      if (pfFilter !== "all" && row.pfEligible !== (pfFilter === "Y")) return false;
      if (esiFilter !== "all" && row.esiEligible !== (esiFilter === "Y")) return false;
      if (editedOnly && !edited[String(e._id)]) return false;
      return true;
    });
  }, [rows, search, department, pfFilter, esiFilter, editedOnly, edited]);

  const issuedCount = useMemo(
    () => rows.filter((r) => r.payslip?.exists).length,
    [rows]
  );

  const totals = useMemo(
    () =>
      visible.reduce(
        (acc, r) => ({
          net: acc.net + (r.netPayment || 0),
          deductions: acc.deductions + (r.deductions?.total || 0),
          ctc: acc.ctc + (r.ctc || 0),
        }),
        { net: 0, deductions: 0, ctc: 0 }
      ),
    [visible]
  );

  /**
   * Move to another month.
   *
   * Edits are inputs to a calculation that has not been saved anywhere, so
   * changing month drops them. That is fine, but it must not be silent —
   * somebody who typed twelve corrections and clicked the arrow deserves to be
   * told they are gone rather than discovering it at the totals.
   */
  const changePeriod = useCallback(
    (next) => {
      if (!MONTH_RE.test(next || "") || next === period) return;

      const pending = Object.keys(edited).length;
      setDiscarded(
        pending
          ? `${pending} unsaved edit${pending === 1 ? "" : "s"} discarded when the month changed.`
          : null
      );
      setConfirmReplace(null);
      setPeriod(next);
      if (typeof onPayPeriodChange === "function") onPayPeriodChange(next);
    },
    [period, edited, onPayPeriodChange]
  );

  /**
   * Issue a payslip for ONE employee.
   *
   * The same endpoint the bulk run uses, with a single row — so a payslip
   * issued from here and one issued from the bulk button come out of the same
   * calculation. `replace` maps to skipExisting: false, which deletes the
   * existing payslip and writes a new one, so it takes a second click.
   */
  const generateRow = useCallback(
    async (row, { replace = false } = {}) => {
      const id = String(row.employee._id);
      setConfirmReplace(null);
      setRowBusy((prev) => ({ ...prev, [id]: true }));
      setResult(null);

      try {
        const res = await fetch(`${API_BASE}/api/auto-payroll/register/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            payPeriod: period,
            skipExisting: !replace,
            rows: [{ employeeId: id, inputs: row.inputs }],
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Generation failed");

        const detail = (data.details || [])[0] || {};
        if (detail.status === "failed") throw new Error(detail.error || "Generation failed");

        if (detail.status === "generated") {
          setRows((prev) =>
            prev.map((r) =>
              String(r.employee._id) === id
                ? {
                    ...r,
                    payslip: {
                      exists: true,
                      id: detail.payslipId,
                      netSalary: detail.netSalary,
                      isPublished: false,
                    },
                  }
                : r
            )
          );
          setEdited((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }

        setResult({
          single: true,
          message:
            detail.status === "generated"
              ? `${row.employee.name}: payslip ${replace ? "replaced" : "generated"} for ${monthLabel(period)}.`
              : `${row.employee.name}: ${detail.reason || "nothing to do"}.`,
        });
      } catch (err) {
        setResult({ error: `${row.employee.name}: ${err.message}` });
      } finally {
        setRowBusy((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [period, token]
  );

  const generate = async () => {
    if (!visible.length) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/auto-payroll/register/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          payPeriod: period,
          skipExisting: true,
          rows: visible.map((r) => ({ employeeId: r.employee._id, inputs: r.inputs })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Generation failed");
      setResult(data);
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setGenerating(false);
    }
  };

  // ── cells ───────────────────────────────────────────────────────────
  //
  // A plain function, NOT a component. Declared inside the component body it
  // would be a new component type on every render, so React would unmount and
  // remount the <input> on each keystroke and the caret would jump out of the
  // cell after one character.
  const cell = (row, field, value, format = plain) => {
    const id = String(row.employee._id);
    const spec = EDITABLE[field];
    const isEditing = editing?.employeeId === id && editing?.field === field;
    const isChanged = Boolean(edited[id] && field in edited[id]);

    if (!spec) {
      return (
        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
          {format(value)}
        </td>
      );
    }

    if (spec.type === "boolean") {
      // A button, and one click.
      //
      // These were plain text that toggled on DOUBLE-click, which is both
      // invisible and the wrong gesture: nothing on the cell said it could be
      // changed, so the PF and ESI columns read as fixed facts. They are the
      // two switches on this sheet an admin most often has to flip.
      //
      // Flipping one re-prices the whole row on the server — EE-PF, the ESI
      // deduction, Total Deduction, Net Payment, the employer contributions
      // and CTC all follow — so the row is never left half-consistent.
      const label = field === "pfEligible" ? "PF" : "ESI";
      return (
        <td className={`px-1 py-1 text-center whitespace-nowrap ${isChanged ? "bg-amber-500/15" : ""}`}>
          <button
            type="button"
            aria-pressed={value}
            onClick={() => commit(row, field, !value)}
            title={`${label} is ${value ? "Y" : "N"} for ${row.employee.name} — click to switch it to ${
              value ? "N" : "Y"
            }. Every figure that depends on it is recalculated.`}
            className={`w-7 h-6 rounded font-semibold text-[11px] leading-none transition-colors ${
              value
                ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/35"
                : "bg-[#232945] text-gray-400 hover:bg-[#2c3450] hover:text-gray-200"
            } ${isChanged ? "ring-1 ring-amber-400/60" : ""}`}
          >
            {value ? "Y" : "N"}
          </button>
        </td>
      );
    }

    if (isEditing) {
      return (
        <td className="px-1 py-0.5 bg-blue-500/20">
          <input
            ref={inputRef}
            type="number"
            step={spec.step || 1}
            className="w-24 bg-[#0b0f18] text-white text-right px-1 py-0.5 rounded outline-none ring-1 ring-blue-400"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              commit(row, field, draft);
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commit(row, field, draft);
                setEditing(null);
              } else if (e.key === "Escape") {
                setEditing(null);
              }
            }}
          />
        </td>
      );
    }

    return (
      <td
        className={`px-2 py-1.5 text-right whitespace-nowrap tabular-nums cursor-cell ${
          isChanged ? "bg-amber-500/15 text-amber-200" : "text-blue-200"
        }`}
        onDoubleClick={() => {
          // Two decimals, not the raw float: a cell showing 986.67 must open
          // an editor on 986.67, not 986.6666666666666.
          const n = Number(value);
          setDraft(Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(value ?? ""));
          setEditing({ employeeId: id, field });
        }}
        title="Double-click to edit"
      >
        {format(value)}
      </td>
    );
  };

  const th = "px-2 py-2 text-xs font-semibold whitespace-nowrap";
  const group = "px-2 py-1 text-[10px] uppercase tracking-wider text-center border-l border-[#2a3346]";

  return (
    <div className="fixed inset-0 z-50 bg-[#070a12]/95 backdrop-blur-sm flex flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-[#232945] bg-[#0d1220]">
        <div>
          <h2 className="text-lg font-semibold text-white">Payroll Register</h2>
          <p className="text-xs text-gray-400">
            {visible.length} of {rows.length} employees
            {issuedCount > 0 && (
              <span className="text-emerald-300"> · {issuedCount} already issued</span>
            )}
            {Object.keys(edited).length > 0 && (
              <span className="text-amber-300"> · {Object.keys(edited).length} edited</span>
            )}
          </p>
        </div>

        {/* Month. Arrows for stepping, the picker for jumping. */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => changePeriod(shiftMonth(period, -1))}
            disabled={loading}
            title="Previous month"
            className="p-1.5 rounded-lg bg-[#1a2032] text-gray-300 hover:bg-[#232945] disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="month"
            value={period}
            onChange={(e) => changePeriod(e.target.value)}
            disabled={loading}
            title={monthLabel(period)}
            className="bg-[#0f1419] border border-[#232945] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
          />

          <button
            onClick={() => changePeriod(shiftMonth(period, 1))}
            disabled={loading}
            title="Next month"
            className="p-1.5 rounded-lg bg-[#1a2032] text-gray-300 hover:bg-[#232945] disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="relative ml-2">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="w-64 bg-[#0f1419] border border-[#232945] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 outline-none focus:border-blue-500"
            placeholder="Search name, ID, designation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="bg-[#0f1419] border border-[#232945] rounded-lg px-2 py-1.5 text-sm text-white"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select
          className="bg-[#0f1419] border border-[#232945] rounded-lg px-2 py-1.5 text-sm text-white"
          value={pfFilter}
          onChange={(e) => setPfFilter(e.target.value)}
        >
          <option value="all">PF: any</option>
          <option value="Y">PF: Y</option>
          <option value="N">PF: N</option>
        </select>

        <select
          className="bg-[#0f1419] border border-[#232945] rounded-lg px-2 py-1.5 text-sm text-white"
          value={esiFilter}
          onChange={(e) => setEsiFilter(e.target.value)}
        >
          <option value="all">ESI: any</option>
          <option value="Y">ESI: Y</option>
          <option value="N">ESI: N</option>
        </select>

        <label className="flex items-center gap-1.5 text-sm text-gray-300">
          <input type="checkbox" checked={editedOnly} onChange={(e) => setEditedOnly(e.target.checked)} />
          Edited only
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a2032] text-gray-200 text-sm hover:bg-[#232945] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Reload
          </button>
          <button
            onClick={generate}
            disabled={generating || !visible.length}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-medium hover:from-green-700 disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> Generate {visible.length} payslip{visible.length === 1 ? "" : "s"}
          </button>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-[#1a2032] text-gray-300 text-sm hover:bg-[#232945]">
            Close
          </button>
        </div>
      </div>

      {/* Messages */}
      {loadError && (
        <div className="px-4 py-2 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {loadError}
        </div>
      )}
      {errors.length > 0 && (
        <div className="px-4 py-2 bg-amber-500/10 text-amber-200 text-sm">
          {errors.length} employee(s) could not be calculated: {errors.map((e) => `${e.name} (${e.error})`).join("; ")}
        </div>
      )}
      {discarded && (
        <div className="px-4 py-2 bg-amber-500/10 text-amber-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {discarded}
          <button
            onClick={() => setDiscarded(null)}
            className="ml-auto text-amber-300/70 hover:text-amber-100"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {result && (
        <div className={`px-4 py-2 text-sm ${result.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-200"}`}>
          {result.error
            ? result.error
            : result.single
            ? result.message
            : `Generated ${result.generated}, skipped ${result.skipped}, failed ${result.failed}.`}
        </div>
      )}

      {/* Register */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Building the register…</div>
        ) : (
          <table className="text-xs text-gray-200 border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0d1220] text-gray-300">
              {/*
                The banded row of the payroll sheet. Every colSpan below is
                counted against the body row — 35 columns — because a band that
                is even one column short slides every heading after it onto the
                wrong figures, and the sheet is unreadable without being
                obviously broken.

                  8  identity: Sl. No -> IFSC
                  1  Salary
                  6  Salary Component
                  6  Gross Earnings
                  2  PF-Y/N, ESI-Y/N
                  7  Deductions from Salary
                  1  Total Deduction
                  1  Net Payment
                  2  Employer's Contribution
                  1  CTC
                  1  row actions
              */}
              <tr className="border-b border-[#232945]">
                <th className={group} colSpan={8}></th>
                <th className={`${group} bg-[#11162a]`} colSpan={1}></th>
                <th className={`${group} bg-[#151b2e] text-gray-200`} colSpan={6}>Salary Component</th>
                <th className={`${group} bg-[#122019] text-emerald-200`} colSpan={6}>Gross Earnings</th>
                <th className={group} colSpan={2}></th>
                <th className={`${group} bg-[#201812] text-amber-200`} colSpan={7}>Deductions from Salary</th>
                <th className={group} colSpan={1}></th>
                <th className={`${group} bg-[#122019] text-emerald-200`} colSpan={1}>Net Payment</th>
                <th className={`${group} bg-[#151b2e] text-gray-200`} colSpan={2}>Employer&rsquo;s Contribution</th>
                <th className={group} colSpan={1}></th>
                <th className={group} colSpan={1}></th>
              </tr>
              <tr className="border-b border-[#232945]">
                <th className={`${th} text-left sticky left-0 bg-[#0d1220]`}>Sl. No</th>
                <th className={`${th} text-left`}>Employee ID</th>
                <th className={`${th} text-left`}>Name</th>
                <th className={`${th} text-left`}>Designation</th>
                <th className={`${th} text-right`}>Days</th>
                <th className={`${th} text-right`}>Paid Days</th>
                <th className={`${th} text-left`}>Bank A/c</th>
                <th className={`${th} text-left`}>IFSC</th>
                <th className={`${th} text-right`}>Salary</th>
                <th className={`${th} text-right`}>Basic</th>
                <th className={`${th} text-right`}>HRA</th>
                <th className={`${th} text-right`}>Conveyance</th>
                <th className={`${th} text-right`}>Medical</th>
                <th className={`${th} text-right`}>Spl. Allow</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-right`}>Basic</th>
                <th className={`${th} text-right`}>HRA</th>
                <th className={`${th} text-right`}>Conveyance</th>
                <th className={`${th} text-right`}>Medical</th>
                <th className={`${th} text-right`}>Spl. Allow</th>
                <th className={`${th} text-right`}>Net Total</th>
                <th className={`${th} text-center`}>PF-Y/N</th>
                <th className={`${th} text-center`}>ESI-Y/N</th>
                <th className={`${th} text-right`}>EE-PF</th>
                <th className={`${th} text-right`}>ESI</th>
                <th className={`${th} text-right`}>TDS</th>
                <th className={`${th} text-right`}>Ptax</th>
                <th className={`${th} text-right`}>Late</th>
                <th className={`${th} text-right`}>Other / Penalty</th>
                <th className={`${th} text-right`}>Advance</th>
                <th className={`${th} text-right`}>Total Deduction</th>
                <th className={`${th} text-right`}>Salary</th>
                <th className={`${th} text-right`}>PF</th>
                <th className={`${th} text-right`}>ESI</th>
                <th className={`${th} text-right`}>CTC</th>
                <th className={`${th} text-center`}>Payslip</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const id = String(row.employee._id);
                const isEdited = Boolean(edited[id]);
                const why = row.explanation;
                return (
                  <React.Fragment key={id}>
                  <tr
                    className={`border-b border-[#1a2032] hover:bg-[#111726] ${
                      isEdited ? "bg-amber-500/[0.04]" : ""
                    } ${pricing[id] ? "opacity-60" : ""}`}
                  >
                    <td className="px-2 py-1.5 text-gray-500 sticky left-0 bg-inherit">{index + 1}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono text-gray-300">{row.employee.employeeId}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-white">{row.employee.name}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-gray-400">{row.employee.designation}</td>

                    {cell(row, "days", row.inputs.days)}
                    {cell(row, "paidDays", row.inputs.paidDays)}

                    {/*
                      Bank account and IFSC come straight off the employee
                      record — they are what the payment file is built from, so
                      the sheet carries them and a blank here is a payment that
                      cannot be made. Read-only: they are employee master data,
                      edited on the employee's own page, not per month.
                    */}
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono text-gray-300">
                      {row.employee.bankAccountNumber || (
                        <span className="text-amber-400/70 italic font-sans">missing</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono text-gray-300">
                      {row.employee.ifscCode || (
                        <span className="text-amber-400/70 italic font-sans">missing</span>
                      )}
                    </td>

                    {cell(row, "salary", row.inputs.salary, money)}

                    {cell(row, "_", row.components.basic, money)}
                    {cell(row, "_", row.components.hra, money)}
                    {cell(row, "_", row.components.conveyance, money)}
                    {cell(row, "_", row.components.medical, money)}
                    {cell(row, "_", row.components.specialAllowance, money)}
                    {cell(row, "_", row.components.total, money)}

                    {cell(row, "_", row.earnings.basic, money)}
                    {cell(row, "_", row.earnings.hra, money)}
                    {cell(row, "_", row.earnings.conveyance, money)}
                    {cell(row, "_", row.earnings.medical, money)}
                    {cell(row, "_", row.earnings.specialAllowance, money)}
                    {cell(row, "_", row.earnings.netTotal, money)}

                    {cell(row, "pfEligible", row.pfEligible)}
                    {cell(row, "esiEligible", row.esiEligible)}

                    {cell(row, "_", row.deductions.employeePF, money)}
                    {cell(row, "_", row.deductions.esi, money)}
                    {cell(row, "tds", row.inputs.tds, money)}
                    {cell(row, "_", row.deductions.ptax, money)}
                    {/*
                      Late: editable, and it shows what is CHARGED, not what
                      was typed.
                      Unlike TDS or Advance this column has a rule behind it,
                      so the two can differ — an untouched row has no typed
                      value at all while the late policy is still charging for
                      the late days. Rendering the input would print 0.00 in
                      the column while the total quietly carried the penalty,
                      which is the exact confusion this column exists to end.
                      Editing it writes to inputs.late and overrules the rule.
                    */}
                    {cell(row, "late", row.deductions.late, money)}
                    {cell(row, "other", row.inputs.other, money)}
                    {cell(row, "advance", row.inputs.advance, money)}
                    {/*
                      Total Deduction opens the breakdown.
                      Four of the six deduction columns are things nobody on
                      this screen entered — PF, ESI, professional tax, and a
                      late-day penalty hidden inside "Other / Penalty" — so the
                      total is reliably larger than the part an admin
                      recognises. Being able to ask the row why is the
                      difference between a payslip and a demand.
                    */}
                    <td
                      onClick={() => setExpanded(expanded === id ? null : id)}
                      title="Show how this total was worked out"
                      className={`px-2 py-1.5 text-right whitespace-nowrap tabular-nums cursor-pointer select-none border-b border-dotted border-gray-600 hover:bg-[#1a2032] ${
                        expanded === id ? "bg-[#1a2032] text-white" : ""
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <ChevronDown
                          className={`w-3 h-3 text-gray-500 transition-transform ${
                            expanded === id ? "" : "-rotate-90"
                          }`}
                        />
                        {money(row.deductions.total)}
                      </span>
                    </td>

                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums font-semibold text-emerald-300">
                      {money(row.netPayment)}
                    </td>

                    {cell(row, "_", row.employer.pf, money)}
                    {cell(row, "_", row.employer.esi, money)}
                    {cell(row, "_", row.ctc, money)}

                    {/*
                      One employee at a time.
                      Bulk generation covers everyone the filters leave visible,
                      which is the wrong tool for "re-issue this one person's
                      payslip because their paid days were wrong". Same endpoint,
                      one row, so it is the same calculation either way.
                    */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEdited && (
                          <button
                            onClick={() => revertRow(row)}
                            title={
                              row.override
                                ? `Corrected${
                                    row.override.updatedByName ? ` by ${row.override.updatedByName}` : ""
                                  }${
                                    row.override.updatedAt
                                      ? ` on ${new Date(row.override.updatedAt).toLocaleString("en-IN")}`
                                      : ""
                                  } — ${row.override.fields.join(", ")}. Click to put the calculated figures back.`
                                : "Undo edits to this row"
                            }
                            className="text-amber-300 hover:text-amber-100"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {rowBusy[id] ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                        ) : row.payslip?.exists ? (
                          confirmReplace === id ? (
                            <button
                              onClick={() => generateRow(row, { replace: true })}
                              title="This deletes the existing payslip and issues a new one"
                              className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-[11px] font-medium"
                            >
                              Replace?
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmReplace(id)}
                              title={`Payslip already issued${
                                row.payslip.isPublished ? " and published" : ""
                              } — click to re-issue it from this row`}
                              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[11px]"
                            >
                              <Check className="w-3 h-3" />
                              {row.payslip.isPublished ? "Published" : "Issued"}
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => generateRow(row)}
                            title="Generate this employee's payslip for this month"
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 text-[11px] font-medium"
                          >
                            <FileText className="w-3 h-3" /> Generate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* The breakdown, for the row whose total was clicked. */}
                  {expanded === id && why && (
                    <tr className="border-b border-[#232945] bg-[#0b0f1a]">
                      <td colSpan={36} className="px-6 py-4">
                        <div className="flex flex-wrap gap-10 text-[12px]">
                          {/* What attendance did to the pay, BEFORE deductions.
                              Usually the largest gap, and it is not a deduction
                              line anywhere — unpaid days are simply not earned,
                              so without this the money is missing with nothing
                              to point at. */}
                          <div className="min-w-[280px]">
                            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                              How the month was earned
                            </div>
                            <table className="w-full">
                              <tbody className="text-gray-300">
                                <tr>
                                  <td className="py-0.5 pr-6">Salary for {plain(why.attendance.workingDays)} days</td>
                                  <td className="py-0.5 text-right tabular-nums">{money(row.components.total)}</td>
                                </tr>
                                <tr>
                                  <td className="py-0.5 pr-6 text-gray-500">A day's pay</td>
                                  <td className="py-0.5 text-right tabular-nums text-gray-500">{money(why.perDaySalary)}</td>
                                </tr>
                                <tr className="border-t border-[#1a2032]">
                                  <td className="py-0.5 pr-6">
                                    Paid days {plain(why.attendance.paidDays)}
                                    {(why.attendance.halfDays > 0) && (
                                      <span className="text-gray-500"> · {plain(why.attendance.halfDays)} half day{why.attendance.halfDays === 1 ? "" : "s"}</span>
                                    )}
                                  </td>
                                  <td className="py-0.5 text-right tabular-nums text-emerald-300">{money(row.earnings.netTotal)}</td>
                                </tr>
                                {why.unpaidDays > 0 && (
                                  <tr>
                                    <td className="py-0.5 pr-6 text-amber-200/80">
                                      Not paid for {plain(why.unpaidDays)} day{why.unpaidDays === 1 ? "" : "s"}
                                      {(why.attendance.absentDays > 0 || why.attendance.unpaidLeaveDays > 0) && (
                                        <span className="text-gray-500">
                                          {" "}(
                                          {[
                                            why.attendance.absentDays > 0 ? `${plain(why.attendance.absentDays)} absent` : null,
                                            why.attendance.unpaidLeaveDays > 0 ? `${plain(why.attendance.unpaidLeaveDays)} unpaid leave` : null,
                                          ].filter(Boolean).join(", ")}
                                          , rest weekends)
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-0.5 text-right tabular-nums text-amber-200/80">−{money(why.notEarned)}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Every deduction column, with the rule that produced it. */}
                          <div className="min-w-[440px] flex-1">
                            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                              Then deducted from {money(row.earnings.netTotal)}
                            </div>
                            <table className="w-full">
                              <tbody>
                                {why.deductions.map((line) => (
                                  <tr key={line.key} className={line.amount ? "text-gray-200" : "text-gray-600"}>
                                    <td className="py-0.5 pr-4 whitespace-nowrap font-medium">{line.label}</td>
                                    <td className="py-0.5 pr-6 text-right tabular-nums whitespace-nowrap">
                                      {line.amount ? money(line.amount) : "—"}
                                    </td>
                                    <td className="py-0.5 text-gray-500">{line.note}</td>
                                  </tr>
                                ))}
                                <tr className="border-t border-[#232945] font-semibold text-gray-100">
                                  <td className="py-1 pr-4">Total Deduction</td>
                                  <td className="py-1 pr-6 text-right tabular-nums">{money(row.deductions.total)}</td>
                                  <td />
                                </tr>
                                <tr className="font-semibold text-emerald-300">
                                  <td className="py-1 pr-4">Net Payment</td>
                                  <td className="py-1 pr-6 text-right tabular-nums">{money(row.netPayment)}</td>
                                  <td className="py-1 text-gray-500 font-normal">
                                    {money(row.earnings.netTotal)} earned − {money(row.deductions.total)} deducted
                                  </td>
                                </tr>
                                <tr className="text-gray-400">
                                  <td className="py-0.5 pr-4">CTC</td>
                                  <td className="py-0.5 pr-6 text-right tabular-nums">{money(row.ctc)}</td>
                                  <td className="py-0.5 text-gray-500">
                                    what the employee is paid plus the employer&rsquo;s own PF and ESI — not taken from them
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#0d1220] border-t border-[#232945]">
              <tr className="font-semibold text-gray-200">
                {/* Everything up to and including Advance: 30 of the 36 columns. */}
                <td className="px-2 py-2 sticky left-0 bg-[#0d1220]" colSpan={30}>
                  {visible.length} employees
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{money(totals.deductions)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-emerald-300">{money(totals.net)}</td>
                <td colSpan={2}></td>
                <td className="px-2 py-2 text-right tabular-nums">{money(totals.ctc)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <div className="px-4 py-2 border-t border-[#232945] bg-[#0d1220] text-[11px] text-gray-500">
        Click a <span className="text-emerald-300 font-semibold">Y</span>/<span className="text-gray-300 font-semibold">N</span> button to switch PF or ESI — the whole row re-prices.
        Click <span className="text-gray-300">Total Deduction</span> to see exactly what was taken and why.
        Double-click a blue cell to edit Days, Paid Days, Salary, TDS, Late, Other / Penalty or Advance.
        Everything else is calculated on the server by the same formula that issues the payslip.
        Use the Payslip column to issue one employee at a time; re-issuing replaces the existing payslip and asks first.
      </div>
    </div>
  );
};

export default PayrollRegister;
