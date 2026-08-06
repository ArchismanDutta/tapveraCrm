// tests/messaging-access.test.js
//
// Logic tests for services/messaging/access.js. Runs standalone with plain
// node — no test runner, no database:
//
//     node server/tests/messaging-access.test.js
//
// The models and the accessControl/hierarchy helpers are stubbed by seeding
// require.cache BEFORE access.js is loaded, so this exercises the real
// decision logic against controlled inputs.
'use strict';

const path = require('path');
const assert = require('assert');

/* ── Stub the dependencies access.js pulls in ─────────────────────────── */

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));

const DB = { conversations: {}, projects: {}, users: {} };

const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

const finder = (bucket) => ({
  findById: (id) => {
    const doc = DB[bucket][String(id)] || null;
    const p = Promise.resolve(doc);
    p.catch = () => p;            // access.js chains .catch(() => null)
    p.select = () => p;
    p.lean = () => p;
    return p;
  },
});

stub('models/Conversation.js', finder('conversations'));
stub('models/Project.js', finder('projects'));
stub('models/User.js', finder('users'));

// `can` is driven per-test via CAN_RESULT; hierarchy returns ACCESSIBLE_IDS.
let CAN_RESULT = {};
let ACCESSIBLE_IDS = [];
stub('utils/accessControl.js', {
  can: async (_user, action) => Boolean(CAN_RESULT[action]),
  scopeQuery: async (q) => q,
});
stub('utils/hierarchyUtils.js', {
  getAccessibleUserIds: async () => ACCESSIBLE_IDS,
});

const {
  assertChatAccess,
  assertProjectChatAccess,
  AccessError,
} = require('../services/messaging/access');

/* ── Tiny harness ─────────────────────────────────────────────────────── */

let passed = 0;
const failures = [];

async function it(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

/** Assert the call is rejected with an AccessError of the given status. */
async function denies(promise, status) {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof AccessError, `expected AccessError, got ${err.name}: ${err.message}`);
    assert.strictEqual(err.status, status, `expected status ${status}, got ${err.status}`);
    return;
  }
  throw new Error('expected access to be denied, but it was allowed');
}

/** Assert the call resolves. */
async function allows(promise) {
  await promise; // throws on denial, which the harness reports
}

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const MEMBER = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const OTHER = 'bbbbbbbbbbbbbbbbbbbbbbb2';
const CREATOR = 'ccccccccccccccccccccccc3';
const CLIENT = 'ddddddddddddddddddddddd4';

DB.conversations.group1 = {
  _id: 'group1', type: 'group', members: [MEMBER, CREATOR], createdBy: CREATOR,
};
DB.conversations.dm1 = {
  _id: 'dm1', type: 'private', members: [MEMBER, OTHER], createdBy: MEMBER,
};

DB.projects.projNew = {
  _id: 'projNew', assignedTo: [MEMBER], clients: [CLIENT], client: null,
};
DB.projects.projLegacy = {
  _id: 'projLegacy', assignedTo: [], clients: [], client: CLIENT,
};

const asUser = (id, role = 'employee') => ({ _id: id, role, positionRef: null, position: '' });
// Socket users carry `id`, not `_id`, and no position fields — the shape that
// silently broke every check before userIdOf/hydrateForAuthority existed.
const asSocketUser = (id, role = 'employee') => ({ id, role, userType: 'User' });
const asClient = (id) => ({ _id: id, role: 'client', userType: 'Client' });

/* ── Tests ────────────────────────────────────────────────────────────── */

