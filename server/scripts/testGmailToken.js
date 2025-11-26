// Test Gmail Refresh Token Validity
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { google } = require('googleapis');

async function testGmailToken() {
  console.log('\n========================================');
  console.log('  GMAIL REFRESH TOKEN VALIDATION TEST');
  console.log('========================================\n');

  const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
  const GMAIL_USER = process.env.GMAIL_USER;

  console.log('Configuration Check:');
  console.log('-------------------');
  console.log(`✓ Client ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 20) + '...' : '❌ NOT SET'}`);
  console.log(`✓ Client Secret: ${CLIENT_SECRET ? CLIENT_SECRET.substring(0, 15) + '...' : '❌ NOT SET'}`);
  console.log(`✓ Refresh Token: ${REFRESH_TOKEN ? REFRESH_TOKEN.substring(0, 20) + '...' : '❌ NOT SET'}`);
  console.log(`✓ Gmail User: ${GMAIL_USER || '❌ NOT SET'}\n`);

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.error('❌ Missing required Gmail API credentials in .env file\n');
    process.exit(1);
  }

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      'http://localhost:3000/auth/google/callback'
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN
    });

    console.log('Testing Token...');
    console.log('-------------------');

    // Try to get access token
    const { token } = await oauth2Client.getAccessToken();

    if (token) {
      console.log('✅ REFRESH TOKEN IS VALID!\n');
      console.log('Access Token obtained successfully');
      console.log(`Token preview: ${token.substring(0, 40)}...\n`);

      // Try to access Gmail API
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });

      console.log('Gmail API Access:');
      console.log('-------------------');
      console.log(`✅ Email: ${profile.data.emailAddress}`);
      console.log(`✅ Total Messages: ${profile.data.messagesTotal || 0}`);
      console.log(`✅ Threads Total: ${profile.data.threadsTotal || 0}\n`);

      // Check sent messages
      const sentMessages = await gmail.users.messages.list({
        userId: 'me',
        q: 'in:sent',
        maxResults: 1
      });

      console.log(`✅ Sent Messages Count: ${sentMessages.data.resultSizeEstimate || 0}\n`);

      console.log('========================================');
      console.log('  ✅ ALL TESTS PASSED');
      console.log('  Gmail API is working perfectly!');
      console.log('========================================\n');

    } else {
      console.error('❌ REFRESH TOKEN IS INVALID - Could not obtain access token\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ REFRESH TOKEN TEST FAILED\n');
    console.error('Error Details:');
    console.error('-------------------');
    console.error(`Message: ${error.message}`);
    console.error(`Code: ${error.code || 'N/A'}`);

    if (error.message.includes('invalid_grant')) {
      console.error('\n⚠️  REFRESH TOKEN HAS EXPIRED OR BEEN REVOKED');
      console.error('You need to regenerate the OAuth tokens.\n');
      console.error('Follow these steps:');
      console.error('1. Go to Google Cloud Console');
      console.error('2. Create new OAuth credentials');
      console.error('3. Get authorization code');
      console.error('4. Exchange for new refresh token');
      console.error('5. Update GMAIL_REFRESH_TOKEN in .env\n');
    }

    console.error('========================================\n');
    process.exit(1);
  }
}

testGmailToken();
