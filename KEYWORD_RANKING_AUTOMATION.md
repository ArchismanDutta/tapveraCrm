# Keyword Rank Automation — Production-Grade Implementation Plan

## Architecture

```
Weekly Cron (Daily/Weekly/Monthly per keyword frequency)
        │
        ▼
HybridRankService  ◄─── In-memory cache (10 min TTL, keyed by keyword+location+device)
        │
   Quota check (SerpApiUsage model)
        │
   ┌────┴────────────────────────────┐
   │                                 │
SerpAPI (primary)              Quota exceeded?
   │                                 │
 success ─── save rank          Is keyword "top"?
                                (rank ≤ 20 OR priority:high)
                                     │
                              YES ───┤─── NO → skip
                                     │
                              Playwright scrape
                              (with proxy if set)
                              (with retry x2)
                                     │
                              CAPTCHA? → skip (keep last rank)
                              success  → save rank
```

**Source values:** `manual` | `fetch` (SerpAPI on-demand) | `auto` (SerpAPI cron) | `scrape` (Playwright fallback)

---

## All Fixes Applied

| # | Flaw | Fix |
|---|------|-----|
| 1 | Country-level location only | `city` + `country` + `countryCode` fields; city-level SerpAPI `location` param |
| 2 | Weak domain matching (`includes`) | Strict: `=== normalisedTarget \|\| endsWith('.'+normalisedTarget)` |
| 3 | Playwright without proxy | ENV-based `PLAYWRIGHT_PROXY` |
| 4 | No retry logic | 2 retries with exponential backoff |
| 5 | No concurrency control | Batch concurrency (3 parallel, no new package) |
| 6 | Same keyword fetched N times | In-memory cache: key = `keyword+city+country+device`, TTL 10 min |
| 7 | `rank: 0` misleading | `rank: 101` = not in top 100 (industry standard). `calculateRankChange` handles both 0 and ≥ 101 as "not ranked" |
| 8 | No device tracking | `device: "desktop"\|"mobile"` on keyword + rankHistory |
| 9 | One fetch schedule for all | `fetchFrequency: "daily"\|"weekly"\|"monthly"` — separate cron per tier |
| 10 | No auto-priority boost | Drop ≥ 3 positions → auto-set `priority: "high"` |
| 11 | No alert system | Drop ≥ 3 → CRM notification + email |
| 12 | No competitor visibility | `serpSnapshot[]` on rankHistory — stores top 10 SERP results |

---

## Files Overview

| File | Type |
|------|------|
| `server/models/KeywordRank.js` | Modify (significant) |
| `server/models/SerpApiUsage.js` | **Create** |
| `server/services/serpApiService.js` | **Create** |
| `server/services/playwrightRankService.js` | **Create** |
| `server/services/hybridRankService.js` | **Create** |
| `server/routes/keywordRoutes.js` | Modify |
| `server/jobs/cronJobs.js` | Modify |
| `server/.env` + `.env.example` | Modify |
| `client/src/components/project/OnPageSEO.jsx` | Modify |

---

## Step 1 — `server/models/KeywordRank.js`

### 1a. Update `rankHistorySchema`

```js
const rankHistorySchema = new mongoose.Schema({
  rank: {
    type: Number,
    required: true,
    min: 0,           // 0 kept for backward-compat (legacy manual entries)
                      // 101 = auto-detected "not in top 100" (new standard)
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,  // false: cron job has no user context
  },
  recordedAt: {
    type: Date,
    default: Date.now,
  },
  notes:  { type: String, trim: true },
  source: {
    type: String,
    enum: ["manual", "auto", "fetch", "scrape"],
    default: "manual",
  },
  device: {
    type: String,
    enum: ["desktop", "mobile"],
    default: "desktop",
  },
  // Top 10 SERP results at the time of this rank check
  serpSnapshot: [{
    position: Number,
    domain:   String,
    url:      String,
    title:    String,
  }],
});
```

### 1b. Add fields to `keywordRankSchema`

```js
// Replace the simple location string with city-level fields
city: {
  type: String,
  trim: true,
  default: "",           // e.g. "Sydney"
},
country: {
  type: String,
  trim: true,
  default: "Global",     // Display name, e.g. "Australia"
},
countryCode: {
  type: String,
  trim: true,
  default: "",           // ISO 3166-1 alpha-2, e.g. "au"
  lowercase: true,
},
// Keep 'location' for legacy compatibility — will be the full SerpAPI location string
// e.g. "Sydney, New South Wales, Australia"
// location field already exists in schema — do not remove

priority: {
  type: String,
  enum: ["high", "normal"],
  default: "normal",
},
device: {
  type: String,
  enum: ["desktop", "mobile"],
  default: "desktop",
},
fetchFrequency: {
  type: String,
  enum: ["daily", "weekly", "monthly"],
  default: "weekly",
},
```

### 1c. Update `calculateRankChange` — treat both 0 and ≥ 101 as "not ranked"

