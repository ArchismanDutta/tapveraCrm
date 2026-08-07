// server/scripts/verifyGeofenceQueries.js
//
// Geofenced login (2026-08-07) — pre-deploy smoke test.
//
//     node server/scripts/verifyGeofenceQueries.js              # READ-ONLY, safe on production
//     node server/scripts/verifyGeofenceQueries.js --write-test # adds a write round-trip
//
// server/tests/geofence.test.js covers the DECISION logic exhaustively, but it
// is deliberately database-free. That leaves the database access itself
// untested — the nested `populate("geofence.locations")` path, the assignee
// aggregate, and whether the new subdocument is registered on the real User
// schema. Those cannot be caught by a unit test or a build, and a typo'd
// populate path fails SILENTLY: mongoose returns unresolved ids rather than
// throwing, so the admin UI would just render an empty location list forever.
//
// ─── WHY THE DEFAULT IS READ-ONLY ───
// The first version of this script created and deleted a probe location. That
// is a tiny risk, but it is a write, and if the process is interrupted between
// the create and the delete the probe survives in the database. Asking someone
// to accept even a tiny risk on production to run a *diagnostic* is a bad
// trade, especially since it turns out to be unnecessary:
//
//   • Schema validators can be checked with validateSync(), which runs the
//     exact same validators with no database contact at all.
//   • The populate path can be verified STRUCTURALLY — reading the schema's
//     registered ref — which is a stronger check than a round-trip anyway. A
//     round-trip against an empty collection returns an empty array whether
//     the path is right or wrong, so it cannot actually distinguish the two.
//   • evaluate() takes plain objects, so the decision logic can be exercised
//     against an in-memory location.
//
// So the default path performs ZERO writes: only find/aggregate/countDocuments.
// Safe to run against production.

require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../models/User");
const GeofenceLocation = require("../models/GeofenceLocation");
const GeofenceEvent = require("../models/GeofenceEvent");
const { evaluate, isSubjectToGeofence } = require("../utils/geofence");

const WRITE_TEST = process.argv.includes("--write-test");
const PROBE_NAME = "__geofence_selftest__";

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg, err) => {
  failures += 1;
  console.error(`  ✗ ${msg}`);
  if (err) console.error(`    ${err.message}`);
};

const step = async (label, fn) => {
  try {
    const result = await fn();
    ok(typeof result === "string" ? `${label} — ${result}` : label);
    return result;
  } catch (err) {
    bad(label, err);
    return null;
  }
};

