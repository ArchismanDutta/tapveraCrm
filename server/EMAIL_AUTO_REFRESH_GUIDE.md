# Gmail API Auto-Refresh Token System

## Overview

This system solves the **Gmail OAuth refresh token expiration problem** for AWS deployments. Instead of manually updating environment variables every time the token expires, the system automatically refreshes and stores tokens in the database.

## The Problem

Gmail OAuth refresh tokens expire frequently (especially in Testing mode - every 7 days). In AWS deployments:
- ❌ You can't dynamically update environment variables
- ❌ Manual token updates require redeployment
- ❌ Service downtime when tokens expire
- ❌ Emails fail silently

## The Solution

This auto-refresh system:
- ✅ Stores refresh tokens in MongoDB (survives deployments)
- ✅ Automatically refreshes when needed
- ✅ Falls back to database token if environment token expires
- ✅ Falls back to SMTP if Gmail API completely fails
- ✅ Zero manual intervention required

---

## How It Works

```
┌─────────────────┐
│  AWS ENV Vars   │  ← Initial refresh token (set once)
│ GMAIL_REFRESH_  │
│     TOKEN       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Gmail Service  │  ← Loads token on startup
│   (initialize)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    MongoDB      │  ← Saves to database
│  EmailCreds     │     (auto-updates on refresh)
└────────┬────────┘
         │
         │  Token expires?
         ▼
┌─────────────────┐
│  Auto Refresh   │  ← Google issues new token
│   (on send)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Save New Token │  ← Stored in DB automatically
│   to Database   │
└─────────────────┘
```

---

## Setup Instructions

### 1. **Initial Setup** (One-time)

First, ensure you have these environment variables in AWS:

```env
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-initial-refresh-token
GMAIL_USER=tapveratechnologies@gmail.com
```

### 2. **Initialize Database** (Run once)

After deployment, run this command on your AWS server:

```bash
node scripts/initializeEmailCredentials.js
```

This will:
- Read the refresh token from environment variables
- Save it to MongoDB
- Display confirmation

### 3. **Restart Server**

```bash
# PM2 example
pm2 restart tapvera-crm

# Or using your deployment method
npm run start
```

### 4. **Verify It's Working**

Check your server logs for:

```
✅ Gmail API initialized successfully with auto-refresh
✅ Refresh token saved to database
```

---

## AWS Deployment Workflow

### Initial Deployment

1. Set environment variables in AWS (EB, EC2, Lambda, etc.):
   ```bash
   GMAIL_CLIENT_ID=...
   GMAIL_CLIENT_SECRET=...
   GMAIL_REFRESH_TOKEN=... (initial token)
   MONGODB_URI=...
   ```

2. Deploy your application

3. SSH into AWS server and run:
   ```bash
   cd /path/to/tapvera-crm/server
   node scripts/initializeEmailCredentials.js
   ```

4. Restart the application

### Future Deployments

**You never need to update GMAIL_REFRESH_TOKEN again!**

The system will:
- Load the latest token from database
- Auto-refresh when needed
- Save new tokens automatically

---

## How Auto-Refresh Works

### When Sending Email

```javascript
// Before sending, ensure valid token
await ensureValidToken();

// This function:
// 1. Tries to get access token with current refresh token
// 2. If it fails, loads refresh token from database
// 3. Tries again with database token
// 4. Falls back to SMTP if all fails
```

### When Token Refreshes

```javascript
// Google OAuth client emits 'tokens' event on refresh
oauth2Client.on('tokens', async (tokens) => {
  if (tokens.refresh_token) {
    // Automatically save new token to database
    await saveRefreshToken(tokens.refresh_token);
  }
});
```

### Fallback Chain

```
Gmail API (Env Token)
  ↓ (fails)
Gmail API (DB Token)
  ↓ (fails)
SMTP Fallback
  ↓ (fails)
Error logged
```

---

## Files Modified/Created

### New Files

1. **`models/EmailCredentials.js`**
   - MongoDB model for storing refresh tokens
   - Indexed by service type

2. **`scripts/initializeEmailCredentials.js`**
   - One-time setup script
   - Migrates env token to database

3. **`EMAIL_AUTO_REFRESH_GUIDE.md`** (this file)
   - Documentation and usage guide

### Modified Files

1. **`services/email/gmailService.js`**
   - Added auto-refresh logic
   - Added database token loading
   - Added token persistence

---

## Monitoring

### Check Token Status

```javascript
const EmailCredentials = require('./models/EmailCredentials');

const creds = await EmailCredentials.findOne({ service: 'gmail_api' });
console.log('Last refreshed:', creds.lastRefreshed);
console.log('Current token:', creds.refreshToken.substring(0, 20) + '...');
```

### Server Logs

Look for these log messages:

**Success:**
```
✅ Gmail API initialized successfully with auto-refresh
✅ Refresh token saved to database
✅ Email sent via Gmail API to user@example.com
```

**Auto-Refresh:**
```
🔄 New refresh token received, updating database...
✅ Refresh token saved to database
```

**Fallback:**
```
⚠️  Environment refresh token failed, trying database...
✅ Successfully refreshed using database token
```

---

## Troubleshooting

### Email still not sending?

1. **Check if token is in database:**
   ```bash
   node scripts/initializeEmailCredentials.js
   ```

2. **Check SMTP credentials (fallback):**
   - Generate app password: https://myaccount.google.com/apppasswords
   - Update `EMAIL_PASS` in environment variables

3. **Publish OAuth app** (prevents 7-day expiration):
   - Go to Google Cloud Console
   - OAuth consent screen
   - Change from "Testing" to "Production"

### Token still expiring frequently?

This means your OAuth app is in **Testing mode**:
- Testing mode: Tokens expire every 7 days
- Production mode: Tokens don't expire (unless revoked)

**Solution:** Publish your OAuth app to production.

---

## Benefits

✅ **Zero downtime** - Automatic token refresh
✅ **AWS compatible** - No env var updates needed
✅ **Fault tolerant** - Multiple fallback layers
✅ **Self-healing** - Recovers from token expiration
✅ **Future-proof** - Works with any deployment platform

---

## Security Notes

- ✅ Refresh tokens stored in database (encrypted at rest by MongoDB)
- ✅ Never exposed in logs (only first 20 chars shown)
- ✅ Only accessible by server with database credentials
- ✅ Auto-rotated by Google on each refresh

---

## Support

If you encounter issues:

1. Check server logs for error messages
2. Run validation script: `node scripts/validateEmailCredentials.js`
3. Verify database connection
4. Check SMTP fallback is configured

For production deployment in AWS:
- Ensure MongoDB is accessible from your AWS environment
- Set all environment variables in AWS console/config
- Run initialization script after first deployment only
