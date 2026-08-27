import React from "react";
import PropTypes from "prop-types";
import { Ban } from "lucide-react";

/**
 * What a retracted message looks like.
 *
 * ─── WHY THE ROW STAYS ───
 * The document is tombstoned rather than removed, so replies pointing at it
 * still resolve, read cursors still address something real, and the thread
 * does not silently renumber for anyone paging through it. Showing the gap is
 * also the honest thing: a message vanishing without trace reads as a bug, and
 * in a thread with a client in it, leaves people wondering what they missed.
 *
 * Italic and muted, with no author styling of its own — it is a marker, not a
 * message, and should not look like one.
 */
const DeletedMessageBubble = ({ own = false }) => (
  <span
    className={`inline-flex items-center gap-1.5 text-sm italic ${
      own ? "text-white/70" : "text-slate-400 dark:text-slate-500"
    }`}
  >
    <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    This message was deleted
  </span>
);

DeletedMessageBubble.propTypes = {
  /** Sender's own bubble — coloured, so the muted tone has to differ. */
  own: PropTypes.bool,
};

export default DeletedMessageBubble;
