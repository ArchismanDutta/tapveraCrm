// services/email/gmailService.js
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
    this.initialized = false;
  }

  /**
   * Initialize Gmail API with OAuth2 credentials
   */
  initialize() {
    try {
      const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
      const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
      const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
      const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

      if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.warn('⚠️  Gmail API credentials not configured. Email will use SMTP fallback.');
        return false;
      }

      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        CLIENT_ID,
        CLIENT_SECRET,
        REDIRECT_URI
      );

      // Set credentials
      this.oauth2Client.setCredentials({
        refresh_token: REFRESH_TOKEN
      });

      // Create Gmail API instance
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      this.initialized = true;
      console.log('✅ Gmail API initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Gmail API:', error.message);
      return false;
    }
  }

  /**
   * Send email using Gmail API
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Result with messageId
   */
  async sendEmail(emailData) {
    if (!this.initialized) {
      this.initialize();
    }

    if (!this.initialized) {
      throw new Error('Gmail API not initialized. Check your credentials.');
    }

    try {
      const { to, cc, bcc, subject, html, text } = emailData;
      const from = process.env.GMAIL_USER || 'tapveratechnologies@gmail.com';

      // Create email message in RFC 2822 format
      const message = this.createMessage({
        from: `Tapvera CRM <${from}>`,
        to,
        cc,
        bcc,
        subject,
        html,
        text
      });

      // Send email using Gmail API
      const result = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      console.log(`✅ Email sent via Gmail API to ${to} (ID: ${result.data.id})`);

      return {
        success: true,
        messageId: result.data.id,
        method: 'gmail_api'
      };

    } catch (error) {
      console.error('❌ Gmail API send error:', error.message);
      throw error;
    }
  }

  /**
   * Create RFC 2822 formatted message
   * @param {Object} options - Email options
   * @returns {String} - Base64 encoded message
   */
  createMessage(options) {
    const { from, to, cc, bcc, subject, html, text } = options;

    const messageParts = [
      `From: ${from}`,
      `To: ${to}`,
    ];

    if (cc) messageParts.push(`Cc: ${cc}`);
    if (bcc) messageParts.push(`Bcc: ${bcc}`);

    messageParts.push(
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      html || text || ''
    );

    const message = messageParts.join('\r\n');

    // Encode message in base64url format
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return encodedMessage;
  }

  /**
   * Get sent email details
   * @param {String} messageId - Gmail message ID
   * @returns {Promise<Object>} - Message details
   */
  async getMessage(messageId) {
    if (!this.initialized) {
      throw new Error('Gmail API not initialized');
    }

    try {
      const result = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return result.data;
    } catch (error) {
      console.error(`❌ Failed to get message ${messageId}:`, error.message);
      throw error;
    }
  }

  /**
   * List sent emails with filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - List of messages
   */
  async listSentEmails(options = {}) {
    if (!this.initialized) {
      throw new Error('Gmail API not initialized');
    }

    try {
      const { maxResults = 100, pageToken, query = 'in:sent' } = options;

      const result = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        pageToken,
        q: query
      });

      return {
        messages: result.data.messages || [],
        nextPageToken: result.data.nextPageToken,
        resultSizeEstimate: result.data.resultSizeEstimate
      };
    } catch (error) {
      console.error('❌ Failed to list emails:', error.message);
      throw error;
    }
  }

  /**
   * Check if Gmail API is available
   * @returns {Boolean}
   */
  isAvailable() {
    return this.initialized;
  }
}

// Export singleton instance
module.exports = new GmailService();
