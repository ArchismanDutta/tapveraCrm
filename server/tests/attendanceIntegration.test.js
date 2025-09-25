// tests/attendanceIntegration.test.js
// Integration tests for the complete attendance system

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const UserStatus = require('../models/UserStatus');
const DailyWork = require('../models/DailyWork');

describe('Attendance System Integration Tests', () => {
  let mongoServer;
  let testUser;
  let authToken;

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

    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedPassword',
      department: 'Engineering',
      designation: 'Developer',
      role: 'employee',
      shiftType: 'standard',
      standardShiftType: 'morning',
      timeZone: 'UTC',
    });

    // Create auth token
    authToken = jwt.sign(
      { userId: testUser._id, role: testUser.role },
      process.env.JWT_SECRET || 'test_secret'
    );
  });

  describe('Complete Punch In/Out Flow', () => {
    test('should handle complete punch in, break, and punch out flow', async () => {
      // 1. Get initial status (should be absent)
      const initialResponse = await request(app)
        .get('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(initialResponse.body.isAbsent).toBe(true);
      expect(initialResponse.body.currentlyWorking).toBe(false);
      expect(initialResponse.body.workDurationSeconds).toBe(0);

      // 2. Punch In
      const punchInResponse = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: {
            type: 'Punch In',
          },
        })
        .expect(200);

      expect(punchInResponse.body.currentlyWorking).toBe(true);
      expect(punchInResponse.body.isAbsent).toBe(false);
      expect(punchInResponse.body.arrivalTime).toBeTruthy();
      expect(punchInResponse.body.timeline).toHaveLength(1);
      expect(punchInResponse.body.workedSessions).toHaveLength(1);

      // Wait a moment to simulate work time
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Start Break
      const breakStartResponse = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: {
            type: 'Break Start',
            breakType: 'lunch',
          },
        })
        .expect(200);

      expect(breakStartResponse.body.onBreak).toBe(true);
      expect(breakStartResponse.body.currentlyWorking).toBe(true);
      expect(breakStartResponse.body.timeline).toHaveLength(2);
      expect(breakStartResponse.body.breakSessions).toHaveLength(1);

      // 4. Resume Work
      const resumeWorkResponse = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: {
            type: 'Resume Work',
          },
        })
        .expect(200);

      expect(resumeWorkResponse.body.onBreak).toBe(false);
      expect(resumeWorkResponse.body.currentlyWorking).toBe(true);
      expect(resumeWorkResponse.body.timeline).toHaveLength(3);

      // 5. Punch Out
      const punchOutResponse = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: {
            type: 'Punch Out',
          },
        })
        .expect(200);

      expect(punchOutResponse.body.currentlyWorking).toBe(false);
      expect(punchOutResponse.body.onBreak).toBe(false);
      expect(punchOutResponse.body.departureTime).toBeTruthy();
      expect(punchOutResponse.body.timeline).toHaveLength(4);

      // Verify work duration is calculated
      expect(punchOutResponse.body.workDurationSeconds).toBeGreaterThan(0);
      expect(punchOutResponse.body.breakDurationSeconds).toBeGreaterThan(0);
    });

    test('should prevent duplicate punch in', async () => {
      // First punch in - should succeed
      await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: { type: 'Punch In' },
        })
        .expect(200);

      // Second punch in - should fail
      const response = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: { type: 'Punch In' },
        })
        .expect(400);

      expect(response.body.message).toContain('Already punched in');
    });

    test('should prevent punch out without punch in', async () => {
      const response = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: { type: 'Punch Out' },
        })
        .expect(400);

      expect(response.body.message).toContain('Cannot punch out when not working');
    });

    test('should prevent break start without punch in', async () => {
      const response = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: { type: 'Break Start' },
        })
        .expect(400);

      expect(response.body.message).toContain('Cannot start break when not working');
    });
  });

  describe('Weekly Summary Consistency', () => {
    test('should provide consistent data between status and summary endpoints', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create a complete day of work
      await UserStatus.create({
        userId: testUser._id,
        today,
        timeline: [
          {
            type: 'Punch In',
            time: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9 AM
          },
          {
            type: 'Break Start',
            time: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12 PM
          },
          {
            type: 'Resume Work',
            time: new Date(today.getTime() + 13 * 60 * 60 * 1000), // 1 PM
          },
          {
            type: 'Punch Out',
            time: new Date(today.getTime() + 17 * 60 * 60 * 1000), // 5 PM
          },
        ],
        workedSessions: [
          {
            start: new Date(today.getTime() + 9 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 12 * 60 * 60 * 1000),
          },
          {
            start: new Date(today.getTime() + 13 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 17 * 60 * 60 * 1000),
          },
        ],
        breakSessions: [
          {
            start: new Date(today.getTime() + 12 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 13 * 60 * 60 * 1000),
          },
        ],
        currentlyWorking: false,
        onBreak: false,
        arrivalTime: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      });

      // Sync to DailyWork (this should happen automatically but let's ensure it)
      await DailyWork.create({
        userId: testUser._id,
        date: today,
        workDurationSeconds: 7 * 3600, // 7 hours
        breakDurationSeconds: 60 * 60, // 1 hour
        workedSessions: [
          {
            start: new Date(today.getTime() + 9 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 12 * 60 * 60 * 1000),
          },
          {
            start: new Date(today.getTime() + 13 * 60 * 60 * 1000),
            end: new Date(today.getTime() + 17 * 60 * 60 * 1000),
          },
        ],
        timeline: [
          {
            type: 'Punch In',
            time: new Date(today.getTime() + 9 * 60 * 60 * 1000),
          },
          {
            type: 'Punch Out',
            time: new Date(today.getTime() + 17 * 60 * 60 * 1000),
          },
        ],
        isLate: false,
        isAbsent: false,
        isHalfDay: false,
      });

      // Get today's status
      const statusResponse = await request(app)
        .get('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Get weekly summary
      const summaryResponse = await request(app)
        .get('/api/summary/week')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Find today's data in the summary
      const todayInSummary = summaryResponse.body.dailyData.find(
        day => new Date(day.date).toDateString() === today.toDateString()
      );

      expect(todayInSummary).toBeTruthy();

      // Verify consistency
      expect(statusResponse.body.workDurationSeconds).toBe(todayInSummary.workDurationSeconds);
      expect(statusResponse.body.breakDurationSeconds).toBe(todayInSummary.breakDurationSeconds);
      expect(statusResponse.body.isLate).toBe(todayInSummary.isLate);
      expect(statusResponse.body.isAbsent).toBe(todayInSummary.isAbsent);
      expect(statusResponse.body.isHalfDay).toBe(todayInSummary.isHalfDay);
    });

    test('should calculate weekly totals correctly', async () => {
      const today = new Date();
      const mondayOfThisWeek = new Date(today);
      const day = today.getDay();
      const diffToMonday = (day + 6) % 7;
      mondayOfThisWeek.setDate(today.getDate() - diffToMonday);
      mondayOfThisWeek.setHours(0, 0, 0, 0);

      // Create work data for Monday to Friday (5 days)
      const workDays = 5;
      const hoursPerDay = 8;

      for (let i = 0; i < workDays; i++) {
        const workDate = new Date(mondayOfThisWeek);
        workDate.setDate(mondayOfThisWeek.getDate() + i);

        await DailyWork.create({
          userId: testUser._id,
          date: workDate,
          workDurationSeconds: hoursPerDay * 3600,
          breakDurationSeconds: 60 * 60, // 1 hour break
          isLate: i === 2, // Make Wednesday late
          isAbsent: false,
          isHalfDay: i === 4, // Make Friday half day
        });
      }

      // Get weekly summary
      const summaryResponse = await request(app)
        .get('/api/summary/week')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const summary = summaryResponse.body.weeklySummary;

      expect(summary.presentDays).toBe(5);
      expect(summary.lateDays).toBe(1);
      expect(summary.absentDays).toBe(0);
      expect(summary.totalWorkHours).toBe(40); // 5 days * 8 hours
      expect(summary.averageDailyHours).toBe(8);
      expect(summary.attendanceRate).toBe(100); // 5/5 days present
      expect(summary.onTimeRate).toBe(80); // 4/5 days on time
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed timeline events', async () => {
      const response = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: {
            type: 'Invalid Event Type',
          },
        })
        .expect(400);

      expect(response.body.message).toContain('Unknown event type');
    });

    test('should handle missing timeline event', async () => {
      const response = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain('Timeline event is required');
    });

    test('should handle unauthorized requests', async () => {
      await request(app)
        .get('/api/status/today')
        .expect(401);

      await request(app)
        .put('/api/status/today')
        .send({
          timelineEvent: { type: 'Punch In' },
        })
        .expect(401);
    });

    test('should handle invalid token', async () => {
      await request(app)
        .get('/api/status/today')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);
    });

    test('should validate punch in time for standard shifts', async () => {
      // Try to punch in way too early (6 AM for 9 AM shift)
      const earlyTime = new Date();
      earlyTime.setHours(6, 0, 0, 0);

      // Mock the current time to be 6 AM
      const originalNow = Date.now;
      Date.now = () => earlyTime.getTime();

      const response = await request(app)
        .put('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          timelineEvent: { type: 'Punch In' },
        })
        .expect(400);

      expect(response.body.message).toContain('Cannot punch in more than');

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('Data Consistency After Operations', () => {
    test('should maintain data consistency after multiple operations', async () => {
      // Perform multiple punch operations
      const operations = [
        { type: 'Punch In' },
        { type: 'Break Start' },
        { type: 'Resume Work' },
        { type: 'Break Start' },
        { type: 'Resume Work' },
        { type: 'Punch Out' },
      ];

      let lastResponse;
      for (const operation of operations) {
        lastResponse = await request(app)
          .put('/api/status/today')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ timelineEvent: operation })
          .expect(200);

        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify final state
      expect(lastResponse.body.currentlyWorking).toBe(false);
      expect(lastResponse.body.onBreak).toBe(false);
      expect(lastResponse.body.timeline).toHaveLength(6);
      expect(lastResponse.body.workedSessions.length).toBeGreaterThan(0);
      expect(lastResponse.body.breakSessions).toHaveLength(2);

      // Verify all sessions have end times (since we punched out)
      lastResponse.body.workedSessions.forEach(session => {
        expect(session.end).toBeTruthy();
      });

      lastResponse.body.breakSessions.forEach(session => {
        expect(session.end).toBeTruthy();
      });

      // Get fresh status to ensure consistency
      const freshStatus = await request(app)
        .get('/api/status/today')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(freshStatus.body.workDurationSeconds).toBe(lastResponse.body.workDurationSeconds);
      expect(freshStatus.body.breakDurationSeconds).toBe(lastResponse.body.breakDurationSeconds);
      expect(freshStatus.body.timeline).toHaveLength(6);
    });
  });

  describe('Admin Endpoints', () => {
    let adminUser;
    let adminToken;

    beforeEach(async () => {
      adminUser = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'hashedPassword',
        department: 'HR',
        designation: 'HR Manager',
        role: 'admin',
      });

      adminToken = jwt.sign(
        { userId: adminUser._id, role: adminUser.role },
        process.env.JWT_SECRET || 'test_secret'
      );
    });

    test('should allow admin to view employee status', async () => {
      // Create some work data for the test employee
      await UserStatus.create({
        userId: testUser._id,
        today: new Date(),
        currentlyWorking: true,
        workDurationSeconds: 4 * 3600,
        timeline: [{ type: 'Punch In', time: new Date() }],
        workedSessions: [{ start: new Date() }],
        breakSessions: [],
      });

      const response = await request(app)
        .get(`/api/status/employee/${testUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.employeeId).toBe(testUser._id.toString());
      expect(response.body.currentlyWorking).toBe(true);
      expect(response.body.workDurationSeconds).toBeGreaterThan(0);
    });

    test('should allow admin to get employee weekly summary', async () => {
      const response = await request(app)
        .get('/api/summary/week')
        .query({ userId: testUser._id.toString() })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.dailyData).toBeTruthy();
      expect(response.body.weeklySummary).toBeTruthy();
    });

    test('should prevent regular employee from accessing other employee data', async () => {
      await request(app)
        .get(`/api/status/employee/${adminUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      await request(app)
        .get('/api/summary/week')
        .query({ userId: adminUser._id.toString() })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});