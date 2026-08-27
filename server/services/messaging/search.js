// services/messaging/search.js
//
// The bits of message search that must behave identically for both scopes:
// turning a user's typed string into a safe query, and cutting a readable
// snippet out of a match.
//
// Kept out of the adapters so chat and project search can't drift on the two
// things most likely to hurt if they do — what counts as a valid query, and
// how a result reads in the list.
'use strict';

/** Below this, a search matches most of the database and is not a search. */
const MIN_QUERY_LENGTH = 2;

/** Above this it is not a query, it is a payload. */
const MAX_QUERY_LENGTH = 200;

/** Characters either side of the match in a result snippet. */
const SNIPPET_RADIUS = 60;

/**
 * Make a user's typed string safe to put inside a RegExp.
 *
 * ─── THIS IS NOT OPTIONAL ───
 * The project adapter's existing `getMessages` does
 * `filter.message = { $regex: search }` with the raw input. A user searching
 * for `(` gets a 500 from an unterminated group; a user searching for
 * `(a+)+$` hands the server a catastrophically backtracking pattern to run
 * against every message in the thread. Neither needs malice — the first is
 * someone searching for a bracket.
 */
function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate and normalize a query string.
 *
 * @returns {{ ok: true, query: string, pattern: RegExp } | { ok: false, reason: string }}
 */
function parseQuery(raw) {
  const query = String(raw ?? '').trim();

  if (query.length < MIN_QUERY_LENGTH) {
    return { ok: false, reason: `Enter at least ${MIN_QUERY_LENGTH} characters to search` };
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, reason: `Search terms are limited to ${MAX_QUERY_LENGTH} characters` };
  }

  return {
    ok: true,
    query,
    // Case-insensitive substring. Deliberately NOT Mongo's $text index:
    // $text matches whole stemmed words, so searching "invoic" would miss
    // "invoice" and searching for a URL fragment or an order number — which
    // is most of what anyone actually looks for in a work thread — would miss
    // everything. Substring is what people mean by search here.
    //
    // The cost is that the regex cannot use an index, so every query MUST be
    // constrained to a bounded set of threads first (see the adapters). If
    // this ever needs to scale past that, the upgrade is a text index used as
    // a prefilter with this regex applied to its output, not a swap.
    pattern: new RegExp(escapeRegex(query), 'i'),
  };
}

/**
 * Cut a readable window around the first match, with offsets for highlighting.
 *
 * Offsets are relative to the RETURNED snippet, not the original message, so
 * the client can highlight without knowing how much was trimmed off the front.
 *
 * @returns {{ text: string, truncatedStart: boolean, truncatedEnd: boolean,
 *             highlights: Array<{ start: number, length: number }> }}
 */
function buildSnippet(body, query, { radius = SNIPPET_RADIUS } = {}) {
  const text = String(body ?? '');
  const needle = String(query ?? '');

  if (!needle) {
    return { text, truncatedStart: false, truncatedEnd: false, highlights: [] };
  }

  const haystack = text.toLowerCase();
  const lowered = needle.toLowerCase();
  const first = haystack.indexOf(lowered);

  // A result with no visible match is normal, not a bug: the query matched a
  // field the snippet isn't cut from, or the message was edited between the
  // query and the read. Show the head of the message rather than nothing.
  if (first === -1) {
    const head = text.slice(0, radius * 2);
    return {
      text: head,
      truncatedStart: false,
      truncatedEnd: head.length < text.length,
      highlights: [],
    };
  }

  const start = Math.max(0, first - radius);
  const end = Math.min(text.length, first + lowered.length + radius);
  const snippet = text.slice(start, end);

  // Every occurrence inside the window, so a message mentioning the term
  // three times doesn't highlight only the first.
  const highlights = [];
  const loweredSnippet = snippet.toLowerCase();
  let at = loweredSnippet.indexOf(lowered);
  while (at !== -1) {
    highlights.push({ start: at, length: lowered.length });
    at = loweredSnippet.indexOf(lowered, at + lowered.length);
  }

  return {
    text: snippet,
    truncatedStart: start > 0,
    truncatedEnd: end < text.length,
    highlights,
  };
}

/** Clamp paging so one request can't ask for the whole collection. */
function parsePaging({ page, limit }, { defaultLimit = 25, maxLimit = 50 } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || defaultLimit));
  return { page: pageNum, limit: limitNum, skip: (pageNum - 1) * limitNum };
}

module.exports = {
  MIN_QUERY_LENGTH,
  MAX_QUERY_LENGTH,
  SNIPPET_RADIUS,
  escapeRegex,
  parseQuery,
  buildSnippet,
  parsePaging,
};
