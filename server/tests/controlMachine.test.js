// tests/controlMachine.test.js
//
// Per-user break-timer speed factor: scaling, input hardening, the per-day
// snapshot that makes it forward-only, and its interaction with the
// break-duration absence rule. Runs standalone:
//
//     node server/tests/controlMachine.test.js
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

const YESTERDAY = new Date('2026-08-10T00:00:00Z');

/** A finished 9am-6pm day with one break of `breakMinutes`, at `factor`. */
const dayWith = (breakMinutes, factor) => ({
  userId: 'u1',
  controlMachineFactor: factor,
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
});

const minutes = (seconds) => Math.round(seconds / 60);

/* ── normalizeControlMachineFactor ────────────────────────────────────────── */

console.log('\nfactor hardening');

it('passes a sensible factor through', () => {
  assert.strictEqual(service.normalizeControlMachineFactor(0.75), 0.75);
  assert.strictEqual(service.normalizeControlMachineFactor(2), 2);
});

it('defaults to real time for accounts that predate the feature', () => {
  // The overwhelmingly common case: nobody has this field until it is set.
  assert.strictEqual(service.normalizeControlMachineFactor(undefined), 1);
  assert.strictEqual(service.normalizeControlMachineFactor(null), 1);
});

it('refuses values that would corrupt the calculation', () => {
  // Each of these is worse than wrong — as a multiplier on attendance they
  // propagate silently into the absence rule, the dashboard and payroll.
  assert.strictEqual(service.normalizeControlMachineFactor(NaN), 1, 'NaN');
  assert.strictEqual(service.normalizeControlMachineFactor('abc'), 1, 'non-numeric');
  assert.strictEqual(service.normalizeControlMachineFactor(0), 1, 'zero would erase all break');
  assert.strictEqual(service.normalizeControlMachineFactor(-2), 1, 'negative break');
});

it('clamps to the same bounds as the schema', () => {
  assert.strictEqual(service.normalizeControlMachineFactor(99), 10);
  assert.strictEqual(service.normalizeControlMachineFactor(0.01), 0.1);
});

/* ── Scaling ──────────────────────────────────────────────────────────── */

console.log('\nscaling');

it('0.75x records a 100-minute break as 75', () => {
  const emp = dayWith(100, 0.75);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSeconds), 75);
});

it('keeps the real elapsed break alongside the scaled one', () => {
  // Without this a scaled day is indistinguishable from a genuinely shorter
  // break, and there is no way to answer "how long was it really?".
  const emp = dayWith(100, 0.75);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSecondsBase), 100);
});

it('2x accrues twice as fast', () => {
  const emp = dayWith(30, 2);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSeconds), 60);
});

it('1x is a no-op, and raw equals scaled', () => {
  const emp = dayWith(45, 1);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSeconds), 45);
  assert.strictEqual(
    emp.calculated.breakDurationSeconds,
    emp.calculated.breakDurationSecondsBase
  );
});

it('an unset factor behaves exactly as before the feature', () => {
  const emp = dayWith(45, undefined);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSeconds), 45);
  assert.strictEqual(emp.calculated.controlMachineFactor, 1);
});

it('does NOT convert saved break into work time', () => {
  // The deliberate choice: at 0.75 the missing 25 minutes simply do not count
  // as break. Turning them into work would inflate paid hours, which is a far
  // larger claim than adjusting a break allowance.
  const real = dayWith(100, 1);
  const scaled = dayWith(100, 0.75);
  service.recalculateEmployeeData(real, YESTERDAY);
  service.recalculateEmployeeData(scaled, YESTERDAY);
  assert.strictEqual(
    scaled.calculated.workDurationSeconds,
    real.calculated.workDurationSeconds,
    'work time must be identical'
  );
});

it('records the factor it applied on the day', () => {
  const emp = dayWith(100, 0.75);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(emp.calculated.controlMachineFactor, 0.75);
});

/* ── Interaction with the absence rule ────────────────────────────────── */

console.log('\ninteraction with the break-absence rule');

it('a 133-minute break at 0.75x passes the 1h40m limit', () => {
  // 133 * 0.75 = ~100, inside the limit. This is the point of the feature,
  // stated as a test so the interaction is deliberate rather than discovered.
  const emp = dayWith(133, 0.75);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(emp.calculated.isBreakPolicyAbsent, false);
  assert.strictEqual(emp.calculated.isAbsent, false);
});

it('the same break at 1x is absent', () => {
  const emp = dayWith(133, 1);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(emp.calculated.isBreakPolicyAbsent, true);
});

it('a factor can push someone UNDER the 15-minute minimum', () => {
  // 20 real minutes at 0.5x scales to 10 — below the floor. Worth asserting:
  // a factor set to be generous at the top end also bites at the bottom.
  const emp = dayWith(20, 0.5);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(emp.calculated.isBreakPolicyAbsent, true);
  assert.match(emp.calculated.breakPolicyReason, /minimum/);
});

it('the policy reason quotes the SCALED figure', () => {
  // The number in the message must be the one the rule actually judged, or
  // the explanation contradicts the verdict.
  const emp = dayWith(200, 0.75); // -> 150m scaled
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.match(emp.calculated.breakPolicyReason, /2h 30m/);
});

/* ── Forward-only ─────────────────────────────────────────────────────── */

console.log('\nforward-only via the per-day snapshot');

it('the day uses its own snapshot, not a live user value', () => {
  // recalculateEmployeeData is called by auto-close, payroll, manual edits and
  // several repair scripts. Reading a live User value would mean changing
  // someone's factor rescales every finished day the next time any of those
  // runs — moving closed months and the payroll computed from them.
  const emp = dayWith(100, 0.75);
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSeconds), 75);

  // Simulate the user's factor changing afterwards; the day is untouched
  // because the snapshot on the record is what the calculation reads.
  service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSeconds), 75);
});

it('is stable across repeated recalculation', () => {
  // The scaling must not compound — a bug here would shrink the break a
  // little more every time anything touched the record.
  const emp = dayWith(100, 0.75);
  for (let i = 0; i < 5; i += 1) service.recalculateEmployeeData(emp, YESTERDAY);
  assert.strictEqual(minutes(emp.calculated.breakDurationSeconds), 75);
  assert.strictEqual(minutes(emp.calculated.breakDurationSecondsBase), 100);
});

/* ── Summary ──────────────────────────────────────────────────────────── */

console.log(`\n${passed}/${passed + failures.length} passed`);
if (failures.length) {
  failures.forEach((f) => console.error(`\n${f.name}\n${f.err.stack}`));
  process.exit(1);
}
