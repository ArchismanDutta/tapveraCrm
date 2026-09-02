// services/proposals/validate.js
//
// Validates a proposal's data blob against its template manifest.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY TWO MODES
// ─────────────────────────────────────────────────────────────────────────────
// A draft is a work in progress: the agent has typed four fields and wandered
// off, or the generator has filled the prose but not the pricing. Refusing to
// save that would mean losing work every time someone is interrupted, so
// `draft` mode checks only the shape of what is actually present.
//
// `publish` mode is the gate. Everything required must be there, because the
// next thing that happens is a URL going out to a paying client.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT RETURNS CLEANED DATA RATHER THAN MUTATING
// ─────────────────────────────────────────────────────────────────────────────
// The generator hands back model output, and model output is only as
// trustworthy as the parser that read it. Building a fresh object from known
// keys means a field the manifest does not declare cannot reach Mongo — no
// matter what the model emitted, and no matter what an agent posted to the API
// by hand. Anything not declared is dropped, not saved and ignored.
'use strict';

const registry = require('./registry');

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Did a human put anything in this row?
 *
 * A value equal to its sub-field's declared default was almost certainly put
 * there by the "Add row" button rather than by the agent, so it does not on its
 * own make the row real. Any other non-blank value does.
 */
function rowHasContent(rawRow, subFields) {
  if (!rawRow || typeof rawRow !== 'object') return false;
  return subFields.some((sub) => {
    const v = rawRow[sub.key];
    if (isBlank(v) || (Array.isArray(v) && v.length === 0)) return false;
    if (sub.default !== undefined && v === sub.default) return false;
    return true;
  });
}

// ─── Per-kind coercion ───────────────────────────────────────────────────────
//
// Each returns { ok, value, error }. Coercion is deliberate: an HTML form posts
// "12" and a model emits 12, and both should end up as a number rather than
// one of them failing on a technicality the user cannot see.

function coerceScalar(field, raw, path) {
  const { kind } = field;

  if (kind === 'number' || kind === 'money' || kind === 'percent') {
    const n = typeof raw === 'string' ? Number(raw.replace(/[, ]/g, '')) : Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: `${path} must be a number.` };
    if (field.min !== undefined && n < field.min) return { ok: false, error: `${path} must be at least ${field.min}.` };
    if (field.max !== undefined && n > field.max) return { ok: false, error: `${path} must be at most ${field.max}.` };
    return { ok: true, value: n };
  }

  if (kind === 'toggle') {
    return { ok: true, value: raw === true || raw === 'true' || raw === 1 || raw === '1' };
  }

  if (kind === 'date') {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) return { ok: false, error: `${path} is not a valid date.` };
    return { ok: true, value: d.toISOString() };
  }

  if (kind === 'select') {
    const s = String(raw);
    if (!field.options.includes(s)) {
      return { ok: false, error: `${path} must be one of: ${field.options.join(', ')}.` };
    }
    return { ok: true, value: s };
  }

  if (kind === 'email') {
    const s = String(raw).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, error: `${path} is not a valid email address.` };
    return { ok: true, value: s };
  }

  if (kind === 'url') {
    let s = String(raw).trim();
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    try {
      // Rejects javascript: and data: before either can reach an href in the
      // rendered page.
      const u = new URL(s);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('scheme');
      return { ok: true, value: u.toString() };
    } catch {
      return { ok: false, error: `${path} is not a valid web address.` };
    }
  }

  if (kind === 'geopoint') {
    const lat = Number(raw?.lat);
    const lng = Number(raw?.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: `${path}.lat must be between -90 and 90.` };
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: `${path}.lng must be between -180 and 180.` };
    return { ok: true, value: { lat, lng } };
  }

  // text, textarea
  let s = String(raw);
  // maxLength is a truncation, not a rejection. A model that runs eight
  // characters long should not fail a whole generation — but the cap exists
  // because the layout was designed around it, so it is enforced.
  if (field.maxLength && s.length > field.maxLength) s = s.slice(0, field.maxLength).trimEnd();
  return { ok: true, value: s };
}

