import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Per-thread composer draft (S5).
 *
 * Switching conversations mid-sentence and coming back to an empty box is a
 * small thing that feels careless. Drafts are kept per thread and restored on
 * return.
 *
 * ─── STORAGE CHOICE ───
 * `localStorage`, deliberately, unlike the outbox (S2) which uses IndexedDB.
 * A draft is a short string, written on a debounce, read once per thread open —
 * none of the three reasons that ruled localStorage out for the outbox apply
 * (no File blobs, no multi-MB payloads, no write on the critical send path).
 * Using IndexedDB here would be ceremony for no benefit.
 *
 * Drafts are namespaced per user so a shared machine doesn't leak half-typed
 * messages between accounts on logout.
 */
const PREFIX = "tapvera_draft";
const DEBOUNCE_MS = 400;

const keyFor = (scope, threadId, userId) =>
  `${PREFIX}:${userId || "anon"}:${scope}:${threadId}`;

export default function useDraft({ scope, threadId, userId }) {
  const [draft, setDraft] = useState("");
  const timerRef = useRef(null);
  const keyRef = useRef(null);

  // Load on thread change.
  useEffect(() => {
    if (!threadId) {
      setDraft("");
      return;
    }
    const key = keyFor(scope, threadId, userId);
    keyRef.current = key;
    try {
      setDraft(localStorage.getItem(key) || "");
    } catch {
      setDraft("");
    }
  }, [scope, threadId, userId]);

  // Persist on a debounce — writing per keystroke is pointless churn.
  const update = useCallback(
    (value) => {
      setDraft(value);
      if (!keyRef.current) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      const key = keyRef.current;
      timerRef.current = setTimeout(() => {
        try {
          if (value) localStorage.setItem(key, value);
          else localStorage.removeItem(key);
        } catch {
          /* private mode / quota — a lost draft is not worth breaking typing over */
        }
      }, DEBOUNCE_MS);
    },
    []
  );

  /** Called after a successful send. Clears immediately, not on the debounce —
   *  otherwise a fast thread switch can re-save the text that was just sent. */
  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setDraft("");
    try {
      if (keyRef.current) localStorage.removeItem(keyRef.current);
    } catch {
      /* ignore */
    }
  }, []);

  // Flush on unmount so navigating away mid-sentence still saves.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { draft, setDraft: update, clearDraft };
}

/** Remove every stored draft. Call on logout. */
export function clearAllDrafts() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(`${PREFIX}:`))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
