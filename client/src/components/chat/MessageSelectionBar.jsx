import React from "react";
import PropTypes from "prop-types";
import { CheckSquare, Forward } from "lucide-react";

/**
 * The "N selected — Cancel / Forward" strip shown above a thread while
 * selection mode is on.
 *
 * Shared by all three message surfaces. `accent` exists because the chat page
 * and the project surfaces are deliberately themed apart — blue for chat, teal
 * for project — and a shared bar that ignored that would be the one element on
 * the screen wearing the wrong colour.
 */
const ACCENTS = {
  blue: {
    wrap: "border-blue-200 bg-blue-50 dark:border-blue-400/20 dark:bg-blue-400/10",
    label: "text-blue-800 dark:text-blue-200",
    action: "bg-blue-600 hover:bg-blue-700",
  },
  teal: {
    wrap: "border-teal-200 bg-teal-50 dark:border-teal-400/20 dark:bg-teal-400/10",
    label: "text-teal-800 dark:text-teal-200",
    action: "bg-teal-600 hover:bg-teal-700",
  },
};

const MessageSelectionBar = ({ count, onCancel, onForward, accent = "blue" }) => {
  const c = ACCENTS[accent] || ACCENTS.blue;

  return (
    <div className={`flex items-center justify-between gap-3 border-b px-4 py-2 ${c.wrap}`}>
      <span className={`inline-flex items-center gap-2 text-sm font-medium ${c.label}`}>
        <CheckSquare className="h-4 w-4" />
        {count} selected
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onForward}
          disabled={count === 0}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${c.action}`}
        >
          <Forward className="h-3.5 w-3.5" />
          Forward
        </button>
      </div>
    </div>
  );
};

MessageSelectionBar.propTypes = {
  count: PropTypes.number.isRequired,
  onCancel: PropTypes.func.isRequired,
  onForward: PropTypes.func.isRequired,
  accent: PropTypes.oneOf(["blue", "teal"]),
};

export default MessageSelectionBar;
