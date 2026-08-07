# Geofenced Login — Design

**Date:** 2026-08-07
**Status:** Implemented
**Scope:** Restrict where individual employees may sign in to the CRM from, configured by Super Admin.

---

## 1. Requirement

The Super Admin can restrict a given employee to signing in only from specific
physical locations. Location and assignment are both fully configurable — who
is fenced, and where they are fenced to. **Client portal accounts are never
geofenced.**

## 2. Decisions

| Question | Decision | Why |
|---|---|---|
| Position source | Browser GPS (`navigator.geolocation`) | ~10–50m outdoors. IP lookup is city-level (5–50km) and cannot fence a building; it is also defeated by any VPN. |
| Enforcement point | Login **and** a ~10-minute session re-check | Login-only leaves the obvious "sign in at the office, then go home" hole. Per-request would need coordinates on every call — latency, battery, and a change across ~50 route files. |
| No location available | **Fail closed** | No location, no access. Applies to permission denied, GPS off, and fixes too vague to be a location. |
| Assignment model | Reusable named locations, assigned per user | Mirrors `Shift.js`. Define "Kolkata HQ, 300m" once; when the office moves, one document changes and every assignee follows. |

## 3. Data model

**`GeofenceLocation`** — reusable circular fence.
`name` (unique), `address` (human reference only), `latitude`, `longitude`,
`radiusMeters` (min **50**), `isActive`, `createdBy`.

Circles, not polygons. Polygons need a map-drawing UI to be usable, and at the
error scale of consumer GPS indoors the extra precision is noise. A point and a
radius is something an admin can enter, verify and reason about from a phone.

The 50m floor is a correctness guard, not a UI nicety: a fence tighter than
typical GPS error rejects people who are genuinely standing inside it, at
random. An admin who types 10m has not built a stricter fence — they have built
one that fails unpredictably.

**`User.geofence`** — additive, inert by default.
`enabled` (default `false`), `locations[]` (refs), `assignedBy`, `assignedAt`.

There is deliberately **no global "fence everybody" switch**. A bug in this
feature locks people out of their jobs, so the blast radius of any mistake is
capped at whoever was individually opted in.

**`GeofenceEvent`** — append-only log of denials only.
Successful logins are *not* recorded: they are the highest-volume write, the
uninteresting case, and a per-login location history of every employee is a
surveillance dataset the feature does not need to work.

## 4. Enforcement

All logic lives in `server/utils/geofence.js` as pure functions — no mongoose,
no req/res. Both call sites ask the same `evaluate()`, so the login door and the
periodic re-check cannot drift apart.

### Exclusions (both hard-coded, both deliberate)

**Clients are never fenced.** They are external customers signing in from their
own offices, homes and countries. Checked on `userType`, *not* on role — a
`Client` document has no `role` field at all, so keying on role would read
`undefined` at exactly the moment the decision is made.

**Super Admins are never fenced.** This is a lockout guard, not a privilege.
Super Admin is the only account that can edit or remove a fence; if they could
be fenced out, one mistyped coordinate would lock the only person able to undo
it out of the system permanently. The feature must not be able to brick itself.
The API rejects any attempt to fence a Super Admin rather than accepting it and
silently exempting them.

### The accuracy grace

The browser reports a point **and** an `accuracy` — the radius within which it
is 95% confident. Indoors, which is exactly where fenced employees are, that is
routinely 50–200m and can exceed 1km. Ignoring it denies people at their own
desks.

So a user is admitted if they *could* be inside: distance is measured, then up
to **100m** of their stated uncertainty is subtracted. Capped, because uncapped
it degenerates — a device reporting 50km accuracy (browser IP fallback) would
otherwise satisfy any fence on the continent. Fixes worse than **5km** are
rejected outright as "not a location".

### Login flow

1. Client POSTs credentials **without** coordinates.
2. Server verifies the password **first**.
3. If the account is fenced and no coordinates were sent → **`428`**.
4. Client requests GPS, retries with coordinates.
5. Outside the fence → **`403`**.

**Why the password is checked first:** checking the fence first would turn login
into an oracle — an attacker with only an email address could learn whether that
account is geofenced and, by sweeping coordinates, roughly where its office is,
without ever knowing the password.

**Why 428 and not 403:** this is the reason unfenced users never see a location
prompt at all. Only the server knows whether an account is fenced, and only
after the password is verified. A `428` means "this account needs coordinates,
ask and retry"; a `403` would be indistinguishable from a genuine refusal and
leave the client unable to tell "ask for permission" (retrying fixes it) from
"you're in the wrong place" (retrying is pointless).

### Fail-closed / fail-open split

