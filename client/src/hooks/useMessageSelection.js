import { useCallback, useMemo, useState } from "react";

/**
 * Multi-select over a message list, for forwarding.
 *
 * ─── WHY THIS IS A HOOK ───
 * Three surfaces render a message thread — ChatWindow, ProjectMessagePanel
 * (the employee portal) and the Chat tab inside ProjectDetailPage (the admin
 * view) — and all three now offer forwarding. The selection logic is identical
 * in all three and the failure modes are subtle (see `canSelect` below), so it
 * lives here once rather than being copied and then drifting.
 *
 * ─── THE ONE RULE THAT MATTERS ───
 * A message that the server has never seen cannot be forwarded, because there
 * is no id to forward it BY. Optimistic rows carry `id: null` until the send
 * lands, and a FAILED send never gets one at all. Selecting one used to send a
 * client-side placeholder to the server, where it became a CastError and came
 * back as an opaque 500. `canSelect` is the guard, and callers use it to grey
 * the row out rather than letting it be ticked and then fail.
 */
export default function useMessageSelection() {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [forwardOpen, setForwardOpen] = useState(false);

  /** Does this message have a real server id yet? */
  const canSelect = useCallback(
    (msg) => Boolean(msg?.messageId || msg?._id || msg?.id),
    []
  );

  /** The server id to forward by, or null while the send is still in flight. */
  const idOf = useCallback((msg) => {
    const id = msg?.messageId || msg?._id || msg?.id;
    return id ? String(id) : null;
  }, []);

  const toggle = useCallback((id) => {
    if (!id) return;
    const key = String(id);
    setSelectedIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }, []);

  const isSelected = useCallback(
    (id) => Boolean(id) && selectedIds.includes(String(id)),
    [selectedIds]
  );

  /**
   * Enter selection mode with one message already ticked — the common case is
   * forwarding the message whose Forward button you just pressed.
   */
  const start = useCallback((id) => {
    setSelecting(true);
    setSelectedIds(id ? [String(id)] : []);
  }, []);

  const exit = useCallback(() => {
    setSelecting(false);
    setSelectedIds([]);
    setForwardOpen(false);
  }, []);

  const openForward = useCallback(() => setForwardOpen(true), []);
  const closeForward = useCallback(() => setForwardOpen(false), []);

  return useMemo(
    () => ({
      selecting,
      selectedIds,
      canSelect,
      idOf,
      isSelected,
      toggle,
      start,
      exit,
      forwardOpen,
      openForward,
      closeForward,
    }),
    [
      selecting,
      selectedIds,
      canSelect,
      idOf,
      isSelected,
      toggle,
      start,
      exit,
      forwardOpen,
      openForward,
      closeForward,
    ]
  );
}
