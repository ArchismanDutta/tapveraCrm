// models/ProposalView.js
//
// One row per time a prospect opened a proposal page.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY A BEACON AND NOT SERVER-SIDE LOGGING
// ─────────────────────────────────────────────────────────────────────────────
// Proposal HTML is cached at the Cloudflare edge, so a second read of the same
// proposal never reaches this server — server-side logging would under-count by
// however well the cache is working. The page therefore posts to
// /api/proposal-views on load and again on unload, and that beacon is what
// writes here.
//
// The beacon is also the only way to get the two numbers that actually matter
// to a salesperson: how far down the page they scrolled, and how long they
// stayed. A request log can never know either.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY ipHash AND NOT ip
// ─────────────────────────────────────────────────────────────────────────────
// The question being answered is "is this the same reader as before", which a
// salted hash answers exactly as well as the address itself. Storing the raw
// address would mean holding a prospect's location in a table that exists to
// count page loads. The salt is server-side (PROPOSAL_VIEW_SALT), so the hashes
// are useless if this collection ever leaves the building.
'use strict';

const mongoose = require('mongoose');

const proposalViewSchema = new mongoose.Schema(
  {
    proposal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proposal',
      required: true,
      index: true,
    },

    // Random id the page mints per pageview and reuses for its unload beacon,
    // so the open and the dwell time land on one row instead of two.
    sessionId: { type: String, required: true, index: true },

    viewedAt: { type: Date, default: Date.now, index: true },

    // Salted hash — see the note above. Used only for unique-reader counting.
    ipHash: { type: String, default: '', index: true },
    userAgent: { type: String, default: '', trim: true },
    referrer: { type: String, default: '', trim: true },

    // Cloudflare hands these over for free in request headers; useful for
    // spotting a proposal being forwarded around an organisation.
    country: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },

    // 0–100. The single most useful number here: reaching 100 means they read
    // as far as the pricing.
    scrollDepth: { type: Number, default: 0, min: 0, max: 100 },

    // Time on page, milliseconds. Capped on write — a tab left open overnight
    // is not a nine-hour read, and one such row would wreck every average.
    dwellMs: { type: Number, default: 0, min: 0 },

    // Which named sections came into view, in order. Lets the agent see
    // "they went straight to pricing and left" versus "they read the method".
    sectionsSeen: { type: [String], default: () => [] },

    isBot: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

proposalViewSchema.index({ proposal: 1, viewedAt: -1 });
proposalViewSchema.index({ proposal: 1, ipHash: 1 });

// A tab left open is not engagement. Anything past this is recorded as this.
const MAX_DWELL_MS = 30 * 60 * 1000; // 30 minutes

proposalViewSchema.pre('save', function (next) {
  if (this.dwellMs > MAX_DWELL_MS) this.dwellMs = MAX_DWELL_MS;
  next();
});

// ─── Statics ─────────────────────────────────────────────────────────────────

// Everything the proposal card on a client record needs, in one round trip.
proposalViewSchema.statics.summaryFor = async function (proposalId) {
  const rows = await this.find({ proposal: proposalId, isBot: false })
    .select('viewedAt ipHash scrollDepth dwellMs country city')
    .sort({ viewedAt: 1 })
    .lean();

  if (!rows.length) {
    return {
      total: 0,
      unique: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      maxScrollDepth: 0,
      totalDwellMs: 0,
      reachedPricing: false,
      locations: [],
    };
  }

  const uniqueReaders = new Set(rows.map((r) => r.ipHash).filter(Boolean));
  const maxScrollDepth = Math.max(...rows.map((r) => r.scrollDepth || 0));

  return {
    total: rows.length,
    unique: uniqueReaders.size || rows.length,
    firstViewedAt: rows[0].viewedAt,
    lastViewedAt: rows[rows.length - 1].viewedAt,
    maxScrollDepth,
    totalDwellMs: rows.reduce((sum, r) => sum + (r.dwellMs || 0), 0),
    // The one signal worth interrupting an agent's day for.
    reachedPricing: maxScrollDepth >= 85,
    locations: [
      ...new Set(rows.map((r) => [r.city, r.country].filter(Boolean).join(', ')).filter(Boolean)),
    ].slice(0, 5),
  };
};

module.exports = mongoose.model('ProposalView', proposalViewSchema);
