// tests/shiftManagement.test.js
const attendanceService = require('../services/attendanceCalculationService');

/**
 * Test Suite for Shift Management System
 * Tests shift assignment, effective shift calculation, and flexible shift logic
 */

// Mock User Models
const mockUsers = {
  standardEmployee: {
    _id: 'user1',
    shiftType: 'standard',
    standardShiftType: 'morning',
    assignedShift: 'shift123'
  },
  flexiblePermanentEmployee: {
    _id: 'user2',
    shiftType: 'flexiblePermanent'
  },
  standardWithOverride: {
    _id: 'user3',
    shiftType: 'standard',
    standardShiftType: 'morning',
    shiftOverrides: {
      '2024-01-15': {
        start: '10:00',
        end: '19:00',
        durationHours: 9,
        type: 'flexible'
      }
    }
  }
};

// Test cases for shift management
const shiftTestCases = [
  {
    name: 'Standard Morning Shift Assignment',
    user: mockUsers.standardEmployee,
    date: '2024-01-15',
    expected: {
      shiftType: 'standard',
      start: '09:00',
      end: '18:00',
      durationHours: 9,
      isFlexible: false,
      source: 'standard'
    }
  },
  {
    name: 'Flexible Permanent Shift',
    user: mockUsers.flexiblePermanentEmployee,
    date: '2024-01-15',
    expected: {
      shiftType: 'flexiblePermanent',
      start: '00:00',
      end: '23:59',
      durationHours: 9,
      isFlexible: true,
      source: 'flexiblePermanent'
    }
  },
  {
    name: 'Standard Employee with One-Day Override',
    user: mockUsers.standardWithOverride,
    date: '2024-01-15',
    expected: {
      shiftType: 'flexible',
      start: '10:00',
      end: '19:00',
      durationHours: 9,
      isFlexible: true,
      source: 'override'
    }
  },
  {
    name: 'Standard Employee without Override (different date)',
    user: mockUsers.standardWithOverride,
    date: '2024-01-16',
    expected: {
      shiftType: 'standard',
      start: '09:00',
      end: '18:00',
      durationHours: 9,
      isFlexible: false,
      source: 'standard'
    }
  }
];

// Mock the User.findById for testing
function mockGetUserData(userId) {
  return Object.values(mockUsers).find(user => user._id === userId) || null;
}

// Mock effective shift calculation
function mockGetEffectiveShift(userId, date) {
  const user = mockGetUserData(userId);
  if (!user) return null;

  const dateKey = new Date(date).toISOString().slice(0, 10);

  // Check for overrides first
  if (user.shiftOverrides && user.shiftOverrides[dateKey]) {
    const override = user.shiftOverrides[dateKey];
    return {
      start: override.start,
      end: override.end,
      durationHours: override.durationHours,
      isFlexible: override.type === 'flexible',
      isFlexiblePermanent: false,
      source: 'override',
      type: override.type,
      shiftName: 'Override Shift',
      isOneDayFlexibleOverride: override.type === 'flexible' && user.shiftType === 'standard'
    };
  }

  // FlexiblePermanent
  if (user.shiftType === 'flexiblePermanent') {
    return {
      start: '00:00',
      end: '23:59',
      durationHours: 9,
      isFlexible: true,
      isFlexiblePermanent: true,
      source: 'flexiblePermanent',
      type: 'flexiblePermanent',
      shiftName: 'FlexiblePermanent Shift'
    };
  }

  // Standard shift based on standardShiftType
  if (user.shiftType === 'standard') {
    const shifts = {
      morning: { start: '09:00', end: '18:00', name: 'Day Shift (Morning Shift)' },
      evening: { start: '13:00', end: '22:00', name: 'Evening Shift' },
      night: { start: '20:00', end: '05:00', name: 'Night Shift' },
      early: { start: '05:30', end: '14:30', name: 'Early Morning Shift' }
    };

    const shift = shifts[user.standardShiftType] || shifts.morning;
    return {
      start: shift.start,
      end: shift.end,
      durationHours: 9,
      isFlexible: false,
      isFlexiblePermanent: false,
      source: 'standard',
      type: 'standard',
      shiftName: shift.name
    };
  }

  return null;
}

// Punch-in validation tests
const punchInTests = [
  {
    name: 'Valid punch-in for standard shift',
    shiftType: 'standard',
    shiftStart: '09:00',
    punchTime: '2024-01-15T09:00:00Z',
    expected: { isValid: true }
  },
  {
    name: 'Valid early punch-in (within 2 hours)',
    shiftType: 'standard',
    shiftStart: '09:00',
    punchTime: '2024-01-15T07:30:00Z', // 90 minutes early
    expected: { isValid: true }
  },
  {
    name: 'Invalid early punch-in (more than 2 hours)',
    shiftType: 'standard',
    shiftStart: '09:00',
    punchTime: '2024-01-15T06:30:00Z', // 150 minutes early
    expected: { isValid: false }
  },
  {
    name: 'Valid punch-in for flexible shift (any time)',
    shiftType: 'flexible',
    shiftStart: null,
    punchTime: '2024-01-15T14:30:00Z',
    expected: { isValid: true }
  },
  {
    name: 'Valid punch-in for flexiblePermanent (any time)',
    shiftType: 'flexiblePermanent',
    shiftStart: null,
    punchTime: '2024-01-15T03:45:00Z',
    expected: { isValid: true }
  }
];

