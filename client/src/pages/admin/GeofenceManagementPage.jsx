import React, { useState, useEffect, useCallback, useMemo } from "react";
import Sidebar from "../../components/dashboard/Sidebar";
import geofenceApi from "../../api/geofenceApi";
import {
  getCurrentCoordinates,
  GeolocationError,
  haversineDistanceMeters,
} from "../../utils/geolocation";
import { readState, toggleLocation, toggleEnabled } from "../../utils/geofenceAssignment";
import LocationMapPicker from "../../components/geofence/LocationMapPicker";
import {
  AlertCircle,
  Check,
  Crosshair,
  Edit2,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";

// ============================================================================
// Geofenced login (2026-08-07) — Super Admin console.
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// Three tabs: Locations / Assign Users / Denial Log.
//
// The denial log is not an afterthought. A fence that refuses people silently
// generates support tickets whose only answer is "widen the radius until they
// stop complaining" — which quietly dismantles the fence. Showing the actual
// reported coordinates, the GPS accuracy circle and the distance to the
// nearest fence turns "the app is broken" into "your phone reported a 900m
// accuracy circle from inside the building, connect to wifi".
// ============================================================================

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100";

const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#12151c]";

const emptyLocationForm = () => ({
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  radiusMeters: 200,
});

const TABS = [
  { id: "locations", label: "Locations", icon: <MapPin size={14} /> },
  { id: "users", label: "Assign Users", icon: <Users size={14} /> },
  { id: "events", label: "Denial Log", icon: <ShieldAlert size={14} /> },
];

export default function GeofenceManagementPage({ onLogout }) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("locations");

  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);

  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "error" | "success", text }

  const [form, setForm] = useState(emptyLocationForm());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureResult, setCaptureResult] = useState(null);

  const [userSearch, setUserSearch] = useState("");
  const [savingUserId, setSavingUserId] = useState(null);

  // "Would I get in from where I'm standing?" — see runPositionTest.
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({}); // locationId -> readout

  const notify = useCallback((type, text) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 6000);
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────────
  const loadLocations = useCallback(async () => {
    try {
      setLocations(await geofenceApi.listLocations());
    } catch {
      notify("error", "Failed to load locations.");
    }
  }, [notify]);

  const loadUsers = useCallback(async () => {
    try {
      setUsers(await geofenceApi.listUsers());
    } catch {
      notify("error", "Failed to load users.");
    }
  }, [notify]);

  const loadEvents = useCallback(async () => {
    try {
      const data = await geofenceApi.listEvents({ limit: 100 });
      setEvents(data.events || []);
    } catch {
      notify("error", "Failed to load the denial log.");
    }
  }, [notify]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadLocations(), loadUsers()]).finally(() => setLoading(false));
  }, [loadLocations, loadUsers]);

  useEffect(() => {
    if (activeTab === "events") loadEvents();
  }, [activeTab, loadEvents]);

  // ── Locations ────────────────────────────────────────────────────────────

  /**
   * Fill lat/lng from the admin's own device.
   *
   * The realistic alternative is asking someone to find their office on an
   * external map site and copy two decimal numbers across without transposing
   * them — and a swapped lat/lng produces a valid-looking fence in the wrong
   * hemisphere that only reveals itself when staff cannot log in. Standing in
   * the office and pressing this removes that entire class of mistake.
   */
  const captureCurrentPosition = async () => {
    setCapturing(true);
    setCaptureResult(null);
    try {
      const coords = await getCurrentCoordinates();
      setForm((prev) => ({
        ...prev,
        latitude: coords.latitude.toFixed(6),
        longitude: coords.longitude.toFixed(6),
      }));
      // Reported INLINE, next to the button, not via the page-top banner.
      // The banner sits above the tab bar; by the time an admin has scrolled
      // past the map to reach this button it is comfortably off-screen, so a
      // failure looked exactly like a dead button. That is what "the button
      // isn't working" turned out to mean.
      setCaptureResult({
        ok: true,
        accuracy: Math.round(coords.accuracy),
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    } catch (err) {
      setCaptureResult({
        ok: false,
        message: err instanceof GeolocationError ? err.message : "Could not read your location.",
      });
    } finally {
      setCapturing(false);
    }
  };

  /**
   * "Would someone standing here get in?"
   *
   * Exists because a denial like "6895m beyond Head Office" is unfalsifiable
   * from the admin's chair — they are standing in the office, the fence says
   * otherwise, and there is no way to tell whether the fence is wrong, the
   * device is wrong, or the maths is wrong. Guessing between those three is
   * how a radius ends up being widened to 10km until complaints stop.
   *
   * This reads the device's position and shows the raw numbers: coordinates,
   * the device's own accuracy estimate, and the distance to this fence. It
   * uses the same haversine as the server, so the verdict here IS the server's
   * verdict.
   *
   * The accuracy figure is the diagnostic that matters. A laptop positions by
   * Wi-Fi lookup rather than GPS, and when the office router is missing from
   * Apple's/Google's database the answer can be kilometres out while still
   * "succeeding" — which is exactly what a large accuracy number is telling you.
   */
  const runPositionTest = async (loc) => {
    setTestingId(loc._id);
    try {
      const coords = await getCurrentCoordinates({ timeoutMs: 20000 });
      const distance = haversineDistanceMeters(
        coords.latitude,
        coords.longitude,
        Number(loc.latitude),
        Number(loc.longitude)
      );
      const overshoot = distance - Number(loc.radiusMeters);
      // Mirrors the server's ACCURACY_GRACE_METERS cap.
      const grace = Math.min(coords.accuracy, 100);

      setTestResults((prev) => ({
        ...prev,
        [loc._id]: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Math.round(coords.accuracy),
          distance: Math.round(distance),
          inside: overshoot <= grace,
          overshoot: Math.round(overshoot),
        },
      }));
    } catch (err) {
      notify(
        "error",
        err instanceof GeolocationError ? err.message : "Could not read your location."
      );
    } finally {
      setTestingId(null);
    }
  };

  const submitLocation = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      address: form.address.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radiusMeters: Number(form.radiusMeters),
    };

    if (!payload.name) return notify("error", "Give the location a name.");
    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      return notify("error", "Enter a valid latitude and longitude.");
    }

    try {
      if (editingId) {
        await geofenceApi.updateLocation(editingId, payload);
        notify("success", "Location updated.");
      } else {
        await geofenceApi.createLocation(payload);
        notify("success", "Location created.");
      }
      setForm(emptyLocationForm());
      setEditingId(null);
      setShowForm(false);
      await Promise.all([loadLocations(), loadUsers()]);
    } catch (err) {
      notify("error", err.response?.data?.message || "Failed to save the location.");
    }
  };

  const editLocation = (loc) => {
    setForm({
      name: loc.name,
      address: loc.address || "",
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radiusMeters: loc.radiusMeters,
    });
    setEditingId(loc._id);
    setShowForm(true);
  };

  const toggleLocationActive = async (loc) => {
    // Deactivating is not cosmetic: enforcement fails closed when a user has
    // no ACTIVE fence left, so switching off a location that is someone's only
    // assignment will stop them logging in. Said plainly rather than buried,
    // because the count is right there and the consequence is not obvious.
    if (loc.isActive && loc.assignedUserCount > 0) {
      const ok = window.confirm(
        `"${loc.name}" is assigned to ${loc.assignedUserCount} user${
          loc.assignedUserCount === 1 ? "" : "s"
        }.\n\nDeactivating it will block anyone whose only permitted location this is from signing in. Continue?`
      );
      if (!ok) return;
    }

    try {
      await geofenceApi.updateLocation(loc._id, { isActive: !loc.isActive });
      notify("success", loc.isActive ? "Location deactivated." : "Location reactivated.");
      await loadLocations();
    } catch (err) {
      notify("error", err.response?.data?.message || "Failed to update the location.");
    }
  };

  const removeLocation = async (loc) => {
    if (!window.confirm(`Delete "${loc.name}"? This cannot be undone.`)) return;
    try {
      await geofenceApi.deleteLocation(loc._id);
      notify("success", "Location deleted.");
      await Promise.all([loadLocations(), loadUsers()]);
    } catch (err) {
      // The server refuses to delete an assigned location (409) and says how
      // many users are in the way — surfaced verbatim, since it is the
      // actionable part.
      notify("error", err.response?.data?.message || "Failed to delete the location.");
    }
  };

  // ── User assignment ──────────────────────────────────────────────────────

  const saveUserGeofence = async (user, { enabled, locationIds }) => {
    setSavingUserId(user._id);
    try {
      const updated = await geofenceApi.updateUserGeofence(user._id, {
        enabled,
        locations: locationIds,
      });
      setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, ...updated } : u)));
      await loadLocations(); // assignee counts moved
    } catch (err) {
      notify("error", err.response?.data?.message || "Failed to update this user.");
    } finally {
      setSavingUserId(null);
    }
  };

  // State transitions live in utils/geofenceAssignment.js so they can be
  // tested — see the regression note there. Getting this wrong produces a
  // fence the admin appears to configure but which never enforces, and that
  // failure is invisible from the UI.
  const assignedIds = (user) => readState(user).locationIds;

  const toggleUserLocation = (user, locationId) =>
    saveUserGeofence(user, toggleLocation(readState(user), locationId));

  const toggleUserEnabled = (user) => {
    const next = toggleEnabled(readState(user));
    if (next.blocked) return notify("error", next.blocked);
    return saveUserGeofence(user, next);
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.name, u.email, u.employeeId, u.position].filter(Boolean).some((f) =>
        String(f).toLowerCase().includes(q)
      )
    );
  }, [users, userSearch]);

  const activeLocations = locations.filter((l) => l.isActive);
  const fencedCount = users.filter((u) => u.geofence?.enabled).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        userRole="super-admin"
        onLogout={onLogout}
      />
      <main
        className={`min-w-0 flex-1 overflow-y-auto transition-[margin] duration-300 ${
          collapsed ? "app-offset app-offset-collapsed" : "app-offset"
        }`}
      >
        <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {/* Header */}
          <section className={`${cardClass} mb-5 overflow-hidden`}>
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Security
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Login geofencing
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                  Restrict where individual employees can sign in from. Client
                  portal accounts are never geofenced.
                </p>
              </div>
              <div className="flex gap-3">
                {[
                  { label: "Locations", value: activeLocations.length },
                  { label: "Fenced users", value: fencedCount },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {s.value}
                    </p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* A super-admin cannot fence themselves, by design. Stated up front
              so it reads as a deliberate safety property rather than as a bug
              discovered later when their own row has no toggle. */}
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>
              Super Admins are never geofenced. You are the only role that can
              lift a restriction, so fencing yourself out would be
              unrecoverable. Enabling a fence with no location selected is
              refused for the same reason.
            </span>
          </div>

          {banner && (
            <div
              className={`mb-5 flex items-center gap-2 rounded-xl border p-3.5 text-sm ${
                banner.type === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
              }`}
            >
              {banner.type === "error" ? <AlertCircle size={15} /> : <Check size={15} />}
              {banner.text}
            </div>
          )}

          {/* Tabs — same shrink-0 + hide-scrollbar treatment as the task page,
              so the row scrolls cleanly on a phone instead of crushing. */}
          <div
            role="tablist"
            className="hide-scrollbar mb-5 flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-[#12151c] sm:w-fit sm:max-w-full"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4 py-2.5 text-xs font-medium transition ${
                  activeTab === t.id
                    ? "border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-400/30 dark:bg-blue-500"
                    : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── Locations tab ─────────────────────────────────────────────── */}
          {activeTab === "locations" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setForm(emptyLocationForm());
                    setEditingId(null);
                    setShowForm((s) => !s);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500"
                >
                  {showForm ? <X size={14} /> : <Plus size={14} />}
                  {showForm ? "Cancel" : "New location"}
                </button>
              </div>

              {showForm && (
                <form onSubmit={submitLocation} className={`${cardClass} space-y-4 p-5`}>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    {editingId ? "Edit location" : "New location"}
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Name
                      </span>
                      <input
                        className={inputClass}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Kolkata HQ"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Address <span className="text-slate-400">(for your reference only)</span>
                      </span>
                      <input
                        className={inputClass}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="Salt Lake Sector V"
                      />
                    </label>
                  </div>

                  {/* The map writes into the same latitude/longitude/radius
                      fields below, which remain the source of truth — so if it
                      fails to load, everything still works by hand. */}
                  <LocationMapPicker
                    latitude={form.latitude}
                    longitude={form.longitude}
                    radiusMeters={form.radiusMeters}
                    onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
                    onError={(msg) => notify("error", msg)}
                  />

                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Latitude
                      </span>
                      <input
                        className={inputClass}
                        value={form.latitude}
                        onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                        placeholder="22.572600"
                        inputMode="decimal"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Longitude
                      </span>
                      <input
                        className={inputClass}
                        value={form.longitude}
                        onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                        placeholder="88.363900"
                        inputMode="decimal"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Radius (metres)
                      </span>
                      <input
                        className={inputClass}
                        type="number"
                        min={50}
                        max={100000}
                        value={form.radiusMeters}
                        onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
                        required
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={captureCurrentPosition}
                    disabled={capturing}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                  >
                    <Crosshair size={13} />
                    {capturing ? "Reading your position..." : "Use my current position"}
                  </button>

                  {captureResult && (
                    <div
                      className={`rounded-xl border p-3 text-[11px] leading-5 ${
                        captureResult.ok
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                      }`}
                    >
                      {captureResult.ok ? (
                        <>
                          <p className="font-semibold">
                            Captured — accuracy ±{captureResult.accuracy}m
                          </p>
                          <p className="mt-0.5 font-mono">
                            {captureResult.latitude.toFixed(6)},{" "}
                            {captureResult.longitude.toFixed(6)}
                          </p>
                          {/* Surfaced at capture time, because this is the
                              moment the mistake is made. A fence centred on a
                              ±3km guess looks completely normal in the form and
                              only reveals itself later, as staff being denied
                              from inside the building. */}
                          {captureResult.accuracy > 500 && (
                            <p className="mt-1.5 font-medium">
                              ⚠ That is far too imprecise to centre a fence on. This
                              device is estimating your position from Wi-Fi, not GPS,
                              and can be kilometres out. Open this page on a phone and
                              capture there instead.
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="font-medium">{captureResult.message}</p>
                      )}
                    </div>
                  )}

                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                    The minimum radius is 50m. Phone GPS is typically accurate
                    to 10&ndash;50m outdoors and worse indoors, so a tighter
                    fence rejects people who are genuinely inside it. For a
                    single office building, 150&ndash;300m is the usable range.
                  </p>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForm(false);
                        setEditingId(null);
                      }}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500"
                    >
                      {editingId ? "Save changes" : "Create location"}
                    </button>
                  </div>
                </form>
              )}

              {!locations.length && !loading && (
                <div className={`${cardClass} p-10 text-center`}>
                  <MapPin className="mx-auto mb-3 text-slate-400" size={26} />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No locations yet. Create one to start restricting logins.
                  </p>
                </div>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {locations.map((loc) => (
                  <div key={loc._id} className={`${cardClass} p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                            {loc.name}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              loc.isActive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                                : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                            }`}
                          >
                            {loc.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {loc.address && (
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {loc.address}
                          </p>
                        )}
                        <p className="mt-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {Number(loc.latitude).toFixed(6)}, {Number(loc.longitude).toFixed(6)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
                          <span>{loc.radiusMeters}m radius</span>
                          <span>
                            {loc.assignedUserCount} user
                            {loc.assignedUserCount === 1 ? "" : "s"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => runPositionTest(loc)}
                          disabled={testingId === loc._id}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                        >
                          <Crosshair size={11} />
                          {testingId === loc._id ? "Reading position..." : "Test from where I am"}
                        </button>

                        {testResults[loc._id] && (
                          <div
                            className={`mt-2 rounded-lg border p-2.5 text-[11px] leading-5 ${
                              testResults[loc._id].inside
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                                : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                            }`}
                          >
                            <p className="font-semibold">
                              {testResults[loc._id].inside
                                ? "You would be allowed in from here."
                                : `You would be BLOCKED — ${testResults[loc._id].overshoot}m outside.`}
                            </p>
                            <p className="mt-1 font-mono">
                              {testResults[loc._id].latitude.toFixed(6)},{" "}
                              {testResults[loc._id].longitude.toFixed(6)}
                            </p>
                            <p>
                              {testResults[loc._id].distance}m from centre · your device
                              reports ±{testResults[loc._id].accuracy}m accuracy
                            </p>
                            {/* The single most common explanation for a wrong
                                answer, called out rather than left for the
                                admin to infer from a raw number. */}
                            {testResults[loc._id].accuracy > 500 && (
                              <p className="mt-1.5 font-medium">
                                That accuracy figure is very poor — this device is
                                guessing your position from Wi-Fi, not GPS, and can be
                                kilometres out. Re-test on a phone before changing this
                                fence.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label={`Edit ${loc.name}`}
                          onClick={() => editLocation(loc)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleLocationActive(loc)}
                          className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"
                        >
                          {loc.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${loc.name}`}
                          onClick={() => removeLocation(loc)}
                          className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Assign Users tab ──────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {!activeLocations.length ? (
                <div className={`${cardClass} p-10 text-center`}>
                  <MapPin className="mx-auto mb-3 text-slate-400" size={26} />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Create an active location first — there is nothing to assign yet.
                  </p>
                </div>
              ) : (
                <>
                  <div className={`${cardClass} p-4`}>
                    <div className="relative max-w-sm">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        size={14}
                      />
                      <input
                        className={`${inputClass} pl-9`}
                        placeholder="Search by name, email or ID..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={`${cardClass} divide-y divide-slate-100 dark:divide-white/[0.07]`}>
                    {filteredUsers.map((user) => {
                      const ids = assignedIds(user);
                      const isFenced = Boolean(user.geofence?.enabled) && ids.length > 0;
                      // A fence with nowhere to be is unsatisfiable, and the
                      // API rejects it — so the switch genuinely cannot do
                      // anything until a location is picked. It must SHOW that
                      // rather than silently refusing: an enabled-looking
                      // control that does nothing when clicked reads as broken.
                      const canToggle = ids.length > 0;
                      return (
                        <div key={user._id} className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              {/* The "Fenced / Unrestricted" badge that used to
                                  sit here was removed: the switch and its label
                                  on the right already state the same thing, in
                                  different words, a few centimetres away. Two
                                  vocabularies for one piece of state is how a
                                  row starts looking cluttered and reading
                                  ambiguously. */}
                              <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                                {user.name}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                {user.email}
                                {user.employeeId ? ` · ${user.employeeId}` : ""}
                                {user.position ? ` · ${user.position}` : ""}
                              </p>
                            </div>
                            {/* Explicit pause switch, separate from the location
                                pills. Without it the only way to lift a
                                restriction — for someone travelling, say — is to
                                unassign every location and later remember which
                                ones they had.

                                The status word lives beside the switch rather
                                than in the page-top banner: by the time an admin
                                has scrolled down this list, a banner at the top
                                is off-screen, so a refusal looked exactly like a
                                dead control. */}
                            <div className="flex shrink-0 items-center gap-2.5">
                              <span
                                className={`text-[11px] font-medium tabular-nums ${
                                  savingUserId === user._id
                                    ? "text-slate-400"
                                    : !canToggle
                                    ? "text-slate-400 dark:text-slate-500"
                                    : isFenced
                                    ? "text-blue-600 dark:text-blue-300"
                                    : "text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {savingUserId === user._id
                                  ? "Saving…"
                                  : !canToggle
                                  ? "No location set"
                                  : isFenced
                                  ? "Enforcing"
                                  : "Paused"}
                              </span>

                              {/* Standard Tailwind switch geometry: h-6 w-11
                                  with a transparent 2px border as the inset, and
                                  a 20px knob travelling translate-x-5. The inner
                                  track is then exactly 40px = 20 travel + 20
                                  knob, so the knob lands flush at both ends
                                  without the hand-tuned pixel offsets this
                                  replaced (top-0.5 / translate-x-[22px]), which
                                  only happened to line up and broke the moment
                                  any size changed. */}
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isFenced}
                                aria-label={`${isFenced ? "Pause" : "Resume"} geofencing for ${user.name}`}
                                disabled={savingUserId === user._id || !canToggle}
                                title={
                                  canToggle
                                    ? `${isFenced ? "Pause" : "Resume"} geofencing for ${user.name}`
                                    : "Select at least one location below before enabling"
                                }
                                onClick={() => toggleUserEnabled(user)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-45 dark:focus-visible:ring-offset-[#12151c] ${
                                  isFenced
                                    ? "bg-blue-600 dark:bg-blue-500"
                                    : "bg-slate-300 dark:bg-white/20"
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    isFenced ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          </div>

                          {/* Labelled because the pills, not the switch, are
                              where the interaction actually starts — clicking
                              the first one turns the fence on. Without a label
                              the switch reads as the primary control and the
                              pills as decoration, which is backwards. */}
                          <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {canToggle ? "Allowed locations" : "Choose where this person may sign in"}
                          </p>

                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {activeLocations.map((loc) => {
                              const on = ids.includes(loc._id);
                              return (
                                <button
                                  key={loc._id}
                                  type="button"
                                  aria-pressed={on}
                                  disabled={savingUserId === user._id}
                                  onClick={() => toggleUserLocation(user, loc._id)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                                    on
                                      ? "border-blue-600 bg-blue-600 text-white dark:border-blue-400 dark:bg-blue-500"
                                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400"
                                  }`}
                                >
                                  {on && <Check size={11} className="mr-1 inline" />}
                                  {loc.name}
                                </button>
                              );
                            })}
                          </div>

                          {ids.length > 1 && (
                            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                              May sign in from any one of these {ids.length} locations.
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {!filteredUsers.length && (
                      <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        No users match that search.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Denial Log tab ────────────────────────────────────────────── */}
          {activeTab === "events" && (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="border-b border-slate-100 px-5 py-4 dark:border-white/[0.07]">
                <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                  Blocked sign-in attempts
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Successful logins are not recorded. If someone reports being
                  blocked while at the office, check the accuracy figure — a
                  large one means their device could not get a real fix.
                </p>
              </div>

              {!events.length ? (
                <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  No blocked attempts recorded.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                  {events.map((ev) => (
                    <div key={ev._id} className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {ev.userId?.name || ev.email || "Unknown user"}
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ev.createdAt).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            ev.outcome === "no-location"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300"
                          }`}
                        >
                          {ev.outcome === "login-denied"
                            ? "Blocked at login"
                            : ev.outcome === "recheck-denied"
                            ? "Left the area"
                            : "No location"}
                        </span>
                        {ev.distanceMeters != null && ev.nearestLocation?.name && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {ev.distanceMeters}m from {ev.nearestLocation.name}
                          </span>
                        )}
                        {ev.coordinates?.accuracy != null && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            ±{Math.round(ev.coordinates.accuracy)}m accuracy
                          </span>
                        )}
                      </div>
                      {ev.reason && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ev.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
