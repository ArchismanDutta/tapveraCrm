# Gmail App Password Setup - Quick Guide

## ✅ What We Changed

We've migrated from OAuth (Gmail API) to **Gmail App Passwords** to solve your refresh token expiry issues.

### Files Removed:
- ❌ `server/services/email/gmailService.js` - OAuth Gmail service
- ❌ `server/models/EmailCredentials.js` - OAuth token storage
- ❌ `server/scripts/setupGmail.js` - OAuth setup scripts
- ❌ `server/scripts/generateNewGmailToken.js`
- ❌ `server/scripts/regenerate-gmail-token.js`
- ❌ `server/scripts/test-gmail-token.js`
- ❌ `server/scripts/testGmailToken.js`
- ❌ `server/scripts/checkDatabaseToken.js`
- ❌ `server/test-gmail.js`

### Files Updated:
- ✅ `server/services/email/emailService.js` - Now uses SMTP only
- ✅ `server/.env.example` - Updated with App Password instructions
- ✅ `QUICK_EMAIL_SETUP.md` - Updated guide
- ✅ `GMAIL_EMAIL_SETUP.md` - Marked as deprecated

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Generate Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/security
2. Enable **2-Step Verification** (if not already enabled)
3. Go to: https://myaccount.google.com/apppasswords
4. Create a new app password:
   - Select app: **Mail**
   - Select device: **Other (Custom name)**
   - Enter: **Tapvera CRM**
5. Click **Generate**
6. **Copy the 16-character password** (example: `abcd efgh ijkl mnop`)
7. Remove spaces: `abcdefghijklmnop`

### Step 2: Update Your .env File

Open `server/.env` and update these variables:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tapveratechnologies@gmail.com
EMAIL_PASS=your_16_character_app_password_here
```

**Replace `your_16_character_app_password_here` with the password from Step 1 (no spaces)**

### Step 3: Restart Your Server

```bash
cd server
npm start
```

You should see:
```
✅ Email Service ready (SMTP with App Password)
```

---

## 🧪 Test the Setup

### Test 1: Create a New Client

1. Create a new client account in your CRM
2. Check the server console for: `✅ Email sent via SMTP to client@email.com`
3. Check the client's email inbox (including spam folder)

### Test 2: Send Project Message

1. Send a message in any project
2. The client should receive an email notification
3. Check server logs for confirmation

---

## ❓ Troubleshooting

### "SMTP not configured" Error
- Check that `EMAIL_USER` and `EMAIL_PASS` are set in `.env`
- Make sure there are no extra spaces in the app password
- Restart the server

### "Authentication failed" Error
- The app password is incorrect
- Generate a new app password and update `.env`
- Make sure you're using the app password, not your regular Gmail password

### Emails Not Being Received
- Check spam/junk folder
- Verify the recipient email address
- Check your Gmail "Sent" folder to confirm the email was sent
- Look at server logs for error messages

### "Daily sending limit exceeded"
- Gmail limits regular accounts to ~500 emails/day
- Wait 24 hours or consider upgrading to Google Workspace

---

## 📦 What About `googleapis` Package?

We kept the `googleapis` package in `package.json` because it's still used for:
- ✅ Google Sheets integration (`server/services/googleSheets.js`)

We only removed Gmail OAuth functionality, not the entire Google API integration.

---

## ✨ Benefits of This Approach

- ✅ **No expiration**: App passwords don't expire (unless manually revoked)
- ✅ **Simpler**: No OAuth flow, no token refresh logic
- ✅ **Stable**: Perfect for automated system emails
- ✅ **Reliable**: No "invalid_grant" errors
- ✅ **Easy maintenance**: Set it and forget it

---

## 🔒 Security Notes

1. Keep your app password secure (never commit to git)
2. The `.env` file is already in `.gitignore`
3. You can revoke app passwords anytime at https://myaccount.google.com/apppasswords
4. Use different app passwords for different apps/environments

---

## 📝 Next Steps

Once you've completed the setup:
1. ✅ Test client creation emails
2. ✅ Test project message notifications
3. ✅ Test task assignment emails
4. ✅ Monitor email logs in the database
5. ✅ Remove old OAuth credentials from your `.env` file (optional cleanup)

**Old OAuth variables you can remove:**
```env
# These are no longer needed - safe to delete
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_REDIRECT_URI=
```

---

Need help? Check `QUICK_EMAIL_SETUP.md` for more detailed troubleshooting.
