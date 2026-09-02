// routes/proposalPublicRoutes.js
//
// The two unauthenticated endpoints: the proposal page itself, and the read
// receipt it posts back.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS A SEPARATE FILE
// ─────────────────────────────────────────────────────────────────────────────
// proposalRoutes.js applies `protect, superAdminOnly` at the router level. If
// the public page lived in that file it would need an exception carved out of
// that guard, and route-ordering mistakes around an exception like that are
// how an internal endpoint quietly becomes reachable without a token. Keeping
// them apart means the authenticated file has no exceptions in it at all.
'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const Proposal = require('../models/Proposal');
const ProposalView = require('../models/ProposalView');
const { render } = require('../services/proposals/render');

// ─── The page ────────────────────────────────────────────────────────────────

// GET /proposal/:slug
router.get('/proposal/:slug', async (req, res) => {
  try {
    const proposal = await Proposal.findBySlugForRender(req.params.slug);

    // A slug that never existed and one that was archived are the same answer
    // to the outside world. Distinguishing them would let anyone enumerate
    // which businesses you have quoted.
    if (!proposal || ['archived', 'generating'].includes(proposal.status)) {
      return res.status(404).type('html').send(notFoundPage());
    }

    // A draft has a URL but is not for the client's eyes yet — that is what
    // the preview endpoint is for. Publishing is the deliberate act that turns
    // this on.
    if (proposal.status === 'draft') {
      return res.status(404).type('html').send(notFoundPage());
    }

    const html = await render(proposal, { mode: 'web' });

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      // Short edge TTL: long enough that a proposal forwarded around an office
      // is served from Cloudflare, short enough that a correction published at
      // 9am is live before the 9:05 meeting. Read receipts come from the
      // beacon, so caching costs no analytics.
      'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      // Lets the CRM purge exactly this proposal on edit rather than the zone.
      'Cache-Tag': `proposal-${proposal.slug}`,
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    return res.send(html);
  } catch (err) {
    console.error('[proposal-public] render error:', err.message);
    return res.status(500).type('html').send(errorPage());
  }
});

// ─── The read receipt ────────────────────────────────────────────────────────

const BOT_PATTERN = /bot|crawler|spider|crawling|preview|facebookexternalhit|whatsapp|slackbot|telegram|discord|curl|wget|headless|lighthouse/i;

/**
 * Salted so the collection is useless to anyone who obtains it. The salt lives
 * in the environment, not the database — a dump of one without the other
 * answers no questions about where a prospect was sitting.
 */
function hashIp(ip) {
  const salt = process.env.PROPOSAL_VIEW_SALT || '';
  if (!salt || !ip) return '';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

// POST /api/proposal-views
router.post('/api/proposal-views', express.json({ limit: '8kb' }), async (req, res) => {
  // Always 204, whatever happens. This endpoint is called from a page a
  // prospect is reading; it must never surface an error in their console, and
  // a failed analytics write is not their problem.
  res.status(204).end();

  try {
    const { proposalId, sessionId, scrollDepth, dwellMs, sectionsSeen, referrer } = req.body || {};
    if (!proposalId || !sessionId) return;

    const proposal = await Proposal.findById(proposalId).select('_id status');
    if (!proposal || proposal.status !== 'published') return;

    const userAgent = String(req.get('user-agent') || '').slice(0, 400);
    const isBot = BOT_PATTERN.test(userAgent);

    // Cloudflare supplies these; behind any other proxy they are simply absent.
    const ip = req.get('cf-connecting-ip') || req.ip || '';
    const country = String(req.get('cf-ipcountry') || '').slice(0, 4);
    const city = String(req.get('cf-ipcity') || '').slice(0, 60);

    // One row per pageview. The load beacon creates it; the unload beacon
    // updates the same row with the numbers that only exist at the end, which
    // is why sessionId is the key rather than a fresh insert each time.
    const existing = await ProposalView.findOne({ proposal: proposalId, sessionId });

    if (existing) {
      existing.scrollDepth = Math.max(existing.scrollDepth, Number(scrollDepth) || 0);
      if (Number(dwellMs) > 0) existing.dwellMs = Math.max(existing.dwellMs, Number(dwellMs));
      if (Array.isArray(sectionsSeen) && sectionsSeen.length > existing.sectionsSeen.length) {
        existing.sectionsSeen = sectionsSeen.slice(0, 20).map(String);
      }
      await existing.save();
      return;
    }

    await ProposalView.create({
      proposal: proposalId,
      sessionId: String(sessionId).slice(0, 64),
      ipHash: hashIp(ip),
      userAgent,
      referrer: String(referrer || '').slice(0, 400),
      country,
      city,
      scrollDepth: Number(scrollDepth) || 0,
      dwellMs: Number(dwellMs) || 0,
      sectionsSeen: Array.isArray(sectionsSeen) ? sectionsSeen.slice(0, 20).map(String) : [],
      isBot,
    });

    // Denormalised counters, so the list page needs no aggregation. Bots are
    // recorded but never counted — a link preview fetch is not a read, and an
    // agent chasing a "they opened it!" that was WhatsApp's crawler is worse
    // than no signal at all.
    if (!isBot) {
      const now = new Date();

      // Two writes rather than one conditional update object.
      //
      // The first sets firstViewedAt only if it is still null — expressed as a
      // filter condition, so it is atomic and needs no read-then-write race.
      // The second always bumps the counters. An empty $setOnInsert (which the
      // conditional-spread version could produce) is rejected by MongoDB
      // outright, and $setOnInsert does nothing at all without upsert:true.
      await Proposal.updateOne(
        { _id: proposalId, firstViewedAt: null },
        { $set: { firstViewedAt: now } }
      );

      await Proposal.updateOne(
        { _id: proposalId },
        { $inc: { viewCount: 1 }, $set: { lastViewedAt: now } }
      );

      // Unique readers, recounted from the rows rather than incremented — a
      // second visit from the same reader must not move this number, and the
      // beacon cannot know on its own whether it has seen this hash before.
      if (hashIp(ip)) {
        const distinct = await ProposalView.distinct('ipHash', {
          proposal: proposalId,
          isBot: false,
          ipHash: { $ne: '' },
        });
        await Proposal.updateOne(
          { _id: proposalId },
          { $set: { uniqueViewCount: distinct.length } }
        );
      }
    }
  } catch (err) {
    console.error('[proposal-views] beacon error:', err.message);
  }
});

// ─── Minimal static pages ────────────────────────────────────────────────────

function shell(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FBFBF9;color:#39424C;
font:16px/1.6 ui-serif,Georgia,serif;padding:24px}main{max-width:440px;text-align:center}
h1{font:600 26px/1.2 ui-sans-serif,system-ui,sans-serif;color:#15191E;margin:0 0 12px}
p{margin:0;color:#69747F}</style></head><body><main>${body}</main></body></html>`;
}

const notFoundPage = () =>
  shell('Proposal not found', `<h1>This proposal isn't available</h1>
<p>The link may have expired or been withdrawn. If you were expecting a proposal, reply to the email it came from and we'll send a current one.</p>`);

const errorPage = () =>
  shell('Something went wrong', `<h1>Something went wrong</h1>
<p>We couldn't load this proposal just now. Please try again in a moment.</p>`);

module.exports = router;
