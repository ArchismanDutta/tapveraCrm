// tests/messaging-service.test.js
//
// Phase 1 verification: the shared mention resolver, adapter interface parity,
// and the realtime dual-emit contract. Runs standalone:
//
//     node server/tests/messaging-service.test.js
//
// No database — models are stubbed via require.cache before load, same
// technique as messaging-access.test.js.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

const noopModel = () => ({
  find: () => { const p = Promise.resolve([]); p.lean = () => p; p.select = () => p; p.sort = () => p; p.skip = () => p; p.limit = () => p; p.populate = () => p; return p; },
  findById: () => { const p = Promise.resolve(null); p.lean = () => p; p.select = () => p; p.populate = () => p; p.catch = () => p; return p; },
  countDocuments: () => Promise.resolve(0),
  aggregate: () => Promise.resolve([]),
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
  create: () => Promise.resolve({}),
});

stub('models/ChatMessage.js', noopModel());
stub('models/Conversation.js', noopModel());
stub('models/Message.js', noopModel());
stub('models/Project.js', noopModel());
stub('models/User.js', noopModel());
stub('models/Client.js', noopModel());
stub('utils/accessControl.js', { can: async () => false, scopeQuery: async (q) => q });
stub('utils/hierarchyUtils.js', { getAccessibleUserIds: async () => [] });

const { resolveMentions, findMentionedCandidates } = require('../services/messaging/mentions');
const messagingService = require('../services/messaging/messaging.service');
const realtime = require('../services/messaging/realtime');

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

/* ── Mentions ─────────────────────────────────────────────────────────── */

const MEMBERS = [
  { _id: 'u1', name: 'Anish', kind: 'User' },
  { _id: 'u2', name: 'Sahil', kind: 'User' },
  { _id: 'u3', name: 'Sahil Kumar', kind: 'User' },
  { _id: 'c1', name: 'Acme Corp', kind: 'Client' },
];
const AUTHOR = 'u9';

const ids = (text) =>
  resolveMentions(text, { members: MEMBERS, authorId: AUTHOR }).map((m) => m.id).sort();

console.log('\nmentions (the bug the project side still had)');

it('mention followed by more words resolves — the old regex dropped this', () =>
  assert.deepStrictEqual(ids('@Anish please review this'), ['u1']));

it('mention at end of message resolves', () =>
  assert.deepStrictEqual(ids('can you look, @Anish'), ['u1']));

it('longest name wins — "Sahil Kumar" does not also match "Sahil"', () =>
  assert.deepStrictEqual(ids('@Sahil Kumar ping'), ['u3']));

it('bare "@Sahil" still matches the shorter name', () =>
  assert.deepStrictEqual(ids('@Sahil ping'), ['u2']));

it('two distinct mentions both resolve', () =>
  assert.deepStrictEqual(ids('@Anish and @Sahil look'), ['u1', 'u2']));

it('email address is not a mention', () =>
  assert.deepStrictEqual(ids('mail ops@Anish.com please'), []));

it('mentioning the same person twice pings once', () =>
  assert.deepStrictEqual(ids('@Anish @Anish'), ['u1']));

it('@everyone expands to all members except the author', () =>
  assert.deepStrictEqual(ids('@everyone standup'), ['c1', 'u1', 'u2', 'u3']));

it('author never mentions themselves via @everyone', () => {
  const out = resolveMentions('@everyone', { members: [...MEMBERS, { _id: AUTHOR, name: 'Me' }], authorId: AUTHOR });
  assert.ok(!out.some((m) => m.id === AUTHOR));
});

it('clients are mentionable and keep their kind', () => {
  const out = resolveMentions('@Acme Corp hi', { members: MEMBERS, authorId: AUTHOR });
  assert.deepStrictEqual(out, [{ id: 'c1', kind: 'Client' }]);
});

it('non-member is never resolved (project side searched globally before)', () =>
  assert.deepStrictEqual(ids('@Stranger hello'), []));

it('text with no @ short-circuits', () =>
  assert.deepStrictEqual(ids('no mentions here'), []));

it('candidate list without names does not throw', () =>
  assert.deepStrictEqual(findMentionedCandidates('@x', [{ _id: 'a' }]), []));

/* ── Adapter parity ───────────────────────────────────────────────────── */

console.log('\nadapter interface parity');

const REQUIRED = [
  'SCOPE', 'normalize', 'getMemberIds', 'listThreads',
  'getMessages', 'unreadCounts', 'markRead', 'sendMessage', 'react',
];

