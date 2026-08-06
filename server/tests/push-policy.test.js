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
//
// Entries may be either a bare user id — the legacy local-socket shape, which
// exercises the `socket.user` fallback — or an explicit socket-like object, so
// the focus and RemoteSocket cases can be described precisely.
stub('socket/index.js', {
  getIO: () => ({
    in: () => ({
      fetchSockets: async () =>
        VIEWING.map((entry) => (typeof entry === 'string' ? { user: { id: entry } } : entry)),
    }),
  }),
});

/** A socket as it comes back from fetchSockets() for a user on ANOTHER instance. */
const remoteSocket = (userId, active) => ({
  // No `.user`: the Redis adapter does not serialize custom properties, so this
  // is genuinely all a RemoteSocket carries.
  data: active === undefined ? { userId } : { userId, active },
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

  console.log('\nforeground vs. merely connected');

  // The bug this whole section exists for: leaving the CRM open in a background
  // window suppressed every push for the thread you last had selected.
  await it('a BACKGROUNDED tab does not count as viewing', async () => {
    VIEWING = [remoteSocket(ME, false)];
    const { push } = await ask();
    assert.strictEqual(push, true);
  });

  await it('a FOREGROUND tab still counts as viewing', async () => {
    VIEWING = [remoteSocket(ME, true)];
    const { push, reason } = await ask();
    assert.strictEqual(push, false);
    assert.strictEqual(reason, 'actively_viewing');
  });

  await it('a socket that never reported focus is treated as viewing', async () => {
    // An older cached bundle. Preserving the previous behaviour beats surprising
    // someone mid-conversation.
    VIEWING = [remoteSocket(ME, undefined)];
    const { push, reason } = await ask();
    assert.strictEqual(push, false);
    assert.strictEqual(reason, 'actively_viewing');
  });

  await it('matches on socket.data.userId, so sockets on other instances count', async () => {
    // Before this, `s.user?.id` read undefined for every RemoteSocket, so on a
    // multi-instance deployment this check silently answered "not viewing" for
    // anyone whose socket lived on a different process.
    VIEWING = [remoteSocket(ME, true)];
    assert.strictEqual(await policy.isViewingThread(ME, 'chat', 't1'), true);
  });

  await it('one backgrounded tab does not cancel out another that is focused', async () => {
    // Two windows open, one visible. They are still reading it.
    VIEWING = [remoteSocket(ME, false), remoteSocket(ME, true)];
    const { push, reason } = await ask();
    assert.strictEqual(push, false);
    assert.strictEqual(reason, 'actively_viewing');
  });

  await it("someone else's foreground tab is still irrelevant", async () => {
    VIEWING = [remoteSocket('someone-else', true)];
    const { push } = await ask();
    assert.strictEqual(push, true);
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

  console.log('\nnon-thread notifications (tasks, leaves)');

  const askGeneral = (over = {}) => policy.shouldPushGeneral({ userId: ME, ...over });

  await it('pushes a task or leave notification by default', async () => {
    assert.strictEqual((await askGeneral()).push, true);
  });

  await it('respects the master push switch', async () => {
    PREFS = { pushEnabled: false };
    const { push, reason } = await askGeneral();
    assert.strictEqual(push, false);
    assert.strictEqual(reason, 'push_disabled');
  });

  await it('is not coalesced — two task assignments both notify', async () => {
    // Unlike chat, these are rare and each one is a distinct thing to act on.
    assert.strictEqual((await askGeneral()).push, true);
    assert.strictEqual((await askGeneral()).push, true);
  });

  await it('has no thread to view, so an open tab never suppresses it', async () => {
    VIEWING = [remoteSocket(ME, true)];
    assert.strictEqual((await askGeneral()).push, true);
  });

  await it('high priority bypasses quiet hours', async () => {
    PREFS = { quietHours: { enabled: true, from: '00:00', to: '23:59', tz: 'Asia/Kolkata' } };
    assert.strictEqual((await askGeneral({ priority: 'high' })).push, true);
    assert.strictEqual((await askGeneral({ priority: 'urgent' })).push, true);
    const normal = await askGeneral({ priority: 'normal' });
    assert.strictEqual(normal.push, false);
    assert.strictEqual(normal.reason, 'quiet_hours');
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
