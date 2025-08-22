exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (req.user.role === "super-admin") return next(); // unrestricted access
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized`,
      });
    }
    next();
  };
};
