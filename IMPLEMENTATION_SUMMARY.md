# Gmail Email System - Quick Implementation Summary

## ✅ Files Created

### 1. Core Email Infrastructure
```
server/models/EmailLog.js                    ✅ Created
server/services/email/gmailService.js        ✅ Created
server/services/email/smtpService.js         ✅ Created
server/services/email/emailService.js        ✅ Created
```

### 2. Documentation
```
GMAIL_EMAIL_SETUP.md                         ✅ Created (Complete setup guide)
IMPLEMENTATION_SUMMARY.md                    ✅ Created (This file)
```

---

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
cd server
npm install googleapis@110
```

### 2. Add to .env
```env
# Gmail API (get from Google Cloud Console)
GMAIL_CLIENT_ID=your-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_USER=tapveratechnologies@gmail.com

# SMTP Fallback
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tapveratechnologies@gmail.com
EMAIL_PASS=your-app-specific-password

FRONTEND_URL=http://localhost:5173
```

### 3. Initialize in app.js
Add after database connection:

```javascript
const emailService = require('./services/email/emailService');
emailService.initialize();
```

### 4. Update Client Routes
Replace email sending in `routes/clientRoutes.js`:

```javascript
// OLD (lines 15-118):
const sendEmail = require("../utils/sendEmail");
await sendEmail({
  provider: "gmail",
  to: email,
  subject: "Welcome...",
  html: emailHtml
});

// NEW:
const emailService = require('../services/email/emailService');
await emailService.sendEmail({
  to: email,
  subject: "Welcome to Tapvera CRM - Your Account Details",
  html: emailHtml,
  text: emailText,
  emailType: 'client_welcome',
  relatedClient: newClient._id
});
```

---

## 📧 Notification Service Code

Create `server/services/notificationService.js`:

```javascript
const emailService = require('./email/emailService');

class NotificationService {
  // 1. Client Welcome Email
  async sendClientWelcomeEmail(clientData) {
    const { _id, clientName, email, password, businessName } = clientData;
    const loginUrl = process.env.FRONTEND_URL;

    const html = `<h1>Welcome ${clientName}!</h1>
      <p>Email: ${email}</p>
      <p>Password: ${password}</p>
      <p><a href="${loginUrl}">Login Here</a></p>`;

    await emailService.sendEmail({
      to: email,
      subject: 'Welcome to Tapvera CRM',
      html,
      emailType: 'client_welcome',
      relatedClient: _id
    });
  }

  // 2. Task Assigned
  async sendTaskAssignedEmail(taskData) {
    const User = require('../models/User');

    for (const userId of taskData.assignedTo) {
      const user = await User.findById(userId);
      if (!user?.email) continue;

      const html = `<h1>New Task: ${taskData.title}</h1>
        <p>${taskData.description}</p>
        <p>Due: ${taskData.dueDate}</p>`;

      await emailService.sendEmail({
        to: user.email,
        subject: `New Task: ${taskData.title}`,
        html,
        emailType: 'task_assigned',
        relatedUser: userId,
        relatedTask: taskData._id
      });
    }
  }

  // 3. Task Status Updated
  async sendTaskStatusUpdatedEmail(task, oldStatus, newStatus) {
    const Task = require('../models/Task');
    const taskData = await Task.findById(task._id)
      .populate('assignedBy')
      .populate('project');

    if (taskData.assignedBy?.email) {
      const html = `<h1>Task Status Updated</h1>
        <p>${taskData.title}</p>
        <p>${oldStatus} → ${newStatus}</p>`;

      await emailService.sendEmail({
        to: taskData.assignedBy.email,
        subject: `Task Updated: ${taskData.title}`,
        html,
        emailType: 'task_updated',
        relatedTask: taskData._id
      });
    }

    // If completed, notify client
    if (newStatus === 'completed' && taskData.project) {
      const Project = require('../models/Project');
      const project = await Project.findById(taskData.project).populate('client');

      if (project.client?.email) {
        await emailService.sendEmail({
          to: project.client.email,
          subject: `Task Completed: ${taskData.title}`,
          html: `<h1>Task Completed!</h1><p>${taskData.title}</p>`,
          emailType: 'task_completed',
          relatedClient: project.client._id,
          relatedTask: taskData._id
        });
      }
    }
  }

