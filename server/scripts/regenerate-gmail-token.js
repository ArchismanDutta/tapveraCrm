// scripts/regenerate-gmail-token.js
// Script to regenerate Gmail OAuth2 refresh token

require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose'
];

async function regenerateToken() {
  console.log('\n📧 Gmail OAuth2 Token Regeneration Tool\n');
  console.log('='.repeat(70));

  // Get credentials from environment
  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

  // Validate credentials exist
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.log('❌ Error: Missing Gmail API credentials in .env file');
    console.log('\nRequired variables:');
    console.log('  - GMAIL_CLIENT_ID');
    console.log('  - GMAIL_CLIENT_SECRET');
    console.log('\nGet these from: https://console.cloud.google.com/apis/credentials');
    process.exit(1);
  }

  console.log('✅ Gmail API credentials found\n');
  console.log('Client ID:', CLIENT_ID.substring(0, 20) + '...');
  console.log('Redirect URI:', REDIRECT_URI);
  console.log('\n' + '='.repeat(70));

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Generate authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force consent screen to get refresh token
  });

  console.log('\n🔗 STEP 1: Authorize this app');
  console.log('='.repeat(70));
  console.log('\nOpen this URL in your browser:\n');
  console.log('\x1b[36m%s\x1b[0m', authUrl);
  console.log('\n' + '='.repeat(70));
  console.log('\n📋 Instructions:');
  console.log('  1. Click the URL above (or copy-paste into browser)');
  console.log('  2. Sign in with: tapveratechnologies@gmail.com');
  console.log('  3. Allow all permissions');
  console.log('  4. You will be redirected to a page (might show error - that\'s OK)');
  console.log('  5. Copy the ENTIRE URL from your browser address bar');
  console.log('     Example: http://localhost:3000/auth/google/callback?code=4/0A...');
  console.log('\n' + '='.repeat(70));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n📝 Paste the full redirect URL here: ', async (redirectUrl) => {
    try {
      // Extract the code from the URL
      const url = new URL(redirectUrl);
      const code = url.searchParams.get('code');

      if (!code) {
        console.log('\n❌ Error: No authorization code found in URL');
        console.log('Make sure you pasted the complete URL including ?code=...');
        rl.close();
        process.exit(1);
      }

      console.log('\n✅ Authorization code extracted');
      console.log('\n🔄 Exchanging code for tokens...');

      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.refresh_token) {
        console.log('\n⚠️  Warning: No refresh token received');
        console.log('This can happen if you previously authorized this app.');
        console.log('\nSolutions:');
        console.log('  1. Go to https://myaccount.google.com/permissions');
        console.log('  2. Remove your app from authorized apps');
        console.log('  3. Run this script again');
        rl.close();
        process.exit(1);
      }

      console.log('\n✅ Tokens received successfully!\n');
      console.log('='.repeat(70));
      console.log('\n📋 Add these to your .env file:\n');
      console.log('\x1b[32m%s\x1b[0m', 'GMAIL_CLIENT_ID=' + CLIENT_ID);
      console.log('\x1b[32m%s\x1b[0m', 'GMAIL_CLIENT_SECRET=' + CLIENT_SECRET);
      console.log('\x1b[32m%s\x1b[0m', 'GMAIL_REDIRECT_URI=' + REDIRECT_URI);
      console.log('\x1b[32m%s\x1b[0m', 'GMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('\x1b[32m%s\x1b[0m', 'GMAIL_USER=tapveratechnologies@gmail.com');
      console.log('\n' + '='.repeat(70));

      // Test the token
      console.log('\n🧪 Testing the new token...');
      oauth2Client.setCredentials(tokens);

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });

      console.log('✅ Token is valid!');
      console.log('Email:', profile.data.emailAddress);
      console.log('Messages Total:', profile.data.messagesTotal);

      console.log('\n✨ Success! Your Gmail API is ready to send emails.\n');
      console.log('🚀 Next steps:');
      console.log('  1. Add the tokens to your AWS .env file');
      console.log('  2. Restart your server');
      console.log('  3. Test by creating a new client\n');

    } catch (error) {
      console.log('\n❌ Error:', error.message);

      if (error.message.includes('redirect_uri_mismatch')) {
        console.log('\n🔧 Fix: Redirect URI mismatch');
        console.log('  1. Go to https://console.cloud.google.com/apis/credentials');
        console.log('  2. Click your OAuth 2.0 Client ID');
        console.log('  3. Add this to "Authorized redirect URIs":');
        console.log('     ' + REDIRECT_URI);
        console.log('  4. Save and try again');
      } else if (error.message.includes('invalid_grant')) {
        console.log('\n🔧 Fix: Invalid authorization code');
        console.log('  - The code may have expired (they expire quickly)');
        console.log('  - Run this script again and paste the URL faster');
      }
    } finally {
      rl.close();
    }
  });
}

// Run the script
regenerateToken().catch(error => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
