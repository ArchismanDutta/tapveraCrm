// Global event bus for data synchronization across components
class EventBus {
  constructor() {
    this.events = {};
  }

  // Subscribe to an event
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  // Emit an event
  emit(event, data) {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Remove all listeners for an event
  off(event) {
    delete this.events[event];
  }

  // Clear all events
  clear() {
    this.events = {};
  }
}

// Create singleton instance
const eventBus = new EventBus();

// Pre-defined event types for consistency
export const EVENTS = {
  ATTENDANCE_UPDATE: 'attendance:update',
  STATUS_UPDATE: 'status:update',
  BREAK_UPDATE: 'break:update',
  PUNCH_IN: 'punch:in',
  PUNCH_OUT: 'punch:out',
  MANUAL_ATTENDANCE_UPDATE: 'manual:attendance:update',
  DATA_REFRESH: 'data:refresh',
  USER_STATUS_CHANGE: 'user:status:change'
};

// Helper functions for common operations
export const attendanceEvents = {
  // Emit attendance data update
  emitAttendanceUpdate: (data) => {
    eventBus.emit(EVENTS.ATTENDANCE_UPDATE, {
      ...data,
      timestamp: new Date().toISOString()
    });
  },

  // Emit status change
  emitStatusUpdate: (userId, status) => {
    eventBus.emit(EVENTS.STATUS_UPDATE, {
      userId,
      status,
      timestamp: new Date().toISOString()
    });
  },

  // Emit break time update
  emitBreakUpdate: (userId, breakData) => {
    eventBus.emit(EVENTS.BREAK_UPDATE, {
      userId,
      breakData,
      timestamp: new Date().toISOString()
    });
  },

  // Emit punch in/out events
  emitPunchEvent: (type, userId, data) => {
    const event = type === 'in' ? EVENTS.PUNCH_IN : EVENTS.PUNCH_OUT;
    eventBus.emit(event, {
      userId,
      ...data,
      timestamp: new Date().toISOString()
    });
  },

  // Emit manual attendance update
  emitManualAttendanceUpdate: (data) => {
    eventBus.emit(EVENTS.MANUAL_ATTENDANCE_UPDATE, {
      ...data,
      timestamp: new Date().toISOString()
    });
  },

  // Emit general data refresh request
  emitDataRefresh: (source) => {
    eventBus.emit(EVENTS.DATA_REFRESH, {
      source,
      timestamp: new Date().toISOString()
    });
  }
};

export default eventBus;