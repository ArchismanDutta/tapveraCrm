// services/proposals/audit.js
//
// Fetches a prospect's website and extracts the handful of facts the generator
// is allowed to write about.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS AT ALL
// ─────────────────────────────────────────────────────────────────────────────
// The reason the EZ Shower proposal reads as bespoke is that its diagnosis
// section names real things: conflicting service areas, a missing street
// address, four broken footer links. Those are observations, not adjectives.
//
// A language model with no observations produces the other kind of proposal —
// the one that says "your online presence has room to grow" and could have been
// sent to anybody. So the model never gets to invent a finding: it gets this
// object, and its brief says to write only about what is in it.
//
// Deliberately regex over a DOM parser. Everything below is a presence check on
// raw markup — is there a street address, do the phone numbers agree, how heavy
// is the page — and none of it needs a tree. Adding cheerio to the server for
// four regexes is a dependency somebody maintains forever.
'use strict';

const axios = require('axios');

const TIMEOUT_MS = 12000;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB of HTML is already pathological

const AU_STATES = 'NSW|VIC|QLD|SA|WA|TAS|NT|ACT';

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const all = (html, re) => [...html.matchAll(re)].map((m) => (m[1] || '').trim()).filter(Boolean);

/**
 * @returns {Promise<object|null>} facts, or null when there is no site to read.
 *   Never throws: a prospect with a dead site is a normal case, and the
 *   proposal should still generate — just without a technical diagnosis.
 */
async function auditSite(url) {
  if (!url) return null;

  let res;
  try {
    res = await axios.get(url, {
      timeout: TIMEOUT_MS,
      maxRedirects: 4,
      maxContentLength: MAX_BYTES,
      responseType: 'text',
      // Some hosts serve a stripped page to unknown agents, which would make
      // every audit report "no content found".
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TapveraAudit/1.0; +https://tapvera.io)',
        Accept: 'text/html,application/xhtml+xml',
      },
      validateStatus: (s) => s < 500,
    });
  } catch (err) {
    return {
      url,
      reachable: false,
      // Surfaced to the agent and to the model. "Site did not respond" is
      // itself a finding worth putting in a proposal.
      error: err.code === 'ECONNABORTED' ? 'Site did not respond within 12 seconds' : `Could not reach the site (${err.code || err.message})`,
    };
  }

  const html = String(res.data || '');
  const text = strip(html);

  // A 4xx, or a body too small to be a real page, is NOT a successful audit.
  //
  // validateStatus lets 4xx through so the status code can be reported rather
  // than thrown away — but if the response is an error page or a proxy block,
  // every presence check below returns false, and the generator would then
  // write "no structured data, no viewport, no analytics" about a page nobody
  // ever saw. That is the exact fabrication this whole file exists to prevent,
  // and it would be indistinguishable from a genuine finding.
  //
  // 600 bytes: a real page with a doctype, head and any content clears it
  // easily; an nginx 403 body or a proxy refusal does not.
  if (res.status >= 400 || html.length < 600) {
    return {
      url,
      reachable: false,
      statusCode: res.status,
      error:
        res.status >= 400
          ? `Site returned HTTP ${res.status}`
          : 'Site returned a page too small to analyse (possibly a redirect stub or a block page)',
    };
  }

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || '';
  const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
  const generator = (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';

  const h1s = all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(strip);
  const h2s = all(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(strip).slice(0, 25);

  const links = all(html, /<a[^>]+href=["']([^"']+)["']/gi);
  const images = all(html, /<img[^>]+src=["']([^"']+)["']/gi);

  // Phone numbers, normalised so "0407 123 456" and "0407123456" compare equal.
  const phones = [
    ...new Set(
      (text.match(/(?:\+?61[\s-]?)?(?:\(0\d\)|0\d)[\s-]?\d{3,4}[\s-]?\d{3,4}/g) || [])
        .map((p) => p.replace(/[^\d+]/g, ''))
        .filter((p) => p.length >= 8)
    ),
  ].slice(0, 6);

  const emails = [...new Set(text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [])].slice(0, 6);

  // A street address is the single most common cause of a service-area GBP
  // suspension, so its presence or absence is checked explicitly.
  const hasStreetAddress = new RegExp(
    `\\b\\d+[a-z]?[\\s,/-]+[A-Z][a-zA-Z]+(?:\\s[A-Z][a-zA-Z]+)*\\s+(?:St|Street|Rd|Road|Ave|Avenue|Dr|Drive|Ln|Lane|Ct|Court|Pde|Parade|Hwy|Highway|Blvd|Cres|Crescent|Way|Pl|Place)\\b`,
    'i'
  ).test(text);

  const hasPostcode = new RegExp(`\\b(?:${AU_STATES})\\s+\\d{4}\\b`, 'i').test(text);

  return {
    url,
    reachable: true,
    statusCode: res.status,
    title,
    description,
    generator,
    // "WordPress" vs "custom" changes what a rebuild proposal can promise.
    platform:
      /wp-content|wp-includes/i.test(html) ? 'WordPress'
      : /cdn\.shopify\.com/i.test(html) ? 'Shopify'
      : /wix\.com|wixstatic/i.test(html) ? 'Wix'
      : /squarespace/i.test(html) ? 'Squarespace'
      : /_next\/static/i.test(html) ? 'Next.js'
      : generator || 'Unknown',

    h1Count: h1s.length,
    h1s: h1s.slice(0, 5),
    h2s,
    wordCount: text.split(/\s+/).length,

    htmlBytes: html.length,
    imageCount: images.length,
    linkCount: links.length,
    // Empty and placeholder hrefs — the cheap version of a broken-link check.
    deadLinks: links.filter((h) => h === '#' || h === '' || /^javascript:void/i.test(h)).length,

    isHttps: url.startsWith('https://'),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasSchemaOrg: /application\/ld\+json/i.test(html),
    hasLocalBusinessSchema: /"@type"\s*:\s*"(LocalBusiness|[A-Za-z]*Business|ProfessionalService)"/i.test(html),
    hasOpenGraph: /property=["']og:/i.test(html),
    hasCanonical: /rel=["']canonical["']/i.test(html),
    hasAnalytics: /gtag\(|googletagmanager|analytics\.js|G-[A-Z0-9]{8,}/i.test(html),

    phones,
    phoneNumbersDisagree: phones.length > 1,
    emails,
    hasStreetAddress,
    hasPostcode,

    // Named so the model can quote them as observed service areas.
    mentionedSuburbs: [
      ...new Set(text.match(new RegExp(`\\b[A-Z][a-zA-Z]+(?:\\s[A-Z][a-zA-Z]+)?\\s+(?:${AU_STATES})\\b`, 'g')) || []),
    ].slice(0, 12),

    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { auditSite };
