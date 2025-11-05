// components/sheets/SheetViewer.jsx
import React, { useEffect, useState } from "react";
import { X, ExternalLink, Edit3, Save, AlertCircle, Eye } from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const SheetViewer = ({ sheet, onClose }) =>
  
  {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [userPermission, setUserPermission] = useState(sheet.userPermission || "view");

  useEffect(() => {
    // Update last accessed info when sheet is opened and fetch permission
    const updateAccess = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE}/api/sheets/${sheet._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Update user permission state
        if (response.data.data && response.data.data.userPermission) {
          setUserPermission(response.data.data.userPermission);
        }
      } catch (error) {
        console.error("Error updating access:", error);
      }
    };

    updateAccess();

    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    // Handle Escape key to close
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [sheet, onClose]);

  const openInNewTab = () => {
    window.open(sheet.originalUrl, "_blank", "noopener,noreferrer");
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setLoadError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setLoadError(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95">
      {/* Header */}
      <div className="h-14 bg-[#0a0e1a] border-b border-[#232945] flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a1f2e] rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
          <div>
            <h3 className="text-white font-medium flex items-center gap-2">
              {sheet.name}
              {userPermission === "edit" ? (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/50">
                  <Edit3 className="w-3 h-3" />
                  Can Edit
                </span>
              ) : (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded border border-yellow-500/50">
                  <Eye className="w-3 h-3" />
                  View Only
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 capitalize">
              {sheet.type} Sheet • {userPermission === "edit" ? "All changes auto-save" : "Read-only access"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openInNewTab}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-lg"
          >
            <ExternalLink className="w-4 h-4" />
            Open in {sheet.type === "google" ? "Google Sheets" : "Excel Online"}
          </button>
        </div>
      </div>

      {/* Permission Banner */}
      {userPermission === "edit" ? (
        <div className="bg-gradient-to-r from-green-600/20 via-blue-600/20 to-purple-600/20 border-b border-green-500/30 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Save className="w-4 h-4 text-green-400 animate-pulse" />
              <p className="text-sm text-green-300 font-medium">
                ✓ Full Edit Mode Active
              </p>
            </div>
            <span className="text-gray-400 text-xs">•</span>
            <p className="text-xs text-gray-300">
              You can add/edit/delete rows, columns, formulas, formatting - all changes sync instantly!
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-saving</span>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-red-600/20 border-b border-yellow-500/30 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-yellow-400" />
              <p className="text-sm text-yellow-300 font-medium">
                ⚠️ View-Only Mode
              </p>
            </div>
            <span className="text-gray-400 text-xs">•</span>
            <p className="text-xs text-gray-300">
              You can view this sheet but cannot make changes. Contact the admin for edit access.
            </p>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-[#0a0e1a] flex items-center justify-center z-10 mt-[6.5rem]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 text-sm">Loading sheet editor...</p>
            <p className="text-gray-600 text-xs mt-2">This may take a few seconds</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {loadError && (
        <div className="absolute inset-0 bg-[#0a0e1a] flex items-center justify-center z-10 mt-[6.5rem]">
          <div className="text-center max-w-md p-6">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-white text-lg font-medium mb-2">Unable to Load Sheet</h3>
            <p className="text-gray-400 text-sm mb-4">
              The sheet couldn't be loaded. This might be because:
            </p>
            <ul className="text-left text-gray-400 text-xs space-y-1 mb-4">
              <li>• The sheet doesn't have "Anyone with the link can edit" permissions</li>
              <li>• The sheet has been deleted or moved</li>
              <li>• You need to be signed into your Google/Microsoft account</li>
            </ul>
            <button
              onClick={openInNewTab}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Open in New Tab Instead
            </button>
          </div>
        </div>
      )}

      {/* iframe Editor - Full Screen */}
      <div className="h-[calc(100vh-6.5rem)]">
        <iframe
          src={sheet.embedUrl}
          className="w-full h-full border-0"
          title={sheet.name}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          // Enhanced sandbox permissions for full editing
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
          // Enhanced allow permissions for clipboard and other features
          allow="clipboard-read; clipboard-write; fullscreen; autoplay"
          // Allow credentials for Google sign-in
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Keyboard Shortcut Helper */}
      <div className="absolute bottom-4 right-4 bg-[#0a0e1a]/90 backdrop-blur-sm border border-[#232945] rounded-lg px-3 py-2 text-xs text-gray-400">
        <kbd className="px-2 py-1 bg-[#1a1f2e] rounded text-gray-300">Esc</kbd> to close
      </div>
    </div>
  );
};

export default SheetViewer;
