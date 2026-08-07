// src/api/geofenceApi.js
//
// Geofenced login (2026-08-07).
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md

import API from "../api";

const geofenceApi = {
  // ── Super Admin: locations ───────────────────────────────────────────────
  listLocations: () => API.get("/api/geofence/locations").then((r) => r.data),
  createLocation: (payload) => API.post("/api/geofence/locations", payload).then((r) => r.data),
  updateLocation: (id, payload) => API.put(`/api/geofence/locations/${id}`, payload).then((r) => r.data),
  deleteLocation: (id) => API.delete(`/api/geofence/locations/${id}`).then((r) => r.data),

  // ── Super Admin: per-user assignment ─────────────────────────────────────
  listUsers: () => API.get("/api/geofence/users").then((r) => r.data),
  updateUserGeofence: (userId, payload) =>
    API.put(`/api/geofence/users/${userId}`, payload).then((r) => r.data),

  // ── Super Admin: denial log ──────────────────────────────────────────────
  listEvents: (params = {}) => API.get("/api/geofence/events", { params }).then((r) => r.data),

  // ── Any authenticated user: session checks ───────────────────────────────
  getMyStatus: () => API.get("/api/geofence/status").then((r) => r.data),

  /**
   * The periodic re-check.
   *
   * Bypasses the shared `API` axios instance on purpose. That instance has a
   * response interceptor that hard-redirects to /login on ANY 401 — fine for
   * ordinary calls, but this endpoint is polled in the background and needs to
   * hand a 403 back to its caller so the watcher can show a reason before
   * signing out. Going through the interceptor would produce a bare redirect
   * with the user none the wiser about why they were ejected.
   */
  verify: async (coordinates) => {
    const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    const res = await fetch(`${base}/api/geofence/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ coordinates }),
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      // A body-less or non-JSON response (proxy error page, network blip) is
      // treated as inconclusive rather than as a denial — see the fail-open
      // reasoning on the server's verifySession.
      return { allowed: true, degraded: true };
    }

    return { ...data, status: res.status };
  },
};

export default geofenceApi;
