// tests/attendanceCalculation.test.js
const attendanceService = require('../services/attendanceCalculationService');

/**
 * Test Suite for Attendance Calculation Service
 * This test suite verifies that the attendance calculation logic works correctly
 * for different shift types and scenarios
 */

// Mock data for testing
const mockStandardUser = {
  _id: 'user123',
  shiftType: 'standard',
  standardShiftType: 'morning', // 9:00 AM - 6:00 PM
};

const mockFlexiblePermanentUser = {
  _id: 'user456',
  shiftType: 'flexiblePermanent',
};

const mockStandardUserWithFlexRequest = {
  _id: 'user789',
  shiftType: 'standard',
  standardShiftType: 'morning',
};

// Test cases for different scenarios
const testCases = [
  // Standard Shift Test Cases
  {
    name: 'Standard Shift - Full Day (8+ hours work)',
    shiftType: 'standard',
    workedSessions: [
      { start: '2024-01-15T09:00:00Z', end: '2024-01-15T18:00:00Z' } // 9 hours
    ],
    breakSessions: [
      { start: '2024-01-15T13:00:00Z', end: '2024-01-15T14:00:00Z' } // 1 hour break
    ],
    arrivalTime: '2024-01-15T09:00:00Z', // On time
    expected: {
      isFullDay: true,
      isHalfDay: false,
      isAbsent: false,
      isLate: false,
      workHours: 9,
      breakHours: 1
    }
  },
  {
    name: 'Standard Shift - Late Arrival',
    shiftType: 'standard',
    workedSessions: [
      { start: '2024-01-15T09:30:00Z', end: '2024-01-15T18:00:00Z' } // 8.5 hours
    ],
    breakSessions: [
      { start: '2024-01-15T13:00:00Z', end: '2024-01-15T14:00:00Z' } // 1 hour break
    ],
    arrivalTime: '2024-01-15T09:30:00Z', // 30 minutes late
    expected: {
      isFullDay: true,
      isHalfDay: false,
      isAbsent: false,
      isLate: true,
      workHours: 8.5,
      breakHours: 1
    }
  },
  {
    name: 'Standard Shift - Half Day (5-7 hours work)',
    shiftType: 'standard',
    workedSessions: [
      { start: '2024-01-15T09:00:00Z', end: '2024-01-15T15:00:00Z' } // 6 hours
    ],
    breakSessions: [
      { start: '2024-01-15T13:00:00Z', end: '2024-01-15T13:30:00Z' } // 30 min break
    ],
    arrivalTime: '2024-01-15T09:00:00Z',
    expected: {
      isFullDay: false,
      isHalfDay: true,
      isAbsent: false,
      isLate: false,
      workHours: 6,
      breakHours: 0.5
    }
  },
  {
    name: 'Standard Shift - Absent (< 5 hours work)',
    shiftType: 'standard',
    workedSessions: [
      { start: '2024-01-15T09:00:00Z', end: '2024-01-15T13:00:00Z' } // 4 hours
    ],
    breakSessions: [],
    arrivalTime: '2024-01-15T09:00:00Z',
    expected: {
      isFullDay: false,
      isHalfDay: false,
      isAbsent: true,
      isLate: false,
      workHours: 4,
      breakHours: 0
    }
  },

  // FlexiblePermanent Shift Test Cases
  {
    name: 'FlexiblePermanent - Full Day (9+ total hours)',
    shiftType: 'flexiblePermanent',
    workedSessions: [
      { start: '2024-01-15T10:00:00Z', end: '2024-01-15T19:00:00Z' } // 9 hours work
    ],
    breakSessions: [
      { start: '2024-01-15T13:00:00Z', end: '2024-01-15T14:00:00Z' } // 1 hour break
    ],
    arrivalTime: '2024-01-15T10:00:00Z', // No late concept for flexible
    expected: {
      isFullDay: true,
      isHalfDay: false,
      isAbsent: false,
      isLate: false, // No late for flexible
      workHours: 9,
      breakHours: 1,
      totalHours: 10
    }
  },
  {
    name: 'FlexiblePermanent - Exactly 9 hours total (8 work + 1 break)',
    shiftType: 'flexiblePermanent',
    workedSessions: [
      { start: '2024-01-15T10:00:00Z', end: '2024-01-15T18:00:00Z' } // 8 hours work
    ],
    breakSessions: [
      { start: '2024-01-15T13:00:00Z', end: '2024-01-15T14:00:00Z' } // 1 hour break
    ],
    arrivalTime: '2024-01-15T10:00:00Z',
    expected: {
      isFullDay: true,
      isHalfDay: false,
      isAbsent: false,
      isLate: false,
      workHours: 8,
      breakHours: 1,
      totalHours: 9
    }
  },
  {
    name: 'FlexiblePermanent - Half Day (5-8 total hours)',
    shiftType: 'flexiblePermanent',
    workedSessions: [
      { start: '2024-01-15T10:00:00Z', end: '2024-01-15T16:00:00Z' } // 6 hours work
    ],
    breakSessions: [
      { start: '2024-01-15T13:00:00Z', end: '2024-01-15T13:30:00Z' } // 30 min break
    ],
    arrivalTime: '2024-01-15T10:00:00Z',
    expected: {
      isFullDay: false,
      isHalfDay: true,
      isAbsent: false,
      isLate: false,
      workHours: 6,
      breakHours: 0.5,
      totalHours: 6.5
    }
  },
  {
    name: 'FlexiblePermanent - Absent (< 5 total hours)',
    shiftType: 'flexiblePermanent',
    workedSessions: [
      { start: '2024-01-15T10:00:00Z', end: '2024-01-15T13:00:00Z' } // 3 hours work
    ],
    breakSessions: [
      { start: '2024-01-15T13:00:00Z', end: '2024-01-15T13:30:00Z' } // 30 min break
    ],
    arrivalTime: '2024-01-15T10:00:00Z',
    expected: {
      isFullDay: false,
      isHalfDay: false,
      isAbsent: true,
      isLate: false,
      workHours: 3,
      breakHours: 0.5,
      totalHours: 3.5
    }
  }
];

