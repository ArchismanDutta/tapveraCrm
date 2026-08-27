// tests/forward-messages.test.js
//
// Message forwarding. Runs standalone:
//
//     node server/tests/forward-messages.test.js
//
// No database — models are stubbed via require.cache before load, same
// technique as messaging-service.test.js.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS PINS DOWN
// ─────────────────────────────────────────────────────────────────────────────
// Forwarding intermittently failed with what users described as a connection
// error. Four separate defects fed into that, and each has a test here.
//
//   1. `clientMsgId: { type: String, default: null }` paired with a
//      `{ unique: true, sparse: true }` index. Sparse skips documents where
//      the field is ABSENT — an explicit `null` is a real indexed value — so
//      the pair allowed exactly ONE message per collection to have no client
//      id. Forwarded copies never set one, so every forward after the first
//      died on E11000 and surfaced as a 500. It looked intermittent only
//      because the index build silently fails on a collection that already
//      holds duplicate nulls, so the constraint exists on some deployments
//      and not others.
//
//   2. Forward wrote copies with no clientMsgId at all, so unlike the normal
//      send path it had no retry safety. A request that timed out client-side
//      but completed server-side duplicated everything when the user pressed
//      the button again — which they always did, having only seen an error.
//
//   3. The notification fan-out ran once per COPY and, inside that, once per
//      MEMBER — with two writes each and a redundant thread-title lookup every
//      time. Forwarding 10 messages to 5 groups of 12 was ~1,100 sequential
//      writes inside the HTTP request, comfortably past the client's 30s
//      timeout.
//
//   4. A destination that no longer existed was `continue`d over, so it
//      appeared in neither `delivered` nor `failed` and the user was told
//      nothing about it at all.
//
// ─────────────────────────────────────────────────────────────────────────────
// AND THE CROSS-SCOPE RULES
// ─────────────────────────────────────────────────────────────────────────────
// Forwarding now spans scopes: a project thread can hand a message to a chat
// GROUP. The policy lives in one table (FORWARD_DESTINATIONS) and one adapter
// veto (forwardDestinationGate), and both are pinned here — chat -> project and
// project -> project must stay refused, and project -> DM must stay refused,
// because a project thread has clients in it.
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

/* ═══════════════════════════════════════════════════════════════════════
   PART 1 — the schema itself
   Requires the real models. mongoose.model() registers a schema without
   needing a connection, so this is a pure shape assertion.
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\nschema — the clientMsgId uniqueness constraint');

const ChatMessageModel = require('../models/ChatMessage');
const MessageModel = require('../models/Message');

const clientMsgIdIndex = (model) =>
  model.schema.indexes().find(([fields]) => Object.keys(fields).join() === 'clientMsgId');

for (const [label, model] of [
  ['ChatMessage', ChatMessageModel],
  ['Message', MessageModel],
]) {
  it(`${label}.clientMsgId has no null default — a null default is what got indexed`, () => {
    const p = model.schema.path('clientMsgId');
    assert.ok(p, 'clientMsgId path missing');
    assert.strictEqual(
      p.options.default,
      undefined,
      'default must be absent so the field is omitted, not stored as null'
    );
  });

  it(`${label} indexes clientMsgId as unique + PARTIAL, never sparse`, () => {
    const found = clientMsgIdIndex(model);
    assert.ok(found, 'no clientMsgId index declared');
    const [, opts] = found;
    assert.strictEqual(opts.unique, true, 'index must stay unique');
    assert.ok(
      !opts.sparse,
      'sparse still indexes an explicit null — that is the bug, use partialFilterExpression'
    );
    assert.deepStrictEqual(
      opts.partialFilterExpression,
      { clientMsgId: { $type: 'string' } },
      'index must be restricted to real (string) client ids'
    );
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   PART 2 — the chat adapter
   ═══════════════════════════════════════════════════════════════════════ */

// A minimal in-memory ChatMessage that behaves like the parts of the model the
// adapter touches, including the unique constraint on clientMsgId.
const store = { docs: [], nextId: 1, createCalls: 0 };

const SOURCES = [
  { _id: 's2', message: 'second', timestamp: 2, attachments: [] },
  {
    _id: 's1',
    message: 'first',
    timestamp: 1,
    attachments: [
      {
        filename: 'a.png',
        url: '/uploads/a.png',
        size: 42,
        mimeType: 'image/png',
        fileType: 'image',
        uploadedAt: 0,
      },
    ],
  },
];

