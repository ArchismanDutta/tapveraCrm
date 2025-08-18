const User = require("../models/User");

// Get logged-in user's profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password -__v");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update employee's own profile (including Outlook credentials)
exports.updateProfile = async (req, res) => {
  try {
    const updateFields = {};

    // Only allow specific fields to be updated
    const allowedFields = [
      "name",
      "contact",
      "dob",
      "gender",
      "department",
      "designation",
      "outlookEmail",
      "outlookAppPassword", // Will be encrypted if provided below
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        if (typeof req.body[field] === "string") {
          if (req.body[field].trim() !== "") {
            updateFields[field] = req.body[field].trim();
          }
        } else {
          updateFields[field] = req.body[field];
        }
      }
    });

    // Encrypt outlookAppPassword if present
    if (updateFields.outlookAppPassword) {
      const { encrypt } = require("../utils/crypto");
      updateFields.outlookAppPassword = encrypt(updateFields.outlookAppPassword);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, runValidators: true, context: "query" }
    ).select("-password -__v");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Admin & Super Admin: Get list of all users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password -__v")
      .sort({ name: 1 }); // Sort alphabetically

    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
};
