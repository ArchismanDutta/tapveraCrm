// scripts/checkDeviceClockSkew.js
//
// Is the fingerprint terminal's clock telling the truth?
//
// Diagnoses the "punched at 5:00, CRM shows 4:30" class of bug from data we
// already hold, without touching the device. Read-only.
//
//     node scripts/checkDeviceClockSkew.js
//     node scripts/checkDeviceClockSkew.js --days 14
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW THE MEASUREMENT WORKS
// ─────────────────────────────────────────────────────────────────────────────
// The device pushes in realtime (Realtime=1 in the handshake): a punch reaches
// the server within seconds of the finger touching the sensor. So for punches
// that arrived alone — not in a backlog dump after an outage — the difference
//
//     createdAt (our clock, when the row was written)
//   − punchedAt (the DEVICE's clock, converted using its configured timezone)
//
// is network latency plus processing, i.e. single-digit seconds, PLUS whatever
// the device clock is wrong by. Median it over days of punches and the noise
// averages out, leaving the clock error.
//
//   median ≈ +1800s  → device clock 30 min behind — the handshake TimeZone=5.5
//                      truncation signature (firmware read it as UTC+5:00)
//   median ≈ 0–15s   → clock healthy
//   median < 0       → device clock AHEAD (punch times stamped in the future)
//
// Backlog batches are excluded by only counting punches whose arrival lag is
// under one hour — a device that was offline for an afternoon delivers punches
// hours late through no fault of its clock.
"use strict";

const mongoose = require("mongoose");
const BiometricDevice = require("../models/BiometricDevice");
const BiometricPunch = require("../models/BiometricPunch");
require("dotenv").config();

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const DAYS = Number(argVal("days", 7));
const MAX_REALTIME_LAG_MS = 60 * 60 * 1000; // beyond this it's a backlog row

const fmt = (s) => {
  const sign = s < 0 ? "-" : "+";
  const abs = Math.abs(s);
  return abs >= 90
    ? `${sign}${Math.round(abs / 60)} min ${Math.round(abs % 60)}s`
    : `${sign}${Math.round(abs)}s`;
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
  const devices = await BiometricDevice.find({}).lean();

  if (devices.length === 0) {
    console.log("No biometric devices registered.");
    process.exit(0);
  }

  console.log(`Clock-skew check — last ${DAYS} day(s), realtime punches only\n`);

  for (const device of devices) {
    const rows = await BiometricPunch.find({
      serialNumber: device.serialNumber,
      createdAt: { $gte: since },
    })
      .select("punchedAt createdAt")
      .lean();

    const lags = rows
      .map((r) => r.createdAt.getTime() - r.punchedAt.getTime())
      .filter((ms) => Math.abs(ms) < MAX_REALTIME_LAG_MS)
      .map((ms) => ms / 1000)
      .sort((a, b) => a - b);

    console.log(`── ${device.serialNumber} (${device.name || "unnamed"}) ──`);

    if (lags.length === 0) {
      console.log(`   no realtime punches in window (${rows.length} backlog rows excluded)\n`);
      continue;
    }

    const median = lags[Math.floor(lags.length / 2)];
    const p10 = lags[Math.floor(lags.length * 0.1)];
    const p90 = lags[Math.floor(lags.length * 0.9)];

    console.log(`   punches measured : ${lags.length} (of ${rows.length} in window)`);
    console.log(`   median lag       : ${fmt(median)}   (p10 ${fmt(p10)} · p90 ${fmt(p90)})`);

    if (Math.abs(median) > 120) {
      const dir = median > 0 ? "BEHIND" : "AHEAD";
      console.log(`   ⚠️  device clock is ~${Math.round(Math.abs(median) / 60)} min ${dir}.`);
      console.log(`      Every punch it stamps is off by that amount at the source.`);
      if (median > 1500 && median < 2100) {
        console.log(`      ~30 min behind is the TimeZone=5.5 truncation signature —`);
        console.log(`      the firmware read it as UTC+5:00. The handshake now sends the`);
        console.log(`      minutes form (330); power-cycle the device so it re-handshakes,`);
        console.log(`      then re-run this script and expect a median under ~15s.`);
      }
    } else {
      console.log(`   ✓ clock healthy (median within normal delivery latency)`);
    }
    console.log("");
  }

  console.log(
    "Note: historical punches recorded while the clock was wrong remain wrong in the\n" +
      "database — they were stamped wrong at the source. Correct any that matter for\n" +
      "payroll via the admin manual-punch flow."
  );

  process.exit(0);
})().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
