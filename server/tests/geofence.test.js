// tests/geofence.test.js
//
// Geofenced login (2026-08-07). Runs standalone, no database:
//
//     node server/tests/geofence.test.js
//
// server/utils/geofence.js is deliberately pure — no mongoose, no req/res — so
// every rule below is exercised directly rather than through HTTP.
//
// ─── WHAT THIS PINS DOWN ───
// This module decides whether people can do their jobs. Both failure
// directions are expensive and neither is loud: too tight and employees are
// locked out of work at their own desks (they complain, but the fix looks like
// "widen the radius until it stops", which erodes the fence); too loose and the
// restriction quietly means nothing while still appearing enabled on screen.
// The cases below are the ones where an innocuous-looking edit flips a branch:
// the accuracy grace cap, the fail-closed empty-fence path, the union-not-
// intersection rule for multiple locations, and the coordinate coercion traps
// (Number("") === 0 puts you in the Gulf of Guinea, NaN compares false against
// every bound).

'use strict';

const assert = require('assert');

// Pin the tunables to their defaults BEFORE loading the module under test.
//
// geofence.js reads GEOFENCE_* from the environment once at module load, so
// without this the suite's results depend on whoever's .env happens to be
// exported — it would pass on CI and fail on the machine of the one developer
// who set a wider grace to debug a false denial. A test that reports a
// different answer per machine is worse than no test: the next person to see
// it red assumes the environment, not the code.
//
// Deleting rather than assigning, so this asserts the SHIPPED defaults are
// still what the comments and the design doc claim.
delete process.env.GEOFENCE_ACCURACY_GRACE_METERS;
delete process.env.GEOFENCE_MAX_ACCURACY_METERS;

const geo = require('../utils/geofence');

const {
  haversineDistanceMeters,
  normalizeCoordinates,
  isSubjectToGeofence,
  evaluate,
  ACCURACY_GRACE_METERS,
  MAX_USABLE_ACCURACY_METERS,
} = geo;

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
};

/* ── Fixtures ─────────────────────────────────────────────────────────── */

// Tapvera's actual city, so the numbers are sanity-checkable against a map.
const KOLKATA_HQ = {
  _id: 'loc_hq',
  name: 'Kolkata HQ',
  latitude: 22.5726,
  longitude: 88.3639,
  radiusMeters: 200,
  isActive: true,
};

const DELHI_BRANCH = {
  _id: 'loc_delhi',
  name: 'Delhi Branch',
  latitude: 28.6139,
  longitude: 77.209,
  radiusMeters: 200,
  isActive: true,
};

// A perfect fix: zero uncertainty, so grace contributes nothing and the
// distance maths is tested on its own.
const exact = (latitude, longitude) => ({ latitude, longitude, accuracy: 0 });

/* ── Haversine ────────────────────────────────────────────────────────── */

console.log('\nhaversineDistanceMeters');

test('identical points are zero metres apart', () => {
  assert.strictEqual(haversineDistanceMeters(22.5726, 88.3639, 22.5726, 88.3639), 0);
});

test('one degree of latitude is ~111km', () => {
  const d = haversineDistanceMeters(22.0, 88.0, 23.0, 88.0);
  assert.ok(Math.abs(d - 111195) < 500, `expected ~111195m, got ${Math.round(d)}m`);
});

test('Kolkata to Delhi is ~1305km (guards against swapped lat/lng args)', () => {
  const d = haversineDistanceMeters(22.5726, 88.3639, 28.6139, 77.209);
  assert.ok(Math.abs(d - 1305000) < 20000, `expected ~1305km, got ${Math.round(d / 1000)}km`);
});

test('is symmetric', () => {
  const ab = haversineDistanceMeters(22.5726, 88.3639, 22.58, 88.37);
  const ba = haversineDistanceMeters(22.58, 88.37, 22.5726, 88.3639);
  assert.ok(Math.abs(ab - ba) < 1e-9);
});

