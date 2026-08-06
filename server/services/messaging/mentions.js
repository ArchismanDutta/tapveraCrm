// services/messaging/mentions.js
//
// @mention resolution, shared by both thread scopes.
//
// ─── WHY THIS IS SHARED ───
// There were two implementations. The chat one (controllers/chatController.js)
// is correct and hard-won — see the long comment preserved below. The project
// one (routes/projectRoutes.js `parseMentionsFromMessage`) was still the naive
// version chat had already abandoned:
//
//     /@(\w+(?:\s+\w+)*)/g
//
// It has two independent bugs:
//   1. It can't tell where a name ends, so "@Anish please review this" captured
//      "Anish please review this", matched nobody, and silently dropped the
//      mention. Mentions only worked when they were the last thing in the
//      message.
//   2. It searched User/Client GLOBALLY rather than within the thread, so
//      "@John" could notify a John who has nothing to do with the project.
//
// Porting that into the new service layer would have baked both bugs in, so
// this module is the chat implementation, generalized over a candidate list
// that either scope supplies.
'use strict';

/** Mention token that targets every member of the thread. */
const EVERYONE_TOKEN = 'everyone';

const isNameChar = (ch) => ch !== undefined && /[\w']/.test(ch);
const isBoundaryBefore = (ch) => ch === undefined || /\s/.test(ch);

/**
 * Which of `candidates` are mentioned in `text`. Mirror of
 * client/src/utils/mentions.js findMentions — keep the two in step.
 *
 * ─── WHY THIS ISN'T A REGEX ───
 * It used to be. A regex has to allow spaces, because people have surnames
 * ("@Sahil Kumar"), and once it does, nothing tells it where the name ends.
 *
 * No regex fixes that alone: "Sahil Kumar" is two words of a name and "please
 * review" is two words that aren't, and the text can't tell you which is which.
 * You need the candidate list, matched longest-first with matched spans masked
 * off so a member called "Sahil" can't also match inside "@Sahil Kumar".
 *
 * @param {string} text
 * @param {Array<{_id: any, name: string, isEveryone?: boolean}>} candidates
 * @returns {Array} the matched candidate objects, in order of appearance
 */
function findMentionedCandidates(text, candidates) {
  if (!text || !text.includes('@') || !candidates?.length) return [];

  const lower = text.toLowerCase();
  const claimed = new Array(text.length).fill(false);
  const byLongestName = [...candidates]
    .filter((c) => c?.name)
    .sort((a, b) => b.name.length - a.name.length);

  const hits = [];

  for (const candidate of byLongestName) {
    const needle = `@${candidate.name.toLowerCase()}`;
    let from = 0;

    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      from = idx + 1;

      const end = idx + needle.length;
      if (isNameChar(lower[end])) continue;
      if (!isBoundaryBefore(lower[idx - 1])) continue;

      let overlaps = false;
      for (let i = idx; i < end; i += 1) {
        if (claimed[i]) { overlaps = true; break; }
      }
      if (overlaps) continue;

      for (let i = idx; i < end; i += 1) claimed[i] = true;
      hits.push({ candidate, at: idx });
      break; // one hit per person — mentioning twice isn't two pings
    }
  }

  return hits.sort((a, b) => a.at - b.at).map((h) => h.candidate);
}

/**
 * Resolve @mentions against a thread's own members.
 *
 * @param {string} text
 * @param {object} args
 * @param {Array<{_id, name, kind}>} args.members  thread members (excluding
 *                                                 nobody — the author is
 *                                                 filtered here)
 * @param {string} args.authorId
 * @returns {Array<{id, kind}>}  matched members; @everyone expands to all
 *                               members except the author
 */
function resolveMentions(text, { members = [], authorId } = {}) {
  if (!text || !text.includes('@') || members.length === 0) return [];

  const others = members.filter((m) => String(m._id) !== String(authorId));

  const candidates = [
    { _id: EVERYONE_TOKEN, name: EVERYONE_TOKEN, isEveryone: true },
    ...others,
  ];

  const matched = findMentionedCandidates(text, candidates);

  const out = new Map();
  for (const m of matched) {
    if (m.isEveryone) {
      others.forEach((o) => out.set(String(o._id), { id: String(o._id), kind: o.kind || 'User' }));
    } else {
      out.set(String(m._id), { id: String(m._id), kind: m.kind || 'User' });
    }
  }

  return [...out.values()];
}

module.exports = { EVERYONE_TOKEN, findMentionedCandidates, resolveMentions };
