import React, { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { useWebSocketContext } from "../../contexts/WebSocketContext";
import { selectPresence, selectOnlineCount, formatLastSeen } from "../../store/slices/presenceSlice";

/**
 * Online / last-seen line for a thread header.
 *
 * Subscribes to presence for the thread's members on mount and unsubscribes on
 * unmount, so a user watching one conversation isn't fanned out presence for
 * every person in the system.
 *
 * ─── WHAT IT DELIBERATELY DOESN'T RENDER ───
 * Nothing, when there is nothing honest to say. A user who has hidden their
 * presence, or one we have no data for yet, renders as empty — NOT as
 * "offline". Showing "offline" for someone who opted out would leak exactly the
 * signal they turned off, and showing it before the snapshot arrives makes
 * everyone look offline for the first second after opening a thread.
 *
 * @param {Array}  members       [{ _id, name }]
 * @param {string} currentUserId excluded — your own presence is not news
 * @param {boolean} isGroup      groups show a count, DMs show one person
 */
export default function PresenceIndicator({ members = [], currentUserId, isGroup = false }) {
  const { watchPresence, unwatchPresence } = useWebSocketContext();

  const otherIds = useMemo(
    () =>
      (members || [])
        .map((m) => String(m?._id ?? m))
        .filter((id) => id && id !== String(currentUserId)),
    [members, currentUserId]
  );

  useEffect(() => {
    if (otherIds.length === 0) return undefined;
    watchPresence(otherIds);
    return () => unwatchPresence(otherIds);
    // Joined key so a re-render with an equivalent array doesn't re-subscribe.
  }, [otherIds.join(","), watchPresence, unwatchPresence]); // eslint-disable-line react-hooks/exhaustive-deps

  const onlineCount = useSelector(selectOnlineCount(otherIds));
  const solo = useSelector(selectPresence(otherIds[0]));

  if (otherIds.length === 0) return null;

  if (isGroup) {
    if (onlineCount === 0) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {onlineCount} online
      </span>
    );
  }

  if (solo.online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Online
      </span>
    );
  }

  const lastSeen = formatLastSeen(solo);
  if (!lastSeen) return null;

  return (
    <span className="text-xs text-slate-500 dark:text-slate-400">{lastSeen}</span>
  );
}
