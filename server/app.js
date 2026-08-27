// File: server/app.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const http = require("http");

// =====================
// Routes
// =====================
const userRoutes = require("./routes/userRoutes");
const taskRoutes = require("./routes/taskRoutes");
const authRoutes = require("./routes/authRoutes");
const passwordRoutes = require("./routes/passwordRoutes");
const testRoutes = require("./routes/testRoutes");
const emailRoutes = require("./routes/emailRoutes");
const noticeRoutes = require("./routes/noticeRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const todoTaskRoutes = require("./routes/todoTaskRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
// Web push subscriptions + messaging preferences (S4)
const pushRoutes = require("./routes/pushRoutes");
// OLD SYSTEM ROUTES - DEPRECATED
// const statusRoutes = require("./routes/statusRoutes");
// const summaryRoutes = require("./routes/summaryRoutes");
const wishRoutes = require("./routes/wishRoutes");
const flexibleShiftRoutes = require("./routes/flexibleShiftRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const adminAttendanceRoutes = require("./routes/adminAttendanceRoutes");
const manualAttendanceRoutes = require("./routes/manualAttendanceRoutes");
const holidayRoutes = require("./routes/holidayRoutes");
const newAttendanceRoutes = require("./routes/newAttendanceRoutes"); // New date-centric attendance system
const superAdminRoutes = require("./routes/superAdminRoutes"); // Make sure this file exists
const payslipRoutes = require("./routes/payslipRoutes");
const autoPayrollRoutes = require("./routes/autoPayrollRoutes"); // Automatic payroll generation
const celebrationRoutes = require("./routes/celebrationRoutes");
const leadRoutes = require("./routes/leadRoutes");
const callbackRoutes = require("./routes/callbackRoutes");
const notepadRoutes = require("./routes/notepadRoutes");
const clientRoutes = require("./routes/clientRoutes");
const projectRoutes = require("./routes/projectRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const aiAnalyticsRoutes = require("./routes/aiAnalyticsRoutes");
const tapRoutes = require("./routes/tapRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const keywordRoutes = require("./routes/keywordRoutes");
const blogRoutes = require("./routes/blogRoutes");
const backlinkRoutes = require("./routes/backlinkRoutes");
const screenshotRoutes = require("./routes/screenshotRoutes");
const projectReportRoutes = require("./routes/projectReportRoutes");
const clientRemarkRoutes = require("./routes/clientRemarkRoutes");
const sheetRoutes = require("./routes/sheetRoutes");
const positionRoutes = require("./routes/positionRoutes");
const departmentRoutes = require("./routes/departmentRoutes"); // Access-management rework (2026-07-03)
const hierarchySetupRoutes = require("./routes/hierarchySetupRoutes"); // Role & Department Hierarchy Revamp v2 (2026-07-27)
const transferRoutes = require("./routes/transferRoutes");
const callIntelligenceRoutes = require("./routes/callIntelligenceRoutes");
const internalRoutes         = require("./routes/internalRoutes");
const clientRequestRoutes = require("./routes/clientRequestRoutes");
// Geofenced login (2026-08-07): Super-Admin location management + the
// per-session location re-check. See
// docs/superpowers/specs/2026-08-07-geofenced-login-design.md
const geofenceRoutes = require("./routes/geofenceRoutes");
// Biometric attendance (Identix / ZKTeco ADMS fingerprint terminals)
// iclockRoutes speaks the device's plain-text protocol at /iclock;
// biometricAdminRoutes is the authenticated admin API at /api/biometric.
// See docs/biometric-attendance-integration.md
const iclockRoutes = require("./routes/iclockRoutes");
const biometricAdminRoutes = require("./routes/biometricAdminRoutes");

// Real-time (Socket.IO — see server/socket/index.js)
const { initSocket } = require("./socket");

const app = express();
const server = http.createServer(app);

// =====================
// Biometric device endpoints (MOUNTED FIRST — order matters)
// =====================
// The fingerprint terminal speaks plain text, not JSON, and its firmware has
// the /iclock path hardcoded. This is mounted BEFORE express.json() and before
// CORS deliberately:
//
//   • express.json() would be a no-op for text/plain anyway, but some firmware
//     revisions send no Content-Type at all — keeping the device path away from
//     the JSON parser entirely removes any chance of the body being swallowed.
//   • The device is not a browser: it sends no Origin header and does not
//     understand a CORS preflight.
//   • It must also sit above the production `app.get("*")` SPA catch-all further
//     down, or the device would be served index.html instead of the protocol
//     response.
//
// The router handles its own body parsing, auth (serial allowlist) and errors.
// See docs/biometric-attendance-integration.md
app.use("/iclock", iclockRoutes);

// CORS — mounted before every other route, /uploads included.
//
// This used to sit AFTER the /uploads mount (further down). That went
// unnoticed for a long time because <img>/<video> tags and plain <a>
// navigation don't require CORS headers to load or open a cross-origin file —
// only a script-initiated fetch()/XHR does, to be allowed to read the
// response back into JS. So attachments displayed and "download" links
// opened fine, but the moment attachment downloads were switched to
// fetch()-as-blob (to force an actual save instead of the browser just
// opening the file — see chatWindow.jsx / MediaLightbox.jsx), every request
// to /uploads/... failed outright in the browser with "TypeError: Failed to
// fetch" and no server-side error at all, because the response never carried
// an Access-Control-Allow-Origin header. Moved here so it applies to every
// browser-facing route. /iclock stays excluded, on purpose (see its comment
// above): the terminal firmware sends no Origin header and doesn't speak
// preflight, so CORS has nothing to do there anyway.
const frontendOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_URL,
  "https://client.tapvera.io",
]
  .filter(Boolean)
  .flatMap((origin) => origin.split(",").map((o) => o.trim()))
  .filter(Boolean);


if (!frontendOrigins.length) {
  console.warn(
    "⚠️ No FRONTEND_ORIGIN or FRONTEND_URL set. CORS may block requests."
  );
}

console.log("🌐 CORS configured for origins:", frontendOrigins);

app.use(
  cors({
    origin: frontendOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
    ],
    credentials: true,
  })
);

// =====================
// Middleware
// =====================
app.use(express.json());

// HTTP request logging.
//
// "dev" emits a colourised line per request with ANSI escape codes — useful in
// a terminal, noise in a pm2 log file that nothing strips the codes from. In
// production we use the standard Apache "combined" format instead, and skip
// the two endpoint families that are polled rather than used by a human:
// health checks, and Socket.IO's transport polling. Both are high-frequency
// and tell us nothing when they succeed.
//
// Set HTTP_LOG_FORMAT to override (dev|combined|common|short|tiny), or
// HTTP_LOG=off to disable request logging entirely.
if (process.env.HTTP_LOG !== "off") {
  const isProd = process.env.NODE_ENV === "production";
  const httpLogFormat = process.env.HTTP_LOG_FORMAT || (isProd ? "combined" : "dev");

  app.use(
    morgan(httpLogFormat, {
      skip: (req, res) =>
        isProd &&
        res.statusCode < 400 &&
        (req.path === "/health" ||
          req.path === "/healthz" ||
          req.path === "/api/health" ||
          req.path.startsWith("/socket.io/")),
    })
  );
}

// Turn stored /uploads/... paths into short-lived signed URLs on the way out.
// Mounted before the routers so it wraps res.json for every one of them —
// file URLs surface from eight-odd places at varying nesting depths, and
// signing at each read site means any that's missed ships a broken image.
// See middlewares/signFileUrls.js.
app.use(require("./middlewares/signFileUrls"));

// Serve uploaded files.
//
// This was `express.static(path.join(__dirname, "uploads"))` — no auth of any
// kind, so every chat attachment, sick-leave certificate and ID document was
// publicly downloadable by anyone with the URL. Leave documents were named
// `document-<Date.now()>.pdf`, so the only thing protecting one was a
// millisecond timestamp.
//
// fileRoutes requires a short-lived signed URL (or a Bearer token) and refuses
// anything resolving outside UPLOAD_ROOT. See routes/fileRoutes.js and
// config/storage.js.
app.use("/uploads", require("./routes/fileRoutes"));

// =====================
// Health check & Diagnostics
// =====================
app.get("/", (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push(middleware.route.path);
    } else if (middleware.name === 'router') {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push(handler.route.path);
        }
      });
    }
  });

  res.json({
    status: "ok",
    message: "Your server is up and running",
    timestamp: Date.now(),
    version: "v2.3-email-service-fix", // Updated version
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || "development",
    routesLoaded: routes,
  });
});

