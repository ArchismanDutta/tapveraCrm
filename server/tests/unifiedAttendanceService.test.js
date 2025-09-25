// tests/unifiedAttendanceService.test.js
// Comprehensive tests for the unified attendance service

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const UserStatus = require('../models/UserStatus');
const DailyWork = require('../models/DailyWork');
const LeaveRequest = require('../models/LeaveRequest');
const unifiedAttendanceService = require('../services/unifiedAttendanceService');

const {
  getEffectiveShift,
  getUnifiedAttendanceData,
  calculateWorkDurationFromSessions,
  calculateBreakDurationFromSessions,
  calculateAttendanceStatusFromTimeline,
  validateTimelineEvent,
  validatePunchInTime,
  syncToDailyWorkSafely,
  EVENT_TYPES,
  ATTENDANCE_CONSTANTS,
} = unifiedAttendanceService;

describe('Unified Attendance Service', () => {
  let mongoServer;
  let testUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await User.deleteMany({});
    await UserStatus.deleteMany({});
    await DailyWork.deleteMany({});
    await LeaveRequest.deleteMany({});

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password',
      department: 'Engineering',
      designation: 'Developer',
      shiftType: 'standard',
      standardShiftType: 'morning',
      timeZone: 'UTC',
    });
  });

  describe('Work Duration Calculations', () => {
    test('should calculate work duration correctly from sessions', () => {
      const sessions = [
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T12:00:00Z'), // 3 hours
        },
        {
          start: new Date('2024-01-15T13:00:00Z'),
          end: new Date('2024-01-15T17:00:00Z'), // 4 hours
        },
      ];

      const totalSeconds = calculateWorkDurationFromSessions(
        sessions,
        false,
        new Date('2024-01-15')
      );

      expect(totalSeconds).toBe(7 * 3600); // 7 hours in seconds
    });

    test('should handle ongoing work session when currently working', () => {
      const now = new Date();
      const sessions = [
        {
          start: new Date(now.getTime() - 2 * 3600 * 1000), // 2 hours ago
          // No end time - ongoing session
        },
      ];

      const totalSeconds = calculateWorkDurationFromSessions(
        sessions,
        true // currently working
      );

      // Should be approximately 2 hours (allowing for small timing differences)
      expect(totalSeconds).toBeGreaterThan(2 * 3600 - 10);
      expect(totalSeconds).toBeLessThan(2 * 3600 + 10);
    });

    test('should filter out sessions from different dates', () => {
      const sessions = [
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T12:00:00Z'), // Same date - should include
        },
        {
          start: new Date('2024-01-14T09:00:00Z'),
          end: new Date('2024-01-14T12:00:00Z'), // Different date - should exclude
        },
      ];

      const totalSeconds = calculateWorkDurationFromSessions(
        sessions,
        false,
        new Date('2024-01-15')
      );

      expect(totalSeconds).toBe(3 * 3600); // Only 3 hours from the first session
    });

    test('should cap excessive session durations', () => {
      const sessions = [
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-17T09:00:00Z'), // 48 hours - should be capped
        },
      ];

      const totalSeconds = calculateWorkDurationFromSessions(
        sessions,
        false,
        new Date('2024-01-15')
      );

      expect(totalSeconds).toBe(ATTENDANCE_CONSTANTS.MAX_DAILY_WORK_HOURS * 3600);
    });

    test('should deduplicate identical sessions', () => {
      const sessions = [
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T12:00:00Z'),
        },
        {
          start: new Date('2024-01-15T09:00:00Z'),
          end: new Date('2024-01-15T12:00:00Z'), // Duplicate
        },
      ];

      const totalSeconds = calculateWorkDurationFromSessions(
        sessions,
        false,
        new Date('2024-01-15')
      );

      expect(totalSeconds).toBe(3 * 3600); // Only count once
    });
  });

  describe('Break Duration Calculations', () => {
    test('should calculate break duration correctly from sessions', () => {
      const breakSessions = [
        {
          start: new Date('2024-01-15T12:00:00Z'),
          end: new Date('2024-01-15T12:30:00Z'), // 30 minutes
          type: 'lunch',
        },
        {
          start: new Date('2024-01-15T15:00:00Z'),
          end: new Date('2024-01-15T15:15:00Z'), // 15 minutes
          type: 'coffee',
        },
      ];

      const totalSeconds = calculateBreakDurationFromSessions(
        breakSessions,
        false,
        new Date('2024-01-15')
      );

      expect(totalSeconds).toBe(45 * 60); // 45 minutes in seconds
    });

    test('should handle ongoing break when currently on break', () => {
      const now = new Date();
      const breakSessions = [
        {
          start: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
          // No end time - ongoing break
        },
      ];

      const totalSeconds = calculateBreakDurationFromSessions(
        breakSessions,
        true // currently on break
      );

      // Should be approximately 30 minutes (allowing for small timing differences)
      expect(totalSeconds).toBeGreaterThan(30 * 60 - 10);
      expect(totalSeconds).toBeLessThan(30 * 60 + 10);
    });
  });

  describe('Timeline Event Validation', () => {
    test('should validate correct timeline events', () => {
      const validEvent = {
        type: EVENT_TYPES.PUNCH_IN,
        time: new Date(),
      };

      expect(validateTimelineEvent(validEvent)).toBe(true);
    });

    test('should reject invalid timeline events', () => {
      const invalidEvents = [
        null,
        { type: 'invalid', time: new Date() },
        { type: EVENT_TYPES.PUNCH_IN, time: 'invalid date' },
        { type: EVENT_TYPES.PUNCH_IN }, // missing time
        { time: new Date() }, // missing type
      ];

      invalidEvents.forEach(event => {
        expect(validateTimelineEvent(event)).toBe(false);
      });
    });

    test('should validate case-insensitive event types', () => {
      const events = [
        { type: 'punch in', time: new Date() },
        { type: 'PUNCH OUT', time: new Date() },
        { type: 'Break Start', time: new Date() },
        { type: 'resume work', time: new Date() },
      ];

      events.forEach(event => {
        expect(validateTimelineEvent(event)).toBe(true);
      });
    });
  });

  describe('Attendance Status Calculation', () => {
    test('should calculate attendance status from timeline correctly', () => {
      const shift = {
        start: '09:00',
        end: '18:00',
        isFlexible: false,
      };

      const timeline = [
        {
          type: EVENT_TYPES.PUNCH_IN,
          time: new Date('2024-01-15T09:30:00Z'), // 30 minutes late
        },
        {
          type: EVENT_TYPES.PUNCH_OUT,
          time: new Date('2024-01-15T17:30:00Z'),
        },
      ];

      const status = calculateAttendanceStatusFromTimeline(
        timeline,
        shift,
        8 * 3600 // 8 hours of work
      );

      expect(status.isAbsent).toBe(false);
      expect(status.isLate).toBe(true);
      expect(status.isHalfDay).toBe(false);
      expect(status.arrivalTime).toEqual(timeline[0].time);
      expect(status.departureTime).toEqual(timeline[1].time);
    });

    test('should identify half day based on work hours', () => {
      const shift = {
        start: '09:00',
        end: '18:00',
        isFlexible: false,
      };

      const timeline = [
        {
          type: EVENT_TYPES.PUNCH_IN,
          time: new Date('2024-01-15T09:00:00Z'),
        },
        {
          type: EVENT_TYPES.PUNCH_OUT,
          time: new Date('2024-01-15T14:00:00Z'),
        },
      ];

      const status = calculateAttendanceStatusFromTimeline(
        timeline,
        shift,
        5 * 3600 // 5 hours of work (half day)
      );

      expect(status.isAbsent).toBe(false);
      expect(status.isLate).toBe(false);
      expect(status.isHalfDay).toBe(true);
    });

    test('should handle absent status with no punch in', () => {
      const shift = {
        start: '09:00',
        end: '18:00',
        isFlexible: false,
      };

      const timeline = []; // No events

      const status = calculateAttendanceStatusFromTimeline(timeline, shift, 0);

      expect(status.isAbsent).toBe(true);
      expect(status.isLate).toBe(false);
      expect(status.isHalfDay).toBe(false);
      expect(status.arrivalTime).toBe(null);
      expect(status.departureTime).toBe(null);
    });
  });

  describe('Effective Shift Calculation', () => {
    test('should return standard shift for regular user', async () => {
      const shift = await getEffectiveShift(testUser._id, new Date());

      expect(shift.start).toBe('09:00');
      expect(shift.end).toBe('18:00');
      expect(shift.isFlexible).toBe(false);
      expect(shift.source).toBe('standard');
    });

    test('should return flexible shift for flexiblePermanent user', async () => {
      await User.findByIdAndUpdate(testUser._id, {
        shiftType: 'flexiblePermanent',
      });

      const shift = await getEffectiveShift(testUser._id, new Date());

      expect(shift.start).toBe('00:00');
      expect(shift.end).toBe('23:59');
      expect(shift.isFlexible).toBe(true);
      expect(shift.isFlexiblePermanent).toBe(true);
      expect(shift.source).toBe('flexiblePermanent');
    });

    test('should handle shift override with highest priority', async () => {
      const targetDate = new Date('2024-01-15');
      const dateKey = targetDate.toISOString().slice(0, 10);

      await User.findByIdAndUpdate(testUser._id, {
        shiftOverrides: {
          [dateKey]: {
            start: '10:00',
            end: '19:00',
            durationHours: 9,
            type: 'flexible',
            name: 'Special Shift',
          },
        },
      });

      const shift = await getEffectiveShift(testUser._id, targetDate);

      expect(shift.start).toBe('10:00');
      expect(shift.end).toBe('19:00');
      expect(shift.isFlexible).toBe(true);
      expect(shift.source).toBe('override');
      expect(shift.shiftName).toBe('Special Shift');
    });
  });

  describe('Punch In Time Validation', () => {
    test('should allow punch in during normal hours', () => {
      const shift = {
        start: '09:00',
        end: '18:00',
        isFlexible: false,
      };

      const punchTime = new Date();
      punchTime.setHours(9, 0, 0, 0);

      const validation = validatePunchInTime(punchTime, shift);

      expect(validation.isValid).toBe(true);
    });

    test('should allow early punch in within allowance', () => {
      const shift = {
        start: '09:00',
        end: '18:00',
        isFlexible: false,
      };

      const punchTime = new Date();
      punchTime.setHours(7, 30, 0, 0); // 1.5 hours early (within 2 hour allowance)

      const validation = validatePunchInTime(punchTime, shift);

      expect(validation.isValid).toBe(true);
    });

    test('should reject punch in too early', () => {
      const shift = {
        start: '09:00',
        end: '18:00',
        isFlexible: false,
      };

      const punchTime = new Date();
      punchTime.setHours(6, 0, 0, 0); // 3 hours early (exceeds 2 hour allowance)

      const validation = validatePunchInTime(punchTime, shift);

      expect(validation.isValid).toBe(false);
      expect(validation.message).toContain('Cannot punch in more than');
    });

    test('should allow any time for flexible shifts', () => {
      const shift = {
        start: '00:00',
        end: '23:59',
        isFlexible: true,
      };

      const punchTime = new Date();
      punchTime.setHours(3, 0, 0, 0); // Very early time

      const validation = validatePunchInTime(punchTime, shift);

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Unified Attendance Data Integration', () => {
    test('should return consistent attendance data', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create UserStatus with timeline and sessions
      const userStatus = await UserStatus.create({
        userId: testUser._id,
        today,
        currentlyWorking: false,
        onBreak: false,
        timeline: [
          {
            type: EVENT_TYPES.PUNCH_IN,
            time: new Date('2024-01-15T09:00:00Z'),
          },
          {
            type: EVENT_TYPES.PUNCH_OUT,
            time: new Date('2024-01-15T17:00:00Z'),
          },
        ],
        workedSessions: [
          {
            start: new Date('2024-01-15T09:00:00Z'),
            end: new Date('2024-01-15T17:00:00Z'),
          },
        ],
        breakSessions: [],
        arrivalTime: new Date('2024-01-15T09:00:00Z'),
      });

      const attendanceData = await getUnifiedAttendanceData(
        testUser._id,
        new Date('2024-01-15')
      );

      expect(attendanceData.isAbsent).toBe(false);
      expect(attendanceData.isLate).toBe(false);
      expect(attendanceData.workDurationSeconds).toBe(8 * 3600); // 8 hours
      expect(attendanceData.breakDurationSeconds).toBe(0);
      expect(attendanceData.arrivalTime).toEqual(new Date('2024-01-15T09:00:00Z'));
      expect(attendanceData.timeline).toHaveLength(2);
      expect(attendanceData.workedSessions).toHaveLength(1);
    });

    test('should handle leave information correctly', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create approved WFH leave
      await LeaveRequest.create({
        employee: {
          _id: testUser._id,
          name: testUser.name,
          email: testUser.email,
        },
        period: {
          start: today,
          end: today,
        },
        type: 'workFromHome',
        reason: 'Remote work',
        status: 'Approved',
      });

      const attendanceData = await getUnifiedAttendanceData(testUser._id, today);

      expect(attendanceData.leaveInfo).toBeTruthy();
      expect(attendanceData.leaveInfo.type).toBe('workFromHome');
      expect(attendanceData.isWFH).toBe(true);
    });
  });

  describe('Sync to DailyWork', () => {
    test('should sync UserStatus to DailyWork successfully', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create UserStatus
      await UserStatus.create({
        userId: testUser._id,
        today,
        timeline: [
          {
            type: EVENT_TYPES.PUNCH_IN,
            time: new Date('2024-01-15T09:00:00Z'),
          },
          {
            type: EVENT_TYPES.PUNCH_OUT,
            time: new Date('2024-01-15T17:00:00Z'),
          },
        ],
        workedSessions: [
          {
            start: new Date('2024-01-15T09:00:00Z'),
            end: new Date('2024-01-15T17:00:00Z'),
          },
        ],
        breakSessions: [],
      });

      // Perform sync
      await syncToDailyWorkSafely(testUser._id, today);

      // Verify DailyWork record was created
      const dailyWork = await DailyWork.findOne({ userId: testUser._id, date: today });

      expect(dailyWork).toBeTruthy();
      expect(dailyWork.workDurationSeconds).toBe(8 * 3600);
      expect(dailyWork.timeline).toHaveLength(2);
      expect(dailyWork.workedSessions).toHaveLength(1);
      expect(dailyWork.isLate).toBe(false);
      expect(dailyWork.isAbsent).toBe(false);
    });

    test('should handle sync transaction failures gracefully', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create UserStatus
      await UserStatus.create({
        userId: testUser._id,
        today,
        timeline: [],
        workedSessions: [],
        breakSessions: [],
      });

      // Mock a database error during sync
      const originalFindOneAndUpdate = DailyWork.findOneAndUpdate;
      DailyWork.findOneAndUpdate = jest.fn().mockRejectedValue(new Error('Database error'));

      // Attempt sync and expect it to throw
      await expect(syncToDailyWorkSafely(testUser._id, today)).rejects.toThrow('Database error');

      // Restore original method
      DailyWork.findOneAndUpdate = originalFindOneAndUpdate;
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle user not found gracefully', async () => {
      const nonExistentUserId = new mongoose.Types.ObjectId();

      await expect(getEffectiveShift(nonExistentUserId, new Date())).rejects.toThrow('User not found');
    });

    test('should handle invalid date inputs gracefully', async () => {
      const invalidDate = new Date('invalid');

      const attendanceData = await getUnifiedAttendanceData(testUser._id, invalidDate);

      expect(attendanceData.isAbsent).toBe(true);
      expect(attendanceData.workDurationSeconds).toBe(0);
    });

    test('should cap excessive work durations', () => {
      const sessions = [
        {
          start: new Date('2024-01-15T00:00:00Z'),
          end: new Date('2024-01-16T12:00:00Z'), // 36 hours
        },
      ];

      const totalSeconds = calculateWorkDurationFromSessions(
        sessions,
        false,
        new Date('2024-01-15')
      );

      expect(totalSeconds).toBe(ATTENDANCE_CONSTANTS.MAX_DAILY_WORK_HOURS * 3600);
    });

    test('should handle corrupted timeline events', () => {
      const corruptedTimeline = [
        {
          type: EVENT_TYPES.PUNCH_IN,
          time: null, // Corrupted time
        },
        {
          type: null, // Corrupted type
          time: new Date(),
        },
        {
          type: EVENT_TYPES.PUNCH_IN,
          time: new Date(),
        },
      ];

      const status = calculateAttendanceStatusFromTimeline(
        corruptedTimeline,
        { start: '09:00', end: '18:00', isFlexible: false },
        8 * 3600
      );

      // Should still work with valid events
      expect(status.isAbsent).toBe(false);
      expect(status.arrivalTime).toBeTruthy();
    });
  });
});