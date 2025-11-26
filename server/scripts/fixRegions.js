const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function fixRegions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const User = require('../models/User');
    const Client = require('../models/Client');

    // Fix users with undefined regions
    console.log('=== FIXING USER REGIONS ===\n');

    const usersWithUndefinedRegions = await User.find({
      $or: [
        { regions: { $exists: false } },
        { regions: null },
        { regions: [] },
        { regions: undefined }
      ]
    });

    console.log(`Found ${usersWithUndefinedRegions.length} users with undefined/empty regions`);

    for (const user of usersWithUndefinedRegions) {
      user.regions = ['Global'];
      await user.save({ validateBeforeSave: false });
      console.log(`✓ Fixed ${user.name} (${user.email}) - ${user.role}`);
    }

    // Fix clients with no region
    console.log('\n=== FIXING CLIENT REGIONS ===\n');

    const clientsWithNoRegion = await Client.find({
      $or: [
        { region: { $exists: false } },
        { region: null },
        { region: '' }
      ]
    });

    console.log(`Found ${clientsWithNoRegion.length} clients with no region`);

    for (const client of clientsWithNoRegion) {
      client.region = 'Global';
      await client.save({ validateBeforeSave: false });
      console.log(`✓ Fixed ${client.clientName || client.businessName} (${client.email})`);
    }

    // Verify the fixes
    console.log('\n=== VERIFICATION ===\n');

    const usersStillBroken = await User.countDocuments({
      $or: [
        { regions: { $exists: false } },
        { regions: null },
        { regions: [] }
      ]
    });

    const clientsStillBroken = await Client.countDocuments({
      $or: [
        { region: { $exists: false } },
        { region: null },
        { region: '' }
      ]
    });

    console.log(`Users still without regions: ${usersStillBroken}`);
    console.log(`Clients still without region: ${clientsStillBroken}`);

    if (usersStillBroken === 0 && clientsStillBroken === 0) {
      console.log('\n✓ All regions fixed successfully!');
    } else {
      console.log('\n⚠ Some issues remain. Please check manually.');
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

fixRegions();
