// services/proposals/compute.js
//
// Derives the `computed` fields — the ones no human and no model may write.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY PROJECTIONS ARE COMPUTED RATHER THAN TYPED OR GENERATED
// ─────────────────────────────────────────────────────────────────────────────
// A projection is arithmetic on numbers a human already committed to: these
// keywords, from these positions, to these targets, over this many months. If
// an agent could type the curve directly, the chart could disagree with the
// table beneath it. If a model could write it, the chart would be a language
// model's opinion of a business outcome, printed next to a price.
//
// Computing it means the picture is always exactly what the inputs say — and
// that changing a target in the form visibly moves the line, which is the
// honest behaviour.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE SHAPE OF THE CURVE
// ─────────────────────────────────────────────────────────────────────────────
// A straight line from today to target is a lie in both directions: nothing
// moves in week one, and the last few positions are the hardest won. So each
// keyword's path is shaped by its difficulty:
//
//   Low     gains arrive early, then flatten          t^0.6
//   Medium  slow start, rapid middle, plateau         smoothstep
//   High    little for months, then late movement     t^1.7
//
// Rank numbers run backwards (1 is best), so every chart built from this must
// invert its y-axis — improving means the line goes UP the page while the
// number goes DOWN. Renderers are handed `plot` values for exactly that.
'use strict';

// Both the legacy manual "0" and the tracker's "101" mean the same thing.
const NOT_RANKED = 101;
const isNotRanked = (rank) => !Number.isFinite(rank) || rank === 0 || rank >= NOT_RANKED;
const normaliseRank = (rank) => (isNotRanked(rank) ? NOT_RANKED : Math.max(1, Math.round(rank)));

const CURVES = {
  Low: (t) => Math.pow(t, 0.6),
  Medium: (t) => t * t * (3 - 2 * t), // smoothstep
  High: (t) => Math.pow(t, 1.7),
};

const round1 = (n) => Math.round(n * 10) / 10;

// ─── SEO: rank trajectory ────────────────────────────────────────────────────

/**
 * Walks every tracked keyword from its current position to its target across
 * the engagement, and reduces each month to the four numbers the chart and the
 * summary tiles need.
 */
function rankProjection(data) {
  const keywords = Array.isArray(data.target_keywords) ? data.target_keywords : [];
  const months = Math.max(1, Math.min(24, Number(data.engagement_months) || 6));
  if (!keywords.length) return { series: [], keywordPaths: [], summary: null };

  const paths = keywords.map((k) => {
    const from = normaliseRank(k.current_rank);
    const to = Math.max(1, Math.min(100, Number(k.target_rank) || 10));
    const curve = CURVES[k.difficulty] || CURVES.Medium;
    return { keyword: k.keyword, from, to, curve, volume: Number(k.monthly_volume) || 0 };
  });

  const series = [];
  for (let month = 0; month <= months; month += 1) {
    const t = month / months;
    const ranks = paths.map((p) => {
      const progressed = p.from + (p.to - p.from) * p.curve(t);
      // Never round below 1 — there is no position zero.
      return Math.max(1, Math.round(progressed));
    });

    // Averaged across EVERY keyword, counting an unranked one as 101 — not
    // across "the ones currently ranking".
    //
    // Averaging only ranked keywords looks more flattering at month zero and
    // then betrays itself: the moment a keyword climbs from unranked to
    // position 90 it joins the average and drags it DOWN the page, so the
    // chart shows the campaign getting worse in month one, at exactly the
    // point the work started paying off. Counting the whole set every month
    // means the line can only move one way, and the number under it is the
    // same population the client is being quoted for.
    series.push({
      month,
      avg_rank: round1(ranks.reduce((a, b) => a + b, 0) / ranks.length),
      in_top_3: ranks.filter((r) => r <= 3).length,
      in_top_10: ranks.filter((r) => r <= 10).length,
      in_top_20: ranks.filter((r) => r <= 20).length,
      not_ranked: ranks.filter((r) => r >= NOT_RANKED).length,
    });
  }

  // Per-keyword start and end, for the movement table under the chart.
  const keywordPaths = paths.map((p) => ({
    keyword: p.keyword,
    from: p.from,
    to: p.to,
    volume: p.volume,
    positionsGained: p.from >= NOT_RANKED ? null : p.from - p.to,
    entersRankings: p.from >= NOT_RANKED,
  }));

  const first = series[0];
  const last = series[series.length - 1];

  return {
    series,
    keywordPaths,
    summary: {
      months,
      totalKeywords: keywords.length,
      currentAvgRank: first.avg_rank,
      projectedAvgRank: last.avg_rank,
      currentTop10: first.in_top_10,
      projectedTop10: last.in_top_10,
      currentTop3: first.in_top_3,
      projectedTop3: last.in_top_3,
      newlyRanking: first.not_ranked - last.not_ranked,
      totalVolume: paths.reduce((sum, p) => sum + p.volume, 0),
    },
  };
}

// ─── SMO: follower trajectory ────────────────────────────────────────────────

