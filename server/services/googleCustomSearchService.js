const fetch = require("node-fetch");

/**
 * Google Custom Search JSON API service.
 *
 * Free tier: 100 queries/day (3,000/month).
 * Limitation: returns top 10 results only (num=10 max per call).
 * If the target URL is not in the top 10, rank 11 is returned.
 *
 * Setup:
 *   1. Create a Custom Search Engine at https://programmablesearchengine.google.com
 *      → set "Search the entire web" ON
 *   2. Get a free API key at https://console.cloud.google.com (Custom Search API)
 *   3. Set in .env:
 *        GOOGLE_CSE_API_KEY=your_key
 *        GOOGLE_CSE_ID=your_cse_id
 */

// Maps ISO country code → { gl, cr } params for Google Custom Search
const COUNTRY_PARAMS = {
  au: { gl: "au", cr: "countryAU" },
  in: { gl: "in", cr: "countryIN" },
  us: { gl: "us", cr: "countryUS" },
  gb: { gl: "gb", cr: "countryGB" },
  ca: { gl: "ca", cr: "countryCA" },
  nz: { gl: "nz", cr: "countryNZ" },
  sg: { gl: "sg", cr: "countrySG" },
  za: { gl: "za", cr: "countryZA" },
  pk: { gl: "pk", cr: "countryPK" },
  bd: { gl: "bd", cr: "countryBD" },
  de: { gl: "de", cr: "countryDE" },
  fr: { gl: "fr", cr: "countryFR" },
  ae: { gl: "ae", cr: "countryAE" },
  ph: { gl: "ph", cr: "countryPH" },
  my: { gl: "my", cr: "countryMY" },
  id: { gl: "id", cr: "countryID" },
};

// Same name→code map as serpApiService for fallback resolution
const NAME_TO_CODE = {
  "australia":            "au",
  "india":                "in",
  "united states":        "us",
  "usa":                  "us",
  "us":                   "us",
  "united kingdom":       "gb",
  "uk":                   "gb",
  "england":              "gb",
  "canada":               "ca",
  "new zealand":          "nz",
  "singapore":            "sg",
  "south africa":         "za",
  "pakistan":             "pk",
  "bangladesh":           "bd",
  "germany":              "de",
  "france":               "fr",
  "uae":                  "ae",
  "united arab emirates": "ae",
  "philippines":          "ph",
  "malaysia":             "my",
  "indonesia":            "id",
};

class GoogleCustomSearchService {
  constructor() {
    this.baseUrl = "https://www.googleapis.com/customsearch/v1";
    // Uses the keys already defined in .env
    this.apiKey  = process.env.GOOGLE_SEARCH_API_KEY;
    this.cseId   = process.env.GOOGLE_SEARCH_ENGINE_ID;
  }

  isConfigured() {
    return !!(this.apiKey && this.cseId);
  }

  normaliseUrl(url) {
    if (!url) return null;
    try {
      const withProto = url.startsWith("http") ? url : `https://${url}`;
      return new URL(withProto).hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0];
    }
  }

  domainMatches(resultHost, targetHost) {
    return resultHost === targetHost || resultHost.endsWith(`.${targetHost}`);
  }

  resolveCountryParams(countryCode = "", countryName = "") {
    let code = countryCode ? countryCode.toLowerCase().trim() : null;
    if (!code && countryName) {
      code = NAME_TO_CODE[countryName.toLowerCase().trim()] || null;
    }
    if (!code) return null;
    return COUNTRY_PARAMS[code] || null;
  }

  /**
   * Fetch the rank of targetUrl for keyword using Google Custom Search API.
   *
   * Returns:
   *   { rank: N,    found: true,  quotaExceeded: false, error: null,   snapshot: [...] }  — found in top 10
   *   { rank: 11,   found: false, quotaExceeded: false, error: null,   snapshot: [...] }  — not in top 10
   *   { rank: null, found: false, quotaExceeded: true,  error: "...",  snapshot: [] }     — quota hit
   *   { rank: null, found: false, quotaExceeded: false, error: "...",  snapshot: [] }     — failure
   *
   * NOTE: Google CSE only returns up to 10 results per query.
   *       rank 11 means "not found in top 10", not "not found in top 100".
   */
  async fetchRank(keyword, targetUrl, countryCode = "", countryName = "") {
    if (!this.isConfigured()) {
      return {
        rank: null, found: false, quotaExceeded: false,
        error: "Google CSE not configured (GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID missing)",
        snapshot: [],
      };
    }

    const normalisedTarget = this.normaliseUrl(targetUrl);
    if (!normalisedTarget) {
      return { rank: null, found: false, quotaExceeded: false, error: "targetUrl missing or invalid", snapshot: [] };
    }

    const geoParams = this.resolveCountryParams(countryCode, countryName);

    const params = new URLSearchParams({
      key: this.apiKey,
      cx:  this.cseId,
      q:   keyword,
      num: "10",       // max the API allows per call
    });

    // Apply geo-targeting when a country is known
    if (geoParams) {
      params.set("gl", geoParams.gl);   // results biased toward this country
      params.set("cr", geoParams.cr);   // restrict to pages from this country
    }

    let response;
    try {
      response = await fetch(`${this.baseUrl}?${params.toString()}`, { timeout: 15000 });
    } catch (err) {
      return { rank: null, found: false, quotaExceeded: false, error: `Network error: ${err.message}`, snapshot: [] };
    }

    // 429 = daily quota exceeded
    if (response.status === 429) {
      return {
        rank: null, found: false, quotaExceeded: true,
        error: "Google CSE daily quota exceeded (100 queries/day on free tier)",
        snapshot: [],
      };
    }

    let data;
    try {
      data = await response.json();
    } catch (err) {
      return { rank: null, found: false, quotaExceeded: false, error: `JSON parse error: ${err.message}`, snapshot: [] };
    }

    // API-level errors (invalid key, CSE misconfigured, etc.)
    if (data.error) {
      const isQuota = data.error.code === 429 || /quota|limit|exceeded/i.test(data.error.message || "");
      return {
        rank: null, found: false, quotaExceeded: isQuota,
        error: `Google CSE API error: ${data.error.message || JSON.stringify(data.error)}`,
        snapshot: [],
      };
    }

    const items = data.items || [];

    // Build top-10 snapshot
    const snapshot = items.slice(0, 10).map((item, i) => ({
      position: i + 1,
      domain:   this.normaliseUrl(item.link || "") || "",
      url:      item.link || "",
      title:    item.title || "",
    }));

    // Check if target URL appears in results
    for (let i = 0; i < items.length; i++) {
      const resultHost = this.normaliseUrl(items[i].link || "");
      if (resultHost && this.domainMatches(resultHost, normalisedTarget)) {
        return { rank: i + 1, found: true, quotaExceeded: false, error: null, snapshot };
      }
    }

    // Not in top 10 — use 11 (analogous to SerpAPI's 101 for "not in top 100")
    return { rank: 11, found: false, quotaExceeded: false, error: null, snapshot };
  }
}

module.exports = new GoogleCustomSearchService();
