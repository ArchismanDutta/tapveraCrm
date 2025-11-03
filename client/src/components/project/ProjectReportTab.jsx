import React, { useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, Search, Image, Download, FileText, Loader2 } from "lucide-react";
import axios from "axios";
import OnPageSEO from "./OnPageSEO";
import OffPageSEO from "./OffPageSEO";
import Screenshot from "./Screenshot";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const ProjectReportTab = ({ projectId, userRole, userId }) => {
  const [activeSEOTab, setActiveSEOTab] = useState("onpage");
  const [downloading, setDownloading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDownloadReport = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem("token");

      const response = await axios.get(
        `${API_BASE}/api/projects/${projectId}/report/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob',
        }
      );

      // Create a download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project-report-${projectId}-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showNotification("Report downloaded successfully!", "success");
    } catch (error) {
      console.error("Error downloading report:", error);
      showNotification(
        error.response?.data?.message || "Error downloading report",
        "error"
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            notification.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Download Report Button */}
      <div className="bg-[#0f1419] border-b border-[#232945] px-4 py-3 flex justify-center">
        <button
          onClick={handleDownloadReport}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white rounded-lg transition-all font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download Project Report
            </>
          )}
        </button>
      </div>

      {/* SEO Sub-tabs */}
      <div className="border-b border-[#232945] bg-[#0f1419]">
        <div className="flex">
          <button
            onClick={() => setActiveSEOTab("onpage")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all ${
              activeSEOTab === "onpage"
                ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-white hover:bg-[#141a21]"
            }`}
          >
            <Search className="w-4 h-4" />
            <span>On-Page SEO</span>
          </button>
          <button
            onClick={() => setActiveSEOTab("offpage")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all ${
              activeSEOTab === "offpage"
                ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-white hover:bg-[#141a21]"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Off-Page SEO</span>
          </button>
          <button
            onClick={() => setActiveSEOTab("screenshots")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all ${
              activeSEOTab === "screenshots"
                ? "bg-blue-600/20 text-blue-400 border-b-2 border-blue-500"
                : "text-gray-400 hover:text-white hover:bg-[#141a21]"
            }`}
          >
            <Image className="w-4 h-4" />
            <span>Screenshots</span>
          </button>
        </div>
      </div>

      {/* Sub-tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSEOTab === "onpage" && (
          <OnPageSEO projectId={projectId} userRole={userRole} userId={userId} />
        )}
        {activeSEOTab === "offpage" && (
          <OffPageSEO projectId={projectId} userRole={userRole} userId={userId} />
        )}
        {activeSEOTab === "screenshots" && (
          <Screenshot projectId={projectId} userRole={userRole} userId={userId} />
        )}
      </div>
    </div>
  );
};

export default ProjectReportTab;
