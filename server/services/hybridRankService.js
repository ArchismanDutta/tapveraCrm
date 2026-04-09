const serpApiService        = require("./serpApiService");
const playwrightRankService = require("./playwrightRankService");
const SerpApiUsage          = require("../models/SerpApiUsage");
const notificationService   = require("./notificationService");

// ── In-memory result cache ─────────────────────────────────────────────────────
// Prevents duplicate API calls when multiple projects share the same keyword+location
const _cache    = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function _cacheKey(keyword, city, countryCode, device) {
  return `${keyword}|||${city || ""}|||${countryCode || ""}|||${device || "desktop"}`.toLowerCase();
}

function _fromCache(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { _cache.delete(key); return null; }
  return entry.value;
}

function _toCache(key, value) {
  _cache.set(key, { value, ts: Date.now() });
}

// ── Retry helper ───────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 2, baseDelay = 2000) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await new Promise((r) => setTimeout(r, baseDelay * (i + 1)));
      }
    }
  }
  throw lastErr;
}

// ── Concurrency control (no external package needed) ──────────────────────────
// Processes taskFns in batches of `concurrency` at a time.
async function runWithConcurrency(taskFns, concurrency = 3) {
  const results = [];
  for (let i = 0; i < taskFns.length; i += concurrency) {
    const batch = await Promise.allSettled(
      taskFns.slice(i, i + concurrency).map((fn) => fn())
    );
    results.push(...batch);
  }
  return results;
}

// ── Month string ───────────────────────────────────────────────────────────────
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────

class HybridRankService {
  /**
   * Returns true if a keyword should receive Playwright fallback when SerpAPI quota is exceeded.
   * "Top" = currently ranking in top 20 OR manually flagged as priority: "high"
   */
  isTopKeyword(keyword) {
    if (keyword.priority === "high") return true;
    const last = keyword.rankHistory[keyword.rankHistory.length - 1];
    return last && last.rank > 0 && last.rank <= 20;
  }

