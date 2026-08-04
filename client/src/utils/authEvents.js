// utils/authEvents.js
//
// A tiny bridge between "the auth token changed" and the parts of the app that
// need to react to it — chiefly WebSocketProvider.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────────
//
// WebSocketProvider is mounted in App.jsx ABOVE the router, so on a cold load it
// mounts while the user is still logged out — there is no token to connect
// with. Logging in is pure SPA state (setIsAuthenticated + navigate, no page
// reload), so nothing about the provider changes when it happens.
//
// The auth state itself lives in AppWrapper, which is a CHILD of the provider,
// so it cannot be passed down as a prop without restructuring the tree. A window
// event is the least invasive way for a child to tell an ancestor that the token
// moved.
//
// Lives in its own module rather than in WebSocketContext.jsx for two reasons:
// React Fast Refresh only works when a file exports components alone, and
// importing this from a page (see pages/EmployeePage.jsx) should not drag the
// socket.io client into that page's module graph.
export const AUTH_CHANGED_EVENT = "auth-changed";

/**
 * Announce that the auth token has been written or cleared.
 *
 * Call this immediately after any localStorage token change that is NOT
 * followed by a full page load. A `window.location.href` redirect does not need
 * it — that tears the whole app down anyway — but `navigate()` and plain state
 * updates do, because nothing remounts.
 *
 * Forgetting it is quiet rather than loud: the socket simply keeps whatever
 * state it had, so a login yields no connection at all (every live feature
 * degrades to needing a manual refresh) and a logout leaves a socket running on
 * the previous user's token.
 */
export const notifyAuthChanged = () => {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
};

/** The current auth token, or null if absent/blank. Never throws. */
export const readAuthToken = () => {
  try {
    const token = localStorage.getItem("token");
    return token && token.trim() !== "" ? token : null;
  } catch {
    // Safari in private mode, and any other environment where localStorage
    // access itself throws. Treat as logged out rather than crashing render.
    return null;
  }
};
