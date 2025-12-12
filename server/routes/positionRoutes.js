const express = require("express");
const Position = require("../models/Position");
const User = require("../models/User");
const { protect, authorize } = require("../middlewares/authMiddleware");

const router = express.Router();

// ==========================================
// POSITION MANAGEMENT (Super-Admin Only)
// ==========================================

// Get all positions
router.get("/", protect, async (req, res) => {
  try {
    const { status, department } = req.query;

    let query = {};
    if (status) query.status = status;
    if (department && department !== "all") query.department = department;

    const positions = await Position.find(query)
      .sort({ level: -1, name: 1 })
      .populate("createdBy", "name email");

    res.json(positions);
  } catch (err) {
    console.error("Error fetching positions:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Create new position
router.post("/", protect, authorize("super-admin"), async (req, res) => {
  try {
    const { name, level, department, description, permissions } = req.body;

    // Check if position already exists
    const existingPosition = await Position.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingPosition) {
      return res.status(400).json({ error: "Position with this name already exists" });
    }

    const newPosition = new Position({
      name: name.trim(),
      level: level || 50,
      department: department || "all",
      description: description || "",
      permissions: permissions || {},
      createdBy: req.user._id
    });

    await newPosition.save();
    res.status(201).json(newPosition);
  } catch (err) {
    console.error("Error creating position:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Update position
router.put("/:id", protect, authorize("super-admin"), async (req, res) => {
  try {
    const { name, level, department, description, permissions, status } = req.body;

    const position = await Position.findById(req.params.id);
    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }

    // Check if name is being changed and if it conflicts with another position
    if (name && name.trim() !== position.name) {
      const existingPosition = await Position.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id }
      });

      if (existingPosition) {
        return res.status(400).json({ error: "Position with this name already exists" });
      }
      position.name = name.trim();
    }

    if (level !== undefined) position.level = level;
    if (department) position.department = department;
    if (description !== undefined) position.description = description;
    if (permissions) position.permissions = { ...position.permissions, ...permissions };
    if (status) position.status = status;

    await position.save();
    res.json(position);
  } catch (err) {
    console.error("Error updating position:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Delete position
router.delete("/:id", protect, authorize("super-admin"), async (req, res) => {
  try {
    const position = await Position.findById(req.params.id);
    if (!position) {
      return res.status(404).json({ error: "Position not found" });
    }

    // Check if any users have this position
    const usersWithPosition = await User.countDocuments({ position: position.name });

    if (usersWithPosition > 0) {
      return res.status(400).json({
        error: `Cannot delete position. ${usersWithPosition} user(s) currently assigned to this position.`,
        usersCount: usersWithPosition
      });
    }

    await Position.findByIdAndDelete(req.params.id);
    res.json({ message: "Position deleted successfully" });
  } catch (err) {
    console.error("Error deleting position:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// USER POSITION ASSIGNMENT (Super-Admin Only)
// ==========================================

// Get users with their positions
router.get("/users/list", protect, authorize("super-admin", "admin", "hr"), async (req, res) => {
  try {
    const { department, position, role } = req.query;

    let query = { status: "active" };
    if (department && department !== "") query.department = department;
    if (position && position !== "") query.position = position;
    if (role && role !== "") query.role = role;

    const users = await User.find(query)
      .select("employeeId name email role department designation position positionLevel avatar")
      .sort({ positionLevel: -1, name: 1 });

    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Assign position to user
router.patch("/users/:userId/assign", protect, authorize("super-admin"), async (req, res) => {
  try {
    const { position, positionLevel } = req.body;

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate position exists
    if (position && position.trim()) {
      const positionDoc = await Position.findOne({ name: position.trim(), status: "active" });
      if (!positionDoc) {
        return res.status(400).json({ error: "Invalid position. Position does not exist or is inactive." });
      }
      user.position = position.trim();
      user.positionLevel = positionLevel !== undefined ? positionLevel : positionDoc.level;
    } else {
      // Clear position
      user.position = "";
      user.positionLevel = 0;
    }

    await user.save();

    res.json({
      message: "Position assigned successfully",
      user: {
        _id: user._id,
        name: user.name,
        position: user.position,
        positionLevel: user.positionLevel
      }
    });
  } catch (err) {
    console.error("Error assigning position:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Bulk assign positions
router.post("/users/bulk-assign", protect, authorize("super-admin"), async (req, res) => {
  try {
    const { assignments } = req.body; // [{ userId, position, positionLevel }]

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: "Invalid assignments data" });
    }

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: []
    };

    for (const assignment of assignments) {
      try {
        const { userId, position, positionLevel } = assignment;

        const user = await User.findById(userId);
        if (!user) {
          results.failedCount++;
          results.errors.push({ userId, error: "User not found" });
          continue;
        }

        if (position && position.trim()) {
          const positionDoc = await Position.findOne({ name: position.trim(), status: "active" });
          if (!positionDoc) {
            results.failedCount++;
            results.errors.push({ userId, error: "Position not found or inactive" });
            continue;
          }

          user.position = position.trim();
          user.positionLevel = positionLevel !== undefined ? positionLevel : positionDoc.level;
        } else {
          user.position = "";
          user.positionLevel = 0;
        }

        await user.save();
        results.successCount++;
      } catch (err) {
        results.failedCount++;
        results.errors.push({ userId: assignment.userId, error: err.message });
      }
    }

    res.json({
      message: `Successfully assigned positions to ${results.successCount} user(s)`,
      results
    });
  } catch (err) {
    console.error("Error in bulk assign:", err);
    res.status(500).json({ error: "Server Error", message: err.message });
  }
});

// Get position statistics
router.get("/stats", protect, authorize("super-admin", "admin"), async (req, res) => {
  try {
    const [totalPositions, activePositions, usersWithPositions, positionDistribution] = await Promise.all([
      Position.countDocuments(),
      Position.countDocuments({ status: "active" }),
      User.countDocuments({ position: { $ne: "" } }),
      User.aggregate([
        { $match: { position: { $ne: "" }, status: "active" } },
        { $group: { _id: "$position", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      totalPositions,
      activePositions,
      usersWithPositions,
      usersWithoutPositions: await User.countDocuments({ position: "", status: "active" }),
      positionDistribution
    });
  } catch (err) {
    console.error("Error fetching position stats:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
