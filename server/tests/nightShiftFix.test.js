// Test suite for Night Shift Duration Fix
// This verifies that the fix works correctly without affecting day/evening shifts

const AttendanceService = require('../services/AttendanceService');

describe('Night Shift Duration Calculation Fix', () => {
  let service;

  beforeEach(() => {
    service = new AttendanceService();
  });

  describe('isNightShift()', () => {
    test('should detect night shift correctly', () => {
      const nightShift = { startTime: '20:00', endTime: '05:00' };
      expect(service.isNightShift(nightShift)).toBe(true);
    });

    test('should NOT detect day shift as night shift', () => {
      const dayShift = { startTime: '09:00', endTime: '18:00' };
      expect(service.isNightShift(dayShift)).toBe(false);
    });

    test('should NOT detect evening shift as night shift', () => {
      const eveningShift = { startTime: '13:00', endTime: '22:00' };
      expect(service.isNightShift(eveningShift)).toBe(false);
    });

    test('should handle edge case - shift ending at midnight', () => {
      const shiftToMidnight = { startTime: '16:00', endTime: '00:00' };
      expect(service.isNightShift(shiftToMidnight)).toBe(true);
    });

    test('should return false for invalid shift', () => {
      expect(service.isNightShift(null)).toBe(false);
      expect(service.isNightShift({})).toBe(false);
      expect(service.isNightShift({ startTime: '09:00' })).toBe(false);
    });
  });

  describe('shouldIncludeInDateCalculation()', () => {
    const attendanceDate = new Date('2024-10-10T00:00:00Z');

    describe('Day Shift (09:00-18:00)', () => {
      const dayShift = { startTime: '09:00', endTime: '18:00' };

      test('should include same-day timestamp', () => {
        const timestamp = new Date('2024-10-10T10:00:00Z');
        expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, dayShift)).toBe(true);
      });

      test('should NOT include next-day timestamp', () => {
        const timestamp = new Date('2024-10-11T10:00:00Z');
        expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, dayShift)).toBe(false);
      });

      test('should NOT include previous-day timestamp', () => {
        const timestamp = new Date('2024-10-09T10:00:00Z');
        expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, dayShift)).toBe(false);
      });
    });

    describe('Night Shift (20:00-05:00)', () => {
      const nightShift = { startTime: '20:00', endTime: '05:00' };

      test('should include evening timestamp on attendance date', () => {
        // Oct 10 at 22:00 IST (belongs to Oct 10 night shift)
        const timestamp = new Date('2024-10-10T16:30:00Z'); // 22:00 IST
        expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, nightShift)).toBe(true);
      });

      test('should include early morning timestamp from next calendar day', () => {
        // Oct 11 at 02:00 IST (belongs to Oct 10 night shift)
        const timestamp = new Date('2024-10-10T20:30:00Z'); // Oct 11 02:00 IST
        expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, nightShift)).toBe(true);
      });

      test('should NOT include timestamp after shift ends', () => {
        // Oct 11 at 07:00 IST (after night shift ends)
        const timestamp = new Date('2024-10-11T01:30:00Z'); // 07:00 IST
        expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, nightShift)).toBe(false);
      });
    });
  });

  describe('Integration Test - Duration Calculation', () => {
    test('DAY SHIFT: Duration should calculate correctly within same day', () => {
      const employee = {
        assignedShift: { startTime: '09:00', endTime: '18:00' },
        events: [
          { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T03:30:00Z') }, // 09:00 IST
          { type: 'BREAK_START', timestamp: new Date('2024-10-10T07:30:00Z') }, // 13:00 IST
          { type: 'BREAK_END', timestamp: new Date('2024-10-10T08:00:00Z') }, // 13:30 IST
          // Currently working...
        ],
        calculated: {}
      };

      const attendanceDate = new Date('2024-10-10T00:00:00Z');
      service.recalculateEmployeeData(employee, attendanceDate);

      // Should have work duration (09:00-13:00 = 4 hours) + (13:30-now)
      expect(employee.calculated.workDurationSeconds).toBeGreaterThan(4 * 3600);
      expect(employee.calculated.breakDurationSeconds).toBe(30 * 60);
    });

    test('NIGHT SHIFT: Duration should calculate correctly across midnight', () => {
      const employee = {
        assignedShift: { startTime: '20:00', endTime: '05:00' },
        events: [
          { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T14:30:00Z') }, // Oct 10 20:00 IST
          { type: 'BREAK_START', timestamp: new Date('2024-10-10T18:00:00Z') }, // Oct 10 23:30 IST
          { type: 'BREAK_END', timestamp: new Date('2024-10-10T19:00:00Z') }, // Oct 11 00:30 IST
          // Currently working at Oct 11 02:00 IST
        ],
        calculated: {}
      };

      const attendanceDate = new Date('2024-10-10T00:00:00Z');

      // Mock current time to Oct 11 02:00 IST
      const originalDate = global.Date;
      global.Date = class extends originalDate {
        constructor(...args) {
          if (args.length === 0) {
            super('2024-10-10T20:30:00Z'); // Oct 11 02:00 IST
          } else {
            super(...args);
          }
        }
      };

      service.recalculateEmployeeData(employee, attendanceDate);

      // Should have:
      // Work: 20:00-23:30 (3.5h) + 00:30-02:00 (1.5h) = 5 hours
      // Break: 23:30-00:30 = 1 hour
      expect(employee.calculated.workDurationSeconds).toBeCloseTo(5 * 3600, -2);
      expect(employee.calculated.breakDurationSeconds).toBeCloseTo(1 * 3600, -2);

      // Cleanup
      global.Date = originalDate;
    });

    test('EVENING SHIFT: Duration should work correctly', () => {
      const employee = {
        assignedShift: { startTime: '13:00', endTime: '22:00' },
        events: [
          { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T07:30:00Z') }, // 13:00 IST
          { type: 'BREAK_START', timestamp: new Date('2024-10-10T11:00:00Z') }, // 16:30 IST
          { type: 'BREAK_END', timestamp: new Date('2024-10-10T11:30:00Z') }, // 17:00 IST
          // Currently working...
        ],
        calculated: {}
      };

      const attendanceDate = new Date('2024-10-10T00:00:00Z');
      service.recalculateEmployeeData(employee, attendanceDate);

      // Should have work duration (13:00-16:30 = 3.5h) + (17:00-now)
      expect(employee.calculated.workDurationSeconds).toBeGreaterThan(3.5 * 3600);
      expect(employee.calculated.breakDurationSeconds).toBe(30 * 60);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null attendanceDate gracefully', () => {
      const timestamp = new Date('2024-10-10T10:00:00Z');
      const shift = { startTime: '20:00', endTime: '05:00' };

      expect(service.shouldIncludeInDateCalculation(timestamp, null, shift)).toBe(false);
    });

    test('should handle null timestamp gracefully', () => {
      const attendanceDate = new Date('2024-10-10T00:00:00Z');
      const shift = { startTime: '20:00', endTime: '05:00' };

      expect(service.shouldIncludeInDateCalculation(null, attendanceDate, shift)).toBe(false);
    });

    test('should handle shift without times gracefully', () => {
      const timestamp = new Date('2024-10-10T10:00:00Z');
      const attendanceDate = new Date('2024-10-10T00:00:00Z');

      expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, null)).toBe(false);
      expect(service.shouldIncludeInDateCalculation(timestamp, attendanceDate, {})).toBe(false);
    });
  });
});

console.log('\n=== Night Shift Fix Test Suite ===');
console.log('Run this test with: npm test nightShiftFix.test.js');
console.log('\nThis verifies:');
console.log('✓ Night shift detection works correctly');
console.log('✓ Duration calculation spans midnight for night shifts');
console.log('✓ Day/evening shifts are NOT affected');
console.log('✓ Break tracking works across midnight');
console.log('================================\n');
