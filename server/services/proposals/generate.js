// services/proposals/generate.js
//
// Drafts the prose in a proposal with Gemini, and nothing else.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE GUARDRAIL IS THE SCHEMA, NOT THE PROMPT
// ─────────────────────────────────────────────────────────────────────────────
// Two independent mechanisms stop the model writing a price:
//
//   1. buildResponseSchema() is constructed from `source === 'ai'` fields only.
//      A price field is not in the schema handed to Gemini, so there is no key
//      for it to fill.
//   2. applyGenerated() copies back ONLY those same keys. Even if a future
//      model returned `pricing_tiers` unprompted, it would be dropped here.
//
// Prompt wording is the third layer and the weakest one. It is the layer that
// fails when a model is having an unusual day, which is why the other two exist
// and why neither of them consults the prompt.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT LANDS AS A DRAFT
// ─────────────────────────────────────────────────────────────────────────────
// The output of this file makes claims about a stranger's business and sits one
// click from a URL that stranger can read. A human approves it before anyone
// outside the company can load it. There is no configuration flag to skip that.
'use strict';

const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
const Proposal = require('../../models/Proposal');
const registry = require('./registry');
const { validate } = require('./validate');
const { auditSite } = require('./audit');
const { measureSite } = require('./pagespeed');

// Matches services/callAnalysisService.js — one model to reason about, one
// quota to watch, one thing to change when Google moves the version on.
const MODEL_NAME = process.env.PROPOSAL_AI_MODEL || 'gemini-1.5-flash';

/* ── Manifest field kinds -> Gemini response schema ──────────────────────── */

function fieldToSchema(field) {
  switch (field.kind) {
    case 'number':
    case 'percent':
    case 'money':
      return { type: SchemaType.NUMBER, description: field.aiHint || field.label };

    case 'select':
      return { type: SchemaType.STRING, format: 'enum', enum: field.options, description: field.aiHint || field.label };

    case 'toggle':
      return { type: SchemaType.BOOLEAN, description: field.aiHint || field.label };

    case 'list':
      return {
        type: SchemaType.ARRAY,
        description: field.aiHint || field.label,
        items: { type: SchemaType.STRING },
      };

    case 'repeat':
    case 'keywords':
    case 'locations': {
      const properties = {};
      const required = [];
      for (const sub of field.fields || []) {
        properties[sub.key] = fieldToSchema(sub);
        if (sub.required) required.push(sub.key);
      }
      return {
        type: SchemaType.ARRAY,
        description: field.aiHint || field.label,
        items: { type: SchemaType.OBJECT, properties, required },
      };
    }

    default:
      return { type: SchemaType.STRING, description: field.aiHint || field.label };
  }
}

/** Only the fields the manifest marks `ai`. This is guardrail #1. */
function buildResponseSchema(templateSlug) {
  const aiFields = registry.aiFields(templateSlug);
  const properties = {};
  for (const f of aiFields) properties[f.key] = fieldToSchema(f);
  return {
    schema: { type: SchemaType.OBJECT, properties, required: aiFields.map((f) => f.key) },
    keys: aiFields.map((f) => f.key),
  };
}

/* ── Prompt ──────────────────────────────────────────────────────────────── */

