// utils/mentions.js
//
// Finding @mentions in a line of chat text.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS ISN'T A REGEX
// ─────────────────────────────────────────────────────────────────────────────
//
// It used to be, on both sides:
//
//     /@(\w+(?:\s+\w+)*)/g
//
// which has to allow spaces (people have surnames — "@Sahil Kumar"), and once
// it does, nothing tells it where the name stops. "@Anish please review this"
// captured the name as "Anish please review this", matched no user, and the
// mention was silently dropped. In practice the feature only worked when the
// mention was the last thing in the message, which is why it looked like it
// didn't exist.
//
// No regex can fix that on its own: "Sahil Kumar" is two words of a name and
// "please review" is two words that aren't, and the text alone can't tell you
// which is which. You need the candidate list. So we match against the actual
// members of the conversation instead — longest name first, masking each match
// so a member called "Sahil" can't also match inside "@Sahil Kumar".
//
// server/controllers/chatController.js holds the mirror of this logic (it can't
// import from the client bundle). The two must agree: this one drives what the
// composer highlights and sends, that one is the authority on who gets
// notified. If you change the rules here, change them there.

/** Mention token that targets every member of the conversation. */
export const EVERYONE_TOKEN = "everyone";

/** Sentinel used in the mention dropdown; not a real user. */
export const EVERYONE_OPTION = {
  _id: "__everyone__",
  name: EVERYONE_TOKEN,
  isEveryone: true,
};

// A mention ends at the end of the string or at a character that can't be part
// of a name. Punctuation counts as a terminator so "@Anish, thoughts?" works.
const isNameChar = (ch) => ch !== undefined && /[\w']/.test(ch);

// A mention starts at the beginning or after whitespace, so an email address
// like "ops@Anish.com" is not read as a mention of Anish.
const isBoundaryBefore = (ch) => ch === undefined || /\s/.test(ch);

/**
 * Which of `candidates` are mentioned in `text`.
 *
 * @param {string} text
 * @param {Array<{_id: string, name: string}>} candidates
 * @returns {Array} the matched candidate objects, in the order they appear
 */
export const findMentions = (text, candidates = []) => {
  if (!text || !text.includes("@") || candidates.length === 0) return [];

  const lower = text.toLowerCase();

  // Mask tracks which characters have already been claimed by a longer name,
  // so overlapping candidates ("Sahil" vs "Sahil Kumar") can't both match the
  // same span. Without it, mentioning "@Sahil Kumar" would also notify Sahil.
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

      // Whole-token match only: "@Ann" must not match inside "@Anna".
      if (isNameChar(lower[end])) continue;
      if (!isBoundaryBefore(lower[idx - 1])) continue;

      // Already inside a longer name we matched earlier.
      let overlaps = false;
      for (let i = idx; i < end; i += 1) {
        if (claimed[i]) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      for (let i = idx; i < end; i += 1) claimed[i] = true;
      hits.push({ candidate, at: idx });
      break; // one hit per person is enough — mentioning twice isn't two pings
    }
  }

  return hits.sort((a, b) => a.at - b.at).map((h) => h.candidate);
};

/**
 * The list to offer in the composer's @ dropdown.
 * Excludes the current user — mentioning yourself does nothing — and puts
 * @everyone at the top, matching how Slack and WhatsApp surface it.
 */
export const mentionCandidates = (members = [], currentUserId) => {
  const people = (members || []).filter(
    (m) => m?._id && String(m._id) !== String(currentUserId)
  );
  return [EVERYONE_OPTION, ...people];
};

/**
 * Resolve a message's mentions to real user ids.
 * @everyone expands to every member except the author, so the author never
 * notifies themselves.
 */
export const resolveMentionedUserIds = (text, members, authorId) => {
  const matched = findMentions(text, mentionCandidates(members, authorId));

  const ids = new Set();
  for (const m of matched) {
    if (m.isEveryone) {
      for (const member of members || []) {
        if (member?._id && String(member._id) !== String(authorId)) {
          ids.add(String(member._id));
        }
      }
    } else {
      ids.add(String(m._id));
    }
  }
  return [...ids];
};

/**
 * Character ranges of every mention in `text`, for highlighting.
 * @returns {Array<{start, end, name, isEveryone, mentionsMe}>}
 */
export const mentionRanges = (text, members = [], currentUserId) => {
  const candidates = [EVERYONE_OPTION, ...(members || []).filter((m) => m?._id)];
  const matched = findMentions(text, candidates);
  if (matched.length === 0) return [];

  const lower = (text || "").toLowerCase();
  const ranges = [];
  const used = new Array(text.length).fill(false);

  for (const c of matched) {
    const needle = `@${c.name.toLowerCase()}`;
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(needle, from);
      if (idx === -1) break;
      from = idx + 1;
      if (used.slice(idx, idx + needle.length).some(Boolean)) continue;
      for (let i = idx; i < idx + needle.length; i += 1) used[i] = true;
      ranges.push({
        start: idx,
        end: idx + needle.length,
        name: c.name,
        isEveryone: !!c.isEveryone,
        mentionsMe:
          !!c.isEveryone || String(c._id) === String(currentUserId),
      });
      break;
    }
  }

  return ranges.sort((a, b) => a.start - b.start);
};

/** Does this message mention the current user (directly or via @everyone)? */
export const messageMentionsUser = (text, members, currentUserId) => {
  if (!currentUserId) return false;
  return mentionRanges(text, members, currentUserId).some((r) => r.mentionsMe);
};
