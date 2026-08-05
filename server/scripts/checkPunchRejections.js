// scripts/checkPunchRejections.js
//
// Why are punches not becoming attendance?
//
//     node scripts/checkPunchRejections.js
//     node scripts/checkPunchRejections.js --pin 5
//     node scripts/checkPunchRejections.js --hours 24
//
// checkClockOffsetLive.js showed punches arriving with SKIPPED and FAILED
// status. Both mean the raw row was stored but no attendance event was written,
// so the CRM keeps showing whatever was recorded earlier. Each row carries a
// `message` saying exactly why — this prints it, alongside what the employee's
// attendance record actually looks like, so the two can be compared.
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const PIN = argVal('pin', null);
const HOURS = Number(argVal('hours', 12));

const ist = (d) => d ? new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
}).format(new Date(d)) : '—';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const BiometricPunch = require('../models/BiometricPunch');
  const AttendanceRecord = require('../models/AttendanceRecord');
  const User = require('../models/User');

  const since = new Date(Date.now() - HOURS * 3600 * 1000);
  const query = { punchedAt: { $gte: since } };
  if (PIN) query.pin = String(PIN);

  const punches = await BiometricPunch.find(query).sort({ punchedAt: -1 }).limit(40).lean();

  console.log(`\nPunches in the last ${HOURS}h${PIN ? ` for PIN ${PIN}` : ''}: ${punches.length}\n`);
  console.log('─'.repeat(110));

  // Group by status so the pattern is obvious rather than buried in a list.
  const byStatus = {};
  for (const p of punches) (byStatus[p.status] ||= []).push(p);

  for (const [status, rows] of Object.entries(byStatus)) {
    console.log(`\n${status}  (${rows.length})`);
    for (const p of rows.slice(0, 10)) {
      const off = p.appliedOffsetMinutes || 0;
      const corrected = new Date(new Date(p.punchedAt).getTime() + off * 60000);
      console.log(`   PIN ${String(p.pin).padEnd(4)} ${ist(p.punchedAt)} (+${off}m → ${ist(corrected)})`);
      console.log(`      action : ${p.resolvedAction || '—'}`);
      console.log(`      reason : ${p.message || '(none recorded)'}`);
    }
  }

  console.log('\n' + '─'.repeat(110));

  // For the PINs seen, show what attendance actually holds today — the number
  // the CRM is displaying — so it can be compared against the punches above.
  const pins = [...new Set(punches.map((p) => p.pin))].slice(0, 8);
  const users = await User.find({ biometricPin: { $in: pins } }).select('_id name biometricPin').lean();

  // Match on a day RANGE, not equality.
  //
  // AttendanceRecord.date is normalised with normalizeDate() — server-LOCAL
  // midnight — while setUTCHours(0,0,0,0) gives UTC midnight. On an IST box
  // those are 5h30m apart, so this lookup missed the record entirely and
  // reported "no attendance row today" for people who did have one. A false
  // alarm at exactly the moment you're trying to establish who is genuinely
  // missing attendance.
  const nowTs = Date.now();
  const records = await AttendanceRecord.find({
    date: { $gte: new Date(nowTs - 36 * 3600 * 1000), $lte: new Date(nowTs + 12 * 3600 * 1000) },
  }).lean();

  // Pick whichever record actually contains today's people.
  const record = records
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .find((r) => (r.employees || []).some((e) => users.some((u) => String(u._id) === String(e.userId))))
    || records[records.length - 1]
    || null;

  console.log("\nWhat attendance actually holds for today (what the CRM shows):\n");
  for (const u of users) {
    const emp = (record?.employees || []).find((e) => String(e.userId) === String(u._id));
    if (!emp) { console.log(`   ${u.name} (PIN ${u.biometricPin}): no attendance row today`); continue; }
    console.log(`   ${u.name} (PIN ${u.biometricPin})`);
    console.log(`      arrival  : ${ist(emp.calculated?.arrivalTime)}`);
    console.log(`      status   : ${emp.calculated?.currentStatus}`);
    console.log(`      events   : ${(emp.events || []).map((e) => `${e.type}@${ist(e.timestamp)}`).join(', ') || 'none'}`);
  }

  console.log('\n' + '─'.repeat(110));
  console.log('SKIPPED = a business rule rejected it (already punched in, on break, duplicate).');
  console.log('FAILED  = an unexpected error; the reason above is the exception message.');
  process.exit(0);
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
