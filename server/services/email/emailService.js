// services/email/emailService.js
const smtpService = require('./smtpService');
const EmailLog = require('../../models/EmailLog');

class EmailService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize email services
   */
  async initialize() {
    console.log('📧 Initializing Email Service...');

    // Initialize SMTP with App Password (no OAuth required)
    const smtpAvailable = smtpService.initialize();

    if (!smtpAvailable) {
      console.error('❌ SMTP not configured! Please set EMAIL_USER and EMAIL_PASS (Gmail App Password).');
      this.initialized = false;
      return false;
    }

    console.log('✅ Email Service ready (SMTP with App Password)');

    this.initialized = true;
    return true;
  }

  /**
   * Send email with automatic fallback and logging
   * @param {Object} options - Email options
   * @returns {Promise<Object>} - Result with log entry
   */
  async sendEmail(options) {
    const {
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      emailType,
      relatedClient,
      relatedUser,
      relatedProject,
      relatedTask,
      relatedMessage,
      metadata
    } = options;

    // Validate required fields
    if (!to || !subject || (!html && !text)) {
      throw new Error('Missing required email fields (to, subject, html/text)');
    }

    if (!emailType) {
      throw new Error('emailType is required for logging');
    }

    // Create email log entry
    const emailLog = new EmailLog({
      to,
      cc,
      bcc,
      subject,
      htmlBody: html,
      textBody: text,
      emailType,
      relatedClient,
      relatedUser,
      relatedProject,
      relatedTask,
      relatedMessage,
      status: 'pending',
      deliveryMethod: 'smtp', // Using SMTP with App Password
      metadata
    });

    try {
      let result;
      let deliveryMethod = 'smtp';

      // Send email via SMTP with App Password
      if (smtpService.isAvailable()) {
        result = await smtpService.sendEmail({ to, cc, bcc, subject, html, text });
        console.log(`✅ Email sent via SMTP to ${to}`);
      } else {
        throw new Error('SMTP service not available. Please configure EMAIL_USER and EMAIL_PASS.');
      }

      // Update log with success
      emailLog.messageId = result.messageId;
      emailLog.deliveryMethod = deliveryMethod;
      emailLog.status = 'sent';
      emailLog.sentAt = new Date();
      emailLog.deliveredAt = new Date();

      await emailLog.save();

      return {
        success: true,
        messageId: result.messageId,
        deliveryMethod,
        logId: emailLog._id
      };

    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);

      // Update log with failure
      emailLog.status = 'failed';
      emailLog.error = {
        message: error.message,
        code: error.code,
        stack: error.stack
      };
      emailLog.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes

      await emailLog.save();

      throw error;
    }
  }

  /**
   * Retry failed emails
   * @returns {Promise<Object>} - Retry results
   */
  async retryFailedEmails() {
    const failedEmails = await EmailLog.find({
      status: 'failed',
      retryCount: { $lt: 3 },
      nextRetryAt: { $lte: new Date() }
    }).limit(50);

    const results = {
      attempted: failedEmails.length,
      succeeded: 0,
      failed: 0
    };

    for (const emailLog of failedEmails) {
      try {
        emailLog.retryCount += 1;
        emailLog.lastRetryAt = new Date();

        const result = await this.sendEmail({
          to: emailLog.to,
          cc: emailLog.cc,
          bcc: emailLog.bcc,
          subject: emailLog.subject,
          html: emailLog.htmlBody,
          text: emailLog.textBody,
          emailType: emailLog.emailType,
          relatedClient: emailLog.relatedClient,
          relatedUser: emailLog.relatedUser,
          relatedProject: emailLog.relatedProject,
          relatedTask: emailLog.relatedTask,
          relatedMessage: emailLog.relatedMessage
        });

        results.succeeded++;
      } catch (error) {
        emailLog.nextRetryAt = new Date(Date.now() + Math.pow(2, emailLog.retryCount) * 5 * 60 * 1000); // Exponential backoff
        await emailLog.save();
        results.failed++;
      }
    }

    console.log(`📧 Email retry complete: ${results.succeeded}/${results.attempted} succeeded`);
    return results;
  }

  /**
   * Get email statistics
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} - Statistics
   */
  async getStats(filters = {}) {
    const { startDate, endDate, emailType } = filters;

    const query = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (emailType) query.emailType = emailType;

    const [total, sent, failed, pending] = await Promise.all([
      EmailLog.countDocuments(query),
      EmailLog.countDocuments({ ...query, status: 'sent' }),
      EmailLog.countDocuments({ ...query, status: 'failed' }),
      EmailLog.countDocuments({ ...query, status: 'pending' })
    ]);

    const byType = await EmailLog.aggregate([
      { $match: query },
      { $group: { _id: '$emailType', count: { $sum: 1 } } }
    ]);

    const byMethod = await EmailLog.aggregate([
      { $match: { ...query, status: 'sent' } },
      { $group: { _id: '$deliveryMethod', count: { $sum: 1 } } }
    ]);

    return {
      total,
      sent,
      failed,
      pending,
      successRate: total > 0 ? ((sent / total) * 100).toFixed(2) + '%' : '0%',
      byType: byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byMethod: byMethod.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }
}

// Export singleton instance
module.exports = new EmailService();
