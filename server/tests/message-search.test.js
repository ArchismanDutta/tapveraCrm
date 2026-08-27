// tests/message-search.test.js
//
// Message search. Runs standalone:
//
//     node server/tests/message-search.test.js
//
// No database — models are stubbed via require.cache before load, same
// technique as forward-messages.test.js.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PINS DOWN
// ─────────────────────────────────────────────────────────────────────────────
// Search was previously a client-side filter over the ~50 messages that happen
// to be loaded, so nothing older than the last page could be found at all. The
// server-side replacement introduces two things that are easy to get wrong and
// expensive to get wrong quietly:
//
//   1. SCOPE. When no thread is named, search covers everything the user can
//      read — so the set of readable threads is the entire security boundary.
//      If it ever came from the request, or defaulted to "no filter" on an
//      empty set, the endpoint would return other people's DMs.
//
//   2. THE PATTERN. The old project-side `{ $regex: search }` passed raw user
//      input to the regex engine. Searching for "(" is an unterminated group
//      (a 500); "(a+)+$" is catastrophic backtracking run against every
//      message in the thread. Neither requires malice.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

/* ── Harness ──────────────────────────────────────────────────────────── */

let passed = 0;
const failures = [];
const queue = [];
const it = (name, fn) => queue.push({ name, fn });

async function run() {
  for (const { name, fn } of queue) {
    try {
      await fn();
      passed += 1;
      console.log(`  ok   ${name}`);
    } catch (err) {
      failures.push({ name, err });
      console.log(`  FAIL ${name}\n       ${err.message}`);
    }
  }
}

/* ═══════════════ PART 1 — the query parser and snippet cutter ═══════════ */

const search = require('../services/messaging/search');

console.log('\nquery parsing — the regex is built from user input');

it('rejects a query too short to be a search', () => {
  const r = search.parseQuery('a');
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /at least 2/);
});

it('rejects a query long enough to be a payload', () => {
  assert.strictEqual(search.parseQuery('x'.repeat(500)).ok, false);
});

it('trims before measuring, so "  a  " is still too short', () => {
  assert.strictEqual(search.parseQuery('   a   ').ok, false);
});

it('SEARCHING FOR "(" DOES NOT THROW — the old raw-regex bug', () => {
  const r = search.parseQuery('((');
  assert.strictEqual(r.ok, true);
  assert.doesNotThrow(() => r.pattern.test('a (( b'));
  assert.strictEqual(r.pattern.test('a (( b'), true);
  assert.strictEqual(r.pattern.test('nothing here'), false);
});

it('regex metacharacters are literal, not operators', () => {
  const r = search.parseQuery('a+b');
  assert.strictEqual(r.pattern.test('a+b'), true, 'should match the literal text');
  assert.strictEqual(r.pattern.test('aaab'), false, 'must NOT behave as a quantifier');
});

it('a catastrophic-backtracking pattern is inert', () => {
  const r = search.parseQuery('(a+)+$');
  const started = Date.now();
  r.pattern.test('a'.repeat(40) + 'b');
  assert.ok(Date.now() - started < 500, 'took too long — the pattern was not escaped');
});

it('matching is case-insensitive', () => {
  assert.strictEqual(search.parseQuery('INVOICE').pattern.test('the invoice is attached'), true);
});

console.log('\nsnippets');

it('cuts a window around the match and flags both trims', () => {
  const body = 'x'.repeat(200) + ' NEEDLE ' + 'y'.repeat(200);
  const s = search.buildSnippet(body, 'needle');
  assert.ok(s.text.includes('NEEDLE'));
  assert.ok(s.text.length < body.length);
  assert.strictEqual(s.truncatedStart, true);
  assert.strictEqual(s.truncatedEnd, true);
});

it('highlights EVERY occurrence in the window, not just the first', () => {
  const s = search.buildSnippet('cat and cat and cat', 'cat');
  assert.strictEqual(s.highlights.length, 3);
});

