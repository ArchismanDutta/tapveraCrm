// Accept one or multiple roles and check if the logged-in user has required role(s)
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: `User role '${req.user.role}' is not authorized` });
    }
    next();
  };
};
