const holidayService = require("../services/holidayService");

// GET /holidays?shift=standard
exports.getHolidays = async (req, res) => {
  try {
    const { shift } = req.query;
    const holidays = await holidayService.getAllHolidays(shift);
    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /holidays
exports.createHoliday = async (req, res) => {
  try {
    const holiday = await holidayService.addHoliday(req.body);
    res.status(201).json(holiday);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /holidays/:id
exports.removeHoliday = async (req, res) => {
  try {
    await holidayService.deleteHoliday(req.params.id);
    res.json({ message: "Holiday removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /holidays/check?date=YYYY-MM-DD&shift=standard
exports.checkIfHoliday = async (req, res) => {
  try {
    const { date, shift } = req.query;
    const result = await holidayService.checkHoliday(date, shift || "ALL");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /holidays/sandwich
exports.applySandwich = async (req, res) => {
  try {
    const { leaves, shift } = req.body; // e.g. { leaves: ["2025-08-14", "2025-08-16"], shift: "standard" }
    const expanded = await holidayService.applySandwichPolicy(
      leaves,
      shift || "ALL"
    );
    res.json({ expandedLeaves: expanded });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
