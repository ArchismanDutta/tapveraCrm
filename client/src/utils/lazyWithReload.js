// utils/lazyWithReload.js
//
// `React.lazy`, but survives a deploy.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE FAILURE THIS EXISTS FOR
// ─────────────────────────────────────────────────────────────────────────────
//
//   TypeError: Failed to fetch dynamically imported module:
//   https://web.tapvera.io/assets/EmployeeDashboard-mos4r6N2.js
//
// Vite content-hashes every chunk, so `EmployeeDashboard` is a different
// filename in every build. A browser that loaded index-ABC.js is holding a
// module graph that names the chunks THAT build produced. Deploy again and the
// server now has index-XYZ.js and a differently-hashed EmployeeDashboard —
// the old filename is gone.
//
// Nothing breaks until someone navigates to a lazily-loaded route. Then the
// browser requests a chunk that no longer exists, the dynamic import rejects,
// and because a rejected `lazy()` import has no handler anywhere, it unwinds
// straight past <Suspense> to the ErrorBoundary: "Something went wrong."
//
// It looks intermittent and unreproducible because it depends on how long the
// tab has been open relative to the last deploy — which is exactly why it hits
// the people who leave the CRM open all day, and never the developer who just
// hard-refreshed.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE FIX, AND WHY RELOADING IS THE RIGHT ONE
// ─────────────────────────────────────────────────────────────────────────────
//
// There is nothing to retry: the file the running page is asking for genuinely
// does not exist any more, and asking again more politely will not bring it
// back. The only way to learn the new chunk names is to fetch index.html
// again — i.e. reload. So that is what this does, exactly once, and only for
// this specific class of error.
//
// The guard is a TIMESTAMP, not a boolean. A boolean cleared on success can
// still ping-pong: succeed on the home chunk (clears), fail on the same broken
// chunk (reloads), land on home again… A "no more than one reload per
// RELOAD_COOLDOWN_MS" rule cannot do that, and it still allows a second,
// legitimate reload later in the session if a different deploy rotates the
// assets again.
//
// Anything that is NOT a chunk-load error is rethrown untouched — a component
// that throws on import is a real bug and must keep reaching the ErrorBoundary
// rather than being papered over with a refresh loop.

import { lazy } from "react";

const RELOAD_KEY = "chunk-reload-at";
const RELOAD_COOLDOWN_MS = 15000;

/**
 * Did this fail because the chunk is missing, rather than because the module
 * threw while evaluating?
 *
 * The wording differs per engine, hence the spread: Chrome and Safari say
 * "Failed to fetch dynamically imported module", Firefox says "error loading
 * dynamically imported module", older Webpack-era bundles throw ChunkLoadError.
 */
function isChunkLoadError(error) {
  const message = String(error?.message || error || "");
  return (
    error?.name === "ChunkLoadError" ||
    /failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /'?text\/html'? is not a valid javascript mime type/i.test(message)
  );
}

/** Timestamp of the last reload we triggered. Never throws. */
function lastReloadAt() {
  try {
    return Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
  } catch {
    // Private browsing can refuse sessionStorage. Returning 0 means "we have
    // never reloaded", so the first failure still gets its one attempt and
    // subsequent ones fall through to the ErrorBoundary — which is the safe
    // direction: worst case the user sees the error screen, never a loop.
    return 0;
  }
}

function markReloaded() {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* see lastReloadAt */
  }
}

/**
 * Drop-in replacement for React.lazy.
 *
 * @param {() => Promise<{ default: React.ComponentType }>} factory
 */
export default function lazyWithReload(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      // Offline is not a stale deploy. Reloading here replaces the app with
      // the browser's own error page, which is strictly worse than the
      // ErrorBoundary's "reload" button — that at least keeps them somewhere
      // they can retry from once the connection is back.
      if (typeof navigator !== "undefined" && navigator.onLine === false) throw error;

      if (Date.now() - lastReloadAt() < RELOAD_COOLDOWN_MS) throw error;

      markReloaded();
      window.location.reload();

      // The page is on its way out. Resolving or rejecting now would render
      // either the route or the error screen for the instant before the
      // reload lands, so hand back a promise that never settles.
      return new Promise(() => {});
    }
  });
}
