/**
 * Tapvera CRM — Keyword Rank Fetcher Lambda
 *
 * Triggered by EventBridge on three schedules:
 *   daily   → every day at 06:00 UTC
 *   weekly  → every Monday at 06:30 UTC
 *   monthly → 1st of every month at 07:00 UTC
 *
 * Env vars required (set in Lambda console or SAM template):
 *   MONGODB_URI              — MongoDB Atlas connection string
 *   SERPAPI_KEY              — SerpAPI key
 *   SERPAPI_MONTHLY_LIMIT    — quota cap (default 100)
 *   CRM_SERVER_URL           — base URL of your CRM server (for rank-drop alerts)
 *   INTERNAL_WEBHOOK_SECRET  — shared secret to authenticate webhook calls
 */

const { connectDB, SerpApiUsage, KeywordRank } = require("./db");
const SerpApiService = require("./serpApiService");

const serpApi = new SerpApiService();

// ── Helpers ───────────────────────────────────────────────────────────────────

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runWithConcurrency(taskFns, concurrency = 3) {
  for (let i = 0; i < taskFns.length; i += concurrency) {
    await Promise.allSettled(taskFns.slice(i, i + concurrency).map((fn) => fn()));
  }
}

// ── Rank-drop notification via CRM server webhook ─────────────────────────────

async function notifyRankDrop(keyword, populated, prevRank, newRank, drop) {
  const serverUrl = process.env.CRM_SERVER_URL;
  const secret    = process.env.INTERNAL_WEBHOOK_SECRET;
  if (!serverUrl || !secret) return;

  const body = JSON.stringify({
    keywordId:   keyword._id,
    keyword:     keyword.keyword,
    projectName: populated.project?.projectName || "Project",
    assignedTo:  populated.project?.assignedTo  || [],
    prevRank,
    newRank,
    drop,
    city:    keyword.city    || "",
    country: keyword.country || "Global",
  });

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    await fetch(`${serverUrl}/api/internal/rank-alert`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    console.error(`[Lambda] Rank-drop webhook failed for "${keyword.keyword}":`, err.message);
  }
}

// ── Core fetch logic for a single keyword ─────────────────────────────────────

async function fetchAndSave(keyword, month, stats) {
  if (!keyword.targetUrl) {
    stats.noTargetUrl++;
    return;
  }

  // Re-check quota before each call (another invocation may have incremented it)
  const usage = await SerpApiUsage.getOrCreate(month);
  if (usage.used >= usage.limit) {
    stats.skipped++;
    return;
  }

  try {
    const result = await serpApi.fetchRank(
      keyword.keyword, keyword.targetUrl,
      keyword.city || "", keyword.countryCode || "", keyword.country || "",
      keyword.device || "desktop"
    );

    if (result.rank === null) {
      if (result.quotaExceeded) {
        stats.skipped++;
      } else {
        console.error(`[Lambda] SerpAPI error for "${keyword.keyword}": ${result.error}`);
        stats.errors++;
      }
      return;
    }

    // Save the new rank entry
    const notes = result.found
      ? `SerpAPI (position ${result.rank}) — Lambda auto`
      : "SerpAPI — not in top 100 (rank: 101) — Lambda auto";

    await KeywordRank.findByIdAndUpdate(keyword._id, {
      $push: {
        rankHistory: {
          rank:         result.rank,
          recordedAt:   new Date(),
          notes,
          source:       "auto",
          device:       keyword.device || "desktop",
          serpSnapshot: result.snapshot,
        },
      },
    });

    await SerpApiUsage.increment(month);
    stats.serp++;

    // ── Rank-drop check (≥ 3 positions) ──────────────────────────────────
    const history = keyword.rankHistory;
    if (history.length >= 1) {
      const prev = history[history.length - 1]; // last saved before this fetch
      const drop = result.rank - prev.rank;

      const prevRanked = prev.rank > 0 && prev.rank < 101;
      const currRanked = result.rank > 0 && result.rank < 101;

      if (prevRanked && currRanked && drop >= 3) {
        // Auto-boost priority
        if (keyword.priority !== "high") {
          await KeywordRank.findByIdAndUpdate(keyword._id, { priority: "high" });
        }

        // Load project for notification
        const populated = await KeywordRank.findById(keyword._id)
          .select("keyword project")
          .populate("project", "assignedTo projectName");

        await notifyRankDrop(keyword, populated, prev.rank, result.rank, drop);
      }
    }
  } catch (err) {
    console.error(`[Lambda] Unexpected error for "${keyword.keyword}":`, err.message);
    stats.errors++;
  }
}

// ── Lambda handler ────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  // EventBridge passes: { "frequency": "all" | "daily" | "weekly" | "monthly" }
  const frequency = event.frequency || "all";
  console.log(`[KeywordRankFetcher] Starting ${frequency} fetch — ${new Date().toISOString()}`);

  await connectDB();

  // "all" = bi-monthly run that fetches every active keyword regardless of tier
  const filter = frequency === "all"
    ? { isActive: true, searchEngine: "Google" }
    : { isActive: true, searchEngine: "Google", fetchFrequency: frequency };

  const keywords = await KeywordRank.find(filter);

  if (keywords.length === 0) {
    console.log(`[KeywordRankFetcher] No active ${frequency} keywords found.`);
    return { statusCode: 200, body: `No ${frequency} keywords` };
  }

  console.log(`[KeywordRankFetcher] Processing ${keywords.length} keywords...`);

  const month = currentMonth();
  const stats = { serp: 0, skipped: 0, errors: 0, noTargetUrl: 0 };

  const taskFns = keywords.map((keyword) => async () => {
    await fetchAndSave(keyword, month, stats);
    await sleep(1200); // 1.2s between SerpAPI calls
  });

  await runWithConcurrency(taskFns, 3);

  const summary = `${frequency} complete — SerpAPI: ${stats.serp}, Skipped: ${stats.skipped}, Errors: ${stats.errors}, No URL: ${stats.noTargetUrl}`;
  console.log(`[KeywordRankFetcher] ${summary}`);

  return {
    statusCode: 200,
    body: JSON.stringify({ frequency, ...stats }),
  };
};
