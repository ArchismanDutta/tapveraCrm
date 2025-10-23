// services/mediaCleanupService.js
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const Message = require("../models/Message");
const fs = require("fs").promises;
const path = require("path");

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const isS3Configured =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_S3_BUCKET_NAME &&
  process.env.AWS_ACCESS_KEY_ID !== "your_aws_access_key_id_here";

/**
 * Delete old media files that are:
 * 1. Older than 30 days
 * 2. NOT marked as important/favorite
 * 3. Have valid S3 keys or local paths
 */
async function cleanupOldMedia() {
  try {
    console.log("🧹 Starting media cleanup service...");

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find all messages with attachments
    const messages = await Message.find({
      "attachments.0": { $exists: true }, // Has at least one attachment
    });

    let deletedCount = 0;
    let skippedImportant = 0;
    let errors = 0;

    for (const message of messages) {
      let messageModified = false;

      for (let i = message.attachments.length - 1; i >= 0; i--) {
        const attachment = message.attachments[i];

        // Skip if marked as important
        if (attachment.isImportant) {
          skippedImportant++;
          continue;
        }

        // Skip if not old enough (less than 30 days)
        if (new Date(attachment.uploadedAt) > thirtyDaysAgo) {
          continue;
        }

        // Delete from S3 or local storage
        try {
          if (isS3Configured && attachment.s3Key) {
            // Delete from S3
            const deleteParams = {
              Bucket: process.env.AWS_S3_BUCKET_NAME,
              Key: attachment.s3Key,
            };

            await s3Client.send(new DeleteObjectCommand(deleteParams));
            console.log(`✅ Deleted from S3: ${attachment.s3Key}`);
          } else if (attachment.url && attachment.url.startsWith("/uploads/")) {
            // Delete from local storage
            const filePath = path.join(__dirname, "..", attachment.url);
            try {
              await fs.unlink(filePath);
              console.log(`✅ Deleted from local: ${filePath}`);
            } catch (err) {
              if (err.code !== "ENOENT") {
                // Ignore if file doesn't exist
                throw err;
              }
            }
          }

          // Remove attachment from message
          message.attachments.splice(i, 1);
          messageModified = true;
          deletedCount++;
        } catch (error) {
          console.error(`❌ Error deleting attachment: ${attachment.filename}`, error);
          errors++;
        }
      }

      // Save message if modified
      if (messageModified) {
        await message.save();
      }
    }

    console.log(`
✅ Media cleanup completed!
📊 Statistics:
   - Deleted: ${deletedCount} files
   - Skipped (important): ${skippedImportant} files
   - Errors: ${errors} files
   - Cutoff date: ${thirtyDaysAgo.toLocaleDateString()}
    `);

    return {
      success: true,
      deletedCount,
      skippedImportant,
      errors,
      cutoffDate: thirtyDaysAgo,
    };
  } catch (error) {
    console.error("❌ Media cleanup service error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get statistics about media storage
 */
async function getMediaStats() {
  try {
    const messages = await Message.find({
      "attachments.0": { $exists: true },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let totalAttachments = 0;
    let oldAttachments = 0;
    let importantAttachments = 0;
    let eligibleForDeletion = 0;
    let totalSize = 0;

    for (const message of messages) {
      for (const attachment of message.attachments) {
        totalAttachments++;
        totalSize += attachment.size || 0;

        if (attachment.isImportant) {
          importantAttachments++;
        }

        if (new Date(attachment.uploadedAt) < thirtyDaysAgo) {
          oldAttachments++;

          if (!attachment.isImportant) {
            eligibleForDeletion++;
          }
        }
      }
    }

    return {
      totalAttachments,
      oldAttachments,
      importantAttachments,
      eligibleForDeletion,
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    };
  } catch (error) {
    console.error("Error getting media stats:", error);
    throw error;
  }
}

module.exports = {
  cleanupOldMedia,
  getMediaStats,
};
