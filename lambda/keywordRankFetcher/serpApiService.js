// Adapted from server/services/serpApiService.js
// Uses Node 20 native fetch — no node-fetch dependency needed.

const LOCATION_MAP = {
  au: { template: (city) => city ? `${city}, Australia`             : "Australia" },
  in: { template: (city) => city ? `${city}, India`                 : "India" },
  us: { template: (city) => city ? `${city}, United States`         : "United States" },
  gb: { template: (city) => city ? `${city}, United Kingdom`        : "United Kingdom" },
  ca: { template: (city) => city ? `${city}, Canada`                : "Canada" },
  nz: { template: (city) => city ? `${city}, New Zealand`           : "New Zealand" },
  sg: { template: (_)    =>                  "Singapore" },
  za: { template: (city) => city ? `${city}, South Africa`          : "South Africa" },
  pk: { template: (city) => city ? `${city}, Pakistan`              : "Pakistan" },
  bd: { template: (city) => city ? `${city}, Bangladesh`            : "Bangladesh" },
  de: { template: (city) => city ? `${city}, Germany`               : "Germany" },
  fr: { template: (city) => city ? `${city}, France`                : "France" },
  ae: { template: (city) => city ? `${city}, United Arab Emirates`  : "United Arab Emirates" },
  ph: { template: (city) => city ? `${city}, Philippines`           : "Philippines" },
  my: { template: (city) => city ? `${city}, Malaysia`              : "Malaysia" },
  id: { template: (city) => city ? `${city}, Indonesia`             : "Indonesia" },
};

const NAME_TO_CODE = {
  "australia": "au", "india": "in", "united states": "us", "usa": "us",
  "us": "us", "united kingdom": "gb", "uk": "gb", "england": "gb",
  "canada": "ca", "new zealand": "nz", "singapore": "sg",
  "south africa": "za", "pakistan": "pk", "bangladesh": "bd",
  "germany": "de", "france": "fr", "uae": "ae",
  "united arab emirates": "ae", "philippines": "ph",
  "malaysia": "my", "indonesia": "id",
};

class SerpApiService {
  constructor(apiKey) {
    this.baseUrl = "https://serpapi.com/search.json";
    this.apiKey  = apiKey || process.env.SERPAPI_KEY;
  }

  isConfigured() { return !!this.apiKey; }

  resolveLocation(city = "", countryCode = "", countryName = "") {
    let gl = countryCode ? countryCode.toLowerCase().trim() : null;
    if (!gl && countryName) gl = NAME_TO_CODE[countryName.toLowerCase().trim()] || null;
    if (!gl) return { gl: null, locationParam: null };

    const mapping = LOCATION_MAP[gl];
    if (!mapping) return { gl, locationParam: countryName || gl };

    return { gl, locationParam: mapping.template(city ? city.trim() : "") };
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

  async fetchRank(keyword, targetUrl, city = "", countryCode = "", countryName = "", device = "desktop") {
    if (!this.isConfigured()) {
      return { rank: null, found: false, quotaExceeded: false, error: "SERPAPI_KEY not configured", snapshot: [] };
    }

    const normalisedTarget = this.normaliseUrl(targetUrl);
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
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 15000);
      response = await fetch(`${this.baseUrl}?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      return { rank: null, found: false, quotaExceeded: false, error: `Network error: ${err.message}`, snapshot: [] };
    }

    let data;
    try { data = await response.json(); }
    catch (err) {
      return { rank: null, found: false, quotaExceeded: false, error: `JSON parse error: ${err.message}`, snapshot: [] };
    }

    if (data.error) {
      const isQuota = /credit|quota|limit|run out/i.test(data.error);
      return { rank: null, found: false, quotaExceeded: isQuota, error: `SerpAPI: ${data.error}`, snapshot: [] };
    }

    if (!response.ok) {
      return { rank: null, found: false, quotaExceeded: response.status === 429, error: `HTTP ${response.status}`, snapshot: [] };
    }

    const organicResults = data.organic_results || [];
    const snapshot = organicResults.slice(0, 10).map((r) => ({
      position: r.position,
      domain:   this.normaliseUrl(r.link || "") || "",
      url:      r.link || "",
      title:    r.title || "",
    }));

    for (const result of organicResults) {
      const resultHost = this.normaliseUrl(result.link || "");
      if (resultHost && this.domainMatches(resultHost, normalisedTarget)) {
        return { rank: result.position, found: true, quotaExceeded: false, error: null, snapshot };
      }
    }

    return { rank: 101, found: false, quotaExceeded: false, error: null, snapshot };
  }
}

module.exports = SerpApiService;
