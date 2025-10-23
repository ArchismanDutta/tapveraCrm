# Media Auto-Delete Feature Setup

## Overview
This feature automatically deletes media files (images, documents, videos) from AWS S3 or local storage after 30 days to reduce storage costs. Files marked as "Important" are never auto-deleted.

## Features
- ✅ Automatic deletion of media files older than 30 days
- ⭐ Mark files as "Important" to prevent auto-deletion
- 📊 Admin dashboard to view storage statistics
- 🔧 Manual cleanup trigger for admins
- 📅 Scheduled daily cleanup at 2:00 AM

## Installation

### 1. Install Required Package
```bash
cd server
npm install node-cron
```

### 2. Restart the Server
```bash
npm run dev
# or
node app.js
```

You should see these messages in the console:
```
✅ Connected to MongoDB
📅 Initializing cron jobs...
✅ Cron jobs initialized successfully!
   - Media cleanup: Daily at 2:00 AM
🚀 Server running at http://localhost:5000
```

## Usage

### For Users

#### Mark Media as Important
1. Go to any project detail page
2. View the chat/messages section
3. Find any message with attachments
4. Click the **star icon** next to the download button
5. Files marked with a yellow star will NEVER be auto-deleted

**Visual Indicators:**
- 🌟 **Yellow filled star** = Important (protected from deletion)
- ⭐ **Gray hollow star** = Normal (will be deleted after 30 days)

### For Admins

#### View Storage Statistics
```bash
GET /api/media/stats
```

Response:
```json
{
  "totalAttachments": 150,
  "oldAttachments": 45,
  "importantAttachments": 12,
  "eligibleForDeletion": 33,
  "totalSize": 524288000,
  "totalSizeMB": "500.00"
}
```

#### Manually Trigger Cleanup
```bash
POST /api/media/cleanup
```

Response:
```json
{
  "success": true,
  "deletedCount": 33,
  "skippedImportant": 12,
  "errors": 0,
  "cutoffDate": "2024-12-24T00:00:00.000Z"
}
```

## How It Works

### 1. Automatic Cleanup
- Runs daily at 2:00 AM server time
- Checks all attachments in the database
- Deletes files that are:
  - ✅ Older than 30 days
  - ✅ NOT marked as important
  - ✅ Have valid S3 keys or local paths

### 2. File Protection
- Users can mark any file as "Important"
- Important files are NEVER deleted, regardless of age
- Important status is visible with a yellow star icon

### 3. Deletion Process
- **AWS S3**: Uses DeleteObjectCommand to remove files
- **Local Storage**: Uses fs.unlink to remove files
- **Database**: Removes attachment records from messages
- **Logging**: Detailed console logs for monitoring

## Configuration

### Change Cleanup Schedule
Edit `server/jobs/cronJobs.js`:

```javascript
// Run media cleanup daily at 2:00 AM
// Cron format: minute hour day month weekday
cron.schedule("0 2 * * *", async () => {
  console.log("⏰ Running scheduled media cleanup...");
  await cleanupOldMedia();
});
```

**Common Schedules:**
- Every day at 3:00 AM: `"0 3 * * *"`
- Every Sunday at 1:00 AM: `"0 1 * * 0"`
- Every 1st day of month at 2:00 AM: `"0 2 1 * *"`
- Every hour: `"0 * * * *"`

### Change Retention Period
Edit `server/services/mediaCleanupService.js`:

```javascript
// Calculate date 30 days ago
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); // Change 30 to your desired days
```

## Database Changes

### Message Schema Updates
Added to `server/models/Message.js`:

```javascript
attachments: [
  {
    // ... existing fields
    isImportant: {
      type: Boolean,
      default: false,
    },
    s3Key: String, // AWS S3 object key for deletion
  },
]
```

## API Endpoints

### Toggle File Importance
```
PATCH /api/projects/:projectId/messages/:messageId/attachments/:attachmentId/toggle-important
```

### Get Storage Stats (Admin Only)
```
GET /api/media/stats
```

### Manual Cleanup (Admin Only)
```
POST /api/media/cleanup
```

## Monitoring

### Check Logs
When cleanup runs, you'll see detailed logs:

```
🧹 Starting media cleanup service...
✅ Deleted from S3: project-messages/1234567890-document.pdf
✅ Deleted from local: /uploads/messages/file.jpg
✅ Media cleanup completed!
📊 Statistics:
   - Deleted: 33 files
   - Skipped (important): 12 files
   - Errors: 0 files
   - Cutoff date: 12/24/2024
```

### Verify Cron Job is Running
Check server startup logs for:
```
📅 Initializing cron jobs...
✅ Cron jobs initialized successfully!
   - Media cleanup: Daily at 2:00 AM
```

## Troubleshooting

### Cron Job Not Starting
**Issue:** `Cron jobs initialization failed: Cannot find module 'node-cron'`

**Solution:**
```bash
cd server
npm install node-cron
npm restart
```

### Files Not Being Deleted
1. **Check if files are marked as important** - Important files are never deleted
2. **Check file age** - Only files older than 30 days are deleted
3. **Check S3 keys** - Files need valid `s3Key` field in database
4. **Check permissions** - Ensure server has permission to delete from S3

### Star Button Not Working
1. **Check authentication** - User must be logged in
2. **Check network** - Open browser console for error messages
3. **Check API endpoint** - Verify `/api/projects/:projectId/messages/:messageId/attachments/:attachmentId/toggle-important` is accessible

## Cost Savings

### Example AWS S3 Costs
- **Storage:** $0.023 per GB/month
- **Average file size:** 2 MB
- **Files uploaded:** 1000/month

**Without Auto-Delete (After 1 Year):**
- Total files: 12,000
- Total size: ~24 GB
- Monthly cost: $0.55/month
- **Annual cost: $6.60**

**With Auto-Delete (30-day retention):**
- Total files: ~1000
- Total size: ~2 GB
- Monthly cost: $0.046/month
- **Annual cost: $0.55**

**Savings: ~91% reduction in storage costs!**

## Security

- ✅ Admin-only access to cleanup and stats endpoints
- ✅ User authentication required for marking files as important
- ✅ Project-level access control maintained
- ✅ S3 credentials stored in environment variables

## Backup Recommendations

**Before enabling auto-delete:**
1. Ensure critical files are marked as "Important"
2. Consider backing up S3 bucket periodically
3. Test cleanup on staging environment first
4. Monitor logs after first automated run

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify all prerequisites are met
3. Test with manual cleanup first
4. Contact development team if issues persist
