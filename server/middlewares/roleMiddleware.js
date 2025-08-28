// ======================
// Role-based authorization middleware
// Usage: authorize("admin", "hr", "employee")
// ======================
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // Ensure user is attached by protect middleware
    if (!req.user) {
      return res.status(401).json({ message: "User missing" });
    }

    // Super-admin bypasses all role checks
    if (req.user.role === "super-admin") {
      return next();
    }

    // Check if the user's role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized`,
      });
    }

    next();
  };
};
