// utils/session.js
//
// Two questions the whole app kept answering inconsistently: "is this session
// still good?" and "what do we do when the server says it isn't?"
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. NOBODY CHECKED THE TOKEN'S EXPIRY.
//    Tokens are issued with `expiresIn: "1d"` (server/controllers/authController.js).
//    App.jsx decided you were logged in on `token.trim() !== ""` alone, so a
//    day-old token still rendered the entire authenticated app — which then
//    fired its normal startup requests, collected a 401, wiped the token and
//    hard-reloaded to /login. The user sees the dashboard flash and then get
//    thrown out: "it blinks and refreshes to the login page", every morning.
//    Reading the `exp` claim locally turns that into what it actually is —
//    a logged-out visit that lands calmly on the login form.
//
// 2. FOUR PLACES INDEPENDENTLY DID `window.location.href = "/login"` ON 401.
//    That is a FULL PAGE RELOAD, and none of them checked whether they were
//    already on /login. Any request that 401s while the login page is open
//    therefore reloads the login page, which re-runs whatever produced the
//    401, which reloads again. One stuck background request is enough to
//    make the app unusable, and there is nothing in the loop that decays.
//    `handleSessionExpired` is now the single door, and it cannot loop.
//
// This module deliberately does NOT verify the signature. It cannot — the
// secret is server-side, which is the point. Everything here is a UX
// shortcut around a decision the server still owns and re-makes on every
// request. When in doubt it defers to the server rather than logging anyone
// out on its own initiative; see the `exp` handling below.

import { readAuthToken } from "./authEvents";

/**
 * The JWT payload, or null if it can't be read.
 *
 * base64url, not base64: `-` and `_` are the URL-safe substitutions, and atob
 * rejects them. Tokens with unicode in a claim would also need a UTF-8 decode,
 * but nothing here reads a string claim, so `exp` survives the shortcut.
 */
function decodePayload(token) {
  try {
    const segment = String(token).split(".")[1];
    if (!segment) return null;
    return JSON.parse(atob(segment.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/**
 * A minute of slack, applied in the FORGIVING direction.
 *
 * A client clock running fast would otherwise discard a token the server would
 * still have accepted, logging someone out for no reason and with no way for
 * them to tell why. Being a minute late to notice an expiry costs one 401,
 * which the interceptor already handles correctly.
 */
const CLOCK_SKEW_MS = 60 * 1000;

/**
 * Is this token past its own `exp`?
 *
 * Returns FALSE for anything it cannot read — a malformed token, or one with
 * no `exp` claim. That is deliberate: the server is the authority, and a local
 * parser that guessed "expired" would lock people out over a token shape it
 * simply didn't recognise. The only thing this is allowed to do is skip a
 * round trip we already know the answer to.
 */
export function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodePayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 + CLOCK_SKEW_MS <= Date.now();
}

/** A token that is present and not yet expired. */
export function hasLiveSession() {
  const token = readAuthToken();
  return Boolean(token) && !isTokenExpired(token);
}

/** Path comparison that tolerates a trailing slash. */
const isOnLoginPage = () => {
  try {
    return window.location.pathname.replace(/\/+$/, "") === "/login";
  } catch {
    return false;
  }
};

// Module-level, so concurrent 401s from a page that fired six requests at once
// produce one navigation rather than six.
let redirecting = false;

/**
 * The session is over: clear it, and get the user to the login page.
 *
 * ─── THE TWO GUARDS ARE THE WHOLE POINT ───
 * Already on /login: clear the token and STOP. There is nowhere to go, and
 * navigating anyway is a reload that re-runs whatever just 401'd.
 * Already redirecting: one navigation, not one per failed request.
 *
 * Still a hard `window.location.href` rather than a router navigate, on
 * purpose: this is called from axios interceptors and plain service modules
 * that sit outside React and have no router to reach for, and tearing the app
 * down is the honest response to "your session is gone" — it guarantees no
 * component keeps rendering the previous user's data.
 */
export function handleSessionExpired() {
  try {
    localStorage.removeItem("token");
  } catch {
    // Private browsing can refuse localStorage outright. Nothing to clear.
  }

  if (isOnLoginPage() || redirecting) return;

  redirecting = true;
  window.location.href = "/login";
}

export default { isTokenExpired, hasLiveSession, handleSessionExpired };
