const moment = require("moment");
const Holiday = require("../models/Holiday");

// Check if a given date is a holiday or weekend, for a given shift (default 'ALL')
async function isHolidayOrWeekend(date, shift = "ALL") {
  const checkDate = moment(date).startOf("day");
  // Weekend check: Sunday=0, Saturday=6
  if (checkDate.day() === 0 || checkDate.day() === 6) return true;

  const start = checkDate.toDate();
  const end = checkDate.clone().endOf("day").toDate();

  const holiday = await Holiday.findOne({
    date: { $gte: start, $lte: end },
    $or: [{ shifts: "ALL" }, { shifts: shift }],
  });
  return !!holiday;
}
exports.isHolidayOrWeekend = isHolidayOrWeekend;

// Check single date holiday status including sandwich policy
exports.checkHoliday = async (date, shift = "ALL") => {
  const checkDate = moment(date, "YYYY-MM-DD");

  if (checkDate.day() === 0 || checkDate.day() === 6) {
    return { isHoliday: true, reason: "Weekend", sandwich: false };
  }

  const start = checkDate.startOf("day").toDate();
  const end = checkDate.endOf("day").toDate();

  const holiday = await Holiday.findOne({
    date: { $gte: start, $lte: end },
    $or: [{ shifts: "ALL" }, { shifts: shift }],
  });

  if (holiday) {
    return { isHoliday: true, reason: holiday.name, sandwich: false };
  }

  // Sandwich Policy: check if day is sandwiched between holidays/weekends
  const prevDate = checkDate.clone().subtract(1, "day");
  const nextDate = checkDate.clone().add(1, "day");

  const prevHoliday = await isHolidayOrWeekend(prevDate, shift);
  const nextHoliday = await isHolidayOrWeekend(nextDate, shift);

  if (prevHoliday && nextHoliday) {
    return {
      isHoliday: false,
      sandwich: true,
      reason: "Sandwich Policy Applied (between two holidays/weekends)",
    };
  }

  return { isHoliday: false, sandwich: false };
};

// Get all holidays, optionally filtered by shift
exports.getAllHolidays = async (shift = null) => {
  if (!shift || shift === "ALL") {
    return await Holiday.find({});
  }
  return await Holiday.find({
    $or: [{ shifts: "ALL" }, { shifts: shift }],
  });
};

// Add a new holiday
exports.addHoliday = async (data) => {
  return await Holiday.create(data);
};

// Update holiday by ID
exports.updateHoliday = async (id, data) => {
  return await Holiday.findByIdAndUpdate(id, data, { new: true });
};

// Delete holiday by ID
exports.deleteHoliday = async (id) => {
  return await Holiday.findByIdAndDelete(id);
};

// Apply sandwich policy expansion for employee leave dates
exports.applySandwichPolicy = async (employeeLeaves = [], shift = "ALL") => {
  if (!employeeLeaves.length) return [];

  const leaves = employeeLeaves.map((d) => moment(d).startOf("day"));
  const allHolidays = await Holiday.find({
    $or: [{ shifts: "ALL" }, { shifts: shift }],
  });
  const holidayDates = allHolidays.map((h) => moment(h.date).startOf("day"));
  const expandedLeaves = new Set();

  for (let leave of leaves) {
    expandedLeaves.add(leave.format("YYYY-MM-DD"));
    const prev = leave.clone().subtract(1, "day");
    if (await isHolidayOrWeekend(prev, shift)) {
      expandedLeaves.add(prev.format("YYYY-MM-DD"));
    }
    const next = leave.clone().add(1, "day");
    if (await isHolidayOrWeekend(next, shift)) {
      expandedLeaves.add(next.format("YYYY-MM-DD"));
    }
  }

  return Array.from(expandedLeaves).sort();
};
