// models/EmailLog.js
const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  // Email identification
  messageId: {
    type: String, // Gmail message ID or SMTP message ID
    unique: true,
    sparse: true
  },

  // Email details
  to: {
    type: String,
    required: true,
    index: true
  },
  cc: [String],
  bcc: [String],
  from: {
    type: String,
    default: 'Tapvera CRM <tapveratechnologies@gmail.com>'
  },
  subject: {
    type: String,
    required: true
  },

  // Content
  htmlBody: String,
  textBody: String,

  // Email type and context
  emailType: {
    type: String,
    enum: [
      'client_welcome',
      'task_assigned',
      'task_updated',
      'task_completed',
      'task_approved',
      'task_rejected',
      'task_submitted',
      'message_sent',
      'message_received',
      'project_created',
      'project_updated',
      'project_message'
    ],
    required: true,
    index: true
  },

  // Related entities
  relatedClient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  relatedTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  relatedMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },

  // Delivery tracking
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'retrying'],
    default: 'pending',
    index: true
  },
  deliveryMethod: {
    type: String,
    enum: ['gmail_api', 'smtp', 'fallback_smtp'],
    required: true
  },

  // Timestamps
  sentAt: Date,
  deliveredAt: Date,

  // Error handling
  error: {
    message: String,
    code: String,
    stack: String
  },
  retryCount: {
    type: Number,
    default: 0
  },
  lastRetryAt: Date,
  nextRetryAt: Date,

  // Metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }

}, {
  timestamps: true // createdAt, updatedAt
});

// Indexes for efficient queries
emailLogSchema.index({ status: 1, nextRetryAt: 1 }); // For retry queue
emailLogSchema.index({ emailType: 1, createdAt: -1 }); // For analytics
emailLogSchema.index({ to: 1, createdAt: -1 }); // For user email history

// Virtual for retry eligibility
emailLogSchema.virtual('canRetry').get(function() {
  return this.status === 'failed' &&
         this.retryCount < 3 &&
         (!this.nextRetryAt || this.nextRetryAt <= new Date());
});

module.exports = mongoose.model('EmailLog', emailLogSchema);