  /**
   * Main entry point — called by the route (on-demand) and the cron jobs (scheduled).
   *
   * @param {Object}       keyword  Mongoose KeywordRank document (must be a full doc, not lean)
   * @param {String|null}  userId   The user who triggered the fetch (null for cron)
   *
   * Returns:
   *   { saved: true,  rank, source, message, fromCache? }
   *   { saved: false, rank: null, source: null, message, reason }
   *
   * Reasons for saved:false —
   *   "no_target_url"          — keyword has no targetUrl set
   *   "serp_error"             — SerpAPI call failed (non-quota)
   *   "quota_exceeded_not_top" — SerpAPI quota hit and keyword is not top-ranked
   *   "captcha"                — Playwright hit a CAPTCHA
   *   "scrape_error"           — Playwright browser error
   */
  async fetchAndSave(keyword, userId = null) {
    if (!keyword.targetUrl) {
      return { saved: false, rank: null, source: null, message: "No targetUrl set on this keyword", reason: "no_target_url" };
    }

    const city        = keyword.city        || "";
    const countryCode = keyword.countryCode || "";
    const country     = keyword.country     || "";
    const device      = keyword.device      || "desktop";
    const key         = _cacheKey(keyword.keyword, city, countryCode, device);

    // ── Cache hit ──────────────────────────────────────────────────────────
    const cached = _fromCache(key);
    if (cached) {
      await keyword.addRank(
        cached.rank, userId,
        `${cached.source === "scrape" ? "Playwright scrape" : "SerpAPI"} (cached)`,
        cached.source, device, cached.snapshot
      );
      await this._postSaveChecks(keyword);
      return {
        saved: true, rank: cached.rank, source: cached.source,
        message: `Rank: ${cached.rank} (from cache)`, fromCache: true,
      };
    }

    const month = currentMonth();
    const usage = await SerpApiUsage.getOrCreate(month);

    // ── Path A: SerpAPI ────────────────────────────────────────────────────
    if (serpApiService.isConfigured() && usage.used < usage.limit) {
      let result;
      try {
        result = await withRetry(
          () => serpApiService.fetchRank(keyword.keyword, keyword.targetUrl, city, countryCode, country, device),
          2, 2000
        );
      } catch (err) {
        result = { rank: null, found: false, quotaExceeded: false, error: err.message, snapshot: [] };
      }

      if (result.rank !== null) {
        // Success (includes rank 101 = not found in top 100)
        const source = userId ? "fetch" : "auto";
        const notes  = result.found
          ? `SerpAPI (position ${result.rank})`
          : "SerpAPI — not in top 100 (rank: 101)";

        await keyword.addRank(result.rank, userId, notes, source, device, result.snapshot);
        await SerpApiUsage.increment(month);
        await this._postSaveChecks(keyword);
        _toCache(key, { rank: result.rank, source, snapshot: result.snapshot });

        return {
          saved: true, rank: result.rank, source,
          message: result.found ? `Rank: ${result.rank}` : "Not in top 100",
        };
      }

      if (!result.quotaExceeded) {
        // Hard failure — don't fall through to Playwright for non-quota errors
        return { saved: false, rank: null, source: null, message: result.error, reason: "serp_error" };
      }

      // Quota exceeded — fall through to Playwright for top keywords
      console.warn(`[HybridRank] SerpAPI quota exceeded (${usage.used}/${usage.limit}). Trying Playwright fallback.`);
    }

    // ── Path B: Playwright fallback ────────────────────────────────────────
    if (!this.isTopKeyword(keyword)) {
      return {
        saved: false, rank: null, source: null,
        message: "SerpAPI quota exceeded — keyword not top-ranked, skipped until next reset",
        reason: "quota_exceeded_not_top",
      };
    }

    let scrapeResult;
    try {
      scrapeResult = await withRetry(
        () => playwrightRankService.fetchRank(keyword.keyword, keyword.targetUrl, countryCode || null, device),
        2, 3000
      );
    } catch (err) {
      scrapeResult = { rank: null, found: false, captcha: false, error: err.message, snapshot: [] };
    }

    if (scrapeResult.captcha) {
      return {
        saved: false, rank: null, source: null,
        message: "CAPTCHA detected — rank not saved, last known rank preserved",
        reason: "captcha",
      };
    }

    if (scrapeResult.rank === null) {
      return { saved: false, rank: null, source: null, message: scrapeResult.error, reason: "scrape_error" };
    }

    const scrapeNotes = scrapeResult.found
      ? `Playwright scrape (position ${scrapeResult.rank})`
      : "Playwright scrape — not in top 100 (rank: 101)";

    await keyword.addRank(scrapeResult.rank, userId, scrapeNotes, "scrape", device, scrapeResult.snapshot);
    await this._postSaveChecks(keyword);
    _toCache(key, { rank: scrapeResult.rank, source: "scrape", snapshot: scrapeResult.snapshot });

    return {
      saved: true, rank: scrapeResult.rank, source: "scrape",
      message: scrapeResult.found ? `Rank: ${scrapeResult.rank} (scraped)` : "Not in top 100 (scraped)",
    };
  }

