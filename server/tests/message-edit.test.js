// tests/message-edit.test.js
//
// The two rules that gate editing a message: you sent it, and it is still
// recent. Runs standalone:
//
//     node server/tests/message-edit.test.js
//
// No database — models are stubbed via require.cache before load, same
// technique as messaging-service.test.js.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

const noopModel = () => ({
  find: () => { const p = Promise.resolve([]); p.lean = () => p; p.select = () => p; p.sort = () => p; p.populate = () => p; return p; },
  findById: () => { const p = Promise.resolve(null); p.lean = () => p; p.select = () => p; p.populate = () => p; return p; },
  countDocuments: () => Promise.resolve(0),
  aggregate: () => Promise.resolve([]),
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
  create: () => Promise.resolve({}),
});

stub('models/ChatMessage.js', noopModel());
stub('models/Conversation.js', noopModel());
stub('models/User.js', noopModel());

const chatThread = require('../services/messaging/adapters/chatThread');

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

const SENDER = 'user-1';
const OTHER = 'user-2';
const NOW = Date.now();
const MIN = 60 * 1000;

const msg = (overrides = {}) => ({
  _id: 'm1',
  senderId: SENDER,
  message: 'hello',
  timestamp: new Date(NOW),
  ...overrides,
});

/* ── Window ───────────────────────────────────────────────────────────── */

console.log('\nedit window');

it('allows an edit immediately after sending', () => {
  assert.strictEqual(chatThread.editability(msg(), SENDER, NOW).ok, true);
});

it('allows an edit at 6 minutes', () => {
  const sent = msg({ timestamp: new Date(NOW - 6 * MIN) });
  assert.strictEqual(chatThread.editability(sent, SENDER, NOW).ok, true);
});

it('allows an edit at exactly 7 minutes', () => {
  // The boundary is inclusive — a message is editable "for 7 minutes", so the
  // instant it turns 7 is still inside the promise.
  const sent = msg({ timestamp: new Date(NOW - 7 * MIN) });
  assert.strictEqual(chatThread.editability(sent, SENDER, NOW).ok, true);
});

it('refuses just past the window', () => {
  const sent = msg({ timestamp: new Date(NOW - 7 * MIN - 1000) });
  const check = chatThread.editability(sent, SENDER, NOW);
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.reason, 'WINDOW_EXPIRED');
  assert.strictEqual(check.status, 403);
});

it('refuses long after', () => {
  const sent = msg({ timestamp: new Date(NOW - 24 * 60 * MIN) });
  assert.strictEqual(chatThread.editability(sent, SENDER, NOW).reason, 'WINDOW_EXPIRED');
});

it('reads the window from CHAT_EDIT_WINDOW_MINUTES', () => {
  assert.strictEqual(chatThread.EDIT_WINDOW_MS, 7 * MIN);
});

/* ── Ownership ────────────────────────────────────────────────────────── */

console.log('\nownership');

it('refuses someone else’s message', () => {
  const check = chatThread.editability(msg(), OTHER, NOW);
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.reason, 'NOT_SENDER');
  assert.strictEqual(check.status, 403);
});

it('ownership is checked before the window', () => {
  // A non-sender must get "not yours" whether or not the window happens to be
  // open — otherwise the differing errors leak when someone else sent a
  // message, which is not theirs to know.
  const old = msg({ timestamp: new Date(NOW - 60 * MIN) });
  assert.strictEqual(chatThread.editability(old, OTHER, NOW).reason, 'NOT_SENDER');
});

it('compares ids as strings', () => {
  // senderId is a String in this schema but callers hand us ObjectIds; a
  // strict === between the two is always false, which would lock everyone out
  // of editing their own messages.
  const objectIdish = { toString: () => SENDER };
  assert.strictEqual(chatThread.editability(msg(), objectIdish, NOW).ok, true);
});

/* ── Bad input ────────────────────────────────────────────────────────── */

console.log('\nbad input');

it('a missing message is 404, not a crash', () => {
  const check = chatThread.editability(null, SENDER, NOW);
  assert.strictEqual(check.reason, 'NOT_FOUND');
  assert.strictEqual(check.status, 404);
});

it('a message with no usable timestamp is refused', () => {
  const check = chatThread.editability(msg({ timestamp: 'nonsense' }), SENDER, NOW);
  assert.strictEqual(check.ok, false);
  assert.strictEqual(check.reason, 'NO_TIMESTAMP');
});

it('falls back to createdAt when timestamp is absent', () => {
  const sent = { _id: 'm1', senderId: SENDER, createdAt: new Date(NOW - MIN) };
  assert.strictEqual(chatThread.editability(sent, SENDER, NOW).ok, true);
});

/* ── Summary ──────────────────────────────────────────────────────────── */

console.log(`\n${passed}/${passed + failures.length} passed`);
if (failures.length) {
  failures.forEach((f) => console.error(`\n${f.name}\n${f.err.stack}`));
  process.exit(1);
}