function buildPrompt({ template, data, audit, measured, project }) {
  const facts = [];

  facts.push(`Business: ${data.business_name || 'Unknown'}`);
  if (data.industry) facts.push(`Trade / industry: ${data.industry}`);
  if (data.city) facts.push(`Location: ${[data.city, data.state, data.country].filter(Boolean).join(', ')}`);
  if (data.website_url) facts.push(`Website: ${data.website_url}`);

  if (audit) {
    facts.push('');
    if (!audit.reachable) {
      facts.push(`WEBSITE AUDIT: could not be completed — ${audit.error}.`);
      facts.push('You therefore know NOTHING about their website. Do not describe it, and do not list technical findings about it.');
    } else {
      facts.push('WEBSITE AUDIT (observed facts — these are the only site findings you may write about):');
      facts.push(`  Platform: ${audit.platform}`);
      facts.push(`  Page title: ${audit.title || '(none)'}`);
      facts.push(`  Meta description: ${audit.description || '(none)'}`);
      facts.push(`  H1 tags: ${audit.h1Count}${audit.h1s.length ? ` — "${audit.h1s.join('", "')}"` : ''}`);
      facts.push(`  Words of copy on the homepage: ${audit.wordCount}`);
      facts.push(`  HTML weight: ${Math.round(audit.htmlBytes / 1024)} KB, ${audit.imageCount} images`);
      facts.push(`  Mobile viewport tag: ${audit.hasViewport ? 'present' : 'MISSING'}`);
      facts.push(`  HTTPS: ${audit.isHttps ? 'yes' : 'NO'}`);
      facts.push(`  Structured data: ${audit.hasSchemaOrg ? 'present' : 'MISSING'}${audit.hasLocalBusinessSchema ? ' (LocalBusiness found)' : ''}`);
      facts.push(`  Open Graph tags: ${audit.hasOpenGraph ? 'present' : 'MISSING'}`);
      facts.push(`  Canonical tag: ${audit.hasCanonical ? 'present' : 'MISSING'}`);
      facts.push(`  Analytics: ${audit.hasAnalytics ? 'present' : 'MISSING'}`);
      facts.push(`  Street address on the page: ${audit.hasStreetAddress ? 'found' : 'NOT FOUND'}`);
      facts.push(`  State/postcode on the page: ${audit.hasPostcode ? 'found' : 'NOT FOUND'}`);
      facts.push(`  Phone numbers found: ${audit.phones.length ? audit.phones.join(', ') : 'none'}${audit.phoneNumbersDisagree ? '  <-- MORE THAN ONE, THEY DISAGREE' : ''}`);
      facts.push(`  Empty or placeholder links: ${audit.deadLinks}`);
      if (audit.mentionedSuburbs.length) facts.push(`  Service areas named on the site: ${audit.mentionedSuburbs.join(', ')}`);
    }
  }

  if (measured) {
    facts.push('');
    if (measured.ok !== true) {
      facts.push(`PERFORMANCE MEASUREMENT: failed — ${measured.error}.`);
      facts.push('You therefore have NO speed data. Do not state or imply how fast or slow their site is.');
    } else {
      const m = measured.mobile;
      const dsk = measured.desktop;
      facts.push(`PERFORMANCE (measured by Google PageSpeed Insights, ${new Date(measured.measuredAt).toDateString()}):`);
      if (m) {
        facts.push(`  Mobile  — performance ${m.scores.performance}/100, SEO ${m.scores.seo}/100, accessibility ${m.scores.accessibility}/100, best practices ${m.scores['best-practices']}/100`);
        if (m.vitals?.lcp) facts.push(`  Mobile Largest Contentful Paint: ${m.vitals.lcp.display || m.vitals.lcp.ms + 'ms'}`);
        if (m.vitals?.cls) facts.push(`  Mobile Cumulative Layout Shift: ${m.vitals.cls.display || m.vitals.cls.ms}`);
        if (m.vitals?.tbt) facts.push(`  Mobile Total Blocking Time: ${m.vitals.tbt.display || m.vitals.tbt.ms + 'ms'}`);
        if (m.opportunities?.length) {
          facts.push('  Google\'s own top fixes, with the time each would save:');
          m.opportunities.forEach((o) => facts.push(`    - ${o.title} (saves ~${(o.savingsMs / 1000).toFixed(1)}s)`));
        }
        if (m.fieldData?.overall) {
          facts.push(`  Real Chrome user data for this origin: ${m.fieldData.overall}`);
        }
      }
      if (dsk) facts.push(`  Desktop — performance ${dsk.scores.performance}/100`);
      facts.push('  These are real readings. Quote them exactly; never round them into a different number.');
    }
  }

  // Everything the agent already typed. The model must write copy that agrees
  // with these numbers rather than inventing its own version of them.
  const typed = Object.entries(data)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .filter(([k]) => !registry.aiFields(template.slug).some((f) => f.key === k))
    .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);

  return `You are writing the copy for a client proposal from ${data.prepared_by || 'a digital marketing agency'}.

${registry.prompt(template.slug) || ''}

## The client

${facts.join('\n')}

## What the agent has already entered

These values are FIXED. Your copy must agree with them and must never restate
them differently. Prices, guarantees, keyword targets and contact details are
not yours to write.

${typed.join('\n') || '  (nothing yet)'}

## The agent's brief

${data.agent_brief || '(none supplied)'}

## Tone

${data.tone || 'Direct and consultative'}

## Rules

1. Write ONLY about facts given above. If the audit could not be completed, do
   not describe their website at all — write about their market position from
   the agent's brief instead.
2. Never invent a statistic, a competitor, a review count, or a date. If you do
   not have a number, write a sentence that does not need one.
3. No marketing filler. Banned: "unlock", "leverage", "elevate", "in today's
   digital landscape", "take it to the next level", "journey", "solutions".
4. Australian English. Write to the business owner, not about them.
5. Respect every length limit in the field descriptions. They are layout
   constraints, not suggestions.
6. Where a field asks for evidence, quote the specific observed thing. "Your
   site has no street address anywhere, including the contact page" — not
   "there are NAP consistency issues".`;
}

/* ── The job ─────────────────────────────────────────────────────────────── */

async function setState(proposalId, state, detail) {
  await Proposal.updateOne(
    { _id: proposalId },
    { $set: { 'generation.state': state, 'generation.detail': detail || '' } }
  );
}

/**
 * Runs the pipeline and writes the result back. Never throws to its caller —
 * failures land on the proposal as `generation.state = 'failed'` with a message
 * an agent can read, because the caller has already returned 202 and gone.
 */
