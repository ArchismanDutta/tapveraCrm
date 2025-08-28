// File: middleware/roleMiddleware.js

/**
 * ======================
 * Role-based authorization middleware
 * Usage: authorize("admin", "hr", "employee")
 * This middleware must be used after 'protect' middleware.
 * Super-admin automatically bypasses all role checks.
 * ======================
 */
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Ensure user is attached by protect middleware
      if (!req.user) {
        return res.status(401).json({ message: "User missing from request context." });
      }

      // Super-admin bypasses all role checks
      if (req.user.role === "super-admin") {
        return next();
      }

      // Check if the user's role is allowed
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          message: `Access denied. User role '${req.user.role}' is not authorized.`,
        });
      }

      // Role is allowed
      next();
    } catch (err) {
      console.error("Role Middleware Error:", err.message);
      return res.status(500).json({ message: "Server error during authorization." });
    }
  };
};
