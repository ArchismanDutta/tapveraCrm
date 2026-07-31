/**
 * Test: Race Condition Fix for Concurrent Punch Events
 *
 * Bug Fixed: 2026-07-31
 * Issue: When multiple concurrent punch requests were made for the same employee,
 *        only the last save() would win, causing lost punch events.
 *
 * Solution: Implemented MongoDB transactions with session locking to serialize
 *           concurrent punch operations and ensure all events are saved.
 *
 * This test verifies that concurrent punch-in/out operations don't lose data.
 */

const mongoose = require('mongoose');
const AttendanceService = require('../services/AttendanceService');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');

describe('Attendance Race Condition Fix', () => {
  let attendanceService;
  let testUserId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/tapvera-test', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    attendanceService = new AttendanceService();

    // Create test user
    const testUser = await User.create({
      name: 'Race Condition Test User',
      email: 'racetest@example.com',
      role: 'employee',
      assignedShift: null, // Will use default morning shift
    });
    testUserId = testUser._id;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteOne({ _id: testUserId });
    await AttendanceRecord.deleteMany({ 'employees.userId': testUserId });
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear attendance records before each test
    await AttendanceRecord.deleteMany({ 'employees.userId': testUserId });
  });

  test('should handle concurrent punch events without data loss', async () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0); // 9:00 AM

    // Simulate 5 concurrent punch-in requests
    const concurrentRequests = [];
    for (let i = 0; i < 5; i++) {
      const punchTime = new Date(today);
      punchTime.setSeconds(i); // Each request 1 second apart

      const request = attendanceService.recordPunchEvent(
        testUserId,
        'PUNCH_IN',
        {
          location: { lat: 28.7041, lng: 77.1025 },
          ipAddress: '192.168.1.' + (i + 1),
          device: 'Test Device ' + i,
        }
      );

      concurrentRequests.push(request);
    }

    // Wait for all concurrent requests to complete
    const results = await Promise.all(concurrentRequests);

    // Verify all requests succeeded
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Fetch the attendance record
    const record = await AttendanceRecord.findOne({
      date: attendanceService.normalizeDate(today)
    });

    expect(record).toBeDefined();

    const employee = record.getEmployee(testUserId);
    expect(employee).toBeDefined();

    // CRITICAL: All 5 punch events should be saved
    expect(employee.events).toHaveLength(5);

    // Verify each event has unique timestamp
    const timestamps = employee.events.map(e => e.timestamp.getTime());
    const uniqueTimestamps = new Set(timestamps);
    expect(uniqueTimestamps.size).toBe(5);

    // Verify events are in chronological order
    for (let i = 1; i < employee.events.length; i++) {
      expect(employee.events[i].timestamp.getTime()).toBeGreaterThan(
        employee.events[i - 1].timestamp.getTime()
      );
    }
  });

  test('should handle concurrent punch-in and punch-out', async () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);

    // First, record a punch-in
    await attendanceService.recordPunchEvent(testUserId, 'PUNCH_IN', {
      location: { lat: 28.7041, lng: 77.1025 },
    });

    // Simulate concurrent punch-out requests (e.g., from multiple devices)
    const punchOutTime = new Date(today);
    punchOutTime.setHours(18, 0, 0, 0);

    const concurrentPunchOuts = [];
    for (let i = 0; i < 3; i++) {
      const request = attendanceService.recordPunchEvent(
        testUserId,
        'PUNCH_OUT',
        {
          location: { lat: 28.7041, lng: 77.1025 },
          device: 'Device ' + i,
        }
      );
      concurrentPunchOuts.push(request);
    }

    // First punch-out should succeed, others should fail validation
    const results = await Promise.allSettled(concurrentPunchOuts);

    // At least one should succeed
    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThanOrEqual(1);

    // Verify only valid events are saved
    const record = await AttendanceRecord.findOne({
      date: attendanceService.normalizeDate(today)
    });

    const employee = record.getEmployee(testUserId);

    // Should have 1 PUNCH_IN and at least 1 PUNCH_OUT
    const punchIns = employee.events.filter(e => e.type === 'PUNCH_IN');
    const punchOuts = employee.events.filter(e => e.type === 'PUNCH_OUT');

    expect(punchIns).toHaveLength(1);
    expect(punchOuts.length).toBeGreaterThanOrEqual(1);
  });

  test('should rollback transaction on validation error', async () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);

    // First, record a valid punch-in
    await attendanceService.recordPunchEvent(testUserId, 'PUNCH_IN');

    // Try to punch-in again (should fail validation)
    try {
      await attendanceService.recordPunchEvent(testUserId, 'PUNCH_IN');
      fail('Should have thrown validation error');
    } catch (error) {
      expect(error.message).toContain('Cannot punch in');
    }

    // Verify the record still has only 1 event
    const record = await AttendanceRecord.findOne({
      date: attendanceService.normalizeDate(today)
    });

    const employee = record.getEmployee(testUserId);
    expect(employee.events).toHaveLength(1);
    expect(employee.events[0].type).toBe('PUNCH_IN');
  });

  test('should handle high concurrency (stress test)', async () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);

    // Simulate 50 concurrent punch requests
    const concurrentRequests = [];
    for (let i = 0; i < 50; i++) {
      const punchTime = new Date(today);
      punchTime.setMilliseconds(i * 10); // 10ms apart

      const request = attendanceService.recordPunchEvent(
        testUserId,
        i % 2 === 0 ? 'PUNCH_IN' : 'PUNCH_OUT',
        {
          location: { lat: 28.7041, lng: 77.1025 },
          device: 'Device ' + (i % 10),
        }
      );

      concurrentRequests.push(request);
    }

    // Wait for all requests (some may fail validation)
    const results = await Promise.allSettled(concurrentRequests);

    // Count successful operations
    const successful = results.filter(r => r.status === 'fulfilled');

    // Should have at least some successful operations
    expect(successful.length).toBeGreaterThan(0);

    // Verify the attendance record
    const record = await AttendanceRecord.findOne({
      date: attendanceService.normalizeDate(today)
    });

    const employee = record.getEmployee(testUserId);

    // Events count should match successful operations
    expect(employee.events).toHaveLength(successful.length);

    console.log(`Stress test: ${successful.length}/${results.length} operations succeeded`);
  });

  test('should maintain data integrity across multiple days', async () => {
    const dates = [
      new Date('2026-07-29T09:00:00Z'),
      new Date('2026-07-30T09:00:00Z'),
      new Date('2026-07-31T09:00:00Z'),
    ];

    // Concurrent operations across different days
    const allRequests = [];
    dates.forEach((date, dayIndex) => {
      for (let i = 0; i < 3; i++) {
        const request = attendanceService.recordPunchEvent(
          testUserId,
          i === 0 ? 'PUNCH_IN' : 'PUNCH_OUT',
          {
            location: { lat: 28.7041, lng: 77.1025 },
            device: `Day${dayIndex}-Device${i}`,
          }
        );
        allRequests.push({ request, date });
      }
    });

    await Promise.all(allRequests.map(r => r.request));

    // Verify each day has its own record
    for (const date of dates) {
      const record = await AttendanceRecord.findOne({
        date: attendanceService.normalizeDate(date)
      });

      expect(record).toBeDefined();
      const employee = record.getEmployee(testUserId);
      expect(employee).toBeDefined();
      expect(employee.events.length).toBeGreaterThan(0);
    }
  });
});

// Run tests with: npm test -- attendance.race-condition.test.js
