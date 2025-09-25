# Security Setup Guide

## Environment Variables Configuration

**⚠️ CRITICAL: Never commit actual credentials to version control**

### Required Environment Variables

Copy `.env.example` to `.env` and replace all placeholder values with your actual credentials:

```bash
cp .env.example .env
```

### Google Sheets Integration Setup

1. **Google OAuth Configuration** (for user authentication):
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
   - `GOOGLE_REDIRECT_URI`: OAuth callback URL (usually `http://localhost:5000/api/sheets/callback`)

2. **Google Service Account** (for direct sheet access):
   - `GOOGLE_PROJECT_ID`: Your Google Cloud project ID
   - `GOOGLE_PRIVATE_KEY_ID`: Service account private key ID
   - `GOOGLE_PRIVATE_KEY`: Service account private key (keep quotes and escape newlines)
   - `GOOGLE_CLIENT_EMAIL`: Service account email address

### Security Best Practices

1. **Never expose service account credentials** in client-side code
2. **Always use environment variables** for sensitive data
3. **Regularly rotate credentials** and API keys
4. **Restrict API access** using IP allowlists when possible
5. **Monitor usage** of service accounts and OAuth tokens

### Google Sheets Permissions

For the Google Sheets integration to work:

1. Share your Google Sheet with the service account email: `${GOOGLE_CLIENT_EMAIL}`
2. Grant "Editor" permissions to allow cell updates
3. Ensure the sheet is accessible via the provided sharing settings

### Environment Variable Validation

The application will validate required environment variables on startup and provide specific error messages for missing credentials.