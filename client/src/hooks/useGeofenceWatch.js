// src/hooks/useGeofenceWatch.js
//
// Geofenced login (2026-08-07).
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
//
// The periodic half of enforcement. A login-only check leaves an obvious hole:
// sign in at the office, then go home and keep the session all day. This
// re-verifies position every ~10 minutes and ends the session when the user
// leaves their permitted area.
//
// Deliberately quiet for everyone it does not apply to. It asks the server
// once whether this account is fenced at all, and if not it never runs a timer
// and never touches the GPS — which matters on mobile, where waking the
// location hardware every few minutes for an answer nobody reads is a battery
// cost paid by the whole company to enforce a rule on a handful of people.

import { useEffect, useRef } from "react";
import geofenceApi from "../api/geofenceApi";
import { getCurrentCoordinates, getPermissionState } from "../utils/geolocation";

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

/**
 * @param {boolean}  isAuthenticated
 * @param {Function} onViolation  Called with a human-readable reason when the
 *                                session must end. The caller owns sign-out —
 *                                this hook does not reach into auth state.
 */
export default function useGeofenceWatch(isAuthenticated, onViolation) {
  // Held in a ref so a re-render with a new inline callback doesn't tear down
  // and restart the interval — which, with a 10-minute period and a parent
  // that re-renders on every route change, would mean the check effectively
  // never fires.
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let timerId = null;
    let cancelled = false;

    const runCheck = async () => {
      if (cancelled) return;

      // Never trigger a permission prompt from a background timer. If the user
      // has not already granted location, a prompt appearing minutes into a
      // session with no visible trigger is alarming and gets blocked on
      // reflex. They granted it at login to get in; if that has since been
      // revoked, the next login is where it gets resolved.
      const permission = await getPermissionState();
      if (permission === "denied") {
        onViolationRef.current?.(
          "Location access was turned off. Sign in again from an approved location to continue."
        );
        return;
      }
      if (permission === "prompt") return;

      let coordinates = null;
      try {
        coordinates = await getCurrentCoordinates({
          timeoutMs: 20000,
          // A fix up to two minutes old is fine here and saves a cold GPS lock
          // on every poll. Two minutes is far too short to have travelled out
          // of a fence and back undetected, but long enough that a user moving
          // around a building isn't re-locking the GPS constantly.
          maximumAgeMs: 120000,
        });
      } catch {
        // Inconclusive, not a violation. A momentary indoor signal loss must
        // not eject someone mid-task; the server is the one that decides, and
        // a missing fix simply means we cannot ask it this cycle.
        return;
      }

      if (cancelled) return;

      try {
        const result = await geofenceApi.verify(coordinates);
        if (cancelled) return;

        // `degraded` = the server hit an internal error and told us to
        // disregard this cycle. Explicitly fail-open — see verifySession.
        if (result.degraded) return;

        if (result.allowed === false) {
          onViolationRef.current?.(
            result.message || "You have left your permitted work location."
          );
        }
      } catch {
        // Network failure. Same reasoning: cannot conclude, so do not act.
      }
    };

    const start = async () => {
      let status;
      try {
        status = await geofenceApi.getMyStatus();
      } catch {
        // If we can't establish whether this user is fenced, don't guess. The
        // login door already enforced the rule to let them in at all.
        return;
      }

      if (cancelled || !status?.enforced) return;

      const interval = Number(status.recheckIntervalMs) || DEFAULT_INTERVAL_MS;
      timerId = setInterval(runCheck, interval);

      // No immediate first run: the login that created this session verified
      // position moments ago, so checking again now would just be a redundant
      // GPS wake.
    };

    start();

    return () => {
      cancelled = true;
      if (timerId) clearInterval(timerId);
    };
  }, [isAuthenticated]);
}
