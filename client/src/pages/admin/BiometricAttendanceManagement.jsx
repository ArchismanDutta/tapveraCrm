// src/pages/admin/BiometricAttendanceManagement.jsx
//
// Admin screen for the Identix / ZKTeco fingerprint integration.
//
// The device only ever sends a numeric PIN — it knows nothing about CRM users.
// This page is where that PIN is tied to an employee, which is the one manual
// step the whole integration depends on: an unmapped PIN produces no attendance
// at all.
//
// Four sections, ordered by how often they're needed:
//   1. Health strip      — is the machine alive, is anything failing
//   2. Unmapped PINs     — the work queue: PINs seen that match nobody
//   3. Employee mapping  — the full roster with editable PINs
//   4. Devices + activity— terminal status and a live punch feed
//
// Backend: server/routes/biometricAdminRoutes.js
// Docs:    docs/biometric-attendance-integration.md
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Fingerprint,
  RefreshCw,
  Search,
  Check,
  X,
  AlertTriangle,
  CircleCheck,
  Wifi,
  WifiOff,
  Users,
  Link2,
  FlaskConical,
  Activity,
} from "lucide-react";
import { toast } from "react-toastify";
import Sidebar from "../../components/dashboard/Sidebar";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

// Outcome badge colours. These mirror the BiometricPunch status enum — see the
// model for what each one means.
const STATUS_STYLES = {
  APPLIED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/20",
  // Presence evidence for a day that was already open — the common case, since
  // only the first scan of a day becomes an attendance event. Deliberately
  // muted: these are routine, not something an admin needs to act on.
  LOGGED: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-white/[0.03] dark:text-slate-400 dark:border-white/10",
  DUPLICATE: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/10",
  UNMAPPED: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:border-amber-400/20",
  SKIPPED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-400/10 dark:text-blue-200 dark:border-blue-400/20",
  FAILED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-200 dark:border-rose-400/20",
  DRY_RUN: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-400/10 dark:text-violet-200 dark:border-violet-400/20",
  PENDING: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/[0.04] dark:text-slate-300 dark:border-white/10",
};

const fmtDateTime = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "—";
  }
};

