# Gmail Email Notification System - Implementation Guide

## 📋 Overview

Complete production-ready Gmail email notification system for Tapvera CRM with:
- ✅ Gmail API (OAuth2) as primary method
- ✅ SMTP as automatic fallback
- ✅ Email logging and tracking
- ✅ Automatic retry for failed emails
- ✅ Notifications for all CRM events

---

## 🎯 Features Implemented

### 1. Email Infrastructure
- **EmailLog Model**: Track all sent emails in database
- **Gmail API Service**: Send emails via Gmail API with OAuth2
- **SMTP Fallback**: Automatic fallback if Gmail API fails
- **Email Service Orchestrator**: Unified interface with retry logic

### 2. Notification Events
- ✅ Client account created (credentials email)
- ✅ Task assigned to employee
- ✅ Task status updated
- ✅ Task completed (notify client)
- ✅ New message in project (notify client/employees)

---

## 🔧 Installation Steps

### Step 1: Install Dependencies

```bash
cd server
npm install googleapis@110 nodemailer
```

### Step 2: Google Cloud Console Setup

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create project: "Tapvera-CRM-Email"

2. **Enable Gmail API**
   ```
   APIs & Services → Library → Search "Gmail API" → Enable
   ```

3. **Create OAuth 2.0 Credentials**
   ```
   APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID

   Application Type: Web Application
   Name: Tapvera CRM Email

   Authorized redirect URIs:
   - http://localhost:3000/auth/google/callback
   - https://your-production-domain.com/auth/google/callback
   ```

4. **Configure OAuth Consent Screen**
   ```
   User Type: External (or Internal if G Suite)
   App name: Tapvera CRM
   User support email: tapveratechnologies@gmail.com

   Scopes to add:
   - https://www.googleapis.com/auth/gmail.send
   ```

5. **Download credentials.json**
   - Save securely
   - **DO NOT commit to git**

### Step 3: Generate Refresh Token

Create a script to generate your refresh token:

```javascript
// scripts/setupGmail.js
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('Authorize this app by visiting this URL:', authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter the authorization code: ', (code) => {
  rl.close();
  oAuth2Client.getToken(code, (err, token) => {
    if (err) return console.error('Error:', err);
    console.log('\n✅ Add these to your .env file:\n');
    console.log(`GMAIL_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GMAIL_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`GMAIL_REFRESH_TOKEN=${token.refresh_token}`);
    console.log(`GMAIL_USER=tapveratechnologies@gmail.com`);
  });
});
```

Run it:
```bash
node scripts/setupGmail.js
```

### Step 4: Update .env File

Add these variables to your `.env`:

```env
# Gmail API (Primary)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_REDIRECT_URI=http://localhost:3000/auth/google/callback
GMAIL_USER=tapveratechnologies@gmail.com

# SMTP Fallback (App-Specific Password)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tapveratechnologies@gmail.com
EMAIL_PASS=your-app-specific-password

# Frontend URL for email links
FRONTEND_URL=http://localhost:5173
```

**To get App-Specific Password for SMTP fallback:**
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification
3. Go to "App passwords"
4. Generate new app password for "Mail"
5. Use this as `EMAIL_PASS`

### Step 5: Initialize Email Service in app.js

Add to your `server/app.js` (after database connection):

```javascript
// Initialize Email Service
const emailService = require('./services/email/emailService');
emailService.initialize().then(() => {
  console.log('✅ Email service ready');
}).catch(err => {
  console.error('❌ Email service initialization failed:', err);
});
```

### Step 6: Update Client Routes

The client routes (`server/routes/clientRoutes.js`) already have email sending. Update it to use the new service:

```javascript
const notificationService = require('../services/notificationService');

// In POST "/" route, replace the existing email code with:
await notificationService.sendClientWelcomeEmail(newClient);
```

### Step 7: Add Task Notifications

In `server/routes/taskRoutes.js` or your task controller:

```javascript
const notificationService = require('../services/notificationService');

