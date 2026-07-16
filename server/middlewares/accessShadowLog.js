// server/middlewares/accessShadowLog.js
//
// Access-management rework (2026-07-03) — Phase 1, Task 1.2.
// TEMPORARY tooling — remove in Phase 6 once Phase 4/5 cutover is complete
// and verified (see docs/superpowers/plans/2026-07-03-access-management-rework.md).
//
// shadowCompare() runs the NEW accessControl decision alongside a decision
// ALREADY made by existing, in-production logic (hierarchyUtils, inline
// role checks, etc.) — without changing behavior. It only logs when the two
// disagree. This is how bugs in the new engine get caught by comparison
// against logic that's already proven correct, before Phase 4 makes
// anything actually depend on the new engine alone.
//
// This is intentionally NOT Express middleware (despite the file living in
// middlewares/) — it's called directly, inline, next to an existing
// permission check, so it can observe that check's result without altering
// control flow at all:
//
//   const oldResult = await hasPermission(req.user, "canEditSubordinateLeads");
//   await shadowCompare("leads:edit", req.user, oldResult, () => can(req.user, "leads:edit"));
//   if (!isOwnLead && !oldResult && !isSuperAdmin) { ...existing behavior, unchanged... }
//
// Currently wired into one representative call site each in
// leadController.js and callbackController.js as a dry run of the tooling
// itself. Extending it to every remaining hierarchyUtils call site is
// Phase 4 work, not this phase's — see the plan doc.

async function shadowCompare(action, user, oldResult, computeNewResult) {
  const old = Boolean(oldResult);
  try {
    const newResult = Boolean(await computeNewResult());
    if (old !== newResult) {
      console.warn(
        `[accessShadowLog] DISAGREEMENT on "${action}" for user ${user?._id} ` +
          `(role=${user?.role}, position="${user?.position || ""}"): ` +
          `old=${old} new=${newResult}. The OLD decision is the one actually in effect — ` +
          `this is a signal to investigate accessControl.js, not a live bug.`
      );
    }
    return { action, oldResult: old, newResult, agree: old === newResult };
  } catch (err) {
    console.error(`[accessShadowLog] Error computing new-engine decision for "${action}":`, err.message);
    return { action, oldResult: old, newResult: null, agree: null, error: err.message };
  }
}

module.exports = { shadowCompare };
