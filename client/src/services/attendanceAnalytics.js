/**
 * AI-Powered Attendance Analytics Service
 * Detects patterns, anomalies, and provides intelligent insights
 */

class AttendanceAnalyticsService {
  /**
   * Analyze employee attendance data for patterns and anomalies
   * @param {Array} dailyData - Array of daily attendance records
   * @param {Object} options - Analysis options (lookbackPeriod, thresholds, etc.)
   * @returns {Object} Analysis results with insights, alerts, and patterns
   */
  analyzeAttendancePatterns(dailyData, options = {}) {
    const {
      lookbackPeriod = 30, // days
      lateThreshold = 3, // consecutive late days
      overtimeThreshold = 10, // hours per week
      punctualityDropThreshold = 40, // percentage drop
      minDataPoints = 5 // minimum days of data required
    } = options;

    if (!Array.isArray(dailyData) || dailyData.length < minDataPoints) {
      return this._emptyAnalysis();
    }

    // Sort by date (most recent first)
    const sortedData = [...dailyData].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Perform various analyses
    const latePatterns = this._detectLatePatterns(sortedData);
    const burnoutSignals = this._detectBurnoutSignals(sortedData, overtimeThreshold);
    const punctualityTrend = this._analyzePunctualityTrend(sortedData, punctualityDropThreshold);
    const irregularPatterns = this._detectIrregularWorkHours(sortedData);
    const breakPatterns = this._analyzeBreakPatterns(sortedData);
    const weekdayPatterns = this._analyzeWeekdayPatterns(sortedData);

    // Generate smart alerts
    const alerts = this._generateSmartAlerts({
      latePatterns,
      burnoutSignals,
      punctualityTrend,
      irregularPatterns,
      breakPatterns
    });

    // Calculate risk scores
    const riskScore = this._calculateRiskScore({
      latePatterns,
      burnoutSignals,
      punctualityTrend,
      irregularPatterns,
      breakPatterns
    });

    return {
      summary: {
        totalDays: sortedData.length,
        lateDays: latePatterns.lateDaysCount,
        latePercentage: latePatterns.latePercentage,
        averageWorkHours: this._calculateAverageWorkHours(sortedData),
        punctualityScore: punctualityTrend.currentScore,
        riskLevel: riskScore.level,
        riskScore: riskScore.score
      },
      latePatterns,
      burnoutSignals,
      punctualityTrend,
      irregularPatterns,
      breakPatterns,
      weekdayPatterns,
      alerts,
      riskScore,
      insights: this._generateInsights({
        latePatterns,
        burnoutSignals,
        punctualityTrend,
        irregularPatterns,
        breakPatterns,
        weekdayPatterns
      })
    };
  }