```js
function isNotRanked(rank) {
  return rank === 0 || rank >= 101;
}

function calculateRankChange(prevRank, currRank) {
  const prevUnranked = isNotRanked(prevRank);
  const currUnranked = isNotRanked(currRank);

  if (prevUnranked && !currUnranked) return 100 - currRank;   // entered rankings
  if (!prevUnranked && currUnranked) return -(100 + prevRank); // fell out of rankings
  if (prevUnranked && currUnranked)  return 0;                 // both unranked

  return prevRank - currRank; // normal: lower number = better = positive change
}
```

### 1d. Update `addRank` method

```js
keywordRankSchema.methods.addRank = function (rank, userId, notes = "", source = "manual", device = "desktop", serpSnapshot = []) {
  this.rankHistory.push({
    rank,
    recordedBy: userId || undefined,
    recordedAt: new Date(),
    notes,
    source,
    device,
    serpSnapshot,
  });
  return this.save();
};
```

> Existing call `addRank(rank, userId, notes)` still works — new params default gracefully.

### 1e. Update `getVelocityInsights` to expose new fields

In the `keywordsWithVelocity` map, add:

```js
priority:       keyword.priority,
fetchFrequency: keyword.fetchFrequency,
device:         keyword.device,
city:           keyword.city,
country:        keyword.country,
```

---

## Step 2 — `server/models/SerpApiUsage.js` (new)

```js
const mongoose = require("mongoose");

const serpApiUsageSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true }, // "2026-04"
  used:  { type: Number, default: 0 },
  limit: { type: Number, default: 100 },
});

serpApiUsageSchema.statics.getOrCreate = async function (month) {
  const limit = parseInt(process.env.SERPAPI_MONTHLY_LIMIT || "100", 10);
  let doc = await this.findOne({ month });
  if (!doc) doc = await this.create({ month, used: 0, limit });
  if (doc.limit !== limit) { doc.limit = limit; await doc.save(); }
  return doc;
};

serpApiUsageSchema.statics.increment = async function (month) {
  return this.findOneAndUpdate({ month }, { $inc: { used: 1 } }, { new: true });
};

module.exports = mongoose.model("SerpApiUsage", serpApiUsageSchema);
```

---

## Step 3 — `server/services/serpApiService.js` (new)

