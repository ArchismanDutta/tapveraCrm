import { useEffect, useRef, useCallback } from "react";
import { useWebSocketContext } from "../contexts/WebSocketContext";

/**
 * Delivery + read receipts for an open thread (S1).
 *
 * ─── THE DISTINCTION THAT MATTERS ───
 * DELIVERED is automatic: the message reached this device, so we ack it the
 * moment it lands in the store, whatever the user is doing. It says nothing
 * about whether anyone saw it.
 *
 * READ requires three things to be simultaneously true:
 *   1. this thread is open,
 *   2. the WINDOW is focused — a thread sitting in a background tab is not
 *      being read, and marking it so is the fastest way to make read receipts
 *      untrustworthy,
 *   3. the newest message is actually on screen — scrolled up through history
 *      is not reading the latest.
 *
 * Conflating the two is the classic way this feature ships broken: blue ticks
 * on messages nobody looked at.
 *
 * ─── READ IS A CURSOR ───
 * We send one `upToMessageId` when the view settles, not an event per visible
 * row. A glance at a busy thread would otherwise be dozens of round trips.
 * Debounced, and never sends the same cursor twice.
 *
 * @param {object}  args
 * @param {string}  args.scope
 * @param {string}  args.threadId
 * @param {Array}   args.messages       oldest-first, from the store
 * @param {string}  args.currentUserId
 * @param {boolean} args.atBottom       is the newest message on screen?
 */
export default function useReceipts({ scope, threadId, messages, currentUserId, atBottom = true }) {
  const { isConnected, ackDelivered, sendReadCursor: emitReadCursor } = useWebSocketContext();

  const ackedRef = useRef(new Set());   // message ids already acked as delivered
  const lastReadRef = useRef(null);     // last cursor we sent
  const readTimerRef = useRef(null);

  // Switching threads resets both — the sets are per-thread, and carrying them
  // over would suppress acks for the newly-opened one.
  useEffect(() => {
    ackedRef.current = new Set();
    lastReadRef.current = null;
  }, [scope, threadId]);

  /* ── Delivered: automatic ───────────────────────────────────────────── */

  useEffect(() => {
    if (!isConnected || !threadId || !messages?.length) return;

    const unacked = messages
      .filter((m) => {
        const id = String(m.id ?? m._id ?? "");
        if (!id || ackedRef.current.has(id)) return false;
        // Never ack your own message: doing so would flip a DM to ✓✓ the
        // instant it was sent, regardless of the recipient. The server filters
        // this too — belt and braces, because the cost of being wrong is a
        // permanently misleading tick.
        const senderId = String(m.sender?.id ?? m.senderId ?? m.sentBy?._id ?? m.sentBy ?? "");
        return senderId !== String(currentUserId);
      })
      .map((m) => String(m.id ?? m._id));

    if (!unacked.length) return;
    unacked.forEach((id) => ackedRef.current.add(id));
    ackDelivered(scope, threadId, unacked);
  }, [isConnected, ackDelivered, scope, threadId, messages, currentUserId]);

  /* ── Read: only when genuinely visible ──────────────────────────────── */

  const sendReadCursor = useCallback(() => {
    if (!isConnected || !threadId || !messages?.length) return;
    if (!document.hasFocus() || !atBottom) return;

    const newest = messages[messages.length - 1];
    const id = String(newest?.id ?? newest?._id ?? "");
    if (!id || id === lastReadRef.current) return;

    lastReadRef.current = id;
    emitReadCursor(scope, threadId, id);
  }, [isConnected, emitReadCursor, scope, threadId, messages, atBottom]);

  // Debounced so a fast scroll or a burst of arrivals sends one cursor, not one
  // per frame.
  useEffect(() => {
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(sendReadCursor, 500);
    return () => clearTimeout(readTimerRef.current);
  }, [sendReadCursor]);

  // Returning to the tab is the moment a backgrounded thread becomes read.
  useEffect(() => {
    const onFocus = () => sendReadCursor();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [sendReadCursor]);
}
