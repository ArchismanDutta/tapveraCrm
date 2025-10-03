// attendanceDataConverter.js
// Helper service for converting between new and legacy attendance data formats

/**
 * Event type mappings between new and legacy systems
 */
export const EVENT_TYPE_MAPPINGS = {
  // New to Legacy
  newToLegacy: {
    'PUNCH_IN': 'Punch In',
    'PUNCH_OUT': 'Punch Out',
    'BREAK_START': 'Break Start',
    'BREAK_END': 'Resume Work'
  },
  // Legacy to New
  legacyToNew: {
    'Punch In': 'PUNCH_IN',
    'Punch Out': 'PUNCH_OUT',
    'Break Start': 'BREAK_START',
    'Resume Work': 'BREAK_END',
    'Break End': 'BREAK_END' // Alternative legacy format
  }
};

/**
 * Convert new system event to legacy format
 */
export function convertEventToLegacy(event) {
  if (!event) return null;

  return {
    type: EVENT_TYPE_MAPPINGS.newToLegacy[event.type] || event.type,
    time: event.timestamp,
    location: event.location,
    manual: event.manual || false,
    notes: event.notes
  };
}

/**
 * Convert legacy event to new format
 */
export function convertEventToNew(event) {
  if (!event) return null;

  return {
    type: EVENT_TYPE_MAPPINGS.legacyToNew[event.type] || 'PUNCH_IN',
    timestamp: event.time,
    location: event.location || 'Office',
    manual: event.manual || false,
    notes: event.notes || ''
  };
}

/**
 * Convert new system attendance data to legacy format
 */
export function convertAttendanceToLegacy(newData) {
  if (!newData) {
    console.warn('convertAttendanceToLegacy: No data provided');
    return null;
  }

  const attendance = newData.attendance || newData;
  if (!attendance) {
    console.warn('convertAttendanceToLegacy: No attendance data found');
    return null;
  }

  console.log('🔄 Converting attendance data:', {
    hasAttendance: !!attendance,
    currentlyWorking: attendance.currentlyWorking,
    onBreak: attendance.onBreak,
    workDurationSeconds: attendance.workDurationSeconds
  });

  const result = {
    userId: attendance.userId,
    currentlyWorking: attendance.currentlyWorking || false,
    onBreak: attendance.onBreak || false,
    currentStatus: attendance.currentStatus || 'NOT_STARTED',

    // Duration information
    workDuration: attendance.workDuration || '0h 0m',
    breakDuration: attendance.breakDuration || '0h 0m',
    workDurationSeconds: attendance.workDurationSeconds || 0,
    breakDurationSeconds: attendance.breakDurationSeconds || 0,

    // Time information
    arrivalTime: attendance.arrivalTime,
    departureTime: attendance.departureTime,
    arrivalTimeFormatted: formatTime(attendance.arrivalTime),

    // Status flags
    isLate: attendance.isLate || false,
    isHalfDay: attendance.isHalfDay || false,
    isAbsent: attendance.isAbsent !== false,
    isPresent: attendance.isPresent || false,

    // Convert events to timeline
    timeline: (attendance.events || []).map(convertEventToLegacy).filter(Boolean),

    // Performance metrics
    performance: attendance.performance || {
      punctualityScore: 0,
      attendanceScore: 0,
      efficiencyRating: 0
    },

    // Additional data from summary if available
    ...(newData.summary || {})
  };

  console.log('✅ Converted attendance result:', {
    currentlyWorking: result.currentlyWorking,
    onBreak: result.onBreak,
    workDurationSeconds: result.workDurationSeconds,
    breakDurationSeconds: result.breakDurationSeconds
  });

  return result;
}

/**
 * Convert new system weekly data to legacy format
 */
