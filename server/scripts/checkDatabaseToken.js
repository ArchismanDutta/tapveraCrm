// Check for refresh token in database
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function checkDatabaseToken() {
  console.log('\n========================================');
  console.log('  CHECKING DATABASE FOR REFRESH TOKEN');
  console.log('========================================\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB\n');

    const EmailCredentials = require('../models/EmailCredentials');

    const credentials = await EmailCredentials.findOne({ service: 'gmail_api' });

    if (credentials) {
      console.log('✅ FOUND EMAIL CREDENTIALS IN DATABASE\n');
      console.log('Details:');
      console.log('-------------------');
      console.log(`Service: ${credentials.service}`);
      console.log(`Refresh Token: ${credentials.refreshToken ? credentials.refreshToken.substring(0, 30) + '...' : 'NOT SET'}`);
      console.log(`Last Refreshed: ${credentials.lastRefreshed || 'NEVER'}`);
      console.log(`User Email: ${credentials.metadata?.userEmail || 'NOT SET'}\n`);

      // Compare with .env token
      const envToken = process.env.GMAIL_REFRESH_TOKEN;
      const dbToken = credentials.refreshToken;

      if (envToken === dbToken) {
        console.log('⚠️  Database token is SAME as .env token (both invalid)\n');
      } else {
        console.log('✅ Database token is DIFFERENT from .env token');
        console.log('   The system may be using the database token instead!\n');

        // Test the database token
        const { google } = require('googleapis');
        const oauth2Client = new google.auth.OAuth2(
          process.env.GMAIL_CLIENT_ID,
          process.env.GMAIL_CLIENT_SECRET,
          'http://localhost:3000/auth/google/callback'
        );

        oauth2Client.setCredentials({ refresh_token: dbToken });

        try {
          const { token } = await oauth2Client.getAccessToken();
          console.log('✅ DATABASE TOKEN IS VALID!\n');
          console.log('   Your system is working because it\'s using the database token.');
          console.log('   The .env token is expired but the database has a working one.\n');
        } catch (err) {
          console.log('❌ DATABASE TOKEN IS ALSO INVALID:', err.message);
          console.log('   Both tokens are expired. Email system is broken.\n');
        }
      }

    } else {
      console.log('❌ NO EMAIL CREDENTIALS FOUND IN DATABASE\n');
      console.log('The system is only using the .env token (which is invalid).\n');
    }

    await mongoose.disconnect();
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

checkDatabaseToken();