test('handles the antimeridian without blowing up', () => {
  // Naive dLon arithmetic reports ~40,000km here instead of ~222km. Haversine
  // is immune because it goes through sin/cos, but this pins that it stays so.
  const d = haversineDistanceMeters(0, 179.9, 0, -179.9);
  assert.ok(d < 25000, `expected a short hop across the antimeridian, got ${Math.round(d / 1000)}km`);
});

/* ── Coordinate normalisation ─────────────────────────────────────────── */

console.log('\nnormalizeCoordinates');

test('accepts a well-formed fix', () => {
  const r = normalizeCoordinates({ latitude: 22.5726, longitude: 88.3639, accuracy: 20 });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.accuracy, 20);
});

test('accepts numeric strings (JSON clients send these)', () => {
  const r = normalizeCoordinates({ latitude: '22.5726', longitude: '88.3639', accuracy: '20' });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.latitude, 22.5726);
});

test('rejects a missing payload', () => {
  assert.strictEqual(normalizeCoordinates(undefined).valid, false);
  assert.strictEqual(normalizeCoordinates(null).valid, false);
  assert.strictEqual(normalizeCoordinates({}).valid, false);
});

test('rejects empty strings rather than reading them as (0,0)', () => {
  // Number('') === 0. Without the explicit guard this lands on Null Island in
  // the Gulf of Guinea — a real coordinate a large fence could contain.
  const r = normalizeCoordinates({ latitude: '', longitude: '', accuracy: 10 });
  assert.strictEqual(r.valid, false);
});

test('rejects null coordinates rather than reading them as (0,0)', () => {
  // Number(null) === 0, same trap as the empty string above.
  assert.strictEqual(normalizeCoordinates({ latitude: null, longitude: null }).valid, false);
});

test('rejects NaN and Infinity', () => {
  assert.strictEqual(normalizeCoordinates({ latitude: 'abc', longitude: 88 }).valid, false);
  assert.strictEqual(normalizeCoordinates({ latitude: Infinity, longitude: 88 }).valid, false);
});

test('rejects out-of-range coordinates', () => {
  assert.strictEqual(normalizeCoordinates({ latitude: 91, longitude: 0 }).valid, false);
  assert.strictEqual(normalizeCoordinates({ latitude: 0, longitude: 181 }).valid, false);
  assert.strictEqual(normalizeCoordinates({ latitude: -91, longitude: 0 }).valid, false);
});

test('accepts the exact boundary values', () => {
  assert.strictEqual(normalizeCoordinates({ latitude: 90, longitude: 180, accuracy: 5 }).valid, true);
  assert.strictEqual(normalizeCoordinates({ latitude: -90, longitude: -180, accuracy: 5 }).valid, true);
});

test('a missing accuracy is treated as the worst case, not as perfect', () => {
  // A hand-crafted client that omits the field must not earn more trust than
  // an honest browser that admits its uncertainty.
  const r = normalizeCoordinates({ latitude: 22.5726, longitude: 88.3639 });
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.accuracy, MAX_USABLE_ACCURACY_METERS);
});

test('rejects a fix too vague to be a location at all', () => {
  const r = normalizeCoordinates({
    latitude: 22.5726,
    longitude: 88.3639,
    accuracy: MAX_USABLE_ACCURACY_METERS + 1,
  });
  assert.strictEqual(r.valid, false);
  assert.match(r.reason, /precise/i);
});

/* ── Who is subject to the fence ──────────────────────────────────────── */

console.log('\nisSubjectToGeofence');

const fencedEmployee = {
  role: 'employee',
  geofence: { enabled: true, locations: ['loc_hq'] },
};

test('a fenced employee is subject', () => {
  assert.strictEqual(isSubjectToGeofence(fencedEmployee, 'User'), true);
});

test('clients are NEVER fenced, even if a geofence block somehow exists', () => {
  // The requirement is explicit and this is the load-bearing assertion for it.
  assert.strictEqual(isSubjectToGeofence({ ...fencedEmployee, role: undefined }, 'Client'), false);
});