export function convertWeeklyDataToLegacy(newWeeklyData) {
  if (!newWeeklyData || !newWeeklyData.success) {
    console.warn('convertWeeklyDataToLegacy: Invalid input data:', newWeeklyData);
    return null;
  }

  const data = newWeeklyData.data;
  if (!data) {
    console.warn('convertWeeklyDataToLegacy: No data in response');
    return null;
  }

  console.log('🔄 Converting weekly data, input structure:', {
    hasData: !!data,
    hasWeeklyTotals: !!data.weeklyTotals,
    hasSummary: !!data.summary,
    hasAttendance: !!data.attendance,
    hasDailyData: !!data.dailyData,
    dataKeys: Object.keys(data)
  });

  // Try to find totals/summary data from different possible structures
  const totals = data.weeklyTotals || data.summary || data.totals || {};
  const dailyAttendance = data.dailyData || data.attendance || [];

  const result = {
    data: {
      dailyData: dailyAttendance.map(day => ({
        date: day.date,
        workDurationSeconds: day.workDurationSeconds || day.calculated?.workDurationSeconds || 0,
        breakDurationSeconds: day.breakDurationSeconds || day.calculated?.breakDurationSeconds || 0,
        isAbsent: day.isAbsent || !day.calculated?.isPresent || false,
        isLate: day.isLate || day.calculated?.isLate || false,
        isHalfDay: day.isHalfDay || day.calculated?.isHalfDay || false,
        isWFH: day.isWFH || false,
        arrivalTime: day.arrivalTime || day.calculated?.arrivalTime,
        timeline: (day.events || []).map(convertEventToLegacy).filter(Boolean)
      })),
      weeklySummary: {
        // Fields expected by SummaryCard component
        presentDays: totals.totalWorkDays || totals.presentDays || totals.totalPresent || 0,
        totalWork: convertDecimalHoursToTimeString(totals.totalWorkHours) ||
                   totals.totalWorkTime || totals.totalWork || '0h 0m',
        totalBreak: convertDecimalHoursToTimeString(totals.totalBreakHours) ||
                    totals.totalBreakTime || totals.totalBreak || '0h 0m',
        avgDailyWork: totals.avgDailyWork || calculateAvgDailyWork(totals, dailyAttendance),
        avgDailyBreak: totals.avgDailyBreak || calculateAvgDailyBreak(totals, dailyAttendance),
        onTimeRate: totals.averagePunctualityRate ?
                    Math.round(totals.averagePunctualityRate) + '%' :
                    (totals.onTimePercentage ? Math.round(totals.onTimePercentage) + '%' :
                    (totals.onTimeRate || '0%')),
        breaksTaken: totals.breaksTaken || calculateTotalBreaks(dailyAttendance),
        quickStats: {
          earlyArrivals: totals.earlyArrivals || 0,
          lateArrivals: totals.lateArrivals || totals.totalLate || totals.daysLate || 0,
          perfectDays: totals.perfectDays || 0
        },
        // Keep legacy field names for backward compatibility
        totalWorkTime: convertDecimalHoursToTimeString(totals.totalWorkHours) ||
                       totals.totalWorkTime || totals.totalWork || '0h 0m',
        totalBreakTime: convertDecimalHoursToTimeString(totals.totalBreakHours) ||
                        totals.totalBreakTime || totals.totalBreak || '0h 0m'
      }
    }
  };

  console.log('✅ Converted weekly data result:', {
    dailyDataCount: result.data.dailyData.length,
    presentDays: result.data.weeklySummary.presentDays,
    totalWork: result.data.weeklySummary.totalWork,
    totalBreak: result.data.weeklySummary.totalBreak,
    avgDailyWork: result.data.weeklySummary.avgDailyWork,
    onTimeRate: result.data.weeklySummary.onTimeRate
  });

  return result;
}

/**
 * Convert decimal hours to "Xh Ym" format
 */
function convertDecimalHoursToTimeString(decimalHours) {
  if (typeof decimalHours !== 'number' || decimalHours < 0) return null;

  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);

  return `${hours}h ${minutes}m`;
}

/**
 * Calculate average daily work time from totals and daily data
 */
function calculateAvgDailyWork(totals, dailyData) {
  if (totals.avgDailyWork) return totals.avgDailyWork;

  const workDays = totals.totalWorkDays || dailyData.filter(day =>
    (day.workDurationSeconds || 0) > 0 ||
    (day.calculated?.workDurationSeconds || 0) > 0
  ).length;

  if (workDays === 0) return '0h 0m';

  // Use decimal hours if available
  if (totals.totalWorkHours && typeof totals.totalWorkHours === 'number') {
    const avgDecimalHours = totals.totalWorkHours / workDays;
    return convertDecimalHoursToTimeString(avgDecimalHours);
  }

  // Fallback to parsing time strings
  const totalWorkStr = totals.totalWorkTime || totals.totalWork || '0h 0m';
  const totalMinutes = parseTimeStringToMinutes(totalWorkStr);
  const avgMinutes = Math.floor(totalMinutes / workDays);

  return formatMinutesToTimeString(avgMinutes);
}

/**
 * Calculate average daily break time
 */
