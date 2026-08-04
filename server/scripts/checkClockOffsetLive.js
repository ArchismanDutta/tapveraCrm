// scripts/checkClockOffsetLive.js
//
// Answers one question, on the machine that actually receives the punches:
// "is the clock correction live, and is it being applied?"
//
//     node scripts/checkClockOffsetLive.js
//
// Written because "the fix isn't working" has four possible causes and they
// are indistinguishable from the outside: code not deployed, env var not set,
// process not restarted, or per-device override disagreeing with the global
// default. This prints all four.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const ist = (d) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  }).format(new Date(d));

(async () => {
  console.log('─'.repeat(72));

  // 1. Is the code deployed?
  const svcPath = path.join(__dirname, '..', 'services', 'biometric', 'BiometricAttendanceService.js');
  const hasOffsetCode = fs.readFileSync(svcPath, 'utf8').includes('BIOMETRIC_CLOCK_OFFSET_MINUTES');
  console.log(`1. Clock-offset code present : ${hasOffsetCode ? 'YES' : 'NO  <- git pull needed'}`);

  // 2. Is the env var set in THIS process?
  const envVal = process.env.BIOMETRIC_CLOCK_OFFSET_MINUTES;
  console.log(`2. Env var in .env           : ${envVal === undefined ? 'NOT SET  <- add it' : envVal}`);

  if (!hasOffsetCode) {
    console.log('\nStop here: deploy the code first, then re-run.');
    process.exit(1);
  }

  // 3. What does the service actually resolve, per device?
  const Svc = require('../services/biometric/BiometricAttendanceService');
  const svc = Object.create(Svc.prototype);

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const BiometricDevice = require('../models/BiometricDevice');
  const BiometricPunch = require('../models/BiometricPunch');

  const devices = await BiometricDevice.find({}).lean();
  console.log(`3. Resolved offset per device:`);
  if (!devices.length) console.log('     (no devices registered)');
  for (const d of devices) {
    const resolved = svc.clockOffsetFor(d);
    const source = d.clockOffsetMinutes !== null && d.clockOffsetMinutes !== undefined
      ? 'per-device override'
      : 'global env default';
    console.log(`     ${d.serialNumber}: ${resolved} min  (${source})`);
  }

  // 4. Is it actually being applied to incoming punches?
  console.log('4. Most recent punches (raw device time -> what we recorded):');
  const recent = await BiometricPunch.find({})
    .sort({ punchedAt: -1 })
    .limit(5)
    .select('pin punchedAt appliedOffsetMinutes status createdAt')
    .lean();

  if (!recent.length) console.log('     (none received yet)');
  for (const p of recent) {
    const off = p.appliedOffsetMinutes || 0;
    const corrected = new Date(new Date(p.punchedAt).getTime() + off * 60000);
    const flag = off === 0 ? '  <- NO correction applied' : '';
    console.log(
      `     PIN ${String(p.pin).padEnd(4)} device ${ist(p.punchedAt)} +${off}min -> ${ist(corrected)}  [${p.status}]${flag}`
    );
  }

  // 5. Was the process restarted after the change?
  const upSeconds = Math.floor(process.uptime());
  console.log(`\n   (this script is a fresh process; check the SERVER's uptime with:`);
  console.log(`    pm2 info <app> | grep uptime   — restart it if older than your .env edit)`);

  console.log('─'.repeat(72));
  const anyUncorrected = recent.some((p) => !p.appliedOffsetMinutes);
  if (anyUncorrected && envVal && Number(envVal) !== 0) {
    console.log('DIAGNOSIS: punches are arriving with no correction while the env var is set.');
    console.log('           The running process predates the change — restart it.');
  }
  process.exit(0);
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
