// models/Proposal.js
//
// A client-facing proposal page, served at tapvera.io/proposal/<slug>.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THE TEMPLATE IS NOT A COLLECTION
// ─────────────────────────────────────────────────────────────────────────────
// Templates are authored by developers as a folder on disk
// (server/proposal-templates/<slug>/) holding a manifest, an EJS view, a
// writing brief and a fixture. Disk is the source of truth; the registry loads
// them at boot. Putting them in Mongo as well would mean two places to keep in
// sync and a migration every time a field is added to a schema.
//
// What IS stored here is `templateVersion`. A published proposal pins the
// version it was rendered against, so editing a template tomorrow cannot
// silently change the wording of a proposal a client was sent last week. If the
// pinned version is gone from disk, the renderer says so loudly rather than
// rendering something the client never saw.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY `data` IS Mixed
// ─────────────────────────────────────────────────────────────────────────────
// Every template declares its own fields, so no single Mongoose shape fits all
// of them. Validation happens against the template's manifest before a write
// (see services/proposals/validate.js) — that is the real schema, and it lives
// beside the template it describes rather than here.
'use strict';

const mongoose = require('mongoose');

// Stages the generator walks through. The agent's UI polls for this, so the
// values are user-facing strings, not internal codes.
const GENERATION_STATES = [
  'queued',
  'researching',
  'writing',
  'validating',
  'ready',
  'failed',
];

const PROPOSAL_STATUSES = [
  'generating', // job in flight, no URL exists yet
  'draft',      // copy is ready, a human has not approved it
  'published',  // live at its public URL
  'expired',    // past expiresAt — still resolves, shows an expired state
  'archived',   // withdrawn by hand
];

const proposalSchema = new mongoose.Schema(
  {
    // ─── Which template renders this ────────────────────────────────────────
    templateSlug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    // Pinned at publish time. See the note above.
    templateVersion: {
      type: String,
      default: '1.0.0',
      trim: true,
    },

    // ─── What it is about ───────────────────────────────────────────────────
    // Internal label, shown in the superadmin list. Never rendered on the page.
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // Client-facing business name. Rendered, and used to build the slug.
    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    // The public URL segment: tapvera.io/proposal/<slug>.
    //
    // Built as slugify(businessName) + '-' + 6 random chars. The random suffix
    // is deliberate: a proposal carries pricing, and a bare guessable slug
    // means a competitor who knows the client's name can read what you quoted.
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    // ─── Optional CRM linkage ───────────────────────────────────────────────
    // All three are optional so a cold prospect with no CRM footprint still
    // works. When `project` is set, templates that declare live data sources
    // (rank history, backlinks, blog updates) fill their charts from it
    // instead of from hand-entered numbers.
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null, index: true },

    // ─── The content ────────────────────────────────────────────────────────
    // Shape is defined by the template's manifest, validated on write.
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },

    // ─── External measurements ──────────────────────────────────────────────
    // Readings taken from services outside this system — currently Google
    // PageSpeed Insights. Deliberately NOT part of `data`:
    //
    //   • `data` is written by agents and by the generator. Anything in it can
    //     be typed. A performance score must not be typeable.
    //   • The proposal renders these with their source and the date they were
    //     taken, so a claim on the page can always be traced to a reading.
    //   • When a measurement fails, the key is simply absent and the section
    //     does not render. There is no zero, no default, no placeholder — a
    //     zero renders as a score, and a score is a claim.
    //
    // Written only by the research stage of services/proposals/generate.js.
    measurements: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ─── Lifecycle ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: PROPOSAL_STATUSES,
      default: 'generating',
      index: true,
    },

    // Generation job state. The agent polls this while waiting.
    generation: {
      state: { type: String, enum: GENERATION_STATES, default: 'queued' },
      // Human-readable line shown under the progress bar, e.g.
      // "Reading ezshowerrepair.com.au". Set by each stage.
      detail: { type: String, default: '', trim: true },
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
      // Only set when state === 'failed'. Surfaced to the agent verbatim, so
      // it must stay free of stack traces and keys.
      error: { type: String, default: '', trim: true },
      model: { type: String, default: '', trim: true },
      attempts: { type: Number, default: 0 },
      // Facts gathered in the research stage, kept so a re-run can skip the
      // fetch and so an agent can see what the copy was actually based on.
      auditFindings: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    // ─── Publishing ─────────────────────────────────────────────────────────
    publishedAt: { type: Date, default: null },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Renders as "Valid until" AND enforces it: past this date the public
    // route serves an expired state instead of the pricing.
    expiresAt: { type: Date, default: null },

    // ─── Read receipts ──────────────────────────────────────────────────────
    // Denormalised from ProposalView so the list page does not need an
    // aggregation per row. ProposalView stays the source of truth.
    viewCount: { type: Number, default: 0 },
    uniqueViewCount: { type: Number, default: 0 },
    firstViewedAt: { type: Date, default: null },
    lastViewedAt: { type: Date, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

// The superadmin list is "newest first, optionally filtered by status".
proposalSchema.index({ status: 1, createdAt: -1 });

// ─── Virtuals ────────────────────────────────────────────────────────────────

// True once the client-facing URL resolves to real content.
proposalSchema.virtual('isLive').get(function () {
  if (this.status !== 'published') return false;
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return false;
  return true;
});

// Drives the "opened / not opened" pill on the client record.
proposalSchema.virtual('hasBeenOpened').get(function () {
  return Number(this.viewCount) > 0;
});

proposalSchema.virtual('publicPath').get(function () {
  return `/proposal/${this.slug}`;
});

proposalSchema.set('toJSON', { virtuals: true });
proposalSchema.set('toObject', { virtuals: true });

// ─── Statics ─────────────────────────────────────────────────────────────────

// Resolve a public slug to something renderable. Deliberately does NOT filter
// on status: the public route needs to tell "expired" apart from "never
// existed", and a 404 for an expired proposal reads to the client as a broken
// link from you rather than a deadline they missed.
proposalSchema.statics.findBySlugForRender = function (slug) {
  return this.findOne({ slug: String(slug || '').toLowerCase().trim() })
    .populate('client', 'clientName businessName email region')
    .populate('project', 'projectName type startDate endDate');
};

proposalSchema.statics.GENERATION_STATES = GENERATION_STATES;
proposalSchema.statics.PROPOSAL_STATUSES = PROPOSAL_STATUSES;

module.exports = mongoose.model('Proposal', proposalSchema);
