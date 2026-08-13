// tests/breakPolicy.test.js
//
// The break-duration absence policy: a day whose TOTAL break exceeds 1h40m or
// falls under 15m is marked absent, evaluated only once the day is over, with
// leave/holiday/half-day exempt and a sticky HR override. Runs standalone:
//
//     node server/tests/breakPolicy.test.js
'use strict';

const assert = require('assert');
const AttendanceService = require('../services/AttendanceService');

const service = new AttendanceService();

/* ── Harness ──────────────────────────────────────────────────────────── */

let passed = 0;
const failures = [];

function it(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

const MIN = 60;

/** A finished working day with the given break, on a past date. */
const employee = (breakMinutes, overrides = {}) => ({
  calculated: {
    arrivalTime: new Date('2026-08-10T09:00:00Z'),
    breakDurationSeconds: breakMinutes * MIN,
    currentStatus: 'FINISHED',
    ...(overrides.calculated || {}),
  },
  leaveInfo: overrides.leaveInfo || {},
  ...(overrides.rest || {}),
});

const YESTERDAY = new Date('2026-08-10T00:00:00Z');
const NOW = new Date('2026-08-11T12:00:00Z');

/* ── Thresholds ───────────────────────────────────────────────────────── */

console.log('\nthresholds');

it('a normal break is fine', () => {
  assert.strictEqual(service.evaluateBreakPolicy(employee(45), YESTERDAY, NOW).absent, false);
});

it('marks absent over 1h40m', () => {
  const result = service.evaluateBreakPolicy(employee(101), YESTERDAY, NOW);
  assert.strictEqual(result.absent, true);
  assert.match(result.reason, /exceeds/);
});

it('100 minutes exactly is still allowed', () => {
  // The limit is "more than 1h40m", so the boundary itself passes.
  assert.strictEqual(service.evaluateBreakPolicy(employee(100), YESTERDAY, NOW).absent, false);
});

it('marks absent under 15 minutes', () => {
  const result = service.evaluateBreakPolicy(employee(14), YESTERDAY, NOW);
  assert.strictEqual(result.absent, true);
  assert.match(result.reason, /minimum/);
});

it('15 minutes exactly is allowed', () => {
  assert.strictEqual(service.evaluateBreakPolicy(employee(15), YESTERDAY, NOW).absent, false);
});

it('no break at all is absent', () => {
  // A full day logged with zero break in practice means breaks were never
  // punched, which is the case this half of the rule exists to catch.
  assert.strictEqual(service.evaluateBreakPolicy(employee(0), YESTERDAY, NOW).absent, true);
});

/* ── Only once the day is over ────────────────────────────────────────── */

console.log('\nonly once the day is over');

it('does not fire mid-shift on today', () => {
  // The critical guard: someone who punched in twenty minutes ago has taken no
  // break yet. Applying the rule live would mark the whole company absent
  // every morning.
  const working = employee(0, { calculated: { currentStatus: 'WORKING' } });
  const today = new Date('2026-08-11T00:00:00Z');
  assert.strictEqual(service.evaluateBreakPolicy(working, today, NOW).absent, false);
});

it('fires on today once the employee is FINISHED', () => {
  // Punched out, or closed by AttendanceAutoCloseService.
  const finished = employee(0, { calculated: { currentStatus: 'FINISHED' } });
  const today = new Date('2026-08-11T00:00:00Z');
  assert.strictEqual(service.evaluateBreakPolicy(finished, today, NOW).absent, true);
});

it('fires for a past date even if never closed out', () => {
  const stale = employee(0, { calculated: { currentStatus: 'WORKING' } });
  assert.strictEqual(service.evaluateBreakPolicy(stale, YESTERDAY, NOW).absent, true);
});

it('isWorkingDayOver compares IST calendar days, not instants', () => {
  const today = new Date('2026-08-11T00:00:00Z');
  const onGoing = { calculated: { currentStatus: 'WORKING' } };
  assert.strictEqual(service.isWorkingDayOver(onGoing, today, NOW), false);
  assert.strictEqual(service.isWorkingDayOver(onGoing, YESTERDAY, NOW), true);
});

/* ── Exemptions ───────────────────────────────────────────────────────── */

console.log('\nexemptions');

it('never fires when the employee did not come in', () => {
  // Already absent for the ordinary reason; blaming their break would be a
  // misleading explanation in the portal.
  const noShow = employee(0, { calculated: { arrivalTime: null } });
  assert.strictEqual(service.evaluateBreakPolicy(noShow, YESTERDAY, NOW).absent, false);
});

it('exempts approved leave', () => {
  const onLeave = employee(0, { leaveInfo: { isOnLeave: true } });
  assert.strictEqual(service.evaluateBreakPolicy(onLeave, YESTERDAY, NOW).absent, false);
});

it('exempts holidays', () => {
  const holiday = employee(0, { leaveInfo: { isHoliday: true } });
  assert.strictEqual(service.evaluateBreakPolicy(holiday, YESTERDAY, NOW).absent, false);
});

it('exempts approved half-day leave', () => {
  const halfDay = employee(0, { leaveInfo: { isHalfDayLeave: true } });
  assert.strictEqual(service.evaluateBreakPolicy(halfDay, YESTERDAY, NOW).absent, false);
});

it('does NOT exempt work-from-home', () => {
  // WFH is an ordinary working day and was deliberately left in scope.
  const wfh = employee(0, { leaveInfo: { isWFH: true } });
  assert.strictEqual(service.evaluateBreakPolicy(wfh, YESTERDAY, NOW).absent, true);
});

/* ── Applied through recalculateEmployeeData ──────────────────────────── */

console.log('\napplied during recalculation');

/** A realistic finished day: 9am-6pm with one long break. */
const dayWithBreak = (breakMinutes, extra = {}) => ({
  userId: 'u1',
  events: [
    { type: 'PUNCH_IN', timestamp: new Date('2026-08-10T03:30:00Z') },
    { type: 'BREAK_START', timestamp: new Date('2026-08-10T07:00:00Z') },
    {
      type: 'BREAK_END',
      timestamp: new Date(new Date('2026-08-10T07:00:00Z').getTime() + breakMinutes * 60000),
    },
    { type: 'PUNCH_OUT', timestamp: new Date('2026-08-10T12:30:00Z') },
  ],
  assignedShift: { name: 'Day Shift', startTime: '09:00', endTime: '18:00', durationHours: 9 },
  leaveInfo: {},
  calculated: {},
  performance: {},
  metadata: {},
  ...extra,
});

it('turns a present day absent, and clears half/full day', () => {
  const emp = dayWithBreak(150); // 2h 30m
  service.recalculateEmployeeData(emp, YESTERDAY);

  assert.strictEqual(emp.calculated.isAbsent, true, 'should be absent');
  assert.strictEqual(emp.calculated.isPresent, false, 'should not be present');
  assert.strictEqual(emp.calculated.isBreakPolicyAbsent, true, 'policy flag');
  // A day that does not count must not simultaneously read as a full day, or
  // payroll and the dashboard counters reach different conclusions.
  assert.strictEqual(emp.calculated.isFullDay, false, 'full day cleared');
  assert.strictEqual(emp.calculated.isHalfDay, false, 'half day cleared');
  assert.ok(emp.calculated.breakPolicyReason, 'reason recorded');
});

it('leaves a compliant day alone', () => {
  const emp = dayWithBreak(45);
  service.recalculateEmployeeData(emp, YESTERDAY);

  assert.strictEqual(emp.calculated.isBreakPolicyAbsent, false);
  assert.strictEqual(emp.calculated.isAbsent, false);
  assert.strictEqual(emp.calculated.breakPolicyReason, null);
});

/* ── Sticky override ──────────────────────────────────────────────────── */

console.log('\nHR override survives recalculation');

it('an override keeps the day present', () => {
  const emp = dayWithBreak(150, {
    breakPolicyOverride: { isOverridden: true, reason: 'Client site visit' },
  });
  service.recalculateEmployeeData(emp, YESTERDAY);

  assert.strictEqual(emp.calculated.isAbsent, false, 'override should restore the day');
  assert.strictEqual(emp.calculated.isBreakPolicyAbsent, false);
});

it('the override survives repeated recalculation', () => {
  // The real failure mode: auto-close, payroll and every manual edit call
  // recalculateEmployeeData. If the override were not read there, HR's
  // correction would silently revert and payroll would be wrong.
  const emp = dayWithBreak(150, {
    breakPolicyOverride: { isOverridden: true, reason: 'Approved' },
  });
  for (let i = 0; i < 5; i += 1) service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(emp.calculated.isAbsent, false);
});

it('an override records what it suppressed', () => {
  const emp = dayWithBreak(150, {
    breakPolicyOverride: { isOverridden: true, reason: 'Approved' },
  });
  service.recalculateEmployeeData(emp, YESTERDAY);
  // Kept so the portal can still explain why anyone touched this day.
  assert.match(emp.breakPolicyOverride.originalReason, /exceeds/);
});

it('withdrawing the override re-applies the policy', () => {
  const emp = dayWithBreak(150, {
    breakPolicyOverride: { isOverridden: false, reason: null },
  });
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(emp.calculated.isAbsent, true);
});

it('an override on a now-compliant day clears its stored finding', () => {
  const emp = dayWithBreak(45, {
    breakPolicyOverride: { isOverridden: true, reason: 'Approved', originalReason: 'stale' },
  });
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(emp.breakPolicyOverride.originalReason, null);
});

/* ── Summary ──────────────────────────────────────────────────────────── */

console.log(`\n${passed}/${passed + failures.length} passed`);
if (failures.length) {
  failures.forEach((f) => console.error(`\n${f.name}\n${f.err.stack}`));
  process.exit(1);
}
