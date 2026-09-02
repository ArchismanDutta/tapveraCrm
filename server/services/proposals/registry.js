// services/proposals/registry.js
//
// Loads proposal templates from disk and hands them to the rest of the system.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE CONTRACT
// ─────────────────────────────────────────────────────────────────────────────
// A template is a folder under server/proposal-templates/:
//
//   seo-local/
//     manifest.json   field definitions, sections, live-data sources
//     template.ejs    the page itself — owns every pixel
//     prompt.md       the writing brief handed to the generator
//     sample.json     a fixture, so the template previews with no client
//
// Adding a template is copying that folder and editing four files. Nothing in
// server/ changes. That property is the whole point of the feature, and this
// file is what protects it — the moment template-specific logic leaks into a
// controller, adding template five stops being a copy and starts being a
// pull request across the codebase.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT THROWS AT BOOT
// ─────────────────────────────────────────────────────────────────────────────
// A malformed manifest is a developer mistake, and the cheapest place to find
// out is the terminal of the developer who made it. The alternative — skipping
// the broken template and carrying on — surfaces days later as "the SEO one
// isn't in the dropdown any more", with nothing in the logs.
'use strict';

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'proposal-templates');
const SHARED_FIELDS_PATH = path.join(TEMPLATES_DIR, '_shared', 'fields.json');

// Folders that are not templates.
const IGNORED = new Set(['_shared', 'node_modules']);

// Every field kind the form renderer and the validator both understand.
// Adding one here without teaching both is how a field silently stops saving,
// so the list is deliberately short and shared.
const FIELD_KINDS = new Set([
  'text', 'textarea', 'url', 'email',
  'number', 'money', 'percent',
  'date', 'select', 'toggle',
  'list',      // array of plain strings
  'repeat',    // array of objects; requires nested `fields`
  'geopoint',  // { lat, lng } — map centres
  'keywords',  // array of keyword rows; rendered as the rank table + chart
  'locations', // array of { name, lat, lng, radiusKm } — rendered on Leaflet
]);

// Where a field's value comes from. See _shared/fields.json for the full note.
//
// `measured` is the strictest of the five: the value comes from an external
// measurement service (currently Google PageSpeed Insights) and is stored on
// the proposal's `measurements`, never in `data`. No human can type it, no
// model can write it, and no API caller can post it. That is deliberate — a
// performance score is a claim the client can verify in thirty seconds, so it
// has to be a real reading or absent entirely.
const FIELD_SOURCES = new Set(['crm', 'agent', 'ai', 'computed', 'measured']);

let cache = null;

// ─── Loading ─────────────────────────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Could not read ${path.relative(TEMPLATES_DIR, filePath)}: ${err.message}`);
  }
}

function loadSharedGroups() {
  const shared = readJson(SHARED_FIELDS_PATH);
  if (!shared || typeof shared.groups !== 'object') {
    throw new Error('_shared/fields.json must export a "groups" object.');
  }
  return shared.groups;
}

/**
 * Turn a manifest's `extends` + `fields` into one ordered, flat field list.
 *
 * Order matters: it is the order the agent sees the form in. Shared groups
 * come first (identity, then prepared_by, …) in the order the manifest lists
 * them, then the template's own fields. A template may override a shared field
 * by redeclaring the same key — last declaration wins, so a template that needs
 * `industry` to be a select instead of free text can say so locally rather than
 * forcing a change on the other three.
 */
function resolveFields(manifest, sharedGroups, slug) {
  const byKey = new Map();

  for (const groupName of manifest.extends || []) {
    const group = sharedGroups[groupName];
    if (!group) {
      throw new Error(`[${slug}] extends unknown shared group "${groupName}". Known: ${Object.keys(sharedGroups).join(', ')}`);
    }
    for (const field of group.fields) {
      byKey.set(field.key, { ...field, _group: groupName, _groupLabel: group.label });
    }
  }

  for (const field of manifest.fields || []) {
    byKey.set(field.key, {
      ...field,
      _group: field.group || 'template',
      _groupLabel: field.groupLabel || manifest.name,
    });
  }

  return [...byKey.values()];
}

function validateField(field, slug, trail = '') {
  const where = `[${slug}] field ${trail}${field.key}`;

  if (!field.key || typeof field.key !== 'string') {
    throw new Error(`[${slug}] a field ${trail}is missing a string "key".`);
  }
  if (!FIELD_KINDS.has(field.kind)) {
    throw new Error(`${where}: unknown kind "${field.kind}". Known kinds: ${[...FIELD_KINDS].join(', ')}`);
  }
  // Nested fields inherit their parent's source, so only top-level fields
  // declare one.
  if (!trail && !FIELD_SOURCES.has(field.source)) {
    throw new Error(`${where}: "source" must be one of ${[...FIELD_SOURCES].join(', ')} (got "${field.source}").`);
  }
  if (field.kind === 'select' && !Array.isArray(field.options)) {
    throw new Error(`${where}: kind "select" requires an "options" array.`);
  }
  if (field.kind === 'repeat') {
    if (!Array.isArray(field.fields) || !field.fields.length) {
      throw new Error(`${where}: kind "repeat" requires a non-empty nested "fields" array.`);
    }
    field.fields.forEach((sub) => validateField(sub, slug, `${field.key}[].`));
  }
  // A field the model writes needs to be told what to write. Without a hint
  // the generator falls back to the section brief, which produces the flat,
  // interchangeable copy this whole feature exists to avoid.
  if (!trail && field.source === 'ai' && !field.aiHint) {
    throw new Error(`${where}: source "ai" requires an "aiHint" describing what to write and how long.`);
  }
}

