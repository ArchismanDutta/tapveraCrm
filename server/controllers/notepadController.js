// controllers/notepadController.js
const Notepad = require("../models/Notepad");
const User = require("../models/User");

// Get current user's notepad
exports.getMyNotepad = async (req, res) => {
  try {
    const userId = req.user._id;

    const notepad = await Notepad.getOrCreateNotepad(userId);

    res.json({
      success: true,
      data: {
        content: notepad.content,
        lastModified: notepad.lastModified,
        metadata: notepad.metadata,
        history: notepad.history || []
      }
    });
  } catch (error) {
    console.error("Error fetching notepad:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notepad"
    });
  }
};

// Update current user's notepad
exports.updateMyNotepad = async (req, res) => {
  try {
    const userId = req.user._id;
    const { content } = req.body;

    if (typeof content !== "string") {
      return res.status(400).json({
        success: false,
        error: "Content must be a string"
      });
    }

    if (content.length > 50000) {
      return res.status(400).json({
        success: false,
        error: "Content exceeds maximum length of 50,000 characters"
      });
    }

    const notepad = await Notepad.getOrCreateNotepad(userId);
    notepad.content = content;
    await notepad.save();

    res.json({
      success: true,
      data: notepad,
      message: "Notepad updated successfully"
    });
  } catch (error) {
    console.error("Error updating notepad:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update notepad"
    });
  }
};

// Super Admin: Get all users with notepads
exports.getAllUserNotepads = async (req, res) => {
  try {
    // Only super admin can access this
    if (req.user.role !== "super-admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Super Admin only."
      });
    }

    // Get all users with their notepad info
    const users = await User.find(
      { role: { $in: ["employee", "admin", "hr"] } },
      "name email role department profileImage"
    ).sort({ name: 1 });

    // Get all notepads
    const notepads = await Notepad.find({}).select("userId metadata lastModified");

    // Create a map of userId to notepad metadata
    const notepadMap = {};
    notepads.forEach(notepad => {
      notepadMap[notepad.userId.toString()] = {
        hasContent: notepad.metadata.characterCount > 0,
        characterCount: notepad.metadata.characterCount,
        wordCount: notepad.metadata.wordCount,
        lastModified: notepad.lastModified
      };
    });

    // Combine user data with notepad metadata
    const usersWithNotepads = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      profileImage: user.profileImage,
      notepad: notepadMap[user._id.toString()] || {
        hasContent: false,
        characterCount: 0,
        wordCount: 0,
        lastModified: null
      }
    }));

    res.json({
      success: true,
      data: usersWithNotepads
    });
  } catch (error) {
    console.error("Error fetching all notepads:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user notepads"
    });
  }
};

// Super Admin: Get specific user's notepad
exports.getUserNotepad = async (req, res) => {
  try {
    // Only super admin can access this
    if (req.user.role !== "super-admin") {
      return res.status(403).json({
        success: false,
        error: "Access denied. Super Admin only."
      });
    }

    const { userId } = req.params;

    // Get user info
    const user = await User.findById(userId).select("name email role department profileImage");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Get user's notepad
    const notepad = await Notepad.getOrCreateNotepad(userId);

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          profileImage: user.profileImage
        },
        notepad: notepad
      }
    });
  } catch (error) {
    console.error("Error fetching user notepad:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user notepad"
    });
  }
};

// Get notepad statistics
exports.getNotepadStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const notepad = await Notepad.findOne({ userId });

    if (!notepad) {
      return res.json({
        success: true,
        data: {
          characterCount: 0,
          wordCount: 0,
          lineCount: 0,
          lastModified: null
        }
      });
    }

    res.json({
      success: true,
      data: {
        characterCount: notepad.metadata.characterCount,
        wordCount: notepad.metadata.wordCount,
        lineCount: notepad.metadata.lineCount,
        lastModified: notepad.lastModified
      }
    });
  } catch (error) {
    console.error("Error fetching notepad stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notepad statistics"
    });
  }
};
