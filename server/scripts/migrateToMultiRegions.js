// Migration script to convert single region field to regions array
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function migrateToMultiRegions() {
  try {
    console.log('🔄 Starting multi-region migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ===== MIGRATE USERS FROM region TO regions =====
    console.log('👥 Migrating Users from region to regions...');

    // Find all users that have old 'region' field but no 'regions' array
    const usersToMigrate = await User.find({
      region: { $exists: true },
      $or: [
        { regions: { $exists: false } },
        { regions: { $size: 0 } },
        { regions: null }
      ]
    });

    console.log(`   Found ${usersToMigrate.length} users to migrate`);

    let migratedCount = 0;
    for (const user of usersToMigrate) {
      const oldRegion = user.region || 'Global';

      // Convert single region to array
      user.regions = [oldRegion];

      await user.save();
      migratedCount++;

      console.log(`   ✓ Migrated user ${user.email}: "${oldRegion}" → ["${oldRegion}"]`);
    }

    console.log(`\n   ✅ Migrated ${migratedCount} users\n`);

    // Set default ['Global'] for any users without regions
    const usersWithoutRegions = await User.countDocuments({
      $or: [
        { regions: { $exists: false } },
        { regions: { $size: 0 } },
        { regions: null }
      ]
    });

    if (usersWithoutRegions > 0) {
      const defaultResult = await User.updateMany(
        {
          $or: [
            { regions: { $exists: false } },
            { regions: { $size: 0 } },
            { regions: null }
          ]
        },
        { $set: { regions: ['Global'] } }
      );
      console.log(`   ✅ Set default ['Global'] for ${defaultResult.modifiedCount} users\n`);
    }

    // ===== SUMMARY =====
    console.log('\n📊 Migration Summary:');
    const totalUsers = await User.countDocuments();
    const usersByRegions = await User.aggregate([
      { $unwind: '$regions' },
      { $group: { _id: '$regions', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log(`\n   Total Users: ${totalUsers}`);
    console.log('   Users by Regions:');
    usersByRegions.forEach(r => {
      console.log(`      - ${r._id || 'Unknown'}: ${r.count} users`);
    });

    // Show users with multiple regions
    const multiRegionUsers = await User.find({
      $expr: { $gt: [{ $size: '$regions' }, 1] }
    }).select('name email regions');

    if (multiRegionUsers.length > 0) {
      console.log(`\n   👥 Users with Multiple Regions: ${multiRegionUsers.length}`);
      multiRegionUsers.forEach(u => {
        console.log(`      - ${u.name || u.email}: [${u.regions.join(', ')}]`);
      });
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('ℹ️  Next steps:');
    console.log('   1. Users can now be assigned to multiple regions');
    console.log('   2. Update Employee Directory to allow multi-region selection');
    console.log('   3. Users with multiple regions will see clients from all assigned regions\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateToMultiRegions();
