// config/s3Config.js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");

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

// Check if AWS credentials are configured
const isS3Configured = process.env.AWS_ACCESS_KEY_ID &&
                       process.env.AWS_SECRET_ACCESS_KEY &&
                       process.env.AWS_S3_BUCKET_NAME &&
                       process.env.AWS_ACCESS_KEY_ID !== 'your_aws_access_key_id_here';

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
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const fs = require('fs');
      const uploadDir = path.join(__dirname, "../uploads/messages");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "-");
      cb(null, uniqueSuffix + "-" + sanitizedFilename);
    },
  }),
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
  console.warn("⚠️  AWS S3 not configured. Using local file storage. Configure AWS credentials in .env for S3 upload.");
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

  // If S3 is not configured, return local server URL
  if (!isS3Configured) {
    // If it's already a local path starting with /, add /uploads prefix if needed
    if (fileUrlOrPath.startsWith('/')) {
      return fileUrlOrPath;
    }
    // Otherwise return as /uploads/messages/filename
    return `/uploads/messages/${fileUrlOrPath}`;
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

  // Return CloudFront URL
  return `https://${CLOUDFRONT_DOMAIN}/${key}`;
};

module.exports = {
  s3Client,
  uploadToS3,
  getFileType,
  convertToCloudFrontUrl,
  CLOUDFRONT_DOMAIN,
  isS3Configured,
};
