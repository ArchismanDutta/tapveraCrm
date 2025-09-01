const holidayService = require("../services/holidayService");

exports.getHolidays = async (req, res) => {
  try {
    const holidays = await holidayService.getAllHolidays();
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createHoliday = async (req, res) => {
  try {
    const holiday = await holidayService.addHoliday(req.body);
    res.status(201).json(holiday);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.removeHoliday = async (req, res) => {
  try {
    await holidayService.deleteHoliday(req.params.id);
    res.json({ message: "Holiday removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.checkIfHoliday = async (req, res) => {
  try {
    const { date } = req.query;
    const result = await holidayService.checkHoliday(date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.applySandwich = async (req, res) => {
  try {
    const { leaves } = req.body; // ["2025-08-14", "2025-08-16"]
    const expanded = await holidayService.applySandwichPolicy(leaves);
    res.json({ expandedLeaves: expanded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