async function runGeneration(proposalId) {
  const started = Date.now();
  try {
    const proposal = await Proposal.findById(proposalId).populate('project', 'projectName type');
    if (!proposal) return;

    const template = registry.get(proposal.templateSlug);
    const data = proposal.data || {};

    await Proposal.updateOne(
      { _id: proposalId },
      { $set: { status: 'generating', 'generation.startedAt': new Date(), 'generation.model': MODEL_NAME, 'generation.error': '' }, $inc: { 'generation.attempts': 1 } }
    );

    // ── Stage: research ──
    //
    // Two different kinds of fact, deliberately kept apart:
    //
    //   audit        what the markup says — is there a street address, do the
    //                phone numbers agree, is there LocalBusiness schema. Cheap,
    //                and observable by reading the HTML.
    //   measurement  what Google measures — the Lighthouse scores and Core Web
    //                Vitals. Slow (this is most of the wait) and NOT derivable
    //                from the markup at all, which is precisely why it used to
    //                be a number an agent typed.
    //
    // Both run at once. The audit takes seconds and PageSpeed can take a
    // minute; running them in sequence would add the fast one to the slow one
    // for no reason.
    await setState(
      proposalId,
      'researching',
      data.website_url ? `Reading ${data.website_url} and measuring it with PageSpeed Insights` : 'Gathering what we know'
    );

    let audit = null;
    let measured = null;
    if (data.website_url) {
      const [auditRes, psiRes] = await Promise.allSettled([
        auditSite(data.website_url),
        // Only templates that actually show performance pay the minute.
        template.measures?.includes('pagespeed') ? measureSite(data.website_url) : Promise.resolve(null),
      ]);
      audit = auditRes.status === 'fulfilled' ? auditRes.value : null;
      measured = psiRes.status === 'fulfilled' ? psiRes.value : null;
    }

    if (audit || measured) {
      await Proposal.updateOne(
        { _id: proposalId },
        { $set: { 'generation.auditFindings': audit, measurements: measured } }
      );
    }

    // ── Stage: write ──
    await setState(proposalId, 'writing', `Drafting ${registry.aiFields(template.slug).length} sections`);

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set on the server, so copy cannot be generated. Fill the fields by hand, or add the key.');
    }

    const { schema, keys } = buildResponseSchema(template.slug);
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        // Structured output, so there are no markdown fences to strip and no
        // "here is your JSON:" preamble to parse around.
        responseMimeType: 'application/json',
        responseSchema: schema,
        // Low but not zero. Proposal copy that reads identically for every
        // client is the failure mode this feature exists to avoid; copy that
        // wanders off the supplied facts is worse.
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    });

    const result = await model.generateContent(buildPrompt({ template, data, audit, measured, project: proposal.project }));
    const raw = result.response.text();

    let generated;
    try {
      generated = JSON.parse(raw);
    } catch {
      throw new Error('The model returned something that was not valid JSON. Try generating again.');
    }

    // ── Stage: validate ──
    await setState(proposalId, 'validating', 'Checking the draft fits the template');

    // Guardrail #2: only `ai` keys are copied back, whatever the model returned.
    const aiOnly = {};
    for (const key of keys) {
      if (generated[key] !== undefined) aiOnly[key] = generated[key];
    }

    const merged = { ...data, ...aiOnly };
    const { data: cleaned, errors } = validate(template.slug, merged, 'draft');
    if (errors.length) {
      throw new Error(`The draft did not fit the template: ${errors.slice(0, 3).join('; ')}`);
    }

    // ── Stage: ready ──
    await Proposal.updateOne(
      { _id: proposalId },
      {
        $set: {
          data: cleaned,
          // Draft, never published. See the note at the top of this file.
          status: 'draft',
          'generation.state': 'ready',
          'generation.detail': `Drafted ${Object.keys(aiOnly).length} sections in ${Math.round((Date.now() - started) / 1000)}s`,
          'generation.finishedAt': new Date(),
          'generation.error': '',
        },
      }
    );
  } catch (err) {
    console.error(`[proposals] generation failed for ${proposalId}:`, err.message);
    await Proposal.updateOne(
      { _id: proposalId },
      {
        $set: {
          // Back to draft, not stuck in 'generating'. Whatever the agent had
          // typed is still there and still editable by hand — a failed
          // generation must never cost them their work.
          status: 'draft',
          'generation.state': 'failed',
          'generation.detail': '',
          'generation.finishedAt': new Date(),
          // Surfaced verbatim to the agent, so it must stay free of stack
          // traces and keys.
          'generation.error': String(err.message || 'Generation failed').slice(0, 400),
        },
      }
    );
  }
}

/** Fire and forget — the route returns immediately and the UI polls. */
function startGeneration(proposalId) {
  setImmediate(() => runGeneration(proposalId));
}

module.exports = { startGeneration, runGeneration, buildResponseSchema, buildPrompt, MODEL_NAME };
