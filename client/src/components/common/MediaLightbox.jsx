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

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = currentMedia.url;
    link.download = currentMedia.filename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            src={currentMedia.url.startsWith('http') ? currentMedia.url : `http://localhost:5000${currentMedia.url}`}
            alt={currentMedia.filename || "Image"}
            className="max-w-full max-h-[90vh] object-contain rounded"
            onClick={(e) => e.stopPropagation()}
          />
        ) : currentMedia.fileType === "video" ? (
          <video
            src={currentMedia.url.startsWith('http') ? currentMedia.url : `http://localhost:5000${currentMedia.url}`}
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
