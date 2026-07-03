import React, { useCallback, useEffect, useState } from "react";
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
  const [loadError, setLoadError] = useState("");
  const [useAI, setUseAI] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await API.get(`/api/projects/${projectId}/analytics`, {
        params: { useAI: useAI ? 'true' : 'false' }
      });
      setAnalytics(res.data);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setLoadError("We could not load communication analytics for this project.");
    } finally {
      setLoading(false);
    }
  }, [projectId, useAI]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const getTrendIcon = (direction) => {
    switch (direction) {
      case 'increasing':
        return <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />;
      case 'decreasing':
        return <TrendingDown className="h-5 w-5 text-rose-600 dark:text-rose-300" />;
      default:
        return <Minus className="h-5 w-5 text-amber-600 dark:text-amber-300" />;
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high':
        return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200';
      case 'medium':
        return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200';
      default:
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm text-slate-700 dark:text-slate-200">Analyzing communication patterns...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#10131c]">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 dark:text-rose-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-950 dark:text-white">Analytics unavailable</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={onClose} className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">Close</button>
            <button type="button" onClick={fetchAnalytics} className="h-9 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  const { statistical, ai, analysisType } = analytics;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="communication-analytics-title">
      <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl dark:border-white/10 dark:bg-[#0b0d12] sm:max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#10131c]/95 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Communication analytics</p>
              <h2 id="communication-analytics-title" className="mt-1 text-xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-2xl">{projectName}</h2>
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              {/* AI Toggle */}
              <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-white/10 dark:bg-white/[0.04]">
                <Brain className={`h-4 w-4 ${useAI ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400'}`} />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">AI insights</span>
                <button
                  type="button"
                  onClick={() => setUseAI(!useAI)}
                  role="switch"
                  aria-checked={useAI}
                  aria-label="Toggle AI insights"
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    useAI ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      useAI ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                aria-label="Close analytics"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Analysis Type Badge */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
              {analysisType === 'hybrid' ? (
                <><Brain className="w-3 h-3 inline mr-1" />Hybrid Analysis</>
              ) : analysisType === 'statistical-fallback' ? (
                <><Zap className="w-3 h-3 inline mr-1" />Statistical + AI Fallback</>
              ) : (
                <><BarChart3 className="w-3 h-3 inline mr-1" />Statistical Analysis</>
              )}
            </span>
            {ai && ai.source && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({ai.source === 'ai' ? 'AI-powered' : 'Rule-based'})
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-5 p-4 sm:p-6">
          {/* Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Total messages</span>
              </div>
              <p className="text-2xl font-semibold text-slate-950 dark:text-white">{statistical.summary.totalMessages}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Weekly average</span>
              </div>
              <p className="text-2xl font-semibold text-slate-950 dark:text-white">{statistical.summary.avgMessagesPerWeek}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Engagement</span>
              </div>
              <p className="text-2xl font-semibold text-slate-950 dark:text-white">{statistical.summary.engagementScore}/100</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#10131c]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                <span className="text-xs text-slate-500 dark:text-slate-400">Days since last</span>
              </div>
              <p className="text-2xl font-semibold text-slate-950 dark:text-white">{statistical.summary.daysSinceLastMessage || 0}</p>
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
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2 text-sm dark:bg-black/20">
                    <span>{factor.factor}</span>
                    <span className="font-semibold">+{factor.points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend Analysis */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center gap-2 mb-4">
              {getTrendIcon(statistical.trend.direction)}
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Communication trend</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Direction</p>
                <p className="text-lg font-semibold capitalize text-slate-950 dark:text-white">{statistical.trend.direction}</p>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Weekly change</p>
                <p className={`text-lg font-semibold ${statistical.trend.weeklyChange >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                  {statistical.trend.weeklyChange > 0 ? '+' : ''}{statistical.trend.weeklyChange}%
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Slope</p>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{statistical.trend.slope}</p>
              </div>
            </div>
          </section>

          {/* Response Times */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Response times</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Admin → Client</p>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">
                  {statistical.responseTime.adminToClient ? `${statistical.responseTime.adminToClient}h` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Client → Admin</p>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">
                  {statistical.responseTime.clientToAdmin ? `${statistical.responseTime.clientToAdmin}h` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Employee → Admin</p>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">
                  {statistical.responseTime.employeeToAdmin ? `${statistical.responseTime.employeeToAdmin}h` : 'N/A'}
                </p>
              </div>
            </div>
          </section>

          {/* Communication Patterns */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#10131c]">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Communication patterns</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Most active days</p>
                {statistical.patterns.activeDays.map((day, idx) => (
                  <div key={idx} className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.04]">
                    <span className="text-sm text-slate-700 dark:text-slate-200">{day.day}</span>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-300">{day.count} msgs ({day.percentage}%)</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Peak hour</p>
                <div className="rounded-lg bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="mb-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {statistical.patterns.activeHours.peakHourLabel}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{statistical.patterns.activeHours.messageCount} messages</p>
                </div>
                {statistical.patterns.bestTimeToReach && (
                  <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded px-4 py-3">
                    <p className="mb-1 text-xs text-emerald-700 dark:text-emerald-300">Best time to reach client</p>
                    <p className="font-semibold text-slate-950 dark:text-white">{statistical.patterns.bestTimeToReach.label}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* AI Insights Section */}
          {ai && (
            <section className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-400/20 dark:bg-violet-400/[0.07]">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-violet-600 dark:text-violet-300" />
                <h3 className="text-base font-semibold text-violet-950 dark:text-violet-100">AI insights</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="rounded-lg border border-violet-200 bg-white/70 p-3 dark:border-violet-400/15 dark:bg-white/[0.04]">
                  <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Sentiment</p>
                  <p className={`text-lg font-semibold capitalize ${
                    ai.sentiment === 'positive' ? 'text-emerald-600 dark:text-emerald-300' :
                    ai.sentiment === 'negative' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'
                  }`}>
                    {ai.sentiment}
                  </p>
                </div>
                <div className="rounded-lg border border-violet-200 bg-white/70 p-3 dark:border-violet-400/15 dark:bg-white/[0.04]">
                  <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Urgency</p>
                  <p className={`text-lg font-semibold capitalize ${
                    ai.urgency === 'high' ? 'text-rose-600 dark:text-rose-300' :
                    ai.urgency === 'medium' ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'
                  }`}>
                    {ai.urgency}
                  </p>
                </div>
                <div className="rounded-lg border border-violet-200 bg-white/70 p-3 dark:border-violet-400/15 dark:bg-white/[0.04]">
                  <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Client satisfaction</p>
                  <p className={`text-lg font-semibold capitalize ${
                    ai.clientSatisfaction === 'satisfied' ? 'text-emerald-600 dark:text-emerald-300' :
                    ai.clientSatisfaction === 'frustrated' ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'
                  }`}>
                    {ai.clientSatisfaction}
                  </p>
                </div>
              </div>

              {ai.summary && (
                <div className="mb-4 rounded-lg border border-violet-200 bg-white/70 p-4 dark:border-violet-400/15 dark:bg-white/[0.04]">
                  <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Summary</p>
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{ai.summary}</p>
                </div>
              )}

              {ai.recommendations && ai.recommendations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                    <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">Recommendations</p>
                  </div>
                  <div className="space-y-2">
                    {ai.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-2 rounded-lg border border-violet-200 bg-white/70 p-3 dark:border-violet-400/15 dark:bg-white/[0.04]">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        <span className="text-sm text-slate-700 dark:text-slate-200">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Predictions & Anomalies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statistical.prediction && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#10131c]">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                  <h3 className="text-base font-semibold text-slate-950 dark:text-white">7-day prediction</h3>
                </div>
                <p className="mb-2 text-3xl font-semibold text-slate-950 dark:text-white">{statistical.prediction.predicted}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Expected messages • {statistical.prediction.confidence} confidence
                </p>
              </div>
            )}

            {statistical.anomalies && statistical.anomalies.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#10131c]">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                  <h3 className="text-base font-semibold text-slate-950 dark:text-white">Anomalies detected</h3>
                </div>
                {statistical.anomalies.slice(0, 3).map((anomaly, idx) => (
                  <div key={idx} className="mb-2 text-sm">
                    <p className="font-semibold text-amber-700 dark:text-amber-300">{anomaly.type.replace('_', ' ')}</p>
                    <p className="text-slate-500 dark:text-slate-400">{anomaly.description}</p>
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