function calculateAvgDailyBreak(totals, dailyData) {
  if (totals.avgDailyBreak) return totals.avgDailyBreak;

  const workDays = totals.totalWorkDays || dailyData.filter(day =>
    (day.breakDurationSeconds || 0) > 0 ||
    (day.calculated?.breakDurationSeconds || 0) > 0
  ).length;

  if (workDays === 0) return '0h 0m';

  // Use decimal hours if available
  if (totals.totalBreakHours && typeof totals.totalBreakHours === 'number') {
    const avgDecimalHours = totals.totalBreakHours / workDays;
    return convertDecimalHoursToTimeString(avgDecimalHours);
  }

  // Fallback to parsing time strings
  const totalBreakStr = totals.totalBreakTime || totals.totalBreak || '0h 0m';
  const totalMinutes = parseTimeStringToMinutes(totalBreakStr);
  const avgMinutes = Math.floor(totalMinutes / workDays);

  return formatMinutesToTimeString(avgMinutes);
}

/**
 * Calculate total breaks taken from daily data
 */
function calculateTotalBreaks(dailyData) {
  if (!Array.isArray(dailyData)) return 0;

  return dailyData.reduce((total, day) => {
    const events = day.events || [];
    const breakStarts = events.filter(event =>
      event.type === 'BREAK_START' ||
      event.type === 'Break Start'
    ).length;
    return total + breakStarts;
  }, 0);
}

/**
 * Parse time string like "2h 30m" to minutes
 */
function parseTimeStringToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;

  const hourMatch = timeStr.match(/(\d+)h/);
  const minuteMatch = timeStr.match(/(\d+)m/);

  const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;

  return hours * 60 + minutes;
}

/**
 * Format minutes to "Xh Ym" string
 */
function formatMinutesToTimeString(totalMinutes) {
  if (totalMinutes === 0) return '0h 0m';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

/**
 * Format time for display
 */
function formatTime(date) {
  if (!date) return null;

  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Convert legacy break type to new system format
 */
export function convertBreakType(legacyType) {
  const breakTypeMap = {
    'Lunch Break': 'LUNCH',
    'Tea Break': 'TEA',
    'Coffee Break': 'COFFEE',
    'Rest Break': 'REST',
    'Personal Break': 'PERSONAL'
  };

  return breakTypeMap[legacyType] || 'BREAK';
}

/**
 * Convert new system status to legacy status
 */
export function convertStatusToLegacy(newStatus) {
  const statusMap = {
    'NOT_STARTED': { currentlyWorking: false, onBreak: false },
    'WORKING': { currentlyWorking: true, onBreak: false },
    'ON_BREAK': { currentlyWorking: false, onBreak: true },
    'FINISHED': { currentlyWorking: false, onBreak: false }
  };

  return statusMap[newStatus] || { currentlyWorking: false, onBreak: false };
}

/**
 * Convert legacy status to new system status
 */
export function convertStatusToNew(currentlyWorking, onBreak) {
  if (!currentlyWorking && !onBreak) return 'NOT_STARTED';
  if (currentlyWorking && !onBreak) return 'WORKING';
  if (onBreak) return 'ON_BREAK';
  return 'FINISHED';
}

/**
 * Extract event type from legacy event string (handles break types)
 */
export function extractEventType(eventTypeString) {
  const normalized = String(eventTypeString || '').toLowerCase().trim();

  if (normalized.includes('punch') && normalized.includes('in')) return 'PUNCH_IN';
  if (normalized.includes('punch') && normalized.includes('out')) return 'PUNCH_OUT';
  if (normalized.includes('break') && normalized.includes('start')) return 'BREAK_START';
  if (normalized.includes('resume')) return 'BREAK_END';

  // Default fallback
  return 'PUNCH_IN';
}

/**
 * Validate and sanitize attendance data
 */
export function validateAttendanceData(data) {
  if (!data || typeof data !== 'object') return null;

  return {
    ...data,
    workDurationSeconds: Math.max(0, Number(data.workDurationSeconds) || 0),
    breakDurationSeconds: Math.max(0, Number(data.breakDurationSeconds) || 0),
    currentlyWorking: Boolean(data.currentlyWorking),
    onBreak: Boolean(data.onBreak),
    timeline: Array.isArray(data.timeline) ? data.timeline : []
  };
}

export default {
  EVENT_TYPE_MAPPINGS,
  convertEventToLegacy,
  convertEventToNew,
  convertAttendanceToLegacy,
  convertWeeklyDataToLegacy,
  convertBreakType,
  convertStatusToLegacy,
  convertStatusToNew,
  extractEventType,
  validateAttendanceData
};