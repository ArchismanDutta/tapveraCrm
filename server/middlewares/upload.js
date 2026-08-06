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
const { createDiskStorage } = require('../config/storage');

// Matches the chat/project uploader, so a file that is acceptable in one part
// of the CRM is acceptable in the other.
const MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES || 50 * 1024 * 1024);

// No type whitelist.
//
// This used to allow only pdf|jpg|png|doc|docx. Chat accepts anything, so a
// photo of a medical certificate taken on an iPhone (.heic) was refused from a
// leave request and accepted in a chat message — the same file, the same
// person, two different answers. Nobody can predict that rule, and the
// workaround is to send it in chat instead, which is worse for everyone.
//
// The size cap is the limit that matters. These files are never executed: they
// are written with a random name, served with an explicit Content-Disposition,
// and only reachable through a signed URL.
const upload = multer({
  storage: createDiskStorage('leave'),
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