// AWS Elastic Beanstalk health check endpoint
app.get("/health", (req, res) => {
  const healthCheck = {
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: process.env.PORT || 5000,
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  };

  // Return 200 if everything is OK, 503 if database is down
  const statusCode = mongoose.connection.readyState === 1 ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// =====================
// API Routes
// =====================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/test", testRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/todos", todoTaskRoutes);
// OLD SYSTEM ROUTES - DEPRECATED - Use /api/attendance-new instead
// app.use("/api/status", statusRoutes);
// app.use("/api/summary", summaryRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/chat", chatRoutes);
// Search, context and deletion span both scopes, so they are neither chat
// routes nor project routes — see the header of routes/messageRoutes.js.
app.use("/api/messages", messageRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/wishes", wishRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/flexible-shifts", flexibleShiftRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/admin", adminAttendanceRoutes);
app.use("/api/admin/manual-attendance", manualAttendanceRoutes);
// Per-user break-timer speed factor. Super-admin only, enforced inside the
// router — the hidden page's obscure URL is not the boundary.
app.use("/api/admin/control-machine", require("./routes/controlMachineRoutes"));
app.use("/api/attendance-new", newAttendanceRoutes); // New date-centric attendance system
app.use("/api/super-admin", superAdminRoutes); // Super admin route added
app.use("/api/payslips", payslipRoutes);
app.use("/api/auto-payroll", autoPayrollRoutes); // Automatic payroll generation
app.use("/api/celebrations", celebrationRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/callbacks", callbackRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/notepad", notepadRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/ai-analytics", aiAnalyticsRoutes);
app.use("/api/tap", tapRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/sheets", sheetRoutes);
// Mount specific project sub-routes BEFORE the main projectRoutes
// This ensures routes like /:projectId/blogs are matched before /:id
app.use("/api/projects", keywordRoutes);
app.use("/api/projects", blogRoutes);
app.use("/api/projects", backlinkRoutes);
app.use("/api/projects", screenshotRoutes);
app.use("/api/projects", projectReportRoutes);
app.use("/api/projects", clientRemarkRoutes);
// Mount general project routes LAST
app.use("/api/projects", projectRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/departments", departmentRoutes); // Access-management rework (2026-07-03)
app.use("/api/hierarchy-setup", hierarchySetupRoutes); // Role & Department Hierarchy Revamp v2 (2026-07-27)
app.use("/api/call-intelligence", callIntelligenceRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/client-requests", clientRequestRoutes); // Client quote & support requests
app.use("/api/biometric", biometricAdminRoutes); // Fingerprint device admin: PIN mapping, punch log, device health
app.use("/api/geofence", geofenceRoutes); // Geofenced login (2026-08-07)

// =====================
// Serve frontend in production
// =====================
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}

// =====================
// Error handler
// =====================
app.use((err, req, res, next) => {
  // Upload rejections are the user's problem to fix, not a server fault.
  // Without this they fell through to the 500 below, so someone attaching a
  // 12MB scan to a leave request got "Internal Server Error" and no idea that
  // the file was simply too big. multer raises MulterError with a code; our own
  // fileFilter raises a plain Error whose message is already user-facing.
  // One ceiling for every upload now — see config/s3Config.js for why the
  // previous smaller-cap-for-documents/bigger-cap-for-video split was removed
  // (its pre-check compared a whole multipart request's size against a
  // per-file limit, which is what was blocking zip attachments).
  const mb = (b) => Math.round(Number(b) / 1024 / 1024);
  const MAX_MB = mb(process.env.UPLOAD_MAX_BYTES || 200 * 1024 * 1024);

  const uploadMessages = {
    LIMIT_FILE_SIZE: `File is too large. Maximum is ${MAX_MB}MB.`,
    LIMIT_FILE_COUNT: "Too many files attached.",
    LIMIT_FIELD_COUNT: "Too many form fields.",
    LIMIT_UNEXPECTED_FILE: "Unexpected file field.",
  };

  if (err && err.name === "MulterError") {
    return res.status(400).json({
      message: uploadMessages[err.code] || "Upload rejected.",
      code: err.code,
    });
  }

  // Our own upload filters throw plain Errors whose message is already
  // user-facing (the per-type size rule in config/s3Config.js). Matched on the
  // text because there's no error code to key off.
  if (err && /File is too large|Invalid file type/i.test(err.message || "")) {
    return res.status(400).json({ message: err.message });
  }

  console.error("❌ Unexpected error:", err.stack || err);
  console.error("Request path:", req.path);
  console.error("Request method:", req.method);

  // In development, send more details
  if (process.env.NODE_ENV === 'development') {
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      stack: err.stack
    });
  } else {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =====================
// Real-time (Socket.IO)
// =====================
// See server/socket/index.js for the connection/auth/room setup and
// server/socket/handlers/*.js for the chat + notification event handlers.
// This replaces the old raw `ws` server that used to be inlined here.
initSocket(server);

// =====================
// MongoDB Connection & Server Start
// =====================
const PORT = process.env.PORT || 5000;

if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in .env file");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, // Timeout after 10 seconds instead of hanging
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");

    // Initialize cron jobs after DB connection
    try {
      const { initializeCronJobs } = require("./jobs/cronJobs");
      initializeCronJobs();
    } catch (error) {
      console.error("⚠️  Cron jobs initialization failed:", error.message);
      console.log("   Install node-cron: npm install node-cron");
    }

    // Start server immediately (don't wait for email service)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);

      // Initialize Email Service in background (non-blocking)
      const emailService = require('./services/email/emailService');
      emailService.initialize().then(() => {
        console.log('✅ Email service ready');
      }).catch(err => {
        console.error('❌ Email service initialization failed:', err.message);
      });
    });
    console.log(
      "🌐 FRONTEND_URL for emails:",
      process.env.FRONTEND_URL || "not set"
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });
