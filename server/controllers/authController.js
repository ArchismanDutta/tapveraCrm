// File: controllers/authController.js
const User = require("../models/User");
const Client = require("../models/Client");
const jwt = require("jsonwebtoken");
const { encrypt } = require("../utils/crypto"); // for optional Outlook password encryption
const Token = require("../models/Token");
const sendEmail = require("../utils/sendEmail");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
// Geofenced login (2026-08-07) — see docs/superpowers/specs/2026-08-07-geofenced-login-design.md
const GeofenceLocation = require("../models/GeofenceLocation");
const GeofenceEvent = require("../models/GeofenceEvent");
const { isSubjectToGeofence, evaluate } = require("../utils/geofence");

const isPasswordHash = (value) => /^\$2[aby]\$\d{2}\$/.test(String(value || ""));

const passwordMatches = async (candidate, storedPassword) => {
  const normalizedCandidate = String(candidate || "").trim();
  const normalizedStored = String(storedPassword || "");

  if (!normalizedCandidate || !normalizedStored) return false;
  if (isPasswordHash(normalizedStored)) {
    return bcrypt.compare(normalizedCandidate, normalizedStored);
  }

  // Backward compatibility for records created before passwords were hashed.
  return normalizedCandidate === normalizedStored;
};

// ======================
// JWT Token generation
// ======================
const generateToken = (user, userType = "User") => {
  const regions = Array.isArray(user.regions) && user.regions.length
    ? user.regions
    : user.region
      ? [user.region]
      : ["Global"];

  return jwt.sign(
    {
      id: user._id,
      role: user.role || "client",
      userType: userType,
      regions,
      region: user.region || regions[0] || "Global",
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

// ======================
// Geofence enforcement (2026-08-07)
// See docs/superpowers/specs/2026-08-07-geofenced-login-design.md
// ======================

// Best-effort audit write. Deliberately swallows its own errors: a failure to
// RECORD a denial must never turn into a failure to APPLY one, nor into a 500
// that a client could use to distinguish "denied" from "server broke".
const recordGeofenceEvent = async (payload) => {
  try {
    await GeofenceEvent.create(payload);
  } catch (err) {
    console.error("Geofence audit write failed:", err.message);
  }
};

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.socket?.remoteAddress ||
  "";

/**
 * Decide whether `user` may hold a session from the coordinates in the
 * request, and write an audit row if not.
 *
 * Returns null to allow, or { status, body } to refuse. Shared verbatim by
 * login and by the periodic re-check in geofenceController, so the two can
 * never disagree about what "inside" means.
 */
const enforceGeofence = async (req, user, userType) => {
  // Clients and super-admins short-circuit here without a database round trip
  // — see isSubjectToGeofence() for why each is excluded.
  if (!isSubjectToGeofence(user, userType)) return null;

  const locations = await GeofenceLocation.find({
    _id: { $in: user.geofence.locations },
  }).lean();

  const result = evaluate(locations, req.body?.coordinates);
  if (result.allowed) return null;

  await recordGeofenceEvent({
    userId: user._id,
    email: user.email,
    outcome: result.code === "NO_LOCATION" ? "no-location" : "login-denied",
    coordinates: result.coordinates || { latitude: null, longitude: null, accuracy: null },
    nearestLocation: result.nearest?.id || null,
    distanceMeters: result.nearest?.distanceMeters ?? null,
    reason: result.reason,
    ipAddress: clientIp(req),
    userAgent: req.headers["user-agent"] || "",
  });

  // 428 Precondition Required, not 403, when coordinates are simply missing.
  //
  // This distinction is the whole reason unfenced users never see a location
  // permission prompt. The client does not know in advance whether the account
  // it is signing into is fenced — only the server does, and only after the
  // password has been verified. So the client attempts login without location
  // first; a 428 is the server saying "this specific account needs coordinates,
  // ask for them and retry". A 403 would be indistinguishable from a genuine
  // refusal and would leave the client no way to tell "you're in the wrong
  // place" (retrying is pointless) from "I need to know where you are"
  // (retrying is the entire fix).
  const status = result.code === "NO_LOCATION" ? 428 : 403;

  return {
    status,
    body: {
      message: result.reason,
      geofence: {
        code: result.code,
        // Named so the user can orient themselves ("oh, it wants me at the
        // Kolkata office"). Coordinates are NOT returned: they would let
        // anyone with a valid password trilaterate the exact fence centre and
        // spoof to it, which turns a mild inconvenience to spoof into a
        // trivial one.
        locationNames: locations.filter((l) => l.isActive !== false).map((l) => l.name),
        distanceMeters: result.nearest?.distanceMeters ?? null,
      },
    },
  };
};

// ======================
// Employee Signup
// ======================
exports.signup = async (req, res) => {
  try {
    const {
      employeeId,
      name,
      email,
      contact,
      dob,
      gender,
      password,
      department,
      designation,
      outlookEmail,
      outlookAppPassword,
      doj,
      bloodGroup,
      permanentAddress,
      currentAddress,
      emergencyNo,
      ps,
      salary,
      ref,
      status,
      totalPl,
      location,
      employmentType,
      skills,
      qualifications,
    } = req.body;

    // Required fields validation
    if (
      !employeeId ||
      !name ||
      !email ||
      !contact ||
      !dob ||
      !gender ||
      !password ||
      !doj
    ) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const trimmedEmployeeId = String(employeeId).trim();

    // Check duplicates
    const existingEmailUser = await User.findOne({ email: normalizedEmail });
    if (existingEmailUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    const existingEmployeeIdUser = await User.findOne({
      employeeId: trimmedEmployeeId,
    });
    if (existingEmployeeIdUser) {
      return res.status(400).json({ message: "Employee ID already in use." });
    }

    // Encrypt Outlook password if provided
    let encryptedOutlookPass = null;
    if (outlookAppPassword && String(outlookAppPassword).trim()) {
      encryptedOutlookPass = encrypt(String(outlookAppPassword).trim());
    }

    const user = new User({
      employeeId: trimmedEmployeeId,
      name: String(name).trim(),
      email: normalizedEmail,
      contact: String(contact).trim(),
      dob,
      gender,
      password: await bcrypt.hash(String(password).trim(), 12),
      role: "employee",
      department: department || "",
      designation: designation ? String(designation).trim() : "",
      employmentType: employmentType || "full-time",
      skills: Array.isArray(skills) ? skills.map((s) => s.trim()) : [],
      qualifications: Array.isArray(qualifications) ? qualifications : [],
      outlookEmail: outlookEmail
        ? String(outlookEmail).trim().toLowerCase()
        : "",
      outlookAppPassword: encryptedOutlookPass || "",
      doj,
      bloodGroup: bloodGroup ? String(bloodGroup).trim() : "",
      permanentAddress: permanentAddress ? String(permanentAddress).trim() : "",
      currentAddress: currentAddress ? String(currentAddress).trim() : "",
      emergencyNo: emergencyNo ? String(emergencyNo).trim() : "",
      ps: ps ? String(ps).trim() : "",
      salary: salary ? Number(salary) : 0,
      ref: ref ? String(ref).trim() : "",
      status: status || "active",
      totalPl: totalPl !== undefined ? Number(totalPl) : 0,
      location: location ? String(location).trim() : "India",
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Signup Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Login
// Supports both User (employees/admin) and Client login
// ======================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // First, try to find as User (employee/admin)
    let user = await User.findOne({ email: normalizedEmail });
    let userType = "User";

    // If not found in User, try Client
    if (!user) {
      user = await Client.findOne({ email: normalizedEmail });
      userType = "Client";

      if (!user) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
    }

    // Check if user status is inactive, terminated, or absconded (only for User type, not Client)
    if (userType === "User" && user.status && ["inactive", "terminated", "absconded"].includes(user.status)) {
      return res.status(403).json({
        message: "Access denied. Your account has been deactivated. Please contact your administrator.",
        accountStatus: user.status
      });
    }

    if (!(await passwordMatches(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Geofence check — AFTER the password is verified, deliberately.
    //
    // Checking before would turn login into an oracle: an attacker with only
    // an email address could learn whether that account is geofenced, and by
    // sweeping coordinates, roughly where its office is — all without ever
    // knowing the password. Ordering it here means a wrong password is
    // indistinguishable from a wrong password regardless of location, and the
    // fence only ever speaks to someone who has already proven who they are.
    const geofenceRefusal = await enforceGeofence(req, user, userType);
    if (geofenceRefusal) {
      return res.status(geofenceRefusal.status).json(geofenceRefusal.body);
    }

    const token = generateToken(user, userType);
    const safeUser = typeof user.toObject === "function" ? user.toObject() : { ...user };
    delete safeUser.password;
    delete safeUser.outlookAppPassword;
    if (userType === "Client") safeUser.role = "client";

    res.json({ token, user: safeUser, userType });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Exported so geofenceController's periodic re-check enforces byte-identical
// rules to the login door, rather than a second implementation that drifts.
exports.enforceGeofence = enforceGeofence;
exports.recordGeofenceEvent = recordGeofenceEvent;
exports.clientIp = clientIp;

// ======================
// Forgot Password
// ======================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const genericMsg =
      "If an account with this email exists, a password reset link has been sent.";
    if (!user) return res.json({ message: genericMsg });

    // Remove existing tokens
    await Token.deleteMany({ userId: user._id });

    const resetToken = crypto.randomBytes(32).toString("hex");
    await new Token({ userId: user._id, token: resetToken }).save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    let provider = "gmail";
    if (
      user.email.includes("@outlook.") ||
      user.email.includes("@hotmail.") ||
      user.email.includes("@live.")
    ) {
      provider = "outlook";
    }

    await sendEmail({
      provider,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <p>Hello ${user.name || "User"},</p>
        <p>You requested a password reset. Click the link below:</p>
        <p><a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
      `,
    });

    return res.json({ message: genericMsg });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ======================
// Reset Password
// ======================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || !password.trim()) {
      return res.status(400).json({ message: "Password is required" });
    }

    const passwordResetToken = await Token.findOne({ token });
    if (!passwordResetToken) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }

    const user = await User.findById(passwordResetToken.userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    user.password = await bcrypt.hash(String(password).trim(), 12);
    await user.save();

    await passwordResetToken.deleteOne();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