  /**
   * Detect late arrival patterns
   */
  _detectLatePatterns(data) {
    // Match SuperAdminAttendancePortal logic exactly:
    // Priority: WFH+Present > Absent > HalfDay > Late
    // Only count as late if NOT in higher priority categories
    const lateDays = data.filter(d => {
      // Exclude if WFH and present (highest priority after absent)
      if (d.isWFH && d.isPresent) return false;
      // Exclude if absent
      if (d.isAbsent) return false;
      // Exclude if half-day (takes priority over late)
      if (d.isHalfDay) return false;
      // Now check if late
      return d.isLate;
    });
    const lateDaysCount = lateDays.length;
    const latePercentage = data.length > 0 ? (lateDaysCount / data.length) * 100 : 0;

    // 🔍 Debug logging for late pattern detection
    const allLateMarked = data.filter(d => d.isLate);
    console.log('🔍 Analytics Late Pattern Detection:', {
      totalDays: data.length,
      allDaysMarkedLate: allLateMarked.length,
      actuallyCountedAsLate: lateDaysCount,
      excluded: allLateMarked.length - lateDaysCount,
      excludedBreakdown: {
        wfhPresent: allLateMarked.filter(d => d.isWFH && d.isPresent).length,
        absent: allLateMarked.filter(d => d.isAbsent).length,
        halfDay: allLateMarked.filter(d => d.isHalfDay).length
      }
    });

    // Detect consecutive late days (matching SuperAdmin priority logic)
    let maxConsecutiveLate = 0;
    let currentStreak = 0;
    let consecutivePatterns = [];
    let currentPattern = [];

    data.forEach((day, index) => {
      // Use same priority logic: exclude WFH+Present, Absent, HalfDay
      const isActuallyLate = day.isLate &&
                             !(day.isWFH && day.isPresent) &&
                             !day.isAbsent &&
                             !day.isHalfDay;

      if (isActuallyLate) {
        currentStreak++;
        currentPattern.push(day);
        if (currentStreak > maxConsecutiveLate) {
          maxConsecutiveLate = currentStreak;
        }
      } else {
        if (currentStreak >= 2) {
          consecutivePatterns.push([...currentPattern]);
        }
        currentStreak = 0;
        currentPattern = [];
      }
    });

    // Add final pattern if exists
    if (currentStreak >= 2) {
      consecutivePatterns.push([...currentPattern]);
    }

    // Calculate late minutes statistics
    // Backend provides lateMinutes at top level (from calculated field)
    const lateMinutes = lateDays
      .map(d => d.lateMinutes || d.metadata?.lateMinutes || 0)
      .filter(m => m > 0);

    // 🔍 Debug: Log late minutes data
    console.log('🔍 Late Minutes Data:', {
      lateDaysCount: lateDays.length,
      lateDaysWithMinutes: lateDays.map(d => ({
        date: d.date,
        lateMinutes: d.lateMinutes,
        fromMetadata: d.metadata?.lateMinutes
      })),
      validLateMinutes: lateMinutes,
      avgCalculated: lateMinutes.length > 0 ? lateMinutes.reduce((sum, m) => sum + m, 0) / lateMinutes.length : 0
    });

    const avgLateMinutes = lateMinutes.length > 0
      ? lateMinutes.reduce((sum, m) => sum + m, 0) / lateMinutes.length
      : 0;

    const maxLateMinutes = lateMinutes.length > 0 ? Math.max(...lateMinutes) : 0;

    // Detect trend (increasing late arrivals, matching SuperAdmin priority logic)
    const recentLate = data.slice(0, 7).filter(d =>
      d.isLate && !(d.isWFH && d.isPresent) && !d.isAbsent && !d.isHalfDay
    ).length; // Last 7 days
    const olderLate = data.slice(7, 14).filter(d =>
      d.isLate && !(d.isWFH && d.isPresent) && !d.isAbsent && !d.isHalfDay
    ).length; // Previous 7 days
    const isIncreasing = recentLate > olderLate && recentLate >= 2;

    // Day of week pattern
    const lateByDayOfWeek = this._groupByDayOfWeek(lateDays);
    const mostLateDay = this._getMostFrequentDay(lateByDayOfWeek);

    return {
      lateDaysCount,
      latePercentage: Math.round(latePercentage * 10) / 10,
      maxConsecutiveLate,
      consecutivePatterns,
      avgLateMinutes: Math.round(avgLateMinutes),
      maxLateMinutes,
      isIncreasing,
      mostLateDay,
      lateByDayOfWeek,
      hasPattern: maxConsecutiveLate >= 2 || latePercentage > 20,
      severity: this._calculateLateSeverity(latePercentage, maxConsecutiveLate, isIncreasing)
    };
  }

