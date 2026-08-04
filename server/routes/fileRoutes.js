// routes/fileRoutes.js
//
// Serves uploaded files — the replacement for
// `app.use("/uploads", express.static(...))`, which served every attachment,
// medical certificate and ID document to anyone on the internet who had the
// URL, with no authentication whatsoever.
//
// ─────────────────────────────────────────────────────────────────────────────
// TWO WAYS IN, ON PURPOSE
// ─────────────────────────────────────────────────────────────────────────────
//
//   1. SIGNED URL (?e=…&s=…) — how the browser gets files.
//      <img src>, <video src> and download links cannot send an Authorization
//      header, and the JWT lives in localStorage rather than a cookie, so
//      nothing is attached automatically. A pure Bearer-only endpoint would
//      close the hole and blank every image in chat at the same time. Signed
//      URLs work in any tag, need no cookie (so nothing depends on SameSite
//      between client.tapvera.io and web.tapvera.io), and expire on their own.
//
//   2. BEARER TOKEN — for programmatic/API access and anything server-side.
//
// Either is sufficient. Neither being present is a 401, which is the whole
// point of the change.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHO SERVES THE BYTES
// ─────────────────────────────────────────────────────────────────────────────
// With UPLOAD_USE_XACCEL=true this route authorizes and then hands off to nginx
// via X-Accel-Redirect: Node writes a header and ends the response, nginx
// streams the file with sendfile() and full HTTP range support. That matters
// here because uploads may be 10MB videos, and streaming those through Node's
// event loop competes with every socket the CRM is holding open.
//
// Without it (local dev, no nginx) res.sendFile is used instead — correct, just
// less efficient. See docs/biometric-attendance-integration.md's nginx section
// for the location block.
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const { resolveStoredPath, verifyFileSignature } = require('../config/storage');

const router = express.Router();

// nginx `internal;` location that maps onto UPLOAD_ROOT. Internal means nginx
// will only serve it in response to X-Accel-Redirect from us — a request
// straight to /protected-uploads/... from outside is refused, so the handoff
// doesn't reintroduce the very hole this route closes.
const USE_XACCEL = String(process.env.UPLOAD_USE_XACCEL || 'false') === 'true';
const INTERNAL_LOCATION = process.env.UPLOAD_INTERNAL_LOCATION || '/protected-uploads';

/** Valid Bearer token? Used only as an alternative to a signature. */
function hasValidBearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    return !!jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET)?.id;
  } catch {
    return false;
  }
}

router.get(/^\/(.+)$/, (req, res) => {
  const relativePath = req.params[0];

  // ---- Authorize ----
  const { e: expiresAt, s: signature } = req.query;
  const signed = verifyFileSignature(relativePath, expiresAt, signature);

  if (!signed.ok && !hasValidBearer(req)) {
    // The reason is deliberately not echoed back. "expired" vs "bad signature"
    // tells someone probing which half of the URL to keep working on.
    console.warn(
      `[files] Denied ${relativePath} (${signed.reason}) from ${req.ip}`
    );
    return res.status(401).json({ message: 'Not authorized to access this file' });
  }

  // ---- Resolve, refusing anything outside the upload root ----
  const absolute = resolveStoredPath(relativePath);
  if (!absolute) {
    console.warn(`[files] Path traversal attempt: ${relativePath} from ${req.ip}`);
    return res.status(400).json({ message: 'Invalid file path' });
  }

  let servePath = absolute;
  let servedFromLegacy = false;

  if (!fs.existsSync(servePath) || !fs.statSync(servePath).isFile()) {
    // Fall back to the pre-UPLOAD_ROOT location, `<repo>/server/uploads`.
    //
    // Everything uploaded before storage moved out of the deploy directory
    // still lives there, and its URL is already recorded in Mongo. Without
    // this, every one of those attachments 404s until the migration script has
    // run — and on a server that has been live for months, that's every
    // historical attachment at once.
    //
    // Read-only and deliberately noisy: anything served this way still needs
    // migrating, because the deploy directory is not durable.
    const legacy = path.resolve(__dirname, '..', 'uploads', relativePath);
    const legacyRoot = path.resolve(__dirname, '..', 'uploads');
    const rel = path.relative(legacyRoot, legacy);
    const withinLegacyRoot = rel && !rel.startsWith('..') && !path.isAbsolute(rel);

    if (withinLegacyRoot && fs.existsSync(legacy) && fs.statSync(legacy).isFile()) {
      servePath = legacy;
      servedFromLegacy = true;
      console.warn(
        `[files] Served ${relativePath} from the legacy in-repo uploads directory — ` +
          `run scripts/migrateUploadsToStorageRoot.js to move it under UPLOAD_ROOT`
      );
    } else {
      return res.status(404).json({ message: 'File not found' });
    }
  }

  // Original filename isn't recoverable from disk (stored names are random by
  // design), so callers wanting a friendly download name pass ?name=.
  // Sanitised because it lands in a response header.
  const downloadName = String(req.query.name || '').replace(/[^\w.\- ]/g, '');
  if (downloadName) {
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
  }

  // These are per-user authorized documents behind expiring links: never let a
  // shared cache hold one.
  res.setHeader('Cache-Control', 'private, max-age=300');

  // X-Accel only knows about the internal location mapped onto UPLOAD_ROOT, so
  // a legacy file that lives elsewhere has to be streamed by Node instead.
  if (USE_XACCEL && !servedFromLegacy) {
    // nginx re-serves from the internal location. Encode each segment so
    // spaces or unicode in a legacy filename don't truncate the header.
    const encoded = relativePath.split('/').map(encodeURIComponent).join('/');
    res.setHeader('X-Accel-Redirect', `${INTERNAL_LOCATION}/${encoded}`);
    return res.end();
  }

  return res.sendFile(servePath, (err) => {
    if (err && !res.headersSent) {
      console.error(`[files] Failed to send ${relativePath}:`, err.message);
      res.status(500).end();
    }
  });
});

module.exports = router;
