const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes (authentication)
exports.protect = async (req, res, next) => {
  let token;

  try {
    // Get token from header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1]?.trim();
    }

    if (!token) {
      return res
        .status(401)
        .json({ message: "Not authorized, no token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Not authorized, invalid or expired token" });
    }

    if (!decoded?.id) {
      return res.status(401).json({ message: "Not authorized, invalid token payload" });
    }

    // Find user in DB
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    // Attach normalized user to request
    req.user = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "Unknown",
      avatar: user.avatar || "",
    };

    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err.message);
    return res.status(500).json({ message: "Server error in authentication" });
  }
};

// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user missing" });
    }

    if (req.user.role === "super-admin") return next();

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized`,
      });
    }

    next();
  };
};
