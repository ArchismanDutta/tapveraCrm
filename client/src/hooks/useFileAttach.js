import { useCallback, useEffect, useRef, useState } from "react";

/* ── Pure helpers ─────────────────────────────────────────────────────────
 * Exported and kept free of React so they can be unit-tested directly — the
 * capacity arithmetic and the folder/filename edge cases are where the bugs
 * would actually live, and testing them through a rendered component would
 * need a DOM renderer this project doesn't currently install.
 */

/**
 * Decide how many of `incoming` can be staged, and what (if anything) to tell
 * the user.
 *
 * Partial acceptance is deliberate: dropping six files with one slot left
 * attaches the first and explains, rather than rejecting all six and making
 * the user redo the drop.
 *
 * @returns {{ accepted: File[], notice: string|null }}
 */
export function planAttachment({ current = 0, incoming = [], maxFiles = 5 }) {
  const files = Array.from(incoming || []).filter(Boolean);
  if (!files.length) return { accepted: [], notice: null };

  const room = maxFiles - current;
  if (room <= 0) {
    return { accepted: [], notice: `You can attach at most ${maxFiles} files.` };
  }

  const accepted = files.slice(0, room);
  return {
    accepted,
    notice:
      accepted.length < files.length
        ? `Only ${accepted.length} of ${files.length} files were attached — the limit is ${maxFiles}.`
        : null,
  };
}

/**
 * Did this drop contain a directory?
 *
 * The distinction is only visible through `webkitGetAsEntry()`. In
 * `DataTransfer.files` a folder appears as a zero-byte entry indistinguishable
 * from an empty file, so checking there would either miss folders or reject
 * legitimate empty files.
 */
export function hasDirectory(items = []) {
  return Array.from(items || []).some((item) => {
    if (!item || item.kind !== "file") return false;
    if (typeof item.webkitGetAsEntry !== "function") return false;
    return item.webkitGetAsEntry()?.isDirectory === true;
  });
}

/**
 * Give a pasted screenshot a unique, meaningful name.
 *
 * The clipboard carries raw image bytes with no filename, so the browser names
 * every one of them "image.png". Left alone, five pasted screenshots arrive
 * indistinguishable from each other in the attachment chips and in the thread
 * afterwards.
 */