it('highlight offsets are relative to the snippet, not the message', () => {
  const body = 'z'.repeat(300) + ' target';
  const s = search.buildSnippet(body, 'target');
  const h = s.highlights[0];
  assert.strictEqual(s.text.substr(h.start, h.length).toLowerCase(), 'target');
});

it('a message with no visible match still returns readable text', () => {
  const s = search.buildSnippet('some body text', 'zzz');
  assert.ok(s.text.length > 0);
  assert.deepStrictEqual(s.highlights, []);
});

it('survives a null body', () => {
  assert.doesNotThrow(() => search.buildSnippet(null, 'x'));
});

it('clamps limit so one request cannot ask for the collection', () => {
  assert.strictEqual(search.parsePaging({ limit: 100000 }).limit, 50);
  assert.strictEqual(search.parsePaging({ page: -5 }).page, 1);
  assert.strictEqual(search.parsePaging({ page: 3, limit: 10 }).skip, 20);
});

/* ═══════════════ PART 2 — scoping, with stubbed models ═════════════════ */

// Records what filter each collection was queried with, so the tests can
// assert on the boundary rather than on the rows that came back.
const seen = { chat: [], project: [] };

function makeChain(rows) {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    populate: () => chain,
    select: () => chain,
    lean: () => Promise.resolve(rows),
    then: (res, rej) => Promise.resolve(rows).then(res, rej),
  };
  return chain;
}

const CHAT_ROWS = [
  { _id: 'm1', conversationId: 'c1', senderId: 'u2', message: 'the invoice is attached', timestamp: new Date('2026-01-02') },
];
const PROJECT_ROWS = [
  { _id: 'p1', project: { _id: 'pr1', projectName: 'Acme site' }, sentBy: { _id: 'u3', name: 'Dev' }, message: 'invoice sent to the client', createdAt: new Date('2026-01-03') },
];

stub('models/ChatMessage.js', {
  find: (f) => { seen.chat.push(f); return makeChain(CHAT_ROWS); },
  countDocuments: (f) => { seen.chat.push(f); return Promise.resolve(CHAT_ROWS.length); },
  findById: () => makeChain(null),
});
stub('models/Message.js', {
  find: (f) => { seen.project.push(f); return makeChain(PROJECT_ROWS); },
  countDocuments: (f) => { seen.project.push(f); return Promise.resolve(PROJECT_ROWS.length); },
  findById: () => makeChain(null),
});
stub('models/Conversation.js', {
  find: () => makeChain([{ _id: 'c1', name: 'Design', type: 'group', members: ['u1', 'u2'] }]),
  findById: () => makeChain(null),
});
stub('models/Project.js', { find: () => makeChain([]), findById: () => makeChain(null) });
stub('models/User.js', { find: () => makeChain([{ _id: 'u2', name: 'Ana' }]), findById: () => makeChain(null) });
stub('models/Client.js', { find: () => makeChain([]), findById: () => makeChain(null) });
stub('utils/accessControl.js', { can: async () => false, scopeQuery: async (q) => q });
stub('utils/hierarchyUtils.js', { getAccessibleUserIds: async () => [] });

class FakeAccessError extends Error {
  constructor(message, status = 403, code = 'FORBIDDEN') { super(message); this.status = status; this.code = code; }
}

// Access is stubbed so the tests control exactly what the user can reach.
let ACCESSIBLE_CHAT = ['c1'];
let ACCESSIBLE_PROJECTS = ['pr1'];
stub('services/messaging/access.js', {
  AccessError: FakeAccessError,
  assertChatAccess: async (u, id) => {
    if (!ACCESSIBLE_CHAT.includes(String(id))) throw new FakeAccessError('Not a member');
    return { conversation: { _id: id, type: 'group' }, isMember: true, isCreator: false };
  },
  assertProjectChatAccess: async (u, id) => {
    if (ACCESSIBLE_PROJECTS !== null && !ACCESSIBLE_PROJECTS.includes(String(id))) {
      throw new FakeAccessError('No access to this project');
    }
    return { project: { _id: id }, membership: 'assignee' };
  },
  accessibleConversationIds: async () => ACCESSIBLE_CHAT,
  accessibleProjectIds: async () => ACCESSIBLE_PROJECTS,
  sendAccessError: () => {},
  isAdmin: () => false,
});

