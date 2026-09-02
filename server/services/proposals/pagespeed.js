// services/proposals/pagespeed.js
//
// Real performance measurement via Google PageSpeed Insights.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS
// ─────────────────────────────────────────────────────────────────────────────
// The website template used to ask an agent to TYPE a PageSpeed score. Nothing
// measured it. A proposal would then tell a business owner "your site scores 24
// out of 100 on mobile" on the authority of a number somebody keyed in — and if
// that owner ran the test themselves and got 61, the entire document loses its
// credibility along with the one claim they checked.
//
// Google's API is the right source for exactly that reason: it is free, it is
// first-party, and the client can reproduce the result at
// pagespeed.web.dev in thirty seconds. A proposal claim the reader can verify
// is worth more than one they have to accept.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT RETURNS null RATHER THAN DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────
// Every failure path here returns null or omits the field. It never falls back
// to a zero, an average or a guess, because a zero renders as a score and a
// score is a claim. If Google could not measure the site, the proposal must say
// nothing about its speed — see the `measured` field source in the registry.
'use strict';

const axios = require('axios');

const ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// PSI genuinely takes this long on a slow site; it runs a full Lighthouse pass
// in Google's infrastructure. This is the bulk of the wait an agent sees, and
// it is the part of the wait that earns its keep.
const TIMEOUT_MS = 70000;

const CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'];

/** Lighthouse scores are 0–1 floats. Proposals show 0–100, as Google's own UI does. */
const toScore = (v) => (typeof v === 'number' ? Math.round(v * 100) : null);

/** Google's own banding, so our colour matches theirs when the client re-runs it. */
const band = (score) =>
  score === null ? null : score >= 90 ? 'good' : score >= 50 ? 'needs-work' : 'poor';

function metric(audits, key) {
  const a = audits?.[key];
  if (!a || typeof a.numericValue !== 'number') return null;
  return {
    ms: Math.round(a.numericValue),
    display: a.displayValue || null,
    score: toScore(a.score),
  };
}

/**
 * The fixes Lighthouse itself says would save the most time, in its own words.
 *
 * Taken verbatim rather than paraphrased: these become the evidence line under
 * a finding, and the whole point is that it is Google's assessment and not
 * ours. The generator is told to write the business consequence around them,
 * never to invent the finding itself.
 */
function opportunities(audits) {
  return Object.entries(audits || {})
    .filter(([, a]) => a?.details?.type === 'opportunity' && a.details.overallSavingsMs > 100)
    .map(([id, a]) => ({
      id,
      title: a.title,
      savingsMs: Math.round(a.details.overallSavingsMs),
      description: (a.description || '').replace(/\s*\[Learn.*$/i, '').trim(),
    }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 6);
}

/** Field data from real Chrome users, when Google has enough of it for this origin. */
function fieldData(loadingExperience) {
  const m = loadingExperience?.metrics;
  if (!m) return null;
  const pick = (key) =>
    m[key] ? { value: m[key].percentile, category: m[key].category } : null;

  return {
    overall: loadingExperience.overall_category || null,
    lcp: pick('LARGEST_CONTENTFUL_PAINT_MS'),
    inp: pick('INTERACTION_TO_NEXT_PAINT'),
    cls: pick('CUMULATIVE_LAYOUT_SHIFT_SCORE'),
    fcp: pick('FIRST_CONTENTFUL_PAINT_MS'),
  };
}

async function runStrategy(url, strategy) {
  const params = new URLSearchParams({ url, strategy });
  for (const c of CATEGORIES) params.append('category', c);
  // Optional. Without it the API still works but is rate limited per IP, which
  // is fine for a handful of proposals a day and not fine for a busy afternoon.
  if (process.env.PAGESPEED_API_KEY) params.append('key', process.env.PAGESPEED_API_KEY);

  const res = await axios.get(`${ENDPOINT}?${params}`, {
    timeout: TIMEOUT_MS,
    validateStatus: (s) => s < 500,
  });

  if (res.status >= 400) {
    const reason = res.data?.error?.message || `HTTP ${res.status}`;
    throw new Error(reason);
  }

  const lh = res.data?.lighthouseResult;
  if (!lh?.categories) throw new Error('PageSpeed returned no Lighthouse result');

  const scores = {};
  for (const c of CATEGORIES) scores[c] = toScore(lh.categories[c]?.score);

  return {
    strategy,
    scores,
    bands: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, band(v)])),
    vitals: {
      lcp: metric(lh.audits, 'largest-contentful-paint'),
      fcp: metric(lh.audits, 'first-contentful-paint'),
      cls: metric(lh.audits, 'cumulative-layout-shift'),
      tbt: metric(lh.audits, 'total-blocking-time'),
      si: metric(lh.audits, 'speed-index'),
    },
    opportunities: opportunities(lh.audits),
    fieldData: fieldData(res.data?.loadingExperience),
    finalUrl: lh.finalUrl || url,
    lighthouseVersion: lh.lighthouseVersion || null,
    fetchTime: lh.fetchTime || new Date().toISOString(),
  };
}

/**
 * Measures a site on mobile and desktop.
 *
 * @returns {Promise<object|null>} null when there is nothing to measure.
 *   The returned object always carries `ok`; when false, `error` explains it and
 *   NO scores are present — callers must render nothing rather than a zero.
 */
async function measureSite(url) {
  if (!url) return null;

  // Both strategies at once. Sequentially this is two full Lighthouse runs back
  // to back, which roughly doubles the wait for no benefit.
  const [mobile, desktop] = await Promise.allSettled([
    runStrategy(url, 'mobile'),
    runStrategy(url, 'desktop'),
  ]);

  const ok = (r) => (r.status === 'fulfilled' ? r.value : null);
  const mob = ok(mobile);
  const desk = ok(desktop);

  if (!mob && !desk) {
    return {
      ok: false,
      url,
      // Mobile's failure is the one worth reporting: it is the strategy the
      // proposal leads with, and both usually fail for the same reason.
      error: mobile.reason?.message || desktop.reason?.message || 'PageSpeed Insights could not measure this site',
      measuredAt: new Date().toISOString(),
    };
  }

  return {
    ok: true,
    url,
    mobile: mob,
    desktop: desk,
    // Rendered under the scores. A measurement without a source and a date is
    // an assertion, and this whole file exists to stop the proposal making
    // those.
    source: 'Google PageSpeed Insights',
    sourceUrl: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(url)}`,
    measuredAt: (mob || desk).fetchTime,
    // Named so a template can say "Lighthouse 11.x" if it wants to.
    engine: (mob || desk).lighthouseVersion,
  };
}

module.exports = { measureSite, band };