export function renameIfGeneric(file, now = new Date()) {
  if (!file) return file;
  const isGeneric = !file.name || /^image\.\w+$/i.test(file.name);
  if (!isGeneric) return file;

  const ext = (file.type?.split("/")[1] || "png").replace(/[^a-z0-9]/gi, "");
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return new File([file], `pasted-${stamp}.${ext}`, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

/**
 * Drag-and-drop + clipboard-paste attachment handling, shared by both
 * messaging surfaces (ChatWindow and ProjectMessagePanel).
 *
 * Both surfaces previously had exactly one way to attach a file — the hidden
 * `<input type="file">` behind the paperclip — so a screenshot in the
 * clipboard had to be saved to disk first, and a file already on screen had
 * to be found again through a file picker. This adds the two paths people
 * actually reach for, without either surface growing its own copy of the
 * fiddly parts below.
 *
 * ─── WHY A DRAG COUNTER RATHER THAN A BOOLEAN ───
 * `dragleave` fires every time the pointer crosses into a CHILD element, not
 * just when it leaves the drop zone. A naive `onDragEnter → true` /
 * `onDragLeave → false` makes the overlay strobe as the cursor moves across
 * message bubbles. Counting enter/leave pairs and only hiding at zero is the
 * standard fix, and the reason this is a hook rather than two inline
 * handlers.
 *
 * ─── FOLDERS ───
 * A dropped folder arrives as a DataTransferItem whose `webkitGetAsEntry()`
 * reports `isDirectory`. The browser gives no readable file for it, so
 * without an explicit check it silently attaches nothing — the user drops a
 * folder and simply nothing happens, which reads as "the app is broken"
 * rather than "this isn't supported". We detect it and say so.
 *
 * ─── CAP ───
 * Enforced here rather than at each call site so drop, paste and the file
 * picker can't drift apart on how many files are allowed or what happens at
 * the limit. Partial acceptance is deliberate: dropping six files with one
 * slot left attaches the first and explains, rather than rejecting all six.
 *
 * @param {object}   args
 * @param {File[]}   args.selectedFiles  current staged files
 * @param {Function} args.setSelectedFiles
 * @param {number}   [args.maxFiles=5]   must match the server's array cap
 * @param {Function} [args.onError]      user-facing message sink
 * @param {boolean}  [args.disabled]     ignore drops/pastes entirely
 */
export default function useFileAttach({
  selectedFiles,
  setSelectedFiles,
  maxFiles = 5,
  onError,
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  // Read through a ref inside the event handlers: `paste` is bound to the
  // window, and closing over `selectedFiles` directly would capture whatever
  // the array was when the listener was attached — so pasting twice in a row
  // would compute the remaining capacity from a stale count and overshoot the
  // cap.
  const filesRef = useRef(selectedFiles);
  useEffect(() => {
    filesRef.current = selectedFiles;
  }, [selectedFiles]);

  const report = useCallback(
    (message) => {
      if (onError) onError(message);
      else console.warn(`[attach] ${message}`);
    },
    [onError]
  );

  /**
   * Stage files, honouring the cap. Returns how many were actually added.
   */
  const addFiles = useCallback(
    (incoming) => {
      const { accepted, notice } = planAttachment({
        current: filesRef.current?.length || 0,
        incoming,
        maxFiles,
      });

      if (notice) report(notice);
      if (accepted.length) setSelectedFiles((prev) => [...prev, ...accepted]);
      return accepted.length;
    },
    [maxFiles, report, setSelectedFiles]
  );

  /* ── Drag and drop ──────────────────────────────────────────────────── */

  // Only react to drags carrying actual files. Without this the overlay also
  // appears when dragging selected TEXT across the thread, which is a normal
  // thing to do while quoting someone and has nothing to do with attaching.
  const hasFiles = (event) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  const onDragEnter = useCallback(
    (event) => {
      if (disabled || !hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    },
    [disabled]
  );

  const onDragOver = useCallback(
    (event) => {
      if (disabled || !hasFiles(event)) return;
      // Both preventDefault calls are required: without the dragover one the
      // browser treats the element as a non-drop target and the drop event
      // never fires at all — it navigates to the file instead, replacing the
      // app with the raw image.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    },
    [disabled]
  );

  const onDragLeave = useCallback(
    (event) => {
      if (disabled || !hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragging(false);
    },
    [disabled]
  );

  const onDrop = useCallback(
    (event) => {
      if (disabled) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);

      const dt = event.dataTransfer;
      if (!dt) return;

      const files = Array.from(dt.files || []);

      if (hasDirectory(dt.items)) {
        // Say what to do instead. Browsers can't attach a folder through a
        // drop or a file picker at all — zipping it is the actual path
        // forward, and the user has no way to know that from silence.
        report("Folders can't be attached directly — zip the folder and drop the .zip instead.");
        // Any loose files dropped alongside the folder are still valid, so
        // take those rather than discarding the whole drop.
        const loose = files.filter((f) => f.size > 0 || f.type);
        if (loose.length) addFiles(loose);
        return;
      }

      addFiles(files);
    },
    [addFiles, disabled, report]
  );

  /* ── Clipboard paste ────────────────────────────────────────────────── */

  /**
   * Paste handler. Both surfaces bind this at the panel root rather than on
   * the textarea, so a screenshot pastes whether or not the composer happens
   * to hold focus — and because paste bubbles, one root-level handler covers
   * the composer too. Binding it in both places would attach the same file
   * twice.
   *
   * Text pastes fall through untouched: the early return below happens before
   * any preventDefault, so a normal copy-paste of message text still lands in
   * the textarea, and pasting into the search box still searches.
   */
  const onPaste = useCallback(
    (event) => {
      if (disabled) return;

      const items = Array.from(event.clipboardData?.items || []);
      const files = items
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter(Boolean);

      if (!files.length) return;

      // Only swallow the event once we know there's a file on the clipboard:
      // preventing default unconditionally would break pasting text.
      event.preventDefault();

      addFiles(files.map((file) => renameIfGeneric(file)));
    },
    [addFiles, disabled]
  );

  // A drag that ends outside the window (dropped on the desktop, or cancelled
  // with Escape) fires no `drop` on our element, so the counter would stay
  // above zero and the overlay would stick until the next full drag cycle.
  useEffect(() => {
    const reset = () => {
      dragDepth.current = 0;
      setIsDragging(false);
    };
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
    };
  }, []);

  return {
    isDragging,
    addFiles,
    // Spread onto the element that should accept drops.
    dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
    onPaste,
  };
}