const ChatMessageStub = {
  find: (q) => {
    const wanted = (q?._id?.$in || []).map(String);
    const rows = SOURCES.filter((d) => wanted.includes(String(d._id)));
    let out = rows;
    const p = {
      sort: (spec) => {
        const key = Object.keys(spec)[0];
        out = [...out].sort((a, b) => (a[key] - b[key]) * spec[key]);
        return p;
      },
      lean: () => Promise.resolve(out),
    };
    return p;
  },
  findOne: (q) => {
    const hit = store.docs.find((d) => d.clientMsgId && d.clientMsgId === q.clientMsgId) || null;
    const p = Promise.resolve(hit);
    p.populate = () => p;
    return p;
  },
  create: (doc) => {
    store.createCalls += 1;
    if (doc.clientMsgId && store.docs.some((d) => d.clientMsgId === doc.clientMsgId)) {
      const err = new Error('E11000 duplicate key error');
      err.code = 11000;
      return Promise.reject(err);
    }
    const saved = { ...doc, _id: `m${store.nextId++}` };
    store.docs.push(saved);
    return Promise.resolve(saved);
  },
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
  countDocuments: () => Promise.resolve(0),
  aggregate: () => Promise.resolve([]),
};

// 'dm1' is a one-to-one thread. It is a legal destination for a chat message
// and an illegal one for a project message — that asymmetry is the point.
const CONVERSATIONS = {
  d1: { _id: 'd1', name: 'Design', members: ['u1', 'u2', 'u3'], type: 'group' },
  d2: { _id: 'd2', name: 'Ops', members: ['u1', 'u2', 'u3'], type: 'group' },
  dm1: { _id: 'dm1', name: 'Sahil', members: ['u1', 'u2'], type: 'private' },
};
const ConversationStub = {
  findById: (id) => {
    const hit = CONVERSATIONS[String(id)] || null;
    const p = Promise.resolve(hit);
    p.lean = () => p;
    p.select = () => p;
    p.catch = () => p;
    return p;
  },
  find: () => {
    const p = Promise.resolve([]);
    p.lean = () => p;
    p.select = () => p;
    return p;
  },
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
  aggregate: () => Promise.resolve([]),
};

const noopModel = () => ({
  find: () => { const p = Promise.resolve([]); p.lean = () => p; p.select = () => p; p.sort = () => p; p.skip = () => p; p.limit = () => p; p.populate = () => p; return p; },
  findById: () => { const p = Promise.resolve(null); p.lean = () => p; p.select = () => p; p.populate = () => p; p.catch = () => p; return p; },
  countDocuments: () => Promise.resolve(0),
  aggregate: () => Promise.resolve([]),
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
  create: () => Promise.resolve({}),
});

stub('models/ChatMessage.js', ChatMessageStub);
stub('models/Conversation.js', ConversationStub);
// Project-side source messages. Attachments deliberately carry the two fields
// a ChatMessage does NOT declare, so the narrowing in chatThread is testable.
const PROJECT_SOURCES = [
  {
    _id: 'p2',
    message: 'client asked for the invoice',
    createdAt: 2,
    attachments: [],
  },
  {
    _id: 'p1',
    message: 'brief attached',
    createdAt: 1,
    attachments: [
      {
        filename: 'brief.pdf',
        url: '/uploads/brief.pdf',
        size: 100,
        mimeType: 'application/pdf',
        fileType: 'document',
        uploadedAt: 0,
        isImportant: true,
        s3Key: 'projects/p1/brief.pdf',
      },
    ],
  },
];

stub('models/Message.js', {
  ...noopModel(),
  find: (q) => {
    const wanted = (q?._id?.$in || []).map(String);
    let out = PROJECT_SOURCES.filter((d) => wanted.includes(String(d._id)));
    const p = {
      sort: (spec) => {
        const key = Object.keys(spec)[0];
        out = [...out].sort((a, b) => (a[key] - b[key]) * spec[key]);
        return p;
      },
      lean: () => Promise.resolve(out),
    };
    return p;
  },
});
stub('models/Project.js', noopModel());
stub('models/User.js', noopModel());
stub('models/Client.js', noopModel());
stub('utils/accessControl.js', { can: async () => false, scopeQuery: async (q) => q });
stub('utils/hierarchyUtils.js', { getAccessibleUserIds: async () => [] });