const chat = messagingService.adapterFor('chat');
const project = messagingService.adapterFor('project');

REQUIRED.forEach((method) => {
  it(`both adapters implement ${method}`, () => {
    assert.ok(chat[method] !== undefined, `chat adapter missing ${method}`);
    assert.ok(project[method] !== undefined, `project adapter missing ${method}`);
  });
});

it('unknown scope is rejected, not silently defaulted', () => {
  assert.throws(() => messagingService.adapterFor('nope'), /Unknown messaging scope/);
});

/* ── Normalization ────────────────────────────────────────────────────── */

console.log('\nnormalization across two different schemas');

const chatDoc = {
  _id: 'm1',
  conversationId: 'conv1',
  senderId: { _id: 'u1', name: 'Anish' },
  message: 'hello',
  timestamp: new Date('2026-01-01T00:00:00Z'),
  readBy: ['u1', 'u2'],
  mentions: ['u2'],
  reactions: [{ emoji: '👍', users: ['u2'] }],
  attachments: [],
};

const projectDoc = {
  _id: 'm2',
  project: 'proj1',
  sentBy: { _id: 'c1', clientName: 'Acme Corp' },
  senderModel: 'Client',
  message: 'hello',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  readBy: [{ user: 'u1', userModel: 'User', readAt: new Date() }],
  mentions: [{ user: 'u2', userModel: 'User' }],
  reactions: [{ emoji: '👍', users: [{ user: 'u2', userModel: 'User' }] }],
  attachments: [],
  isPinned: true,
};

const a = chat.normalize(chatDoc);
const b = project.normalize(projectDoc);

it('both produce the same key set', () =>
  assert.deepStrictEqual(Object.keys(a).sort(), Object.keys(b).sort()));

it('chat: string ids and flat readBy normalize correctly', () => {
  assert.strictEqual(a.threadId, 'conv1');
  assert.strictEqual(a.scope, 'chat');
  assert.deepStrictEqual(a.sender, { id: 'u1', name: 'Anish', kind: 'User' });
  assert.deepStrictEqual(a.readBy, [{ id: 'u1', at: null }, { id: 'u2', at: null }]);
  assert.deepStrictEqual(a.mentions, [{ id: 'u2', kind: 'User' }]);
  assert.deepStrictEqual(a.reactions, [{ emoji: '👍', users: ['u2'] }]);
});

it('project: ObjectId refs, polymorphic sender and subdoc readBy normalize identically', () => {
  assert.strictEqual(b.threadId, 'proj1');
  assert.strictEqual(b.scope, 'project');
  assert.strictEqual(b.sender.kind, 'Client');
  assert.strictEqual(b.sender.name, 'Acme Corp', 'clientName must fall back into name');
  assert.deepStrictEqual(b.mentions, [{ id: 'u2', kind: 'User' }]);
  assert.deepStrictEqual(b.reactions, [{ emoji: '👍', users: ['u2'] }]);
  assert.strictEqual(b.pinned, true);
});

it('normalize(null) is null, not a throw', () => {
  assert.strictEqual(chat.normalize(null), null);
  assert.strictEqual(project.normalize(null), null);
});

/* ── Realtime contract ────────────────────────────────────────────────── */

console.log('\nrealtime dual-emit');

it('room naming differs per scope', () => {
  assert.strictEqual(realtime.roomOf('chat', 'x'), 'conversation:x');
  assert.strictEqual(realtime.roomOf('project', 'x'), 'project:x');
});

it('emit is best-effort — no socket server must not throw', () => {
  // getIO() throws when Socket.IO isn't initialized; realtime must swallow it,
  // because a transport problem may never fail the DB write that triggered it.
  assert.doesNotThrow(() => {
    realtime.emitMessage({ scope: 'chat', threadId: 't', message: {}, legacy: {} });
    realtime.emitReceipt({ scope: 'project', threadId: 't', messageId: 'm', userId: 'u', kind: 'read' });
    realtime.emitUpdated({ scope: 'project', threadId: 't', patch: { pinned: true } });
    realtime.emitConversationChanged(['u1'], { action: 'created' });
  });
});

/* ── Report ───────────────────────────────────────────────────────────── */

const total = passed + failures.length;
console.log(`\n${passed}/${total} passed`);
if (failures.length) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f.name}: ${f.err.message}`));
  process.exit(1);
}
