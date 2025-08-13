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

// Update employee's own profile
exports.updateProfile = async (req, res) => {
  try {
    const updateFields = {};

    // Only allow specific fields
    const allowedFields = [
      "name",
      "contact",
      "dob",
      "gender",
      "department",
      "designation",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] && req.body[field].toString().trim() !== "") {
        updateFields[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    });

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