// Late calculation tests
const lateCalculationTests = [
  {
    name: 'On-time arrival',
    arrivalTime: '2024-01-15T09:00:00Z',
    shiftStart: '09:00',
    expected: { isLate: false, isEarly: false, minutesDifference: 0 }
  },
  {
    name: 'Early arrival',
    arrivalTime: '2024-01-15T08:45:00Z',
    shiftStart: '09:00',
    expected: { isLate: false, isEarly: true, minutesDifference: -15 }
  },
  {
    name: 'Late arrival',
    arrivalTime: '2024-01-15T09:30:00Z',
    shiftStart: '09:00',
    expected: { isLate: true, isEarly: false, minutesDifference: 30 }
  },
  {
    name: 'Very late arrival',
    arrivalTime: '2024-01-15T11:00:00Z',
    shiftStart: '09:00',
    expected: { isLate: true, isEarly: false, minutesDifference: 120 }
  }
];

// Test runner functions
function runShiftManagementTests() {
  console.log('='.repeat(60));
  console.log('SHIFT MANAGEMENT TEST SUITE');
  console.log('='.repeat(60));

  let passedTests = 0;
  let totalTests = 0;

  // Test effective shift calculation
  console.log('\n📋 EFFECTIVE SHIFT CALCULATION TESTS');
  console.log('-'.repeat(40));

  shiftTestCases.forEach((testCase, index) => {
    totalTests++;
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const result = mockGetEffectiveShift(testCase.user._id, testCase.date);
      const expected = testCase.expected;

      let testPassed = true;
      let errors = [];

      if (!result) {
        errors.push('No shift returned');
        testPassed = false;
      } else {
        if (result.start !== expected.start) {
          errors.push(`start: expected ${expected.start}, got ${result.start}`);
          testPassed = false;
        }
        if (result.end !== expected.end) {
          errors.push(`end: expected ${expected.end}, got ${result.end}`);
          testPassed = false;
        }
        if (result.durationHours !== expected.durationHours) {
          errors.push(`durationHours: expected ${expected.durationHours}, got ${result.durationHours}`);
          testPassed = false;
        }
        if (result.isFlexible !== expected.isFlexible) {
          errors.push(`isFlexible: expected ${expected.isFlexible}, got ${result.isFlexible}`);
          testPassed = false;
        }
        if (result.source !== expected.source) {
          errors.push(`source: expected ${expected.source}, got ${result.source}`);
          testPassed = false;
        }
      }

      if (testPassed) {
        console.log(`   ✅ PASSED - ${result.start}-${result.end} (${result.source})`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        errors.forEach(error => console.log(`      - ${error}`));
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });

  // Test punch-in validation
  console.log('\n⏰ PUNCH-IN VALIDATION TESTS');
  console.log('-'.repeat(40));

  punchInTests.forEach((testCase, index) => {
    totalTests++;
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const mockShift = {
        start: testCase.shiftStart,
        isFlexible: testCase.shiftType === 'flexible',
        isFlexiblePermanent: testCase.shiftType === 'flexiblePermanent',
        isOneDayFlexibleOverride: testCase.shiftType === 'flexible'
      };

      const result = attendanceService.validatePunchInTime(
        new Date(testCase.punchTime),
        mockShift
      );

      const expected = testCase.expected;

      if (result.isValid === expected.isValid) {
        console.log(`   ✅ PASSED - ${result.isValid ? 'Valid' : 'Invalid'}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Expected ${expected.isValid}, got ${result.isValid}`);
        console.log(`      Message: ${result.message}`);
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });

  // Test late calculation
  console.log('\n⏱️ LATE CALCULATION TESTS');
  console.log('-'.repeat(40));

  lateCalculationTests.forEach((testCase, index) => {
    totalTests++;
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    try {
      const result = attendanceService.calculateEarlyLateArrival(
        testCase.arrivalTime,
        testCase.shiftStart
      );

      const expected = testCase.expected;
      let testPassed = true;
      let errors = [];

      if (result.isLate !== expected.isLate) {
        errors.push(`isLate: expected ${expected.isLate}, got ${result.isLate}`);
        testPassed = false;
      }
      if (result.isEarly !== expected.isEarly) {
        errors.push(`isEarly: expected ${expected.isEarly}, got ${result.isEarly}`);
        testPassed = false;
      }
      if (Math.abs(result.minutesDifference - expected.minutesDifference) > 1) {
        errors.push(`minutesDifference: expected ${expected.minutesDifference}, got ${result.minutesDifference}`);
        testPassed = false;
      }

      if (testPassed) {
        console.log(`   ✅ PASSED - ${result.minutesDifference} minutes ${result.isEarly ? 'early' : result.isLate ? 'late' : 'on-time'}`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED`);
        errors.forEach(error => console.log(`      - ${error}`));
      }

    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`SHIFT MANAGEMENT TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('='.repeat(60));

  return { passed: passedTests, total: totalTests };
}

// Export for use in other files
module.exports = {
  runShiftManagementTests,
  shiftTestCases,
  punchInTests,
  lateCalculationTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runShiftManagementTests();
}