// Notifications: record the calls rather than writing anything.
const notifyCalls = [];
stub('services/notificationService.js', {
  notifyUsers: async (userIds, payload) => {
    notifyCalls.push({ userIds: [...userIds], payload });
    return userIds.map((u, i) => ({ _id: `n${i}`, userId: u }));
  },
  createAndSend: async (payload) => {
    notifyCalls.push({ userIds: [payload.userId], payload, perMember: true });
    return { _id: 'n' };
  },
});

// Push is fire-and-forget and resolves after the assertions have run, so an
// unstubbed pushPolicy prints Mongoose cast errors AFTER the summary line.
// Stubbing it also keeps "not awaited" honest: if the service ever started
// awaiting this, the suppressed-count assertions would be the ones to change.
stub('services/messaging/pushPolicy.js', {
  shouldPush: async () => ({ push: false, reason: 'stubbed_in_test' }),
  shouldPushGeneral: async () => ({ push: false, reason: 'stubbed_in_test' }),
  stillUnread: async () => false,
});

// Access: allow everything except the one thread used to prove partial failure.
class FakeAccessError extends Error {
  constructor(message, status = 403, code = 'FORBIDDEN') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
stub('services/messaging/access.js', {
  AccessError: FakeAccessError,
  // Returns the loaded conversation, exactly as the real one does — that is
  // what lets forwardDestinationGate check the thread type without a second
  // query, so the stub has to honour it or the test proves nothing.
  assertChatAccess: async (user, id) => {
    if (String(id) === 'nope') throw new FakeAccessError('You are not a member of this conversation');
    return {
      conversation: CONVERSATIONS[String(id)] || { _id: String(id) },
      isMember: true,
      isCreator: false,
    };
  },
  assertProjectChatAccess: async () => ({}),
  sendAccessError: () => {},
  isAdmin: () => false,
});

const chatThread = require('../services/messaging/adapters/chatThread');
const projectThread = require('../services/messaging/adapters/projectThread');
const messagingService = require('../services/messaging/messaging.service');

/** The adapter pair the service composes for a same-scope chat forward. */
const forwardChatToChat = async (user, messageIds, destThreadIds, token) => {
  const sources = await chatThread.readForForward(messageIds);
  return chatThread.createForwardedCopies(user, sources, destThreadIds, token);
};

const USER = { _id: 'u1', name: 'Ana' };
const reset = () => {
  store.docs = [];
  store.nextId = 1;
  store.createCalls = 0;
  notifyCalls.length = 0;
};

console.log('\nadapter — copies and idempotency');

it('copies every source into every destination, oldest first', async () => {
  reset();
  const { copies } = await forwardChatToChat(USER, ['s1', 's2'], ['d1', 'd2'], 'tok');
  assert.strictEqual(copies.length, 4, 'expected 2 messages x 2 destinations');
  assert.deepStrictEqual(
    copies.filter((c) => c.threadId === 'd1').map((c) => c.raw.message),
    ['first', 'second'],
    'a multi-message forward must land in the order it was originally said'
  );
});

it('marks copies as forwarded and carries the attachments over', async () => {
  reset();
  const { copies } = await forwardChatToChat(USER, ['s1'], ['d1'], 'tok');
  assert.strictEqual(copies[0].raw.forwarded, true);
  assert.deepStrictEqual(copies[0].raw.attachments, [
    {
      filename: 'a.png',
      url: '/uploads/a.png',
      size: 42,
      mimeType: 'image/png',
      fileType: 'image',
      uploadedAt: 0,
    },
  ]);
});

it('drops the source mention list — forwarding must not @ anyone', async () => {
  reset();
  const { copies } = await forwardChatToChat(USER, ['s1'], ['d1'], 'tok');
  assert.deepStrictEqual(copies[0].raw.mentions, []);
});

it('derives a clientMsgId per (token, destination, source)', async () => {
  reset();
  const { copies } = await forwardChatToChat(USER, ['s1', 's2'], ['d1', 'd2'], 'tok');
  const seen = copies.map((c) => c.raw.clientMsgId);
  assert.strictEqual(new Set(seen).size, 4, 'every copy needs its own id');
  assert.ok(seen.includes('fwd:tok:d1:s1'), `unexpected ids: ${seen.join(', ')}`);
});

it('RETRY WITH THE SAME TOKEN WRITES NOTHING NEW — this is the duplicate bug', async () => {
  reset();
  await forwardChatToChat(USER, ['s1', 's2'], ['d1', 'd2'], 'tok');
  const afterFirst = store.docs.length;

  const { copies } = await forwardChatToChat(USER, ['s1', 's2'], ['d1', 'd2'], 'tok');
  assert.strictEqual(store.docs.length, afterFirst, 'a retry must not create twins');
  assert.strictEqual(copies.length, 4, 'the retry still reports what landed');
});

it('a NEW token forwards the same messages again — deliberate re-forward still works', async () => {
  reset();
  await forwardChatToChat(USER, ['s1'], ['d1'], 'tok-a');
  await forwardChatToChat(USER, ['s1'], ['d1'], 'tok-b');
  assert.strictEqual(store.docs.length, 2, 'a second, separate forward is a real second message');
});

it('recovers from a concurrent E11000 by reading back the winner', async () => {
  reset();
  // Pre-seed the exact document a racing request would have written, but hide
  // it from findOne so the adapter goes to create() and loses the race.
  const realFindOne = ChatMessageStub.findOne;
  let firstLookup = true;
  ChatMessageStub.findOne = (q) => {
    if (firstLookup) {
      firstLookup = false;
      const p = Promise.resolve(null);
      p.populate = () => p;
      return p;
    }
    return realFindOne(q);
  };
  store.docs.push({ _id: 'racer', clientMsgId: 'fwd:tok:d1:s1', message: 'first' });

  try {
    const { copies } = await forwardChatToChat(USER, ['s1'], ['d1'], 'tok');
    assert.strictEqual(copies.length, 1);
    assert.strictEqual(copies[0].raw._id, 'racer', 'must return the winner, not 500');
  } finally {
    ChatMessageStub.findOne = realFindOne;
  }
});

it('reports a destination that no longer exists instead of skipping it', async () => {
  reset();
  const { copies, missing } = await forwardChatToChat(USER, ['s1'], ['d1', 'gone'], 'tok');
  assert.deepStrictEqual(missing, ['gone']);
  assert.strictEqual(copies.length, 1);
});

/* ═══════════════════════════════════════════════════════════════════════
   PART 3 — the service
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\nservice — authorization, reporting and notification cost');

it('sends ONE notification batch per destination, not one per copied message', async () => {
  reset();
  await messagingService.forwardMessages(USER, 'chat', 'src', ['s1', 's2'], ['d1', 'd2'], 'tok');

  assert.strictEqual(
    notifyCalls.length,
    2,
    `expected 1 batch per destination, got ${notifyCalls.length} — this is the timeout`
  );
  assert.ok(
    !notifyCalls.some((c) => c.perMember),
    'must not fall back to the per-member createAndSend loop'
  );
});

it('one batch covers every member at once (insertMany, not N round trips)', async () => {
  reset();
  await messagingService.forwardMessages(USER, 'chat', 'src', ['s1'], ['d1'], 'tok');
  assert.deepStrictEqual(
    notifyCalls[0].userIds,
    ['u2', 'u3'],
    'every recipient in one call, and never the sender'
  );
});

it('says how many messages were forwarded rather than sending a burst', async () => {
  reset();
  await messagingService.forwardMessages(USER, 'chat', 'src', ['s1', 's2'], ['d1'], 'tok');
  assert.match(notifyCalls[0].payload.title, /forwarded 2 messages/);
});

it('reports a vanished destination in `failed` — it used to vanish silently', async () => {
  reset();
  const res = await messagingService.forwardMessages(
    USER,
    'chat',
    'src',
    ['s1'],
    ['d1', 'gone'],
    'tok'
  );
  assert.strictEqual(res.delivered.length, 1);
  assert.deepStrictEqual(
    res.failed.map((f) => f.threadId),
    ['gone']
  );
});

it('partial success: an unauthorized destination fails without losing the rest', async () => {
  reset();
  const res = await messagingService.forwardMessages(
    USER,
    'chat',
    'src',
    ['s1'],
    ['d1', 'nope'],
    'tok'
  );
  assert.strictEqual(res.delivered.length, 1, 'the allowed destination still receives it');
  assert.strictEqual(res.failed.length, 1);
  assert.match(res.failed[0].reason, /not a member/);
});

it('writes nothing at all when no destination is writable', async () => {
  reset();
  const res = await messagingService.forwardMessages(USER, 'chat', 'src', ['s1'], ['nope'], 'tok');
  assert.deepStrictEqual(res.delivered, []);
  assert.strictEqual(store.createCalls, 0, 'authorization is checked BEFORE any write');
});

it('an unknown source scope is a 400 AccessError, not a bare 500', async () => {
  reset();
  await assert.rejects(
    () => messagingService.forwardMessages(USER, 'nonsense', 'src', ['s1'], ['d1'], 'tok'),
    (err) => err.status === 400 && err.code === 'UNSUPPORTED'
  );
});

/* ═══════════════════════════════════════════════════════════════════════
   PART 4 — crossing scopes
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\ncross-scope — project messages into chat groups');

it('both adapters read sources into the SAME shape', async () => {
  const fromChat = await chatThread.readForForward(['s1']);
  const fromProject = await projectThread.readForForward(['p1']);
  assert.deepStrictEqual(
    Object.keys(fromChat[0]).sort(),
    Object.keys(fromProject[0]).sort(),
    'the service pairs any source adapter with any destination adapter — the shapes must match'
  );
});

it('project sources come back oldest-first on createdAt', async () => {
  const rows = await projectThread.readForForward(['p1', 'p2']);
  assert.deepStrictEqual(rows.map((r) => r.body), [
    'brief attached',
    'client asked for the invoice',
  ]);
});

it('forwards a project message into a chat group', async () => {
  reset();
  const res = await messagingService.forwardMessages(
    USER,
    'project',
    'proj1',
    ['p1'],
    ['d1'],
    'tok'
  );
  assert.strictEqual(res.delivered.length, 1);
  assert.deepStrictEqual(res.failed, []);
  assert.strictEqual(store.docs[0].conversationId, 'd1', 'the copy lives in the chat thread');
  assert.strictEqual(store.docs[0].message, 'brief attached');
  assert.strictEqual(store.docs[0].forwarded, true);
});

it('REFUSES a project message into a DM, and says why', async () => {
  reset();
  const res = await messagingService.forwardMessages(
    USER,
    'project',
    'proj1',
    ['p1'],
    ['dm1'],
    'tok'
  );
  assert.deepStrictEqual(res.delivered, []);
  assert.strictEqual(store.createCalls, 0, 'refused BEFORE anything is written');
  assert.match(res.failed[0].reason, /group chats/);
});

it('a mixed batch delivers to the group and refuses only the DM', async () => {
  reset();
  const res = await messagingService.forwardMessages(
    USER,
    'project',
    'proj1',
    ['p1'],
    ['d1', 'dm1'],
    'tok'
  );
  assert.strictEqual(res.delivered.length, 1);
  assert.deepStrictEqual(res.failed.map((f) => f.threadId), ['dm1']);
});

it('a DM is still a fine destination for a CHAT message', async () => {
  reset();
  const res = await messagingService.forwardMessages(USER, 'chat', 'src', ['s1'], ['dm1'], 'tok');
  assert.strictEqual(res.delivered.length, 1, 'chat -> chat must be unaffected by the project rule');
});

it('strips isImportant and s3Key — a copy must not own the original\'s file', async () => {
  reset();
  await messagingService.forwardMessages(USER, 'project', 'proj1', ['p1'], ['d1'], 'tok');
  const [att] = store.docs[0].attachments;
  assert.strictEqual(att.filename, 'brief.pdf', 'the file itself is carried over');
  assert.strictEqual(att.s3Key, undefined, 's3Key would let the copy authorise a delete');
  assert.strictEqual(att.isImportant, undefined, 'a project-only concept');
});

it('the scope table refuses chat -> project and project -> project', () => {
  assert.deepStrictEqual(messagingService.FORWARD_DESTINATIONS.chat, ['chat']);
  assert.deepStrictEqual(
    messagingService.FORWARD_DESTINATIONS.project,
    ['chat'],
    'a project must never be a forward DESTINATION — it has clients in it'
  );
});

it('project threads have no writer, so they cannot become a destination by accident', () => {
  assert.strictEqual(
    typeof projectThread.createForwardedCopies,
    'undefined',
    'adding this without also adding the scope-table entry must not be enough'
  );
});

it('the notification lands in the DESTINATION scope, not the source', async () => {
  reset();
  await messagingService.forwardMessages(USER, 'project', 'proj1', ['p1'], ['d1'], 'tok');
  assert.ok(
    notifyCalls[0].payload.relatedData.conversationId,
    'a project source must still deep-link to the chat conversation the copy is in'
  );
  assert.strictEqual(notifyCalls[0].payload.relatedData.projectId, undefined);
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