const BiometricAttendanceManagement = ({ onLogout }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // userId currently being saved

  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, mapped: 0, unmapped: 0 });
  const [unmappedPins, setUnmappedPins] = useState([]);
  const [devices, setDevices] = useState([]);
  const [punches, setPunches] = useState([]);

  const [search, setSearch] = useState("");
  const [showMappedOnly, setShowMappedOnly] = useState("all"); // all | mapped | unmapped
  const [pinDrafts, setPinDrafts] = useState({}); // userId -> in-progress PIN text
  const [assignTargets, setAssignTargets] = useState({}); // pin -> userId chosen

  const userRole = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}").role || "admin";
    } catch {
      return "admin";
    }
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // API
  // ───────────────────────────────────────────────────────────────────────────

  const api = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/api/biometric${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }, []);

  const fetchAll = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        // Fetched in parallel and tolerated individually — one failing endpoint
        // shouldn't blank the whole page.
        const [h, m, u, d, p] = await Promise.allSettled([
          api("/health"),
          api("/mappings"),
          api("/unmapped-pins"),
          api("/devices"),
          api("/punches?limit=25"),
        ]);

        if (h.status === "fulfilled") setHealth(h.value.data);
        if (m.status === "fulfilled") {
          setUsers(m.value.data.users || []);
          setSummary(m.value.data.summary || { total: 0, mapped: 0, unmapped: 0 });
        }
        if (u.status === "fulfilled") setUnmappedPins(u.value.data || []);
        if (d.status === "fulfilled") setDevices(d.value.data || []);
        if (p.status === "fulfilled") setPunches(p.value.data || []);

        const failed = [h, m, u, d, p].filter((r) => r.status === "rejected");
        if (failed.length && !quiet) {
          toast.warning("Some biometric data could not be loaded.");
          console.warn("Biometric fetch failures:", failed.map((f) => f.reason?.message));
        }
      } finally {
        setLoading(false);
      }
    },
    [api]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Light background refresh so the punch feed and device status stay current
  // while someone is working through the mapping queue.
  useEffect(() => {
    const id = setInterval(() => fetchAll({ quiet: true }), 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  // ───────────────────────────────────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────────────────────────────────

  const saveMapping = async (userId, pin) => {
    setSaving(userId);
    try {
      const res = await api(`/mappings/${userId}`, {
        method: "PUT",
        body: JSON.stringify({ biometricPin: pin || null }),
      });

      toast.success(res.message || "Mapping updated");

      // The backend replays punches captured before the mapping existed, so a
      // newly mapped employee can immediately gain attendance history.
      if (res.replay?.applied > 0) {
        toast.info(`${res.replay.applied} earlier punch(es) applied to attendance`);
      }

      setPinDrafts((d) => {
        const next = { ...d };
        delete next[userId];
        return next;
      });
      await fetchAll({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const assignPinToUser = async (pin) => {
    const userId = assignTargets[pin];
    if (!userId) {
      toast.warning("Choose an employee first");
      return;
    }
    await saveMapping(userId, pin);
    setAssignTargets((a) => {
      const next = { ...a };
      delete next[pin];
      return next;
    });
  };

  const updateDevice = async (id, patch) => {
    try {
      await api(`/devices/${id}`, { method: "PUT", body: JSON.stringify(patch) });
      toast.success("Device updated");
      await fetchAll({ quiet: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Derived
  // ───────────────────────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (showMappedOnly === "mapped" && !u.biometricPin) return false;
      if (showMappedOnly === "unmapped" && u.biometricPin) return false;
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.employeeId?.toLowerCase().includes(q) ||
        u.biometricPin?.toLowerCase?.().includes(q)
      );
    });
  }, [users, search, showMappedOnly]);

  const unmappedEmployees = useMemo(
    () => users.filter((u) => !u.biometricPin),
    [users]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────────────

  const statCard = (label, value, tone = "default", hint = "") => (
    <div className="min-w-0 bg-white p-3.5 dark:bg-[#10131c]">
      <div className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <p
        className={`truncate text-lg font-semibold ${
          tone === "warn"
            ? "text-amber-600 dark:text-amber-300"
            : tone === "bad"
            ? "text-rose-600 dark:text-rose-300"
            : tone === "good"
            ? "text-emerald-600 dark:text-emerald-300"
            : "text-slate-950 dark:text-white"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );

  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole={userRole}
        onLogout={onLogout}
      />

      <main
        className={`h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 transition-all duration-300 sm:px-5 lg:px-6 ${
          collapsed ? "ml-16" : "ml-16 sm:ml-56"
        }`}
      >
        <div className="mx-auto max-w-[1500px] space-y-4 pb-8 sm:space-y-5">
          {/* ── Header ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Fingerprint className="h-3.5 w-3.5" />
                Biometric attendance
              </div>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Fingerprint Device &amp; PIN Mapping
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                The terminal sends only a numeric PIN. Each employee must be linked to their
                PIN here — until they are, their punches are stored but not counted.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchAll()}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* ── Health strip ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-white/10 dark:bg-white/10 sm:grid-cols-3 lg:grid-cols-5">
            {statCard(
              "Devices online",
              health ? `${health.devicesOnline}/${health.devicesTotal}` : "—",
              health && health.devicesOnline === 0 && health.devicesTotal > 0 ? "bad" : "good"
            )}
            {statCard("Applied (24h)", health?.last24Hours?.applied ?? "—", "good")}
            {statCard(
              "Unmapped (24h)",
              health?.last24Hours?.unmapped ?? "—",
              (health?.last24Hours?.unmapped ?? 0) > 0 ? "warn" : "default",
              "punches with no employee"
            )}
            {statCard(
              "Failed (24h)",
              health?.last24Hours?.failed ?? "—",
              (health?.last24Hours?.failed ?? 0) > 0 ? "bad" : "default"
            )}
            {statCard(
              "Staff without PIN",
              health?.activeEmployeesWithoutPin ?? summary.unmapped,
              (health?.activeEmployeesWithoutPin ?? summary.unmapped) > 0 ? "warn" : "good"
            )}
          </div>

          {/* ── Unmapped PIN queue ─────────────────────────────────────── */}
          {unmappedPins.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-400/20 dark:bg-amber-400/[0.04]">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                  PINs waiting to be assigned ({unmappedPins.length})
                </h2>
              </div>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                The device sent these PINs but no employee is linked to them. Assign one and
                that person&apos;s earlier punches are applied to their attendance automatically.
              </p>

              <div className="space-y-2">
                {unmappedPins.map((row) => (
                  <div
                    key={`${row.serialNumber}-${row.pin}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-white p-3 dark:border-amber-400/20 dark:bg-[#10131c]"
                  >
                    <div className="flex h-9 min-w-[3.5rem] items-center justify-center rounded-lg bg-slate-900 px-3 font-mono text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                      {row.pin}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {row.punchCount} punch{row.punchCount === 1 ? "" : "es"} · last seen{" "}
                        {fmtDateTime(row.lastSeen)}
                      </p>
                      <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                        device {row.serialNumber}
                      </p>
                    </div>

                    <select
                      value={assignTargets[row.pin] || ""}
                      onChange={(e) =>
                        setAssignTargets((a) => ({ ...a, [row.pin]: e.target.value }))
                      }
                      className="h-9 min-w-[13rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-[#0b0d12] dark:text-slate-200"
                    >
                      <option value="">Assign to…</option>
                      {unmappedEmployees.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.name} ({u.employeeId})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => assignPinToUser(row.pin)}
                      disabled={!assignTargets[row.pin]}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-white/10 dark:disabled:bg-white/[0.04] dark:disabled:text-slate-500"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Employee mapping table ─────────────────────────────────── */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <Users className="h-4 w-4" />
                  Employee PIN mapping
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {summary.mapped} of {summary.total} mapped
                  {summary.unmapped > 0 && ` · ${summary.unmapped} still unmapped`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name, ID or PIN"
                    className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 dark:border-white/10 dark:bg-[#0b0d12] dark:text-slate-200"
                  />
                </div>

                <select
                  value={showMappedOnly}
                  onChange={(e) => setShowMappedOnly(e.target.value)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 dark:border-white/10 dark:bg-[#0b0d12] dark:text-slate-200"
                >
                  <option value="all">All employees</option>
                  <option value="unmapped">Unmapped only</option>
                  <option value="mapped">Mapped only</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <th className="pb-2 pr-3 font-medium">Employee</th>
                    <th className="pb-2 pr-3 font-medium">Employee ID</th>
                    <th className="pb-2 pr-3 font-medium">Department</th>
                    <th className="pb-2 pr-3 font-medium">Device PIN</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const draft = pinDrafts[u._id];
                    const current = u.biometricPin || "";
                    const value = draft !== undefined ? draft : current;
                    const dirty = draft !== undefined && draft !== current;

                    return (
                      <tr
                        key={u._id}
                        className="border-b border-slate-100 last:border-0 dark:border-white/5"
                      >
                        <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                          {u.name}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400">
                          {u.employeeId}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400">
                          {u.department || "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={value}
                              onChange={(e) =>
                                setPinDrafts((d) => ({
                                  ...d,
                                  [u._id]: e.target.value.replace(/\D/g, ""),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && dirty) saveMapping(u._id, value);
                              }}
                              placeholder="—"
                              className="h-8 w-24 rounded-lg border border-slate-200 bg-white px-2 font-mono text-sm text-slate-800 placeholder:text-slate-300 dark:border-white/10 dark:bg-[#0b0d12] dark:text-slate-100"
                            />
                            {dirty && (
                              <button
                                type="button"
                                onClick={() => saveMapping(u._id, value)}
                                disabled={saving === u._id}
                                title="Save"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-600 bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            )}
                            {!dirty && current && (
                              <button
                                type="button"
                                onClick={() => saveMapping(u._id, null)}
                                disabled={saving === u._id}
                                title="Clear PIN"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-50 dark:border-white/10"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5">
                          {current ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                              <CircleCheck className="h-3 w-3" /> Mapped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                              <AlertTriangle className="h-3 w-3" /> No PIN
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!filteredUsers.length && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                        {loading ? "Loading…" : "No employees match this filter"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Devices + recent activity ──────────────────────────────── */}
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
            {/* Devices */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <Fingerprint className="h-4 w-4" />
                Terminals
              </h2>

              <div className="space-y-3">
                {devices.map((d) => (
                  <div
                    key={d._id}
                    className="rounded-xl border border-slate-200 p-3.5 dark:border-white/10"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                          {d.name || d.serialNumber}
                        </p>
                        <p className="truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                          {d.serialNumber}
                          {d.location ? ` · ${d.location}` : ""}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                          d.online
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                            : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                        }`}
                      >
                        {d.online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                        {d.online ? "Online" : "Offline"}
                      </span>
                    </div>

                    <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                      Last contact {fmtDateTime(d.lastSeenAt)}
                      {d.stats?.totalPunchesApplied != null &&
                        ` · ${d.stats.totalPunchesApplied} punches applied`}
                    </p>

                    {/* ── Current state, then the action ──────────────────────
                        Two independent switches that are easy to confuse:
                          • Enabled — a disabled device is rejected outright and
                            nothing is recorded at all.
                          • Dry-run — punches are recorded and interpreted, but
                            deliberately not written to attendance.
                        Both must be in the right position for punches to count,
                        so the current state is spelled out in words and the
                        buttons say what they will DO, not what things are. */}
                    <div
                      className={`mb-2.5 rounded-lg border px-3 py-2 text-xs font-medium ${
                        !d.enabled
                          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                          : d.dryRun
                          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                      }`}
                    >
                      {!d.enabled
                        ? "⛔ Disabled — punches from this device are rejected and not recorded at all"
                        : d.dryRun
                        ? "🧪 Dry-run — punches are recorded here, but NOT added to anyone's attendance"
                        : "✅ Live — punches are being added to attendance"}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateDevice(d._id, { enabled: !d.enabled })}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
                          d.enabled
                            ? "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                            : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {d.enabled ? "Disable device" : "Enable device"}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateDevice(d._id, { dryRun: !d.dryRun })}
                        disabled={!d.enabled}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          d.dryRun
                            ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                        }`}
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                        {d.dryRun ? "Go live (start saving attendance)" : "Switch to dry-run"}
                      </button>
                    </div>
                  </div>
                ))}

                {!devices.length && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    {loading
                      ? "Loading…"
                      : "No device has contacted the server yet. Check the terminal's network and Cloud Server settings."}
                  </p>
                )}
              </div>
            </section>

            {/* Recent punches */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10131c]">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <Activity className="h-4 w-4" />
                Recent punches
              </h2>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                Exactly what the hardware sent, and what the CRM did with it.
              </p>

              <div className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
                {punches.map((p) => (
                  <div
                    key={p._id}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-100 px-2.5 py-2 dark:border-white/5"
                  >
                    <span className="min-w-[2.5rem] rounded bg-slate-100 px-1.5 py-0.5 text-center font-mono text-xs text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {p.pin}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">
                        {p.userId?.name || "Unrecognised PIN"}
                        {p.resolvedAction && (
                          <span className="ml-1.5 font-normal text-slate-400">
                            {p.resolvedAction.replace("_", " ").toLowerCase()}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                        {fmtDateTime(p.punchedAt)}
                        {p.message ? ` · ${p.message}` : ""}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                        STATUS_STYLES[p.status] || STATUS_STYLES.PENDING
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}

                {!punches.length && (
                  <p className="py-6 text-center text-sm text-slate-400">
                    {loading ? "Loading…" : "No punches received yet"}
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BiometricAttendanceManagement;
