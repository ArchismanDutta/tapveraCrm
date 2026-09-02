// pages/ProposalsPage.jsx
//
// Super-admin proposal builder: pick a template, fill the form the manifest
// describes, watch the live preview, publish, then see who opened it.
//
// The page holds no knowledge of any specific template. Everything it renders
// comes from the manifest the server hands back, which is what keeps adding
// template five a server-side folder copy.
//
// Colours come from components/proposals/ui.js so these screens sit in the
// CRM's dark theme the same way ClientRequests and SuperAdminDashboard do.
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText, Plus, ExternalLink, Copy, Eye, Send, ArrowLeft,
  Loader2, CheckCircle2, Clock, Search, RefreshCw, Monitor, Smartphone, X,
  Sparkles, AlertTriangle,
} from "lucide-react";
import proposalsApi from "../api/proposals";
import SchemaForm from "../components/proposals/SchemaForm";
import { ui, input, btnPrimary, btnGhost, STATUS_STYLE } from "../components/proposals/ui";

/* ── Template picker ─────────────────────────────────────────────────────── */

function TemplatePicker({ templates, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
         onClick={onClose}>
      <div className={`max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl border p-6 shadow-2xl ${ui.card} ${ui.border}`}
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className={`text-lg font-semibold ${ui.heading}`}>Choose a template</h2>
            <p className={`mt-1 text-sm ${ui.muted}`}>
              Each one asks for the inputs that service actually needs.
            </p>
          </div>
          <button onClick={onClose} className={`rounded-lg p-1.5 ${ui.faint} ${ui.hover}`}>
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <button key={t.slug} onClick={() => onPick(t)}
              className={`group rounded-xl border p-4 text-left transition-all ${ui.border} ${ui.sunken}
                          hover:border-blue-500 hover:shadow-md`}>
              <div className="flex items-start gap-3">
                <span className="mt-1 h-9 w-1.5 shrink-0 rounded-full" style={{ background: t.accent }} />
                <div className="min-w-0">
                  <div className={`font-semibold ${ui.heading}`}>{t.name}</div>
                  <div className={`mt-0.5 text-[11px] font-medium uppercase tracking-wide ${ui.faint}`}>
                    {t.serviceType}
                  </div>
                  <p className={`mt-2 text-sm leading-snug ${ui.muted}`}>{t.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                    <span className={`rounded px-1.5 py-0.5 ${ui.card} ${ui.muted}`}>{t.fieldCount} fields</span>
                    {t.usesLiveData && (
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">
                        Pulls live CRM data
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {!templates.length && (
            <p className={`col-span-full py-8 text-center text-sm ${ui.faint}`}>
              No templates found. Check the server can read <code>server/proposal-templates/</code>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Editor ──────────────────────────────────────────────────────────────── */

function Editor({ proposalId, onBack, onChanged }) {
  const [proposal, setProposal] = useState(null);
  const [template, setTemplate] = useState(null);
  const [data, setData] = useState({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [device, setDevice] = useState("desktop");
  const [analytics, setAnalytics] = useState(null);
  const [generating, setGenerating] = useState(false);

  const gen = proposal?.generation;
  const inFlight = ["queued", "researching", "writing", "validating"].includes(gen?.state);

  // Poll while a draft is being written.
  //
  // Two seconds because the pipeline's slow stage is a page fetch plus a model
  // call — roughly 20-60s — and the point of polling is to move the progress
  // line, not to catch the finish instantly. The interval clears itself the
  // moment the state settles, so a failed job does not leave a timer running.
  useEffect(() => {
    if (!inFlight) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await proposalsApi.get(proposalId);
        setProposal(res.proposal);
        const st = res.proposal.generation?.state;
        if (st === "ready") {
          // Only now adopt the server's copy — replacing `data` mid-generation
          // would wipe whatever the agent typed while they waited.
          setData(res.proposal.data || {});
          setPreviewNonce((n) => n + 1);
          setGenerating(false);
          toast.success("Draft ready — review it before publishing");
        } else if (st === "failed") {
          setGenerating(false);
          toast.error(res.proposal.generation?.error || "Generation failed");
        }
      } catch { /* a dropped poll is not worth surfacing; the next one retries */ }
    }, 2000);
    return () => clearInterval(id);
  }, [inFlight, proposalId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await proposalsApi.get(proposalId);
      if (!alive) return;
      setProposal(res.proposal);
      setData(res.proposal.data || {});
      setAnalytics(res.analytics);
      setTemplate(await proposalsApi.getTemplate(res.proposal.templateSlug));
    })().catch((e) => toast.error(e.response?.data?.message || e.message));
    return () => { alive = false; };
  }, [proposalId]);

  const save = useCallback(async (silent = false) => {
    setSaving(true);
    try {
      const updated = await proposalsApi.update(proposalId, { data });
      setProposal(updated);
      setErrors([]);
      // The preview is an iframe of a server render, so it only reflects saved
      // state. Bumping the nonce after a save is what makes "edit, look" work.
      setPreviewNonce((n) => n + 1);
      if (!silent) toast.success("Saved");
      onChanged?.();
      return true;
    } catch (e) {
      setErrors(e.response?.data?.errors || [e.response?.data?.message || e.message]);
      if (!silent) toast.error("Could not save — see the errors above");
      return false;
    } finally {
      setSaving(false);
    }
  }, [proposalId, data, onChanged]);

  const generateDraft = async () => {
    setGenerating(true);
    try {
      // Save first: the generator reads the brief and the typed fields from the
      // database, not from this form's memory.
      if (!(await save(true))) { setGenerating(false); return; }
      await proposalsApi.generate(proposalId);
      const res = await proposalsApi.get(proposalId);
      setProposal(res.proposal);
    } catch (e) {
      setGenerating(false);
      toast.error(e.response?.data?.message || "Could not start generation");
    }
  };

  const publish = async () => {
    setPublishing(true);
    try {
      if (!(await save(true))) return;
      const res = await proposalsApi.publish(proposalId);
      setProposal(res.proposal);
      setErrors([]);
      toast.success("Published");
      onChanged?.();
      navigator.clipboard?.writeText(res.url).then(() => toast.success("Link copied"), () => {});
    } catch (e) {
      setErrors(e.response?.data?.errors || [e.response?.data?.message || e.message]);
      toast.error("Not ready to publish");
    } finally {
      setPublishing(false);
    }
  };

  if (!proposal || !template) {
    return (
      <div className={`flex h-64 items-center justify-center ${ui.faint}`}>
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const publicUrl = `${import.meta.env.VITE_PROPOSAL_BASE || "https://tapvera.io"}/proposal/${proposal.slug}`;
  const status = STATUS_STYLE[proposal.status] || STATUS_STYLE.draft;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button onClick={onBack} className={btnGhost}><ArrowLeft size={15} /> All proposals</button>

        <div className="min-w-0 flex-1">
          <h1 className={`truncate text-lg font-semibold ${ui.heading}`}>{proposal.title}</h1>
          <div className={`mt-0.5 flex flex-wrap items-center gap-2 text-xs ${ui.muted}`}>
            <span className={`rounded-full border px-2 py-0.5 font-medium ${status.cls}`}>{status.label}</span>
            <span>{template.name}</span>
            {proposal.status === "published" && (
              <>
                <span>·</span>
                <span>{proposal.viewCount || 0} view{proposal.viewCount === 1 ? "" : "s"}</span>
                {analytics?.reachedPricing && (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">· reached pricing</span>
                )}
              </>
            )}
          </div>
        </div>

        {proposal.status === "published" && (
          <>
            <button className={btnGhost} onClick={() => {
              navigator.clipboard?.writeText(publicUrl);
              toast.success("Link copied");
            }}><Copy size={15} /> Copy link</button>
            <a className={btnGhost} href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> Open
            </a>
          </>
        )}
        <button
          className={`${btnGhost} border-violet-400 text-violet-700 hover:bg-violet-50 dark:border-violet-500/40 dark:text-violet-300 dark:hover:bg-violet-500/10`}
          onClick={generateDraft}
          disabled={generating || inFlight}
          title="Reads their website, then drafts the narrative sections">
          {generating || inFlight
            ? <Loader2 size={15} className="animate-spin" />
            : <Sparkles size={15} />}
          {inFlight ? "Drafting…" : "Draft with AI"}
        </button>
        <button className={btnGhost} onClick={() => save()} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save
        </button>
        <button className={btnPrimary} onClick={publish} disabled={publishing}>
          {publishing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {proposal.status === "published" ? "Republish" : "Publish"}
        </button>
      </div>

      {inFlight && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-300 bg-violet-50 p-4 dark:border-violet-500/30 dark:bg-violet-500/10">
          <Loader2 size={18} className="shrink-0 animate-spin text-violet-600 dark:text-violet-400" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-violet-800 dark:text-violet-300">
              {{ queued: "Queued", researching: "Reading their website", writing: "Drafting the copy", validating: "Checking it fits the template" }[gen.state] || "Working"}
            </div>
            {gen.detail && (
              <div className="truncate text-xs text-violet-700 dark:text-violet-400">{gen.detail}</div>
            )}
          </div>
          <span className="ml-auto shrink-0 text-xs text-violet-600 dark:text-violet-400">
            Usually 30–60 seconds. You can keep editing other fields.
          </span>
        </div>
      )}

      {gen?.state === "failed" && gen.error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-300">Generation didn't finish</div>
            <div className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">{gen.error}</div>
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-500">
              Nothing you typed was lost — fill the drafted fields by hand, or try again.
            </div>
          </div>
        </div>
      )}

      {errors.length > 0 && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
          <div className="text-sm font-semibold text-red-800 dark:text-red-300">
            {errors.length} thing{errors.length === 1 ? "" : "s"} to fix before this can go out
          </div>
          <ul className="mt-2 space-y-1 text-sm text-red-700 dark:text-red-400">
            {errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`rounded-xl border p-5 ${ui.card} ${ui.border}`}>
          <SchemaForm template={template} data={data} onChange={setData} />
        </div>

        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-7rem)]">
          <div className={`flex h-full flex-col overflow-hidden rounded-xl border ${ui.card} ${ui.border}`}>
            <div className={`flex items-center gap-2 border-b px-3 py-2 ${ui.border}`}>
              <Eye size={14} className={ui.faint} />
              <span className={`text-xs font-medium ${ui.muted}`}>Live preview</span>
              <span className="ml-auto flex gap-1">
                {[["desktop", Monitor], ["mobile", Smartphone]].map(([mode, Icon]) => (
                  <button key={mode} onClick={() => setDevice(mode)}
                    className={`rounded-md p-1.5 transition-colors ${
                      device === mode ? "bg-blue-600 text-white" : `${ui.faint} ${ui.hover}`}`}>
                    <Icon size={13} />
                  </button>
                ))}
              </span>
              <button onClick={() => save()} title="Save and refresh preview"
                className={`rounded-md p-1.5 ${ui.faint} ${ui.hover}`}>
                <RefreshCw size={13} className={saving ? "animate-spin" : ""} />
              </button>
            </div>

            {/* Neutral grey rather than a theme surface: the proposal itself is
                a committed light document, and floating it on near-black makes
                the agent think the page has a dark mode it does not have. */}
            <div className="flex-1 overflow-hidden bg-gray-200 p-2 dark:bg-[#0a0f16]">
              <iframe key={previewNonce} title="Proposal preview"
                src={`${proposalsApi.previewUrl(proposalId)}&v=${previewNonce}`}
                className={`mx-auto h-full rounded-lg border bg-white ${ui.border}`}
                style={{ width: device === "mobile" ? 390 : "100%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── List ────────────────────────────────────────────────────────────────── */

export default function ProposalsPage() {
  const [rows, setRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await proposalsApi.list({ q: q || undefined, status: statusFilter || undefined });
      setRows(res.proposals);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not load proposals");
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    proposalsApi.listTemplates().then(setTemplates)
      .catch((e) => toast.error(e.response?.data?.message || "Template registry unavailable"));
  }, []);

  const createFrom = async (template) => {
    const businessName = window.prompt(`Business name for this ${template.name} proposal?`);
    if (!businessName) return;
    try {
      const created = await proposalsApi.create({
        templateSlug: template.slug,
        businessName,
        data: { business_name: businessName },
      });
      setPicking(false);
      setEditing(created._id);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not create");
    }
  };

  return (
    <div className={`min-h-[100dvh] ${ui.page}`}>
      <div className="mx-auto max-w-[1600px] p-5">
        {editing ? (
          <Editor proposalId={editing} onBack={() => { setEditing(null); load(); }} onChanged={load} />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <h1 className={`flex items-center gap-2 text-2xl font-bold ${ui.heading}`}>
                  <FileText size={22} /> Proposals
                </h1>
                <p className={`mt-1 text-sm ${ui.muted}`}>
                  Build a hosted proposal from a template, publish it, and see who opened it.
                </p>
              </div>
              <button className={btnPrimary} onClick={() => setPicking(true)}>
                <Plus size={16} /> New proposal
              </button>
            </div>

            <div className={`mb-5 flex flex-wrap gap-3 rounded-xl border p-4 ${ui.card} ${ui.border}`}>
              <div className="relative min-w-[200px] flex-1">
                <Search size={15} className={`absolute left-3 top-2.5 ${ui.faint}`} />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by business name…" className={`${input} pl-9`} />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className={`${input} w-auto`}>
                <option value="">All statuses</option>
                {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            <div className={`overflow-hidden rounded-xl border ${ui.card} ${ui.border}`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className={ui.sunken}>
                    <tr>
                      {["Proposal", "Template", "Status", "Opened", "Created", ""].map((h, i) => (
                        <th key={i}
                            className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide ${ui.muted}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${ui.divide}`}>
                    {loading && (
                      <tr><td colSpan={6} className={`px-4 py-14 text-center ${ui.faint}`}>
                        <Loader2 className="mx-auto animate-spin" size={20} />
                      </td></tr>
                    )}

                    {!loading && !rows.length && (
                      <tr><td colSpan={6} className="px-4 py-14 text-center">
                        <FileText size={28} className={`mx-auto mb-3 ${ui.faint}`} />
                        <p className={`text-sm ${ui.muted}`}>No proposals yet.</p>
                        <button className={`${btnGhost} mt-4`} onClick={() => setPicking(true)}>
                          <Plus size={15} /> Build the first one
                        </button>
                      </td></tr>
                    )}

                    {!loading && rows.map((p) => {
                      const s = STATUS_STYLE[p.status] || STATUS_STYLE.draft;
                      return (
                        <tr key={p._id} className={`${ui.hover} transition-colors`}>
                          <td className="px-4 py-3">
                            <button onClick={() => setEditing(p._id)}
                              className={`text-left font-medium hover:underline ${ui.heading}`}>
                              {p.businessName}
                            </button>
                            <div className={`text-xs ${ui.faint}`}>/proposal/{p.slug}</div>
                          </td>
                          <td className={`px-4 py-3 ${ui.muted}`}>{p.templateSlug}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {p.viewCount > 0 ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={14} /> {p.viewCount}
                              </span>
                            ) : p.status === "published" ? (
                              <span className={`inline-flex items-center gap-1.5 ${ui.faint}`}>
                                <Clock size={14} /> Not yet
                              </span>
                            ) : <span className={ui.faint}>—</span>}
                          </td>
                          <td className={`px-4 py-3 ${ui.muted}`}>
                            {new Date(p.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => setEditing(p._id)}
                              className={`${ui.faint} hover:text-blue-500 transition-colors`}>
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {picking && (
          <TemplatePicker templates={templates} onPick={createFrom} onClose={() => setPicking(false)} />
        )}
      </div>
    </div>
  );
}
