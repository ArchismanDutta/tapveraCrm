const mongoose = require('mongoose');

/**
 * EmailCredentials Model
 * Stores Gmail OAuth refresh tokens in database to allow auto-refresh
 * This solves the problem of expired refresh tokens in AWS deployments
 * where we can't dynamically update environment variables
 */
const emailCredentialsSchema = new mongoose.Schema({
  service: {
    type: String,
    required: true,
    enum: ['gmail_api'],
    default: 'gmail_api'
  },
  refreshToken: {
    type: String,
    required: true
  },
  lastRefreshed: {
    type: Date,
    default: Date.now
  },
  metadata: {
    clientId: String,
    clientSecret: String,
    userEmail: String
  }
}, {
  timestamps: true
});

// Create unique index for service field
emailCredentialsSchema.index({ service: 1 }, { unique: true });

module.exports = mongoose.model('EmailCredentials', emailCredentialsSchema);
