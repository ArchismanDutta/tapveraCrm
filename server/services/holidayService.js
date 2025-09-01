const dayjs = require("dayjs");
const moment = require("moment");
const Holiday = require("../models/Holiday");

// Check if a given date is holiday or weekend
async function isHolidayOrWeekend(date) {
  const checkDate = moment(date).startOf("day");

  // Weekend check
  if (checkDate.day() === 0 || checkDate.day() === 6) return true;

  const start = checkDate.toDate();
  const end = checkDate.clone().endOf("day").toDate();

  const holiday = await Holiday.findOne({ date: { $gte: start, $lte: end } });
  return !!holiday;
}

exports.isHolidayOrWeekend = isHolidayOrWeekend;

// Check single date
exports.checkHoliday = async (date) => {
  const checkDate = moment(date, "YYYY-MM-DD");

  // Weekend check
  if (checkDate.day() === 0 || checkDate.day() === 6) {
    return { isHoliday: true, reason: "Weekend", sandwich: false };
  }

  const start = checkDate.startOf("day").toDate();
  const end = checkDate.endOf("day").toDate();

  const holiday = await Holiday.findOne({
    date: { $gte: start, $lte: end },
  });

  if (holiday) {
    return { isHoliday: true, reason: holiday.name, sandwich: false };
  }

  // Sandwich Policy
  const prevDate = moment(checkDate).subtract(1, "day");
  const nextDate = moment(checkDate).add(1, "day");

  const prevHoliday = await isHolidayOrWeekend(prevDate);
  const nextHoliday = await isHolidayOrWeekend(nextDate);

  if (prevHoliday && nextHoliday) {
    return {
      isHoliday: false,
      sandwich: true,
      reason: "Sandwich Policy Applied (between two holidays/weekends)",
    };
  }

  return { isHoliday: false, sandwich: false };
};

// Get all holidays
exports.getAllHolidays = async () => {
  return await Holiday.find({});
};

// Add holiday
exports.addHoliday = async (data) => {
  return await Holiday.create(data);
};

// Delete holiday
exports.deleteHoliday = async (id) => {
  return await Holiday.findByIdAndDelete(id);
};

// Sandwich Policy Expansion
exports.applySandwichPolicy = async (employeeLeaves = []) => {
  if (!employeeLeaves.length) return [];

  const leaves = employeeLeaves.map((d) => dayjs(d).startOf("day"));
  const allHolidays = await Holiday.find({});
  const holidayDates = allHolidays.map((h) => dayjs(h.date).startOf("day"));

  const expandedLeaves = new Set();

  for (let leave of leaves) {
    expandedLeaves.add(leave.format("YYYY-MM-DD"));

    const prev = leave.subtract(1, "day");
    if (await isHolidayOrWeekend(prev, holidayDates)) {
      expandedLeaves.add(prev.format("YYYY-MM-DD"));
    }

    const next = leave.add(1, "day");
    if (await isHolidayOrWeekend(next, holidayDates)) {
      expandedLeaves.add(next.format("YYYY-MM-DD"));
    }
  }

  return Array.from(expandedLeaves).sort();
};
