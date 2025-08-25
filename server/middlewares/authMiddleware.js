const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  try {
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1].trim();
    }

    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: "Invalid token" });

    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });

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
    console.error("Auth Error:", err.message);
    res.status(401).json({ message: "Authentication failed" });
  }
};

// Role-based authorization
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "User missing" });
    if (req.user.role === "super-admin") return next(); // unrestricted
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `Role '${req.user.role}' not authorized` });
    }
    next();
  };
};
