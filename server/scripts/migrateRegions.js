// Migration script to add region field to existing clients and users
const mongoose = require('mongoose');
const Client = require('../models/Client');
const User = require('../models/User');
require('dotenv').config();

async function migrateRegions() {
  try {
    console.log('🔄 Starting region migration...\n');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ===== MIGRATE CLIENTS =====
    console.log('📋 Migrating Clients...');

    const clientsWithoutRegion = await Client.countDocuments({
      region: { $exists: false }
    });

    if (clientsWithoutRegion > 0) {
      const clientResult = await Client.updateMany(
        { region: { $exists: false } },
        { $set: { region: 'Global' } }
      );
      console.log(`   ✅ Updated ${clientResult.modifiedCount} clients to 'Global' region`);
    } else {
      console.log('   ℹ️  All clients already have region assigned');
    }

    // Also set null or empty regions to 'Global'
    const clientsWithEmptyRegion = await Client.countDocuments({
      $or: [{ region: null }, { region: '' }]
    });

    if (clientsWithEmptyRegion > 0) {
      const emptyResult = await Client.updateMany(
        { $or: [{ region: null }, { region: '' }] },
        { $set: { region: 'Global' } }
      );
      console.log(`   ✅ Fixed ${emptyResult.modifiedCount} clients with null/empty region\n`);
    }

    // ===== MIGRATE USERS =====
    console.log('👥 Migrating Users...');

    const usersWithoutRegion = await User.countDocuments({
      region: { $exists: false }
    });

    if (usersWithoutRegion > 0) {
      const userResult = await User.updateMany(
        { region: { $exists: false } },
        { $set: { region: 'Global' } }
      );
      console.log(`   ✅ Updated ${userResult.modifiedCount} users to 'Global' region`);
    } else {
      console.log('   ℹ️  All users already have region assigned');
    }

    // Set super-admins to Global region (they should see everything)
    const superAdminResult = await User.updateMany(
      { role: { $in: ['super-admin', 'superadmin'] } },
      { $set: { region: 'Global' } }
    );
    console.log(`   ✅ Ensured ${superAdminResult.modifiedCount} super-admins have 'Global' region`);

    // Also set null or empty regions to 'Global'
    const usersWithEmptyRegion = await User.countDocuments({
      $or: [{ region: null }, { region: '' }]
    });

    if (usersWithEmptyRegion > 0) {
      const emptyUserResult = await User.updateMany(
        { $or: [{ region: null }, { region: '' }] },
        { $set: { region: 'Global' } }
      );
      console.log(`   ✅ Fixed ${emptyUserResult.modifiedCount} users with null/empty region\n`);
    }

    // ===== SUMMARY =====
    console.log('\n📊 Migration Summary:');
    const totalClients = await Client.countDocuments();
    const totalUsers = await User.countDocuments();
    const clientsByRegion = await Client.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const usersByRegion = await User.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log(`\n   Total Clients: ${totalClients}`);
    console.log('   Clients by Region:');
    clientsByRegion.forEach(r => {
      console.log(`      - ${r._id || 'Unknown'}: ${r.count}`);
    });

    console.log(`\n   Total Users: ${totalUsers}`);
    console.log('   Users by Region:');
    usersByRegion.forEach(r => {
      console.log(`      - ${r._id || 'Unknown'}: ${r.count}`);
    });

    console.log('\n✅ Migration completed successfully!\n');
    console.log('ℹ️  Next steps:');
    console.log('   1. Create new clients with specific regions (e.g., USA, Australia)');
    console.log('   2. Assign employees to specific regions in Employee Management');
    console.log('   3. Region-specific admins will only see their assigned region clients/projects\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateRegions();
