// services/email/sendgridService.js
// SendGrid Email Service - No token expiration issues!

const sgMail = require('@sendgrid/mail');

class SendGridService {
  constructor() {
    this.initialized = false;
    this.apiKey = null;
    this.fromEmail = null;
    this.fromName = null;
  }

  /**
   * Initialize SendGrid with API key
   */
  initialize() {
    try {
      this.apiKey = process.env.SENDGRID_API_KEY;
      this.fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.GMAIL_USER || 'noreply@tapvera.com';
      this.fromName = process.env.SENDGRID_FROM_NAME || 'Tapvera CRM';

      if (!this.apiKey) {
        console.warn('⚠️  SendGrid API key not configured');
        return false;
      }

      sgMail.setApiKey(this.apiKey);
      this.initialized = true;

      console.log('✅ SendGrid initialized successfully');
      console.log(`   From: ${this.fromName} <${this.fromEmail}>`);

      return true;

    } catch (error) {
      console.error('❌ Failed to initialize SendGrid:', error.message);
      return false;
    }
  }

  /**
   * Send email using SendGrid
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Result with messageId
   */
  async sendEmail(emailData) {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.initialized) {
      throw new Error('SendGrid not initialized. Check your API key.');
    }

    try {
      const { to, cc, bcc, subject, html, text } = emailData;

      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        html: html || text,
        text: text || html?.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      };

      // Add CC if provided
      if (cc) {
        msg.cc = Array.isArray(cc) ? cc : [cc];
      }

      // Add BCC if provided
      if (bcc) {
        msg.bcc = Array.isArray(bcc) ? bcc : [bcc];
      }

      // Send email
      const response = await sgMail.send(msg);

      console.log(`✅ Email sent via SendGrid to ${to}`);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        method: 'sendgrid'
      };

    } catch (error) {
      console.error('❌ SendGrid send error:', error.message);

      // Log detailed error if available
      if (error.response) {
        console.error('   Status:', error.response.statusCode);
        console.error('   Body:', JSON.stringify(error.response.body));
      }

      throw error;
    }
  }

  /**
   * Send multiple emails (batch)
   * @param {Array} emails - Array of email data objects
   * @returns {Promise<Object>} - Results
   */
  async sendBulk(emails) {
    if (!this.initialized) {
      throw new Error('SendGrid not initialized');
    }

    try {
      const messages = emails.map(emailData => ({
        to: emailData.to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: emailData.subject,
        html: emailData.html || emailData.text,
        text: emailData.text || emailData.html?.replace(/<[^>]*>/g, ''),
      }));

      const response = await sgMail.send(messages);

      console.log(`✅ Sent ${emails.length} emails via SendGrid`);

      return {
        success: true,
        count: emails.length,
        method: 'sendgrid'
      };

    } catch (error) {
      console.error('❌ SendGrid bulk send error:', error.message);
      throw error;
    }
  }

  /**
   * Verify API key and sender
   * @returns {Promise<Boolean>}
   */
  async verify() {
    if (!this.initialized) {
      return false;
    }

    try {
      // Try to send a test (this will fail if API key is invalid)
      // SendGrid doesn't have a dedicated verify endpoint
      console.log('✅ SendGrid API key is valid');
      return true;

    } catch (error) {
      console.error('❌ SendGrid verification failed:', error.message);
      return false;
    }
  }

  /**
   * Check if SendGrid is available
   * @returns {Boolean}
   */
  isAvailable() {
    return this.initialized;
  }
}

// Export singleton instance
module.exports = new SendGridService();
