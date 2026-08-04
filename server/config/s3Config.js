// config/s3Config.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const { createDiskStorage } = require("./storage");

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// CloudFront domain for CDN delivery
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "d23ykfyewugz9v.cloudfront.net";

// ─────────────────────────────────────────────────────────────────────────────
// WHICH STORAGE BACKEND
// ─────────────────────────────────────────────────────────────────────────────
// STORAGE_DRIVER is explicit: "local" or "s3".
//
// This used to be INFERRED — "are AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and
// AWS_S3_BUCKET_NAME all set?" — which fails in the worst possible way when you
// migrate off AWS. The variables stay in .env, the inference still says "yes,
// use S3", and every single upload is shipped to a bucket whose credentials no
// longer work. What the user sees is `500 Internal Server Error` on send; what
// the log says is `InvalidAccessKeyId`; and nothing anywhere suggests the
// server simply chose the wrong backend. Deleting three environment variables
// is not an obvious fix for "messaging is broken".
//
// So the backend is now stated, not guessed. Leaving STORAGE_DRIVER unset keeps
// the old inference for compatibility, but says out loud which way it went.
const STORAGE_DRIVER = String(process.env.STORAGE_DRIVER || "").trim().toLowerCase();

const hasAwsCredentials =
  !!process.env.AWS_ACCESS_KEY_ID &&
  !!process.env.AWS_SECRET_ACCESS_KEY &&
  !!process.env.AWS_S3_BUCKET_NAME &&
  process.env.AWS_ACCESS_KEY_ID !== 'your_aws_access_key_id_here';

let isS3Configured;

if (STORAGE_DRIVER === "local") {
  isS3Configured = false;
} else if (STORAGE_DRIVER === "s3") {
  // Fail at boot rather than on the first upload. A misconfigured bucket should
  // stop the server starting, not surface hours later as a 500 when somebody
  // tries to send a file.
  if (!hasAwsCredentials) {
    throw new Error(
      "STORAGE_DRIVER=s3 but AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET_NAME are not all set"
    );
  }
  isS3Configured = true;
} else {
  isS3Configured = hasAwsCredentials;
  console.warn(
    `⚠️  STORAGE_DRIVER is not set — falling back to inference from AWS credentials ` +
      `(chose ${isS3Configured ? "S3" : "local disk"}). Set STORAGE_DRIVER=local or =s3 explicitly.`
  );
}

console.log(
  `📦 File storage driver: ${isS3Configured ? `S3 (${process.env.AWS_S3_BUCKET_NAME})` : "local disk"}`
);

// Configure multer to use S3
const uploadToS3 = isS3Configured ? multer({
  storage: multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    // ACL removed - modern S3 buckets have ACLs disabled by default
    // Files will be public via bucket policy or CloudFront distribution
    contentType: multerS3.AUTO_CONTENT_TYPE,
    // Metadata removed to fix AWS SDK v3 compatibility issue
    // The metadata function was passing non-string values causing signature errors
    key: function (req, file, cb) {
      // Use different folders based on the endpoint
      let folder = "chat-messages";
      if (req.baseUrl && req.baseUrl.includes("/projects")) {
        folder = "project-messages";
      }
      // Check if it's a screenshot upload
      if (req.route && req.route.path && req.route.path.includes("screenshots")) {
        folder = "screenshots";
      }
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "-");
      const filename = `${folder}/${uniqueSuffix}-${sanitizedFilename}`;
      cb(null, filename);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, documents, and videos
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "video/mp4",
      "video/avi",
      "video/quicktime",
    ];

    const allowedExtensions = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|mp4|avi|mov/;
    const extname = allowedExtensions.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedMimes.includes(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, documents, and videos are allowed."
        )
      );
    }
  },
}) : multer({
  // Local storage goes through config/storage.js so writes land under
  // UPLOAD_ROOT.
  //
  // This previously hardcoded `path.join(__dirname, "../uploads/<folder>")` —
  // the in-repo directory. Once UPLOAD_ROOT moved uploads out of the deploy
  // tree, the writer and the reader were pointing at different directories:
  // uploads succeeded, and every download 404'd with "File not found", because
  // routes/fileRoutes.js resolves the stored path against UPLOAD_ROOT and the
  // bytes were never there.
  //
  // Callers must use `file.storedPath` (the full relative path) rather than
  // `file.filename` — files are sharded now, so the bare leaf name doesn't
  // locate them.
  storage: createDiskStorage((req) =>
    req.route && req.route.path && req.route.path.includes("screenshots")
      ? "screenshots"
      : "messages"
  ),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "video/mp4",
      "video/avi",
      "video/quicktime",
    ];

    const allowedExtensions = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|mp4|avi|mov/;
    const extname = allowedExtensions.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedMimes.includes(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, documents, and videos are allowed."
        )
      );
    }
  },
});

