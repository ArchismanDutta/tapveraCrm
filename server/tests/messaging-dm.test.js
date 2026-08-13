// tests/messaging-dm.test.js
//
// Direct messages: the thread list must return them alongside groups, name
// them per-viewer, and the directory must join existing threads onto the
// roster. Runs standalone:
//
//     node server/tests/messaging-dm.test.js
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

const ME = 'me-1';
const PEER = 'peer-1';
const OTHER = 'peer-2';

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const CONVERSATIONS = [
  {
    _id: 'g1',
    type: 'group',
    name: 'Marketing',
    members: [ME, PEER, OTHER],
    createdAt: new Date('2026-01-01'),
  },
  {
    _id: 'd1',
    type: 'private',
    name: undefined,
    members: [ME, PEER],
    createdAt: new Date('2026-02-01'),
  },
];

const USERS = [
  { _id: ME, name: 'Me', role: 'employee', status: 'active' },
  { _id: PEER, name: 'Priya', role: 'employee', status: 'active' },
  { _id: OTHER, name: 'Arjun', role: 'admin', status: 'active' },
];

// Minimal query-builder mimicry — enough for the chained .lean()/.select()
// calls the adapter makes, without pulling in mongoose.
const thenable = (value) => {
  const p = Promise.resolve(value);
  p.lean = () => p;
  p.select = () => p;
  p.sort = () => p;
  p.populate = () => p;
  return p;
};

stub('models/Conversation.js', {
  find: (query = {}) => {
    // The adapter asks for "every conversation I'm a member of"; the
    // directory asks for "my private ones". Distinguish on the type filter so
    // one stub serves both callers.
    let rows = CONVERSATIONS.filter((c) => (c.members || []).includes(query.members));
    if (query.type) rows = rows.filter((c) => c.type === query.type);
    return thenable(
      rows.map((c) => ({ ...c, toObject: () => ({ ...c }) }))
    );
  },
  findOne: () => thenable(null),
});

stub('models/User.js', {
  find: (query = {}) => {
    const wanted = query?._id?.$in;
    let rows = USERS;
    if (wanted) rows = rows.filter((u) => wanted.map(String).includes(String(u._id)));
    if (query?._id?.$ne) rows = rows.filter((u) => String(u._id) !== String(query._id.$ne));
    if (query?.status) rows = rows.filter((u) => u.status === query.status);
    return thenable(rows.map((u) => ({ ...u })));
  },
  findById: () => thenable(null),
});

stub('models/ChatMessage.js', {
  find: () => thenable([]),
  countDocuments: () => Promise.resolve(0),
  updateMany: () => Promise.resolve({ modifiedCount: 0 }),
  create: () => Promise.resolve({}),
  aggregate: (pipeline) => {
    // Two different aggregates run against this model: unread counts, and the
    // last-message-at map. Tell them apart by what they group on.
    const group = pipeline.find((s) => s.$group);
    if (group?.$group?.at) {
      return Promise.resolve([{ _id: 'd1', at: new Date('2026-06-01') }]);
    }
    return Promise.resolve([{ _id: 'd1', count: 3 }]);
  },
});

const chatThread = require('../services/messaging/adapters/chatThread');

/* ── Harness ──────────────────────────────────────────────────────────── */

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

/* ── Tests ────────────────────────────────────────────────────────────── */

(async () => {
  console.log('\nlistThreads — direct messages');

  const { raw, normalized } = await chatThread.listThreads({ _id: ME });

  await it('returns DMs alongside groups', () => {
    // The whole bug: this used to filter `type: 'group'`, so a private
    // conversation could be created and posted to but never listed.
    assert.strictEqual(raw.length, 2);
    assert.ok(raw.some((t) => t.type === 'private'), 'no private thread returned');
    assert.ok(raw.some((t) => t.type === 'group'), 'no group returned');
  });

  await it('names a DM after the OTHER participant, not the viewer', () => {
    const dm = raw.find((t) => t.type === 'private');
    assert.strictEqual(dm.name, 'Priya');
  });

  await it('exposes the peer so the client need not re-derive it', () => {
    const dm = raw.find((t) => t.type === 'private');
    assert.strictEqual(dm.peer._id, PEER);
    assert.strictEqual(dm.peer.name, 'Priya');
  });

  await it('leaves group names untouched', () => {
    const group = raw.find((t) => t.type === 'group');
    assert.strictEqual(group.name, 'Marketing');
    assert.strictEqual(group.peer, null);
  });

  await it('carries unread counts onto DMs', () => {
    const dm = raw.find((t) => t.type === 'private');
    assert.strictEqual(dm.unreadCount, 3);
  });

  await it('sets lastMessageAt from the newest message', () => {
    const dm = raw.find((t) => t.type === 'private');
    assert.strictEqual(
      new Date(dm.lastMessageAt).toISOString(),
      new Date('2026-06-01').toISOString()
    );
  });

  await it('falls back to createdAt for a thread with no messages', () => {
    // A DM opened from the directory but not yet spoken in must still sort
    // somewhere sensible rather than as an invalid date.
    const group = raw.find((t) => t.type === 'group');
    assert.strictEqual(
      new Date(group.lastMessageAt).toISOString(),
      new Date('2026-01-01').toISOString()
    );
  });

  await it('normalized shape carries type, peer and updatedAt', () => {
    const dm = normalized.find((t) => t.type === 'private');
    assert.strictEqual(dm.name, 'Priya');
    assert.strictEqual(dm.peer._id, PEER);
    assert.ok(dm.updatedAt, 'updatedAt missing');
  });

  await it('names the DM differently for the other participant', async () => {
    // Same document, opposite viewer — the label must flip. This is why a DM
    // cannot simply store a `name`.
    const asPeer = await chatThread.listThreads({ _id: PEER });
    const dm = asPeer.raw.find((t) => t.type === 'private');
    assert.strictEqual(dm.name, 'Me');
  });

  /* ── Summary ────────────────────────────────────────────────────────── */

  console.log(`\n${passed}/${passed + failures.length} passed`);
  if (failures.length) {
    failures.forEach((f) => console.error(`\n${f.name}\n${f.err.stack}`));
    process.exit(1);
  }
})();
