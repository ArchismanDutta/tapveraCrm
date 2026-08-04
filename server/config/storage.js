// config/storage.js
//
// Where uploaded files live on this server, and how they are addressed.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
// ─────────────────────────────────────────────────────────────────────────────
// Uploads used to be written to `<repo>/uploads` and served by
// `app.use("/uploads", express.static(...))` — with no authentication at all.
// Every sick-leave medical certificate, ID document and chat attachment was a
// public URL to anyone who had, or could guess, the path. Leave documents were
// named `document-<Date.now()>.pdf`, so the only secret was a millisecond.
//
// Two things follow from that, and this module owns both:
//
//   1. FILES LIVE OUTSIDE THE DEPLOY DIRECTORY. `<repo>/uploads` is inside the
//      thing you replace on every deploy — one rsync or a fresh checkout and
//      the attachments are gone. UPLOAD_ROOT points somewhere durable that is
//      backed up on its own schedule.
//
//   2. THE PATH IS NOT THE PERMISSION. Files are addressed by short-lived
//      signed URLs, so possessing a link doesn't grant permanent access and a
//      leaked link expires by itself.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Default keeps existing single-server installs working untouched. Production
// should set UPLOAD_ROOT to a dedicated mount, e.g. /var/lib/tapvera/uploads.
const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads')
);

// Signed links are valid for minutes, not forever. Long enough to load a page
// full of images and start a video; short enough that a link pasted into a
// group chat is useless by the time anyone outside clicks it.
const URL_TTL_SECONDS = Number(process.env.UPLOAD_URL_TTL_SECONDS || 900); // 15 min

// Falls back to JWT_SECRET so this works out of the box, but a dedicated key is
// better: rotating it invalidates every outstanding file link without logging
// everyone out.
const SIGNING_SECRET = process.env.UPLOAD_SIGNING_SECRET || process.env.JWT_SECRET;

