// scripts/test-gmail-token.js
// Quick test to check if current Gmail token is valid

require('dotenv').config();
const { google } = require('googleapis');

async function testCurrentToken() {
  console.log('\n🧪 Testing Current Gmail OAuth Token\n');
  console.log('='.repeat(70));

  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
  const GMAIL_USER = process.env.GMAIL_USER;

  // Check if all credentials are present
  console.log('\n📋 Checking credentials:');
  console.log('  GMAIL_USER:', GMAIL_USER || '❌ MISSING');
  console.log('  GMAIL_CLIENT_ID:', CLIENT_ID ? '✅ SET' : '❌ MISSING');
  console.log('  GMAIL_CLIENT_SECRET:', CLIENT_SECRET ? '✅ SET' : '❌ MISSING');
  console.log('  GMAIL_REFRESH_TOKEN:', REFRESH_TOKEN ? '✅ SET' : '❌ MISSING');

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.log('\n❌ Missing required credentials in .env file');
    console.log('\n🔧 Run this command to regenerate:');
    console.log('   node scripts/regenerate-gmail-token.js\n');
    process.exit(1);
  }

  console.log('\n='.repeat(70));
  console.log('\n🔄 Testing token validity...\n');

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );

    oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN
    });

    // Try to get access token
    const { token } = await oauth2Client.getAccessToken();

    if (!token) {
      throw new Error('Failed to get access token');
    }

    console.log('✅ Access token obtained successfully');

    // Try to access Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });

    console.log('✅ Gmail API access successful\n');
    console.log('Account Details:');
    console.log('  Email:', profile.data.emailAddress);
    console.log('  Total Messages:', profile.data.messagesTotal);
    console.log('  Total Threads:', profile.data.threadsTotal);

    console.log('\n='.repeat(70));
    console.log('\n✨ Token is VALID! Gmail API is working correctly.\n');
    console.log('✅ Your server should be able to send emails.\n');

    return true;

  } catch (error) {
    console.log('❌ Token validation FAILED\n');
    console.log('Error:', error.message);

    if (error.message.includes('invalid_grant')) {
      console.log('\n🔍 Diagnosis: Token has been revoked or expired');
      console.log('\n🔧 Solution:');
      console.log('   1. Run: node scripts/regenerate-gmail-token.js');
      console.log('   2. Follow the instructions to get a new token');
      console.log('   3. Update your .env file with the new token');
    } else if (error.message.includes('Invalid Credentials')) {
      console.log('\n🔍 Diagnosis: Client ID or Secret is incorrect');
      console.log('\n🔧 Solution:');
      console.log('   1. Go to https://console.cloud.google.com/apis/credentials');
      console.log('   2. Verify your OAuth 2.0 Client credentials');
      console.log('   3. Update GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
    } else {
      console.log('\n🔍 Unexpected error. Please check your Google Cloud project:');
      console.log('   - Gmail API is enabled');
      console.log('   - OAuth consent screen is configured');
      console.log('   - Your app is not in "Testing" mode (or add test users)');
    }

    console.log('\n');
    return false;
  }
}

// Run test
testCurrentToken()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  });
