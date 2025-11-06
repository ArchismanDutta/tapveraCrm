import React, { useState, useEffect } from "react";
import API from "../../api";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Zap } from "lucide-react";

const VelocityMetrics = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState(null);
  const [selectedTab, setSelectedTab] = useState("fastest"); // fastest, declines, stagnant

  useEffect(() => {
    fetchVelocityInsights();
  }, [projectId]);

  const fetchVelocityInsights = async () => {
    try {
      setLoading(true);
      const response = await API.get(`/api/projects/${projectId}/keywords/velocity`);
      setInsights(response.data.data);
    } catch (error) {
      console.error("Error fetching velocity insights:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="text-center p-8 text-gray-400">
        Failed to load velocity insights
      </div>
    );
  }

  const { summary, fastestImprovements, rapidDeclines, stagnantKeywords } = insights;

  const getVelocityColor = (change) => {
    if (change >= 10) return "text-green-500";
    if (change >= 5) return "text-green-400";
    if (change >= 1) return "text-green-300";
    if (change === 0) return "text-gray-400";
    if (change >= -4) return "text-yellow-400";
    if (change >= -9) return "text-orange-400";
    return "text-red-500";
  };

  const getVelocityBgColor = (change) => {
    if (change >= 10) return "bg-green-500/10 border-green-500/30";
    if (change >= 5) return "bg-green-400/10 border-green-400/30";
    if (change >= 1) return "bg-green-300/10 border-green-300/30";
    if (change === 0) return "bg-gray-400/10 border-gray-400/30";
    if (change >= -4) return "bg-yellow-400/10 border-yellow-400/30";
    if (change >= -9) return "bg-orange-400/10 border-orange-400/30";
    return "bg-red-500/10 border-red-500/30";
  };

  const formatChange = (change) => {
    if (change > 0) return `+${change}`;
    return change;
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner for Rapid Declines */}
      {rapidDeclines.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-400 mb-1">
                ⚠️ {rapidDeclines.length} Keyword{rapidDeclines.length !== 1 ? 's' : ''} with Rapid Decline
              </div>
              <div className="text-sm text-gray-300">
                {rapidDeclines.length} keyword{rapidDeclines.length !== 1 ? 's have' : ' has'} dropped 5+ positions in the last 7 days. Immediate attention required!
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Average Velocity Stats */}
      <div className="bg-[#1a1f2e] border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold text-white">Average Velocity</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">7-Day Average</div>
            <div className={`text-xl font-bold ${getVelocityColor(summary.averageVelocity7Day)}`}>
              {formatChange(summary.averageVelocity7Day)} positions
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">30-Day Average</div>
            <div className={`text-xl font-bold ${getVelocityColor(summary.averageVelocity30Day)}`}>
              {formatChange(summary.averageVelocity30Day)} positions
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setSelectedTab("fastest")}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === "fastest"
              ? "text-orange-400 border-b-2 border-orange-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Fastest Improvements ({fastestImprovements.length})
          </div>
        </button>
        <button
          onClick={() => setSelectedTab("declines")}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === "declines"
              ? "text-orange-400 border-b-2 border-orange-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Rapid Declines ({rapidDeclines.length})
          </div>
        </button>
        <button
          onClick={() => setSelectedTab("stagnant")}
          className={`px-4 py-2 font-medium transition-colors ${
            selectedTab === "stagnant"
              ? "text-orange-400 border-b-2 border-orange-400"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4" />
            Stagnant ({stagnantKeywords.length})
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {selectedTab === "fastest" && (
          <>
            {fastestImprovements.length === 0 ? (
              <div className="text-center p-8 text-gray-400">
                No improving keywords in the last 7 days
              </div>
            ) : (
              fastestImprovements.map((kw, index) => (
                <div
                  key={kw._id}
                  className={`${getVelocityBgColor(kw.velocity7Day.change)} border rounded-xl p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-400">#{index + 1}</span>
                        <h4 className="font-semibold text-white">{kw.keyword}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">
                          Rank: <span className="text-white font-medium">{kw.currentRank || "N/A"}</span>
                        </span>
                        <span className="text-gray-400">
                          {kw.searchEngine} • {kw.location}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getVelocityColor(kw.velocity7Day.change)}`}>
                        {formatChange(kw.velocity7Day.change)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {kw.velocity7Day.isFallback
                          ? `positions in ${Math.round(kw.velocity7Day.daysAnalyzed)} day${Math.round(kw.velocity7Day.daysAnalyzed) !== 1 ? 's' : ''}`
                          : 'positions in 7 days'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {kw.velocity7Day.velocity > 0 ? "+" : ""}{kw.velocity7Day.velocity.toFixed(2)}/day
                      </div>
                      {kw.velocity7Day.isFallback && (
                        <div className="text-xs text-blue-400 mt-1">
                          ⏱️ Limited history
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {selectedTab === "declines" && (
          <>
            {rapidDeclines.length === 0 ? (
              <div className="text-center p-8 text-gray-400">
                No rapid declines detected 🎉
              </div>
            ) : (
              rapidDeclines.map((kw, index) => (
                <div
                  key={kw._id}
                  className={`${getVelocityBgColor(kw.velocity7Day.change)} border rounded-xl p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <h4 className="font-semibold text-white">{kw.keyword}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">
                          Current Rank: <span className="text-white font-medium">{kw.currentRank || "N/A"}</span>
                        </span>
                        <span className="text-gray-400">
                          {kw.searchEngine} • {kw.location}
                        </span>
                      </div>
                      <div className="text-xs text-yellow-400 mt-2">
                        ⚠️ Immediate action required - significant drop detected
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getVelocityColor(kw.velocity7Day.change)}`}>
                        {formatChange(kw.velocity7Day.change)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {kw.velocity7Day.isFallback
                          ? `positions in ${Math.round(kw.velocity7Day.daysAnalyzed)} day${Math.round(kw.velocity7Day.daysAnalyzed) !== 1 ? 's' : ''}`
                          : 'positions in 7 days'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {kw.velocity7Day.velocity.toFixed(2)}/day
                      </div>
                      {kw.velocity7Day.isFallback && (
                        <div className="text-xs text-yellow-400 mt-1">
                          ⏱️ Limited history
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {selectedTab === "stagnant" && (
          <>
            {stagnantKeywords.length === 0 ? (
              <div className="text-center p-8 text-gray-400">
                All keywords are showing movement 👍
              </div>
            ) : (
              stagnantKeywords.map((kw) => (
                <div
                  key={kw._id}
                  className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Minus className="w-4 h-4 text-gray-400" />
                        <h4 className="font-semibold text-white">{kw.keyword}</h4>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-400">
                          Rank: <span className="text-white font-medium">{kw.currentRank || "N/A"}</span>
                        </span>
                        <span className="text-gray-400">
                          {kw.searchEngine} • {kw.location}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        No movement in the last 30 days
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-400">
                        0
                      </div>
                      <div className="text-xs text-gray-500">change</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default VelocityMetrics;
