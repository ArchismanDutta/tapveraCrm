const { chromium } = require("playwright");

// Locale per country code
const LOCALE_MAP = {
  au: "en-AU", in: "en-IN", us: "en-US", gb: "en-GB",
  ca: "en-CA", nz: "en-NZ", sg: "en-SG", za: "en-ZA",
  pk: "en-PK", de: "de-DE", fr: "fr-FR", ae: "en-AE",
  ph: "en-PH", my: "en-MY", id: "id-ID",
};

const DESKTOP_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

const MOBILE_USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Mobile/15E148 Safari/604.1",
];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normaliseUrl(url) {
  if (!url) return null;
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split("?")[0];
  }
}

function domainMatches(resultHost, targetHost) {
  return resultHost === targetHost || resultHost.endsWith(`.${targetHost}`);
}

class PlaywrightRankService {
  /**
   * Fetch rank via headless Chrome (Google scraping).
   * Used as fallback when SerpAPI quota is exceeded.
   * Only called for "top" keywords (rank ≤ 20 or priority: "high").
   *
   * Returns one of:
   *   { rank: N,    found: true,  captcha: false, error: null,   snapshot: [...] }
   *   { rank: 101,  found: false, captcha: false, error: null,   snapshot: [...] }  — not in top 100
   *   { rank: null, found: false, captcha: true,  error: "...",  snapshot: [] }     — CAPTCHA hit
   *   { rank: null, found: false, captcha: false, error: "...",  snapshot: [] }     — browser/parse error
   */
  async fetchRank(keyword, targetUrl, gl = null, device = "desktop") {
    const normalisedTarget = normaliseUrl(targetUrl);
    if (!normalisedTarget) {
      return { rank: null, found: false, captcha: false, error: "targetUrl missing or invalid", snapshot: [] };
    }

    const locale     = LOCALE_MAP[gl] || "en-US";
    const isMobile   = device === "mobile";
    const userAgent  = isMobile ? randomItem(MOBILE_USER_AGENTS) : randomItem(DESKTOP_USER_AGENTS);
    const viewport   = isMobile ? { width: 390, height: 844 } : { width: 1280, height: 900 };

    // Optional proxy — set PLAYWRIGHT_PROXY env var if running on cloud IP
    const proxyConfig = process.env.PLAYWRIGHT_PROXY
      ? { server: process.env.PLAYWRIGHT_PROXY }
      : undefined;

    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        proxy: proxyConfig,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-infobars",
        ],
      });

      const context = await browser.newContext({
        userAgent,
        locale,
        viewport,
        extraHTTPHeaders: {
          "Accept-Language": `${locale},en;q=0.9`,
        },
      });

      // Mask webdriver signal
      await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      });

      const page = await context.newPage();

      // Random pre-navigation delay (0.5–2s) to appear more human
      await sleep(500 + Math.random() * 1500);

      const params = new URLSearchParams({ q: keyword, num: "100", hl: "en" });
      if (gl) params.set("gl", gl);
      if (isMobile) params.set("source", "lmps");

      await page.goto(`https://www.google.com/search?${params.toString()}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });

      // ── CAPTCHA / consent wall detection ─────────────────────────────────
      const currentUrl = page.url();
      if (
        currentUrl.includes("/sorry/") ||
        currentUrl.includes("consent.google") ||
        (await page.$("form#captcha-form")) ||
        (await page.$('[id="recaptcha"]'))
      ) {
        return {
          rank: null, found: false, captcha: true,
          error: "CAPTCHA or consent wall detected", snapshot: [],
        };
      }

      // ── Extract organic result links ──────────────────────────────────────
      // Primary selector targets div#rso result containers that have an <a> with an <h3>
      const resultLinks = await page.evaluate(() => {
        const links = [];
        document.querySelectorAll("div#rso .g, div#rso [data-hveid]").forEach((el) => {
          const a = el.querySelector("a[href]");
          const h = el.querySelector("h3");
          if (a && h && a.href && a.href.startsWith("http")) {
            links.push(a.href);
          }
        });
        return links;
      });

      // Deduplicate (Google sometimes duplicates DOM elements)
      const seen = new Set();
      const deduped = resultLinks.filter((href) => {
        if (seen.has(href)) return false;
        seen.add(href);
        return true;
      });

      // Build snapshot of top 10
      const snapshot = deduped.slice(0, 10).map((url, i) => ({
        position: i + 1,
        domain:   normaliseUrl(url) || "",
        url,
        title:    "", // title not reliably extractable with simple selectors
      }));

      // Find target position using strict domain matching
      for (let i = 0; i < deduped.length; i++) {
        const resultHost = normaliseUrl(deduped[i]);
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
