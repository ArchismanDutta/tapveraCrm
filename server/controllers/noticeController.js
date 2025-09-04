const Notice = require("../models/Notice");

// Create notice (only admin/super-admin)(24h expiry)
exports.createNotice = async (req, res) => {
  try {
    if (!["admin", "super-admin", "hr"].includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { message } = req.body;
    const notice = await Notice.create({
      message,
      createdBy: req.user._id,
      isActive: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
    });

    res.status(201).json(notice);
  } catch (err) {
    console.error("Error creating notice:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get latest active notice (only unexpired ones)
exports.getActiveNotice = async (req, res) => {
  try {
    const now = new Date();
    const notice = await Notice.find({
      isActive: true,
      expiresAt: { $gt: now }, // not expired
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json(notice || null);
  } catch (err) {
    console.error("Error fetching notice:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Deactivate notice (manual override by admin if needed)
exports.deactivateNotice = async (req, res) => {
  try {
    if (!["admin", "super-admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Notice.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: "Notice deactivated" });
  } catch (err) {
    console.error("Error deactivating notice:", err);
    res.status(500).json({ message: "Server error" });
  }
};
