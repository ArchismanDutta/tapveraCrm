# 🚨 URGENT: Rotate Exposed Credentials

## What Happened?

Your OAuth credentials were temporarily exposed in GitHub before being removed. GitHub's secret scanning detected them.

## ✅ What I've Done

1. ✅ Removed secret files from Git history
2. ✅ Force pushed clean history to GitHub
3. ✅ Added secret files to .gitignore

## ⚠️ What YOU Must Do NOW

Since the credentials were exposed (even briefly), you MUST rotate them immediately:

---

## 1. Rotate Gmail OAuth Credentials (HIGH PRIORITY)

### Step 1: Revoke Current Tokens

1. Go to: https://myaccount.google.com/permissions
2. Find your OAuth app
3. Click "Remove Access"

### Step 2: Delete Old OAuth Client (Optional but Recommended)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Find Client ID: `116545145867-timlj63pempj54ojnq7i1b4083nfpiks...`
3. Click DELETE

### Step 3: Create New OAuth Client ID

1. In Google Cloud Console → APIs & Services → Credentials
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. Application type: "Web application"
4. Name: "Tapvera CRM Email Service v2"
5. Authorized redirect URIs:
   - `http://localhost:3000/auth/google/callback`
   - Add your production URL
6. Click "CREATE"
7. **Copy the new Client ID and Client Secret**

### Step 4: Generate New Refresh Token

Run this script (I'll create it for you):

```bash
cd server
node scripts/generateNewGmailToken.js
```

Follow the OAuth flow and copy the new refresh token.

### Step 5: Update Environment Variables

Update `server/.env`:

```env
GMAIL_CLIENT_ID=NEW_CLIENT_ID_HERE
GMAIL_CLIENT_SECRET=NEW_CLIENT_SECRET_HERE
GMAIL_REFRESH_TOKEN=NEW_REFRESH_TOKEN_HERE
```

---

## 2. Rotate AWS Credentials (HIGH PRIORITY)

Your AWS keys were also exposed.

### Step 1: Deactivate Old Keys

1. Go to: https://console.aws.amazon.com/iam/home#/users
2. Find your user
3. Go to "Security credentials" tab
4. Find the old access key (check your local .env file)
5. Click "Make inactive"
6. After confirming new keys work, DELETE the old key

### Step 2: Create New Access Key

1. Same page, click "Create access key"
2. Choose: "Application running outside AWS"
3. Click "Next" → "Create access key"
4. **Download the CSV or copy the credentials**

### Step 3: Update Environment Variables

Update `server/.env`:

```env
AWS_ACCESS_KEY_ID=NEW_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=NEW_SECRET_KEY
```

---

## 3. Rotate JWT Secret (MEDIUM PRIORITY)

Your JWT secret was exposed (check your local .env file).

### Step 1: Generate New Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output (looks like: `a1b2c3d4e5f6...`)

### Step 2: Update Environment Variable

Update `server/.env`:

```env
JWT_SECRET=NEW_RANDOM_SECRET_HERE
```

⚠️ **WARNING:** This will invalidate all existing user sessions. Users will need to log in again.

---

## 4. Change SMTP Password (LOW PRIORITY)

The SMTP password was exposed (check your local .env file).

To rotate it:

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in: `anishjaiswalbect@gmail.com`
3. Generate new App Password
4. Update `server/.env`:

```env
EMAIL_PASS=NEW_APP_PASSWORD_HERE
```

---

## 5. Rotate Encryption Key (MEDIUM PRIORITY)

Your encryption key was exposed (check your local .env file).

### Step 1: Generate New Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 2: Update Environment Variable

Update `server/.env`:

```env
ENCRYPTION_KEY=NEW_RANDOM_KEY_HERE
```

⚠️ **WARNING:** This may affect encrypted data in your database.

---

## After Rotating All Credentials

### 1. Test Everything

```bash
cd server
npm restart
```

Test:
- ✅ User login (JWT)
- ✅ File uploads (AWS S3)
- ✅ Email sending (Gmail/SMTP)
- ✅ Database connections

### 2. Update Production

If you're using AWS Elastic Beanstalk:

```bash
eb setenv GMAIL_CLIENT_ID="new_value" GMAIL_CLIENT_SECRET="new_value" GMAIL_REFRESH_TOKEN="new_value" AWS_ACCESS_KEY_ID="new_value" AWS_SECRET_ACCESS_KEY="new_value" JWT_SECRET="new_value"
```

### 3. Monitor for Unauthorized Access

- Check AWS CloudTrail for unauthorized API calls
- Check Gmail for suspicious sent emails
- Monitor your application logs

---

## Checklist

- [ ] Revoked Gmail OAuth tokens
- [ ] Created new OAuth Client ID
- [ ] Generated new Gmail refresh token
- [ ] Updated GMAIL_* in .env
- [ ] Deactivated old AWS keys
- [ ] Created new AWS access key
- [ ] Updated AWS_* in .env
- [ ] Generated new JWT secret
- [ ] Updated JWT_SECRET in .env
- [ ] Generated new SMTP app password
- [ ] Updated EMAIL_PASS in .env
- [ ] Generated new encryption key
- [ ] Updated ENCRYPTION_KEY in .env
- [ ] Tested all functionality
- [ ] Updated production environment variables
- [ ] Monitored for unauthorized access

---

## Prevention

✅ Already done:
- Added sensitive files to .gitignore
- Removed secrets from Git history

Still needed:
- [ ] Use environment variable management (AWS Secrets Manager, etc.)
- [ ] Never commit .env files
- [ ] Use git-secrets or similar tools
- [ ] Regular credential rotation (every 90 days)

---

## Need Help?

Run the OAuth token generation script I created:

```bash
cd server
node scripts/generateNewGmailToken.js
```

This will guide you through the OAuth flow step by step.

---

## Timeline

**Do THIS NOW (Today):**
1. Rotate Gmail OAuth credentials
2. Rotate AWS credentials
3. Rotate JWT secret

**Do within 24 hours:**
4. Rotate SMTP password
5. Rotate encryption key

**Do within 1 week:**
6. Set up proper secrets management
7. Implement monitoring

---

**Your repository is now clean, but the exposed credentials must be rotated ASAP!**
