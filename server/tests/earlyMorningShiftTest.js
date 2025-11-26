// Test script for Early Morning Shift (5:30 AM - 14:30) attendance fixes
// Tests both the early punch-in validation and the absent/present logic

const AttendanceService = require('../services/AttendanceService');

console.log('='.repeat(80));
console.log('EARLY MORNING SHIFT (5:30 AM - 14:30) TEST SUITE');
console.log('='.repeat(80));

const service = new AttendanceService();

// Define Early Morning Shift
const earlyMorningShift = {
  name: "Early Morning Shift",
  startTime: "05:30",
  endTime: "14:30",
  durationHours: 9,
  isFlexible: false,
  type: "STANDARD"
};

console.log('\n📋 Shift Details:');
console.log(`   Name: ${earlyMorningShift.name}`);
console.log(`   Start: ${earlyMorningShift.startTime} IST`);
console.log(`   End: ${earlyMorningShift.endTime} IST`);
console.log(`   Duration: ${earlyMorningShift.durationHours} hours`);

// Test scenarios
const testScenarios = [
  {
    name: "Test 1: Punch in at 3:29 AM (2h 1m early) - SHOULD FAIL",
    punchTime: new Date('2025-01-17T21:59:00.000Z'), // 3:29 AM IST = Jan 17 21:59 UTC (prev day)
    shouldPass: false,
    expectedError: "Cannot punch in more than 2 hours before shift start time"
  },
  {
    name: "Test 1b: Punch in at 3:30 AM (exactly 2 hours early) - SHOULD PASS",
    punchTime: new Date('2025-01-17T22:00:00.000Z'), // 3:30 AM IST = Jan 17 22:00 UTC (prev day)
    shouldPass: true,
    expectedError: null
  },
  {
    name: "Test 2: Punch in at 3:31 AM (1h 59m early) - SHOULD PASS",
    punchTime: new Date('2025-01-17T22:01:00.000Z'), // 3:31 AM IST = Jan 17 22:01 UTC (prev day)
    shouldPass: true,
    expectedError: null
  },
  {
    name: "Test 3: Punch in at 5:10 AM (20 minutes early) - SHOULD PASS",
    punchTime: new Date('2025-01-17T23:40:00.000Z'), // 5:10 AM IST = Jan 17 23:40 UTC (prev day)
    shouldPass: true,
    expectedError: null
  },
  {
    name: "Test 4: Punch in at 5:30 AM sharp (exactly on time) - SHOULD PASS",
    punchTime: new Date('2025-01-18T00:00:00.000Z'), // 5:30 AM IST = Jan 18 00:00 UTC
    shouldPass: true,
    expectedError: null,
    checkPresent: true // Verify employee is marked as PRESENT immediately
  },
  {
    name: "Test 5: Punch in at 5:31 AM (1 minute late) - SHOULD PASS but LATE",
    punchTime: new Date('2025-01-18T00:01:00.000Z'), // 5:31 AM IST = Jan 18 00:01 UTC
    shouldPass: true,
    expectedError: null,
    checkLate: true
  }
];

// Mock employee record
const createMockEmployee = (shift) => ({
  userId: 'test-user-123',
  events: [],
  calculated: service.getDefaultCalculatedData(),
  assignedShift: shift,
  leaveInfo: {
    isOnLeave: false,
    isWFH: false,
    isPaidLeave: false,
    leaveType: null,
    isHoliday: false,
    holidayName: null
  },
  performance: service.getDefaultPerformanceData(),
  metadata: {
    lastUpdated: new Date(),
    version: 1,
    syncStatus: 'SYNCED'
  }
});

// Helper function to format IST time from UTC
function getISTTimeString(utcDate) {
  const istTime = service.getISTTimeComponents(utcDate);
  if (!istTime) return 'Invalid';
  return `${String(istTime.hour).padStart(2, '0')}:${String(istTime.minute).padStart(2, '0')}:${String(istTime.second).padStart(2, '0')}`;
}

