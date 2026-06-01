// Test script for message status endpoints
require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Project = require('../models/Project');

async function testEndpoints() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Find a test project with messages
    const project = await Project.findOne().lean();
    if (!project) {
      console.log('❌ No projects found in database. Please create a project first.');
      process.exit(1);
    }
    console.log('✅ Found test project:', project.projectName);

    // Find a test message in this project
    const message = await Message.findOne({ project: project._id }).lean();
    if (!message) {
      console.log('❌ No messages found for this project. Please create a message first.');
      process.exit(1);
    }
    console.log('✅ Found test message:', message._id);

    // Display test information
    console.log('\n===========================================');
    console.log('TEST INFORMATION');
    console.log('===========================================');
    console.log('Project ID:', project._id);
    console.log('Message ID:', message._id);
    console.log('\nMessage Status Before:', message.status);
    console.log('Message ReadBy Count:', message.readBy?.length || 0);

    console.log('\n===========================================');
    console.log('CURL COMMANDS FOR TESTING');
    console.log('===========================================');
    console.log('\n1. Mark message as read:');
    console.log(`curl -X POST http://localhost:5000/api/projects/${project._id}/messages/${message._id}/read \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json"`);

    console.log('\n2. Update message status:');
    console.log(`curl -X PUT http://localhost:5000/api/projects/${project._id}/messages/${message._id}/status \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d "{\\"status\\": \\"delivered\\"}"`);

    console.log('\n===========================================');
    console.log('NOTE: Replace YOUR_TOKEN with a valid JWT token');
    console.log('You can get a token by logging in through the API');
    console.log('===========================================\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

testEndpoints();
