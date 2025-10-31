import React from "react";
import { Link as LinkIcon, FileText, TrendingUp } from "lucide-react";

const OffPageSEO = ({ projectId, userRole, userId }) => {
  return (
    <div className="p-4 sm:p-6">
      <div className="bg-[#0f1419] border border-[#232945] rounded-lg p-8 text-center">
        <LinkIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">
          Off-Page SEO Tracking
        </h3>
        <p className="text-gray-400 mb-4">
          Backlink analysis, domain authority, and off-page metrics coming soon!
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-[#141a21] border border-[#232945] rounded-lg p-4">
            <LinkIcon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-gray-300">Backlinks</h4>
            <p className="text-xs text-gray-500 mt-1">
              Track quality backlinks
            </p>
          </div>
          <div className="bg-[#141a21] border border-[#232945] rounded-lg p-4">
            <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-gray-300">
              Domain Authority
            </h4>
            <p className="text-xs text-gray-500 mt-1">Monitor DA/PA scores</p>
          </div>
          <div className="bg-[#141a21] border border-[#232945] rounded-lg p-4">
            <FileText className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <h4 className="text-sm font-medium text-gray-300">
              Content Distribution
            </h4>
            <p className="text-xs text-gray-500 mt-1">
              Track content placements
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OffPageSEO;
