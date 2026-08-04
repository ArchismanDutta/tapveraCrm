// middlewares/upload.js
//
// Disk uploader for leave documents (POST/PUT /api/leaves).
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS USED TO DO, AND WHY EACH PART WAS A PROBLEM
// ─────────────────────────────────────────────────────────────────────────────
//
//   const uploadDir = "uploads";
//   filename: `${file.fieldname}-${Date.now()}${ext}`
//   const upload = multer({ storage, fileFilter });     // no limits
//
//   1. NO SIZE LIMIT AT ALL. The other uploader (config/s3Config.js) caps at
//      10MB; this one accepted anything. A single large upload could fill the
//      disk — and on one in-house server a full disk stops Mongo writing too,
//      so a leave attachment takes the whole CRM down with it.
//
//   2. COLLIDING FILENAMES. `document-<ms>.pdf` derives only from the field
//      name and the clock, so two people submitting leave in the same
//      millisecond produced an identical filename and the second silently
//      overwrote the first — one employee's medical certificate replaced by
//      another's, with no error raised anywhere.
//
//   3. GUESSABLE FILENAMES, on a tree that express.static served publicly. The
//      only thing protecting a medical certificate was a millisecond.
//
//   4. RELATIVE DESTINATION. "uploads" resolves against process.cwd(), not this
//      file — start the server from a different directory and uploads land
//      somewhere else entirely, invisible to everything that reads them.
//
//   5. UNANCHORED EXTENSION TEST. /pdf|jpg|jpeg|png|doc|docx/ matched anywhere
//      in the extension, so ".jpgx" and ".pdfx" passed, and the mimetype was
//      never checked at all.
//
// All five are addressed below. Storage goes through config/storage.js, which
// owns UPLOAD_ROOT, sharding and random naming.
'use strict';

const multer = require('multer');
const path = require('path');
const { createDiskStorage } = require('../config/storage');

// Matches the limit the chat/project uploader already enforces, so a file that
// is acceptable in one part of the CRM is acceptable in the other.
const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 10 * 1024 * 1024);

// Anchored: the extension must BE one of these, not merely contain one.
const ALLOWED_EXTENSIONS = /^\.(pdf|jpe?g|png|docx?)$/;

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();

  // Both must agree. An extension is trivially renamed; a mimetype is
  // client-supplied and equally forgeable. Requiring both raises the bar
  // without rejecting anything legitimate.
  if (ALLOWED_EXTENSIONS.test(ext) && ALLOWED_MIMES.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(new Error('Only PDF, JPG, PNG, DOC and DOCX files are allowed'));
}

const upload = multer({
  storage: createDiskStorage('leave'),
  fileFilter,
  limits: {
    fileSize: MAX_BYTES,
    files: 5,
    // Caps non-file parts too. Without it a multipart body can carry an
    // unbounded number of text fields — a cheap way to load the server with a
    // request that never even includes a file.
    fields: 50,
  },
});

module.exports = upload;
module.exports.MAX_BYTES = MAX_BYTES;