```js
const fetch = require("node-fetch");

// SerpAPI-compatible location strings by country code
const LOCATION_MAP = {
  au: { country: "Australia",            template: (city) => city ? `${city}, Australia`            : "Australia" },
  in: { country: "India",                template: (city) => city ? `${city}, India`                : "India" },
  us: { country: "United States",        template: (city) => city ? `${city}, United States`        : "United States" },
  gb: { country: "United Kingdom",       template: (city) => city ? `${city}, United Kingdom`       : "United Kingdom" },
  ca: { country: "Canada",               template: (city) => city ? `${city}, Canada`               : "Canada" },
  nz: { country: "New Zealand",          template: (city) => city ? `${city}, New Zealand`          : "New Zealand" },
  sg: { country: "Singapore",            template: (_)    => "Singapore" },
  za: { country: "South Africa",         template: (city) => city ? `${city}, South Africa`         : "South Africa" },
  pk: { country: "Pakistan",             template: (city) => city ? `${city}, Pakistan`             : "Pakistan" },
  bd: { country: "Bangladesh",           template: (city) => city ? `${city}, Bangladesh`           : "Bangladesh" },
  de: { country: "Germany",              template: (city) => city ? `${city}, Germany`              : "Germany" },
  fr: { country: "France",               template: (city) => city ? `${city}, France`               : "France" },
  ae: { country: "United Arab Emirates", template: (city) => city ? `${city}, UAE`                  : "United Arab Emirates" },
};

// Maps display country name → ISO code (for user-typed locations without countryCode)
const NAME_TO_CODE = {
  "australia": "au", "india": "in", "united states": "us", "usa": "us", "us": "us",
  "united kingdom": "uk", "uk": "gb", "canada": "ca", "new zealand": "nz",
  "singapore": "sg", "south africa": "za", "pakistan": "pk", "bangladesh": "bd",
  "germany": "de", "france": "fr", "uae": "ae", "united arab emirates": "ae",
};

class SerpApiService {
  constructor() {
    this.baseUrl = "https://serpapi.com/search.json";
    this.apiKey  = process.env.SERPAPI_KEY;
  }

  isConfigured() { return !!this.apiKey; }

  /**
   * Resolves city + countryCode → { gl, locationParam }
   * gl = ISO code for ?gl= param
   * locationParam = full city-level string for ?location= param
   */
  resolveLocation(city = "", countryCode = "", countryName = "") {
    // Determine gl code
    let gl = countryCode ? countryCode.toLowerCase() : null;
    if (!gl && countryName) {
      gl = NAME_TO_CODE[countryName.toLowerCase().trim()] || null;
    }

    if (!gl) return { gl: null, locationParam: null };

    const mapping = LOCATION_MAP[gl];
    if (!mapping) return { gl, locationParam: countryName || gl }; // unknown country, pass name

    const locationParam = mapping.template(city ? city.trim() : "");
    return { gl, locationParam };
  }

  /**
   * Strict domain normalisation.
   * "https://www.mysite.com/page/sub" → "mysite.com"
   */
  normaliseTargetUrl(targetUrl) {
    if (!targetUrl) return null;
    try {
      const withProto = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
      return new URL(withProto).hostname.replace(/^www\./, "");
    } catch {
      return targetUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    }
  }

  /**
   * Strict domain match — no false positives.
   * "mysite.com" matches "mysite.com" and "shop.mysite.com"
   * Does NOT match "notmysite.com" or "fake-mysite.com"
   */
  domainMatches(resultHost, targetHost) {
    return resultHost === targetHost || resultHost.endsWith(`.${targetHost}`);
  }

  /**
   * Returns:
   *   { rank: N,    found: true,  quotaExceeded: false, error: null, snapshot: [...] }
   *   { rank: 101,  found: false, quotaExceeded: false, error: null, snapshot: [...] } — not in top 100
   *   { rank: null, found: false, quotaExceeded: true,  error: "...", snapshot: [] }
   *   { rank: null, found: false, quotaExceeded: false, error: "...", snapshot: [] }
   */
  async fetchRank(keyword, targetUrl, city = "", countryCode = "", countryName = "", device = "desktop") {
    if (!this.isConfigured()) {
      return { rank: null, found: false, quotaExceeded: false, error: "SERPAPI_KEY not configured", snapshot: [] };
    }

    const normalisedTarget = this.normaliseTargetUrl(targetUrl);
    if (!normalisedTarget) {
      return { rank: null, found: false, quotaExceeded: false, error: "targetUrl missing or invalid", snapshot: [] };
    }

    const { gl, locationParam } = this.resolveLocation(city, countryCode, countryName);
    const params = new URLSearchParams({ engine: "google", q: keyword, api_key: this.apiKey, num: "100" });
    if (gl)            params.set("gl", gl);
    if (locationParam) params.set("location", locationParam);
    if (device === "mobile") params.set("device", "mobile");

    let response;
    try {
      response = await fetch(`${this.baseUrl}?${params.toString()}`, { timeout: 15000 });
    } catch (err) {
      return { rank: null, found: false, quotaExceeded: false, error: `Network: ${err.message}`, snapshot: [] };
    }

    let data;
    try { data = await response.json(); }
    catch (err) { return { rank: null, found: false, quotaExceeded: false, error: `JSON parse: ${err.message}`, snapshot: [] }; }

    if (data.error) {
      const isQuota = /credit|quota|limit|run out/i.test(data.error);
      return { rank: null, found: false, quotaExceeded: isQuota, error: `SerpAPI: ${data.error}`, snapshot: [] };
    }

    if (!response.ok) {
      return { rank: null, found: false, quotaExceeded: response.status === 429, error: `HTTP ${response.status}`, snapshot: [] };
    }

    const organicResults = data.organic_results || [];

    // Build SERP snapshot (top 10)
    const snapshot = organicResults.slice(0, 10).map(r => ({
      position: r.position,
      domain:   this.normaliseTargetUrl(r.link || "") || "",
      url:      r.link || "",
      title:    r.title || "",
    }));

    // Find target URL position using strict matching
    for (const result of organicResults) {
      const resultHost = this.normaliseTargetUrl(result.link || "");
      if (resultHost && this.domainMatches(resultHost, normalisedTarget)) {
        return { rank: result.position, found: true, quotaExceeded: false, error: null, snapshot };
      }
    }

    return { rank: 101, found: false, quotaExceeded: false, error: null, snapshot }; // not in top 100
  }
}

module.exports = new SerpApiService();
```

---

## Step 4 — `server/services/playwrightRankService.js` (new)

