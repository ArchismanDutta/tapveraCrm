// tests/callback-alarm.test.js
//
// Callback alarm classification: when does a callback ring, warn, stay quiet,
// or get skipped entirely. Runs standalone:
//
//     node server/tests/callback-alarm.test.js
//
// No database — the model is stubbed via require.cache before load, same
// technique as messaging-service.test.js.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

stub('models/Callback.js', {
  find: () => {
    const p = Promise.resolve([]);
    p.select = () => p;
    p.lean = () => p;
    return p;
  },
  findOneAndUpdate: () => {
    const p = Promise.resolve(null);
    p.lean = () => p;
    return p;
  },
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
});

const alarms = require('../services/callbackAlarmService');

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

/** A callback due at `time` on the day of `now`, plus any overrides. */
const at = (time, overrides = {}) => ({
  status: 'Pending',
  callbackDate: new Date('2026-08-11T00:00:00'),
  callbackTime: time,
  ...overrides,
});

const NOW = new Date('2026-08-11T14:00:00');

/* ── dueAtFor ─────────────────────────────────────────────────────────── */

console.log('\ndueAtFor');

it('combines the date with the HH:MM time', () => {
  const due = alarms.dueAtFor(at('14:30'));
  assert.strictEqual(due.getHours(), 14);
  assert.strictEqual(due.getMinutes(), 30);
  assert.strictEqual(due.getSeconds(), 0);
});

it('returns null for a malformed time rather than an Invalid Date', () => {
  // An Invalid Date compares false against everything, so it would silently
  // read as "never due" — the right outcome reached by accident. Being
  // explicit means callers can tell "no time" from "not yet".
  assert.strictEqual(alarms.dueAtFor(at('not-a-time')), null);
  assert.strictEqual(alarms.dueAtFor({ callbackDate: new Date() }), null);
  assert.strictEqual(alarms.dueAtFor(null), null);
});

/* ── classify ─────────────────────────────────────────────────────────── */

console.log('\nclassify');

it('rings once the due moment has passed', () => {
  assert.strictEqual(alarms.classify(at('13:59'), NOW), 'ringing');
  assert.strictEqual(alarms.classify(at('14:00'), NOW), 'ringing');
});

it('warns during the five minutes before', () => {
  assert.strictEqual(alarms.classify(at('14:04'), NOW), 'headsUp');
  assert.strictEqual(alarms.classify(at('14:05'), NOW), 'headsUp');
});

it('stays quiet before the heads-up window', () => {
  assert.strictEqual(alarms.classify(at('14:06'), NOW), 'pending');
  assert.strictEqual(alarms.classify(at('17:00'), NOW), 'pending');
});

it('never rings a finished callback', () => {
  assert.strictEqual(alarms.classify(at('13:00', { status: 'Completed' }), NOW), 'skip');
  assert.strictEqual(alarms.classify(at('13:00', { status: 'Cancelled' }), NOW), 'skip');
});

it('still rings statuses that are not terminal', () => {
  // "Not Reachable" means the agent tried and failed — that call still needs
  // making, so silencing it would quietly drop the follow-up.
  assert.strictEqual(alarms.classify(at('13:00', { status: 'Not Reachable' }), NOW), 'ringing');
  assert.strictEqual(alarms.classify(at('13:00', { status: 'Rescheduled' }), NOW), 'ringing');
});

it('honours an active snooze', () => {
  const snoozed = at('13:00', { snoozedUntil: new Date('2026-08-11T14:10:00') });
  assert.strictEqual(alarms.classify(snoozed, NOW), 'snoozed');
});

it('rings again once the snooze expires', () => {
  const expired = at('13:00', { snoozedUntil: new Date('2026-08-11T13:30:00') });
  assert.strictEqual(alarms.classify(expired, NOW), 'ringing');
});

it('dismissal beats a stale snooze', () => {
  // Checked in this order deliberately: an agent who explicitly closed the
  // alarm has answered it, and an old snooze underneath must not revive it.
  const both = at('13:00', {
    snoozedUntil: new Date('2026-08-11T13:30:00'),
    alarmDismissedAt: new Date('2026-08-11T13:31:00'),
  });
  assert.strictEqual(alarms.classify(both, NOW), 'dismissed');
});

it('skips callbacks older than the lookback window', () => {
  // Guards against an alarm storm on deploy day, when every un-completed
  // callback in history would otherwise ring at once.
  const ancient = at('13:00', { callbackDate: new Date('2026-01-01T00:00:00') });
  assert.strictEqual(alarms.classify(ancient, NOW), 'skip');
});

it('still rings something overdue from yesterday', () => {
  const yesterday = at('13:00', { callbackDate: new Date('2026-08-10T00:00:00') });
  assert.strictEqual(alarms.classify(yesterday, NOW), 'ringing');
});

it('skips a callback with an unusable time', () => {
  assert.strictEqual(alarms.classify(at('99:99'), NOW), 'skip');
});

/* ── snooze validation ────────────────────────────────────────────────── */

console.log('\nsnooze validation');

const rejects = async (minutes) => {
  try {
    await alarms.snooze('u1', 'c1', minutes);
    return false;
  } catch (err) {
    return err.statusCode === 400;
  }
};

it('accepts only the offered durations', async () => {
  assert.deepStrictEqual(alarms.ALLOWED_SNOOZE_MINUTES, [5, 10, 15, 30]);
});

(async () => {
  // An unbounded snooze would park a callback out of the agent's day with no
  // trace in the UI, so the duration is validated rather than trusted.
  const badInputs = [0, -5, 99999, 'abc', null, undefined];
  for (const bad of badInputs) {
    const ok = await rejects(bad);
    if (ok) {
      passed += 1;
      console.log(`  ok   rejects a snooze of ${JSON.stringify(bad)}`);
    } else {
      failures.push({ name: `rejects ${bad}`, err: new Error('was accepted') });
      console.log(`  FAIL rejects a snooze of ${JSON.stringify(bad)}`);
    }
  }

  console.log(`\n${passed}/${passed + failures.length} passed`);
  if (failures.length) {
    failures.forEach((f) => console.error(`\n${f.name}\n${f.err.stack}`));
    process.exit(1);
  }
})();
