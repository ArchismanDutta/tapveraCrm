import React, { useMemo } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  Flame,
  Coffee,
  Calendar,
  BarChart3,
  Shield,
  ChevronRight,
  Info
} from 'lucide-react';

const AttendanceInsights = ({ analysis, employeeName }) => {
  if (!analysis || !analysis.summary) {
    return (
      <div className="bg-slate-800/50 border border-slate-600/30 rounded-xl p-6">
        <p className="text-gray-400 text-center">No analysis data available</p>
      </div>
    );
  }

  const { summary, alerts, latePatterns, burnoutSignals, punctualityTrend, insights, riskScore, weekdayPatterns } = analysis;

  // Risk level colors
  const getRiskColor = (level) => {
    switch (level) {
      case 'critical': return 'from-red-600 to-red-700';
      case 'high': return 'from-orange-600 to-orange-700';
      case 'medium': return 'from-yellow-600 to-yellow-700';
      case 'low': return 'from-green-600 to-green-700';
      default: return 'from-gray-600 to-gray-700';
    }
  };

  const getRiskTextColor = (level) => {
    switch (level) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 border-red-500/50 text-red-300';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300';
      case 'low': return 'bg-blue-500/20 border-blue-500/50 text-blue-300';
      default: return 'bg-gray-500/20 border-gray-500/50 text-gray-300';
    }
  };

  // Get top 3 most problematic weekdays
  const problemWeekdays = useMemo(() => {
    const workdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const weekdayData = workdays
      .map(day => ({
        day,
        latePercentage: weekdayPatterns[day]?.latePercentage || 0,
        lateDays: weekdayPatterns[day]?.lateDays || 0
      }))
      .filter(d => d.lateDays > 0)
      .sort((a, b) => b.latePercentage - a.latePercentage)
      .slice(0, 3);

    return weekdayData;
  }, [weekdayPatterns]);

  return (
    <div className="space-y-6">
      {/* Header with Risk Score */}
      <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">
              AI Attendance Analysis
            </h3>
            {employeeName && (
              <p className="text-gray-400">for {employeeName}</p>
            )}
          </div>

          {/* Risk Score Badge */}
          <div className={`bg-gradient-to-br ${getRiskColor(riskScore.level)} border-2 border-white/20 rounded-xl p-4 min-w-[140px] text-center shadow-lg`}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-white" />
              <span className="text-sm font-semibold text-white uppercase tracking-wide">Risk Score</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">{riskScore.score}</div>
            <div className="text-xs text-white/90 uppercase font-semibold">{riskScore.level}</div>
          </div>
        </div>

        {/* Summary Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-700/40 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Total Days</div>
            <div className="text-xl font-bold text-white">{summary.totalDays}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="text-xs text-red-300 mb-1">Late Days</div>
            <div className="text-xl font-bold text-red-400">{summary.lateDays}</div>
            <div className="text-xs text-red-300">{summary.latePercentage}%</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="text-xs text-blue-300 mb-1">Avg Hours</div>
            <div className="text-xl font-bold text-blue-400">{summary.averageWorkHours}h</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <div className="text-xs text-green-300 mb-1">Punctuality</div>
            <div className="text-xl font-bold text-green-400">{summary.punctualityScore}%</div>
          </div>
          <div className={`bg-gradient-to-br ${getRiskColor(riskScore.level)}/20 border border-white/20 rounded-lg p-3`}>
            <div className="text-xs text-gray-300 mb-1">Status</div>
            <div className={`text-lg font-bold ${getRiskTextColor(riskScore.level)}`}>
              {riskScore.level === 'low' ? '✓ Good' :
               riskScore.level === 'medium' ? '⚠ Watch' :
               riskScore.level === 'high' ? '🔴 Alert' : '🚨 Critical'}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Alerts Section */}
      {alerts && alerts.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <h4 className="text-lg font-bold text-white">Smart Alerts</h4>
            <span className="ml-auto text-sm text-gray-400">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`${getAlertColor(alert.severity)} border rounded-lg p-4 transition-all duration-200 hover:scale-[1.02]`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{alert.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h5 className="font-semibold text-sm">{alert.title}</h5>
                      <span className="text-xs px-2 py-1 bg-black/20 rounded uppercase font-bold">
                        {alert.category}
                      </span>
                    </div>
                    <p className="text-sm opacity-90">{alert.message}</p>
                    {alert.metric && (
                      <div className="mt-2 text-xs font-bold opacity-75">
                        Metric: {alert.metric}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Late Pattern Analysis */}
      {latePatterns && latePatterns.lateDaysCount > 0 && (
        <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-yellow-400" />
            <h4 className="text-lg font-bold text-white">Late Arrival Patterns</h4>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Late Statistics */}
            <div className="bg-slate-700/40 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-gray-300 mb-3">Statistics</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Late Days:</span>
                  <span className="text-yellow-400 font-bold">{latePatterns.lateDaysCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Late Percentage:</span>
                  <span className="text-yellow-400 font-bold">{latePatterns.latePercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Consecutive:</span>
                  <span className="text-red-400 font-bold">{latePatterns.maxConsecutiveLate} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Late By:</span>
                  <span className="text-orange-400 font-bold">{latePatterns.avgLateMinutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Late By:</span>
                  <span className="text-red-400 font-bold">{latePatterns.maxLateMinutes} min</span>
                </div>
              </div>
            </div>

            {/* Pattern Indicators */}
            <div className="bg-slate-700/40 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-gray-300 mb-3">Pattern Indicators</h5>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${latePatterns.hasPattern ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-sm text-gray-300">Pattern Detected</span>
                  <span className="ml-auto text-sm font-bold text-white">
                    {latePatterns.hasPattern ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${latePatterns.isIncreasing ? 'bg-orange-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-sm text-gray-300">Increasing Trend</span>
                  <span className="ml-auto text-sm font-bold text-white">
                    {latePatterns.isIncreasing ? 'YES' : 'NO'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">Severity Level</span>
                  <span className={`ml-auto text-sm font-bold uppercase ${
                    latePatterns.severity === 'critical' ? 'text-red-400' :
                    latePatterns.severity === 'high' ? 'text-orange-400' :
                    latePatterns.severity === 'medium' ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {latePatterns.severity}
                  </span>
                </div>
                {latePatterns.mostLateDay && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-600">
                    <Calendar className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300">Most Late Day</span>
                    <span className="ml-auto text-sm font-bold text-blue-400">
                      {latePatterns.mostLateDay.day} ({latePatterns.mostLateDay.count}x)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Weekday Breakdown */}
          {problemWeekdays.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h5 className="text-sm font-semibold text-yellow-300 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Most Problematic Days
              </h5>
              <div className="grid grid-cols-3 gap-3">
                {problemWeekdays.map((day, index) => (
                  <div key={day.day} className="bg-slate-700/60 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-yellow-400 mb-1">#{index + 1}</div>
                    <div className="text-sm font-semibold text-white mb-1">{day.day}</div>
                    <div className="text-xs text-gray-400">{day.lateDays} late ({day.latePercentage}%)</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Burnout Signals */}
      {burnoutSignals && burnoutSignals.hasBurnoutSignals && (
        <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 backdrop-blur-sm border border-red-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-red-400" />
            <h4 className="text-lg font-bold text-white">Burnout Risk Indicators</h4>
            <span className="ml-auto px-3 py-1 bg-red-500/30 border border-red-500/50 rounded-full text-xs font-bold text-red-300 uppercase">
              Warning
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-orange-400" />
                <h5 className="text-sm font-semibold text-gray-300">Overtime</h5>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Overtime Days:</span>
                  <span className="text-orange-400 font-bold">{burnoutSignals.overtimeDaysCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Percentage:</span>
                  <span className="text-orange-400 font-bold">{burnoutSignals.overtimePercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Max Consecutive:</span>
                  <span className="text-red-400 font-bold">{burnoutSignals.maxConsecutiveOvertime} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg Weekly:</span>
                  <span className="text-orange-400 font-bold">{burnoutSignals.avgWeeklyOvertime}h</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Coffee className="w-4 h-4 text-yellow-400" />
                <h5 className="text-sm font-semibold text-gray-300">Break Patterns</h5>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Skipped Breaks:</span>
                  <span className="text-yellow-400 font-bold">{burnoutSignals.skippedBreakDays} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Percentage:</span>
                  <span className="text-yellow-400 font-bold">{burnoutSignals.skippedBreakPercentage}%</span>
                </div>
                {burnoutSignals.weekendWorkDays > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Weekend Work:</span>
                    <span className="text-red-400 font-bold">{burnoutSignals.weekendWorkDays} days</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/60 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h5 className="text-sm font-semibold text-gray-300">Risk Assessment</h5>
              </div>
              <div className="space-y-2">
                <div className={`text-center p-3 rounded-lg ${
                  burnoutSignals.severity === 'critical' ? 'bg-red-500/30 border border-red-500/50' :
                  burnoutSignals.severity === 'high' ? 'bg-orange-500/30 border border-orange-500/50' :
                  'bg-yellow-500/30 border border-yellow-500/50'
                }`}>
                  <div className="text-2xl font-bold text-white mb-1">
                    {burnoutSignals.severity === 'critical' ? '🚨' :
                     burnoutSignals.severity === 'high' ? '⚠️' : '⚡'}
                  </div>
                  <div className={`text-lg font-bold uppercase ${
                    burnoutSignals.severity === 'critical' ? 'text-red-300' :
                    burnoutSignals.severity === 'high' ? 'text-orange-300' :
                    'text-yellow-300'
                  }`}>
                    {burnoutSignals.severity}
                  </div>
                  <div className="text-xs text-gray-300 mt-1">Risk Level</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-300">
              <strong>⚠️ Action Required:</strong> Multiple burnout indicators detected. Consider workload review,
              schedule adjustment, or wellness check-in.
            </p>
          </div>
        </div>
      )}

      {/* Punctuality Trend */}
      {punctualityTrend && punctualityTrend.hasData && (
        <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            {punctualityTrend.trendDirection === 'improving' ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : punctualityTrend.trendDirection === 'declining' ? (
              <TrendingDown className="w-5 h-5 text-red-400" />
            ) : (
              <BarChart3 className="w-5 h-5 text-blue-400" />
            )}
            <h4 className="text-lg font-bold text-white">Punctuality Trend Analysis</h4>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Trend Comparison */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-center flex-1">
                  <div className="text-xs text-gray-400 mb-1">Previous Period</div>
                  <div className="text-3xl font-bold text-blue-400">{punctualityTrend.previousScore}%</div>
                </div>
                <ChevronRight className="w-6 h-6 text-gray-500" />
                <div className="text-center flex-1">
                  <div className="text-xs text-gray-400 mb-1">Current Period</div>
                  <div className={`text-3xl font-bold ${
                    punctualityTrend.trendDirection === 'improving' ? 'text-green-400' :
                    punctualityTrend.trendDirection === 'declining' ? 'text-red-400' :
                    'text-yellow-400'
                  }`}>
                    {punctualityTrend.currentScore}%
                  </div>
                </div>
              </div>

              {/* Change Indicator */}
              <div className={`p-4 rounded-lg text-center ${
                punctualityTrend.trendDirection === 'improving' ? 'bg-green-500/20 border border-green-500/50' :
                punctualityTrend.trendDirection === 'declining' ? 'bg-red-500/20 border border-red-500/50' :
                'bg-gray-500/20 border border-gray-500/50'
              }`}>
                <div className={`text-2xl font-bold ${
                  punctualityTrend.trendDirection === 'improving' ? 'text-green-300' :
                  punctualityTrend.trendDirection === 'declining' ? 'text-red-300' :
                  'text-gray-300'
                }`}>
                  {punctualityTrend.scoreDifference > 0 ? '+' : ''}{punctualityTrend.scoreDifference}%
                </div>
                <div className="text-xs text-gray-300 mt-1">
                  ({punctualityTrend.percentageChange > 0 ? '+' : ''}{punctualityTrend.percentageChange}% change)
                </div>
              </div>
            </div>

            {/* Status and Insights */}
            <div className="space-y-3">
              <div className="bg-slate-700/40 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-gray-300 mb-3">Status</h5>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Trend Direction:</span>
                    <span className={`text-sm font-bold uppercase ${
                      punctualityTrend.trendDirection === 'improving' ? 'text-green-400' :
                      punctualityTrend.trendDirection === 'declining' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {punctualityTrend.trendDirection}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Is Declining:</span>
                    <span className="text-sm font-bold text-white">
                      {punctualityTrend.isDeclining ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Significant Drop:</span>
                    <span className="text-sm font-bold text-white">
                      {punctualityTrend.isSignificantDrop ? 'YES ⚠️' : 'NO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Severity:</span>
                    <span className={`text-sm font-bold uppercase ${
                      punctualityTrend.severity === 'high' ? 'text-red-400' :
                      punctualityTrend.severity === 'medium' ? 'text-yellow-400' :
                      'text-green-400'
                    }`}>
                      {punctualityTrend.severity}
                    </span>
                  </div>
                </div>
              </div>

              {punctualityTrend.isSignificantDrop && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-xs text-red-300">
                    <AlertCircle className="w-3 h-3 inline mr-1" />
                    <strong>Alert:</strong> Significant punctuality drop detected. This requires immediate attention.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI-Enhanced Insights Section */}
      {analysis.aiEnhanced && analysis.aiInsights && (
        <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <span className="text-2xl">🤖</span>
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">AI-Powered Analysis</h4>
                <p className="text-xs text-purple-300">Enhanced with {analysis.aiInsights.model}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-lg">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-purple-300 font-medium">
                {analysis.aiInsights.confidence}% Confidence
              </span>
            </div>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-4 border border-purple-500/20">
            <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
              {analysis.aiInsights.assessment}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
            <span>Generated at {new Date(analysis.aiInsights.timestamp).toLocaleString()}</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
              Real AI Model
            </span>
          </div>
        </div>
      )}

      {/* Standard Insights Section */}
      {insights && insights.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm border border-slate-600/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-cyan-400" />
            <h4 className="text-lg font-bold text-white">
              {analysis.aiEnhanced ? 'Additional Insights' : 'Pattern Insights'}
            </h4>
          </div>

          <div className="space-y-2">
            {insights.filter(i => i.type !== 'ai').map((insight, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  insight.type === 'positive' ? 'bg-green-500/10 border border-green-500/30' :
                  insight.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                  'bg-blue-500/10 border border-blue-500/30'
                }`}
              >
                <span className="text-xl">{insight.icon}</span>
                <p className={`text-sm flex-1 ${
                  insight.type === 'positive' ? 'text-green-300' :
                  insight.type === 'warning' ? 'text-yellow-300' :
                  'text-blue-300'
                }`}>
                  {insight.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceInsights;
