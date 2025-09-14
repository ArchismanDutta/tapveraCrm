// Script to check which database you're connected to
const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabaseConnection() {
  try {
    console.log('🔍 Checking database connection...');
    console.log('📡 MONGODB_URI from .env:', process.env.MONGODB_URI);
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('✅ Connected to MongoDB successfully');
    
    // Get database info
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    console.log('📊 Database name:', dbName);
    
    // Check if shifts collection exists and count documents
    const collections = await db.listCollections().toArray();
    console.log('📁 Available collections:', collections.map(c => c.name));
    
    if (collections.some(c => c.name === 'shifts')) {
      const shiftCount = await db.collection('shifts').countDocuments();
      console.log('🕐 Number of shifts in database:', shiftCount);
      
      // Show sample shifts
      const sampleShifts = await db.collection('shifts').find({}).limit(3).toArray();
      console.log('📋 Sample shifts:');
      sampleShifts.forEach((shift, index) => {
        console.log(`  ${index + 1}. ${shift.name} (${shift.start} - ${shift.end})`);
      });
    } else {
      console.log('❌ No shifts collection found in this database');
    }
    
    // Check users collection
    if (collections.some(c => c.name === 'users')) {
      const userCount = await db.collection('users').countDocuments();
      console.log('👥 Number of users in database:', userCount);
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

checkDatabaseConnection();
