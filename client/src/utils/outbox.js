// utils/outbox.js
//
// Persistent send queue for messages composed while offline or mid-failure (S2).
//
// ─── WHY INDEXEDDB AND NOT localStorage ───
// Three reasons, any one of which is disqualifying for localStorage:
//   1. It has to hold File objects. localStorage stores strings only, so
//      attachments would need base64 encoding — a 33% size penalty on data
//      that's already the biggest thing in the queue.
//   2. localStorage is SYNCHRONOUS. Writing a queued message with a 5MB
//      attachment blocks the main thread, i.e. freezes the UI at the exact
//      moment the user is trying to send something.
//   3. The quota is ~5MB total, shared with everything else the app stores.
//      One photo blows it, and the failure mode is a thrown QuotaExceededError
//      mid-send.
//
// The existing `sessionStorage` unread mirrors removed in Phase 5 were an
// earlier version of exactly this mistake.
//
// ─── ORDERING ───
// Entries carry a monotonically increasing `seq`. The drain replays in `seq`
// order, one at a time — a parallel drain would let a later message land first
// and permanently reorder the thread for everyone.
//
// Replay safety comes from `clientMsgId`, which is minted once when the message
// is queued and never regenerated. The server's unique sparse index turns a
// double-send into a no-op returning the original (see S1).

const DB_NAME = "tapvera-messaging";
const DB_VERSION = 1;
const STORE = "outbox";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "clientMsgId" });
        // Drain order.
        store.createIndex("seq", "seq");
        // "everything still pending for this thread", for the composer strip.
        store.createIndex("thread", ["scope", "threadId"]);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

/**
 * Run one transaction and resolve with the request's RESULT.
 *
 * `fn(store)` returns an IDBRequest, whose `.result` is only populated once the
 * request succeeds — resolving with the request object itself would hand
 * callers an IDBRequest where they expected rows.
 */
function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);

        let request;
        try {
          request = fn(store);
        } catch (err) {
          reject(err);
          return;
        }

        // Wait for oncomplete rather than onsuccess: a write isn't durable
        // until the transaction commits, and resolving early means a reload
        // moments later can lose the queued message.
        transaction.oncomplete = () => resolve(request?.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

/* ── Public API ───────────────────────────────────────────────────────── */

/** Monotonic sequence. Persisted alongside the entry so it survives reload. */
let seqCounter = Date.now();
const nextSeq = () => (seqCounter += 1);

/**
 * Queue a message for sending.
 *
 * @param {object} entry
 * @param {string} entry.clientMsgId  minted by the caller; the dedup key
 * @param {string} entry.scope
 * @param {string} entry.threadId
 * @param {string} entry.body
 * @param {File[]} [entry.files]
 * @param {string} [entry.replyTo]
 * @param {Array}  [entry.mentions]
 */
export async function enqueue(entry) {
  const record = {
    ...entry,
    seq: nextSeq(),
    queuedAt: Date.now(),
    attempts: 0,
    lastError: null,
  };
  await tx("readwrite", (store) => store.put(record));
  return record;
}

/**
 * Everything pending, oldest first — INCLUDING entries marked permanent.
 *
 * The drain filters those out for itself. This does not, because forThread()
 * below feeds the composer's failed-message strip, and a message the drain has
 * given up on is precisely the one the user still needs to see, retry or copy
 * their text out of.
 */
export async function all() {
  const rows = await tx("readonly", (store) => store.getAll());
  return (rows || []).sort((a, b) => a.seq - b.seq);
}

/** Pending entries for one thread. */
export async function forThread(scope, threadId) {
  const rows = await all();
  return rows.filter((r) => r.scope === scope && String(r.threadId) === String(threadId));
}

export async function remove(clientMsgId) {
  await tx("readwrite", (store) => store.delete(clientMsgId));
}

/**
 * Record a failed attempt. Kept in the queue — never silently dropped.
 *
 * `permanent` marks an entry the drain must stop retrying. It is persisted
 * rather than held in memory because the whole point of this queue is that it
 * survives a reload: without it, a message the drain had already given up on
 * came back as fresh work on the very next page load, forever.
 *
 * Once true it stays true until clearPermanent — a later transient failure
 * must not quietly un-give-up on something already judged unsendable.
 */
export async function markAttempt(clientMsgId, error, { permanent = false } = {}) {
  const existing = await tx("readonly", (store) => store.get(clientMsgId));
  if (!existing) return null;

  const updated = {
    ...existing,
    attempts: (existing.attempts || 0) + 1,
    lastError: error ? String(error).slice(0, 300) : null,
    permanent: permanent || Boolean(existing.permanent),
  };
  await tx("readwrite", (store) => store.put(updated));
  return updated;
}

/**
 * Un-mark a permanently failed entry so the drain will pick it up again.
 *
 * Only ever called from an explicit user retry. The automatic drain must not
 * do this to itself — that would be the retry loop this flag exists to stop.
 */
export async function clearPermanent(clientMsgId) {
  const existing = await tx("readonly", (store) => store.get(clientMsgId));
  if (!existing) return null;

  const updated = { ...existing, permanent: false };
  await tx("readwrite", (store) => store.put(updated));
  return updated;
}

export async function clear() {
  await tx("readwrite", (store) => store.clear());
}

/** Is the outbox usable? Private browsing can refuse IndexedDB entirely. */
export async function isAvailable() {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

export default {
  enqueue,
  all,
  forThread,
  remove,
  markAttempt,
  clearPermanent,
  clear,
  isAvailable,
};
