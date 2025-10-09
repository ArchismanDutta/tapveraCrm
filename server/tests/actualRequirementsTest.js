// Test Suite for Actual Shift Requirements
// Testing: Early Morning (5:30 AM - 2:30 PM), Day (9 AM - 6 PM), Night (8 PM - 5 AM)

const AttendanceService = require('../services/AttendanceService');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function testActualRequirements() {
  const service = new AttendanceService();

  log('\n' + '='.repeat(80), 'bright');
  log('  TESTING ACTUAL SHIFT REQUIREMENTS', 'cyan');
  log('='.repeat(80), 'bright');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    issues: []
  };

  // Define actual shifts
  const shifts = {
    earlyMorning: {
      name: 'Early Morning Shift',
      startTime: '05:30',
      endTime: '14:30',
      description: '5:30 AM - 2:30 PM'
    },
    day: {
      name: 'Day Shift',
      startTime: '09:00',
      endTime: '18:00',
      description: '9:00 AM - 6:00 PM'
    },
    night: {
      name: 'Night Shift',
      startTime: '20:00',
      endTime: '05:00',
      description: '8:00 PM - 5:00 AM'
    }
  };

  log('\n📋 DEFINED SHIFTS:', 'blue');
  Object.values(shifts).forEach(shift => {
    const isNight = service.isNightShift(shift);
    log(`   ${shift.name} (${shift.description}): ${isNight ? '🌙 NIGHT' : '☀️  DAY'}`, 'cyan');
  });

  // ============================================================================
  // TEST 1: Early Morning Shift (5:30 AM - 2:30 PM)
  // ============================================================================
  log('\n' + '─'.repeat(80), 'blue');
  log('TEST 1: Early Morning Shift (5:30 AM - 2:30 PM)', 'blue');
  log('─'.repeat(80), 'blue');

  results.total++;
  const earlyIsNight = service.isNightShift(shifts.earlyMorning);
  if (!earlyIsNight) {
    log('✅ Early morning shift NOT detected as night shift (CORRECT)', 'green');
    results.passed++;
  } else {
    log('❌ Early morning shift detected as night shift (WRONG)', 'red');
    results.failed++;
    results.issues.push('Early morning shift (5:30-14:30) incorrectly detected as night shift');
  }

  // Test scenario: Employee works early morning shift on Sept 10
  const earlyEmployee = {
    assignedShift: shifts.earlyMorning,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-09-10T00:00:00Z') }, // Sept 10, 5:30 AM IST
      { type: 'BREAK_START', timestamp: new Date('2024-09-10T04:30:00Z') }, // 10:00 AM IST
      { type: 'BREAK_END', timestamp: new Date('2024-09-10T05:00:00Z') }, // 10:30 AM IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-09-10T09:00:00Z') }, // Sept 10, 2:30 PM IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  const sept10 = new Date('2024-09-10T00:00:00Z');
  service.recalculateEmployeeData(earlyEmployee, sept10);

  const earlyWorkHours = (earlyEmployee.calculated.workDurationSeconds / 3600).toFixed(2);
  const earlyBreakHours = (earlyEmployee.calculated.breakDurationSeconds / 3600).toFixed(2);

  results.total++;
  if (Math.abs(earlyWorkHours - 8.5) < 0.1 && Math.abs(earlyBreakHours - 0.5) < 0.1) {
    log(`✅ Early morning shift duration: ${earlyWorkHours}h work, ${earlyBreakHours}h break (CORRECT)`, 'green');
    results.passed++;
  } else {
    log(`❌ Early morning shift duration: ${earlyWorkHours}h work, ${earlyBreakHours}h break (EXPECTED: 8.5h work, 0.5h break)`, 'red');
    results.failed++;
    results.issues.push(`Early morning shift duration incorrect: got ${earlyWorkHours}h, expected 8.5h`);
  }

  // ============================================================================
  // TEST 2: Day Shift (9:00 AM - 6:00 PM)
  // ============================================================================
  log('\n' + '─'.repeat(80), 'blue');
  log('TEST 2: Day Shift (9:00 AM - 6:00 PM)', 'blue');
  log('─'.repeat(80), 'blue');

  results.total++;
  const dayIsNight = service.isNightShift(shifts.day);
  if (!dayIsNight) {
    log('✅ Day shift NOT detected as night shift (CORRECT)', 'green');
    results.passed++;
  } else {
    log('❌ Day shift detected as night shift (WRONG)', 'red');
    results.failed++;
    results.issues.push('Day shift (9:00-18:00) incorrectly detected as night shift');
  }

  // Test scenario: Employee works day shift on Sept 10
  const dayEmployee = {
    assignedShift: shifts.day,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-09-10T03:30:00Z') }, // Sept 10, 9:00 AM IST
      { type: 'BREAK_START', timestamp: new Date('2024-09-10T07:00:00Z') }, // 12:30 PM IST
      { type: 'BREAK_END', timestamp: new Date('2024-09-10T07:30:00Z') }, // 1:00 PM IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-09-10T12:30:00Z') }, // Sept 10, 6:00 PM IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(dayEmployee, sept10);

  const dayWorkHours = (dayEmployee.calculated.workDurationSeconds / 3600).toFixed(2);
  const dayBreakHours = (dayEmployee.calculated.breakDurationSeconds / 3600).toFixed(2);

  results.total++;
  if (Math.abs(dayWorkHours - 8.5) < 0.1 && Math.abs(dayBreakHours - 0.5) < 0.1) {
    log(`✅ Day shift duration: ${dayWorkHours}h work, ${dayBreakHours}h break (CORRECT)`, 'green');
    results.passed++;
  } else {
    log(`❌ Day shift duration: ${dayWorkHours}h work, ${dayBreakHours}h break (EXPECTED: 8.5h work, 0.5h break)`, 'red');
    results.failed++;
    results.issues.push(`Day shift duration incorrect: got ${dayWorkHours}h, expected 8.5h`);
  }

  // ============================================================================
  // TEST 3: Night Shift (8:00 PM - 5:00 AM) - YOUR EXACT SCENARIO
  // ============================================================================
  log('\n' + '─'.repeat(80), 'blue');
  log('TEST 3: Night Shift (8:00 PM - 5:00 AM) - CRITICAL TEST', 'blue');
  log('─'.repeat(80), 'blue');

  results.total++;
  const nightIsNight = service.isNightShift(shifts.night);
  if (nightIsNight) {
    log('✅ Night shift detected as night shift (CORRECT)', 'green');
    results.passed++;
  } else {
    log('❌ Night shift NOT detected as night shift (WRONG)', 'red');
    results.failed++;
    results.issues.push('Night shift (20:00-05:00) NOT detected as night shift');
  }

  // YOUR EXACT REQUIREMENT:
  log('\n📝 YOUR REQUIREMENT:', 'yellow');
  log('   "Night shift on Sept 10: Punch in Sept 10, Punch out Sept 11"', 'yellow');
  log('   "Attendance counts for Sept 10"', 'yellow');
  log('   "Duration and breaks counted for complete 8 PM - 5 AM shift"', 'yellow');

  // Test: Punch in on Sept 10
  const punchInSept10 = new Date('2024-09-10T14:30:00Z'); // Sept 10, 8:00 PM IST
  const punchInDate = service.getAttendanceDateForPunch(punchInSept10, shifts.night);

  results.total++;
  if (punchInDate.toISOString().split('T')[0] === '2024-09-10') {
    log(`✅ Punch in on Sept 10 8:00 PM → Assigned to Sept 10 (CORRECT)`, 'green');
    log(`   Date: ${punchInDate.toISOString().split('T')[0]}`, 'green');
    results.passed++;
  } else {
    log(`❌ Punch in on Sept 10 8:00 PM → Assigned to ${punchInDate.toISOString().split('T')[0]} (WRONG)`, 'red');
    results.failed++;
    results.issues.push(`Night shift punch in assigned to wrong date: ${punchInDate.toISOString().split('T')[0]}`);
  }

  // Test: Punch out on Sept 11
  const punchOutSept11 = new Date('2024-09-10T23:30:00Z'); // Sept 11, 5:00 AM IST
  const punchOutDate = service.getAttendanceDateForPunch(punchOutSept11, shifts.night);

  results.total++;
  if (punchOutDate.toISOString().split('T')[0] === '2024-09-10') {
    log(`✅ Punch out on Sept 11 5:00 AM → Assigned to Sept 10 (CORRECT)`, 'green');
    log(`   Date: ${punchOutDate.toISOString().split('T')[0]}`, 'green');
    results.passed++;
  } else {
    log(`❌ Punch out on Sept 11 5:00 AM → Assigned to ${punchOutDate.toISOString().split('T')[0]} (WRONG)`, 'red');
    results.failed++;
    results.issues.push(`Night shift punch out assigned to wrong date: ${punchOutDate.toISOString().split('T')[0]}`);
  }

  // Test: Full shift duration calculation
  log('\n📊 FULL SHIFT DURATION TEST:', 'cyan');

  const nightEmployee = {
    assignedShift: shifts.night,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-09-10T14:30:00Z') }, // Sept 10, 8:00 PM IST
      { type: 'BREAK_START', timestamp: new Date('2024-09-10T18:00:00Z') }, // Sept 10, 11:30 PM IST
      { type: 'BREAK_END', timestamp: new Date('2024-09-10T19:00:00Z') }, // Sept 11, 12:30 AM IST
      { type: 'PUNCH_OUT', timestamp: new Date('2024-09-10T23:30:00Z') }, // Sept 11, 5:00 AM IST
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  service.recalculateEmployeeData(nightEmployee, sept10);

  const nightWorkHours = (nightEmployee.calculated.workDurationSeconds / 3600).toFixed(2);
  const nightBreakHours = (nightEmployee.calculated.breakDurationSeconds / 3600).toFixed(2);
  const totalHours = (parseFloat(nightWorkHours) + parseFloat(nightBreakHours)).toFixed(2);

  log(`   Work Duration: ${nightWorkHours} hours`, 'cyan');
  log(`   Break Duration: ${nightBreakHours} hours`, 'cyan');
  log(`   Total Duration: ${totalHours} hours`, 'cyan');

  results.total++;
  if (Math.abs(nightWorkHours - 8) < 0.2 && Math.abs(nightBreakHours - 1) < 0.2) {
    log(`✅ Night shift complete duration: ${nightWorkHours}h work, ${nightBreakHours}h break (CORRECT)`, 'green');
    log(`   ✅ Duration counted for complete 8 PM - 5 AM shift across midnight`, 'green');
    results.passed++;
  } else {
    log(`❌ Night shift complete duration: ${nightWorkHours}h work, ${nightBreakHours}h break`, 'red');
    log(`   ❌ EXPECTED: ~8h work, ~1h break for 8 PM - 5 AM shift`, 'red');
    results.failed++;
    results.issues.push(`Night shift duration incorrect: got ${nightWorkHours}h work, expected ~8h`);
  }

  // Test: Break across midnight
  results.total++;
  const breakSpansMidnight = nightEmployee.events[1].timestamp < new Date('2024-09-10T18:30:00Z') &&
                             nightEmployee.events[2].timestamp > new Date('2024-09-10T18:30:00Z');

  if (breakSpansMidnight && Math.abs(nightBreakHours - 1) < 0.2) {
    log(`✅ Break across midnight tracked correctly: ${nightBreakHours}h (CORRECT)`, 'green');
    results.passed++;
  } else {
    log(`❌ Break across midnight: ${nightBreakHours}h (EXPECTED: 1h)`, 'red');
    results.failed++;
    results.issues.push('Break spanning midnight not calculated correctly');
  }

  // ============================================================================
  // TEST 4: Live Duration Calculation (Ongoing Night Shift)
  // ============================================================================
  log('\n' + '─'.repeat(80), 'blue');
  log('TEST 4: Live Duration (Ongoing Night Shift)', 'blue');
  log('─'.repeat(80), 'blue');

  const OriginalDate = global.Date;

  const liveNightEmployee = {
    assignedShift: shifts.night,
    events: [
      { type: 'PUNCH_IN', timestamp: new Date('2024-09-10T14:30:00Z') }, // Sept 10, 8:00 PM IST
      { type: 'BREAK_START', timestamp: new Date('2024-09-10T18:00:00Z') }, // Sept 10, 11:30 PM IST
      { type: 'BREAK_END', timestamp: new Date('2024-09-10T19:00:00Z') }, // Sept 11, 12:30 AM IST
      // Still working... no punch out yet
    ],
    calculated: {},
    performance: {},
    metadata: {}
  };

  // Simulate current time: Sept 11, 2:00 AM IST
  global.Date = class extends OriginalDate {
    constructor(...args) {
      if (args.length === 0) {
        super('2024-09-10T20:30:00Z'); // Sept 11, 2:00 AM IST
      } else {
        super(...args);
      }
    }
  };

  service.recalculateEmployeeData(liveNightEmployee, sept10);

  const liveWorkHours = (liveNightEmployee.calculated.workDurationSeconds / 3600).toFixed(2);
  const liveBreakHours = (liveNightEmployee.calculated.breakDurationSeconds / 3600).toFixed(2);

  global.Date = OriginalDate;

  log(`   Current Time: Sept 11, 2:00 AM IST (after midnight)`, 'cyan');
  log(`   Work Duration: ${liveWorkHours} hours`, 'cyan');
  log(`   Break Duration: ${liveBreakHours} hours`, 'cyan');

  results.total++;
  // Expected: 8:00 PM - 11:30 PM (3.5h) + 12:30 AM - 2:00 AM (1.5h) = 5h work, 1h break
  if (Math.abs(liveWorkHours - 5) < 0.3) {
    log(`✅ Live duration after midnight: ${liveWorkHours}h (CORRECT, expected ~5h)`, 'green');
    log(`   ✅ Duration continues calculating after midnight!`, 'green');
    results.passed++;
  } else {
    log(`❌ Live duration after midnight: ${liveWorkHours}h (EXPECTED: ~5h)`, 'red');
    log(`   ❌ Duration may have stopped at midnight!`, 'red');
    results.failed++;
    results.issues.push(`Live duration stopped calculating after midnight: got ${liveWorkHours}h, expected ~5h`);
  }

  // ============================================================================
  // FINAL RESULTS
  // ============================================================================
  log('\n' + '='.repeat(80), 'bright');
  log('  TEST RESULTS SUMMARY', 'cyan');
  log('='.repeat(80), 'bright');

  const passRate = ((results.passed / results.total) * 100).toFixed(1);

  log(`\nTotal Tests: ${results.total}`, 'bright');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Pass Rate: ${passRate}%`, passRate === '100.0' ? 'green' : 'yellow');

  if (results.failed > 0) {
    log('\n⚠️  ISSUES FOUND:', 'yellow');
    results.issues.forEach((issue, i) => {
      log(`   ${i + 1}. ${issue}`, 'red');
    });
  }

  // ============================================================================
  // VERDICT
  // ============================================================================
  log('\n' + '='.repeat(80), 'bright');
  log('  FINAL VERDICT', 'cyan');
  log('='.repeat(80), 'bright');

  if (passRate >= 90) {
    log('\n✅ SYSTEM READY FOR YOUR REQUIREMENTS', 'green');
    log('\nYour system correctly handles:', 'green');
    log('  ✅ Early morning shift (5:30 AM - 2:30 PM)', 'green');
    log('  ✅ Day shift (9:00 AM - 6:00 PM)', 'green');
    log('  ✅ Night shift (8:00 PM - 5:00 AM)', 'green');
    log('  ✅ Duration calculation across midnight', 'green');
    log('  ✅ Break tracking across midnight', 'green');
    log('  ✅ Correct attendance date assignment', 'green');
  } else {
    log('\n⚠️  SYSTEM NEEDS ADJUSTMENTS', 'yellow');
    log('\nReview the issues above to meet your requirements.', 'yellow');
  }

  log('\n' + '='.repeat(80) + '\n', 'bright');

  return results;
}

// Run the test
testActualRequirements().then(results => {
  process.exit(results.passed === results.total ? 0 : 1);
}).catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