/**
 * Compound growth per managed platform. Compounding rather than linear because
 * social growth is proportional to reach, and a straight line badly
 * under-states month six on a channel that is already working.
 */
function followerProjection(data) {
  const platforms = (Array.isArray(data.platforms) ? data.platforms : []).filter((p) => p.managed !== false);
  const months = Math.max(1, Math.min(24, Number(data.engagement_months) || 6));
  const targetGrowth = Math.max(0, Number(data.growth_target_pct) || 0) / 100;
  if (!platforms.length) return { series: [], byPlatform: [], summary: null };

  // Per-month multiplier that lands exactly on the target at the final month.
  const monthlyRate = Math.pow(1 + targetGrowth, 1 / months);

  const series = [];
  for (let month = 0; month <= months; month += 1) {
    const row = { month, total: 0 };
    for (const p of platforms) {
      const start = Math.max(0, Number(p.followers) || 0);
      const value = Math.round(start * Math.pow(monthlyRate, month));
      row[p.name] = value;
      row.total += value;
    }
    series.push(row);
  }

  const startTotal = series[0].total;
  const endTotal = series[series.length - 1].total;

  return {
    series,
    byPlatform: platforms.map((p) => {
      const start = Math.max(0, Number(p.followers) || 0);
      return {
        platform: p.name,
        handle: p.handle || '',
        from: start,
        to: Math.round(start * Math.pow(monthlyRate, months)),
        engagement: Number(p.engagement) || null,
      };
    }),
    summary: {
      months,
      startTotal,
      endTotal,
      gained: endTotal - startTotal,
      growthPct: startTotal ? Math.round(((endTotal - startTotal) / startTotal) * 100) : 0,
    },
  };
}

// ─── GBP: cost of being down ─────────────────────────────────────────────────

/**
 * Mirrors the arithmetic the on-page calculator does in the browser, so the
 * server-rendered figure and the interactive one can never disagree — and so
 * the PDF export, which has no JavaScript, still shows a number.
 */
function suspensionCost(data) {
  const perWeek = Math.max(0, Number(data.enquiries_per_week) || 0);
  const conversion = Math.max(0, Math.min(100, Number(data.conversion_rate) || 0)) / 100;
  const jobValue = Math.max(0, Number(data.avg_job_value) || 0);
  const weeks = Math.max(0, Number(data.weeks_down) || 0);

  const weeklyLoss = perWeek * conversion * jobValue;
  return {
    weeklyLoss: Math.round(weeklyLoss),
    jobsLostPerWeek: round1(perWeek * conversion),
    weeksDown: weeks,
    totalLoss: Math.round(weeklyLoss * weeks),
    monthlyLoss: Math.round(weeklyLoss * 4.33),
  };
}

// ─── Website: before / after scores ──────────────────────────────────────────

/**
 * The before/after performance picture.
 *
 * `now` comes exclusively from a real PageSpeed Insights reading. It used to be
 * read off `data.pagespeed_mobile`, which an agent typed — meaning the proposal
 * asserted a score to a client who could disprove it at pagespeed.web.dev in
 * thirty seconds. There is no fallback to a typed value here on purpose: no
 * reading, no section.
 *
 * `after` is the target, which IS an agent field, because a goal is a
 * commitment the company makes rather than an observation about the client.
 */
function performanceGap(data, measured) {
  if (!measured || measured.ok !== true) return null;

  const target = Number(data.target_pagespeed) || 90;
  const side = (run) => {
    const now = run?.scores?.performance;
    if (typeof now !== 'number') return null;
    return {
      now,
      after: target,
      gain: target - now,
      band: run.bands?.performance || null,
      vitals: run.vitals || null,
      opportunities: run.opportunities || [],
    };
  };

  const mobile = side(measured.mobile);
  const desktop = side(measured.desktop);
  if (!mobile && !desktop) return null;

  return {
    target,
    mobile,
    desktop,
    // Other Lighthouse categories, mobile first — these are readings too and
    // are worth showing beside performance rather than being thrown away.
    categories: measured.mobile?.scores || measured.desktop?.scores || null,
    fieldData: measured.mobile?.fieldData || null,
    source: measured.source,
    sourceUrl: measured.sourceUrl,
    measuredAt: measured.measuredAt,
  };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Everything a template needs that is derived rather than stored. Attached to
 * the render context as `computed`, never written back to the proposal — so a
 * change to this maths applies to every proposal the next time it is rendered,
 * including ones already published.
 */
function computeFor(templateSlug, data = {}, measured = null) {
  switch (templateSlug) {
    case 'seo-local':
      return { rank: rankProjection(data) };
    case 'smo-social':
      return { followers: followerProjection(data) };
    case 'gbp-local':
      return { cost: suspensionCost(data) };
    case 'web-design':
      return { performance: performanceGap(data, measured) };
    default:
      return {};
  }
}

module.exports = {
  computeFor,
  rankProjection,
  followerProjection,
  suspensionCost,
  performanceGap,
  NOT_RANKED,
  normaliseRank,
};
