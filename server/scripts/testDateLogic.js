// Test date logic to understand the issue

const recordDateUTC = new Date('2025-10-05T18:30:00.000Z'); // What's stored in DB
const arrivalTimeUTC = new Date('2025-10-06T11:09:32.728Z'); // Punch time

console.log('='.repeat(80));
console.log('📅 DATE LOGIC TEST');
console.log('='.repeat(80));

console.log('\n🗄️  From Database:');
console.log('   Record Date (UTC):', recordDateUTC.toISOString());
console.log('   Record Date (IST):', recordDateUTC.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
console.log('   Arrival Time (UTC):', arrivalTimeUTC.toISOString());
console.log('   Arrival Time (IST):', arrivalTimeUTC.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

console.log('\n\n❌ WRONG WAY (current frontend):');
console.log('   Using: new Date(record.date).setHours(20, 0, 0, 0)');
const expectedWrong = new Date(recordDateUTC);
expectedWrong.setHours(20, 0, 0, 0);
console.log('   Expected Start (UTC):', expectedWrong.toISOString());
console.log('   Expected Start (IST):', expectedWrong.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
const lateMinWrong = Math.round((arrivalTimeUTC - expectedWrong) / 60000);
console.log('   Late Minutes:', lateMinWrong);
console.log('   Result:', lateMinWrong > 0 ? 'LATE' : 'NOT LATE');

console.log('\n\n✅ CORRECT WAY:');
console.log('   Need: Oct 5, 2025 at 20:00 IST');
// Get the date string from the record (Oct 5)
const dateStr = recordDateUTC.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
console.log('   Date string:', dateStr);

// Create shift start time on Oct 5 at 20:00 IST
const shiftStartIST = new Date(dateStr + 'T20:00:00+05:30');
console.log('   Shift Start (UTC):', shiftStartIST.toISOString());
console.log('   Shift Start (IST):', shiftStartIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
const lateMinCorrect = Math.round((arrivalTimeUTC - shiftStartIST) / 60000);
console.log('   Late Minutes:', lateMinCorrect);
console.log('   Result:', lateMinCorrect > 0 ? 'LATE' : 'NOT LATE');

console.log('\n\n🔍 THE REAL ISSUE:');
console.log('   The record.date represents Oct 5 in IST');
console.log('   When stored as UTC, it becomes Oct 5 18:30 UTC (which is Oct 6 00:00 IST)');
console.log('   When frontend does new Date(record.date), it gets Oct 5 18:30 UTC');
console.log('   When it does setHours(20, 0), it sets to Oct 6 20:00 LOCAL TIME');
console.log('   But we need Oct 5 20:00 IST!');

console.log('\n\n💡 SOLUTION:');
console.log('   Extract just the DATE PART (YYYY-MM-DD) from record.date');
console.log('   Then construct a new Date with that date + shift time in local timezone');
