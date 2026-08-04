// middlewares/signFileUrls.js
//
// Rewrites every `/uploads/...` path in an outgoing JSON response into a
// short-lived signed URL.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY SIGN ON THE WAY OUT RATHER THAN ON UPLOAD
// ─────────────────────────────────────────────────────────────────────────────
// Signatures expire. Signing at upload time and storing the result would bake a
// 15-minute link into Mongo forever — every attachment would work briefly and
// then 401 permanently. So the database keeps the plain relative path (the
// durable fact) and the signature is minted per response, valid from the moment
// the client receives it.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY AN INTERCEPTOR RATHER THAN CALLING signFileUrl() AT EACH SITE
// ─────────────────────────────────────────────────────────────────────────────
// File URLs surface from at least eight places — chat attachments, project
// message attachments, leave documents, screenshots, payment QR codes — and
// they are nested at different depths in different shapes. Signing at each read
// site means every one that gets missed ships as a broken image, and every new
// endpoint is a chance to forget. One interceptor cannot be forgotten.
//
// The trade is that it's implicit: someone reading a controller won't see the
// rewrite happen. That's what this comment block is for, and why the matching
// is deliberately narrow — it only ever touches strings that point at
// /uploads/, and never re-signs one that's already signed.
'use strict';

const { signFileUrl } = require('../config/storage');

// Matches a bare "/uploads/x/y.jpg" and a legacy absolute
// "https://host/uploads/x/y.jpg" — leaveController used to bake the hostname in,
// so historical rows carry a host that may no longer even be this server.
// Capture group 1 is the storage-relative path.
const UPLOAD_URL = /^(?:https?:\/\/[^/]+)?\/uploads\/(.+)$/i;

// Guards against a pathological payload turning one response into a long walk.
const MAX_DEPTH = 12;

/** Already carries a signature — leave it alone rather than double-signing. */
const isSigned = (value) => value.includes('e=') && value.includes('s=');

function signValue(value) {
  if (typeof value !== 'string' || value.length > 2048) return value;
  if (!value.includes('/uploads/')) return value; // cheap reject before regex

  const match = value.match(UPLOAD_URL);
  if (!match) return value;

  const [relativeWithQuery] = [match[1]];
  if (isSigned(relativeWithQuery)) return value;

  // Drop any pre-existing query string; it isn't part of the stored path.
  const relative = relativeWithQuery.split('?')[0];
  return signFileUrl(relative) || value;
}

function signDeep(node, depth = 0) {
  if (depth > MAX_DEPTH || node === null || node === undefined) return node;

  if (typeof node === 'string') return signValue(node);

  if (Array.isArray(node)) {
    let changed = false;
    const out = node.map((item) => {
      const next = signDeep(item, depth + 1);
      if (next !== item) changed = true;
      return next;
    });
    return changed ? out : node;
  }

  if (typeof node !== 'object') return node;

  // Leave these exactly as they are — res.json serialises them correctly and
  // walking into them would flatten them into meaningless key maps.
  if (node instanceof Date || Buffer.isBuffer(node)) return node;

  // Mongoose documents are the common case here: most controllers do
  // res.json(doc) or res.json(docs) without .lean(). A model instance is not a
  // plain object, so a naive constructor check skips it entirely and every
  // attachment on a non-lean route ships unsigned. Convert through toJSON —
  // exactly what res.json would have done downstream — then walk the result.
  if (typeof node.toJSON === 'function') {
    const plain = node.toJSON();
    // ObjectId.toJSON() returns a string; re-entering handles that naturally.
    return signDeep(plain, depth + 1);
  }

  let changed = false;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    const next = signDeep(value, depth + 1);
    if (next !== value) changed = true;
    out[key] = next;
  }
  return changed ? out : node;
}

function signFileUrls(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    try {
      return originalJson(signDeep(body));
    } catch (err) {
      // A signing failure must never cost the caller their response — worst
      // case they get the unsigned path, which 401s at the file route rather
      // than turning a working endpoint into a 500.
      console.error('[signFileUrls] Failed to sign response URLs:', err.message);
      return originalJson(body);
    }
  };

  next();
}

/**
 * The same rewrite for payloads that never touch res.json — chiefly Socket.IO
 * emissions.
 *
 * A message sent with an attachment is delivered twice: once as the HTTP
 * response to the sender (signed by the middleware) and once as a `chat:message`
 * socket event to everyone else (which bypasses Express entirely). Without this,
 * the sender sees their image and every recipient sees a broken one until they
 * refresh and refetch over HTTP.
 */
signFileUrls.signPayload = (payload) => {
  try {
    return signDeep(payload);
  } catch (err) {
    console.error('[signFileUrls] Failed to sign socket payload:', err.message);
    return payload;
  }
};

module.exports = signFileUrls;