| Path | Behaviour | Reasoning |
|---|---|---|
| Login, no location | **Closed** | The requirement. |
| Login, all locations deactivated | **Closed** | Failing open would mean deactivating a location silently unfences everyone attached to it — the restriction evaporating with nothing surfacing that it has. |
| Login, corrupt location record | **Closed** | Same. Surfaces as `NO_ACTIVE_FENCE` with a message naming the cause. |
| Re-check, server error | **Open** | This endpoint's failure mode is tearing down the sessions of people who are working. A database blip must not sign out the company mid-task. The login door stays closed, so the worst case is an already-authenticated session surviving a few extra minutes. |
| Re-check, no GPS fix | **Open (skip cycle)** | A momentary indoor signal loss must not eject someone mid-task. |
| Re-check, permission revoked | **Closed** | Deliberate user action, not a transient failure. |

## 5. Threat model — stated plainly

**Coordinates are supplied by the client, and a determined technical user can
override them.** Chrome DevTools has a location spoofer built in; so does every
mobile emulator. Nothing in this design changes that, and no client-side code
could — the browser is the attacker's computer.

This is therefore an **access-control policy, not a tamper-proof security
boundary.** It reliably stops casual out-of-policy access — logging in from
home, from a cafe, a family member using saved credentials — which is the actual
thing being asked for. It does not stop a motivated insider who knows what
DevTools is.

If the requirement ever hardens to "must be un-spoofable", the answer is not
more client-side checking. It is a factor the browser cannot fabricate: the
office network as a second gate, or the biometric terminal this codebase already
integrates (`docs/biometric-attendance-integration.md`).

The mitigation that *does* work here is the audit log: spoofing leaves a trail
of physically impossible movement.

**Fence coordinates are never returned to the client** — not in a denial, not in
the status endpoint. Handing back the centre point would let anyone with a valid
password trilaterate it and spoof straight to it, turning a mild inconvenience
into a trivial one. Names and distances only.

## 6. Files

**Server**
- `models/GeofenceLocation.js`, `models/GeofenceEvent.js` — new
- `models/User.js` — additive `geofence` subdocument + two indexes
- `utils/geofence.js` — all decision logic, pure
- `controllers/geofenceController.js`, `routes/geofenceRoutes.js` — new
- `controllers/authController.js` — `enforceGeofence()` + login integration
- `app.js` — mounts `/api/geofence`
- `tests/geofence.test.js` — 43 assertions, runs standalone (`node server/tests/geofence.test.js`)

**Client**
- `utils/geolocation.js` — promise wrapper with named failure modes
- `api/geofenceApi.js`, `hooks/useGeofenceWatch.js` — new
- `pages/admin/GeofenceManagementPage.jsx` — Super Admin console (Locations / Assign Users / Denial Log)
- `pages/LoginPage.jsx` — two-attempt flow
- `App.jsx` — route + app-wide watcher
- `components/dashboard/Sidebar.jsx` — Super Admin menu entry

### Authorisation

`/api/geofence/*` management routes are **Super Admin only**, with no
`can(...)` permission-flag alternative alongside `authorize()` — unlike
`shiftRoutes.js`, `authRoutes.js` and the rest of the codebase, where that
pattern exists to let a Position be granted equivalent rights. Not here:
**whoever can edit a fence can lift their own restriction**, so delegating this
would hand every fenced-but-privileged user the ability to unfence themselves.

`/api/geofence/status` and `/verify` are `protect`-only — every user calls them
about themselves, and both are scoped to `req.user._id` server-side with no id
parameter to tamper with.

## 7. Rollout

The feature is inert on deploy. Every existing user has `geofence.enabled ===
false`, so nothing about anyone's ability to log in changes until a Super Admin
opts a specific person in. No migration script is needed.

Suggested first step: create one location using **"Use my current position"**
while standing in the office (this removes the transposed-lat/lng class of
error entirely), set 200–300m, assign it to **one** willing employee, and
confirm both the login check and the re-check behave before widening.

## 8. Known limitations

- **Spoofable** — see §5. By design, given the constraint of browser GPS.
- **Requires HTTPS.** `navigator.geolocation` is refused on plain http outside
  localhost. Surfaced as a distinct `INSECURE_CONTEXT` error, because otherwise
  the browser reports it as a permission denial that no amount of clicking
  "allow" will fix.
- **Up to ~10 minutes of drift** after leaving the fence before the session
  ends. Tightening the interval trades battery and GPS wake-ups against it.
- **No temporary travel exemption.** A fenced employee travelling for work must
  have their fence adjusted or disabled by a Super Admin. A time-boxed
  self-service exemption would be the natural follow-up if this proves painful.