if (!SIGNING_SECRET) {
  throw new Error(
    'UPLOAD_SIGNING_SECRET (or JWT_SECRET) must be set — file URLs cannot be signed without it'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATHS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Absolute path for a stored-relative path, refusing anything that escapes the
 * upload root.
 *
 * The check is on the RESOLVED path, not the input string. Blacklisting ".."
 * textually misses URL-encoded traversal, absolute paths, and symlinks; asking
 * "where did this actually land" catches all three, because a caller who
 * reaches outside the root cannot produce a resolved path that starts with it.
 *
 * @param {String} relativePath e.g. "messages/2026/08/a3/f81c….jpg"
 * @returns {String|null} absolute path, or null if it escapes the root
 */
function resolveStoredPath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') return null;

  // Strip any leading "/uploads/" or "/" so both stored forms work.
  const cleaned = String(relativePath)
    .replace(/^\/+/, '')
    .replace(/^uploads\//, '');

  const absolute = path.resolve(UPLOAD_ROOT, cleaned);

  // path.relative gives "" for the root itself and starts with ".." for
  // anything outside it. The separator check stops /var/lib/tapvera/uploads-evil
  // passing a naive startsWith(UPLOAD_ROOT).
  const rel = path.relative(UPLOAD_ROOT, absolute);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return null;

  return absolute;
}

/**
 * A storage-relative path for a new upload, sharded by date and hash prefix.
 *
 * Everything previously landed in one flat directory. Tens of thousands of
 * entries in a single directory makes listing slow and backup/prune-by-age
 * impossible. `messages/2026/08/a3/<name>` keeps directories small, and the
 * date prefix means "archive everything before last year" is a directory move.
 *
 * @param {String} folder logical bucket, e.g. "messages", "leave", "screenshots"
 * @param {String} originalName used only for its extension
 */
function newStoredPath(folder, originalName) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  // 16 random bytes: the filename carries no meaning and cannot be guessed or
  // enumerated. The human-readable name is kept in the database instead, so
  // downloads can still be presented with their original filename.
  const id = crypto.randomBytes(16).toString('hex');
  const shard = id.slice(0, 2);

  // Extension is whitelisted rather than passed through: a crafted
  // originalname is otherwise a way to write ".."-ish or double-extension
  // names into the tree.
  const rawExt = path.extname(String(originalName || '')).toLowerCase();
  const ext = /^\.[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : '';

  const safeFolder = String(folder || 'misc').replace(/[^a-z0-9_-]/gi, '');

  return `${safeFolder}/${year}/${month}/${shard}/${id}${ext}`;
}

/** Create the directory for a storage-relative path. Returns the absolute path. */
function ensureDirFor(relativePath) {
  const absolute = resolveStoredPath(relativePath);
  if (!absolute) throw new Error(`Refusing to write outside upload root: ${relativePath}`);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  return absolute;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNED URLS
// ─────────────────────────────────────────────────────────────────────────────
//
// Why signatures rather than requiring the Authorization header:
//
// The browser fetches attachments as subresources — <img src>, <video src>, a
// download link. None of those can carry an Authorization header, and the JWT
// lives in localStorage, not a cookie, so nothing is sent automatically. A
// plain authenticated endpoint would close the hole and break every image in
// chat at the same time.
//
// A signed URL is self-contained: it works in any tag, survives redirects,
// needs no cookie (so no SameSite complications between client.tapvera.io and
// web.tapvera.io), and expires on its own.

/** `<expiry>.<hmac>` over the path — path is bound in, so a signature can't be moved to another file. */
function signatureFor(relativePath, expiresAt) {
  return crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${relativePath}:${expiresAt}`)
    .digest('hex');
}

/**
 * A time-limited public URL for a stored file.
 * @returns {String} e.g. "/uploads/messages/2026/08/a3/f81c….jpg?e=1785…&s=9ab…"
 */
function signFileUrl(relativePath, { ttlSeconds = URL_TTL_SECONDS } = {}) {
  if (!relativePath) return null;

  const cleaned = String(relativePath).replace(/^\/+/, '').replace(/^uploads\//, '');
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;

  return `/uploads/${cleaned}?e=${expiresAt}&s=${signatureFor(cleaned, expiresAt)}`;
}

/**
 * Verify a signature from a request.
 * @returns {{ok: Boolean, reason?: String}}
 */
function verifyFileSignature(relativePath, expiresAt, signature) {
  if (!expiresAt || !signature) return { ok: false, reason: 'unsigned' };

  const exp = Number(expiresAt);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'bad expiry' };
  if (exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: 'expired' };

  const cleaned = String(relativePath).replace(/^\/+/, '').replace(/^uploads\//, '');
  const expected = signatureFor(cleaned, exp);

  // Constant-time compare. A fast-fail comparison leaks, byte by byte, how much
  // of a guessed signature was right, which is enough to forge one given
  // patience.
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return { ok: false, reason: 'bad signature' };

  return crypto.timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, reason: 'bad signature' };
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTER STORAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * multer diskStorage that writes into UPLOAD_ROOT using the sharded random
 * naming above, and hands back the storage-relative path as `file.storedPath`.
 *
 * Callers need `storedPath`, not multer's `filename`: with sharding the file
 * lives at `leave/2026/08/a3/<id>.pdf`, so building a URL from the bare
 * filename would produce a path that doesn't exist. Every caller should write
 * `/uploads/${file.storedPath}` into the database.
 *
 * @param {String|Function} folder logical bucket — "leave", "messages",
 *        "screenshots" — or `(req, file) => folder` when the destination
 *        depends on the route (the chat/project uploader serves both messages
 *        and screenshots through one multer instance).
 */
function createDiskStorage(folder) {
  const multer = require('multer');

  return multer.diskStorage({
    destination(req, file, cb) {
      try {
        const bucket = typeof folder === 'function' ? folder(req, file) : folder;

        // Decide the whole relative path up front so the directory we create
        // and the path we report can never disagree.
        file.storedPath = newStoredPath(bucket, file.originalname);
        const absolute = ensureDirFor(file.storedPath);
        cb(null, path.dirname(absolute));
      } catch (err) {
        cb(err);
      }
    },
    filename(req, file, cb) {
      // destination() already generated it; just use the leaf.
      cb(null, path.basename(file.storedPath));
    },
  });
}

module.exports = {
  UPLOAD_ROOT,
  URL_TTL_SECONDS,
  resolveStoredPath,
  newStoredPath,
  ensureDirFor,
  createDiskStorage,
  signFileUrl,
  verifyFileSignature,
};
