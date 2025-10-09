// Comprehensive Shift System Test Suite
// Tests ALL shift types, ALL scenarios, ALL edge cases

const AttendanceService = require('../services/AttendanceService');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function testHeader(title) {
  log('\n' + '='.repeat(70), 'bright');
  log(`  ${title}`, 'cyan');
  log('='.repeat(70), 'bright');
}

function testSection(title) {
  log(`\n${'─'.repeat(70)}`, 'blue');
  log(`  ${title}`, 'blue');
  log('─'.repeat(70), 'blue');
}

function assert(condition, message, details = '') {
  if (condition) {
    log(`  ✅ ${message}`, 'green');
    if (details) log(`     ${details}`, 'reset');
    return true;
  } else {
    log(`  ❌ ${message}`, 'red');
    if (details) log(`     ${details}`, 'yellow');
    return false;
  }
}

async function runAllTests() {
  const service = new AttendanceService();
  let totalTests = 0;
  let passedTests = 0;

  testHeader('COMPLETE SHIFT SYSTEM TEST SUITE');
  log('Testing all shifts, scenarios, and edge cases\n', 'cyan');

  // ============================================================================
  // TEST 1: SHIFT DETECTION
  // ============================================================================
  testSection('Test 1: Shift Type Detection');

  const shiftTests = [
    { shift: { startTime: '09:00', endTime: '18:00' }, expected: false, name: 'Day Shift' },
    { shift: { startTime: '13:00', endTime: '22:00' }, expected: false, name: 'Evening Shift' },
    { shift: { startTime: '20:00', endTime: '05:00' }, expected: true, name: 'Night Shift' },
    { shift: { startTime: '22:00', endTime: '07:00' }, expected: true, name: 'Late Night Shift' },
    { shift: { startTime: '05:30', endTime: '14:30' }, expected: false, name: 'Early Morning Shift' },
    { shift: { startTime: '16:00', endTime: '00:00' }, expected: true, name: 'Evening to Midnight' },
    { shift: { startTime: '00:00', endTime: '08:00' }, expected: true, name: 'Midnight to Morning' },
    { shift: null, expected: false, name: 'Null Shift' },
    { shift: {}, expected: false, name: 'Empty Shift' },
    { shift: { startTime: '09:00' }, expected: false, name: 'Missing End Time' },
  ];

  shiftTests.forEach(test => {
    totalTests++;
    const result = service.isNightShift(test.shift);
    if (assert(result === test.expected,
        `${test.name} detection`,
        `Expected: ${test.expected ? 'Night' : 'Day'}, Got: ${result ? 'Night' : 'Day'}`)) {
      passedTests++;
    }
  });

  // ============================================================================
  // TEST 2: DAY SHIFT (09:00-18:00 IST)
  // ============================================================================
  testSection('Test 2: Day Shift (09:00-18:00 IST)');

  const dayShift = { startTime: '09:00', endTime: '18:00' };
  const oct10 = new Date('2024-10-10T00:00:00Z');

  // Test 2.1: On-time arrival
  totalTests++;
  const dayOnTime = new Date('2024-10-10T03:30:00Z'); // 09:00 IST
  if (assert(
    service.getAttendanceDateForPunch(dayOnTime, dayShift).toISOString().split('T')[0] === '2024-10-10',
    'Day shift - on-time punch assigned to correct date',
    `Punch: 09:00 IST → Oct 10`
  )) passedTests++;

  // Test 2.2: Late arrival
  totalTests++;
  const dayLate = new Date('2024-10-10T04:00:00Z'); // 09:30 IST
  const isLate = service.calculateIsLate(dayLate, dayShift);
  if (assert(isLate === true, 'Day shift - late detection works', '09:30 IST arrival = LATE')) passedTests++;

  // Test 2.3: Early arrival
  totalTests++;
  const dayEarly = new Date('2024-10-10T03:00:00Z'); // 08:30 IST
  const isEarly = service.calculateIsLate(dayEarly, dayShift);
  if (assert(isEarly === false, 'Day shift - early arrival not marked late', '08:30 IST arrival = ON TIME')) passedTests++;

  // Test 2.4: Duration calculation
  totalTests++;
  const dayEmployee = {
    assignedShift: dayShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T03:30:00Z') }, // 09:00 IST
      { type: 'BREAK_START', timestamp: new Date('2024-10-10T07:30:00Z') }, // 13:00 IST
      { type: 'BREAK_END', timestamp: new Date('2024-10-10T08:00:00Z') }, // 13:30 IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T12:30:00Z') }, // 18:00 IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(dayEmployee, oct10);
  const dayWorkHours = dayEmployee.calculated.workDurationSeconds / 3600;
  const dayBreakHours = dayEmployee.calculated.breakDurationSeconds / 3600;

  if (assert(
    Math.abs(dayWorkHours - 8.5) < 0.1 && Math.abs(dayBreakHours - 0.5) < 0.1,
    'Day shift - duration calculation correct',
    `Work: ${dayWorkHours.toFixed(2)}h (expected 8.5h), Break: ${dayBreakHours.toFixed(2)}h (expected 0.5h)`
  )) passedTests++;

  // ============================================================================
  // TEST 3: EVENING SHIFT (13:00-22:00 IST)
  // ============================================================================
  testSection('Test 3: Evening Shift (13:00-22:00 IST)');

  const eveningShift = { startTime: '13:00', endTime: '22:00' };

  // Test 3.1: On-time arrival
  totalTests++;
  const eveningOnTime = new Date('2024-10-10T07:30:00Z'); // 13:00 IST
  if (assert(
    service.getAttendanceDateForPunch(eveningOnTime, eveningShift).toISOString().split('T')[0] === '2024-10-10',
    'Evening shift - on-time punch assigned correctly',
    'Punch: 13:00 IST → Oct 10'
  )) passedTests++;

  // Test 3.2: Late arrival
  totalTests++;
  const eveningLate = service.calculateIsLate(new Date('2024-10-10T08:00:00Z'), eveningShift); // 13:30 IST
  if (assert(eveningLate === true, 'Evening shift - late detection works', '13:30 IST = LATE')) passedTests++;

  // Test 3.3: Does NOT cross midnight
  totalTests++;
  const eveningNight = new Date('2024-10-10T16:30:00Z'); // 22:00 IST
  if (assert(
    service.getAttendanceDateForPunch(eveningNight, eveningShift).toISOString().split('T')[0] === '2024-10-10',
    'Evening shift - end of shift stays same day',
    '22:00 IST → Still Oct 10'
  )) passedTests++;

  // Test 3.4: Duration calculation
  totalTests++;
  const eveningEmployee = {
    assignedShift: eveningShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T07:30:00Z') }, // 13:00 IST
      { type: 'BREAK_START', timestamp: new Date('2024-10-10T11:00:00Z') }, // 16:30 IST
      { type: 'BREAK_END', timestamp: new Date('2024-10-10T12:00:00Z') }, // 17:30 IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T16:30:00Z') }, // 22:00 IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(eveningEmployee, oct10);
  const evWorkHours = eveningEmployee.calculated.workDurationSeconds / 3600;

  if (assert(
    Math.abs(evWorkHours - 8) < 0.1,
    'Evening shift - full shift duration correct',
    `Work: ${evWorkHours.toFixed(2)}h (expected 8h)`
  )) passedTests++;

  // ============================================================================
  // TEST 4: NIGHT SHIFT (20:00-05:00 IST) - Critical Test!
  // ============================================================================
  testSection('Test 4: Night Shift (20:00-05:00 IST) - CRITICAL');

  const nightShift = { startTime: '20:00', endTime: '05:00' };

  // Test 4.1: Punch in at shift start
  totalTests++;
  const nightStart = new Date('2024-10-10T14:30:00Z'); // Oct 10, 20:00 IST
  if (assert(
    service.getAttendanceDateForPunch(nightStart, nightShift).toISOString().split('T')[0] === '2024-10-10',
    'Night shift - punch in at start → correct date',
    'Oct 10 20:00 IST → Assigned to Oct 10'
  )) passedTests++;

  // Test 4.2: Punch after midnight (before shift end)
  totalTests++;
  const nightAfterMidnight = new Date('2024-10-10T20:30:00Z'); // Oct 11, 02:00 IST
  if (assert(
    service.getAttendanceDateForPunch(nightAfterMidnight, nightShift).toISOString().split('T')[0] === '2024-10-10',
    'Night shift - punch after midnight → PREVIOUS day',
    'Oct 11 02:00 IST → Assigned to Oct 10 (shift start date)'
  )) passedTests++;

  // Test 4.3: Punch out at shift end
  totalTests++;
  const nightEnd = new Date('2024-10-10T23:30:00Z'); // Oct 11, 05:00 IST
  if (assert(
    service.getAttendanceDateForPunch(nightEnd, nightShift).toISOString().split('T')[0] === '2024-10-10',
    'Night shift - punch out at end → same attendance date',
    'Oct 11 05:00 IST → Still Oct 10'
  )) passedTests++;

  // Test 4.4: Late detection for night shift
  totalTests++;
  const nightLateArrival = new Date('2024-10-10T15:00:00Z'); // Oct 10, 20:30 IST
  const nightIsLate = service.calculateIsLate(nightLateArrival, nightShift);
  if (assert(nightIsLate === true, 'Night shift - late detection works', '20:30 IST arrival = LATE')) passedTests++;

  // Test 4.5: On-time detection
  totalTests++;
  const nightOnTimeArrival = new Date('2024-10-10T14:30:00Z'); // Oct 10, 20:00 IST exactly
  const nightOnTime = service.calculateIsLate(nightOnTimeArrival, nightShift);
  if (assert(nightOnTime === false, 'Night shift - on-time detection works', '20:00 IST exact = ON TIME')) passedTests++;

  // Test 4.6: Duration calculation ACROSS MIDNIGHT - THE CRITICAL FIX!
  testSection('Test 4.6: Night Shift Duration Across Midnight (THE FIX!)');

  const nightEmployee = {
    assignedShift: nightShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T14:30:00Z') }, // Oct 10, 20:00 IST
      { type: 'BREAK_START', timestamp: new Date('2024-10-10T18:00:00Z') }, // Oct 10, 23:30 IST
      { type: 'BREAK_END', timestamp: new Date('2024-10-10T19:00:00Z') }, // Oct 11, 00:30 IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T23:30:00Z') }, // Oct 11, 05:00 IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(nightEmployee, oct10);
  const nightWorkHours = nightEmployee.calculated.workDurationSeconds / 3600;
  const nightBreakHours = nightEmployee.calculated.breakDurationSeconds / 3600;

  totalTests++;
  if (assert(
    Math.abs(nightWorkHours - 8) < 0.1,
    'Night shift - work duration correct across midnight',
    `Work: ${nightWorkHours.toFixed(2)}h (expected 8h)`
  )) passedTests++;

  totalTests++;
  if (assert(
    Math.abs(nightBreakHours - 1) < 0.1,
    'Night shift - break duration correct across midnight',
    `Break: ${nightBreakHours.toFixed(2)}h (expected 1h)`
  )) passedTests++;

  // Test 4.7: Night shift - live duration calculation
  testSection('Test 4.7: Night Shift - Live Duration (Ongoing Shift)');

  const OriginalDate = global.Date;

  const liveNightEmployee = {
    assignedShift: nightShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T14:30:00Z') }, // Oct 10, 20:00 IST
      { type: 'BREAK_START', timestamp: new Date('2024-10-10T18:00:00Z') }, // Oct 10, 23:30 IST
      { type: 'BREAK_END', timestamp: new Date('2024-10-10T19:00:00Z') }, // Oct 11, 00:30 IST
      // Still working... no punch out yet
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  // Mock time: Oct 11, 02:00 IST
  global.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super('2024-10-10T20:30:00Z'); // Oct 11, 02:00 IST
      } else {
        super(...args);
      }
    }
  };

  service.recalculateEmployeeData(liveNightEmployee, oct10);
  const liveWorkHours = liveNightEmployee.calculated.workDurationSeconds / 3600;

  global.Date = OriginalDate;

  totalTests++;
  if (assert(
    Math.abs(liveWorkHours - 5) < 0.2,
    'Night shift - live duration at 02:00 IST correct',
    `Work: ${liveWorkHours.toFixed(2)}h (expected ~5h: 20:00-23:30 + 00:30-02:00)`
  )) passedTests++;

  // ============================================================================
  // TEST 5: EARLY MORNING SHIFT (05:30-14:30 IST)
  // ============================================================================
  testSection('Test 5: Early Morning Shift (05:30-14:30 IST)');

  const earlyShift = { startTime: '05:30', endTime: '14:30' };

  totalTests++;
  const earlyOnTime = new Date('2024-10-10T00:00:00Z'); // Oct 10, 05:30 IST
  if (assert(
    !service.isNightShift(earlyShift),
    'Early morning shift - NOT detected as night shift',
    '05:30-14:30 is a day shift'
  )) passedTests++;

  totalTests++;
  const earlyEmployee = {
    assignedShift: earlyShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T00:00:00Z') }, // 05:30 IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T09:00:00Z') }, // 14:30 IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(earlyEmployee, oct10);
  const earlyWorkHours = earlyEmployee.calculated.workDurationSeconds / 3600;

  if (assert(
    Math.abs(earlyWorkHours - 9) < 0.1,
    'Early morning shift - duration correct',
    `Work: ${earlyWorkHours.toFixed(2)}h (expected 9h)`
  )) passedTests++;

  // ============================================================================
  // TEST 6: EDGE CASES
  // ============================================================================
  testSection('Test 6: Edge Cases and Boundary Conditions');

  // Test 6.1: Shift ending exactly at midnight
  totalTests++;
  const midnightShift = { startTime: '16:00', endTime: '00:00' };
  if (assert(
    service.isNightShift(midnightShift),
    'Shift ending at midnight - detected as night shift',
    '16:00-00:00 crosses midnight'
  )) passedTests++;

  // Test 6.2: Shift starting at midnight
  totalTests++;
  const fromMidnightShift = { startTime: '00:00', endTime: '08:00' };
  if (assert(
    service.isNightShift(fromMidnightShift),
    'Shift starting at midnight - detected as night shift',
    '00:00-08:00 crosses midnight boundary'
  )) passedTests++;

  // Test 6.3: Very long shift
  totalTests++;
  const longEmployee = {
    assignedShift: dayShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T03:30:00Z') },
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T18:30:00Z') }, // 15 hours later
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(longEmployee, oct10);
  const longHours = longEmployee.calculated.workDurationSeconds / 3600;

  if (assert(
    Math.abs(longHours - 15) < 0.1,
    'Very long shift - duration calculated correctly',
    `${longHours.toFixed(2)}h (15 hour shift)`
  )) passedTests++;

  // Test 6.4: Multiple breaks
  totalTests++;
  const multiBreakEmployee = {
    assignedShift: dayShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T03:30:00Z') },
      { type: 'BREAK_START', timestamp: new Date('2024-10-10T05:30:00Z') },
      { type: 'BREAK_END', timestamp: new Date('2024-10-10T06:00:00Z') },
      { type: 'BREAK_START', timestamp: new Date('2024-10-10T08:00:00Z') },
      { type: 'BREAK_END', timestamp: new Date('2024-10-10T08:30:00Z') },
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T12:30:00Z') },
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(multiBreakEmployee, oct10);
  const multiBreakHours = multiBreakEmployee.calculated.breakDurationSeconds / 3600;

  if (assert(
    Math.abs(multiBreakHours - 1) < 0.1,
    'Multiple breaks - total calculated correctly',
    `${multiBreakHours.toFixed(2)}h total break (0.5h + 0.5h)`
  )) passedTests++;

  // Test 6.5: Punch in late, work overtime
  totalTests++;
  const overtimeEmployee = {
    assignedShift: dayShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T04:00:00Z') }, // 09:30 IST (late)
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T14:00:00Z') }, // 19:30 IST (overtime)
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(overtimeEmployee, oct10);
  const isOvertimeLate = service.calculateIsLate(new Date('2024-10-10T04:00:00Z'), dayShift);
  const overtimeHours = overtimeEmployee.calculated.workDurationSeconds / 3600;

  if (assert(
    isOvertimeLate && Math.abs(overtimeHours - 10) < 0.1,
    'Late arrival + overtime - both detected correctly',
    `Late: ${isOvertimeLate}, Hours: ${overtimeHours.toFixed(2)}h`
  )) passedTests++;

  // ============================================================================
  // TEST 7: IST TIMEZONE CONSISTENCY
  // ============================================================================
  testSection('Test 7: IST Timezone Handling');

  // Test 7.1: IST component extraction
  totalTests++;
  const istTestTime = new Date('2024-10-10T14:30:00Z'); // Should be 20:00 IST
  const istComponents = service.getISTTimeComponents(istTestTime);

  if (assert(
    istComponents.hour === 20 && istComponents.minute === 0,
    'IST time components extracted correctly',
    `UTC 14:30 → IST ${istComponents.hour}:${istComponents.minute} (expected 20:00)`
  )) passedTests++;

  // Test 7.2: IST date components
  totalTests++;
  const istDateComponents = service.getISTDateComponents(new Date('2024-10-10T18:31:00Z')); // Just after midnight IST
  if (assert(
    istDateComponents.day === 11 && istDateComponents.month === 10,
    'IST date components correct across midnight',
    `UTC Oct 10 18:31 → IST Oct ${istDateComponents.day} (expected 11)`
  )) passedTests++;

  // ============================================================================
  // TEST 8: BREAK TRACKING ACROSS MIDNIGHT
  // ============================================================================
  testSection('Test 8: Break Tracking Across Midnight');

  totalTests++;
  const breakMidnightEmployee = {
    assignedShift: nightShift,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-10-10T14:30:00Z') }, // Oct 10, 20:00 IST
      { type: 'BREAK_START', timestamp: new Date('2024-10-10T17:45:00Z') }, // Oct 10, 23:15 IST
      { type: 'BREAK_END', timestamp: new Date('2024-10-10T19:15:00Z') }, // Oct 11, 00:45 IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-10-10T23:30:00Z') }, // Oct 11, 05:00 IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(breakMidnightEmployee, oct10);
  const breakMidnightHours = breakMidnightEmployee.calculated.breakDurationSeconds / 3600;

  if (assert(
    Math.abs(breakMidnightHours - 1.5) < 0.1,
    'Break across midnight - duration correct',
    `Break: ${breakMidnightHours.toFixed(2)}h (23:15-00:45 = 1.5h)`
  )) passedTests++;

  // ============================================================================
  // TEST 9: SHOULDINCLUDEINDATECALCULATION LOGIC
  // ============================================================================
  testSection('Test 9: shouldIncludeInDateCalculation Logic');

  // For day shift
  totalTests++;
  const daySameDate = service.shouldIncludeInDateCalculation(
    new Date('2024-10-10T10:00:00Z'),
    oct10,
    dayShift
  );
  if (assert(daySameDate === true, 'Day shift - same date included', 'Oct 10 timestamp → Oct 10 attendance')) passedTests++;

  totalTests++;
  const dayDiffDate = service.shouldIncludeInDateCalculation(
    new Date('2024-10-11T10:00:00Z'),
    oct10,
    dayShift
  );
  if (assert(dayDiffDate === false, 'Day shift - different date excluded', 'Oct 11 timestamp → Oct 10 attendance = false')) passedTests++;

  // For night shift
  totalTests++;
  const nightAfterMidnightIncluded = service.shouldIncludeInDateCalculation(
    new Date('2024-10-10T20:00:00Z'), // Oct 11, 01:30 IST
    oct10,
    nightShift
  );
  if (assert(nightAfterMidnightIncluded === true, 'Night shift - after midnight included', 'Oct 11 01:30 IST → Oct 10 night shift = true')) passedTests++;

  totalTests++;
  const nightAfterShiftEnd = service.shouldIncludeInDateCalculation(
    new Date('2024-10-11T01:00:00Z'), // Oct 11, 06:30 IST (after shift end)
    oct10,
    nightShift
  );
  if (assert(nightAfterShiftEnd === false, 'Night shift - after shift end excluded', 'Oct 11 06:30 IST → Oct 10 night shift = false')) passedTests++;

  // ============================================================================
  // FINAL RESULTS
  // ============================================================================
  testHeader('TEST RESULTS');

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  const failed = totalTests - passedTests;

  log(`\nTotal Tests: ${totalTests}`, 'bright');
  log(`Passed: ${passedTests}`, 'green');
  if (failed > 0) {
    log(`Failed: ${failed}`, 'red');
  }
  log(`Pass Rate: ${passRate}%`, passRate === '100.0' ? 'green' : 'yellow');

  if (passRate === '100.0') {
    log('\n🎉 ALL TESTS PASSED! Shift system is working perfectly!', 'green');
  } else {
    log(`\n⚠️  ${failed} test(s) failed. Please review the output above.`, 'yellow');
  }

  log('\n' + '='.repeat(70) + '\n', 'bright');

  return { totalTests, passedTests, passRate };
}

// Run all tests
runAllTests().then(results => {
  process.exit(results.passedTests === results.totalTests ? 0 : 1);
}).catch(error => {
  console.error('Test suite failed with error:', error);
  process.exit(1);
});
