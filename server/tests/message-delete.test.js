// tests/message-delete.test.js
//
// Deleting messages. Runs standalone:
//
//     node server/tests/message-delete.test.js
//
// No database — the two rule functions are pure, and the mode/authorization
// wiring is exercised against stubbed adapters.
//
// ─────────────────────────────────────────────────────────────────────────────
// TWO OPERATIONS, DELIBERATELY NOT ONE
// ─────────────────────────────────────────────────────────────────────────────
//   "delete for me"       hides it from one person. Any message they can see,
//                         no window, nobody else affected or told.
//   "delete for everyone" RETRACTS it. Sender only, inside 7 minutes, body and
//                         attachments cleared from the document.
//
// The rules that matter and are easy to erode:
//   - ownership is checked BEFORE the window, so someone else's message never
//     leaks whether its window is open;
//   - the window is a hard boundary, not a suggestion;
//   - a retraction leaves a TOMBSTONE, so replies and ordering survive;
//   - a retraction actually clears the content — hiding it client-side would
//     leave the text and attachment URLs in the API response, which is
//     worthless for the case this exists for.
'use strict';

const path = require('path');
const assert = require('assert');

const resolve = (rel) => require.resolve(path.join(__dirname, '..', rel));
const stub = (rel, exports_) => {
  const id = resolve(rel);
  require.cache[id] = { id, filename: id, loaded: true, exports: exports_ };
};

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

/* ═══════════ PART 0 — the schema must ALLOW a tombstone ═══════════
   Requires the REAL models, before the stubs below replace them.

   This is the bug that shipped: `Message.message` was `required: true`, so
   clearing the body and saving failed validation with "Path `message` is
   required" — and because a ValidationError is not an AccessError it fell
   through the route's outer catch as an opaque 500, "Could not delete that
   message." Chat was unaffected (ChatMessage declares `default: ""` and no
   required flag), so retraction worked in chat and failed only on project
   threads, which is a very easy shape of bug to miss.                        */

const mongoose = require('mongoose');
const RealMessage = require('../models/Message');
const RealChatMessage = require('../models/ChatMessage');

const oid = () => new mongoose.Types.ObjectId();
const bodyError = (doc) => doc.validateSync()?.errors?.message?.message || null;
const projectDoc = (over) =>
  new RealMessage({ project: oid(), sentBy: oid(), senderModel: 'User', senderType: 'employee', ...over });

console.log('\nschema — a retracted message has no body, and that must be legal');

it('project: a RETRACTED message validates with an empty body', () => {
  assert.strictEqual(
    bodyError(projectDoc({ message: '', deletedForEveryone: true })),
    null,
    'this is the 500: clearing the body must not fail validation'
  );
});

it('project: an ordinary empty message is STILL refused', () => {
  // The relaxation is conditional on purpose — it must not become a licence
  // to create blank messages.
  assert.ok(bodyError(projectDoc({ message: '' })), 'the constraint should still hold for real messages');
});

it('project: a normal message with text validates', () => {
  assert.strictEqual(bodyError(projectDoc({ message: 'hello' })), null);
});

it('chat: a retracted message validates (this scope was always fine)', () => {
  const doc = new RealChatMessage({ conversationId: 'c1', senderId: 'u1', message: '', deletedForEveryone: true });
  assert.strictEqual(bodyError(doc), null);
});

const noop = () => {
  const p = Promise.resolve(null);
  p.lean = () => p; p.select = () => p; p.populate = () => p; p.sort = () => p; p.limit = () => p; p.catch = () => p;
  return p;
};
const noopModel = () => ({
  find: () => { const p = Promise.resolve([]); p.lean = () => p; p.select = () => p; p.sort = () => p; p.limit = () => p; p.skip = () => p; p.populate = () => p; return p; },
  findById: noop, findOne: noop, countDocuments: () => Promise.resolve(0),
  updateOne: () => Promise.resolve({}), updateMany: () => Promise.resolve({}), aggregate: () => Promise.resolve([]), create: () => Promise.resolve({}),
});

stub('models/ChatMessage.js', noopModel());
stub('models/Conversation.js', noopModel());
stub('models/Message.js', noopModel());
stub('models/Project.js', noopModel());
stub('models/User.js', noopModel());
stub('models/Client.js', noopModel());
stub('utils/accessControl.js', { can: async () => false, scopeQuery: async (q) => q });
stub('utils/hierarchyUtils.js', { getAccessibleUserIds: async () => [] });

const chatThread = require('../services/messaging/adapters/chatThread');
const projectThread = require('../services/messaging/adapters/projectThread');