// Helper function to calculate durations from sessions
function calculateSessionDuration(sessions) {
  let totalSeconds = 0;
  sessions.forEach(session => {
    if (session.start && session.end) {
      const start = new Date(session.start);
      const end = new Date(session.end);
      totalSeconds += Math.floor((end - start) / 1000);
    }
  });
  return totalSeconds;
}

// Mock the getEffectiveShift function for testing
function mockGetEffectiveShift(userId, date, shiftType) {
  if (shiftType === 'flexiblePermanent') {
    return {
      start: "00:00",
      end: "23:59",
      durationHours: 9,
      isFlexible: true,
      isFlexiblePermanent: true,
      source: "flexiblePermanent",
      type: "flexiblePermanent",
      shiftName: "FlexiblePermanent Shift",
      isOneDayFlexibleOverride: false
    };
  } else {
    return {
      start: "09:00",
      end: "18:00",
      durationHours: 9,
      isFlexible: false,
      isFlexiblePermanent: false,
      source: "standard",
      type: "standard",
      shiftName: "Day Shift (Morning Shift)",
      isOneDayFlexibleOverride: false
    };
  }
}

// Run the tests
function runAttendanceTests() {
  console.log('='.repeat(60));
  console.log('ATTENDANCE CALCULATION TEST SUITE');
  console.log('='.repeat(60));

  let passedTests = 0;
  let totalTests = testCases.length;

  testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.name}`);
    console.log('-'.repeat(40));

    try {
      // Calculate durations
      const workDurationSeconds = calculateSessionDuration(testCase.workedSessions || []);
      const breakDurationSeconds = calculateSessionDuration(testCase.breakSessions || []);

      // Get mock effective shift
      const effectiveShift = mockGetEffectiveShift('testuser', '2024-01-15', testCase.shiftType);

      // Calculate attendance status
      const attendanceStatus = attendanceService.calculateAttendanceStatus(
        workDurationSeconds,
        breakDurationSeconds,
        effectiveShift
      );

      // Calculate early/late arrival for standard shifts
      let earlyLateInfo = { isEarly: false, isLate: false, minutesDifference: 0 };
      if (!effectiveShift.isFlexible && !effectiveShift.isFlexiblePermanent && !effectiveShift.isOneDayFlexibleOverride) {
        earlyLateInfo = attendanceService.calculateEarlyLateArrival(
          testCase.arrivalTime,
          effectiveShift.start
        );
      }

      // Combine results
      const result = {
        ...attendanceStatus,
        isLate: earlyLateInfo.isLate
      };

      // Check results
      const expected = testCase.expected;
      let testPassed = true;
      let errors = [];

      // Check attendance flags
      if (result.isFullDay !== expected.isFullDay) {
        errors.push(`isFullDay: expected ${expected.isFullDay}, got ${result.isFullDay}`);
        testPassed = false;
      }
      if (result.isHalfDay !== expected.isHalfDay) {
        errors.push(`isHalfDay: expected ${expected.isHalfDay}, got ${result.isHalfDay}`);
        testPassed = false;
      }
      if (result.isAbsent !== expected.isAbsent) {
        errors.push(`isAbsent: expected ${expected.isAbsent}, got ${result.isAbsent}`);
        testPassed = false;
      }
      if (result.isLate !== expected.isLate) {
        errors.push(`isLate: expected ${expected.isLate}, got ${result.isLate}`);
        testPassed = false;
      }

      // Check hours (with tolerance for floating point)
      const tolerance = 0.1;
      if (Math.abs(result.workHours - expected.workHours) > tolerance) {
        errors.push(`workHours: expected ${expected.workHours}, got ${result.workHours}`);
        testPassed = false;
      }
      if (Math.abs(result.breakHours - expected.breakHours) > tolerance) {
        errors.push(`breakHours: expected ${expected.breakHours}, got ${result.breakHours}`);
        testPassed = false;
      }
      if (expected.totalHours && Math.abs(result.totalHours - expected.totalHours) > tolerance) {
        errors.push(`totalHours: expected ${expected.totalHours}, got ${result.totalHours}`);
        testPassed = false;
      }

      // Display results
      console.log(`Work Hours: ${result.workHours.toFixed(1)}`);
      console.log(`Break Hours: ${result.breakHours.toFixed(1)}`);
      console.log(`Total Hours: ${result.totalHours.toFixed(1)}`);
      console.log(`Full Day: ${result.isFullDay}`);
      console.log(`Half Day: ${result.isHalfDay}`);
      console.log(`Absent: ${result.isAbsent}`);
      console.log(`Late: ${result.isLate}`);

      if (testPassed) {
        console.log('✅ TEST PASSED');
        passedTests++;
      } else {
        console.log('❌ TEST FAILED');
        errors.forEach(error => console.log(`   - ${error}`));
      }

    } catch (error) {
      console.log('❌ TEST ERROR:', error.message);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(60));

  return { passed: passedTests, total: totalTests };
}

// Export for use in other files
module.exports = {
  runAttendanceTests,
  testCases,
  mockGetEffectiveShift
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAttendanceTests();
}