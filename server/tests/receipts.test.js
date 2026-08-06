// tests/receipts.test.js
//
// The ✓ / ✓✓ / ✓✓-blue aggregation in services/messaging/receipts.js.
//
//     node server/tests/receipts.test.js
//
// Every case here is one where getting it wrong produces a visible lie: a blue
// tick on a message nobody read, or a stuck ✓ on one everybody has.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

let VIEWER_PREFS = { showReadReceipts: true };
let OPTED_OUT_COUNT = 0;

stub('models/MessagingPrefs.js', {
  defaults: () => ({ showReadReceipts: true, showPresence: true }),
  forUser: async function forUser() {
    return { ...this.defaults(), ...VIEWER_PREFS };
  },
  countDocuments: async () => OPTED_OUT_COUNT,
});

const receipts = require('../services/messaging/receipts');
const { aggregateStatus, visibleStatus, canSeeReadReceipts } = receipts;

/* ── Harness ──────────────────────────────────────────────────────────── */

let passed = 0;
const failures = [];
async function it(name, fn) {
  VIEWER_PREFS = { showReadReceipts: true };
  OPTED_OUT_COUNT = 0;
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

(async () => {
  console.log('\naggregation — one-to-one');

  await it('nobody has it yet -> sent', () => {
    assert.strictEqual(aggregateStatus({ recipientIds: ['b'] }), 'sent');
  });

  await it('recipient device has it -> delivered', () => {
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b'], deliveredIds: ['b'] }),
      'delivered'
    );
  });

  await it('recipient read it -> read', () => {
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b'], deliveredIds: ['b'], readIds: ['b'] }),
      'read'
    );
  });

  console.log('\naggregation — groups (advance only when ALL have)');

  await it('2 of 3 delivered -> still sent', () => {
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b', 'c', 'd'], deliveredIds: ['b', 'c'] }),
      'sent'
    );
  });

  await it('3 of 3 delivered -> delivered', () => {
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b', 'c', 'd'], deliveredIds: ['b', 'c', 'd'] }),
      'delivered'
    );
  });

  await it('all delivered, 2 of 3 read -> delivered, not read', () => {
    assert.strictEqual(
      aggregateStatus({
        recipientIds: ['b', 'c', 'd'],
        deliveredIds: ['b', 'c', 'd'],
        readIds: ['b', 'c'],
      }),
      'delivered'
    );
  });

  await it('the last reader flips it blue', () => {
    assert.strictEqual(
      aggregateStatus({
        recipientIds: ['b', 'c', 'd'],
        deliveredIds: ['b', 'c', 'd'],
        readIds: ['b', 'c', 'd'],
      }),
      'read'
    );
  });

  console.log('\nedge cases that produce lies if wrong');

  await it('no recipients -> sent, never read (note-to-self)', () => {
    // `[].every()` is vacuously true, so without an explicit guard a message
    // with nobody to deliver to would instantly show as READ.
    assert.strictEqual(aggregateStatus({ recipientIds: [] }), 'sent');
    assert.strictEqual(
      aggregateStatus({ recipientIds: [], deliveredIds: [], readIds: [] }),
      'sent'
    );
  });

  await it('read implies delivered — old messages with readBy but no deliveredTo', () => {
    // deliveredTo postdates existing messages, so a message read before this
    // feature shipped has readBy populated and deliveredTo empty. It must not
    // be stuck at ✓.
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b'], deliveredIds: [], readIds: ['b'] }),
      'read'
    );
  });

  await it('partially read with no delivery data still aggregates correctly', () => {
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b', 'c'], deliveredIds: [], readIds: ['b'] }),
      'sent'
    );
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b', 'c'], deliveredIds: ['c'], readIds: ['b'] }),
      'delivered'
    );
  });

  await it('id types are compared as strings', () => {
    assert.strictEqual(
      aggregateStatus({ recipientIds: [123], deliveredIds: ['123'], readIds: ['123'] }),
      'read'
    );
  });

  await it('extra delivered ids for non-members are ignored', () => {
    assert.strictEqual(
      aggregateStatus({ recipientIds: ['b'], deliveredIds: ['b', 'stranger'] }),
      'delivered'
    );
  });

  console.log('\nprivacy — read ticks only');

  await it('read downgrades to delivered when receipts are hidden', () => {
    assert.strictEqual(visibleStatus('read', false), 'delivered');
  });

  await it('delivered is NEVER hidden (infrastructure, not behaviour)', () => {
    assert.strictEqual(visibleStatus('delivered', false), 'delivered');
    assert.strictEqual(visibleStatus('sent', false), 'sent');
  });

  await it('read is shown when receipts are allowed', () => {
    assert.strictEqual(visibleStatus('read', true), 'read');
  });

  await it('viewer who opted out sees no read receipts (reciprocity)', async () => {
    VIEWER_PREFS = { showReadReceipts: false };
    assert.strictEqual(await canSeeReadReceipts('me', ['b']), false);
  });

  await it('one opted-out participant withholds the thread read tick', async () => {
    OPTED_OUT_COUNT = 1;
    assert.strictEqual(await canSeeReadReceipts('me', ['b', 'c']), false);
  });

  await it('everyone opted in -> read receipts visible', async () => {
    assert.strictEqual(await canSeeReadReceipts('me', ['b', 'c']), true);
  });

  await it('a solo thread with no others is visible', async () => {
    assert.strictEqual(await canSeeReadReceipts('me', []), true);
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
