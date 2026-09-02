// services/proposals/render.js
//
// Turns a Proposal document into the HTML a prospect sees.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY EJS AND NOT A CLIENT-SIDE FRAMEWORK
// ─────────────────────────────────────────────────────────────────────────────
// The page is read once, on a phone, by someone who was sent a link — often on
// a trade site with two bars of signal. Server-rendered HTML shows text on the
// first paint with no bundle to download and no hydration to wait for. It also
// means the PDF export is the same code path as the web page rather than a
// second renderer that drifts, and that a proposal still reads correctly if
// JavaScript never runs at all.
//
// EJS specifically because the CRM already renders its PDF reports with it
// (views/pdf/*.ejs), so this is a pattern the team maintains rather than a new
// dependency.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT IS AND IS NOT ESCAPED
// ─────────────────────────────────────────────────────────────────────────────
// Every value in `data` reaches the page through EJS's escaping `<%= %>`.
// Nothing in a proposal is author-supplied HTML: the agent types plain text and
// the generator returns plain strings, both already run through validate.js.
// If a template ever needs `<%- %>`, that is a design change to argue about in
// review, not a convenience — the blob is partly model-written, and a model
// that can emit markup into a page you host is a model that can emit a script
// tag into a page you host.
'use strict';

const ejs = require('ejs');
const path = require('path');
const registry = require('./registry');
const { computeFor } = require('./compute');

const PARTIALS_DIR = path.join(registry.TEMPLATES_DIR, '_shared', 'partials');

// ─── Formatting helpers handed to every template ─────────────────────────────

const CURRENCY_SYMBOLS = {
  AUD: 'A$', USD: '$', CAD: 'C$', INR: '₹', GBP: '£', NZD: 'NZ$', SGD: 'S$', AED: 'AED ',
};

function money(amount, currency = 'AUD') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  const symbol = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${symbol}${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-AU') : '';
}

function longDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Rank 101 is a sentinel, not a position. Printing "101" next to a keyword
 * tells a client they are 101st, which is both wrong and worse than the truth.
 */
function rankLabel(rank) {
  const n = Number(rank);
  if (!Number.isFinite(n) || n === 0 || n >= 101) return 'Not ranking';
  return `#${n}`;
}

/** Deterministic dark-on-light initials tile, so a template needs no logo upload. */
function initials(name = '') {
  return String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
}

// ─── The render context ──────────────────────────────────────────────────────

function buildContext(proposal, template, options = {}) {
  const data = proposal.data || {};
  // Readings from outside this system. `measured.ok === true` is the ONLY
  // condition under which a template may print a score.
  const measured = proposal.measurements || null;
  const computed = computeFor(template.slug, data, measured);

  const isExpired = Boolean(
    proposal.expiresAt && new Date(proposal.expiresAt).getTime() < Date.now()
  );

  return {
    // Content
    d: data,                 // short alias — templates read this on every line
    computed,
    measured,
    proposal: {
      id: String(proposal._id || ''),
      slug: proposal.slug,
      status: proposal.status,
      businessName: proposal.businessName,
      publishedAt: proposal.publishedAt,
      expiresAt: proposal.expiresAt,
    },

    // Template metadata
    template: {
      slug: template.slug,
      name: template.name,
      version: template.version,
      accent: template.accent,
      sections: template.sections,
      serviceType: template.serviceType,
    },

    // Render mode changes real behaviour:
    //   web   the hosted page, with the tracking beacon and interactive bits
    //   pdf   Playwright's print pass — no beacon, no map tiles waiting on the
    //         network, nav collapsed, backgrounds forced to print
    //   preview  the agent's live iframe — no beacon, watermarked as a draft
    mode: options.mode || 'web',
    isExpired,
    isDraftPreview: options.mode === 'preview',

    // Absolute base for OG tags and the beacon endpoint.
    baseUrl: (process.env.PROPOSAL_PUBLIC_BASE || 'https://tapvera.io').replace(/\/$/, ''),
    apiBase: (process.env.PROPOSAL_API_BASE || process.env.PUBLIC_API_BASE || '').replace(/\/$/, ''),

    // Helpers
    money, number, longDate, rankLabel, initials,
    partial: (name) => path.join(PARTIALS_DIR, `${name}.ejs`),
  };
}

/**
 * @param {Proposal} proposal  a Mongoose doc or lean object
 * @param {{ mode?: 'web'|'pdf'|'preview' }} options
 * @returns {Promise<string>} complete HTML document
 */
async function render(proposal, options = {}) {
  // A published proposal pins the template version it was approved at. If disk
  // has moved on, say so rather than quietly rendering wording the client never
  // agreed to — a proposal is a commercial document, and "it looked different
  // when I sent it" is not a defensible position.
  const template = registry.get(proposal.templateSlug);
  if (
    proposal.status === 'published' &&
    proposal.templateVersion &&
    proposal.templateVersion !== template.version &&
    process.env.PROPOSAL_STRICT_VERSION === 'true'
  ) {
    throw Object.assign(
      new Error(
        `Proposal ${proposal.slug} was published against ${proposal.templateSlug}@${proposal.templateVersion}, ` +
        `but disk now has @${template.version}.`
      ),
      { code: 'TEMPLATE_VERSION_DRIFT' }
    );
  }

  const context = buildContext(proposal, template, options);

  // NOTE: `async` is deliberately NOT enabled.
  //
  // With async:true EJS turns include() into a promise-returning call, so
  // `<%- include('partials/map') %>` renders the string "[object Promise]"
  // into the page unless every single include is also awaited. Nothing in
  // these templates does asynchronous work — the data is already resolved
  // before render() is called — so the synchronous compiler is both correct
  // and one less trap for whoever writes template five.
  //
  // renderFile still returns a promise here because no callback is passed,
  // which is why this function is async at all.
  return ejs.renderFile(template.viewPath, context, {
    // Lets a template write include('partials/map') and resolve against
    // _shared/partials without knowing where it lives on disk.
    views: [registry.TEMPLATES_DIR, path.join(registry.TEMPLATES_DIR, '_shared')],
    rmWhitespace: options.mode === 'pdf',
  });
}

/** Renders a template against its fixture — no database, no client. */
async function renderSample(templateSlug, options = {}) {
  const template = registry.get(templateSlug);
  const sample = registry.sample(templateSlug);
  if (!sample) throw new Error(`Template "${templateSlug}" has no sample.json to preview.`);

  // A fixture may carry `_measurements` shaped exactly like a real
  // measureSite() return, so previewing a template exercises the same rendering
  // path as production rather than a simplified stand-in. It is stripped from
  // `data` because measurements never live there.
  const { _measurements, ...data } = sample;

  return render(
    {
      _id: 'sample',
      slug: `sample-${templateSlug}`,
      templateSlug,
      templateVersion: template.version,
      businessName: sample.business_name || 'Sample Business',
      status: 'draft',
      data,
      measurements: _measurements || null,
      publishedAt: new Date(),
      expiresAt: null,
    },
    { mode: 'preview', ...options }
  );
}

module.exports = { render, renderSample, money, longDate, rankLabel, buildContext };