(async () => {
  console.log('\nchat access');

  await it('member can read their group', () =>
    allows(assertChatAccess(asUser(MEMBER), 'group1', 'read')));

  await it('non-member is denied read (the original IDOR)', () =>
    denies(assertChatAccess(asUser(OTHER), 'group1', 'read'), 403));

  await it('non-member is denied write', () =>
    denies(assertChatAccess(asUser(OTHER), 'group1', 'write'), 403));

  await it('admin gets NO blanket read into a group they are not in', () =>
    denies(assertChatAccess(asUser(OTHER, 'admin'), 'group1', 'read'), 403));

  await it('socket-shaped user (id, not _id) is accepted', () =>
    allows(assertChatAccess(asSocketUser(MEMBER), 'group1', 'read')));

  await it('socket-shaped non-member still denied', () =>
    denies(assertChatAccess(asSocketUser(OTHER), 'group1', 'read'), 403));

  await it('missing conversation is 404, not 403', () =>
    denies(assertChatAccess(asUser(MEMBER), 'nope', 'read'), 404));

  await it('unauthenticated is 401', () =>
    denies(assertChatAccess({}, 'group1', 'read'), 401));

  await it('group moderate: creator allowed', () =>
    allows(assertChatAccess(asUser(CREATOR), 'group1', 'moderate')));

  await it('group moderate: plain member denied', () =>
    denies(assertChatAccess(asUser(MEMBER), 'group1', 'moderate'), 403));

  await it('group moderate: admin allowed (orphaned-group escape hatch)', () =>
    allows(assertChatAccess(asUser(OTHER, 'admin'), 'group1', 'moderate')));

  await it('group delete: plain member denied (destructive for everyone)', () =>
    denies(assertChatAccess(asUser(MEMBER), 'group1', 'delete'), 403));

  await it('group delete: creator allowed', () =>
    allows(assertChatAccess(asUser(CREATOR), 'group1', 'delete')));

  await it('dm delete: either participant allowed', () =>
    allows(assertChatAccess(asUser(OTHER), 'dm1', 'delete')));

  await it('dm delete: outsider denied', () =>
    denies(assertChatAccess(asUser(CREATOR), 'dm1', 'delete'), 403));

  console.log('\nproject access');
  CAN_RESULT = {};
  ACCESSIBLE_IDS = [];

  await it('assigned employee can read', () =>
    allows(assertProjectChatAccess(asUser(MEMBER), 'projNew', 'read')));

  await it('unassigned employee denied', () =>
    denies(assertProjectChatAccess(asUser(OTHER), 'projNew', 'read'), 403));

  await it('owning client can read (clients[] — the role that fell through)', () =>
    allows(assertProjectChatAccess(asClient(CLIENT), 'projNew', 'read')));

  await it('non-owning client denied', () =>
    denies(assertProjectChatAccess(asClient(OTHER), 'projNew', 'read'), 403));

  await it('owning client on LEGACY single `client` field can read', () =>
    allows(assertProjectChatAccess(asClient(CLIENT), 'projLegacy', 'read')));

  await it('admin can read any project', () =>
    allows(assertProjectChatAccess(asUser(OTHER, 'admin'), 'projNew', 'read')));

  await it('moderate denied without manage authority', () =>
    denies(assertProjectChatAccess(asUser(MEMBER), 'projNew', 'moderate'), 403));

  await it('moderate allowed for admin', () =>
    allows(assertProjectChatAccess(asUser(OTHER, 'admin'), 'projNew', 'moderate')));

  await it('projects:manage authority grants moderate', async () => {
    CAN_RESULT = { 'projects:manage': true };
    await allows(assertProjectChatAccess(asUser(OTHER), 'projNew', 'moderate'));
    CAN_RESULT = {};
  });

  await it('projects:view + hierarchy overlap grants read (supervisor)', async () => {
    CAN_RESULT = { 'projects:view': true };
    ACCESSIBLE_IDS = [MEMBER];
    await allows(assertProjectChatAccess(asUser(OTHER), 'projNew', 'read'));
    CAN_RESULT = {}; ACCESSIBLE_IDS = [];
  });

  await it('projects:view WITHOUT hierarchy overlap is denied', async () => {
    CAN_RESULT = { 'projects:view': true };
    ACCESSIBLE_IDS = ['someone-else'];
    await denies(assertProjectChatAccess(asUser(OTHER), 'projNew', 'read'), 403);
    CAN_RESULT = {}; ACCESSIBLE_IDS = [];
  });

  await it('missing project is 404', () =>
    denies(assertProjectChatAccess(asUser(MEMBER), 'nope', 'read'), 404));

  /* ── Report ─────────────────────────────────────────────────────────── */
  const total = passed + failures.length;
  console.log(`\n${passed}/${total} passed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.err.message}`));
    process.exit(1);
  }
})();
