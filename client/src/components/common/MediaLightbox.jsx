import React, { useEffect } from "react";
import { X as XIcon, Download, ChevronLeft, ChevronRight } from "lucide-react";

const MediaLightbox = ({ media, onClose, allMedia = [], currentIndex = 0, onNavigate }) => {
  useEffect(() => {
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = "hidden";

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    // Handle arrow keys for navigation
    const handleArrowKey = (e) => {
      if (!onNavigate) return;
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < allMedia.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("keydown", handleArrowKey);

    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("keydown", handleArrowKey);
    };
  }, [onClose, onNavigate, currentIndex, allMedia.length]);

  const currentMedia = media || (allMedia[currentIndex]);

  if (!currentMedia) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // currentMedia.url is the storage-relative signed path the message payload
  // carries (e.g. "/uploads/messages/...?e=...&s=..."), not an absolute URL.
  // It needs the API origin prepended the same way every other attachment
  // reference in the app resolves it — this was the one spot in the codebase
  // that hardcoded "http://localhost:5000" instead of reading VITE_API_BASE,
  // so the full-size preview (and the download below) only ever worked when
  // the app happened to be running on that exact host.
  const resolveMediaUrl = (url) =>
    url?.startsWith("http") ? url : `${import.meta.env.VITE_API_BASE || "http://localhost:5000"}${url || ""}`;

  // A plain `<a download>` pointed straight at that relative path resolves
  // against whatever origin the CHAT PAGE is served from, not the API server —
  // so this always fetched a 404 (or the SPA shell) from the frontend host
  // rather than the actual file. Fetching the resolved URL first and handing
  // the browser a same-origin blob: URL both fixes the origin and makes the
  // `download` attribute reliable cross-browser.
  const handleDownload = async () => {
    const absoluteUrl = resolveMediaUrl(currentMedia.url);
    try {
      const response = await fetch(absoluteUrl);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = currentMedia.filename || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("Media download failed:", err);
      // Worse UX (opens instead of saves) but still gets the user to their
      // file if the fetch itself failed — e.g. an expired signed URL — rather
      // than the button doing nothing at all.
      window.open(absoluteUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 flex items-center justify-between z-10">
        <div className="text-white text-sm truncate max-w-md">
          {currentMedia.filename || "Media"}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
            title="Download"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
            title="Close"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {onNavigate && allMedia.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white z-10"
              title="Previous"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {currentIndex < allMedia.length - 1 && (
            <button
              onClick={() => onNavigate(currentIndex + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors text-white z-10"
              title="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}
        </>
      )}

      {/* Media Content */}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {currentMedia.fileType === "image" ? (
          <img
            src={resolveMediaUrl(currentMedia.url)}
            alt={currentMedia.filename || "Image"}
            className="max-w-full max-h-[90vh] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        ) : currentMedia.fileType === "video" ? (
          <video
            src={resolveMediaUrl(currentMedia.url)}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded"
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
      </div>

      {/* Counter */}
      {onNavigate && allMedia.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
          {currentIndex + 1} / {allMedia.length}
        </div>
      )}
    </div>
  );
};

export default MediaLightbox;
