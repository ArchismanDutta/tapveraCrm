import React from "react";

/**
 * "N unread messages" separator, injected at the read cursor when a thread
 * opens (S5).
 *
 * Its position is frozen by useMessageListMechanics at open and does not move
 * while the user reads. Recomputing it live would slide it down the screen as
 * messages are marked read — the one thing it exists to avoid, since its job is
 * to mark *where you left off*.
 *
 * @param {number} count
 */
export default function UnreadDivider({ count = 0 }) {
  if (count <= 0) return null;

  return (
    <div className="my-3 flex items-center gap-3" role="separator">
      <div className="h-px flex-1 bg-rose-300 dark:bg-rose-500/40" />
      <span className="rounded-full bg-rose-50 px-3 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
        {count === 1 ? "1 unread message" : `${count} unread messages`}
      </span>
      <div className="h-px flex-1 bg-rose-300 dark:bg-rose-500/40" />
    </div>
  );
}
