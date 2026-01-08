# Quick Email Setup Guide - Gmail App Password (UPDATED)

## What Changed?
We've switched from OAuth (Gmail API) to **Gmail App Passwords** because:
- ✅ No more refresh token expiry issues
- ✅ More stable and reliable
- ✅ Simpler setup - no OAuth configuration needed
- ✅ Perfect for automated system emails

---

## Setup Steps (5 Minutes)

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Click on **2-Step Verification**
3. Follow the prompts to enable it (if not already enabled)

### Step 2: Generate Gmail App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Sign in if prompted
3. Under "Select app", choose **Mail**
4. Under "Select device", choose **Other (Custom name)**
5. Type: **Tapvera CRM**
6. Click **Generate**
7. **Copy the 16-character password** (it will look like: `abcd efgh ijkl mnop`)
8. Remove the spaces: `abcdefghijklmnop`

### Step 3: Update .env File

Update your `server/.env` with these values:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tapveratechnologies@gmail.com
EMAIL_PASS=abcdefghijklmnop
```

**Replace `abcdefghijklmnop` with your actual 16-character app password (no spaces)**

### Step 4: Restart Server

Stop the server (Ctrl+C) and restart it:

```bash
cd server
npm start
```

You should see:
```
✅ Email Service ready (SMTP with App Password)
```

### Step 5: Test by Creating a Client

Create a new client account and check:
1. The console should show: `✅ Email sent via SMTP to client@email.com`
2. Check the client's email inbox (including spam folder)

---

## Troubleshooting

### Error: "SMTP not configured"
- Make sure you've added `EMAIL_USER` and `EMAIL_PASS` to `.env`
- Ensure EMAIL_PASS is your App Password (16 characters, no spaces)
- Restart the server after updating `.env`

### Error: "Invalid login" or "Authentication failed"
- Your app password is incorrect
- Go back to [App Passwords](https://myaccount.google.com/apppasswords) and generate a new one
- Update `EMAIL_PASS` in `.env`

### Error: "Connection timeout"
- Check your internet connection
- Make sure port 587 is not blocked by firewall
- Try port 465 with SSL instead (update `EMAIL_PORT=465` in `.env`)

### Email not received
- Check spam/junk folder
- Check server console for error messages
- Verify the recipient email address is correct
- Check Gmail account's "Sent" folder to confirm it was sent

### Error: "Daily sending limit exceeded"
- Gmail has a limit of ~500 emails per day for regular accounts
- Wait 24 hours or upgrade to Google Workspace for higher limits

---

## Quick Check

Your `.env` should have these lines:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tapveratechnologies@gmail.com
EMAIL_PASS=your_16_character_app_password_here

# Frontend URL (for links in emails)
FRONTEND_URL=http://localhost:5173
```

---

## Old OAuth Method (Deprecated)

The Gmail API with OAuth method is no longer recommended due to refresh token expiry issues. If you have old OAuth credentials in your `.env`, you can safely remove them:

```env
# These are no longer needed:
# GMAIL_CLIENT_ID=
# GMAIL_CLIENT_SECRET=
# GMAIL_REFRESH_TOKEN=
# GMAIL_REDIRECT_URI=
```
