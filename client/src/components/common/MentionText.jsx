import React from "react";
import PropTypes from "prop-types";
import { mentionRanges } from "../../utils/mentions";

/**
 * Wraps @mentions inside already-rendered text so they read as chips.
 *
 * Why it takes `children` rather than a raw string: message bodies go through
 * ReactMarkdown, so by the time we see them they're a tree of React nodes with
 * strings at the leaves. Highlighting the raw markdown source instead would
 * mean re-implementing the parser, and injecting HTML before markdown runs
 * would let a message containing markup style itself. This walks the rendered
 * children and only ever touches plain strings, so nothing a user types can
 * escape into markup.
 *
 * Matching lives in utils/mentions.js and is shared with the composer and
 * mirrored on the server, so what gets highlighted is exactly what got
 * notified — no message where the chip appears but the ping didn't happen.
 */
const MentionText = ({ children, members = [], currentUserId, isSelf = false }) => {
  const decorate = (node, keyPrefix) => {
    // Only plain strings are candidates. Elements are returned untouched so a
    // mention inside a code block or a link stays as the author wrote it.
    if (typeof node !== "string") return node;

    const ranges = mentionRanges(node, members, currentUserId);
    if (ranges.length === 0) return node;

    const out = [];
    let cursor = 0;

    ranges.forEach((range, i) => {
      if (range.start > cursor) out.push(node.slice(cursor, range.start));

      // Two levels of emphasis: any mention is visibly a mention, but one
      // aimed at you is louder, because that's the one you're scanning for.
      const chipClass = range.mentionsMe
        ? isSelf
          ? "bg-white/25 text-white font-semibold"
          : "bg-amber-100 text-amber-900 font-semibold dark:bg-amber-400/20 dark:text-amber-200"
        : isSelf
        ? "bg-white/15 text-white/95 font-medium"
        : "bg-blue-50 text-blue-700 font-medium dark:bg-blue-400/15 dark:text-blue-200";

      out.push(
        <span
          key={`${keyPrefix}-m${i}`}
          className={`rounded px-1 py-0.5 ${chipClass}`}
        >
          {node.slice(range.start, range.end)}
        </span>
      );

      cursor = range.end;
    });

    if (cursor < node.length) out.push(node.slice(cursor));

    return out;
  };

  return <>{React.Children.map(children, (child, i) => decorate(child, i))}</>;
};

MentionText.propTypes = {
  children: PropTypes.node,
  members: PropTypes.array,
  currentUserId: PropTypes.string,
  isSelf: PropTypes.bool,
};

export default MentionText;