const messagingService = require('../services/messaging/messaging.service');
const USER = { _id: 'u1', name: 'Me' };
const reset = () => { seen.chat = []; seen.project = []; ACCESSIBLE_CHAT = ['c1']; ACCESSIBLE_PROJECTS = ['pr1']; };

console.log('\nscoping — the security boundary');

it('constrains the chat query to the conversations the user is in', async () => {
  reset();
  await messagingService.searchMessages(USER, { scope: 'chat', query: 'invoice' });
  const filter = seen.chat.find((f) => f.conversationId);
  assert.ok(filter, 'no conversationId constraint was applied at all');
  assert.deepStrictEqual(filter.conversationId, { $in: ['c1'] });
});

it('A USER IN NO THREADS GETS NOTHING, not everything', async () => {
  reset();
  ACCESSIBLE_CHAT = [];
  const out = await messagingService.searchMessages(USER, { scope: 'chat', query: 'invoice' });
  assert.deepStrictEqual(out.results, []);
  assert.strictEqual(out.total, 0);
  assert.strictEqual(seen.chat.length, 0, 'must not query at all — an empty $in is not an open query');
});

it('never takes the thread set from the caller', async () => {
  reset();
  // A caller trying to widen its own scope.
  await messagingService.searchMessages(USER, {
    scope: 'chat',
    query: 'invoice',
    threadIds: ['c1', 'someone-elses-dm'],
  });
  const filter = seen.chat.find((f) => f.conversationId);
  assert.deepStrictEqual(filter.conversationId, { $in: ['c1'] }, 'a threadIds in the request must be ignored');
});

it('searching one named thread authorizes that thread', async () => {
  reset();
  await assert.rejects(
    () => messagingService.searchMessages(USER, { scope: 'chat', threadId: 'not-mine', query: 'invoice' }),
    (e) => e.status === 403
  );
  assert.strictEqual(seen.chat.length, 0, 'refused before any query ran');
});

it('unrestricted project access omits the id filter rather than listing every project', async () => {
  reset();
  ACCESSIBLE_PROJECTS = null; // admin / projects:manage
  await messagingService.searchMessages(USER, { scope: 'project', query: 'invoice' });
  const filter = seen.project.find((f) => f.message);
  assert.ok(filter, 'no query ran');
  assert.strictEqual(filter.project, undefined, 'an admin must not send every project id as an $in');
});

console.log('\nresults');

it('a bad query is a 400, not a 500', async () => {
  reset();
  await assert.rejects(
    () => messagingService.searchMessages(USER, { scope: 'chat', query: 'a' }),
    (e) => e.status === 400 && e.code === 'BAD_QUERY'
  );
});

it('results carry their own thread id and name, so a mixed list is legible', async () => {
  reset();
  const out = await messagingService.searchMessages(USER, { scope: 'chat', query: 'invoice' });
  const r = out.results[0];
  assert.strictEqual(r.threadId, 'c1');
  assert.strictEqual(r.threadName, 'Design');
  assert.strictEqual(r.scope, 'chat');
  assert.ok(r.snippet.text.includes('invoice'));
});

it('searching everywhere merges both scopes newest-first', async () => {
  reset();
  const out = await messagingService.searchMessages(USER, { scope: 'all', query: 'invoice' });
  assert.strictEqual(out.total, 2, 'totals from both collections');
  assert.deepStrictEqual(out.results.map((r) => r.scope), ['project', 'chat'], 'project row is newer');
});

it('echoes the normalized query back so the client can highlight consistently', async () => {
  reset();
  const out = await messagingService.searchMessages(USER, { scope: 'chat', query: '  invoice  ' });
  assert.strictEqual(out.query, 'invoice');
});

/* ── Report ───────────────────────────────────────────────────────────── */

run().then(() => {
  console.log(`\n${passed}/${passed + failures.length} passed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(({ name, err }) => console.log(`  ${name}\n    ${err.stack}`));
    process.exit(1);
  }
});