function loadTemplate(slug, sharedGroups) {
  const dir = path.join(TEMPLATES_DIR, slug);
  const manifest = readJson(path.join(dir, 'manifest.json'));

  for (const required of ['name', 'version', 'serviceType']) {
    if (!manifest[required]) throw new Error(`[${slug}] manifest is missing "${required}".`);
  }

  const viewPath = path.join(dir, 'template.ejs');
  if (!fs.existsSync(viewPath)) {
    throw new Error(`[${slug}] has no template.ejs — the manifest describes a page that cannot be rendered.`);
  }

  const fields = resolveFields(manifest, sharedGroups, slug);
  fields.forEach((field) => validateField(field, slug));

  const promptPath = path.join(dir, 'prompt.md');
  const samplePath = path.join(dir, 'sample.json');

  return {
    slug,
    name: manifest.name,
    version: manifest.version,
    serviceType: manifest.serviceType,
    description: manifest.description || '',
    accent: manifest.accent || '#B26E0E',
    // Section list drives the page's anchor nav AND groups the fields the
    // generator writes, so one model call fills one section.
    sections: manifest.sections || [],
    // Live CRM sources this template can draw on when a Project is linked.
    liveData: manifest.liveData || [],
    // External measurements this template needs. Declaring "pagespeed" is what
    // makes the generator spend the extra minute on a Lighthouse run — the
    // social template has no use for it and should not wait.
    measures: manifest.measures || [],
    fields,
    viewPath,
    promptPath: fs.existsSync(promptPath) ? promptPath : null,
    samplePath: fs.existsSync(samplePath) ? samplePath : null,
    dir,
  };
}

function build() {
  const sharedGroups = loadSharedGroups();
  const slugs = fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !IGNORED.has(entry.name))
    .map((entry) => entry.name);

  const templates = new Map();
  for (const slug of slugs) {
    templates.set(slug, loadTemplate(slug, sharedGroups));
  }
  return templates;
}

function all() {
  // Reloading per call in development means editing a manifest shows up on the
  // next request instead of on the next restart. In production the templates
  // cannot change without a deploy, so the cache is free.
  if (!cache || process.env.NODE_ENV !== 'production') cache = build();
  return cache;
}

// ─── Public surface ──────────────────────────────────────────────────────────

/** Everything the template picker needs — no field definitions. */
function list() {
  return [...all().values()].map((t) => ({
    slug: t.slug,
    name: t.name,
    version: t.version,
    serviceType: t.serviceType,
    description: t.description,
    accent: t.accent,
    sectionCount: t.sections.length,
    fieldCount: t.fields.length,
    usesLiveData: t.liveData.length > 0,
    measures: t.measures,
  }));
}

/** The full template, fields included. Throws if the slug is unknown. */
function get(slug) {
  const template = all().get(slug);
  if (!template) {
    throw new Error(`Unknown proposal template "${slug}". Available: ${[...all().keys()].join(', ')}`);
  }
  return template;
}

function has(slug) {
  return all().has(slug);
}

/** Only the fields the generator is permitted to write. */
function aiFields(slug) {
  return get(slug).fields.filter((f) => f.source === 'ai');
}

/** Fields a human must supply before the proposal can be published. */
function requiredAgentFields(slug) {
  return get(slug).fields.filter((f) => f.source === 'agent' && f.required);
}

/** The fixture, for previewing a template with no client attached. */
function sample(slug) {
  const template = get(slug);
  if (!template.samplePath) return null;
  return readJson(template.samplePath);
}

function prompt(slug) {
  const template = get(slug);
  if (!template.promptPath) return '';
  return fs.readFileSync(template.promptPath, 'utf8');
}

/** Called at boot so a broken manifest fails the deploy, not the first request. */
function verifyAll() {
  cache = null;
  const templates = build();
  cache = templates;
  return [...templates.values()].map((t) => `${t.slug}@${t.version} (${t.fields.length} fields)`);
}

module.exports = {
  list, get, has, aiFields, requiredAgentFields, sample, prompt, verifyAll,
  FIELD_KINDS, FIELD_SOURCES, TEMPLATES_DIR,
};
