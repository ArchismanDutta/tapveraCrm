// scripts/replayFailedPunches.js
//
// Recover punches that were rejected and never became attendance.
//
//     node scripts/replayFailedPunches.js --dry-run
//     node scripts/replayFailedPunches.js
//     node scripts/replayFailedPunches.js --hours 24
//
// ─────────────────────────────────────────────────────────────────────────────
// THE CASE THIS EXISTS FOR
// ─────────────────────────────────────────────────────────────────────────────
// A clock correction was configured while the device ran slow. When the device
// clock was later fixed, that correction started pushing punches into the
// FUTURE — and validatePunchEvent refuses anything more than 5 minutes ahead,
// so every scan failed with "Cannot record future events" and those employees
// have no attendance at all for the day.
//
// The raw rows are all still in BiometricPunch (nothing is ever discarded), so
// once the offset is back to 0 they can simply be reprocessed at their true
// times.
//
// ⚠️  SET BIOMETRIC_CLOCK_OFFSET_MINUTES=0 AND RESTART FIRST. Replaying while
// the bad offset is still active just fails them all again — this script
// refuses to run in that state rather than letting you find out afterwards.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const argVal = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const HOURS = Number(argVal('hours', 12));

const ist = (d) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
}).format(new Date(d));

(async () => {
  const offset = Number(process.env.BIOMETRIC_CLOCK_OFFSET_MINUTES || 0);

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const BiometricPunch = require('../models/BiometricPunch');
  const since = new Date(Date.now() - HOURS * 3600 * 1000);

  const failed = await BiometricPunch.find({
    status: 'FAILED',
    punchedAt: { $gte: since },
  }).sort({ punchedAt: 1 }).select('pin punchedAt message userId').lean();

  console.log(`\nFailed punches in the last ${HOURS}h: ${failed.length}`);
  console.log(`Current BIOMETRIC_CLOCK_OFFSET_MINUTES: ${offset}\n`);

  const futureErrors = failed.filter((p) => /future/i.test(p.message || ''));

  if (futureErrors.length && offset !== 0) {
    console.log('─'.repeat(80));
    console.log('REFUSING TO REPLAY.');
    console.log('');
    console.log(`${futureErrors.length} punch(es) failed with "Cannot record future events", which`);
    console.log(`means the device clock is now accurate and the +${offset} min correction is pushing`);
    console.log('them past the 5-minute future tolerance. Replaying now would fail them all again.');
    console.log('');
    console.log('  1. Set BIOMETRIC_CLOCK_OFFSET_MINUTES=0 in .env');
    console.log('  2. pm2 restart <app> --update-env');
    console.log('  3. Re-run this script');
    console.log('─'.repeat(80));
    process.exit(1);
  }

  if (!failed.length) {
    console.log('Nothing to replay.');
    process.exit(0);
  }

  console.log('─'.repeat(80));
  for (const p of failed) {
    console.log(`  PIN ${String(p.pin).padEnd(4)} ${ist(p.punchedAt)}  ${p.message || ''}`);
  }
  console.log('─'.repeat(80));

  if (DRY_RUN) {
    console.log(`\nDRY RUN — would replay ${failed.length} punch(es) at offset ${offset}.`);
    console.log('Re-run without --dry-run to apply.');
    process.exit(0);
  }

  const BiometricAttendanceService = require('../services/biometric/BiometricAttendanceService');
  const service = new BiometricAttendanceService();

  // Oldest first, so each person's first scan of the day opens their record and
  // later ones land as presence evidence — the same ordering the live path uses.
  const summary = await service.replayPunches({ status: ['FAILED'], since, limit: 500 });

  console.log('\nReplay complete:');
  console.log(`  examined       : ${summary.examined}`);
  console.log(`  applied        : ${summary.applied}`);
  console.log(`  skipped        : ${summary.skipped}`);
  console.log(`  still unmapped : ${summary.stillUnmapped}`);
  console.log(`  failed         : ${summary.failed}`);
  console.log('\nCheck the result with: node scripts/checkPunchRejections.js');
  process.exit(0);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
