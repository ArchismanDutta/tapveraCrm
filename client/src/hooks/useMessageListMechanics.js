import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The mechanics that make a message list feel right (S5).
 *
 * Four behaviours, all of which are invisible when correct and obvious when
 * missing:
 *
 * 1. SCROLL ANCHORING when older messages are prepended. Without it, loading
 *    history yanks the viewport — you were reading a message, you scroll up,
 *    and suddenly you're somewhere else entirely. Fixed by capturing
 *    scrollHeight before the prepend and restoring the delta after, in a
 *    LAYOUT effect (see below).
 *
 * 2. STICK TO BOTTOM only when already at the bottom. Auto-scrolling on every
 *    new message would drag you away from history you're reading.
 *
 * 3. JUMP-TO-LATEST once scrolled away, with a count of what arrived since.
 *
 * 4. UNREAD DIVIDER position, frozen on open. Recomputing it as the user reads
 *    would slide it down the screen — it has to stay put until they leave.
 *
 * @param {object} args
 * @param {Array}  args.messages       oldest-first
 * @param {string} args.threadId       resets everything on change
 * @param {number} args.unreadCount    unread on open, for the divider
 * @param {string} args.currentUserId
 */
export default function useMessageListMechanics({
  messages = [],
  threadId,
  unreadCount = 0,
  currentUserId,
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  const [atBottom, setAtBottom] = useState(true);
  const [newSinceScroll, setNewSinceScroll] = useState(0);

  // Divider position, frozen at open — see behaviour 4.
  const [unreadDividerId, setUnreadDividerId] = useState(null);

  const prevLenRef = useRef(0);
  const prevFirstIdRef = useRef(null);
  const anchorRef = useRef(null);
  const dividerSetForThread = useRef(null);

  const idOf = (m) => String(m?.id ?? m?._id ?? "");

  /* ── 1. Anchoring on prepend ──────────────────────────────────────── */

  // Captured BEFORE React paints, so the measurement matches what is currently
  // on screen rather than the already-updated DOM.
  const firstId = idOf(messages[0]);
  if (
    containerRef.current &&
    messages.length > prevLenRef.current &&
    firstId &&
    prevFirstIdRef.current &&
    firstId !== prevFirstIdRef.current
  ) {
    // The list grew AND its first element changed => history was prepended.
    anchorRef.current = {
      height: containerRef.current.scrollHeight,
      top: containerRef.current.scrollTop,
    };
  }

  // useLayoutEffect, not useEffect: this must run BEFORE the browser paints.
  // In a passive effect the user sees one frame of the jumped position, which
  // reads as a flicker every time older messages load.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (anchorRef.current) {
      const { height, top } = anchorRef.current;
      el.scrollTop = top + (el.scrollHeight - height);
      anchorRef.current = null;
    }

    prevLenRef.current = messages.length;
    prevFirstIdRef.current = idOf(messages[0]);
  }, [messages]);

  /* ── 2 & 3. Stick to bottom / count what arrived ──────────────────── */

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    // 40px of slack so sub-pixel rounding doesn't flip the state.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAtBottom(nearBottom);
    if (nearBottom) setNewSinceScroll(0);
  }, []);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setNewSinceScroll(0);
    setAtBottom(true);
  }, []);

  const lastLenRef = useRef(0);
  useEffect(() => {
    const grew = messages.length - lastLenRef.current;
    lastLenRef.current = messages.length;
    if (grew <= 0) return;

    const newest = messages[messages.length - 1];
    const isMine =
      String(newest?.sender?.id ?? newest?.senderId ?? newest?.sentBy?._id ?? newest?.sentBy ?? "") ===
      String(currentUserId);

    // Your own message always scrolls into view — you just sent it, and not
    // following it looks broken.
    if (atBottom || isMine) {
      // Instant, not smooth: a smooth scroll per message in a busy thread
      // queues up animations and the list visibly lags behind.
      requestAnimationFrame(() => scrollToBottom("auto"));
    } else {
      setNewSinceScroll((n) => n + grew);
    }
    // `atBottom` deliberately excluded: including it re-runs this on every
    // scroll, double-counting arrivals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, currentUserId, scrollToBottom]);

  /* ── 4. Unread divider, frozen on open ────────────────────────────── */

  useEffect(() => {
    // Reset when the thread changes.
    if (dividerSetForThread.current !== threadId) {
      dividerSetForThread.current = null;
      setUnreadDividerId(null);
    }

    if (dividerSetForThread.current === threadId) return; // already placed
    if (!messages.length) return;

    if (unreadCount > 0 && unreadCount <= messages.length) {
      // The first unread is `unreadCount` from the end.
      const idx = messages.length - unreadCount;
      const first = messages[idx];
      if (first) {
        setUnreadDividerId(idOf(first));
        dividerSetForThread.current = threadId;
      }
    } else if (unreadCount === 0) {
      // Nothing unread: mark this thread handled so a message arriving while
      // it is open doesn't suddenly inject a divider mid-read.
      dividerSetForThread.current = threadId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages.length, unreadCount]);

  /* ── Reset on thread change ───────────────────────────────────────── */

  useEffect(() => {
    setAtBottom(true);
    setNewSinceScroll(0);
    prevLenRef.current = 0;
    prevFirstIdRef.current = null;
    lastLenRef.current = 0;
    anchorRef.current = null;
    // Land at the newest message, without animating through the whole history.
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [threadId, scrollToBottom]);

  return {
    containerRef,
    bottomRef,
    onScroll,
    atBottom,
    newSinceScroll,
    scrollToBottom,
    unreadDividerId,
  };
}

/**
 * Should this message show its own avatar/header, or is it a continuation of
 * the previous one?
 *
 * Consecutive messages from the same sender within 5 minutes collapse into one
 * visual block — the difference between a chat that reads as conversation and
 * one that reads as a log file.
 */
export function startsGroup(message, previous, windowMs = 5 * 60 * 1000) {
  if (!previous) return true;

  const senderOf = (m) =>
    String(m?.sender?.id ?? m?.senderId ?? m?.sentBy?._id ?? m?.sentBy ?? "");
  if (senderOf(message) !== senderOf(previous)) return true;

  const timeOf = (m) => new Date(m?.createdAt ?? m?.timestamp ?? 0).getTime();
  const gap = timeOf(message) - timeOf(previous);
  return !Number.isFinite(gap) || gap > windowMs;
}
