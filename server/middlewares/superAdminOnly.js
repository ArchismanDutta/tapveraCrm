// middlewares/superAdminOnly.js
//
// Hard gate for routes that only a super-admin may touch.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY NOT JUST authorize("super-admin")
// ─────────────────────────────────────────────────────────────────────────────
// roleMiddleware.authorize() opens with "super-admin bypasses all role checks"
// and only then tests the allow-list. Calling authorize("super-admin") happens
// to produce the right answer today, but it reads as a role *allowance* on a
// middleware whose documented job is to let super-admin through everything —
// so the next person to widen that bypass, or to add a role alias, changes the
// meaning of this gate without ever opening this file.
//
// A route that exposes client pricing and publishes to the public internet
// should say what it requires in its own terms.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY CLIENT TOKENS ARE REJECTED EXPLICITLY
// ─────────────────────────────────────────────────────────────────────────────
// authMiddleware.protect authenticates two different principals against the
// same header: a User and a Client. A Client arrives with role "client", which
// no allow-list here would match anyway — but the failure would read as an
// ordinary 403 and tell nobody that a client account reached an internal
// endpoint at all. That is worth its own branch and its own log line.
'use strict';

// The enum on User is "super-admin". Parts of the codebase also test for
// "superadmin", and at least one seed script has written it. Accept both here
// rather than let a hyphen decide whether the CRM's owner can use a feature.
const SUPER_ADMIN_ROLES = new Set(['super-admin', 'superadmin']);

function superAdminOnly(req, res, next) {
  try {
    if (!req.user) {
      // protect() did not run, or ran and let a request through without a
      // principal. Either way this is a wiring bug, not a permission problem.
      return res.status(401).json({ message: 'Not authenticated.' });
    }

    if (req.user.userType === 'Client' || req.user.role === 'client') {
      console.warn(
        `[superAdminOnly] Client account ${req.user._id} attempted ${req.method} ${req.originalUrl}`
      );
      return res.status(403).json({ message: 'Not available on client accounts.' });
    }

    if (!SUPER_ADMIN_ROLES.has(req.user.role)) {
      return res.status(403).json({
        message: 'Proposals are restricted to super-admins.',
      });
    }

    return next();
  } catch (err) {
    console.error('[superAdminOnly] error:', err.message);
    return res.status(500).json({ message: 'Server error during authorization.' });
  }
}

module.exports = { superAdminOnly, SUPER_ADMIN_ROLES };
