// scripts/repairClientMsgIdIndex.js
//
// Replace the broken `clientMsgId` uniqueness constraint on chat and project
// messages.
//
//     node scripts/repairClientMsgIdIndex.js --dry-run    # always do this first
//     node scripts/repairClientMsgIdIndex.js
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS NEEDED
// ─────────────────────────────────────────────────────────────────────────────
// Both message schemas declared:
//
//     clientMsgId: { type: String, default: null }
//     schema.index({ clientMsgId: 1 }, { unique: true, sparse: true })
//
// A sparse index skips documents where the field is ABSENT. It does not skip
// documents where the field is present and `null` — that is a real indexed
// value. Combined with `unique`, the pair therefore allowed exactly ONE
// document per collection to carry `clientMsgId: null`.
//
// Every message the server creates without a client id hit that ceiling:
// forwarded copies, which set no client id at all, and sends from any client
// too old to mint one. The insert failed with E11000, the route's
// sendAccessError rethrew it because it is not an AccessError, and the user
// saw a bare 500 — the intermittent "forwarding gives a connection error"
// report.
//
// It was intermittent because the index only exists where the build actually
// succeeded. On a collection that already held two or more null rows the
// autoIndex build fails on startup and is logged but not fatal, so the
// constraint silently does not exist and forwarding works fine. Deploy against
// a fresh or cleaned database and it starts failing.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS DOES
// ─────────────────────────────────────────────────────────────────────────────
//   1. $unset clientMsgId on every document where it is null, so the field is
//      genuinely absent rather than explicitly empty.
//   2. Drop the old clientMsgId_1 index if it is there.
//   3. Recreate it as unique + partialFilterExpression { $type: 'string' },
//      which constrains only real client ids.
//
// Idempotent: a second run finds nothing to unset and an index already in the
// desired shape, and exits without touching anything.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

const INDEX_NAME = 'clientMsgId_1';
const INDEX_SPEC = { clientMsgId: 1 };
const INDEX_OPTS = {
  name: INDEX_NAME,
  unique: true,
  partialFilterExpression: { clientMsgId: { $type: 'string' } },
};

const COLLECTIONS = ['chatmessages', 'messages'];

/** Is this index already exactly what we want? */
function isAlreadyPartial(idx) {
  const pfe = idx.partialFilterExpression;
  return Boolean(
    idx.unique &&
      !idx.sparse &&
      pfe &&
      pfe.clientMsgId &&
      pfe.clientMsgId.$type === 'string'
  );
}

async function repair(db, name) {
  const collection = db.collection(name);

  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) {
    console.log(`\n${name}: collection does not exist, skipping`);
    return;
  }

  console.log(`\n${name}`);
  console.log('─'.repeat(60));

  // 1. Null -> absent.
  const nullCount = await collection.countDocuments({ clientMsgId: null });
  console.log(`  documents with clientMsgId: null  ${nullCount}`);

  if (nullCount > 0) {
    if (DRY_RUN) {
      console.log(`  would $unset clientMsgId on ${nullCount} document(s)`);
    } else {
      const res = await collection.updateMany(
        { clientMsgId: null },
        { $unset: { clientMsgId: '' } }
      );
      console.log(`  unset clientMsgId on ${res.modifiedCount} document(s)`);
    }
  }

  // 2 + 3. Reshape the index.
  const indexes = await collection.indexes();
  const existing = indexes.find((i) => i.name === INDEX_NAME);

  if (!existing) {
    console.log('  no clientMsgId_1 index present (the build had been failing)');
  } else if (isAlreadyPartial(existing)) {
    console.log('  clientMsgId_1 is already partial+unique, nothing to change');
    return;
  } else {
    console.log(
      `  clientMsgId_1 is unique=${Boolean(existing.unique)} sparse=${Boolean(existing.sparse)} — needs replacing`
    );
    if (DRY_RUN) {
      console.log('  would drop clientMsgId_1');
    } else {
      await collection.dropIndex(INDEX_NAME);
      console.log('  dropped clientMsgId_1');
    }
  }

  // A duplicate real client id would block the rebuild. Surface it rather than
  // letting createIndex fail with an opaque E11000.
  const dupes = await collection
    .aggregate([
      { $match: { clientMsgId: { $type: 'string' } } },
      { $group: { _id: '$clientMsgId', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $limit: 10 },
    ])
    .toArray();

  if (dupes.length > 0) {
    console.error(
      `  ✗ ${dupes.length}+ duplicate clientMsgId value(s) found — the unique index cannot be built.`
    );
    dupes.forEach((d) => console.error(`      ${d._id} x${d.n}`));
    console.error('  Resolve these first (they are genuine duplicate sends), then re-run.');
    return;
  }

  if (DRY_RUN) {
    console.log('  would create clientMsgId_1 as unique + partial($type: string)');
  } else {
    await collection.createIndex(INDEX_SPEC, INDEX_OPTS);
    console.log('  ✓ created clientMsgId_1 as unique + partial($type: string)');
  }
}

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected${DRY_RUN ? '  (DRY RUN — nothing will be written)' : ''}`);

  try {
    for (const name of COLLECTIONS) {
      await repair(mongoose.connection.db, name);
    }
    console.log('\nDone.');
  } catch (err) {
    console.error('\nFailed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
