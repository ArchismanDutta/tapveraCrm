const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

async function checkRegions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const User = require('../models/User');
    const Client = require('../models/Client');

    // Check users and their regions
    const users = await User.find({}).select('name email role regions region').lean();

    console.log('=== USER REGIONS ANALYSIS ===\n');
    users.forEach(user => {
      console.log(`User: ${user.name} (${user.email})`);
      console.log(`  Role: ${user.role}`);
      console.log(`  regions array: ${JSON.stringify(user.regions)}`);
      console.log(`  region field (old): ${user.region || 'not set'}`);
      console.log('');
    });

    // Check clients and their regions
    const clients = await Client.find({}).select('clientName businessName email region').lean();

    console.log('\n=== CLIENT REGIONS ANALYSIS ===\n');
    clients.forEach(client => {
      console.log(`Client: ${client.clientName || client.businessName}`);
      console.log(`  Region: ${client.region || 'not set'}`);
      console.log('');
    });

    // Count statistics
    const usersWithoutGlobal = users.filter(u => !u.regions || !u.regions.includes('Global'));
    const clientsWithoutRegion = clients.filter(c => !c.region);

    console.log('\n=== STATISTICS ===');
    console.log(`Total users: ${users.length}`);
    console.log(`Users WITHOUT Global region: ${usersWithoutGlobal.length}`);
    if (usersWithoutGlobal.length > 0) {
      console.log('Users without Global:', usersWithoutGlobal.map(u => `${u.name} (${u.role})`).join(', '));
    }

    console.log(`\nTotal clients: ${clients.length}`);
    console.log(`Clients WITHOUT region: ${clientsWithoutRegion.length}`);
    if (clientsWithoutRegion.length > 0) {
      console.log('Clients without region:', clientsWithoutRegion.map(c => c.clientName || c.businessName).join(', '));
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkRegions();
