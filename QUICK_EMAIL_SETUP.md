# Quick Email Setup Guide

## Problem
Client emails are not being sent because Gmail API is not configured.

## Solution - Follow These Steps:

### Step 1: Update .env with Gmail Credentials
You said you already have Gmail Client ID and Secret. Update these lines in `server/.env`:

```env
GMAIL_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=YOUR_ACTUAL_CLIENT_SECRET
```

### Step 2: Generate Refresh Token

Run this command to generate the refresh token:

```bash
cd server
node scripts/setupGmail.js
```

This will:
1. Show you an authorization URL
2. You open it in browser
3. Sign in with **tapveratechnologies@gmail.com**
4. Grant permissions
5. Copy the authorization code
6. Paste it back into the terminal
7. It will give you the `GMAIL_REFRESH_TOKEN`

### Step 3: Add Refresh Token to .env

Copy the refresh token from the terminal output and add it to your `.env`:

```env
GMAIL_REFRESH_TOKEN=the-long-refresh-token-you-got
```

### Step 4: Restart Server

Stop the server (Ctrl+C) and restart it:

```bash
npm start
```

You should see:
```
✅ Gmail API initialized successfully
✅ Email service ready (Primary: Gmail API, Fallback: SMTP)
```

### Step 5: Test by Creating a Client

Create a new client account and check:
1. The console should show: `✅ Welcome email sent to client@email.com`
2. Check the client's email inbox (including spam folder)

---

## Alternative: Use SMTP Only (Simpler)

If you can't set up Gmail API, you can use SMTP instead:

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification
3. Go to "App passwords"
4. Generate a new app password for "Mail"
5. Update `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tapveratechnologies@gmail.com
EMAIL_PASS=your-16-character-app-password
```

---

## Troubleshooting

### Error: "Gmail API credentials not configured"
- Make sure you've added `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` to `.env`
- Restart the server after updating `.env`

### Error: "Invalid grant"
- Your refresh token expired
- Run `node scripts/setupGmail.js` again to generate a new one

### Email not received
- Check spam/junk folder
- Check server console for error messages
- Verify `FRONTEND_URL` is set correctly in `.env`

---

## Quick Check

Your `.env` should have these lines:

```env
FRONTEND_URL=http://localhost:5173

GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
GMAIL_USER=tapveratechnologies@gmail.com
```
