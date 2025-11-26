// Check recent email sending activity
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function checkRecentEmails() {
  console.log('\n========================================');
  console.log('  CHECKING RECENT EMAIL ACTIVITY');
  console.log('========================================\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB\n');

    const EmailLog = require('../models/EmailLog');

    // Get total emails
    const totalEmails = await EmailLog.countDocuments();
    console.log(`Total Emails in Database: ${totalEmails}\n`);

    // Get recent emails (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentEmails = await EmailLog.find({
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 }).limit(10);

    console.log('Recent Emails (Last 7 Days):');
    console.log('-------------------');
    if (recentEmails.length === 0) {
      console.log('❌ NO EMAILS SENT IN LAST 7 DAYS\n');
    } else {
      console.log(`Found ${recentEmails.length} recent emails:\n`);
      recentEmails.forEach((email, idx) => {
        console.log(`${idx + 1}. ${email.emailType} to ${email.to}`);
        console.log(`   Status: ${email.status}`);
        console.log(`   Date: ${email.createdAt}`);
        console.log(`   Method: ${email.deliveryMethod}`);
        if (email.error) {
          console.log(`   Error: ${email.error.message}`);
        }
        console.log('');
      });
    }

    // Get email statistics by status
    const stats = await EmailLog.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('Email Statistics (All Time):');
    console.log('-------------------');
    stats.forEach(stat => {
      const icon = stat._id === 'sent' ? '✅' : stat._id === 'failed' ? '❌' : '⏳';
      console.log(`${icon} ${stat._id}: ${stat.count}`);
    });
    console.log('');

    // Get most recent email
    const mostRecent = await EmailLog.findOne().sort({ createdAt: -1 });
    if (mostRecent) {
      console.log('Most Recent Email:');
      console.log('-------------------');
      console.log(`Type: ${mostRecent.emailType}`);
      console.log(`To: ${mostRecent.to}`);
      console.log(`Status: ${mostRecent.status}`);
      console.log(`Date: ${mostRecent.createdAt}`);
      console.log(`Method: ${mostRecent.deliveryMethod}`);
      if (mostRecent.error) {
        console.log(`Error: ${mostRecent.error.message}`);
      }
      console.log('');
    }

    await mongoose.disconnect();
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

checkRecentEmails();
