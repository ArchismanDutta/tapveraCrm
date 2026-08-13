import { useCallback, useEffect, useRef, useState } from "react";
import API from "../api";

/**
 * Polls for callbacks that should be ringing, and keeps the alarm sounding.
 *
 * ─── WHY POLLING, NOT A SOCKET EVENT ───
 * The trigger here is the passage of time, not something the server decides to
 * tell us. A socket event fired at the due moment only reaches an agent who is
 * connected and looking at that exact second — anyone mid-call, on another
 * page, or with the tab shut misses it permanently. Because the server derives
 * due-ness from stored state (see services/callbackAlarmService.js), a poll
 * gives all the properties an alarm actually needs: it survives a refresh,
 * appears in every open tab, and is still waiting when the agent comes back.
 *
 * ─── SOUND ───
 * Repeated on an interval rather than played once. A single chime at the exact
 * moment someone stepped away is indistinguishable from no alarm at all, which
 * defeats the point. Browsers block audio until the user has interacted with
 * the page at least once, so a first-load alarm may be silent — the visual
 * alarm is therefore the primary channel and sound is reinforcement, never the
 * only signal.
 */

const POLL_MS = 30 * 1000;
const CHIME_MS = 4 * 1000;

export default function useCallbackAlarms({ enabled = true } = {}) {
  const [ringing, setRinging] = useState([]);
  const [headsUp, setHeadsUp] = useState([]);

  // Polling reads this to avoid clobbering an alarm the user is mid-way
  // through acting on — a refresh landing between "click snooze" and "server
  // confirms" would otherwise put the alarm straight back on screen.
  const actingRef = useRef(new Set());
  const chimeRef = useRef(null);

  const fetchAlarms = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data } = await API.get("/api/callbacks/alarms");
      const busy = actingRef.current;
      setRinging((data?.ringing || []).filter((c) => !busy.has(c._id)));
      setHeadsUp(data?.headsUp || []);
    } catch (error) {
      // Silent by design: a failed poll is transient and the next one is 30s
      // away. Surfacing it would put an error toast on screen every half
      // minute for the duration of any backend blip.
      console.debug?.("[callback-alarm] poll failed:", error?.message);
    }
  }, [enabled]);

  /* ── Poll ───────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return undefined;
    fetchAlarms();
    const id = setInterval(fetchAlarms, POLL_MS);

    // Returning to the tab is the moment a stale view most needs correcting —
    // an alarm may have come due during the minutes it sat in the background.
    const onVisible = () => document.visibilityState === "visible" && fetchAlarms();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, fetchAlarms]);

  /* ── Sustained chime ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!ringing.length) {
      if (chimeRef.current) {
        clearInterval(chimeRef.current);
        chimeRef.current = null;
      }
      return undefined;
    }

    if (chimeRef.current) return undefined; // already sounding

    let cancelled = false;
    const play = async () => {
      if (cancelled) return;
      try {
        const { audioManager } = await import("../utils/audioManager");
        await audioManager.playNotificationSound();
      } catch {
        // No audio (blocked, unsupported, private mode). The visual alarm
        // stands on its own — this is deliberately not surfaced as an error.
      }
    };

    play();
    chimeRef.current = setInterval(play, CHIME_MS);

    return () => {
      cancelled = true;
      if (chimeRef.current) {
        clearInterval(chimeRef.current);
        chimeRef.current = null;
      }
    };
  }, [ringing.length]);

  /* ── Actions ────────────────────────────────────────────────────────── */

  /**
   * Remove locally first, then confirm with the server.
   *
   * The optimistic order matters: an alarm is loud and modal, so leaving it on
   * screen for a network round trip after the user has clearly dealt with it
   * reads as an unresponsive app. `actingRef` holds the id so an in-flight
   * poll can't resurrect it, and a failure restores it rather than dropping it
   * silently.
   */
  const act = useCallback(
    async (callbackId, request) => {
      const id = String(callbackId);
      actingRef.current.add(id);
      const previous = ringing;
      setRinging((rows) => rows.filter((r) => r._id !== id));

      try {
        await request();
      } catch (error) {
        console.error("[callback-alarm] action failed:", error);
        setRinging(previous);
        throw error;
      } finally {
        actingRef.current.delete(id);
      }
    },
    [ringing]
  );

  const snooze = useCallback(
    (callbackId, minutes) =>
      act(callbackId, () =>
        API.post(`/api/callbacks/${callbackId}/snooze`, { minutes })
      ),
    [act]
  );

  const dismiss = useCallback(
    (callbackId) =>
      act(callbackId, () => API.post(`/api/callbacks/${callbackId}/dismiss-alarm`)),
    [act]
  );

  /**
   * Acknowledge the heads-up toasts so they fire once rather than on every
   * poll for the whole five-minute window.
   */
  const acknowledgeHeadsUp = useCallback(async (ids) => {
    const callbackIds = (ids || []).map(String).filter(Boolean);
    if (!callbackIds.length) return;
    setHeadsUp((rows) => rows.filter((r) => !callbackIds.includes(r._id)));
    try {
      await API.post("/api/callbacks/alarms/heads-up-shown", { callbackIds });
    } catch (error) {
      console.debug?.("[callback-alarm] heads-up ack failed:", error?.message);
    }
  }, []);

  return { ringing, headsUp, snooze, dismiss, acknowledgeHeadsUp, refresh: fetchAlarms };
}
