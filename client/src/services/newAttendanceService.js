// src/services/newAttendanceService.js
// Service for the new date-centric attendance system

import attendanceDataConverter from './attendanceDataConverter.js';

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

class NewAttendanceService {
  constructor() {
    this.baseURL = `${API_BASE}/api/attendance-new`;
  }

  // Get authorization headers
  getAuthHeaders() {
    const token = localStorage.getItem("token");
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }

  // Generic API call with error handling
  async apiCall(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if (response.status === 401) {
          // Handle authentication error
          localStorage.removeItem("token");
          window.location.href = '/login';
          throw new Error('Authentication failed');
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // ================================
  // Employee Functions
  // ================================

  /**
   * Record punch action
   */
  async recordPunchAction(action, options = {}) {
    const body = {
      action: action, // 'PUNCH_IN', 'PUNCH_OUT', 'BREAK_START', 'BREAK_END'
      location: options.location || 'Office',
      notes: options.notes || ''
    };

    return await this.apiCall('/punch', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Punch in
   */
  async punchIn(location = 'Office', notes = '') {
    return await this.recordPunchAction('PUNCH_IN', { location, notes });
  }

  /**
   * Punch out
   */
  async punchOut(location = 'Office', notes = '') {
    return await this.recordPunchAction('PUNCH_OUT', { location, notes });
  }

  /**
   * Start break
   */
  async startBreak(location = 'Break Room', notes = '') {
    return await this.recordPunchAction('BREAK_START', { location, notes });
  }

  /**
   * End break
   */
  async endBreak(location = 'Office', notes = '') {
    return await this.recordPunchAction('BREAK_END', { location, notes });
  }

  /**
   * Get today's attendance status
   */
  async getTodayStatus() {
    return await this.apiCall('/today');
  }

  /**
   * Get employee attendance for date range
   */
  async getEmployeeAttendanceRange(userId, startDate, endDate) {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    return await this.apiCall(`/employee/${userId}/range?${params}`);
  }

  /**
   * Get employee monthly attendance
   */
  async getEmployeeMonthlyAttendance(userId, year, month) {
    return await this.apiCall(`/employee/${userId}/monthly/${year}/${month}`);
  }

  // ================================
  // Admin Functions (require admin/hr role)
  // ================================

  /**
   * Get daily attendance report for all employees
   */
  async getDailyReport(date) {
    const dateStr = date.toISOString().split('T')[0];
    return await this.apiCall(`/daily/${dateStr}`);
  }

  /**
   * Get weekly attendance summary (admin access)
   */
  async getWeeklySummary(startDate, endDate) {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    return await this.apiCall(`/weekly?${params}`);
  }

  /**
   * Get my weekly attendance summary (employee access)
   */
  async getMyWeeklySummary(startDate, endDate) {
    const params = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    return await this.apiCall(`/my-weekly?${params}`);
  }

  /**
   * Convert new system response to legacy format for compatibility
   */
  convertToLegacyFormat(newResponse) {
    return attendanceDataConverter.convertAttendanceToLegacy(newResponse.data);
  }

  /**
   * Convert weekly data to legacy format
   */
  convertWeeklyToLegacyFormat(newWeeklyResponse) {
    return attendanceDataConverter.convertWeeklyDataToLegacy(newWeeklyResponse);
  }

  /**
   * Convert legacy event type to new system format
   */
  convertLegacyEventType(legacyType) {
    return attendanceDataConverter.extractEventType(legacyType);
  }

  /**
   * Get currently active employees
   */
  async getActiveEmployees() {
    return await this.apiCall('/active');
  }

  /**
   * Manual punch action (admin only)
   */
  async manualPunchAction(userId, action, timestamp, options = {}) {
    const body = {
      userId,
      action,
      timestamp: timestamp.toISOString(),
      location: options.location || 'Office',
      notes: options.notes || 'Manual entry'
    };

    return await this.apiCall('/manual-punch', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Get attendance statistics
   */
  async getAttendanceStats(period, startDate, endDate) {
    let params = new URLSearchParams();

    if (period) {
      params.append('period', period);
    }

    if (startDate && endDate) {
      params.append('startDate', startDate.toISOString().split('T')[0]);
      params.append('endDate', endDate.toISOString().split('T')[0]);
    }

    return await this.apiCall(`/stats?${params}`);
  }

  // ================================
  // System Functions
  // ================================

  /**
   * Check system health
   */
  async getSystemHealth() {
    return await this.apiCall('/health');
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    return await this.apiCall('/info');
  }

  // ================================
  // Utility Functions
  // ================================

  /**
   * Get next recommended action for user
   */
  getNextAction(todayData) {
    if (!todayData || !todayData.attendance) return 'PUNCH_IN';

    switch (todayData.attendance.currentStatus) {
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
   * Format duration from seconds to readable format
   */
  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0h 0m';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  /**
   * Format duration with seconds for live display
   */
  formatDurationWithSeconds(seconds) {
    if (!seconds || seconds < 0) return '0h 0m 0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  /**
   * Format time for display
   */
  formatTime(date) {
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
   * Get action button state
   */
  getActionButtonState(todayData) {
    const defaultState = {
      canPunchIn: true,
      canPunchOut: false,
      canStartBreak: false,
      canEndBreak: false,
      primaryAction: 'PUNCH_IN',
      primaryLabel: 'Punch In',
      primaryColor: 'bg-green-500 hover:bg-green-600'
    };

    if (!todayData || !todayData.attendance) {
      return defaultState;
    }

    const { currentStatus, currentlyWorking, onBreak } = todayData.attendance;

    switch (currentStatus) {
      case 'NOT_STARTED':
        return {
          canPunchIn: true,
          canPunchOut: false,
          canStartBreak: false,
          canEndBreak: false,
          primaryAction: 'PUNCH_IN',
          primaryLabel: 'Punch In',
          primaryColor: 'bg-green-500 hover:bg-green-600'
        };

      case 'WORKING':
        return {
          canPunchIn: false,
          canPunchOut: true,
          canStartBreak: true,
          canEndBreak: false,
          primaryAction: 'BREAK_START',
          primaryLabel: 'Start Break',
          primaryColor: 'bg-orange-500 hover:bg-orange-600'
        };

      case 'ON_BREAK':
        return {
          canPunchIn: false,
          canPunchOut: true,
          canStartBreak: false,
          canEndBreak: true,
          primaryAction: 'BREAK_END',
          primaryLabel: 'End Break',
          primaryColor: 'bg-blue-500 hover:bg-blue-600'
        };

      case 'FINISHED':
        return {
          canPunchIn: false,
          canPunchOut: false,
          canStartBreak: false,
          canEndBreak: false,
          primaryAction: null,
          primaryLabel: 'Day Completed',
          primaryColor: 'bg-gray-500 cursor-not-allowed'
        };

      default:
        return defaultState;
    }
  }

  /**
   * Convert old timeline events to new format for compatibility
   */
  convertOldTimelineToNew(oldTimeline) {
    if (!oldTimeline || !Array.isArray(oldTimeline)) return [];

    return oldTimeline.map(event => {
      let newType = 'PUNCH_IN'; // default

      const type = (event.type || '').toLowerCase();
      if (type.includes('punch') && type.includes('in')) newType = 'PUNCH_IN';
      else if (type.includes('punch') && type.includes('out')) newType = 'PUNCH_OUT';
      else if (type.includes('break') && type.includes('start')) newType = 'BREAK_START';
      else if (type.includes('resume') || type.includes('break') && type.includes('end')) newType = 'BREAK_END';

      return {
        type: newType,
        timestamp: event.time,
        location: event.location || 'Office',
        manual: event.manual || false,
        notes: event.notes || ''
      };
    });
  }

  /**
   * Calculate live duration from start time
   */
  calculateLiveDuration(startTime) {
    if (!startTime) return 0;

    const start = new Date(startTime);
    const now = new Date();

    if (isNaN(start.getTime())) return 0;

    return Math.max(0, Math.floor((now - start) / 1000));
  }
}

// Create singleton instance
const newAttendanceService = new NewAttendanceService();

export default newAttendanceService;