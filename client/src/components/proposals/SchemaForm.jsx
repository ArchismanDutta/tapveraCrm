// components/proposals/SchemaForm.jsx
//
// One form renderer for every proposal template, now and in future.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE MUST STAY TEMPLATE-AGNOSTIC
// ─────────────────────────────────────────────────────────────────────────────
// The whole feature rests on adding a template being a folder copy on the
// server — a manifest, a view, a brief, a fixture — with no client change. The
// moment this file contains `if (template === 'seo-local')`, that stops being
// true and template five becomes a pull request across two codebases.
//
// So this renders from the manifest and nothing else. A new field KIND is the
// only legitimate reason to edit this file, and adding one means teaching both
// this and server/services/proposals/validate.js in the same commit.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY AI AND COMPUTED FIELDS RENDER DIFFERENTLY
// ─────────────────────────────────────────────────────────────────────────────
// `source` is the guardrail made visible. An agent should see at a glance which
// words came from the generator (and are therefore theirs to check) and which
// numbers are arithmetic they cannot argue with. Pricing carries no badge at
// all, because pricing is only ever typed by a human — that is the point of it.
import React, { useMemo } from "react";
import { Sparkles, Calculator, Plus, Trash2, Info, Gauge } from "lucide-react";
import { ui, input, SOURCE_BADGE } from "./ui";

const BADGE_ICON = { ai: Sparkles, computed: Calculator, measured: Gauge, crm: null };

/* ── Scalars ─────────────────────────────────────────────────────────────── */

