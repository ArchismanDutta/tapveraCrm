// tests/chat-thread-adapter.test.js
//
// listThreads: membership shape and query cost. Runs standalone:
//
//     node server/tests/chat-thread-adapter.test.js
//
// No database — models are stubbed via require.cache before load, same
// technique as messaging-service.test.js.
//
// ─── WHAT THIS PINS DOWN ───
// `listThreads` used to exclude terminated/absconded users from the member
// list. The client resolves every message's author against that list, so the
// moment someone left the company every message they had ever sent re-rendered
// as "Unknown" — history silently losing its authors. It also ran one User.find
// per group, which is the exact N+1 the unread aggregate right above it exists
// to avoid.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const GROUPS = [
  { _id: 'g1', type: 'group', name: 'Design', members: ['u1', 'u2', 'gone1'] },
  { _id: 'g2', type: 'group', name: 'Ops', members: ['u1', 'deleted1'] },
];

const USERS = [
  { _id: 'u1', name: 'Anish', role: 'employee', status: 'active' },
  { _id: 'u2', name: 'Sahil', role: 'admin', status: 'active' },
  { _id: 'gone1', name: 'Priya', role: 'employee', status: 'terminated' },
  // `deleted1` is deliberately absent — a hard-deleted account.
];

// Counts how many times the User collection was queried, so the N+1 regression
// is caught by cost rather than by reading the code.
let userFindCalls = 0;

const thenable = (value) => {
  const p = Promise.resolve(value);
  p.lean = () => p;
  p.select = () => p;
  p.sort = () => p;
  p.skip = () => p;
  p.limit = () => p;
  p.populate = () => p;
  return p;
};

stub('models/Conversation.js', {
  find: () => thenable(GROUPS.map((g) => ({ ...g, toObject: () => ({ ...g }) }))),
  findById: () => thenable(null),
  countDocuments: () => Promise.resolve(0),
  aggregate: () => Promise.resolve([]),
});

stub('models/User.js', {
  find: (filter) => {
    userFindCalls += 1;
    const wanted = new Set((filter?._id?.$in || []).map(String));
    return thenable(USERS.filter((u) => wanted.has(String(u._id))));
  },
});

stub('models/ChatMessage.js', {
  find: () => thenable([]),
  findById: () => thenable(null),
  countDocuments: () => Promise.resolve(0),
  // unreadCounts() aggregates; an empty result means every group reads 0.
  aggregate: () => Promise.resolve([]),
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
});

const chatThread = require('../services/messaging/adapters/chatThread');

/* ── Harness ──────────────────────────────────────────────────────────── */

let passed = 0;
const failures = [];

const tests = [];
let group = '';
// Headings are recorded WITH the test rather than printed at queue time —
// `it()` only enqueues, so a bare console.log here would print every heading
// before the first test ran.
const describe = (name) => { group = name; };
const it = (name, fn) => tests.push({ group, name, fn });

async function run() {
  let printed = '';
  for (const { group: g, name, fn } of tests) {
    if (g !== printed) { console.log(`\n${g}`); printed = g; }
    try {
      await fn();
      passed += 1;
      console.log(`  ok   ${name}`);
    } catch (err) {
      failures.push({ name, err });
      console.log(`  FAIL ${name}\n       ${err.message}`);
    }
  }

  console.log(`\n${passed}/${tests.length} passed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.err.message}`));
    process.exitCode = 1;
  }
}

/* ── Tests ────────────────────────────────────────────────────────────── */

const USER = { _id: 'u1', role: 'employee' };
const byId = (members, id) => members.find((m) => String(m._id) === id);

describe('listThreads — membership');

it('former colleagues are still returned, so history keeps its author', async () => {
  const { raw } = await chatThread.listThreads(USER);
  const design = raw.find((t) => String(t._id) === 'g1');

  const priya = byId(design.members, 'gone1');
  assert.ok(priya, 'terminated member was dropped from the list');
  assert.strictEqual(priya.name, 'Priya', 'terminated member lost their name');
});

it('former colleagues are flagged inactive so the UI can tell them apart', async () => {
  const { raw } = await chatThread.listThreads(USER);
  const design = raw.find((t) => String(t._id) === 'g1');

  assert.strictEqual(byId(design.members, 'gone1').isActive, false);
  assert.strictEqual(byId(design.members, 'u1').isActive, true);
  assert.strictEqual(byId(design.members, 'u2').isActive, true);
});

it('a hard-deleted account still gets a row rather than vanishing', async () => {
  // Otherwise the same "Unknown" problem returns through a different door.
  const { raw } = await chatThread.listThreads(USER);
  const ops = raw.find((t) => String(t._id) === 'g2');

  const ghost = byId(ops.members, 'deleted1');
  assert.ok(ghost, 'deleted account produced no member row');
  assert.strictEqual(ghost.isActive, false);
  assert.ok(ghost.name, 'deleted account has no display name to fall back on');
});

it('the normalized shape carries isActive too', async () => {
  const { normalized } = await chatThread.listThreads(USER);
  const design = normalized.find((t) => t.id === 'g1');

  assert.strictEqual(design.members.find((m) => m.id === 'gone1').isActive, false);
  assert.strictEqual(design.members.find((m) => m.id === 'u1').isActive, true);
});

describe('listThreads — query cost');

it('members are fetched in ONE query regardless of group count', async () => {
  userFindCalls = 0;
  await chatThread.listThreads(USER);

  assert.strictEqual(
    userFindCalls,
    1,
    `expected 1 User query for ${GROUPS.length} groups, got ${userFindCalls} (N+1 regression)`
  );
});

run();