test('clients are excluded on userType, not on role', () => {
  // A Client document has no `role` field — authController assigns "client"
  // only AFTER login succeeds. Keying on role here would read undefined at
  // exactly the moment the decision is made.
  const clientDoc = { email: 'c@x.com', geofence: { enabled: true, locations: ['loc_hq'] } };
  assert.strictEqual(isSubjectToGeofence(clientDoc, 'Client'), false);
});

test('super-admins are NEVER fenced — they are the only ones who can lift a fence', () => {
  assert.strictEqual(isSubjectToGeofence({ ...fencedEmployee, role: 'super-admin' }, 'User'), false);
  assert.strictEqual(isSubjectToGeofence({ ...fencedEmployee, role: 'superadmin' }, 'User'), false);
  assert.strictEqual(isSubjectToGeofence({ ...fencedEmployee, role: 'Super-Admin' }, 'User'), false);
});

test('admins and HR ARE fenceable (only super-admin is exempt)', () => {
  assert.strictEqual(isSubjectToGeofence({ ...fencedEmployee, role: 'admin' }, 'User'), true);
  assert.strictEqual(isSubjectToGeofence({ ...fencedEmployee, role: 'hr' }, 'User'), true);
});

test('users default to unfenced — the feature is inert until switched on', () => {
  assert.strictEqual(isSubjectToGeofence({ role: 'employee' }, 'User'), false);
  assert.strictEqual(
    isSubjectToGeofence({ role: 'employee', geofence: { enabled: false, locations: [] } }, 'User'),
    false
  );
});

test('enabled with no locations is not enforceable', () => {
  // The API refuses to save this state; if it arrives anyway (direct DB edit,
  // older document) it must not be read as "restricted to nowhere".
  assert.strictEqual(
    isSubjectToGeofence({ role: 'employee', geofence: { enabled: true, locations: [] } }, 'User'),
    false
  );
});

/* ── The decision ─────────────────────────────────────────────────────── */

console.log('\nevaluate');

test('dead centre of the fence is allowed', () => {
  const r = evaluate([KOLKATA_HQ], exact(KOLKATA_HQ.latitude, KOLKATA_HQ.longitude));
  assert.strictEqual(r.allowed, true);
  assert.strictEqual(r.code, 'INSIDE_FENCE');
  assert.strictEqual(r.nearest.name, 'Kolkata HQ');
});

test('just inside the radius is allowed', () => {
  // ~0.0009° latitude ≈ 100m north, comfortably within the 200m fence.
  const r = evaluate([KOLKATA_HQ], exact(22.5735, 88.3639));
  assert.strictEqual(r.allowed, true);
});

test('well outside the radius is denied', () => {
  // ~0.009° ≈ 1km north.
  const r = evaluate([KOLKATA_HQ], exact(22.5816, 88.3639));
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'OUTSIDE_FENCE');
});

test('a denial reports the distance so the user can act on it', () => {
  const r = evaluate([KOLKATA_HQ], exact(22.5816, 88.3639));
  assert.ok(r.nearest.distanceMeters > 900 && r.nearest.distanceMeters < 1100);
  assert.match(r.reason, /outside your permitted work location/i);
});

test('a denial does NOT leak fence coordinates', () => {
  // Handing back the centre would let anyone with a valid password spoof
  // straight to it. Names and distances only.
  const r = evaluate([KOLKATA_HQ], exact(22.5816, 88.3639));
  const serialised = JSON.stringify(r);
  assert.ok(!serialised.includes('88.3639') || !serialised.includes(String(KOLKATA_HQ.latitude)),
    'evaluate() result must not carry the fence centre back to the client');
  assert.strictEqual(r.nearest.latitude, undefined);
  assert.strictEqual(r.nearest.longitude, undefined);
});

test('another city is denied', () => {
  const r = evaluate([KOLKATA_HQ], exact(DELHI_BRANCH.latitude, DELHI_BRANCH.longitude));
  assert.strictEqual(r.allowed, false);
});

/* ── Accuracy grace ───────────────────────────────────────────────────── */

