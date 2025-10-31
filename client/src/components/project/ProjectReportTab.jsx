import React, { useState } from "react";
import { TrendingUp, TrendingDown, BarChart3, Search } from "lucide-react";
import OnPageSEO from "./OnPageSEO";
import OffPageSEO from "./OffPageSEO";

const ProjectReportTab = ({ projectId, userRole, userId }) => {
  const [activeSEOTab, setActiveSEOTab] = useState("onpage");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
      </div>
    </div>
  );
};

export default ProjectReportTab;