function validateField(field, raw, mode, errors, path = field.key) {
  const required = field.required && mode === 'publish';

  if (isBlank(raw) || (Array.isArray(raw) && raw.length === 0)) {
    if (required) errors.push(`${field.label || path} is required.`);
    return undefined;
  }

  // ── list: array of plain strings ──
  if (field.kind === 'list') {
    if (!Array.isArray(raw)) { errors.push(`${path} must be a list.`); return undefined; }
    const items = raw.map((v) => String(v).trim()).filter(Boolean);
    if (mode === 'publish') {
      if (field.min && items.length < field.min) errors.push(`${field.label || path} needs at least ${field.min} items.`);
    }
    return field.max ? items.slice(0, field.max) : items;
  }

  // ── repeat / keywords / locations: array of objects ──
  if (['repeat', 'keywords', 'locations'].includes(field.kind)) {
    if (!Array.isArray(raw)) { errors.push(`${path} must be a list of entries.`); return undefined; }
    const subFields = field.fields || [];
    const rows = [];

    raw.forEach((rawRow, i) => {
      // An untouched row is not a row.
      //
      // The form's "Add row" button seeds each new line with every sub-field's
      // declared default, so a keyword row the agent never typed into still
      // arrives carrying difficulty:"Medium" and intent:"Commercial". Counting
      // by "has any key at all" therefore treated three untouched rows as three
      // keywords — while a single genuinely filled row failed a min of 3. The
      // validator was rejecting real work and accepting blank lines.
      //
      // A row counts only if some field holds a value the agent actually
      // supplied: non-blank, and not merely the default it was seeded with.
      if (!rowHasContent(rawRow, subFields)) return;

      const row = {};
      for (const sub of subFields) {
        const value = validateField(
          { ...sub, required: sub.required },
          rawRow?.[sub.key],
          mode,
          errors,
          `${path}[${i + 1}].${sub.key}`
        );
        if (value !== undefined) row[sub.key] = value;
      }
      if (Object.keys(row).length) rows.push(row);
    });

    if (mode === 'publish' && field.min && rows.length < field.min) {
      // Say what they have, not just what is wanted. "Needs at least 3" with no
      // count leaves an agent staring at rows they believe are filled in.
      errors.push(
        `${field.label || path} needs at least ${field.min} ` +
        `${field.min === 1 ? 'entry' : 'entries'} — you have ${rows.length}.`
      );
    }
    return field.max ? rows.slice(0, field.max) : rows;
  }

  // ── scalars ──
  const result = coerceScalar(field, raw, field.label || path);
  if (!result.ok) { errors.push(result.error); return undefined; }
  return result.value;
}

/**
 * @param {string} templateSlug
 * @param {object} data      raw blob — from the agent's form or the generator
 * @param {'draft'|'publish'} mode
 * @returns {{ valid: boolean, errors: string[], data: object }}
 */
function validate(templateSlug, data, mode = 'draft') {
  const template = registry.get(templateSlug);
  const errors = [];
  const cleaned = {};

  for (const field of template.fields) {
    // Computed and measured fields never come from input.
    //
    // Accepting a `computed` value would let anyone post their own projection
    // straight onto the chart. Accepting a `measured` one would let anyone
    // post their own PageSpeed score — which is worse, because it looks like a
    // reading from Google and the client may act on it.
    if (field.source === 'computed' || field.source === 'measured') continue;

    const value = validateField(field, data?.[field.key], mode, errors);
    if (value !== undefined) cleaned[field.key] = value;
  }

  return { valid: errors.length === 0, errors, data: cleaned };
}

/** Publish gate: everything required present and well-formed. */
function validateForPublish(templateSlug, data) {
  return validate(templateSlug, data, 'publish');
}

module.exports = { validate, validateForPublish };
