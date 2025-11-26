import React, { useState, useEffect } from "react";
import API from "../../api";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  BarChart3,
  Brain,
  Zap,
  MessageSquare,
  Users,
  Target,
  Lightbulb,
} from "lucide-react";

const CommunicationAnalytics = ({ projectId, projectName, onClose }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useAI, setUseAI] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [projectId, useAI]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/projects/${projectId}/analytics`, {
        params: { useAI: useAI ? 'true' : 'false' }
      });
      setAnalytics(res.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'increasing':
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'decreasing':
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Minus className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high':
        return 'text-red-400 bg-red-500/20 border-red-500/50';
      case 'medium':
        return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      default:
        return 'text-green-400 bg-green-500/20 border-green-500/50';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#191f2b] rounded-xl p-8 border border-[#232945]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-white">Analyzing communication patterns...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const { statistical, ai, analysisType } = analytics;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#141a21] rounded-xl shadow-2xl border border-[#232945] max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-[#232945] p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{projectName}</h2>
              <p className="text-blue-300 text-sm">Communication Analytics & Insights</p>
            </div>
            <div className="flex items-center gap-3">
              {/* AI Toggle */}
              <div className="flex items-center gap-2 bg-[#191f2b] rounded-lg px-4 py-2 border border-[#232945]">
                <Brain className={`w-4 h-4 ${useAI ? 'text-purple-400' : 'text-gray-500'}`} />
                <span className="text-sm text-gray-400">AI Insights</span>
                <button
                  onClick={() => setUseAI(!useAI)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    useAI ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      useAI ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Analysis Type Badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/50">
              {analysisType === 'hybrid' ? (
                <><Brain className="w-3 h-3 inline mr-1" />Hybrid Analysis</>
              ) : analysisType === 'statistical-fallback' ? (
                <><Zap className="w-3 h-3 inline mr-1" />Statistical + AI Fallback</>
              ) : (
                <><BarChart3 className="w-3 h-3 inline mr-1" />Statistical Analysis</>
              )}
            </span>
            {ai && ai.source && (
              <span className="text-xs text-gray-500">
                ({ai.source === 'ai' ? 'AI-powered' : 'Rule-based'})
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#191f2b] rounded-lg p-4 border border-[#232945]">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Total Messages</span>
              </div>
              <p className="text-2xl font-bold text-white">{statistical.summary.totalMessages}</p>
            </div>

            <div className="bg-[#191f2b] rounded-lg p-4 border border-[#232945]">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Weekly Average</span>
              </div>
              <p className="text-2xl font-bold text-white">{statistical.summary.avgMessagesPerWeek}</p>
            </div>

            <div className="bg-[#191f2b] rounded-lg p-4 border border-[#232945]">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-gray-400">Engagement</span>
              </div>
              <p className="text-2xl font-bold text-white">{statistical.summary.engagementScore}/100</p>
            </div>

            <div className="bg-[#191f2b] rounded-lg p-4 border border-[#232945]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-sm text-gray-400">Days Since Last</span>
              </div>
              <p className="text-2xl font-bold text-white">{statistical.summary.daysSinceLastMessage || 0}</p>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className={`rounded-lg p-5 border ${getRiskColor(statistical.risk.level)}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Risk Assessment</h3>
              </div>
              <span className="text-3xl font-bold">{statistical.risk.score}/100</span>
            </div>
            <p className="text-sm opacity-90 mb-3">Risk Level: <span className="font-semibold uppercase">{statistical.risk.level}</span></p>
            {statistical.risk.factors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs opacity-75">Risk Factors:</p>
                {statistical.risk.factors.map((factor, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-black/20 rounded px-3 py-2">
                    <span>{factor.factor}</span>
                    <span className="font-semibold">+{factor.points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend Analysis */}
          <div className="bg-[#191f2b] rounded-lg p-5 border border-[#232945]">
            <div className="flex items-center gap-2 mb-4">
              {getTrendIcon(statistical.trend.direction)}
              <h3 className="text-lg font-semibold text-white">Communication Trend</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Direction</p>
                <p className="text-lg font-semibold text-white capitalize">{statistical.trend.direction}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Weekly Change</p>
                <p className={`text-lg font-semibold ${statistical.trend.weeklyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {statistical.trend.weeklyChange > 0 ? '+' : ''}{statistical.trend.weeklyChange}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Slope</p>
                <p className="text-lg font-semibold text-white">{statistical.trend.slope}</p>
              </div>
            </div>
          </div>

          {/* Response Times */}
          <div className="bg-[#191f2b] rounded-lg p-5 border border-[#232945]">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Response Times</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Admin → Client</p>
                <p className="text-lg font-semibold text-white">
                  {statistical.responseTime.adminToClient ? `${statistical.responseTime.adminToClient}h` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Client → Admin</p>
                <p className="text-lg font-semibold text-white">
                  {statistical.responseTime.clientToAdmin ? `${statistical.responseTime.clientToAdmin}h` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Employee → Admin</p>
                <p className="text-lg font-semibold text-white">
                  {statistical.responseTime.employeeToAdmin ? `${statistical.responseTime.employeeToAdmin}h` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Communication Patterns */}
          <div className="bg-[#191f2b] rounded-lg p-5 border border-[#232945]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Communication Patterns</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-400 mb-3">Most Active Days</p>
                {statistical.patterns.activeDays.map((day, idx) => (
                  <div key={idx} className="flex items-center justify-between mb-2 bg-[#0f1419] rounded px-3 py-2">
                    <span className="text-white text-sm">{day.day}</span>
                    <span className="text-blue-400 font-semibold text-sm">{day.count} msgs ({day.percentage}%)</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-3">Peak Hour</p>
                <div className="bg-[#0f1419] rounded px-4 py-3">
                  <p className="text-white text-lg font-semibold mb-1">
                    {statistical.patterns.activeHours.peakHourLabel}
                  </p>
                  <p className="text-gray-400 text-sm">{statistical.patterns.activeHours.messageCount} messages</p>
                </div>
                {statistical.patterns.bestTimeToReach && (
                  <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded px-4 py-3">
                    <p className="text-xs text-green-400 mb-1">Best Time to Reach Client</p>
                    <p className="text-white font-semibold">{statistical.patterns.bestTimeToReach.label}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Insights Section */}
          {ai && (
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg p-5 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">AI Insights</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-[#191f2b]/50 rounded-lg p-3 border border-[#232945]">
                  <p className="text-xs text-gray-400 mb-1">Sentiment</p>
                  <p className={`text-lg font-semibold capitalize ${
                    ai.sentiment === 'positive' ? 'text-green-400' :
                    ai.sentiment === 'negative' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {ai.sentiment}
                  </p>
                </div>
                <div className="bg-[#191f2b]/50 rounded-lg p-3 border border-[#232945]">
                  <p className="text-xs text-gray-400 mb-1">Urgency</p>
                  <p className={`text-lg font-semibold capitalize ${
                    ai.urgency === 'high' ? 'text-red-400' :
                    ai.urgency === 'medium' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {ai.urgency}
                  </p>
                </div>
                <div className="bg-[#191f2b]/50 rounded-lg p-3 border border-[#232945]">
                  <p className="text-xs text-gray-400 mb-1">Client Satisfaction</p>
                  <p className={`text-lg font-semibold capitalize ${
                    ai.clientSatisfaction === 'satisfied' ? 'text-green-400' :
                    ai.clientSatisfaction === 'frustrated' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {ai.clientSatisfaction}
                  </p>
                </div>
              </div>

              {ai.summary && (
                <div className="mb-4 bg-[#191f2b]/50 rounded-lg p-4 border border-[#232945]">
                  <p className="text-xs text-gray-400 mb-2">Summary</p>
                  <p className="text-white text-sm leading-relaxed">{ai.summary}</p>
                </div>
              )}

              {ai.recommendations && ai.recommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <p className="text-sm font-semibold text-white">Recommendations</p>
                  </div>
                  <div className="space-y-2">
                    {ai.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-[#191f2b]/50 rounded-lg p-3 border border-[#232945]">
                        <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-300">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Predictions & Anomalies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statistical.prediction && (
              <div className="bg-[#191f2b] rounded-lg p-5 border border-[#232945]">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">7-Day Prediction</h3>
                </div>
                <p className="text-3xl font-bold text-white mb-2">{statistical.prediction.predicted}</p>
                <p className="text-sm text-gray-400">
                  Expected messages • {statistical.prediction.confidence} confidence
                </p>
              </div>
            )}

            {statistical.anomalies && statistical.anomalies.length > 0 && (
              <div className="bg-[#191f2b] rounded-lg p-5 border border-[#232945]">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">Anomalies Detected</h3>
                </div>
                {statistical.anomalies.slice(0, 3).map((anomaly, idx) => (
                  <div key={idx} className="mb-2 text-sm">
                    <p className="text-orange-400 font-semibold">{anomaly.type.replace('_', ' ')}</p>
                    <p className="text-gray-400">{anomaly.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunicationAnalytics;
