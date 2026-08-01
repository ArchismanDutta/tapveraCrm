// scripts/checkBiometricData.js
//
// Inspect exactly what the fingerprint terminal has sent us, straight from the
// database. Read-only — it changes nothing.
//
// Run on the server:
//     node scripts/checkBiometricData.js
//     node scripts/checkBiometricData.js --limit 50
//     node scripts/checkBiometricData.js --pin 1
//     node scripts/checkBiometricData.js --status UNMAPPED
//
// It answers, in order, the three questions worth asking when attendance isn't
// showing up:
//   1. Has the device ever contacted the server at all?
//   2. Has it sent any punches?
//   3. What exactly did it send, and what did we do with each one?
//
// See docs/biometric-attendance-integration.md
const mongoose = require("mongoose");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricPunch = require("../models/BiometricPunch");
const User = require("../models/User");
require("dotenv").config();

// ---- args ----
const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const LIMIT = Number(argVal("limit", 30));
const PIN = argVal("pin", null);
const STATUS = argVal("status", null);

const TZ = process.env.BIOMETRIC_DEVICE_TIMEZONE || "Asia/Kolkata";
const line = (c = "=") => console.log(c.repeat(100));

// Show times in the device's own timezone — comparing a UTC timestamp against
// what someone remembers doing at 9:30am is how timezone bugs get missed.
const local = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        timeZone: TZ,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "—";

