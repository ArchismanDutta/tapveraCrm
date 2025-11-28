// Generate New Gmail OAuth Refresh Token
// Run this after creating new OAuth Client ID

const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  GMAIL OAUTH TOKEN GENERATOR');
console.log('========================================\n');

console.log('This script will help you generate a new Gmail OAuth refresh token.');
console.log('Make sure you have:');
console.log('  1. Created a new OAuth Client ID in Google Cloud Console');
console.log('  2. Have the Client ID and Client Secret ready\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function generateToken() {
  try {
    // Get credentials from user
    console.log('Step 1: Enter your OAuth credentials\n');

    const clientId = await question('Enter Client ID: ');
    const clientSecret = await question('Enter Client Secret: ');
    const redirectUri = await question('Enter Redirect URI (default: http://localhost:3000/auth/google/callback): ') || 'http://localhost:3000/auth/google/callback';

    if (!clientId || !clientSecret) {
      console.error('\n❌ Client ID and Secret are required!');
      process.exit(1);
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate auth URL
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent' // Force to show consent screen to get refresh token
    });

    console.log('\n========================================');
    console.log('Step 2: Authorize the application\n');
    console.log('Open this URL in your browser:\n');
    console.log(authUrl);
    console.log('\n========================================\n');

    const code = await question('After authorizing, paste the authorization code here: ');

    if (!code) {
      console.error('\n❌ Authorization code is required!');
      process.exit(1);
    }

    console.log('\nStep 3: Exchanging code for tokens...\n');

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('\n❌ No refresh token received!');
      console.error('   Make sure you selected "consent" prompt and the OAuth app is not already authorized.');
      console.error('   Try revoking access at: https://myaccount.google.com/permissions');
      process.exit(1);
    }

    console.log('✅ Success! Here are your tokens:\n');
    console.log('========================================');
    console.log('TOKENS');
    console.log('========================================\n');
    console.log(`Access Token: ${tokens.access_token?.substring(0, 50)}...`);
    console.log(`Refresh Token: ${tokens.refresh_token}\n`);

    // Save to .env format
    const envPath = path.join(__dirname, '../.env');
    const envContent = `
# New Gmail OAuth Credentials (Generated: ${new Date().toISOString()})
GMAIL_CLIENT_ID=${clientId}
GMAIL_CLIENT_SECRET=${clientSecret}
GMAIL_REFRESH_TOKEN=${tokens.refresh_token}
GMAIL_REDIRECT_URI=${redirectUri}
GMAIL_USER=tapveratechnologies@gmail.com
`;

    const envFile = path.join(__dirname, '../.env.new');
    fs.writeFileSync(envFile, envContent);

    console.log('========================================');
    console.log('NEXT STEPS');
    console.log('========================================\n');
    console.log('1. Copy these credentials to your server/.env file:');
    console.log(`   ${envFile}\n`);
    console.log('2. Or manually update your .env file with:');
    console.log(`   GMAIL_CLIENT_ID=${clientId}`);
    console.log(`   GMAIL_CLIENT_SECRET=${clientSecret}`);
    console.log(`   GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('3. Restart your server');
    console.log('4. Test email sending\n');

    console.log('✅ Token generation complete!\n');

  } catch (error) {
    console.error('\n❌ Error generating token:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

generateToken();
