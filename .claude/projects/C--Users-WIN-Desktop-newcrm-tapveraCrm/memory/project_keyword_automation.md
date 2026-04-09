---
name: keyword_ranking_automation
description: Automated keyword rank tracking system — architecture, services, and status
type: project
---

Keyword rank automation was fully implemented (2026-04-01).

**Why:** Replace manual weekly rank entry with automated SerpAPI + Playwright hybrid fetching.

**How to apply:** When making changes to keyword tracking, be aware of this full system.

## New files created
- `server/models/SerpApiUsage.js` — monthly SerpAPI quota tracker
- `server/services/serpApiService.js` — SerpAPI client (city-level location, strict domain match, device support, quota detection)
- `server/services/playwrightRankService.js` — Playwright Google scraper (proxy support, CAPTCHA detection, retry)
- `server/services/hybridRankService.js` — orchestrator (cache 10min, retry x2, concurrency 3, auto-priority boost, rank-drop alerts via notificationService)

## Modified files
- `server/models/KeywordRank.js` — added: source/device/serpSnapshot to rankHistorySchema; city/country/countryCode/priority/device/fetchFrequency to keyword schema; updated calculateRankChange for rank 101 (not ranked)
- `server/routes/keywordRoutes.js` — added POST fetch-rank route; all new fields in POST/PUT
- `server/jobs/cronJobs.js` — 3 cron tiers: daily@6AM, weekly Mon@6:30AM, monthly 1st@7AM
- `server/services/reportDataService.js` — formatKeywordData handles rank 101 as "Not ranked", includes city/country/device/source
- `client/src/components/project/OnPageSEO.jsx` — fetchingRankId state, handleFetchRank handler, Fetch Rank button (Globe icon, purple), source badges (auto/api/scraped/manual), rank 101 → "Not ranked" display, new form fields

## Key design decisions
- rank 101 = "not in top 100" (industry standard). rank 0 = legacy manual "not ranked" (backward compat). Both treated as unranked in calculateRankChange.
- SerpAPI quota tracked in MongoDB (SerpApiUsage model) — persists across restarts
- Playwright only runs for "top" keywords (rank ≤ 20 OR priority: "high") when SerpAPI quota exceeded
- In-memory cache keyed by keyword+city+countryCode+device, 10-min TTL (prevents duplicate API calls for same keyword across multiple projects)
- Auto-priority boost: if rank drops ≥ 3 positions → priority auto-set to "high" + CRM notification sent

## Env vars needed
- SERPAPI_KEY — get from serpapi.com (free: 100/month)
- SERPAPI_MONTHLY_LIMIT — default 100
- PLAYWRIGHT_PROXY — optional, for cloud IP CAPTCHA avoidance