  /**
   * Detect burnout signals
   */
  _detectBurnoutSignals(data, overtimeThreshold) {
    const standardHours = 7.5;
    const standardWeeklyHours = standardHours * 5;

    // Calculate overtime days
    const overtimeDays = data.filter(d => {
      const hours = (d.workDurationSeconds || 0) / 3600;
      return hours > (standardHours + 1); // More than 1 hour overtime
    });

    const overtimeDaysCount = overtimeDays.length;
    const overtimePercentage = data.length > 0 ? (overtimeDaysCount / data.length) * 100 : 0;

    // Calculate total overtime hours
    const totalOvertimeHours = overtimeDays.reduce((sum, d) => {
      const hours = (d.workDurationSeconds || 0) / 3600;
      return sum + Math.max(0, hours - standardHours);
    }, 0);

    // Detect consecutive overtime days
    let maxConsecutiveOvertime = 0;
    let currentStreak = 0;

    data.forEach(day => {
      const hours = (day.workDurationSeconds || 0) / 3600;
      if (hours > (standardHours + 1)) {
        currentStreak++;
        if (currentStreak > maxConsecutiveOvertime) {
          maxConsecutiveOvertime = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    });

    // Analyze break patterns
    const skippedBreakDays = data.filter(d => {
      const breakHours = (d.breakDurationSeconds || 0) / 3600;
      return d.isPresent && !d.isAbsent && breakHours < 0.25; // Less than 15 min break
    });

    const skippedBreakPercentage = data.length > 0
      ? (skippedBreakDays.length / data.filter(d => d.isPresent).length) * 100
      : 0;

    // Weekend work detection (if data includes weekends)
    const weekendWork = data.filter(d => {
      const date = new Date(d.date);
      const dayOfWeek = date.getDay();
      return (dayOfWeek === 0 || dayOfWeek === 6) && (d.workDurationSeconds || 0) > 0;
    });

    // Calculate weekly averages
    const weeks = this._groupByWeek(data);
    const weeklyOvertimeHours = weeks.map(week => {
      const totalHours = week.reduce((sum, d) => sum + (d.workDurationSeconds || 0) / 3600, 0);
      return Math.max(0, totalHours - standardWeeklyHours);
    });

    const avgWeeklyOvertime = weeklyOvertimeHours.length > 0
      ? weeklyOvertimeHours.reduce((sum, h) => sum + h, 0) / weeklyOvertimeHours.length
      : 0;

    const hasBurnoutSignals =
      overtimePercentage > 40 ||
      maxConsecutiveOvertime >= 5 ||
      skippedBreakPercentage > 50 ||
      avgWeeklyOvertime > overtimeThreshold;

    return {
      overtimeDaysCount,
      overtimePercentage: Math.round(overtimePercentage * 10) / 10,
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      maxConsecutiveOvertime,
      avgWeeklyOvertime: Math.round(avgWeeklyOvertime * 10) / 10,
      skippedBreakDays: skippedBreakDays.length,
      skippedBreakPercentage: Math.round(skippedBreakPercentage * 10) / 10,
      weekendWorkDays: weekendWork.length,
      hasBurnoutSignals,
      severity: this._calculateBurnoutSeverity(
        overtimePercentage,
        maxConsecutiveOvertime,
        skippedBreakPercentage,
        avgWeeklyOvertime,
        overtimeThreshold
      )
    };
  }

  /**
   * Analyze punctuality trend
   */
  _analyzePunctualityTrend(data, dropThreshold) {
    if (data.length < 10) {
      return { hasData: false };
    }

    // Split data into current and previous periods
    const midPoint = Math.floor(data.length / 2);
    const currentPeriod = data.slice(0, midPoint);
    const previousPeriod = data.slice(midPoint);

    // On-time means: present AND NOT counted as late (using priority logic)
    // Using priority logic: late only if NOT (WFH+Present OR Absent OR HalfDay)
    const currentOnTime = currentPeriod.filter(d =>
      d.isPresent && !(d.isLate && !(d.isWFH && d.isPresent) && !d.isAbsent && !d.isHalfDay)
    ).length;
    const currentPresent = currentPeriod.filter(d => d.isPresent).length;
    const currentScore = currentPresent > 0 ? (currentOnTime / currentPresent) * 100 : 0;

    const previousOnTime = previousPeriod.filter(d =>
      d.isPresent && !(d.isLate && !(d.isWFH && d.isPresent) && !d.isAbsent && !d.isHalfDay)
    ).length;
    const previousPresent = previousPeriod.filter(d => d.isPresent).length;
    const previousScore = previousPresent > 0 ? (previousOnTime / previousPresent) * 100 : 0;

    const scoreDifference = currentScore - previousScore;
    const percentageChange = previousScore > 0
      ? (scoreDifference / previousScore) * 100
      : 0;

    const isDeclining = scoreDifference < 0;
    const isSignificantDrop = isDeclining && Math.abs(percentageChange) >= dropThreshold;

    // Calculate trend direction
    let trendDirection = 'stable';
    if (Math.abs(percentageChange) < 10) {
      trendDirection = 'stable';
    } else if (percentageChange > 0) {
      trendDirection = 'improving';
    } else {
      trendDirection = 'declining';
    }

    return {
      hasData: true,
      currentScore: Math.round(currentScore * 10) / 10,
      previousScore: Math.round(previousScore * 10) / 10,
      scoreDifference: Math.round(scoreDifference * 10) / 10,
      percentageChange: Math.round(percentageChange * 10) / 10,
      isDeclining,
      isSignificantDrop,
      trendDirection,
      severity: isSignificantDrop ? 'high' : (isDeclining ? 'medium' : 'low')
    };
  }

  /**
   * Detect irregular work hours
   */
  _detectIrregularWorkHours(data) {
    const workHours = data
      .filter(d => d.isPresent && !d.isAbsent)
      .map(d => (d.workDurationSeconds || 0) / 3600);

    if (workHours.length < 3) {
      return { hasData: false };
    }

    const avgHours = workHours.reduce((sum, h) => sum + h, 0) / workHours.length;

    // Calculate standard deviation
    const squaredDiffs = workHours.map(h => Math.pow(h - avgHours, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / workHours.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation (CV) - measures relative variability
    const coefficientOfVariation = avgHours > 0 ? (stdDev / avgHours) * 100 : 0;

    // Detect outliers (hours that deviate significantly from mean)
    const outliers = data.filter(d => {
      const hours = (d.workDurationSeconds || 0) / 3600;
      return d.isPresent && Math.abs(hours - avgHours) > (2 * stdDev);
    });

    // Determine if work pattern is irregular
    const isIrregular = coefficientOfVariation > 25 || outliers.length > (data.length * 0.2);

    return {
      hasData: true,
      avgHours: Math.round(avgHours * 10) / 10,
      stdDev: Math.round(stdDev * 10) / 10,
      coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10,
      outlierCount: outliers.length,
      isIrregular,
      severity: coefficientOfVariation > 40 ? 'high' : (coefficientOfVariation > 25 ? 'medium' : 'low')
    };
  }

  /**
   * Analyze break patterns
   */
  _analyzeBreakPatterns(data) {
    const presentDays = data.filter(d => d.isPresent && !d.isAbsent);

    if (presentDays.length < 3) {
      return { hasData: false };
    }

    const breakData = presentDays.map(d => ({
      date: d.date,
      breakHours: (d.breakDurationSeconds || 0) / 3600,
      breakSessions: d.metadata?.breakSessions || 0
    }));

    const avgBreakHours = breakData.reduce((sum, d) => sum + d.breakHours, 0) / breakData.length;
    const avgBreakSessions = breakData.reduce((sum, d) => sum + d.breakSessions, 0) / breakData.length;

    // Detect days with insufficient breaks (< 30 min for full day work)
    const insufficientBreaks = breakData.filter(d => d.breakHours < 0.5 && d.breakHours >= 0);
    const noBreaks = breakData.filter(d => d.breakHours === 0);

    const insufficientBreakPercentage = (insufficientBreaks.length / presentDays.length) * 100;
    const noBreakPercentage = (noBreaks.length / presentDays.length) * 100;

    // Detect consecutive days without proper breaks
    let maxConsecutiveNoBrakes = 0;
    let currentStreak = 0;

    presentDays.forEach(day => {
      const breakHours = (day.breakDurationSeconds || 0) / 3600;
      if (breakHours < 0.5) {
        currentStreak++;
        if (currentStreak > maxConsecutiveNoBrakes) {
          maxConsecutiveNoBrakes = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    });

    const hasIssue = noBreakPercentage > 30 || maxConsecutiveNoBrakes >= 3;

    return {
      hasData: true,
      avgBreakHours: Math.round(avgBreakHours * 10) / 10,
      avgBreakSessions: Math.round(avgBreakSessions * 10) / 10,
      insufficientBreakDays: insufficientBreaks.length,
      insufficientBreakPercentage: Math.round(insufficientBreakPercentage * 10) / 10,
      noBreakDays: noBreaks.length,
      noBreakPercentage: Math.round(noBreakPercentage * 10) / 10,
      maxConsecutiveNoBrakes,
      hasIssue,
      severity: maxConsecutiveNoBrakes >= 5 ? 'high' : (hasIssue ? 'medium' : 'low')
    };
  }

  /**
   * Analyze weekday patterns
   */
  _analyzeWeekdayPatterns(data) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayStats = {};

    daysOfWeek.forEach(day => {
      weekdayStats[day] = {
        totalDays: 0,
        lateDays: 0,
        presentDays: 0,
        avgWorkHours: 0,
        totalWorkHours: 0
      };
    });

    data.forEach(d => {
      const date = new Date(d.date);
      const dayOfWeek = daysOfWeek[date.getDay()];
      const workHours = (d.workDurationSeconds || 0) / 3600;

      weekdayStats[dayOfWeek].totalDays++;
      // Match SuperAdmin priority logic for late count
      if (d.isLate && !(d.isWFH && d.isPresent) && !d.isAbsent && !d.isHalfDay) {
        weekdayStats[dayOfWeek].lateDays++;
      }
      if (d.isPresent) weekdayStats[dayOfWeek].presentDays++;
      weekdayStats[dayOfWeek].totalWorkHours += workHours;
    });

    // Calculate averages
    Object.keys(weekdayStats).forEach(day => {
      const stats = weekdayStats[day];
      stats.avgWorkHours = stats.totalDays > 0
        ? Math.round((stats.totalWorkHours / stats.totalDays) * 10) / 10
        : 0;
      stats.latePercentage = stats.totalDays > 0
        ? Math.round((stats.lateDays / stats.totalDays) * 100 * 10) / 10
        : 0;
    });

    return weekdayStats;
  }

  /**
   * Generate smart alerts
   */
  _generateSmartAlerts(analysis) {
    const alerts = [];

    // Late pattern alerts
    if (analysis.latePatterns.maxConsecutiveLate >= 3) {
      alerts.push({
        type: 'warning',
        severity: 'high',
        category: 'punctuality',
        title: 'Consecutive Late Arrivals Detected',
        message: `Employee has been late ${analysis.latePatterns.maxConsecutiveLate} days in a row. This pattern needs attention.`,
        icon: '⚠️',
        metric: analysis.latePatterns.maxConsecutiveLate
      });
    }

    if (analysis.latePatterns.isIncreasing) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        category: 'punctuality',
        title: 'Increasing Late Arrival Trend',
        message: `Late arrivals have increased recently. Recent pattern shows more frequent tardiness.`,
        icon: '📈',
        metric: analysis.latePatterns.lateDaysCount
      });
    }

    if (analysis.latePatterns.latePercentage > 30) {
      alerts.push({
        type: 'alert',
        severity: 'high',
        category: 'punctuality',
        title: 'High Late Arrival Rate',
        message: `Employee is late ${analysis.latePatterns.latePercentage}% of the time. Consider intervention.`,
        icon: '🔴',
        metric: `${analysis.latePatterns.latePercentage}%`
      });
    }

    // Punctuality trend alerts
    if (analysis.punctualityTrend.isSignificantDrop) {
      alerts.push({
        type: 'alert',
        severity: 'high',
        category: 'punctuality',
        title: 'Punctuality Score Dropped Significantly',
        message: `Punctuality dropped ${Math.abs(analysis.punctualityTrend.percentageChange).toFixed(1)}% - potential issue requiring attention.`,
        icon: '📉',
        metric: `${analysis.punctualityTrend.scoreDifference.toFixed(1)}%`
      });
    }

    // Burnout alerts
    if (analysis.burnoutSignals.maxConsecutiveOvertime >= 5) {
      alerts.push({
        type: 'danger',
        severity: 'high',
        category: 'burnout',
        title: 'Extended Overtime Period',
        message: `Employee worked overtime for ${analysis.burnoutSignals.maxConsecutiveOvertime} consecutive days. High burnout risk.`,
        icon: '🔥',
        metric: analysis.burnoutSignals.maxConsecutiveOvertime
      });
    }

    if (analysis.burnoutSignals.skippedBreakPercentage > 50) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        category: 'burnout',
        title: 'Insufficient Break Time',
        message: `Employee skipped or took minimal breaks on ${analysis.burnoutSignals.skippedBreakPercentage}% of work days.`,
        icon: '⏸️',
        metric: `${analysis.burnoutSignals.skippedBreakPercentage}%`
      });
    }

