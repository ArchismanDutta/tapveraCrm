// routes/proposalRoutes.js
//
// The super-admin API behind the Proposals page.
//
// Every route here is gated by superAdminOnly. The public side — the page a
// prospect actually loads, and the read-receipt beacon — lives in
// proposalPublicRoutes.js and is deliberately a separate file, so that nothing
// in here can be reached without a token by accident of route ordering.
'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const Proposal = require('../models/Proposal');
const ProposalView = require('../models/ProposalView');
const Project = require('../models/Project');
const KeywordRank = require('../models/KeywordRank');

const { protect } = require('../middlewares/authMiddleware');
const { superAdminOnly } = require('../middlewares/superAdminOnly');

const registry = require('../services/proposals/registry');
const { validate, validateForPublish } = require('../services/proposals/validate');
const { render } = require('../services/proposals/render');
const { computeFor } = require('../services/proposals/compute');

// An <iframe> cannot set an Authorization header, and the editor's live
// preview is an iframe. So for the two read-only preview routes — and ONLY
// those — a token may arrive as a query parameter and is promoted into the
// header before protect() runs.
//
// The narrowness is the safeguard: these routes return the same HTML the
// signed-in agent is already looking at, they mutate nothing, and the
// allow-list is a regex rather than a flag someone can set on a new route by
// accident. A token in a URL can land in browser history and referrer headers,
// which is exactly why this is not a general-purpose auth path.
const PREVIEW_ROUTES = /^\/(?:[a-f0-9]{24}\/preview|templates\/[a-z0-9-]+\/sample-preview)$/i;

router.use((req, _res, next) => {
  if (req.method === 'GET' && req.query.token && PREVIEW_ROUTES.test(req.path) && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
});

router.use(protect, superAdminOnly);

// ─── Slugs ───────────────────────────────────────────────────────────────────

/**
 * "EZ Shower Repair & Tiling" -> "ez-shower-repair-and-tiling-k3f9x2"
 *
 * The random tail is not decoration. Without it the URL is guessable from the
 * business name alone, and the page carries the price you quoted them — which
 * a competitor bidding on the same job would very much like to read.
 */
function buildSlug(businessName) {
  const base = String(businessName || 'proposal')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'proposal';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function uniqueSlug(businessName) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = buildSlug(businessName);
    if (!(await Proposal.exists({ slug }))) return slug;
  }
  // Six hex chars colliding five times in a row means something is wrong with
  // the RNG, not with this business name.
  throw new Error('Could not allocate a unique proposal URL.');
}

// ─── Templates ───────────────────────────────────────────────────────────────

// GET /api/proposals/templates — the picker
router.get('/templates', (req, res) => {
  try {
    res.json({ templates: registry.list() });
  } catch (err) {
    console.error('[proposals] template registry failed to load:', err.message);
    res.status(500).json({ message: `Template registry error: ${err.message}` });
  }
});

