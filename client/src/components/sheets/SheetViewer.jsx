import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Edit3,
  ExternalLink,
  Eye,
  LoaderCircle,
  X,
} from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const SheetViewer = ({ sheet, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [permission, setPermission] = useState(
    sheet.userPermission || "view"
  );

  useEffect(() => {
    let active = true;

    const updateAccess = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `${API_BASE}/api/sheets/${sheet._id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (active && response.data?.data?.userPermission) {
          setPermission(response.data.data.userPermission);
        }
      } catch (error) {
        console.error("Failed to update sheet access:", error);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    updateAccess();

    return () => {
      active = false;
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose, sheet._id]);

  const sourceUrl = sheet.embedUrl || sheet.originalUrl;
  const canEdit = permission === "edit";

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-slate-100 text-slate-900 dark:bg-[#0b0d12] dark:text-slate-100"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sheet-viewer-title"
    >
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-white/10 dark:bg-[#10131c] sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white"
            aria-label="Close sheet viewer"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="sheet-viewer-title"
                className="max-w-[55vw] truncate text-sm font-semibold text-slate-950 dark:text-white sm:max-w-none"
              >
                {sheet.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold ${
                  canEdit
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
                }`}
              >
                {canEdit ? (
                  <Edit3 className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                {canEdit ? "Can edit" : "View only"}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] capitalize text-slate-400">
              {sheet.type || "online"} spreadsheet
            </p>
          </div>
        </div>

        <a
          href={sheet.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Open in source app</span>
          <span className="sm:hidden">Open source</span>
        </a>
      </header>

      <div
        className={`flex items-center gap-2 border-b px-4 py-2 text-xs ${
          canEdit
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200"
        }`}
      >
        {canEdit ? (
          <Edit3 className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Eye className="h-3.5 w-3.5 shrink-0" />
        )}
        <span>
          {canEdit
            ? "Editing is enabled. Changes are saved by the source platform."
            : "This sheet is read-only for your account. Contact an administrator for edit access."}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {loading && !loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 dark:bg-[#0b0d12]">
            <div className="text-center">
              <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-blue-600 dark:text-blue-300" />
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                Loading sheet...
              </p>
            </div>
          </div>
        )}

        {loadError ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                <AlertCircle className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">
                The embedded sheet could not be loaded
              </h2>
              <p className="mt-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
                The source may block embedding, require a separate sign-in, or no longer be available.
              </p>
              <a
                href={sheet.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <ExternalLink className="h-4 w-4" />
                Open in source app
              </a>
            </div>
          </div>
        ) : (
          <iframe
            src={sourceUrl}
            className="h-full w-full border-0 bg-white"
            title={sheet.name}
            onLoad={() => {
              setLoading(false);
              setLoadError(false);
            }}
            onError={() => {
              setLoading(false);
              setLoadError(true);
            }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
            allow="clipboard-read; clipboard-write; fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </div>
  );
};

export default SheetViewer;