const MINUTE = 60 * 1000;
const NOW = 1_700_000_000_000;
const chatMsg = (over = {}) => ({ _id: 'm1', senderId: 'u1', timestamp: new Date(NOW), ...over });
const projMsg = (over = {}) => ({ _id: 'p1', sentBy: 'u1', createdAt: new Date(NOW), ...over });

/* ═══════════ the rules ═══════════ */

console.log('\ndeletability — who may retract, and until when');

for (const [label, adapter, make] of [['chat', chatThread, chatMsg], ['project', projectThread, projMsg]]) {
  it(`${label}: the sender can retract immediately`, () => {
    assert.strictEqual(adapter.deletability(make(), 'u1', NOW).ok, true);
  });

  it(`${label}: still allowed at 6m59s`, () => {
    assert.strictEqual(adapter.deletability(make(), 'u1', NOW + 7 * MINUTE - 1000).ok, true);
  });

  it(`${label}: REFUSED just past 7 minutes`, () => {
    const r = adapter.deletability(make(), 'u1', NOW + 7 * MINUTE + 1000);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.reason, 'WINDOW_EXPIRED');
    assert.strictEqual(r.status, 403);
  });

  it(`${label}: someone else's message is refused as NOT_SENDER, never WINDOW_EXPIRED`, () => {
    // Ordering matters: answering "window expired" for a message that was
    // never theirs tells them it exists and when it was sent.
    const r = adapter.deletability(make(), 'someone-else', NOW + 999 * MINUTE);
    assert.strictEqual(r.reason, 'NOT_SENDER');
  });

  it(`${label}: a missing message is 404, not a crash`, () => {
    assert.deepStrictEqual(adapter.deletability(null, 'u1', NOW), { ok: false, reason: 'NOT_FOUND', status: 404 });
  });

  it(`${label}: an already-retracted message cannot be retracted twice`, () => {
    const r = adapter.deletability(make({ deletedForEveryone: true }), 'u1', NOW);
    assert.strictEqual(r.reason, 'ALREADY_DELETED');
    assert.strictEqual(r.status, 409);
  });

  it(`${label}: an unreadable timestamp is refused rather than treated as new`, () => {
    const r = adapter.deletability(make({ timestamp: 'nonsense', createdAt: 'nonsense' }), 'u1', NOW);
    assert.strictEqual(r.reason, 'NO_TIMESTAMP');
  });
}

it('project: a CLIENT can retract their own message', () => {
  // sentBy is polymorphic; a client retracting their own post is as valid as
  // an employee doing it, and this is the thread clients actually post in.
  assert.strictEqual(projectThread.deletability(projMsg({ sentBy: { _id: 'c9' } }), 'c9', NOW).ok, true);
});

it('the two scopes agree on the window', () => {
  assert.strictEqual(chatThread.DELETE_WINDOW_MS, projectThread.DELETE_WINDOW_MS);
  assert.strictEqual(chatThread.DELETE_WINDOW_MS, 7 * MINUTE);
});

/* ═══════════ the tombstone ═══════════ */

console.log('\nnormalize — what a retracted message looks like on the wire');

it('a retracted chat message emits no body and no attachments', () => {
  const out = chatThread.normalize({
    _id: 'm1', conversationId: 'c1', senderId: 'u1',
    message: 'the thing I should not have sent',
    attachments: [{ filename: 'contract.pdf', url: '/uploads/contract.pdf' }],
    deletedForEveryone: true, deletedAt: new Date(NOW), timestamp: new Date(NOW),
  });
  assert.strictEqual(out.body, '', 'the text must not go out');
  assert.deepStrictEqual(out.attachments, [], 'the file must not go out either');
  assert.strictEqual(out.deleted, true);
  assert.ok(out.deletedAt, 'clients need to know when, to render it');
});

it('the tombstone keeps its id and timestamp, so replies and ordering survive', () => {
  const out = chatThread.normalize({
    _id: 'm1', conversationId: 'c1', senderId: 'u1', message: '',
    deletedForEveryone: true, timestamp: new Date(NOW),
  });
  assert.strictEqual(out.id, 'm1');
  assert.strictEqual(out.threadId, 'c1');
  assert.ok(out.createdAt, 'a tombstone with no timestamp would sort to the top of the thread');
});

it('an ordinary message is unaffected', () => {
  const out = chatThread.normalize({
    _id: 'm2', conversationId: 'c1', senderId: 'u1', message: 'still here',
    attachments: [{ filename: 'a.png' }], timestamp: new Date(NOW),
  });
  assert.strictEqual(out.body, 'still here');
  assert.strictEqual(out.deleted, false);
  assert.strictEqual(out.attachments.length, 1);
});