    if (analysis.burnoutSignals.avgWeeklyOvertime > 10) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        category: 'burnout',
        title: 'Consistent Overtime Pattern',
        message: `Average weekly overtime is ${analysis.burnoutSignals.avgWeeklyOvertime.toFixed(1)} hours. Monitor workload.`,
        icon: '⏰',
        metric: `${analysis.burnoutSignals.avgWeeklyOvertime.toFixed(1)}h/week`
      });
    }

    // Break pattern alerts
    if (analysis.breakPatterns.hasData && analysis.breakPatterns.maxConsecutiveNoBrakes >= 3) {
      alerts.push({
        type: 'warning',
        severity: 'medium',
        category: 'wellness',
        title: 'No Breaks Taken',
        message: `Employee didn't take proper breaks for ${analysis.breakPatterns.maxConsecutiveNoBrakes} consecutive days.`,
        icon: '🚫',
        metric: analysis.breakPatterns.maxConsecutiveNoBrakes
      });
    }

    // Irregular work hours alert
    if (analysis.irregularPatterns.hasData && analysis.irregularPatterns.isIrregular) {
      alerts.push({
        type: 'info',
        severity: 'low',
        category: 'pattern',
        title: 'Irregular Work Hours Detected',
        message: `Work hours show high variability (CV: ${analysis.irregularPatterns.coefficientOfVariation}%). Pattern is inconsistent.`,
        icon: '📊',
        metric: `CV: ${analysis.irregularPatterns.coefficientOfVariation}%`
      });
    }

    return alerts;
  }

  /**
   * Calculate overall risk score
   */
  _calculateRiskScore(analysis) {
    let score = 0;
    const weights = {
      late: 0.25,
      burnout: 0.35,
      punctuality: 0.25,
      breaks: 0.15
    };

    // Late pattern score (0-100)
    const lateScore = Math.min(100, analysis.latePatterns.latePercentage * 2 +
      analysis.latePatterns.maxConsecutiveLate * 10);

    // Burnout score (0-100)
    const burnoutScore = Math.min(100,
      (analysis.burnoutSignals.overtimePercentage / 2) +
      (analysis.burnoutSignals.maxConsecutiveOvertime * 8) +
      (analysis.burnoutSignals.skippedBreakPercentage / 2)
    );

    // Punctuality trend score (0-100)
    const punctualityScore = analysis.punctualityTrend.hasData
      ? Math.min(100, Math.abs(analysis.punctualityTrend.percentageChange))
      : 0;

    // Break pattern score (0-100)
    const breakScore = analysis.breakPatterns.hasData
      ? Math.min(100, analysis.breakPatterns.noBreakPercentage +
          analysis.breakPatterns.maxConsecutiveNoBrakes * 10)
      : 0;

    // Calculate weighted score
    score = (lateScore * weights.late) +
            (burnoutScore * weights.burnout) +
            (punctualityScore * weights.punctuality) +
            (breakScore * weights.breaks);

    // Determine risk level
    let level = 'low';
    if (score >= 60) level = 'critical';
    else if (score >= 40) level = 'high';
    else if (score >= 20) level = 'medium';

    return {
      score: Math.round(score),
      level,
      breakdown: {
        late: Math.round(lateScore),
        burnout: Math.round(burnoutScore),
        punctuality: Math.round(punctualityScore),
        breaks: Math.round(breakScore)
      }
    };
  }

  /**
   * Generate human-readable insights
   */
  _generateInsights(analysis) {
    const insights = [];

    // Positive insights
    if (analysis.latePatterns.latePercentage < 10) {
      insights.push({
        type: 'positive',
        message: `Excellent punctuality with only ${analysis.latePatterns.lateDaysCount} late days`,
        icon: '✅'
      });
    }

    if (analysis.punctualityTrend.hasData && analysis.punctualityTrend.trendDirection === 'improving') {
      insights.push({
        type: 'positive',
        message: `Punctuality is improving by ${Math.abs(analysis.punctualityTrend.percentageChange).toFixed(1)}%`,
        icon: '📈'
      });
    }

    // Pattern insights
    if (analysis.latePatterns.mostLateDay) {
      insights.push({
        type: 'pattern',
        message: `Most late arrivals occur on ${analysis.latePatterns.mostLateDay.day} (${analysis.latePatterns.mostLateDay.count} times)`,
        icon: '📅'
      });
    }

    if (analysis.burnoutSignals.hasBurnoutSignals) {
      insights.push({
        type: 'warning',
        message: `Burnout indicators detected: ${analysis.burnoutSignals.overtimeDaysCount} overtime days, ${analysis.burnoutSignals.skippedBreakDays} days with insufficient breaks`,
        icon: '⚠️'
      });
    }

    // Work pattern insights
    if (analysis.irregularPatterns.hasData && !analysis.irregularPatterns.isIrregular) {
      insights.push({
        type: 'positive',
        message: `Consistent work pattern with average ${analysis.irregularPatterns.avgHours}h per day`,
        icon: '⏱️'
      });
    }

    return insights;
  }

  /**
   * Helper: Calculate late severity
   */
  _calculateLateSeverity(percentage, consecutive, isIncreasing) {
    if (percentage > 40 || consecutive >= 5) return 'critical';
    if (percentage > 25 || consecutive >= 3 || isIncreasing) return 'high';
    if (percentage > 15 || consecutive >= 2) return 'medium';
    return 'low';
  }

  /**
   * Helper: Calculate burnout severity
   */
  _calculateBurnoutSeverity(overtimePercentage, consecutive, breakPercentage, avgWeekly, threshold) {
    if (consecutive >= 7 || avgWeekly > threshold * 1.5 || breakPercentage > 70) return 'critical';
    if (consecutive >= 5 || avgWeekly > threshold || breakPercentage > 50) return 'high';
    if (consecutive >= 3 || overtimePercentage > 30 || breakPercentage > 30) return 'medium';
    return 'low';
  }

  /**
   * Helper: Group data by day of week
   */
  _groupByDayOfWeek(data) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const grouped = {};

    data.forEach(d => {
      const date = new Date(d.date);
      const dayName = daysOfWeek[date.getDay()];
      if (!grouped[dayName]) grouped[dayName] = [];
      grouped[dayName].push(d);
    });

    return grouped;
  }

  /**
   * Helper: Get most frequent day
   */
  _getMostFrequentDay(groupedData) {
    let maxCount = 0;
    let maxDay = null;

    Object.keys(groupedData).forEach(day => {
      const count = groupedData[day].length;
      if (count > maxCount) {
        maxCount = count;
        maxDay = day;
      }
    });

    return maxDay ? { day: maxDay, count: maxCount } : null;
  }

  /**
   * Helper: Group data by week
   */
  _groupByWeek(data) {
    const weeks = [];
    let currentWeek = [];
    let lastWeekNum = null;

    data.forEach(d => {
      const date = new Date(d.date);
      const weekNum = this._getWeekNumber(date);

      if (lastWeekNum !== null && weekNum !== lastWeekNum) {
        if (currentWeek.length > 0) {
          weeks.push([...currentWeek]);
        }
        currentWeek = [];
      }

      currentWeek.push(d);
      lastWeekNum = weekNum;
    });

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }

  /**
   * Helper: Get week number
   */
  _getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Helper: Calculate average work hours
   */
  _calculateAverageWorkHours(data) {
    const presentDays = data.filter(d => d.isPresent && !d.isAbsent);
    if (presentDays.length === 0) return 0;

    const totalHours = presentDays.reduce((sum, d) =>
      sum + (d.workDurationSeconds || 0) / 3600, 0);

    return Math.round((totalHours / presentDays.length) * 10) / 10;
  }

  /**
   * Helper: Return empty analysis
   */
  _emptyAnalysis() {
    return {
      summary: {
        totalDays: 0,
        lateDays: 0,
        latePercentage: 0,
        averageWorkHours: 0,
        punctualityScore: 0,
        riskLevel: 'low',
        riskScore: 0
      },
      latePatterns: { hasData: false },
      burnoutSignals: { hasData: false },
      punctualityTrend: { hasData: false },
      irregularPatterns: { hasData: false },
      breakPatterns: { hasData: false },
      weekdayPatterns: {},
      alerts: [],
      riskScore: { score: 0, level: 'low', breakdown: {} },
      insights: []
    };
  }
}

export default new AttendanceAnalyticsService();
