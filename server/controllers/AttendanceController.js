
// controllers/AttendanceController.js
// Complete API controller for the new date-centric attendance system
const AttendanceService = require('../services/AttendanceService');

class AttendanceController {
  constructor() {
    this.service = new AttendanceService();
  }

  /**
   * Record punch action (punch in/out, break start/end)
   * POST /api/attendance/punch
   */
  async punchAction(req, res) {
    try {
      const { action, location, notes } = req.body;
      const userId = req.user._id;

      // Validate action
      const validActions = ['PUNCH_IN', 'PUNCH_OUT', 'BREAK_START', 'BREAK_END'];
      if (!validActions.includes(action)) {
        return res.status(400).json({
          success: false,
          error: `Invalid action. Must be one of: ${validActions.join(', ')}`
        });
      }

      const result = await this.service.recordPunchEvent(userId, action, {
        location,
        notes,
        ipAddress: req.ip,
        device: req.get('User-Agent'),
        manual: false
      });

      // Log the action for audit
      console.log(`User ${userId} performed ${action} at ${new Date().toISOString()}`);

      res.json({
        success: true,
        data: {
          currentStatus: result.employee.calculated.currentStatus,
          workDuration: result.employee.calculated.workDuration,
          breakDuration: result.employee.calculated.breakDuration,
          arrivalTime: result.employee.calculated.arrivalTime,
          departureTime: result.employee.calculated.departureTime,
          isLate: result.employee.calculated.isLate,
          currentlyWorking: result.employee.calculated.currentlyWorking,
          onBreak: result.employee.calculated.onBreak,
          lastEvent: result.event
        },
        message: result.message
      });

    } catch (error) {
      console.error('Error in punchAction:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get today's attendance status for authenticated user
   * GET /api/attendance/today
   */
  async getTodayStatus(req, res) {
    try {
      const userId = req.user._id;
      const today = new Date();

      const attendance = await this.service.getEmployeeAttendance(userId, today, today);

      const todayData = attendance.data[0] || null;

      res.json({
        success: true,
        data: {
          date: today,
          attendance: todayData,
          summary: {
            canPunchIn: !todayData || todayData.currentStatus === 'NOT_STARTED' || todayData.currentStatus === 'FINISHED',
            canPunchOut: todayData && (todayData.currentStatus === 'WORKING' || todayData.currentStatus === 'ON_BREAK'),
            canStartBreak: todayData && todayData.currentStatus === 'WORKING',
            canEndBreak: todayData && todayData.currentStatus === 'ON_BREAK',
            nextAction: this.getNextAction(todayData)
          }
        }
      });

    } catch (error) {
      console.error('Error in getTodayStatus:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get weekly attendance summary for authenticated user (employee access)
   * GET /api/attendance-new/my-weekly?startDate=2024-01-01&endDate=2024-01-07
   */
  async getMyWeeklySummary(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const userId = req.user._id;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      // Get employee's attendance data for the date range
      const attendance = await this.service.getEmployeeAttendance(
        userId,
        new Date(startDate),
        new Date(endDate)
      );

      // Calculate weekly totals from the employee's data
      let totalWorkSeconds = 0;
      let totalBreakSeconds = 0;
      let daysPresent = 0;
      let daysLate = 0;
      let daysOnTime = 0;
      const dailyData = [];

      attendance.data.forEach(day => {
        if (day.isPresent) {
          daysPresent++;
          totalWorkSeconds += day.workDurationSeconds || 0;
          totalBreakSeconds += day.breakDurationSeconds || 0;

          if (day.isLate) {
            daysLate++;
          } else {
            daysOnTime++;
          }
        }

        dailyData.push({
          date: day.date,
          workDurationSeconds: day.workDurationSeconds || 0,
          breakDurationSeconds: day.breakDurationSeconds || 0,
          arrivalTime: day.arrivalTime,
          departureTime: day.departureTime,
          isPresent: day.isPresent,
          isLate: day.isLate,
          isHalfDay: day.isHalfDay,
          isAbsent: !day.isPresent
        });
      });

      // Calculate average daily hours
      const avgDailyWorkHours = daysPresent > 0 ? (totalWorkSeconds / 3600 / daysPresent) : 0;
      const avgDailyBreakHours = daysPresent > 0 ? (totalBreakSeconds / 3600 / daysPresent) : 0;

      // Helper to convert decimal hours to "Xh Ym" format
      const formatHoursToTimeString = (decimalHours) => {
        const hours = Math.floor(decimalHours);
        const minutes = Math.round((decimalHours - hours) * 60);
        return `${hours}h ${minutes}m`;
      };

      const weeklyTotals = {
        totalWorkDays: daysPresent,
        totalWorkHours: Math.round((totalWorkSeconds / 3600) * 100) / 100,
        totalBreakHours: Math.round((totalBreakSeconds / 3600) * 100) / 100,
        // Add formatted time strings for frontend compatibility
        totalWorkTime: formatHoursToTimeString(totalWorkSeconds / 3600),
        totalBreakTime: formatHoursToTimeString(totalBreakSeconds / 3600),
        avgDailyWork: formatHoursToTimeString(avgDailyWorkHours),
        avgDailyBreak: formatHoursToTimeString(avgDailyBreakHours),
        averageAttendanceRate: daysPresent > 0 ? 100 : 0, // For single user, it's binary
        averagePunctualityRate: daysPresent > 0 ? Math.round((daysOnTime / daysPresent) * 100) : 0,
        onTimeRate: daysPresent > 0 ? Math.round((daysOnTime / daysPresent) * 100) + '%' : '0%',
        daysLate: daysLate,
        daysOnTime: daysOnTime,
        // Calculate total breaks from daily data
        breaksTaken: dailyData.reduce((total, day) => {
          // Count events if available, otherwise estimate from break duration
          return total + (day.breakDurationSeconds > 0 ? 1 : 0);
        }, 0)
      };

      // Calculate quick stats for employee
      const quickStats = {
        earlyArrivals: daysOnTime,
        lateArrivals: daysLate,
        perfectDays: daysOnTime
      };

      res.json({
        success: true,
        data: {
          weeklyTotals,
          dailyData,
          quickStats
        }
      });

    } catch (error) {
      console.error('Error in getMyWeeklySummary:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get employee's attendance for a date range
   * GET /api/attendance/employee/:userId/range?startDate=2024-01-01&endDate=2024-01-31
   */
  async getEmployeeAttendanceRange(req, res) {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      // Check permissions - only allow access to own data unless admin/hr
      if (userId !== req.user._id.toString() && !['admin', 'super-admin', 'hr'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const attendance = await this.service.getEmployeeAttendance(
        userId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({
        success: true,
        data: attendance
      });

    } catch (error) {
      console.error('Error in getEmployeeAttendanceRange:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get monthly attendance for employee
   * GET /api/attendance/employee/:userId/monthly/:year/:month
   */
  async getEmployeeMonthly(req, res) {
    try {
      const { userId, year, month } = req.params;

      // Check permissions
      if (userId !== req.user._id.toString() && !['admin', 'super-admin', 'hr'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      const endDate = new Date(parseInt(year), parseInt(month), 0);

      const attendance = await this.service.getEmployeeAttendance(
        userId,
        startDate,
        endDate
      );

      // Add monthly insights
      const insights = this.calculateMonthlyInsights(attendance.data);

      res.json({
        success: true,
        data: {
          ...attendance,
          insights
        }
      });

    } catch (error) {
      console.error('Error in getEmployeeMonthly:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get daily attendance report (admin only)
   * GET /api/attendance/daily/:date
   */
  async getDailyReport(req, res) {
    try {
      const { date } = req.params;

      if (!date) {
        return res.status(400).json({
          success: false,
          error: 'Date parameter is required'
        });
      }

      const report = await this.service.getDailyReport(new Date(date));

      // Add additional analytics
      const analytics = this.calculateDailyAnalytics(report);

      res.json({
        success: true,
        data: {
          ...report,
          analytics
        }
      });

    } catch (error) {
      console.error('Error in getDailyReport:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get weekly attendance summary (admin only)
   * GET /api/attendance/weekly?startDate=2024-01-01&endDate=2024-01-07
   */
  async getWeeklySummary(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const summary = await this.service.getWeeklySummary(
        new Date(startDate),
        new Date(endDate)
      );

      // Add trends and insights
      const insights = this.calculateWeeklyInsights(summary);

      res.json({
        success: true,
        data: {
          ...summary,
          insights
        }
      });

    } catch (error) {
      console.error('Error in getWeeklySummary:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get current active employees (admin only)
   * GET /api/attendance/active
   */
  async getActiveEmployees(req, res) {
    try {
      const today = new Date();
      const report = await this.service.getDailyReport(today);

      const activeEmployees = report.employees.filter(emp =>
        emp.attendance.currentlyWorking || emp.attendance.onBreak
      );

      res.json({
        success: true,
        data: {
          date: today,
          totalActive: activeEmployees.length,
          currentlyWorking: activeEmployees.filter(emp => emp.attendance.currentlyWorking).length,
          onBreak: activeEmployees.filter(emp => emp.attendance.onBreak).length,
          employees: activeEmployees.map(emp => ({
            user: {
              _id: emp.user._id,
              name: emp.user.name,
              email: emp.user.email,
              department: emp.user.department,
              profileImage: emp.user.profileImage
            },
            status: emp.attendance.currentStatus,
            workDuration: emp.attendance.workDuration,
            arrivalTime: emp.attendance.arrivalTime,
            lastActivity: emp.events[emp.events.length - 1]?.timestamp
          }))
        }
      });

    } catch (error) {
      console.error('Error in getActiveEmployees:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Manual punch action (admin only)
   * POST /api/attendance/manual-punch
   */
  async manualPunchAction(req, res) {
    try {
      const { userId, action, timestamp, location, notes } = req.body;
      const adminId = req.user._id;

      // Validate required fields
      if (!userId || !action || !timestamp) {
        return res.status(400).json({
          success: false,
          error: 'userId, action, and timestamp are required'
        });
      }

      // Validate action
      const validActions = ['PUNCH_IN', 'PUNCH_OUT', 'BREAK_START', 'BREAK_END'];
      if (!validActions.includes(action)) {
        return res.status(400).json({
          success: false,
          error: `Invalid action. Must be one of: ${validActions.join(', ')}`
        });
      }

      const result = await this.service.recordPunchEvent(userId, action, {
        timestamp: new Date(timestamp),
        location,
        notes,
        manual: true,
        approvedBy: adminId,
        ipAddress: req.ip,
        device: req.get('User-Agent')
      });

      // Log the manual action
      console.log(`Admin ${adminId} manually recorded ${action} for user ${userId} at ${timestamp}`);

      res.json({
        success: true,
        data: result.employee.calculated,
        message: `Manual ${result.message.toLowerCase()} recorded successfully`
      });

    } catch (error) {
      console.error('Error in manualPunchAction:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get attendance statistics (admin only)
   * GET /api/attendance/stats?period=week|month&startDate=2024-01-01&endDate=2024-01-31
   */
  async getAttendanceStats(req, res) {
    try {
      const { period, startDate, endDate } = req.query;

      let start, end;

      if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
      } else if (period === 'week') {
        end = new Date();
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        end = new Date();
        start = new Date(end.getFullYear(), end.getMonth(), 1);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either provide period (week/month) or both startDate and endDate'
        });
      }

      const summary = await this.service.getWeeklySummary(start, end);

      const stats = {
        period: { start, end },
        overview: {
          totalWorkDays: summary.weeklyTotals.totalWorkDays,
          averageAttendanceRate: Math.round(summary.weeklyTotals.averageAttendanceRate),
          averagePunctualityRate: Math.round(summary.weeklyTotals.averagePunctualityRate),
          totalWorkHours: Math.round(summary.weeklyTotals.totalWorkHours),
          averageHoursPerDay: summary.weeklyTotals.totalWorkDays > 0 ?
            Math.round(summary.weeklyTotals.totalWorkHours / summary.weeklyTotals.totalWorkDays) : 0
        },
        trends: this.calculateTrends(summary.dailyData),
        dailyBreakdown: summary.dailyData.map(day => ({
          date: day.date,
          attendanceRate: day.stats.totalEmployees > 0 ?
            Math.round((day.stats.present / day.stats.totalEmployees) * 100) : 0,
          punctualityRate: day.stats.present > 0 ?
            Math.round(((day.stats.present - day.stats.late) / day.stats.present) * 100) : 100,
          averageHours: Math.round(day.stats.averageWorkHours * 100) / 100,
          totalEmployees: day.stats.totalEmployees,
          present: day.stats.present,
          absent: day.stats.absent,
          late: day.stats.late
        }))
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error in getAttendanceStats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Force recalculate attendance for a specific date
   * PUT /api/attendance/recalculate/:userId/:date
   */
  async recalculateAttendance(req, res) {
    try {
      const { userId, date } = req.params;

      // Allow employees to recalculate only their own attendance
      if (userId !== req.user._id.toString() && !['admin', 'super-admin', 'hr'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You can only recalculate your own attendance.'
        });
      }

      const targetDate = this.service.normalizeDate(new Date(date));
      const record = await this.service.getAttendanceRecord(targetDate);

      const employee = record.getEmployee(userId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          error: 'No attendance record found for this user on this date'
        });
      }

      // Fetch fresh shift data before recalculation
      const freshShift = await this.service.getUserShift(userId, targetDate);
      employee.assignedShift = freshShift;

      console.log('🔄 Recalculating with fresh shift:', freshShift);

      // Force recalculation
      this.service.recalculateEmployeeData(employee);
      this.service.updateDailyStats(record);
      await record.save();

      console.log(`✅ Recalculated attendance for user ${userId} on ${date}:`, {
        isLate: employee.calculated.isLate,
        arrivalTime: employee.calculated.arrivalTime,
        workHours: (employee.calculated.workDurationSeconds / 3600).toFixed(2)
      });

      res.json({
        success: true,
        message: 'Attendance recalculated successfully',
        data: {
          isLate: employee.calculated.isLate,
          isHalfDay: employee.calculated.isHalfDay,
          isPresent: employee.calculated.isPresent,
          workDurationSeconds: employee.calculated.workDurationSeconds
        },
        debug: {
          arrivalTime: employee.calculated.arrivalTime,
          shiftInfo: freshShift,
          hasShiftStartTime: !!freshShift?.startTime,
          shiftStartTime: freshShift?.startTime
        }
      });
    } catch (error) {
      console.error('Error recalculating attendance:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Helper methods

  /**
   * Get the next recommended action for an employee
   */
  getNextAction(todayData) {
    if (!todayData) return 'PUNCH_IN';

    switch (todayData.currentStatus) {
      case 'NOT_STARTED':
        return 'PUNCH_IN';
      case 'WORKING':
        return 'BREAK_START or PUNCH_OUT';
      case 'ON_BREAK':
        return 'BREAK_END';
      case 'FINISHED':
        return 'Day completed';
      default:
        return 'PUNCH_IN';
    }
  }

  /**
   * Calculate monthly insights for employee
   */
  calculateMonthlyInsights(monthlyData) {
    if (monthlyData.length === 0) return {};

    const workDays = monthlyData.filter(day => !day.isAbsent);
    const lateDays = monthlyData.filter(day => day.isLate);

    return {
      mostProductiveDay: this.findMostProductiveDay(workDays),
      averageArrivalTime: this.calculateAverageArrivalTime(workDays),
      longestWorkDay: this.findLongestWorkDay(workDays),
      consistencyScore: this.calculateConsistencyScore(workDays),
      trends: {
        attendanceImproving: this.isAttendanceImproving(monthlyData),
        punctualityImproving: this.isPunctualityImproving(monthlyData)
      }
    };
  }

  /**
   * Calculate daily analytics for admin report
   */
  calculateDailyAnalytics(report) {
    const employees = report.employees;

    return {
      productivity: {
        highPerformers: employees.filter(emp => emp.performance.efficiencyRating >= 4).length,
        averageEfficiency: employees.length > 0 ?
          Math.round((employees.reduce((sum, emp) => sum + emp.performance.efficiencyRating, 0) / employees.length) * 100) / 100 : 0
      },
      attendance: {
        onTimeRate: report.stats.present > 0 ?
          Math.round(((report.stats.present - report.stats.late) / report.stats.present) * 100) : 100,
        fullDayRate: report.stats.totalEmployees > 0 ?
          Math.round((report.stats.fullDay / report.stats.totalEmployees) * 100) : 0
      },
      timeDistribution: {
        earlyArrivals: employees.filter(emp =>
          emp.attendance.arrivalTime &&
          emp.shift?.startTime &&
          this.isEarlyArrival(emp.attendance.arrivalTime, emp.shift.startTime)
        ).length,
        overtimeWorkers: employees.filter(emp => emp.attendance.isOvertime).length
      }
    };
  }

  /**
   * Calculate weekly insights
   */
  calculateWeeklyInsights(summary) {
    const dailyData = summary.dailyData;

    return {
      bestDay: this.findBestAttendanceDay(dailyData),
      worstDay: this.findWorstAttendanceDay(dailyData),
      trends: this.calculateTrends(dailyData),
      recommendations: this.generateRecommendations(summary)
    };
  }

  /**
   * Calculate trends from daily data
   */
  calculateTrends(dailyData) {
    if (dailyData.length < 2) return { attendance: 'stable', punctuality: 'stable', productivity: 'stable' };

    const midPoint = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, midPoint);
    const secondHalf = dailyData.slice(midPoint);

    const avgAttendanceFirst = this.calculateAverageAttendanceRate(firstHalf);
    const avgAttendanceSecond = this.calculateAverageAttendanceRate(secondHalf);

    const avgPunctualityFirst = this.calculateAveragePunctualityRate(firstHalf);
    const avgPunctualitySecond = this.calculateAveragePunctualityRate(secondHalf);

    return {
      attendance: avgAttendanceSecond > avgAttendanceFirst + 5 ? 'improving' :
                 avgAttendanceSecond < avgAttendanceFirst - 5 ? 'declining' : 'stable',
      punctuality: avgPunctualitySecond > avgPunctualityFirst + 5 ? 'improving' :
                  avgPunctualitySecond < avgPunctualityFirst - 5 ? 'declining' : 'stable'
    };
  }

  // Additional helper methods for calculations
  findMostProductiveDay(workDays) {
    if (workDays.length === 0) return null;
    return workDays.reduce((max, day) => day.workDurationSeconds > max.workDurationSeconds ? day : max);
  }

  calculateAverageArrivalTime(workDays) {
    if (workDays.length === 0) return null;
    const validArrivals = workDays.filter(day => day.arrivalTime);
    if (validArrivals.length === 0) return null;

    const avgMinutes = validArrivals.reduce((sum, day) => {
      const time = new Date(day.arrivalTime);
      return sum + (time.getHours() * 60 + time.getMinutes());
    }, 0) / validArrivals.length;

    return this.service.minutesToTimeString(avgMinutes);
  }

  findLongestWorkDay(workDays) {
    return this.findMostProductiveDay(workDays);
  }

  calculateConsistencyScore(workDays) {
    if (workDays.length < 2) return 100;

    const workHours = workDays.map(day => day.workDurationSeconds / 3600);
    const avg = workHours.reduce((sum, hours) => sum + hours, 0) / workHours.length;
    const variance = workHours.reduce((sum, hours) => sum + Math.pow(hours - avg, 2), 0) / workHours.length;
    const stdDev = Math.sqrt(variance);

    // Convert to 0-100 score (lower standard deviation = higher consistency)
    const maxStdDev = 4; // Assume max std dev of 4 hours
    return Math.max(0, Math.round(100 - (stdDev / maxStdDev) * 100));
  }

  isAttendanceImproving(monthlyData) {
    // Implementation for attendance trend analysis
    return Math.random() > 0.5; // Placeholder
  }

  isPunctualityImproving(monthlyData) {
    // Implementation for punctuality trend analysis
    return Math.random() > 0.5; // Placeholder
  }

  isEarlyArrival(arrivalTime, shiftStartTime) {
    const arrival = new Date(arrivalTime);
    const [shiftHour, shiftMin] = shiftStartTime.split(':').map(Number);
    const shiftStart = new Date(arrival);
    shiftStart.setHours(shiftHour, shiftMin, 0, 0);

    return arrival < shiftStart;
  }

  findBestAttendanceDay(dailyData) {
    if (dailyData.length === 0) return null;
    return dailyData.reduce((best, day) => {
      const dayRate = day.stats.totalEmployees > 0 ? day.stats.present / day.stats.totalEmployees : 0;
      const bestRate = best.stats.totalEmployees > 0 ? best.stats.present / best.stats.totalEmployees : 0;
      return dayRate > bestRate ? day : best;
    });
  }

  findWorstAttendanceDay(dailyData) {
    if (dailyData.length === 0) return null;
    return dailyData.reduce((worst, day) => {
      const dayRate = day.stats.totalEmployees > 0 ? day.stats.present / day.stats.totalEmployees : 1;
      const worstRate = worst.stats.totalEmployees > 0 ? worst.stats.present / worst.stats.totalEmployees : 1;
      return dayRate < worstRate ? day : worst;
    });
  }

  calculateAverageAttendanceRate(days) {
    if (days.length === 0) return 0;
    return days.reduce((sum, day) => {
      const rate = day.stats.totalEmployees > 0 ? (day.stats.present / day.stats.totalEmployees) * 100 : 0;
      return sum + rate;
    }, 0) / days.length;
  }

  calculateAveragePunctualityRate(days) {
    if (days.length === 0) return 100;
    return days.reduce((sum, day) => {
      const rate = day.stats.present > 0 ? ((day.stats.present - day.stats.late) / day.stats.present) * 100 : 100;
      return sum + rate;
    }, 0) / days.length;
  }

  generateRecommendations(summary) {
    const recommendations = [];
    const avgAttendance = summary.weeklyTotals.averageAttendanceRate;
    const avgPunctuality = summary.weeklyTotals.averagePunctualityRate;

    if (avgAttendance < 90) {
      recommendations.push('Consider implementing attendance improvement initiatives');
    }

    if (avgPunctuality < 85) {
      recommendations.push('Address punctuality issues with targeted interventions');
    }

    if (summary.weeklyTotals.totalWorkHours < summary.weeklyTotals.totalWorkDays * 8 * 0.8) {
      recommendations.push('Review work hour expectations and productivity measures');
    }

    return recommendations;
  }
}

module.exports = AttendanceController;