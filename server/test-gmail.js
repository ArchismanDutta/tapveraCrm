// Test Gmail API Configuration
require('dotenv').config();
const { google } = require('googleapis');

console.log('🔍 Testing Gmail API Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('GMAIL_CLIENT_ID:', process.env.GMAIL_CLIENT_ID ? '✅ Set' : '❌ Missing');
console.log('GMAIL_CLIENT_SECRET:', process.env.GMAIL_CLIENT_SECRET ? '✅ Set' : '❌ Missing');
console.log('GMAIL_REFRESH_TOKEN:', process.env.GMAIL_REFRESH_TOKEN ? '✅ Set' : '❌ Missing');
console.log('GMAIL_USER:', process.env.GMAIL_USER ? `✅ ${process.env.GMAIL_USER}` : '❌ Missing');
console.log('');

async function testGmailAPI() {
  try {
    const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
    const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
    const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      console.error('❌ Missing required Gmail credentials');
      return;
    }

    console.log('🔐 Initializing OAuth2 Client...');
    const oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: REFRESH_TOKEN
    });

    console.log('✅ OAuth2 Client initialized\n');

    console.log('🔄 Testing token refresh...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('✅ Access token obtained successfully');
    console.log(`   Token expires at: ${new Date(credentials.expiry_date).toLocaleString()}\n`);

    console.log('📧 Initializing Gmail API...');
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    console.log('✅ Gmail API initialized\n');

    console.log('👤 Getting user profile...');
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail profile retrieved');
    console.log(`   Email: ${profile.data.emailAddress}`);
    console.log(`   Messages Total: ${profile.data.messagesTotal}`);
    console.log(`   Threads Total: ${profile.data.threadsTotal}\n`);

    console.log('📨 Sending test email...');
    const testEmail = createTestEmail(
      process.env.GMAIL_USER || 'tapveratechnologies@gmail.com',
      process.env.GMAIL_USER || 'tapveratechnologies@gmail.com'
    );

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: testEmail
      }
    });

    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${result.data.id}`);
    console.log(`   Thread ID: ${result.data.threadId}\n`);

    console.log('✅ ALL TESTS PASSED! Gmail API is working correctly.');
    console.log('   The issue might be in the application code or error handling.\n');

  } catch (error) {
    console.error('❌ TEST FAILED\n');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);

    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }

    if (error.code) {
      console.error('Error Code:', error.code);
    }

    console.error('\n📝 Troubleshooting Guide:');
    console.error('1. Invalid refresh token: Regenerate refresh token using setupGmail.js');
    console.error('2. API not enabled: Enable Gmail API in Google Cloud Console');
    console.error('3. Wrong scopes: Ensure refresh token has gmail.send scope');
    console.error('4. OAuth consent screen: Verify app is not suspended');
    console.error('5. Credentials mismatch: Ensure Client ID/Secret match the project');
  }
}

function createTestEmail(from, to) {
  const subject = 'Test Email from Tapvera CRM';
  const message = `
    <html>
      <body>
        <h2>Gmail API Test Successful!</h2>
        <p>This is a test email sent from Tapvera CRM server.</p>
        <p>If you received this, your Gmail API configuration is working correctly.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </body>
    </html>
  `;

  const messageParts = [
    `From: Tapvera CRM <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    message
  ];

  const email = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return encodedMessage;
}

// Run the test
testGmailAPI();