const ago = (d) => {
  if (!d) return "never";
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");
  console.log(`   Device timezone: ${TZ}  (all times below shown in this zone)\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. DEVICES — has the machine ever reached us?
  // ───────────────────────────────────────────────────────────────────────────
  line();
  console.log("📟 DEVICES");
  line();

  const devices = await BiometricDevice.find().lean();

  if (!devices.length) {
    console.log("\n❌ No device has ever contacted this server.\n");
    console.log("   The terminal has not completed a single handshake. Check, in order:");
    console.log("     • Device network — Gateway and DNS must not be 0.0.0.0");
    console.log("     • Cloud Server Setting — ADMS, domain ON, web.tapvera.io, HTTPS ON, port 443");
    console.log("     • curl -i https://web.tapvera.io/iclock/cdata   → must return plain 'OK'");
    console.log("     • Cloudflare must not be challenging /iclock/*\n");
  } else {
    for (const d of devices) {
      const staleMins = d.lastSeenAt
        ? Math.round((Date.now() - new Date(d.lastSeenAt).getTime()) / 60000)
        : null;
      const online = staleMins !== null && staleMins <= 15;

      console.log(`\n  ${online ? "🟢 ONLINE " : "🔴 OFFLINE"}  ${d.serialNumber}  ${d.name || ""}`);
      console.log(`     Enabled:      ${d.enabled ? "yes" : "NO — punches rejected"}`);
      console.log(
        `     Dry-run:      ${
          d.dryRun ? "YES — punches captured but NOT written to attendance" : "no (live)"
        }`
      );
      console.log(`     Last contact: ${local(d.lastSeenAt)}  (${ago(d.lastSeenAt)})`);
      console.log(`     Last push:    ${local(d.lastPushAt)}  (${ago(d.lastPushAt)})`);
      console.log(`     Newest punch: ${local(d.lastPunchAt)}`);
      console.log(`     Device IP:    ${d.deviceIp || "—"}`);
      console.log(
        `     Totals:       received=${d.stats?.totalPunchesReceived || 0} ` +
          `applied=${d.stats?.totalPunchesApplied || 0} ` +
          `dupe=${d.stats?.totalPunchesDuplicate || 0} ` +
          `unmapped=${d.stats?.totalPunchesUnmapped || 0} ` +
          `failed=${d.stats?.totalPunchesFailed || 0}`
      );
    }
    console.log("");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. TOTALS — has it sent punches, and what happened to them?
  // ───────────────────────────────────────────────────────────────────────────
  line();
  console.log("📊 PUNCH TOTALS (all time)");
  line();

  const byStatus = await BiometricPunch.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const total = byStatus.reduce((s, r) => s + r.count, 0);

  if (!total) {
    console.log("\n⚠️  No punches received yet.");
    console.log(
      "   If a device shows ONLINE above, the handshake works but nobody has scanned,"
    );
    console.log("   or the device is not transmitting attendance. Scan a finger and re-run.\n");
  } else {
    console.log("");
    const meaning = {
      APPLIED: "written into attendance ✅",
      DUPLICATE: "device re-send or finger re-scan (ignored, correct)",
      UNMAPPED: "no employee has this PIN — map them, punches replay automatically",
      SKIPPED: "a business rule declined it — see message",
      FAILED: "unexpected error — safe to replay",
      DRY_RUN: "device in dry-run — captured but not counted",
      PENDING: "received, not yet processed",
    };
    for (const r of byStatus) {
      console.log(`  ${String(r._id).padEnd(10)} ${String(r.count).padStart(5)}   ${meaning[r._id] || ""}`);
    }
    console.log(`  ${"TOTAL".padEnd(10)} ${String(total).padStart(5)}\n`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. RAW PUNCHES — the literal bytes the machine sent
  // ───────────────────────────────────────────────────────────────────────────
  const query = {};
  if (PIN) query.pin = String(PIN).trim();
  if (STATUS) query.status = String(STATUS).toUpperCase();

  const punches = await BiometricPunch.find(query)
    .populate("userId", "name employeeId")
    .sort({ punchedAt: -1 })
    .limit(LIMIT)
    .lean();

  line();
  console.log(
    `🔍 RAW PUNCHES (newest ${punches.length}` +
      `${PIN ? `, pin=${PIN}` : ""}${STATUS ? `, status=${STATUS}` : ""})`
  );
  line();

  if (!punches.length) {
    console.log("\n  Nothing matches that filter.\n");
  } else {
    for (const p of punches) {
      console.log("");
      console.log(`  PIN ${p.pin}  →  ${p.userId ? `${p.userId.name} (${p.userId.employeeId})` : "❓ UNRECOGNISED"}`);
      console.log(`     Punched at:  ${local(p.punchedAt)}`);
      console.log(`     Received:    ${local(p.createdAt)}`);
      console.log(`     Device:      ${p.serialNumber}`);
      console.log(`     Status:      ${p.status}${p.resolvedAction ? ` → ${p.resolvedAction}` : ""}`);
      if (p.message) console.log(`     Message:     ${p.message}`);
      if (p.attendanceDate)
        console.log(`     Booked to:   ${new Date(p.attendanceDate).toISOString().split("T")[0]}`);
      // The verbatim line as it came off the wire. This is the ground truth —
      // if the parse looks wrong, compare against this.
      console.log(`     RAW LINE:    ${JSON.stringify(p.rawLine)}`);
      console.log(
        `     Raw fields:  status=${p.rawStatus || "—"} verify=${p.rawVerify || "—"} workcode=${p.rawWorkCode || "—"}`
      );
    }
    console.log("");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. MAPPING STATE — who can and can't produce attendance
  // ───────────────────────────────────────────────────────────────────────────
  line();
  console.log("🔗 PIN MAPPING");
  line();

  const mapped = await User.find({
    status: "active",
    biometricPin: { $nin: [null, undefined, ""] },
  })
    .select("name employeeId biometricPin")
    .sort({ biometricPin: 1 })
    .lean();

  const unmappedCount = await User.countDocuments({
    status: "active",
    biometricPin: { $in: [null, undefined] },
  });

  console.log(`\n  Mapped: ${mapped.length}    Unmapped active staff: ${unmappedCount}\n`);

  if (mapped.length) {
    for (const u of mapped) {
      console.log(`     PIN ${String(u.biometricPin).padEnd(6)} → ${u.name} (${u.employeeId})`);
    }
    console.log("");
  } else {
    console.log("  ⚠️  Nobody is mapped yet — no device punch can become attendance.");
    console.log("     Map them at:  Sidebar → Biometric Device\n");
  }

  // PINs the hardware is sending that match nobody
  const orphanPins = await BiometricPunch.aggregate([
    { $match: { status: "UNMAPPED" } },
    { $group: { _id: "$pin", count: { $sum: 1 }, lastSeen: { $max: "$punchedAt" } } },
    { $sort: { lastSeen: -1 } },
  ]);

  if (orphanPins.length) {
    console.log("  ⚠️  PINs the device is sending that match no employee:\n");
    for (const o of orphanPins) {
      console.log(`     PIN ${String(o._id).padEnd(6)} ${o.count} punch(es), last ${local(o.lastSeen)}`);
    }
    console.log("\n     Assign these at: Sidebar → Biometric Device → 'PINs waiting to be assigned'");
    console.log("     Their punches replay into attendance automatically once mapped.\n");
  }

  line();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\n❌ Failed:", err.message);
  process.exit(1);
});
