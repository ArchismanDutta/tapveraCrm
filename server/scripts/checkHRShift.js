const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    // Find HR users
    const hrUsers = await User.find({ role: 'hr' }).select('name email assignedShift standardShiftType');

    console.log('\nHR Users and their shifts:');
    hrUsers.forEach(user => {
      console.log(`\n${user.name} (${user.email}):`);
      console.log('  assignedShift:', JSON.stringify(user.assignedShift, null, 2));
      console.log('  standardShiftType:', user.standardShiftType);
    });

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