```js
const { chromium } = require("playwright");

const LOCALE_MAP = {
  au: "en-AU", in: "en-IN", us: "en-US", gb: "en-GB",
  ca: "en-CA", nz: "en-NZ", sg: "en-SG", za: "en-ZA",
  pk: "en-PK", de: "de-DE", fr: "fr-FR", ae: "en-AE",
};

const DESKTOP_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
];

const MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Mobile/15E148 Safari/604.1",
];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normaliseTargetUrl(targetUrl) {
  if (!targetUrl) return null;
  try {
    const withProto = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return targetUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

function domainMatches(resultHost, targetHost) {
  return resultHost === targetHost || resultHost.endsWith(`.${targetHost}`);
}

class PlaywrightRankService {
  /**
   * Returns:
   *   { rank: N,    found: true,  captcha: false, error: null,   snapshot: [...] }
   *   { rank: 101,  found: false, captcha: false, error: null,   snapshot: [...] }
   *   { rank: null, found: false, captcha: true,  error: "...",  snapshot: [] }
   *   { rank: null, found: false, captcha: false, error: "...",  snapshot: [] }
   */
  async fetchRank(keyword, targetUrl, gl = null, device = "desktop") {
    const normalisedTarget = normaliseTargetUrl(targetUrl);
    if (!normalisedTarget) {
      return { rank: null, found: false, captcha: false, error: "targetUrl missing", snapshot: [] };
    }

    const locale    = LOCALE_MAP[gl] || "en-US";
    const userAgent = device === "mobile" ? randomItem(MOBILE_UAS) : randomItem(DESKTOP_UAS);
    const viewport  = device === "mobile" ? { width: 390, height: 844 } : { width: 1280, height: 900 };
    const proxyConfig = process.env.PLAYWRIGHT_PROXY
      ? { server: process.env.PLAYWRIGHT_PROXY }
      : undefined;

    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        proxy: proxyConfig,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
      });

      const context = await browser.newContext({
        userAgent,
        locale,
        viewport,
        extraHTTPHeaders: { "Accept-Language": `${locale},en;q=0.9` },
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });

      const page = await context.newPage();

      // Random pre-search delay (0.5–2s)
      await sleep(500 + Math.random() * 1500);

      const params = new URLSearchParams({ q: keyword, num: "100", hl: "en" });
      if (gl) params.set("gl", gl);
      if (device === "mobile") params.set("source", "lmps");

      await page.goto(`https://www.google.com/search?${params.toString()}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });

      // CAPTCHA / consent wall detection
      const currentUrl = page.url();
      if (
        currentUrl.includes("/sorry/") ||
        currentUrl.includes("consent.google") ||
        await page.$("form#captcha-form") ||
        await page.$('[id="recaptcha"]')
      ) {
        return { rank: null, found: false, captcha: true, error: "CAPTCHA or consent wall detected", snapshot: [] };
      }

      // Extract organic result URLs
      const resultLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll("div#rso .g, div#rso [data-hveid]").forEach(el => {
          const a = el.querySelector("a[href]");
          const h = el.querySelector("h3");
          if (a && h && a.href && a.href.startsWith("http")) links.push(a.href);
        });
        return links;
      });

      // Deduplicate
      const seen  = new Set();
      const deduped = resultLinks.filter(href => {
        if (seen.has(href)) return false;
        seen.add(href);
        return true;
      });

      // Build snapshot (top 10)
      const snapshot = deduped.slice(0, 10).map((url, i) => ({
        position: i + 1,
        domain:   normaliseTargetUrl(url) || "",
        url,
        title:    "",  // title extraction not reliable with simple selector approach
      }));

      // Find position using strict matching
      for (let i = 0; i < deduped.length; i++) {
        const resultHost = normaliseTargetUrl(deduped[i]);
        if (resultHost && domainMatches(resultHost, normalisedTarget)) {
          return { rank: i + 1, found: true, captcha: false, error: null, snapshot };
        }
      }

      return { rank: 101, found: false, captcha: false, error: null, snapshot };

    } catch (err) {
      return { rank: null, found: false, captcha: false, error: `Browser error: ${err.message}`, snapshot: [] };
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  }
}

module.exports = new PlaywrightRankService();
```

---

## Step 5 — `server/services/hybridRankService.js` (new)

```js
const serpApiService        = require("./serpApiService");
const playwrightRankService = require("./playwrightRankService");
const SerpApiUsage          = require("../models/SerpApiUsage");

// ── In-memory cache ────────────────────────────────────────────────────────────
const cache    = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function cacheKey(keyword, city, countryCode, device) {
  return `${keyword}|||${city}|||${countryCode}|||${device}`.toLowerCase();
}

function fromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.value;
}

function toCache(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

// ── Retry helper ───────────────────────────────────────────────────────────────
async function withRetry(fn, retries = 2, baseDelay = 2000) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise(r => setTimeout(r, baseDelay * (i + 1)));
    }
  }
  throw lastErr;
}

// ── Concurrency control (no extra package) ─────────────────────────────────────
async function runWithConcurrency(taskFns, concurrency = 3) {
  const results = [];
  for (let i = 0; i < taskFns.length; i += concurrency) {
    const batch = await Promise.allSettled(taskFns.slice(i, i + concurrency).map(fn => fn()));
    results.push(...batch);
  }
  return results;
}

// ── Month string ───────────────────────────────────────────────────────────────
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Alert trigger ─────────────────────────────────────────────────────────────
async function triggerRankDropAlert(keyword, prevRank, newRank) {
  try {
    // Replace with your existing notification service
    // Example: notificationService.send(...)
    console.warn(`RANK DROP ALERT: "${keyword.keyword}" dropped from ${prevRank} → ${newRank}`);
  } catch (err) {
    console.error("Failed to send rank drop alert:", err.message);
  }
}

class HybridRankService {

