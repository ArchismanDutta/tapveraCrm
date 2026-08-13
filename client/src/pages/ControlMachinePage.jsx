import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Gauge, AlertTriangle, Check, RotateCcw } from "lucide-react";
import API from "../api";

/**
 * Hidden maintenance page — /control-machine-sync
 *
 * Sets a per-user rate factor applied to recorded daily intervals. At 0.75 a
 * real 100 minutes is stored as 75; at 2 it accrues twice as fast.
 *
 * The naming across this feature is deliberately non-descriptive, but the
 * behaviour described in these comments is exact — a future maintainer has to
 * be able to trust them. See AttendanceService for where the factor is
 * applied and User.controlMachineFactor for the full rationale.
 *
 * ─── THE URL IS NOT THE SECURITY ───
 * This path ships inside the JS bundle and is findable with a text search of
 * the deployed app, so it is unlisted rather than protected. The route is
 * gated on super-admin in App.jsx, and — the part that actually matters —
 * /api/admin/control-machine enforces the same check server-side and answers 404
 * to everyone else. Nothing here relies on the address being unknown.
 *
 * ─── WHAT THE OPERATOR NEEDS TOLD ───
 * Two things are easy to assume and wrong, so the page states both: the
 * change applies to FUTURE days (today's record already snapshotted its
 * factor), and it does not convert the saved minutes into work time.
 */

const PRESETS = [0.25, 0.5, 0.75, 1, 2, 5];

const ControlMachinePage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [factor, setFactor] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get("/api/admin/control-machine");
      setUsers(data?.data || []);
    } catch (err) {
      setError(
        err?.response?.status === 404
          ? "Not available for this account."
          : "Could not load users."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.employeeId || "").toLowerCase().includes(q)
    );
  }, [users, query]);

  // Anyone already off real time, surfaced up front. Without this the only way
  // to find an adjusted account is to remember you adjusted it.
  const adjusted = useMemo(
    () => users.filter((u) => Number(u.controlMachineFactor) !== 1),
    [users]
  );

  const pick = (user) => {
    setSelected(user);
    setFactor(String(user.controlMachineFactor ?? 1));
    setReason("");
    setResult(null);
    setError(null);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await API.post("/api/admin/control-machine", {
        userId: selected._id,
        factor: Number(factor),
        reason: reason.trim(),
      });
      setResult(data);
      await load();
      // Keep the row selected but refresh it, so the panel shows the value
      // that is now actually stored rather than what was typed.
      setSelected((prev) => (prev ? { ...prev, controlMachineFactor: Number(factor) } : prev));
    } catch (err) {
      setError(err?.response?.data?.message || "Could not update the factor.");
    } finally {
      setSaving(false);
    }
  };

  const numericFactor = Number(factor);
  const factorValid = Number.isFinite(numericFactor) && numericFactor >= 0.1 && numericFactor <= 10;
  const reasonRequired = factorValid && numericFactor !== 1 && !reason.trim();

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h1 className="text-lg font-bold text-white">Control machine</h1>
              <p className="mt-1 text-sm text-amber-100/80">
                Per-user rate factor. At{" "}
                <code className="rounded bg-black/30 px-1">0.75</code> a recorded
                interval of 100 minutes is stored as 75.
              </p>
              {/* Kept deliberately: only super-admins reach this page, and each
                  of these is an assumption that is easy to make and wrong.
                  Removing them would not hide anything from anyone who cannot
                  already open the page — it would just make it misusable. */}
              <ul className="mt-2 space-y-1 text-xs text-amber-100/70">
                <li>
                  • Applies to <strong>future days</strong>. Today&apos;s record already
                  fixed its factor when it was created.
                </li>
                <li>
                  • Source timestamps are never altered, and the unadjusted total is
                  kept alongside the adjusted one.
                </li>
                <li>
                  • The difference is <strong>not</strong> reallocated — hours worked are
                  unchanged.
                </li>
                <li>
                  • Values other than 1 shift where a person falls against the daily
                  interval thresholds.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Currently adjusted */}
        {adjusted.length > 0 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Currently not on real time ({adjusted.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {adjusted.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => pick(u)}
                  className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
                >
                  {u.name} · {u.controlMachineFactor}x
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* People */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email or employee ID"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {loading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No matches.</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => pick(u)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition ${
                      selected?._id === u._id
                        ? "bg-blue-600/20 ring-1 ring-blue-500/40"
                        : "hover:bg-slate-800"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {u.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {u.employeeId || u.email}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                        Number(u.controlMachineFactor) === 1
                          ? "bg-slate-800 text-slate-400"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {u.controlMachineFactor}x
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Editor */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <Gauge className="mb-2 h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-500">Select someone to set their factor.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-white">{selected.name}</p>
                  <p className="text-xs text-slate-500">
                    {selected.employeeId || selected.email} · currently{" "}
                    {selected.controlMachineFactor}x
                  </p>
                </div>

                {selected.controlMachineMeta?.setAt && (
                  <div className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-400">
                    Last changed by {selected.controlMachineMeta.setByName || "unknown"} on{" "}
                    {new Date(selected.controlMachineMeta.setAt).toLocaleDateString()}
                    {selected.controlMachineMeta.reason && (
                      <> — “{selected.controlMachineMeta.reason}”</>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Speed factor
                  </label>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setFactor(String(p))}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          Number(factor) === p
                            ? "bg-blue-600 text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {p}x
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="10"
                    value={factor}
                    onChange={(e) => setFactor(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                  {!factorValid && (
                    <p className="mt-1 text-xs text-rose-400">
                      Must be between 0.1 and 10.
                    </p>
                  )}
                  {factorValid && numericFactor !== 1 && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      A 100-minute interval would be recorded as{" "}
                      <strong className="text-white">
                        {Math.round(100 * numericFactor)} minutes
                      </strong>
                      .
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">
                    Reason {numericFactor !== 1 && <span className="text-rose-400">*</span>}
                  </label>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why this account is being adjusted"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving || !factorValid || reasonRequired}
                    onClick={save}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Apply"}
                  </button>
                  {Number(selected.controlMachineFactor) !== 1 && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setFactor("1");
                        setReason("Reset to real time");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  )}
                </div>

                {result && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {result.message}. Applies from {result.data?.appliesFrom}.
                    </span>
                  </div>
                )}
                {error && (
                  <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-200">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlMachinePage;