  /**
   * Batch fetch — used by cron jobs.
   * Filters out keywords with no targetUrl upfront.
   * Applies concurrency: 3 parallel for SerpAPI, 1 serial for Playwright (when quota exhausted).
   *
   * @param {Array}       keywords  Array of Mongoose KeywordRank documents
   * @param {String|null} userId
   * @returns {Object} stats { serp, scrape, cached, skipped, errors, noTargetUrl }
   */
  async fetchBatch(keywords, userId = null) {
    const stats = { serp: 0, scrape: 0, cached: 0, skipped: 0, errors: 0, noTargetUrl: 0 };

    const month = currentMonth();
    const usage = await SerpApiUsage.getOrCreate(month);

    // Use higher concurrency when SerpAPI quota is available, serial for Playwright fallback
    const concurrency = (serpApiService.isConfigured() && usage.used < usage.limit) ? 3 : 1;

    const withUrl    = keywords.filter((k) => k.targetUrl);
    const withoutUrl = keywords.filter((k) => !k.targetUrl);
    stats.noTargetUrl = withoutUrl.length;

    const taskFns = withUrl.map((keyword) => async () => {
      try {
        const result = await this.fetchAndSave(keyword, userId);

        if (result.saved) {
          if (result.fromCache)           stats.cached++;
          else if (result.source === "scrape") stats.scrape++;
          else                            stats.serp++;
        } else {
          result.reason === "quota_exceeded_not_top" ? stats.skipped++ : stats.errors++;
          if (result.reason !== "quota_exceeded_not_top") {
            console.error(`[HybridRank] Failed for "${keyword.keyword}": ${result.message}`);
          }
        }

        // Delay between requests — Playwright needs more breathing room than SerpAPI
        const delay = result.source === "scrape"
          ? 4000 + Math.random() * 4000   // 4–8s for Playwright
          : 1200;                           // 1.2s for SerpAPI
        await new Promise((r) => setTimeout(r, delay));

      } catch (err) {
        console.error(`[HybridRank] Unexpected error for "${keyword.keyword}":`, err.message);
        stats.errors++;
      }
    });

    await runWithConcurrency(taskFns, concurrency);
    return stats;
  }

  /**
   * Post-save checks after every successful rank write:
   * 1. Auto-boost priority to "high" if rank dropped ≥ 3 positions
   * 2. Send CRM notification + alert if rank dropped ≥ 3
   */
  async _postSaveChecks(keyword) {
    try {
      const history = keyword.rankHistory;
      if (history.length < 2) return;

      const prev = history[history.length - 2];
      const curr = history[history.length - 1];

      // Skip if either rank is "not ranked"
      if (!prev || prev.rank === 0 || prev.rank >= 101) return;
      if (!curr || curr.rank === 0 || curr.rank >= 101) return;

      const drop = curr.rank - prev.rank; // positive = rank number went UP = position dropped
      if (drop < 3) return;

      // Auto-boost priority
      if (keyword.priority !== "high") {
        keyword.priority = "high";
        // Save just the priority field — rankHistory was already saved by addRank
        await keyword.constructor.findByIdAndUpdate(keyword._id, { priority: "high" });
      }

      // Send CRM notification to the project's assigned users
      await this._sendRankDropAlert(keyword, prev.rank, curr.rank, drop);

    } catch (err) {
      // Never let alerting break the main fetch flow
      console.error("[HybridRank] _postSaveChecks error:", err.message);
    }
  }

  async _sendRankDropAlert(keyword, prevRank, newRank, drop) {
    try {
      // Populate project to get assignedTo user IDs
      const populated = await keyword.constructor
        .findById(keyword._id)
        .populate({ path: "project", select: "assignedTo projectName" });

      if (!populated || !populated.project) return;

      const projectName = populated.project.projectName || "Project";
      const assignedTo  = populated.project.assignedTo  || [];

      const title   = `Rank Drop Alert: "${keyword.keyword}"`;
      const message = `"${keyword.keyword}" dropped ${drop} positions (${prevRank} → ${newRank}) in ${keyword.city || keyword.country || "Global"}. Priority auto-set to HIGH.`;

      // Send in-app notification to each assigned user
      for (const userId of assignedTo) {
        await notificationService.createAndSend({
          userId,
          type:     "rank_drop_alert",
          channel:  "keyword_rank",
          title,
          body:     message,
          priority: "high",
          relatedData: {
            keywordId:    keyword._id,
            projectId:    populated.project._id,
            projectName,
            keyword:      keyword.keyword,
            prevRank,
            newRank,
            drop,
          },
        }).catch((e) => console.error("[HybridRank] Notification failed:", e.message));
      }
    } catch (err) {
      console.error("[HybridRank] _sendRankDropAlert error:", err.message);
    }
  }
}

module.exports = new HybridRankService();
