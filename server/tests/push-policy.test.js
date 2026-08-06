// tests/push-policy.test.js
//
// The suppression rules in services/messaging/pushPolicy.js. Runs standalone:
//
//     node server/tests/push-policy.test.js
//
// These matter more than most logic tests: a wrong "suppress" is a missed
// message, and a wrong "send" is what makes people turn notifications off.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

/* ── Stubs ────────────────────────────────────────────────────────────── */

let PREFS = {};
let MUTED = false;
let VIEWING = [];        // user ids currently in the thread room
let NOTIFICATION = { read: false };

stub('models/MessagingPrefs.js', {
  defaults: () => ({
    pushEnabled: true,
    quietHours: { enabled: false, from: '21:00', to: '08:00', tz: 'Asia/Kolkata' },
    soundEnabled: true,
    showReadReceipts: true,
    showPresence: true,
  }),
  forUser: async function forUser() {
    return { ...this.defaults(), ...PREFS };
  },
});

stub('models/ThreadPref.js', { isMuted: async () => MUTED });

stub('models/Notification.js', {
  findById: () => {
    const p = Promise.resolve(NOTIFICATION);
    p.select = () => p;
    p.lean = () => p;
    return p;
  },
});

// Socket.IO: report whoever VIEWING says is in the room.
stub('socket/index.js', {
  getIO: () => ({
    in: () => ({
      fetchSockets: async () => VIEWING.map((id) => ({ user: { id } })),
    }),
  }),
});

const policy = require('../services/messaging/pushPolicy');

/* ── Harness ──────────────────────────────────────────────────────────── */

let passed = 0;
const failures = [];
async function it(name, fn) {
  // Each test starts from a clean slate.
  PREFS = {};
  MUTED = false;
  VIEWING = [];
  NOTIFICATION = { read: false };
  policy._lastPushAt.clear();
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

const ME = 'u1';
const ask = (over = {}) =>
  policy.shouldPush({ userId: ME, scope: 'chat', threadId: 't1', ...over });

/* ── Tests ────────────────────────────────────────────────────────────── */

(async () => {
  console.log('\nsuppression rules');

  await it('pushes by default', async () => {
    const { push } = await ask();
    assert.strictEqual(push, true);
  });

  await it('respects pushEnabled = false', async () => {
    PREFS = { pushEnabled: false };
    const { push, reason } = await ask();
    assert.strictEqual(push, false);
    assert.strictEqual(reason, 'push_disabled');
  });

  await it('suppresses while the user is viewing that thread', async () => {
    VIEWING = [ME];
    const { push, reason } = await ask();
    assert.strictEqual(push, false);
    assert.strictEqual(reason, 'actively_viewing');
  });

  await it('still pushes when someone ELSE is viewing the thread', async () => {
    VIEWING = ['someone-else'];
    const { push } = await ask();
    assert.strictEqual(push, true);
  });

  await it('suppresses a muted thread', async () => {
    MUTED = true;
    const { push, reason } = await ask();
    assert.strictEqual(push, false);
    assert.strictEqual(reason, 'thread_muted');
  });

  console.log('\ncoalescing');

  await it('a second message within 30s is coalesced', async () => {
    assert.strictEqual((await ask()).push, true);
    const second = await ask();
    assert.strictEqual(second.push, false);
    assert.strictEqual(second.reason, 'coalesced');
  });

  await it('a different thread is not coalesced by the first', async () => {
    assert.strictEqual((await ask()).push, true);
    assert.strictEqual((await ask({ threadId: 't2' })).push, true);
  });

  await it('a mention bypasses coalescing', async () => {
    assert.strictEqual((await ask()).push, true);
    assert.strictEqual((await ask({ mentioned: true })).push, true);
  });

  await it('a mention does not consume the coalescing slot', async () => {
    assert.strictEqual((await ask({ mentioned: true })).push, true);
    // The mention did not set the window, so an ordinary message still gets through.
    assert.strictEqual((await ask()).push, true);
  });

  console.log('\nquiet hours');

  // 22:00 IST — inside a 21:00→08:00 window.
  const NIGHT = new Date('2026-08-05T16:30:00Z');
  // 12:00 IST — outside it.
  const NOON = new Date('2026-08-05T06:30:00Z');
  const quiet = { enabled: true, from: '21:00', to: '08:00', tz: 'Asia/Kolkata' };

  await it('overnight window matches late evening', () => {
    assert.strictEqual(policy.inQuietHours({ quietHours: quiet }, NIGHT), true);
  });

  await it('overnight window does not match midday', () => {
    assert.strictEqual(policy.inQuietHours({ quietHours: quiet }, NOON), false);
  });

  await it('overnight window matches early morning (after midnight)', () => {
    const dawn = new Date('2026-08-05T00:30:00Z'); // 06:00 IST
    assert.strictEqual(policy.inQuietHours({ quietHours: quiet }, dawn), true);
  });

  await it('same-day window (13:00->14:00) behaves normally', () => {
    const q = { enabled: true, from: '13:00', to: '14:00', tz: 'Asia/Kolkata' };
    const at1330 = new Date('2026-08-05T08:00:00Z');
    const at1500 = new Date('2026-08-05T09:30:00Z');
    assert.strictEqual(policy.inQuietHours({ quietHours: q }, at1330), true);
    assert.strictEqual(policy.inQuietHours({ quietHours: q }, at1500), false);
  });

  await it('disabled quiet hours never match', () => {
    assert.strictEqual(
      policy.inQuietHours({ quietHours: { ...quiet, enabled: false } }, NIGHT),
      false
    );
  });

  await it('an invalid timezone fails open rather than muting everything', () => {
    assert.strictEqual(
      policy.inQuietHours({ quietHours: { ...quiet, tz: 'Not/AZone' } }, NIGHT),
      false
    );
  });

  await it('a mention bypasses quiet hours', async () => {
    PREFS = { quietHours: quiet };
    // Can't inject `now` through shouldPush, so assert the rule composition:
    // mention short-circuits the quiet-hours branch.
    const { push } = await ask({ mentioned: true });
    assert.strictEqual(push, true);
  });

  console.log('\ngrace window');

  await it('unread after the grace delay -> send', async () => {
    NOTIFICATION = { read: false };
    const t0 = Date.now();
    const ok = await policy.stillUnread('n1');
    assert.strictEqual(ok, true);
    assert.ok(Date.now() - t0 >= policy.GRACE_MS - 50, 'should actually wait out the window');
  });

  await it('read during the grace delay -> suppress (the phone-then-laptop case)', async () => {
    NOTIFICATION = { read: true };
    assert.strictEqual(await policy.stillUnread('n1'), false);
  });

  await it('a vanished notification suppresses rather than waking someone', async () => {
    NOTIFICATION = null;
    assert.strictEqual(await policy.stillUnread('gone'), false);
  });

  /* ── Report ─────────────────────────────────────────────────────────── */
  const total = passed + failures.length;
  console.log(`\n${passed}/${total} passed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.err.message}`));
    process.exit(1);
  }
})();