console.log('\nevaluate — GPS accuracy grace');

test('a poor-but-plausible fix just outside the edge is forgiven', () => {
  // ~250m from centre against a 200m fence: 50m outside. A phone reporting
  // 80m accuracy could genuinely be at their desk, so it is allowed.
  const r = evaluate([KOLKATA_HQ], { latitude: 22.57485, longitude: 88.3639, accuracy: 80 });
  assert.strictEqual(r.allowed, true);
});

test('the same position with a precise fix is denied', () => {
  // Identical coordinates, accuracy 5m — the device is confident, and it is
  // confident the user is outside. This is the pair that proves grace is
  // driven by reported uncertainty and not by distance alone.
  const r = evaluate([KOLKATA_HQ], { latitude: 22.57485, longitude: 88.3639, accuracy: 5 });
  assert.strictEqual(r.allowed, false);
});

test('grace is capped — a vague fix cannot satisfy a distant fence', () => {
  // 1km out with a 4000m accuracy circle. Uncapped, this "could" be inside and
  // would be admitted, which is exactly the degenerate case the cap exists for:
  // browsers fall back to IP positioning with huge accuracy values, and that
  // would otherwise unlock any fence in the region.
  const r = evaluate([KOLKATA_HQ], { latitude: 22.5816, longitude: 88.3639, accuracy: 4000 });
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'OUTSIDE_FENCE');
});

test('the shipped default grace is 100m', () => {
  // Guards the DEFAULT specifically — env overrides are cleared at the top of
  // this file. If someone widens the built-in value, that should be a
  // deliberate change to the design doc, not a quiet edit to a constant.
  assert.strictEqual(ACCURACY_GRACE_METERS, 100);
  assert.strictEqual(MAX_USABLE_ACCURACY_METERS, 5000);
});

test('grace never exceeds its cap', () => {
  // 500m outside a 200m fence — beyond the 100m grace — stays denied no matter
  // how large the claimed accuracy is.
  const r = evaluate([KOLKATA_HQ], { latitude: 22.5789, longitude: 88.3639, accuracy: 4999 });
  assert.strictEqual(r.allowed, false);
});

test('a mistyped grace override is clamped, not obeyed', () => {
  // Config must not be able to silently disable the property it configures.
  // 10000 instead of 100 would otherwise widen every fence in the system to
  // cover a whole city, with nothing on screen to show for it.
  //
  // Loaded in a child process because geofence.js reads the environment once
  // at module load, and this file has already loaded it with the defaults.
  const { execFileSync } = require('child_process');
  const read = (value) =>
    Number(
      execFileSync(
        process.execPath,
        ['-e', "process.stdout.write(String(require('../utils/geofence').ACCURACY_GRACE_METERS))"],
        { cwd: __dirname, env: { ...process.env, GEOFENCE_ACCURACY_GRACE_METERS: value } }
      ).toString()
    );

  assert.strictEqual(read('250'), 250, 'a sensible override should be honoured');
  assert.strictEqual(read('10000'), 500, 'an absurd override must clamp to the 500m ceiling');
  assert.strictEqual(read('abc'), 100, 'garbage must fall back to the default');
  assert.strictEqual(read('-5'), 100, 'a negative value must fall back to the default');
});

/* ── Multiple fences ──────────────────────────────────────────────────── */

console.log('\nevaluate — multiple assigned locations');

test('two fences are a UNION: either one admits', () => {
  const both = [KOLKATA_HQ, DELHI_BRANCH];
  assert.strictEqual(evaluate(both, exact(22.5726, 88.3639)).allowed, true, 'Kolkata should admit');
  assert.strictEqual(evaluate(both, exact(28.6139, 77.209)).allowed, true, 'Delhi should admit');
});

test('a point in neither fence is denied', () => {
  // Mumbai — an intersection reading would make ALL multi-fence users
  // permanently locked out, since no two offices overlap.
  const r = evaluate([KOLKATA_HQ, DELHI_BRANCH], exact(19.076, 72.8777));
  assert.strictEqual(r.allowed, false);
});