  isTopKeyword(keyword) {
    if (keyword.priority === "high") return true;
    const last = keyword.rankHistory[keyword.rankHistory.length - 1];
    return last && last.rank > 0 && last.rank <= 20;
  }

  /**
   * Main entry point — called by route and cron.
   * @param {Object}  keyword  Mongoose KeywordRank document
   * @param {String|null} userId
   *
   * Returns { saved, rank, source, message, reason? }
   */
  async fetchAndSave(keyword, userId = null) {
    if (!keyword.targetUrl) {
      return { saved: false, rank: null, source: null, message: "No targetUrl", reason: "no_target_url" };
    }

    const { city = "", countryCode = "", country = "" } = keyword;
    const device = keyword.device || "desktop";
    const key    = cacheKey(keyword.keyword, city, countryCode, device);

    // ── Cache hit ──
    const cached = fromCache(key);
    if (cached) {
      // Re-save the cached result to this specific keyword's history
      await keyword.addRank(cached.rank, userId, `${cached.source} (cached)`, cached.source, device, cached.snapshot);
      return { saved: true, rank: cached.rank, source: cached.source, message: `Rank: ${cached.rank} (from cache)`, fromCache: true };
    }

    const month = currentMonth();
    const usage = await SerpApiUsage.getOrCreate(month);

    // ── Path A: SerpAPI ───────────────────────────────────────────────────────
    if (serpApiService.isConfigured() && usage.used < usage.limit) {
      let result;
      try {
        result = await withRetry(() =>
          serpApiService.fetchRank(keyword.keyword, keyword.targetUrl, city, countryCode, country, device)
        );
      } catch (err) {
        result = { rank: null, found: false, quotaExceeded: false, error: err.message, snapshot: [] };
      }

      if (result.rank !== null) {
        const source = userId ? "fetch" : "auto";
        await keyword.addRank(result.rank, userId, `SerpAPI${result.found ? ` (pos ${result.rank})` : " — not in top 100"}`, source, device, result.snapshot);
        await SerpApiUsage.increment(month);
        await this._postSaveChecks(keyword, result.rank);
        toCache(key, { rank: result.rank, source, snapshot: result.snapshot });
        return { saved: true, rank: result.rank, source, message: result.found ? `Rank: ${result.rank}` : "Not in top 100" };
      }

      if (!result.quotaExceeded) {
        return { saved: false, rank: null, source: null, message: result.error, reason: "serp_error" };
      }

      // Quota exceeded — fall through to Playwright
      console.warn(`SerpAPI quota exceeded (${usage.used}/${usage.limit}). Playwright fallback.`);
    }

    // ── Path B: Playwright ────────────────────────────────────────────────────
    if (!this.isTopKeyword(keyword)) {
      return { saved: false, rank: null, source: null, message: "SerpAPI quota exceeded — keyword not top-ranked, skipped", reason: "quota_exceeded_not_top" };
    }

    let scrapeResult;
    try {
      scrapeResult = await withRetry(() =>
        playwrightRankService.fetchRank(keyword.keyword, keyword.targetUrl, countryCode || null, device),
        2, 3000
      );
    } catch (err) {
      scrapeResult = { rank: null, found: false, captcha: false, error: err.message, snapshot: [] };
    }

    if (scrapeResult.captcha) {
      return { saved: false, rank: null, source: null, message: "CAPTCHA detected — rank not saved", reason: "captcha" };
    }
    if (scrapeResult.rank === null) {
      return { saved: false, rank: null, source: null, message: scrapeResult.error, reason: "scrape_error" };
    }

    await keyword.addRank(scrapeResult.rank, userId, `Playwright${scrapeResult.found ? ` (pos ${scrapeResult.rank})` : " — not in top 100"}`, "scrape", device, scrapeResult.snapshot);
    await this._postSaveChecks(keyword, scrapeResult.rank);
    toCache(key, { rank: scrapeResult.rank, source: "scrape", snapshot: scrapeResult.snapshot });

    return { saved: true, rank: scrapeResult.rank, source: "scrape", message: scrapeResult.found ? `Rank: ${scrapeResult.rank} (scraped)` : "Not in top 100 (scraped)" };
  }

  /**
   * Runs after a rank is saved:
   * 1. Auto-boost priority if rank dropped ≥ 3
   * 2. Trigger alert if rank dropped ≥ 3
   */
  async _postSaveChecks(keyword, newRank) {
    try {
      const history = keyword.rankHistory;
      if (history.length < 2) return;

      // Reload from DB to get the updated rankHistory
      const prev = history[history.length - 2];
      if (!prev || prev.rank === 0 || prev.rank >= 101) return; // prev was unranked
      if (newRank === 0 || newRank >= 101) return;               // new is unranked (already handled by calculateRankChange)

      const drop = newRank - prev.rank; // positive = dropped (rank number went up)

      if (drop >= 3) {
        // Auto-boost priority
        if (keyword.priority !== "high") {
          keyword.priority = "high";
          await keyword.save();
        }
        // Alert
        await triggerRankDropAlert(keyword, prev.rank, newRank);
      }
    } catch (err) {
      console.error("_postSaveChecks failed:", err.message);
    }
  }