// GET /api/proposals/templates/:slug — the field schema the form renders from
router.get('/templates/:slug', (req, res) => {
  try {
    const t = registry.get(req.params.slug);
    res.json({
      slug: t.slug,
      name: t.name,
      version: t.version,
      serviceType: t.serviceType,
      description: t.description,
      accent: t.accent,
      sections: t.sections,
      liveData: t.liveData,
      fields: t.fields,
      sample: registry.sample(t.slug),
    });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

// ─── Prefill ─────────────────────────────────────────────────────────────────

// GET /api/proposals/prefill?projectId=...
//
// The CRM advantage: an agent should never retype what the system already
// holds. For an SEO proposal against a live project this fills the entire
// keyword table from real tracked positions.
router.get('/prefill', async (req, res) => {
  try {
    const { projectId, templateSlug } = req.query;
    if (!projectId) return res.json({ data: {} });

    const project = await Project.findById(projectId)
      .populate('client', 'clientName businessName email region')
      .populate('clients', 'clientName businessName email region');
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const client = project.client || (project.clients || [])[0] || null;
    const data = {};
    if (client) data.business_name = client.businessName || client.clientName;

    // Real rank history beats a guess. `current_rank` comes from the latest
    // recorded position; the target is left blank because that is a commercial
    // decision, not a fact the CRM holds.
    if (templateSlug === 'seo-local' || templateSlug === 'gbp-local') {
      const keywords = await KeywordRank.getProjectKeywords(project._id, true);
      const rows = keywords
        .filter((k) => (templateSlug === 'gbp-local' ? k.category === 'GMB' : k.category === 'SEO'))
        .map((k) => {
          const current = k.currentRank;
          return {
            keyword: k.keyword,
            current_rank: current ? current.rank : 101,
            target_rank: null,
            monthly_volume: null,
            difficulty: 'Medium',
            intent: 'Commercial',
          };
        });
      if (rows.length) data.target_keywords = rows;

      const cities = [...new Set(keywords.map((k) => k.city).filter(Boolean))];
      if (cities.length) data.city = cities[0];
      const countries = [...new Set(keywords.map((k) => k.country).filter((c) => c && c !== 'Global'))];
      if (countries.length) data.country = countries[0];
    }

    res.json({
      data,
      meta: {
        projectName: project.projectName,
        projectTypes: project.type,
        keywordsFound: (data.target_keywords || []).length,
      },
    });
  } catch (err) {
    console.error('[proposals] prefill error:', err.message);
    res.status(500).json({ message: 'Could not build prefill from this project.' });
  }
});

// ─── CRUD ────────────────────────────────────────────────────────────────────

// GET /api/proposals — the list page
router.get('/', async (req, res) => {
  try {
    const { status, templateSlug, q, limit = 50, page = 1 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (templateSlug) filter.templateSlug = templateSlug;
    if (q) filter.$or = [
      { businessName: new RegExp(String(q).trim(), 'i') },
      { title: new RegExp(String(q).trim(), 'i') },
    ];

    const perPage = Math.min(100, Number(limit) || 50);
    const [rows, total] = await Promise.all([
      Proposal.find(filter)
        .select('-data.agent_brief')
        .populate('createdBy', 'name email')
        .populate('client', 'businessName clientName')
        .sort({ createdAt: -1 })
        .skip((Math.max(1, Number(page)) - 1) * perPage)
        .limit(perPage)
        .lean({ virtuals: true }),
      Proposal.countDocuments(filter),
    ]);

    res.json({ proposals: rows, total, page: Number(page), limit: perPage });
  } catch (err) {
    console.error('[proposals] list error:', err.message);
    res.status(500).json({ message: 'Could not load proposals.' });
  }
});

// POST /api/proposals — create, always as a draft
router.post('/', async (req, res) => {
  try {
    const { templateSlug, businessName, title, data = {}, client, project, lead, expiresAt } = req.body;

    if (!registry.has(templateSlug)) {
      return res.status(400).json({ message: `Unknown template "${templateSlug}".` });
    }
    if (!businessName || !String(businessName).trim()) {
      return res.status(400).json({ message: 'A business name is required.' });
    }

    const template = registry.get(templateSlug);
    const { data: cleaned, errors } = validate(templateSlug, data, 'draft');
    if (errors.length) return res.status(400).json({ message: 'Some fields are invalid.', errors });

    const proposal = await Proposal.create({
      templateSlug,
      templateVersion: template.version,
      title: title || `${template.name} — ${businessName}`,
      businessName: String(businessName).trim(),
      slug: await uniqueSlug(businessName),
      client: client || null,
      project: project || null,
      lead: lead || null,
      data: cleaned,
      // Created by hand, so it starts as a draft rather than 'generating'.
      status: 'draft',
      generation: { state: 'ready', detail: 'Created manually' },
      expiresAt: expiresAt || cleaned.valid_until || null,
      createdBy: req.user._id,
    });

    res.status(201).json({ proposal });
  } catch (err) {
    console.error('[proposals] create error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/proposals/:id
router.get('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('client', 'businessName clientName email')
      .populate('project', 'projectName type');
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    res.json({
      proposal,
      computed: computeFor(proposal.templateSlug, proposal.data || {}),
      analytics: await ProposalView.summaryFor(proposal._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/proposals/:id — save the form
router.patch('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    if (req.body.data) {
      // Merge rather than replace: the form may post one section at a time.
      const merged = { ...(proposal.data || {}), ...req.body.data };
      const { data: cleaned, errors } = validate(proposal.templateSlug, merged, 'draft');
      if (errors.length) return res.status(400).json({ message: 'Some fields are invalid.', errors });
      proposal.data = cleaned;
      proposal.markModified('data');
      if (cleaned.valid_until) proposal.expiresAt = cleaned.valid_until;
    }

    for (const key of ['title', 'businessName', 'client', 'project', 'lead']) {
      if (req.body[key] !== undefined) proposal[key] = req.body[key];
    }

    await proposal.save();
    res.json({ proposal });
  } catch (err) {
    console.error('[proposals] update error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/proposals/:id/publish — the gate
router.post('/:id/publish', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    const { valid, errors } = validateForPublish(proposal.templateSlug, proposal.data || {});
    if (!valid) {
      return res.status(400).json({
        message: 'This proposal is not ready to publish.',
        errors,
      });
    }

    // Re-pin the version at publish time. From here the client-facing wording
    // is frozen against the template as it exists right now.
    proposal.templateVersion = registry.get(proposal.templateSlug).version;
    proposal.status = 'published';
    proposal.publishedAt = new Date();
    proposal.publishedBy = req.user._id;
    await proposal.save();

    const base = (process.env.PROPOSAL_PUBLIC_BASE || 'https://tapvera.io').replace(/\/$/, '');
    res.json({ proposal, url: `${base}/proposal/${proposal.slug}` });
  } catch (err) {
    console.error('[proposals] publish error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/proposals/:id/unpublish
router.post('/:id/unpublish', async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { status: 'draft', publishedAt: null },
      { new: true }
    );
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });
    res.json({ proposal });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/proposals/:id — archive, never destroy
//
// A sent proposal is a commercial record. Archiving takes it off the list and
// off the internet; a hard delete would also erase the read receipts that say
// what the client saw and when.
router.delete('/:id', async (req, res) => {
  try {
    const proposal = await Proposal.findByIdAndUpdate(
      req.params.id,
      { status: 'archived', publishedAt: null },
      { new: true }
    );
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });
    res.json({ proposal, message: 'Proposal archived.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── Generation ──────────────────────────────────────────────────────────────

// POST /api/proposals/:id/generate
//
// Returns 202 immediately and runs the pipeline in the background. The agent's
// UI polls GET /:id for generation.state, which is why every stage writes a
// human-readable `detail` rather than a status code.
router.post('/:id/generate', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    if (proposal.generation?.state === 'writing' || proposal.generation?.state === 'researching') {
      return res.status(409).json({ message: 'A draft is already being generated for this proposal.' });
    }

    // The brief is what separates a bespoke proposal from a mail merge, so it
    // is required here rather than silently generating something generic.
    if (!proposal.data?.agent_brief) {
      return res.status(400).json({
        message: 'Add a brief first — the generator writes from what you know about this client, and without it the copy will be generic.',
      });
    }

    const { startGeneration } = require('../services/proposals/generate');
    startGeneration(proposal._id);

    res.status(202).json({ message: 'Generating.', proposalId: proposal._id });
  } catch (err) {
    console.error('[proposals] generate error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ─── Preview ─────────────────────────────────────────────────────────────────

// GET /api/proposals/:id/preview — HTML for the editor's iframe
router.get('/:id/preview', async (req, res) => {
  try {
    const proposal = await Proposal.findById(req.params.id);
    if (!proposal) return res.status(404).send('Proposal not found.');
    const html = await render(proposal, { mode: 'preview' });
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) {
    console.error('[proposals] preview error:', err.message);
    res.status(500).send(`Preview failed: ${err.message}`);
  }
});

// GET /api/proposals/templates/:slug/sample-preview — a template with no client
router.get('/templates/:slug/sample-preview', async (req, res) => {
  try {
    const { renderSample } = require('../services/proposals/render');
    const html = await renderSample(req.params.slug);
    res.set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (err) {
    res.status(500).send(`Sample preview failed: ${err.message}`);
  }
});

// ─── Analytics ───────────────────────────────────────────────────────────────

router.get('/:id/analytics', async (req, res) => {
  try {
    const summary = await ProposalView.summaryFor(req.params.id);
    const recent = await ProposalView.find({ proposal: req.params.id, isBot: false })
      .select('viewedAt scrollDepth dwellMs country city sectionsSeen')
      .sort({ viewedAt: -1 })
      .limit(25)
      .lean();
    res.json({ summary, recent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