test('the denial names the NEAREST fence, not merely the first', () => {
  // Just outside Delhi, ~1300km from Kolkata. Reporting "Kolkata HQ" here
  // because it happens to be first in the array would be actively misleading.
  const r = evaluate([KOLKATA_HQ, DELHI_BRANCH], exact(28.65, 77.209));
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.nearest.name, 'Delhi Branch');
});

/* ── Fail-closed paths ────────────────────────────────────────────────── */

console.log('\nevaluate — fail-closed behaviour');

test('no location supplied is NO_LOCATION, distinct from a refusal', () => {
  // The HTTP layer maps this to 428 (retry with coordinates) rather than 403
  // (refusal). Collapsing the two would leave the client unable to tell "ask
  // for permission and retry" from "retrying is pointless".
  const r = evaluate([KOLKATA_HQ], undefined);
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'NO_LOCATION');
});

test('malformed coordinates are NO_LOCATION, never an accidental allow', () => {
  assert.strictEqual(evaluate([KOLKATA_HQ], { latitude: 'x', longitude: 'y' }).code, 'NO_LOCATION');
  assert.strictEqual(evaluate([KOLKATA_HQ], { latitude: NaN, longitude: NaN }).code, 'NO_LOCATION');
});

test('all locations deactivated fails CLOSED', () => {
  // Failing open here would mean deactivating a location silently unfences
  // everyone attached to it — the restriction evaporating with nothing
  // surfacing that it has.
  const r = evaluate([{ ...KOLKATA_HQ, isActive: false }], exact(22.5726, 88.3639));
  assert.strictEqual(r.allowed, false);
  assert.strictEqual(r.code, 'NO_ACTIVE_FENCE');
});

test('an empty or dangling location list fails CLOSED', () => {
  assert.strictEqual(evaluate([], exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
  assert.strictEqual(evaluate(null, exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
});

test('a location with a corrupt latitude is skipped, not trusted', () => {
  // Regression: Number(null) === 0 is finite, so a null latitude used to pass
  // the usability filter and be read as a real fence centred on Null Island in
  // the Gulf of Guinea — denying everyone assigned to it, for a reason
  // invisible on their user record.
  assert.strictEqual(evaluate([{ ...KOLKATA_HQ, latitude: null }], exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
  assert.strictEqual(evaluate([{ ...KOLKATA_HQ, longitude: null }], exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
  assert.strictEqual(evaluate([{ ...KOLKATA_HQ, latitude: '' }], exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
  assert.strictEqual(evaluate([{ ...KOLKATA_HQ, latitude: '22.5726' }], exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
});

test('a location with a zero or missing radius is skipped, not trusted', () => {
  // A zero radius is unsatisfiable by anyone, so treating it as a live fence
  // would lock out its assignees rather than surfacing the misconfiguration.
  assert.strictEqual(evaluate([{ ...KOLKATA_HQ, radiusMeters: 0 }], exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
  assert.strictEqual(evaluate([{ ...KOLKATA_HQ, radiusMeters: null }], exact(22.5726, 88.3639)).code, 'NO_ACTIVE_FENCE');
});

test('a corrupt location does not disable a healthy sibling', () => {
  const r = evaluate([{ ...DELHI_BRANCH, latitude: undefined }, KOLKATA_HQ], exact(22.5726, 88.3639));
  assert.strictEqual(r.allowed, true);
});

test('the no-location check runs before any distance maths', () => {
  // Ordering guard: if a missing payload were evaluated against fences first,
  // NaN comparisons decide the outcome, and which way they fall depends on the
  // direction of a `<=` that a refactor could silently flip.
  const r = evaluate([KOLKATA_HQ], {});
  assert.strictEqual(r.code, 'NO_LOCATION');
});

/* ── Summary ──────────────────────────────────────────────────────────── */

console.log(
  `\n${process.exitCode ? '✗ FAILURES — see above' : `✓ all ${passed} geofence assertions passed`}\n`
);