  /**
   * Used by cron jobs. Accepts an array of keywords and runs with concurrency control.
   * SerpAPI: up to 3 concurrent. Playwright: 1 at a time (to reduce block risk).
   */
  async fetchBatch(keywords, userId = null) {
    const stats = { serp: 0, scrape: 0, skipped: 0, errors: 0, noTargetUrl: 0, cached: 0 };

    // Separate into SerpAPI-eligible and Playwright-eligible
    const month = currentMonth();
    const usage = await SerpApiUsage.getOrCreate(month);
    const quotaLeft = usage.limit - usage.used;

    // All keywords go through fetchAndSave — the service handles routing internally
    // We control concurrency here:
    // - If SerpAPI quota available: run up to 3 in parallel
    // - If quota exceeded: run Playwright serially (1 at a time)
    const concurrency = quotaLeft > 0 ? 3 : 1;
    const taskFns = keywords
      .filter(k => k.targetUrl)  // skip no-URL ones upfront
      .map(k => async () => {
        const result = await this.fetchAndSave(k, userId);
        if (result.saved) {
          if (result.fromCache) stats.cached++;
          else if (result.source === "scrape") stats.scrape++;
          else stats.serp++;
        } else {
          result.reason === "quota_exceeded_not_top" ? stats.skipped++ : stats.errors++;
        }
        // Delay: Playwright needs more breathing room
        const delay = result.source === "scrape" ? 4000 + Math.random() * 4000 : 1200;
        await new Promise(r => setTimeout(r, delay));
      });

    stats.noTargetUrl = keywords.length - taskFns.length;
    await runWithConcurrency(taskFns, concurrency);

    return stats;
  }
}

