// File: middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * ======================
 * Protect routes middleware
 * Ensures user is logged in and token is valid
 * ======================
 */
exports.protect = async (req, res, next) => {
  let token;

  try {
    // Extract token from Authorization header
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1]?.trim();
    }

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    if (!decoded?.id) {
      return res.status(401).json({ message: "Invalid token payload." });
    }

    // Fetch user from DB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User linked to token not found." });
    }

    // Attach user info to request object
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role, // e.g. hr, admin, employee, super-admin
      department: user.department || "Unknown",
      avatar: user.avatar || "",
    };

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(500).json({ message: "Server error during authentication." });
  }
};

/**
 * ======================
 * Role-based authorization middleware
 * Usage: authorize("admin", "hr") etc.
 * Super-admin bypasses all checks
 * ======================
 */
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User missing from request context." });
    }

    // Super-admin bypasses all role checks
    if (req.user.role === "super-admin") {
      return next();
    }

    // Check if user's role is in the allowed list
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. User role '${req.user.role}' is not authorized.`,
      });
    }

    next();
  };
};