// Run tests
let passedTests = 0;
let failedTests = 0;

console.log('\n' + '='.repeat(80));
console.log('RUNNING TESTS');
console.log('='.repeat(80));

testScenarios.forEach((scenario, index) => {
  console.log(`\n🧪 ${scenario.name}`);
  console.log(`   Punch time (UTC): ${scenario.punchTime.toISOString()}`);
  console.log(`   Punch time (IST): ${getISTTimeString(scenario.punchTime)}`);

  const employee = createMockEmployee(earlyMorningShift);

  try {
    // Test early punch-in validation
    service.validateEarlyPunchIn(scenario.punchTime, earlyMorningShift);

    if (scenario.shouldPass) {
      console.log('   ✅ Validation passed (as expected)');

      // If we need to check presence, simulate the punch-in event
      if (scenario.checkPresent || scenario.checkLate) {
        // Add punch-in event
        employee.events.push({
          type: 'PUNCH_IN',
          timestamp: scenario.punchTime
        });

        // Recalculate
        const attendanceDate = service.getAttendanceDateForPunch(scenario.punchTime, earlyMorningShift);
        service.recalculateEmployeeData(employee, attendanceDate);

        console.log(`   📊 Calculated Status:`);
        console.log(`      - isPresent: ${employee.calculated.isPresent}`);
        console.log(`      - isAbsent: ${employee.calculated.isAbsent}`);
        console.log(`      - isLate: ${employee.calculated.isLate}`);
        console.log(`      - arrivalTime: ${employee.calculated.arrivalTime ? getISTTimeString(employee.calculated.arrivalTime) + ' IST' : 'null'}`);
        console.log(`      - workDurationSeconds: ${employee.calculated.workDurationSeconds}`);

        // Verify presence
        if (scenario.checkPresent) {
          if (employee.calculated.isPresent && !employee.calculated.isAbsent) {
            console.log('   ✅ Present/Absent check PASSED - Employee correctly marked as PRESENT');
            passedTests++;
          } else {
            console.log('   ❌ Present/Absent check FAILED - Employee should be marked as PRESENT');
            failedTests++;
            return;
          }
        }

        // Verify late status
        if (scenario.checkLate) {
          if (employee.calculated.isLate) {
            console.log('   ✅ Late check PASSED - Employee correctly marked as LATE');
            passedTests++;
          } else {
            console.log('   ❌ Late check FAILED - Employee should be marked as LATE');
            failedTests++;
            return;
          }
        }

        if (!scenario.checkPresent && !scenario.checkLate) {
          passedTests++;
        }
      } else {
        passedTests++;
      }
    } else {
      console.log(`   ❌ FAILED - Expected validation to fail but it passed`);
      failedTests++;
    }
  } catch (error) {
    if (!scenario.shouldPass) {
      if (error.message.includes(scenario.expectedError)) {
        console.log(`   ✅ Validation failed as expected: "${error.message}"`);
        passedTests++;
      } else {
        console.log(`   ❌ FAILED - Wrong error message`);
        console.log(`      Expected: "${scenario.expectedError}"`);
        console.log(`      Got: "${error.message}"`);
        failedTests++;
      }
    } else {
      console.log(`   ❌ FAILED - Unexpected error: ${error.message}`);
      failedTests++;
    }
  }
});

// Test Summary
console.log('\n' + '='.repeat(80));
console.log('TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests: ${testScenarios.length}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);

if (failedTests === 0) {
  console.log('\n🎉 ALL TESTS PASSED! 🎉');
  console.log('\n✅ Early punch-in validation is working correctly');
  console.log('✅ Employees punching in at exactly shift time are marked as PRESENT');
  console.log('✅ Late detection is working correctly');
} else {
  console.log('\n⚠️  SOME TESTS FAILED - Please review the errors above');
  process.exit(1);
}

console.log('\n' + '='.repeat(80));