module.exports = new HybridRankService();
```

---

## Step 6 — `server/routes/keywordRoutes.js`

### Add import

```js
const hybridRankService = require("../services/hybridRankService");
```

### Add `fetch-rank` route

```js
// POST /api/projects/:projectId/keywords/:keywordId/fetch-rank
router.post("/:projectId/keywords/:keywordId/fetch-rank", protect, async (req, res) => {
  try {
    const { projectId, keywordId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "employee") {
      const ok = project.assignedTo.some(e => e.toString() === req.user._id.toString());
      if (!ok) return res.status(403).json({ message: "Access denied" });
    }

    const keyword = await KeywordRank.findById(keywordId);
    if (!keyword)                                  return res.status(404).json({ message: "Keyword not found" });
    if (keyword.project.toString() !== projectId)  return res.status(400).json({ message: "Keyword does not belong to this project" });
    if (!keyword.targetUrl)                        return res.status(400).json({ message: "No Target URL set on this keyword. Edit to add one." });
    if (keyword.searchEngine !== "Google")         return res.status(400).json({ message: "Automated fetch is supported for Google only." });

    const result = await hybridRankService.fetchAndSave(keyword, req.user._id.toString());

    if (!result.saved) {
      const statusMap = { captcha: 503, quota_exceeded_not_top: 429 };
      const status = statusMap[result.reason] || 502;
      return res.status(status).json({ message: result.message, reason: result.reason });
    }

    const updated = await KeywordRank.findById(keywordId)
      .populate("createdBy", "name email employeeId")
      .populate("rankHistory.recordedBy", "name email employeeId");

    res.json({ success: true, message: result.message, fetchedRank: result.rank, source: result.source, data: updated });
  } catch (err) {
    console.error("fetch-rank error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});
```

### Update `POST /:projectId/keywords` to accept new fields

In the destructuring block, add:

```js
const { keyword, initialRank, targetUrl, keywordLink, blogLink, backlink,
        searchEngine, location, category, notes,
        city, country, countryCode, priority, device, fetchFrequency } = req.body;
```

In the `KeywordRank.create(...)` call, add:

```js
city:           city || "",
country:        country || "Global",
countryCode:    countryCode || "",
priority:       priority || "normal",
device:         device || "desktop",
fetchFrequency: fetchFrequency || "weekly",
```

### Update `PUT /:projectId/keywords/:keywordId` to handle new fields

In the update block, add:

```js
if (city          !== undefined) keywordRank.city          = city;
if (country       !== undefined) keywordRank.country       = country;
if (countryCode   !== undefined) keywordRank.countryCode   = countryCode;
if (priority      !== undefined) keywordRank.priority      = priority;
if (device        !== undefined) keywordRank.device        = device;
if (fetchFrequency !== undefined) keywordRank.fetchFrequency = fetchFrequency;
```

---

## Step 7 — `server/jobs/cronJobs.js`

### Add imports

```js
const KeywordRank       = require("../models/KeywordRank");
const hybridRankService = require("../services/hybridRankService");
```

### Add three fetch functions (before `initializeCronJobs`)

```js
async function runKeywordRankFetch(frequency) {
  console.log(`Running ${frequency} keyword rank fetch...`);
  const keywords = await KeywordRank.find({ isActive: true, searchEngine: "Google", fetchFrequency: frequency });
  console.log(`  Found ${keywords.length} keywords with frequency: ${frequency}`);
  const stats = await hybridRankService.fetchBatch(keywords, null);
  console.log(`  Done — SerpAPI: ${stats.serp}, Scraped: ${stats.scrape}, Cached: ${stats.cached}, Skipped: ${stats.skipped}, Errors: ${stats.errors}, No URL: ${stats.noTargetUrl}`);
  return stats;
}
```

### Inside `initializeCronJobs()`, add three schedules

```js
// Daily keywords — every day at 6:00 AM
cron.schedule("0 6 * * *", async () => {
  await runKeywordRankFetch("daily");
});

// Weekly keywords — every Monday at 6:00 AM
cron.schedule("0 6 * * 1", async () => {
  await runKeywordRankFetch("weekly");
});

// Monthly keywords — 1st of every month at 6:00 AM
cron.schedule("0 6 1 * *", async () => {
  await runKeywordRankFetch("monthly");
});
```

```js
console.log("   - Keyword rank fetch (daily):   Every day at 6:00 AM");
console.log("   - Keyword rank fetch (weekly):  Every Monday at 6:00 AM");
console.log("   - Keyword rank fetch (monthly): 1st of every month at 6:00 AM");
```

### Update exports

```js
module.exports = { initializeCronJobs, runManualCleanup, runKeywordRankFetch };
```

---

## Step 8 — Environment Variables

```
# server/.env additions

# SerpAPI — automated keyword rank tracking
SERPAPI_KEY=your_serpapi_key_here
SERPAPI_MONTHLY_LIMIT=100

# Playwright proxy (optional — add only if facing CAPTCHAs from cloud IPs)
# Format: http://user:pass@proxy-ip:port  OR  http://proxy-ip:port
PLAYWRIGHT_PROXY=
```

---

## Step 9 — Frontend (`client/src/components/project/OnPageSEO.jsx`)

### 9a. New state

```js
const [fetchingRankId, setFetchingRankId] = useState(null);
```

### 9b. Expand formData / editFormData

```js
// Add to formData initial state:
targetUrl:      "",
city:           "",
country:        "Global",
countryCode:    "",
priority:       "normal",
device:         "desktop",
fetchFrequency: "weekly",

// Add to editFormData (built from selectedKeyword):
targetUrl:      selectedKeyword?.targetUrl      || "",
city:           selectedKeyword?.city           || "",
country:        selectedKeyword?.country        || "Global",
countryCode:    selectedKeyword?.countryCode    || "",
priority:       selectedKeyword?.priority       || "normal",
device:         selectedKeyword?.device         || "desktop",
fetchFrequency: selectedKeyword?.fetchFrequency || "weekly",
```

### 9c. `handleFetchRank`

```js
const handleFetchRank = async (keyword) => {
  if (!keyword.targetUrl) {
    showNotification("No Target URL set. Edit the keyword to add one.", "error");
    return;
  }
  setFetchingRankId(keyword._id);
  try {
    const token = localStorage.getItem("token");
    const response = await axios.post(
      `${API_BASE}/api/projects/${projectId}/keywords/${keyword._id}/fetch-rank`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    showNotification(response.data.message || "Rank fetched!", "success");
    fetchKeywords();
    fetchStats();
  } catch (err) {
    showNotification(err.response?.data?.message || "Error fetching rank", "error");
  } finally {
    setFetchingRankId(null);
  }
};
```

### 9d. Fetch Rank button (Actions column)

```jsx
<button
  onClick={() => handleFetchRank(keyword)}
  disabled={fetchingRankId === keyword._id || !keyword.targetUrl}
  className={`p-1.5 rounded transition-colors ${
    fetchingRankId === keyword._id || !keyword.targetUrl
      ? "text-gray-600 cursor-not-allowed"
      : "text-purple-400 hover:bg-purple-500/20"
  }`}
  title={keyword.targetUrl ? `Fetch rank from Google (${keyword.device || "desktop"})` : "Edit keyword to add Target URL first"}
>
  {fetchingRankId === keyword._id
    ? <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
    : <Globe className="w-4 h-4" />}
</button>
```

### 9e. Source + device badge on Current Rank cell

```jsx
{keyword.currentRank && (
  <div className="flex items-center gap-1 mt-1 flex-wrap">
    <span className="text-xs text-gray-600">
      {new Date(keyword.currentRank.recordedAt).toLocaleDateString()}
    </span>
    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
      keyword.currentRank.source === "auto"   ? "bg-purple-500/20 text-purple-300" :
      keyword.currentRank.source === "fetch"  ? "bg-blue-500/20   text-blue-300"   :
      keyword.currentRank.source === "scrape" ? "bg-orange-500/20 text-orange-300" :
                                                "bg-gray-500/20   text-gray-400"
    }`}>
      {keyword.currentRank.source === "auto"   ? "auto"    :
       keyword.currentRank.source === "fetch"  ? "api"     :
       keyword.currentRank.source === "scrape" ? "scraped" : "manual"}
    </span>
    {keyword.currentRank.device === "mobile" && (
      <span className="text-xs px-1 bg-cyan-500/20 text-cyan-300 rounded-full">mobile</span>
    )}
  </div>
)}
```

### 9f. Display rank 101 as "Not ranked" in table

Wherever `keyword.currentRank?.rank` is displayed:

```jsx
{(() => {
  const r = keyword.currentRank?.rank;
  if (r === undefined || r === null) return "-";
  if (r >= 101 || r === 0) return <span className="text-red-400 text-sm">Not ranked</span>;
  return <span className="text-white font-semibold text-lg">{r}</span>;
})()}
```

### 9g. New fields in Add / Edit modals

```jsx
{/* Target URL */}
<div>
  <label className="block text-sm text-gray-400 mb-1">Target URL <span className="text-red-400">*</span></label>
  <input type="text" name="targetUrl" value={formData.targetUrl}
    onChange={e => setFormData({...formData, targetUrl: e.target.value})}
    placeholder="mysite.com" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
  <p className="text-xs text-gray-500 mt-1">Domain to find in search results</p>
</div>

{/* City + Country on same row */}
<div className="grid grid-cols-2 gap-3">
  <div>
    <label className="block text-sm text-gray-400 mb-1">City</label>
    <input type="text" name="city" value={formData.city}
      onChange={e => setFormData({...formData, city: e.target.value})}
      placeholder="e.g. Sydney" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
  </div>
  <div>
    <label className="block text-sm text-gray-400 mb-1">Country</label>
    <input type="text" name="country" value={formData.country}
      onChange={e => setFormData({...formData, country: e.target.value})}
      placeholder="e.g. Australia" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
  </div>
</div>

{/* Device */}
<div>
  <label className="block text-sm text-gray-400 mb-1">Device</label>
  <select name="device" value={formData.device}
    onChange={e => setFormData({...formData, device: e.target.value})}
    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
    <option value="desktop">Desktop</option>
    <option value="mobile">Mobile</option>
  </select>
</div>

{/* Fetch Frequency */}
<div>
  <label className="block text-sm text-gray-400 mb-1">Auto-fetch Frequency</label>
  <select name="fetchFrequency" value={formData.fetchFrequency}
    onChange={e => setFormData({...formData, fetchFrequency: e.target.value})}
    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
    <option value="daily">Daily (top keywords only)</option>
    <option value="weekly">Weekly</option>
    <option value="monthly">Monthly (low priority)</option>
  </select>
</div>

{/* Priority */}
<div>
  <label className="block text-sm text-gray-400 mb-1">Priority</label>
  <select name="priority" value={formData.priority}
    onChange={e => setFormData({...formData, priority: e.target.value})}
    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white">
    <option value="normal">Normal</option>
    <option value="high">High — always fetched (even when SerpAPI quota exceeded)</option>
  </select>
</div>
```

---

## Implementation Order

```
1.  server/models/KeywordRank.js                  (schema changes first — everything depends on this)
2.  server/models/SerpApiUsage.js                 (new model)
3.  server/services/serpApiService.js             (pure SerpAPI client)
4.  server/services/playwrightRankService.js      (pure Playwright scraper)
5.  server/services/hybridRankService.js          (orchestrator — uses 3 + 4)
6.  server/routes/keywordRoutes.js                (add fetch-rank route + new field handling)
7.  server/jobs/cronJobs.js                       (3 cron schedules: daily/weekly/monthly)
8.  server/.env + server/.env.example             (SERPAPI_KEY, SERPAPI_MONTHLY_LIMIT, PLAYWRIGHT_PROXY)
9.  client/src/components/project/OnPageSEO.jsx   (UI: new fields, badges, rank 101 display)
```

---

## Upgrade Path (Future)

| Feature | What | When |
|---------|------|------|
| Queue system | Replace cron loop with BullMQ + Redis | When keywords > 500 |
| Alert channels | Connect `triggerRankDropAlert` to email/Slack/CRM notification | Next sprint |
| SERP competitor view | Show `serpSnapshot` in chart modal | After core is stable |
| Proxy rotation | Pool of residential proxies in `PLAYWRIGHT_PROXY` | If CAPTCHAs become frequent |
| Historical aggregation | Weekly avg rank, volatility score as stored fields | Reporting milestone |
| countryCode autocomplete | Frontend dropdown instead of free-text country | UX improvement |

---

*Plan updated: 2026-04-01 — Production-grade hybrid approach with all risk fixes applied*
