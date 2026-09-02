// api/proposals.js — every call the Proposals page makes.
//
// Kept in one file so the page components never build a URL themselves; when
// the API moves, this is the only thing that changes.
import API from "../api";

const proposalsApi = {
  // ── Templates ──
  listTemplates: () => API.get("/api/proposals/templates").then((r) => r.data.templates),
  getTemplate: (slug) => API.get(`/api/proposals/templates/${slug}`).then((r) => r.data),

  // ── Prefill from a linked project ──
  prefill: (projectId, templateSlug) =>
    API.get("/api/proposals/prefill", { params: { projectId, templateSlug } }).then((r) => r.data),

  // ── CRUD ──
  list: (params = {}) => API.get("/api/proposals", { params }).then((r) => r.data),
  get: (id) => API.get(`/api/proposals/${id}`).then((r) => r.data),
  create: (payload) => API.post("/api/proposals", payload).then((r) => r.data.proposal),
  update: (id, payload) => API.patch(`/api/proposals/${id}`, payload).then((r) => r.data.proposal),
  publish: (id) => API.post(`/api/proposals/${id}/publish`).then((r) => r.data),
  unpublish: (id) => API.post(`/api/proposals/${id}/unpublish`).then((r) => r.data.proposal),
  archive: (id) => API.delete(`/api/proposals/${id}`).then((r) => r.data),
  analytics: (id) => API.get(`/api/proposals/${id}/analytics`).then((r) => r.data),

  // Returns 202 and runs in the background — the caller polls get() for
  // proposal.generation.state until it reads 'ready' or 'failed'.
  generate: (id) => API.post(`/api/proposals/${id}/generate`).then((r) => r.data),

  // ── Preview URLs (loaded into an iframe, not fetched) ──
  //
  // The iframe cannot send an Authorization header, so these carry the token
  // as a query parameter. That is acceptable only because the preview route is
  // read-only and returns the same HTML the agent is already looking at.
  previewUrl: (id) => {
    const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    const token = localStorage.getItem("token");
    return `${base}/api/proposals/${id}/preview?token=${encodeURIComponent(token || "")}`;
  },
  samplePreviewUrl: (slug) => {
    const base = import.meta.env.VITE_API_BASE || "http://localhost:5000";
    const token = localStorage.getItem("token");
    return `${base}/api/proposals/templates/${slug}/sample-preview?token=${encodeURIComponent(token || "")}`;
  },
};

export default proposalsApi;