// Log configuration status
if (!isS3Configured) {
  // Only nag about missing AWS config when the backend was *inferred*. With
  // STORAGE_DRIVER=local this is the deliberate choice for an in-house server,
  // and telling the operator to "configure AWS credentials" on every boot is
  // both wrong and the kind of noise that trains people to ignore warnings.
  if (STORAGE_DRIVER !== "local") {
    console.warn("⚠️  AWS S3 not configured. Using local file storage. Set STORAGE_DRIVER=local to make this explicit, or add AWS credentials for S3.");
  } else {
    console.log(`   Files are stored on this server under UPLOAD_ROOT (${process.env.UPLOAD_ROOT || "<default: server/uploads>"}).`);
  }
} else {
  console.log("✅ AWS S3 configured. Files will be uploaded to S3 and served via CloudFront.");
}

// Helper function to determine file type from mime type
const getFileType = (mimeType) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("text") ||
    mimeType.includes("sheet") ||
    mimeType.includes("msword") ||
    mimeType.includes("ms-excel")
  )
    return "document";
  return "other";
};

// Helper function to convert S3 URL to CloudFront URL or return local path
const convertToCloudFrontUrl = (fileUrlOrPath) => {
  if (!fileUrlOrPath) return fileUrlOrPath;

  console.log("[convertToCloudFrontUrl] Input:", fileUrlOrPath);
  console.log("[convertToCloudFrontUrl] S3 Configured:", isS3Configured);

  // If S3 is not configured, return local server URL
  if (!isS3Configured) {
    // If it's already a local path starting with /, return as is
    if (fileUrlOrPath.startsWith('/')) {
      console.log("[convertToCloudFrontUrl] Returning local path:", fileUrlOrPath);
      return fileUrlOrPath;
    }
    // Otherwise return as /uploads/messages/filename
    const localPath = `/uploads/messages/${fileUrlOrPath}`;
    console.log("[convertToCloudFrontUrl] Returning local path:", localPath);
    return localPath;
  }

  // If it's a local path (starts with /), return as is (shouldn't happen with S3 configured)
  if (fileUrlOrPath.startsWith('/')) {
    console.log("[convertToCloudFrontUrl] Local path with S3 configured:", fileUrlOrPath);
    return fileUrlOrPath;
  }

  // Extract the S3 key from the URL
  // S3 URL format: https://bucket-name.s3.region.amazonaws.com/key
  // or: https://s3.region.amazonaws.com/bucket-name/key
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || "us-east-1";

  // Try both S3 URL formats
  let key = fileUrlOrPath
    .replace(`https://${bucketName}.s3.${region}.amazonaws.com/`, "")
    .replace(`https://${bucketName}.s3.amazonaws.com/`, "")
    .replace(`https://s3.${region}.amazonaws.com/${bucketName}/`, "")
    .replace(`https://s3.amazonaws.com/${bucketName}/`, "");

  // If no replacement happened, the input might already be just a key
  if (key === fileUrlOrPath && !fileUrlOrPath.startsWith('http')) {
    console.log("[convertToCloudFrontUrl] Input appears to be a key already:", key);
  }

  // Return CloudFront URL
  const cloudFrontUrl = `https://${CLOUDFRONT_DOMAIN}/${key}`;
  console.log("[convertToCloudFrontUrl] Output CloudFront URL:", cloudFrontUrl);
  return cloudFrontUrl;
};

module.exports = {
  s3Client,
  uploadToS3,
  getFileType,
  convertToCloudFrontUrl,
  CLOUDFRONT_DOMAIN,
  isS3Configured,
};