  // 4. Project Message
  async sendProjectMessageEmail(messageData) {
    const Message = require('../models/Message');
    const Project = require('../models/Project');

    const message = await Message.findById(messageData._id)
      .populate('sentBy')
      .populate('project');

    const project = await Project.findById(message.project)
      .populate('client')
      .populate('assignedTo');

    const senderName = message.sentBy.name || message.sentBy.clientName;

    // Notify client if from employee
    if (message.senderType !== 'client' && project.client?.email) {
      await emailService.sendEmail({
        to: project.client.email,
        subject: `New Message: ${project.projectName}`,
        html: `<h1>New Message</h1>
          <p>From: ${senderName}</p>
          <p>${message.message}</p>`,
        emailType: 'project_message',
        relatedClient: project.client._id,
        relatedMessage: message._id
      });
    }

    // Notify employees if from client
    if (message.senderType === 'client') {
      for (const emp of project.assignedTo) {
        if (emp.email) {
          await emailService.sendEmail({
            to: emp.email,
            subject: `Client Message: ${project.projectName}`,
            html: `<h1>Client Message</h1>
              <p>From: ${senderName}</p>
              <p>${message.message}</p>`,
            emailType: 'message_received',
            relatedUser: emp._id,
            relatedMessage: message._id
          });
        }
      }
    }
  }
}

module.exports = new NotificationService();
```

---

## 🔌 Integration Points

### Client Creation
`routes/clientRoutes.js` - Line 9 (POST "/"):

```javascript
const notificationService = require('../services/notificationService');

router.post("/", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const newClient = new Client({...});
    await newClient.save();

    // Send welcome email
    await notificationService.sendClientWelcomeEmail(newClient);

    res.status(201).json(newClient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Task Creation
`routes/taskRoutes.js`:

```javascript
const notificationService = require('../services/notificationService');

// After task creation
await notificationService.sendTaskAssignedEmail(task);
```

### Task Status Update
`routes/taskRoutes.js`:

```javascript
// In PATCH /:taskId/status
const oldStatus = task.status;
task.status = req.body.status;
await task.save();

await notificationService.sendTaskStatusUpdatedEmail(task, oldStatus, req.body.status);
```

### Message Posting
`routes/projectRoutes.js` - Line 558 (POST "/:id/messages"):

```javascript
const notificationService = require('../services/notificationService');

// After message creation
await notificationService.sendProjectMessageEmail(newMessage);
```

---

## 📊 Admin Endpoints

Create `routes/emailRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const emailService = require('../services/email/emailService');
const EmailLog = require('../models/EmailLog');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Email statistics
router.get('/stats', protect, authorize('admin', 'super-admin'), async (req, res) => {
  const stats = await emailService.getStats(req.query);
  res.json(stats);
});

// Email logs
router.get('/logs', protect, authorize('admin', 'super-admin'), async (req, res) => {
  const { page = 1, limit = 50, status } = req.query;
  const query = status ? { status } : {};

  const logs = await EmailLog.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((page - 1) * limit)
    .populate('relatedClient relatedUser relatedProject');

  res.json({ logs, total: await EmailLog.countDocuments(query) });
});

// Retry failed emails
router.post('/retry', protect, authorize('admin', 'super-admin'), async (req, res) => {
  const results = await emailService.retryFailedEmails();
  res.json(results);
});

module.exports = router;
```

Add to `app.js`:
```javascript
app.use('/api/emails', require('./routes/emailRoutes'));
```

---

## 🧪 Testing

```javascript
// Test sending
const emailService = require('./services/email/emailService');

await emailService.initialize();
await emailService.sendEmail({
  to: 'test@example.com',
  subject: 'Test',
  html: '<h1>Test Email</h1>',
  emailType: 'client_welcome'
});
```

---

## 📈 Monitoring

### Check Email Logs:
```
GET /api/emails/logs?status=failed&page=1
```

### Get Statistics:
```
GET /api/emails/stats
```

### Retry Failed Emails:
```
POST /api/emails/retry
```

---

## ⚡ Priority Implementation Order

1. **High Priority** (Do First):
   - ✅ Add Gmail API credentials to .env
   - ✅ Initialize email service in app.js
   - ✅ Update client welcome email

2. **Medium Priority** (Next):
   - Add task notifications
   - Add message notifications

3. **Low Priority** (Later):
   - Admin email dashboard
   - Retry worker cron job
   - Advanced analytics

---

## 🎯 Next Steps

1. Follow `GMAIL_EMAIL_SETUP.md` for complete Gmail API setup
2. Test with: `node scripts/setupGmail.js`
3. Create client and verify email received
4. Monitor logs at `/api/emails/logs`

---

**Questions? Check `GMAIL_EMAIL_SETUP.md` for detailed guide!**