(async () => {
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI not set. Run from the server directory with your .env in place.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`\nConnected to "${mongoose.connection.name}"`);
  console.log(WRITE_TEST ? "Mode: WRITE TEST (creates and deletes one probe document)\n" : "Mode: READ-ONLY\n");

  // ── 1. Schema registration ──────────────────────────────────────────────
  console.log("Schema");

  await step("geofence.enabled is registered and defaults to false", async () => {
    const path = User.schema.path("geofence.enabled");
    if (!path) throw new Error("geofence.enabled is not a registered schema path");
    if (path.defaultValue !== false) {
      throw new Error(`defaults to ${path.defaultValue}, expected false — existing users would be fenced on deploy`);
    }
    return "existing users deploy unfenced";
  });

  await step("geofence.locations points at the GeofenceLocation model", async () => {
    // The structural version of the populate check. Stronger than a
    // round-trip: this is exactly what mongoose consults when resolving
    // populate("geofence.locations"), so if the ref is right, populate works —
    // and unlike a round-trip it gives a real answer against an empty
    // collection.
    const path = User.schema.path("geofence.locations");
    if (!path) throw new Error("geofence.locations is not a registered schema path");

    const ref = path.caster?.options?.ref || path.options?.ref;
    if (ref !== "GeofenceLocation") {
      throw new Error(`ref is "${ref}", expected "GeofenceLocation" — populate would silently return nothing`);
    }
    if (!mongoose.models.GeofenceLocation) {
      throw new Error("the GeofenceLocation model is not registered — populate would throw at runtime");
    }
    return "populate target resolves correctly";
  });

  await step("GeofenceEvent refs resolve", async () => {
    for (const [field, expected] of [["userId", "User"], ["nearestLocation", "GeofenceLocation"]]) {
      const ref = GeofenceEvent.schema.path(field)?.options?.ref;
      if (ref !== expected) throw new Error(`${field} refs "${ref}", expected "${expected}"`);
    }
    return "userId and nearestLocation both correct";
  });

  // ── 2. Validators — via validateSync(), no database contact ─────────────
  console.log("\nValidators (in-memory, nothing written)");

  await step("the 50m radius floor is enforced", async () => {
    const err = new GeofenceLocation({
      name: PROBE_NAME, latitude: 22.5726, longitude: 88.3639, radiusMeters: 10,
    }).validateSync();
    if (!err?.errors?.radiusMeters) throw new Error("a 10m radius passed validation");
    return "10m rejected";
  });

  await step("out-of-range coordinates are rejected", async () => {
    const err = new GeofenceLocation({
      name: PROBE_NAME, latitude: 999, longitude: 88.3639, radiusMeters: 200,
    }).validateSync();
    if (!err?.errors?.latitude) throw new Error("latitude 999 passed validation");
    return "latitude 999 rejected";
  });

  await step("a valid location passes", async () => {
    const err = new GeofenceLocation({
      name: PROBE_NAME, latitude: 22.5726, longitude: 88.3639, radiusMeters: 200,
    }).validateSync();
    if (err) throw new Error(`a valid location was rejected: ${err.message}`);
    return "no false rejections";
  });

  // ── 3. Read queries — the exact shapes the controller issues ────────────
  console.log("\nQueries (read-only)");

  await step("current fencing state across all users", async () => {
    const total = await User.countDocuments();
    const fenced = await User.countDocuments({ "geofence.enabled": true });
    return fenced === 0
      ? `0 of ${total} users fenced — feature inert, as expected pre-rollout`
      : `${fenced} of ${total} users currently fenced`;
  });

  await step("listAssignableUsers query shape runs", async () => {
    const users = await User.find({
      role: { $nin: ["super-admin", "superadmin"] },
      status: "active",
    })
      .select("name email employeeId role department position avatar geofence")
      .populate("geofence.locations", "name radiusMeters isActive")
      .populate("geofence.assignedBy", "name")
      .sort({ name: 1 })
      .limit(5)
      .lean();

    // If any user IS already fenced, this is the live proof that populate
    // resolved — the structural check above covers the empty case.
    const withFence = users.find((u) => u.geofence?.locations?.length);
    if (withFence && typeof withFence.geofence.locations[0]?.name !== "string") {
      throw new Error("populate returned unresolved ids on a real fenced user");
    }
    return `returned ${users.length} user(s)${withFence ? ", populate verified live" : ""}`;
  });

  await step("assignee-count aggregate runs", async () => {
    const counts = await User.aggregate([
      { $match: { "geofence.locations": { $exists: true, $ne: [] } } },
      { $unwind: "$geofence.locations" },
      { $group: { _id: "$geofence.locations", count: { $sum: 1 } } },
    ]);
    return `${counts.length} location group(s)`;
  });

  await step("denial-log query shape runs", async () => {
    const events = await GeofenceEvent.find()
      .populate("userId", "name email employeeId")
      .populate("nearestLocation", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    return `${events.length} event(s) on record`;
  });

  await step("existing locations, if any, are all usable", async () => {
    const locations = await GeofenceLocation.find().lean();
    if (!locations.length) return "none defined yet";

    // Catches the corrupt-row class of bug (null latitude reading as 0,0)
    // against real stored data rather than fixtures.
    const broken = locations.filter(
      (l) => typeof l.latitude !== "number" || typeof l.longitude !== "number" || !(l.radiusMeters > 0)
    );
    if (broken.length) {
      throw new Error(`${broken.length} location(s) have corrupt coordinates: ${broken.map((b) => b.name).join(", ")}`);
    }
    return `${locations.length} location(s), all valid`;
  });

  // ── 4. Decision logic against in-memory locations ───────────────────────
  console.log("\nDecision logic");

  const inMemory = [{
    _id: "probe", name: PROBE_NAME,
    latitude: 22.5726, longitude: 88.3639, radiusMeters: 200, isActive: true,
  }];

  await step("admits a point at the centre", async () => {
    const r = evaluate(inMemory, { latitude: 22.5726, longitude: 88.3639, accuracy: 15 });
    if (!r.allowed) throw new Error(`denied at the centre: ${r.reason}`);
    return "allowed";
  });

  await step("denies a point 1km away", async () => {
    const r = evaluate(inMemory, { latitude: 22.5816, longitude: 88.3639, accuracy: 15 });
    if (r.allowed) throw new Error("allowed a point 1km outside a 200m fence");
    return `denied at ${r.nearest.distanceMeters}m`;
  });

  await step("a REAL super-admin document is exempt", async () => {
    const admin = await User.findOne({ role: { $in: ["super-admin", "superadmin"] } }).lean();
    if (!admin) return "no super-admin found — skipped";

    const asIfFenced = { ...admin, geofence: { enabled: true, locations: ["x"] } };
    if (isSubjectToGeofence(asIfFenced, "User")) {
      throw new Error(`${admin.email} would be fenced — the lockout guard is broken`);
    }
    return `${admin.email} exempt, as designed`;
  });

  // ── 5. Optional write round-trip ────────────────────────────────────────
  if (WRITE_TEST) {
    console.log("\nWrite round-trip");
    await step("create, populate and delete a probe location", async () => {
      await GeofenceLocation.deleteOne({ name: PROBE_NAME }); // clear an interrupted prior run
      const probe = await GeofenceLocation.create({
        name: PROBE_NAME, address: "self-test",
        latitude: 22.5726, longitude: 88.3639, radiusMeters: 200,
      });
      try {
        const fake = User.hydrate({
          _id: new mongoose.Types.ObjectId(),
          name: "probe", email: "probe@selftest.local",
          geofence: { enabled: true, locations: [probe._id] },
        });
        await fake.populate({ path: "geofence.locations", select: "name" });
        if (fake.geofence.locations[0]?.name !== PROBE_NAME) {
          throw new Error("populate did not resolve the probe");
        }
      } finally {
        // finally, so an assertion failure still removes the probe.
        await GeofenceLocation.deleteOne({ name: PROBE_NAME });
      }
      return "round-trip clean, probe removed";
    });
  }

  await mongoose.disconnect();

  console.log(
    failures
      ? `\n✗ ${failures} check(s) failed — do not deploy until these are understood.\n`
      : `\n✓ All checks passed${WRITE_TEST ? "" : " (no writes performed)"}.\n`
  );
  process.exit(failures ? 1 : 0);
})().catch(async (err) => {
  console.error("\nFatal:", err.message);
  try {
    if (WRITE_TEST) await GeofenceLocation.deleteOne({ name: PROBE_NAME });
    await mongoose.disconnect();
  } catch { /* already down */ }
  process.exit(1);
});