// After creating task:
router.post("/", protect, async (req, res) => {
  try {
    const task = await Task.create({...});

    // Send notification
    await notificationService.sendTaskAssignedEmail(task);

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// After updating task status:
router.patch("/:taskId/status", protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    const oldStatus = task.status;

    task.status = req.body.status;
    await task.save();

    // Send notification
    await notificationService.sendTaskStatusUpdatedEmail(task, oldStatus, req.body.status);

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Step 8: Add Message Notifications

In `server/routes/projectRoutes.js`, in the POST messages endpoint:

```javascript
const notificationService = require('../services/notificationService');

// After creating message:
router.post("/:id/messages", protect, async (req, res) => {
  try {
    const message = await Message.create({...});

    // Send notification
    await notificationService.sendProjectMessageEmail(message);

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📊 Email Logging & Analytics

### View Email Stats

Create an admin endpoint to view email statistics:

```javascript
// server/routes/emailRoutes.js
const express = require('express');
const router = express.Router();
const emailService = require('../services/email/emailService');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Get email statistics
router.get('/stats', protect, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const { startDate, endDate, emailType } = req.query;
    const stats = await emailService.getStats({ startDate, endDate, emailType });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get email logs
router.get('/logs', protect, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, status, emailType } = req.query;

    const query = {};
    if (status) query.status = status;
    if (emailType) query.emailType = emailType;

    const logs = await EmailLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('relatedClient', 'clientName email')
      .populate('relatedUser', 'name email')
      .populate('relatedProject', 'projectName');

    const total = await EmailLog.countDocuments(query);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry failed emails
router.post('/retry', protect, authorize('admin', 'super-admin'), async (req, res) => {
  try {
    const results = await emailService.retryFailedEmails();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

Add to `app.js`:
```javascript
app.use('/api/emails', require('./routes/emailRoutes'));
```

---

## 🔄 Automatic Retry System

Create a cron job to retry failed emails:

```javascript
// scripts/emailRetryWorker.js
const emailService = require('../services/email/emailService');
const mongoose = require('mongoose');

async function retryFailedEmails() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await emailService.initialize();

    const results = await emailService.retryFailedEmails();
    console.log(`📧 Retry complete: ${results.succeeded}/${results.attempted} succeeded`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Retry failed:', error);
    process.exit(1);
  }
}

retryFailedEmails();
```

Run periodically (e.g., every 5 minutes) using cron or a scheduler like node-cron:

```javascript
// In app.js
const cron = require('node-cron');

// Retry failed emails every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await emailService.retryFailedEmails();
  } catch (error) {
    console.error('Email retry error:', error);
  }
});
```

---

## 🧪 Testing

### Test Email Sending

```javascript
// Test script
const emailService = require('./services/email/emailService');

async function test() {
  await emailService.initialize();

  const result = await emailService.sendEmail({
    to: 'your-test-email@gmail.com',
    subject: 'Test Email',
    html: '<h1>Test</h1><p>This is a test email.</p>',
    text: 'This is a test email.',
    emailType: 'client_welcome'
  });

  console.log('Result:', result);
}

test();
```

---

## 📈 Monitoring

### Key Metrics to Track

1. **Delivery Rate**: `(sent / total) * 100`
2. **Failure Rate**: `(failed / total) * 100`
3. **Average Retry Count**: For failed emails
4. **Gmail API vs SMTP Usage**: Which method is used more

### Monitoring Dashboard (Optional)

Create a simple dashboard in your admin panel:

```javascript
GET /api/emails/stats
Response:
{
  "total": 1523,
  "sent": 1489,
  "failed": 34,
  "pending": 0,
  "successRate": "97.77%",
  "byType": {
    "client_welcome": 45,
    "task_assigned": 567,
    "task_updated": 423,
    "message_sent": 488
  },
  "byMethod": {
    "gmail_api": 1456,
    "smtp": 12,
    "fallback_smtp": 21
  }
}
```

---

## 🚨 Troubleshooting

### Gmail API Errors

**Error: "Invalid grant"**
- Refresh token expired
- Solution: Re-run `setupGmail.js` to generate new token

**Error: "Daily sending quota exceeded"**
- Gmail API has limits (500/day for free accounts)
- Solution: Verify your account or use SMTP fallback

**Error: "Insufficient authentication scopes"**
- Missing required scopes
- Solution: Update OAuth consent screen scopes

### SMTP Errors

**Error: "Invalid credentials"**
- App-specific password incorrect
- Solution: Regenerate app-specific password

**Error: "Connection timeout"**
- Port blocked by firewall
- Solution: Try port 465 (SSL) instead of 587 (TLS)

---

## ✅ Checklist

- [ ] Install googleapis and nodemailer
- [ ] Create Google Cloud project
- [ ] Enable Gmail API
- [ ] Create OAuth2 credentials
- [ ] Generate refresh token
- [ ] Add credentials to .env
- [ ] Generate SMTP app-specific password
- [ ] Initialize email service in app.js
- [ ] Update client routes
- [ ] Add task notification triggers
- [ ] Add message notification triggers
- [ ] Create email admin routes
- [ ] Set up retry worker
- [ ] Test email sending
- [ ] Monitor delivery rates

---

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Nodemailer Documentation](https://nodemailer.com/)

---

## 🔐 Security Best Practices

1. **Never commit credentials** to git
2. Use **app-specific passwords** for SMTP, not account password
3. **Rotate credentials** periodically
4. **Monitor failed login attempts** in Google account activity
5. **Use HTTPS** for production redirect URIs
6. **Implement rate limiting** on email endpoints

---

## 📞 Support

For issues or questions:
- Check logs: `server/logs/email.log`
- View email logs: GET `/api/emails/logs`
- Retry failed: POST `/api/emails/retry`

---

*Last updated: 2025-10-27*