it('both adapters emit the same delete keys — the shapes must not drift', () => {
  const a = chatThread.normalize({ _id: 'm', conversationId: 'c', senderId: 'u', message: 'x', timestamp: new Date(NOW) });
  const b = projectThread.normalize({ _id: 'p', project: 'pr', sentBy: 'u', message: 'x', createdAt: new Date(NOW) });
  for (const key of ['deleted', 'deletedAt']) {
    assert.ok(key in a, `chat is missing ${key}`);
    assert.ok(key in b, `project is missing ${key}`);
  }
});

/* ═══════════ mode + authorization ═══════════ */

console.log('\nservice — modes and the authorization each one needs');

class FakeAccessError extends Error {
  constructor(message, status = 403, code = 'FORBIDDEN') { super(message); this.status = status; this.code = code; }
}
const authCalls = [];
stub('services/messaging/access.js', {
  AccessError: FakeAccessError,
  assertChatAccess: async (u, id, action) => {
    authCalls.push(action);
    if (action === 'write' && id === 'read-only-thread') throw new FakeAccessError('No longer a member');
    return { conversation: { _id: id, type: 'group' }, isMember: true };
  },
  assertProjectChatAccess: async (u, id, action) => { authCalls.push(action); return { project: { _id: id } }; },
  accessibleConversationIds: async () => [], accessibleProjectIds: async () => [],
  sendAccessError: () => {}, isAdmin: () => false,
});

const emitted = [];
stub('services/messaging/realtime.js', {
  SCOPES: { CHAT: 'chat', PROJECT: 'project' },
  roomOf: () => 'room',
  emitMessage: () => {}, emitReceipt: () => {},
  emitUpdated: (a) => emitted.push({ kind: 'room', ...a }),
  emitUpdatedToUsers: (ids, a) => emitted.push({ kind: 'users', ids, ...a }),
  emitConversationChanged: () => {}, emitTyping: () => {},
  evictFromThread: () => {}, closeThreadRoom: () => {},
});

const messagingService = require('../services/messaging/messaging.service');

// Drive the adapter through the service without a database.
chatThread.deleteForMe = async () => ({ threadId: 't1', messageId: 'm1', mode: 'me' });
chatThread.deleteForEveryone = async () => ({
  threadId: 't1', messageId: 'm1', mode: 'everyone',
  raw: {}, normalized: { deletedAt: new Date(NOW) },
});
chatThread.getMemberIds = async () => ['u1', 'u2'];

const USER = { _id: 'u1' };
const reset = () => { authCalls.length = 0; emitted.length = 0; };

it('rejects a mode that is neither me nor everyone', async () => {
  reset();
  await assert.rejects(
    () => messagingService.deleteMessage(USER, 'chat', 'm1', 'everybody'),
    (e) => e.status === 400 && e.code === 'BAD_MODE'
  );
});

it('"me" needs only READ — you cannot hide what you were never shown', async () => {
  reset();
  await messagingService.deleteMessage(USER, 'chat', 'm1', 'me');
  assert.deepStrictEqual(authCalls, ['read']);
});

it('"everyone" needs WRITE — someone removed from the group cannot reach back in', async () => {
  reset();
  await messagingService.deleteMessage(USER, 'chat', 'm1', 'everyone');
  assert.deepStrictEqual(authCalls, ['write']);
});

it('"me" is broadcast ONLY to that user, never the thread', async () => {
  reset();
  await messagingService.deleteMessage(USER, 'chat', 'm1', 'me');
  assert.strictEqual(emitted.length, 1);
  assert.strictEqual(emitted[0].kind, 'users', 'telling the room would hide it from everyone');
  assert.deepStrictEqual(emitted[0].ids, ['u1']);
  assert.strictEqual(emitted[0].patch.removed, true);
});

it('"everyone" is broadcast to the whole thread as a tombstone patch', async () => {
  reset();
  await messagingService.deleteMessage(USER, 'chat', 'm1', 'everyone');
  assert.strictEqual(emitted[0].kind, 'room');
  const patch = emitted[0].patch;
  assert.strictEqual(patch.deleted, true);
  assert.strictEqual(patch.body, '');
  assert.strictEqual(patch.message, '', 'both key spellings, as editMessage sends');
  assert.deepStrictEqual(patch.attachments, []);
});

it('a refusal from the adapter is returned as data, not thrown', async () => {
  reset();
  chatThread.deleteForEveryone = async () => ({ error: 'WINDOW_EXPIRED', status: 403 });
  const out = await messagingService.deleteMessage(USER, 'chat', 'm1', 'everyone');
  assert.strictEqual(out.error, 'WINDOW_EXPIRED');
  assert.strictEqual(emitted.length, 0, 'nothing may be broadcast for a refused delete');
});

run().then(() => {
  console.log(`\n${passed}/${passed + failures.length} passed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach(({ name, err }) => console.log(`  ${name}\n    ${err.stack}`));
    process.exit(1);
  }
});