function ScalarInput({ field, value, onChange, disabled }) {
  const common = { className: input, disabled, id: field.key };

  switch (field.kind) {
    case "textarea":
      return (
        <textarea {...common} rows={field.maxLength > 400 ? 5 : 3} maxLength={field.maxLength}
          value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );

    case "select":
      return (
        <select {...common} value={value ?? field.default ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );

    case "toggle":
      return (
        <button type="button" disabled={disabled} onClick={() => onChange(!value)} aria-pressed={!!value}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            value ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            value ? "left-[22px]" : "left-0.5"}`} />
        </button>
      );

    case "number":
    case "percent":
    case "money":
      return (
        <div className="relative">
          <input {...common} type="number" min={field.min} max={field.max}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={`${input} ${field.kind !== "number" ? "pr-9" : ""}`} />
          {field.kind !== "number" && (
            <span className={`pointer-events-none absolute right-3 top-2 text-sm ${ui.faint}`}>
              {field.kind === "percent" ? "%" : "$"}
            </span>
          )}
        </div>
      );

    case "date":
      return (
        <input {...common} type="date" value={value ? String(value).slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)} />
      );

    case "geopoint":
      return (
        <div className="grid grid-cols-2 gap-2">
          <input className={input} type="number" step="any" placeholder="Latitude" disabled={disabled}
            value={value?.lat ?? ""} onChange={(e) => onChange({ ...(value || {}), lat: Number(e.target.value) })} />
          <input className={input} type="number" step="any" placeholder="Longitude" disabled={disabled}
            value={value?.lng ?? ""} onChange={(e) => onChange({ ...(value || {}), lng: Number(e.target.value) })} />
        </div>
      );

    default:
      return (
        <input {...common}
          type={field.kind === "email" ? "email" : field.kind === "url" ? "url" : "text"}
          maxLength={field.maxLength} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

/* ── list: array of plain strings ────────────────────────────────────────── */

const addBtn =
  "flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-1.5 text-xs font-medium " +
  "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 " +
  "hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors";

const delBtn = "shrink-0 text-gray-400 dark:text-gray-600 hover:text-red-500 transition-colors";

function ListInput({ field, value, onChange, disabled }) {
  const items = Array.isArray(value) ? value : [];
  const set = (i, v) => onChange(items.map((it, j) => (j === i ? v : it)));

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={input} value={item} disabled={disabled} onChange={(e) => set(i, e.target.value)} />
          <button type="button" disabled={disabled} className={`${delBtn} p-1`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {(!field.max || items.length < field.max) && !disabled && (
        <button type="button" className={addBtn} onClick={() => onChange([...items, ""])}>
          <Plus size={13} /> Add item
        </button>
      )}
    </div>
  );
}

/* ── repeat / keywords / locations: array of objects ─────────────────────── */

function RepeatInput({ field, value, onChange, disabled }) {
  const rows = Array.isArray(value) ? value : [];
  const subs = field.fields || [];

  // A keyword or suburb list is dozens of short rows and reads as a grid; a
  // pricing tier is a handful of rich records and reads as cards. Same data
  // shape, two different jobs — so the layout follows the field kind.
  const asGrid = field.kind === "keywords" || field.kind === "locations";

  const setCell = (i, key, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const blank = () => Object.fromEntries(subs.map((s) => [s.key, s.default ?? (s.kind === "list" ? [] : "")]));

  if (asGrid) {
    return (
      <div className="space-y-2">
        <div className={`overflow-x-auto rounded-lg border ${ui.border}`}>
          <table className="w-full min-w-[640px] text-sm">
            <thead className={ui.sunken}>
              <tr>
                {subs.map((s) => (
                  <th key={s.key}
                      className={`px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide ${ui.muted}`}>
                    {s.label}
                  </th>
                ))}
                <th className="w-9" />
              </tr>
            </thead>
            <tbody className={`divide-y ${ui.divide}`}>
              {rows.map((row, i) => (
                <tr key={i}>
                  {subs.map((s) => (
                    <td key={s.key} className="px-1.5 py-1.5">
                      <ScalarInput field={s} value={row[s.key]} disabled={disabled}
                        onChange={(v) => setCell(i, s.key, v)} />
                    </td>
                  ))}
                  <td className="px-1.5 text-center">
                    <button type="button" disabled={disabled} className={delBtn}
                      onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={subs.length + 1} className={`px-3 py-6 text-center text-sm ${ui.faint}`}>
                    Nothing here yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {(!field.max || rows.length < field.max) && !disabled && (
          <button type="button" className={addBtn} onClick={() => onChange([...rows, blank()])}>
            <Plus size={13} /> Add {field.itemLabel?.toLowerCase() || "row"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className={`rounded-lg border p-3 ${ui.border} ${ui.sunken}`}>
          <div className="mb-2 flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${ui.muted}`}>
              {field.itemLabel || "Entry"} {i + 1}
            </span>
            <button type="button" disabled={disabled} className={delBtn}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {subs.map((s) => (
              <div key={s.key} className={s.kind === "list" || s.kind === "textarea" ? "sm:col-span-2" : ""}>
                <label className={`mb-1 block text-xs font-medium ${ui.body}`}>{s.label}</label>
                {s.kind === "list" ? (
                  <ListInput field={s} value={row[s.key]} disabled={disabled} onChange={(v) => setCell(i, s.key, v)} />
                ) : (
                  <ScalarInput field={s} value={row[s.key]} disabled={disabled} onChange={(v) => setCell(i, s.key, v)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {(!field.max || rows.length < field.max) && !disabled && (
        <button type="button" className={addBtn} onClick={() => onChange([...rows, blank()])}>
          <Plus size={13} /> Add {field.itemLabel?.toLowerCase() || "entry"}
        </button>
      )}
    </div>
  );
}

/* ── One field ───────────────────────────────────────────────────────────── */

function Field({ field, value, onChange, error }) {
  // Computed and measured fields are shown so the agent knows the value exists
  // and where it comes from, but never as inputs. Accepting a computed one would
  // let the chart disagree with the table it is drawn from; accepting a measured
  // one would let somebody type a PageSpeed score the client can disprove.
  const disabled = field.source === "computed" || field.source === "measured";
  const badge = SOURCE_BADGE[field.source];
  const BadgeIcon = BADGE_ICON[field.source];
  const wide = ["repeat", "keywords", "locations", "textarea"].includes(field.kind);

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <label htmlFor={field.key} className={`text-sm font-medium ${ui.body}`}>
          {field.label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {badge && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
            {BadgeIcon && <BadgeIcon size={9} />}
            {badge.label}
          </span>
        )}
      </div>

      {disabled ? (
        <div className={`rounded-lg border border-dashed px-3 py-2 text-xs ${ui.borderInput} ${ui.sunken} ${ui.faint}`}>
          {field.source === "measured"
            ? "Measured by Google PageSpeed Insights when you generate the draft. If the measurement fails, this section is left out rather than estimated."
            : "Calculated from your inputs — appears on the page, not editable here."}
        </div>
      ) : field.kind === "list" ? (
        <ListInput field={field} value={value} onChange={onChange} />
      ) : ["repeat", "keywords", "locations"].includes(field.kind) ? (
        <RepeatInput field={field} value={value} onChange={onChange} />
      ) : (
        <ScalarInput field={field} value={value} onChange={onChange} />
      )}

      {field.help && !disabled && (
        <p className={`mt-1.5 flex items-start gap-1.5 text-xs ${ui.faint}`}>
          <Info size={12} className="mt-0.5 shrink-0" />{field.help}
        </p>
      )}
      {field.source === "ai" && field.aiHint && (
        <p className="mt-1.5 text-xs italic text-violet-600 dark:text-violet-400">
          Generator brief: {field.aiHint}
        </p>
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/* ── The form ────────────────────────────────────────────────────────────── */

export default function SchemaForm({ template, data, onChange, errors = {} }) {
  // Grouped by the manifest's own section list, so the form reads in the same
  // order as the page it produces. Anything not claimed by a section falls into
  // a leading shared group rather than disappearing.
  const groups = useMemo(() => {
    if (!template) return [];
    const bySection = new Map();
    const shared = [];

    for (const f of template.fields) {
      const section = template.sections.find((s) => s.id === f._group);
      if (section) {
        if (!bySection.has(section.id)) bySection.set(section.id, { label: section.title, fields: [] });
        bySection.get(section.id).fields.push(f);
      } else {
        shared.push(f);
      }
    }

    const sharedGroups = [];
    for (const f of shared) {
      const label = f._groupLabel || "Details";
      let g = sharedGroups.find((x) => x.label === label);
      if (!g) { g = { label, fields: [] }; sharedGroups.push(g); }
      g.fields.push(f);
    }

    return [...sharedGroups, ...template.sections.map((s) => bySection.get(s.id)).filter(Boolean)];
  }, [template]);

  if (!template) return null;

  return (
    <div className="space-y-7">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className={`mb-3 border-b pb-2 text-sm font-semibold uppercase tracking-wide ${ui.border} ${ui.muted}`}>
            {group.label}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((f) => (
              <Field key={f.key} field={f} value={data[f.key]} error={errors[f.key]}
                onChange={(v) => onChange({ ...data, [f.key]: v })} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
