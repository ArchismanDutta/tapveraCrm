// services/email/gmailService.js
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.gmail = null;
    this.initialized = false;
    this.CLIENT_ID = null;
    this.CLIENT_SECRET = null;
  }

  /**
   * Initialize Gmail API with OAuth2 credentials
   * Uses database-stored refresh token with auto-refresh capability
   */
  initialize() {
    try {
      this.CLIENT_ID = process.env.GMAIL_CLIENT_ID;
      this.CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
      const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
      const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';

      if (!this.CLIENT_ID || !this.CLIENT_SECRET || !REFRESH_TOKEN) {
        console.warn('⚠️  Gmail API credentials not configured. Email will use SMTP fallback.');
        return false;
      }

      // Create OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        this.CLIENT_ID,
        this.CLIENT_SECRET,
        REDIRECT_URI
      );

      // Set credentials
      this.oauth2Client.setCredentials({
        refresh_token: REFRESH_TOKEN
      });

      // Listen for token refresh events to update database
      this.oauth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          console.log('🔄 New refresh token received, updating database...');
          await this.saveRefreshToken(tokens.refresh_token);
        }
      });

      // Create Gmail API instance
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      this.initialized = true;
      console.log('✅ Gmail API initialized successfully with auto-refresh');

      // Initialize database with current token
      this.saveRefreshToken(REFRESH_TOKEN).catch(err => {
        console.warn('⚠️  Failed to save initial refresh token to database:', err.message);
      });

      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Gmail API:', error.message);
      return false;
    }
  }

  /**
   * Save refresh token to database
   * This allows tokens to persist across AWS deployments
   */
  async saveRefreshToken(refreshToken) {
    try {
      const EmailCredentials = require('../../models/EmailCredentials');

      await EmailCredentials.findOneAndUpdate(
        { service: 'gmail_api' },
        {
          refreshToken,
          lastRefreshed: new Date(),
          metadata: {
            clientId: this.CLIENT_ID,
            clientSecret: this.CLIENT_SECRET,
            userEmail: process.env.GMAIL_USER
          }
        },
        { upsert: true, new: true }
      );

      console.log('✅ Refresh token saved to database');
    } catch (error) {
      console.error('❌ Failed to save refresh token:', error.message);
      throw error;
    }
  }

  /**
   * Load refresh token from database
   * Fallback when environment variable token expires
   */
  async loadRefreshTokenFromDB() {
    try {
      const EmailCredentials = require('../../models/EmailCredentials');

      const credentials = await EmailCredentials.findOne({ service: 'gmail_api' });

      if (credentials && credentials.refreshToken) {
        console.log('✅ Loaded refresh token from database');
        return credentials.refreshToken;
      }

      return null;
    } catch (error) {
      console.error('❌ Failed to load refresh token from database:', error.message);
      return null;
    }
  }

  /**
   * Ensure valid access token with automatic refresh
   */
  async ensureValidToken() {
    try {
      // Try to get current access token
      const { token } = await this.oauth2Client.getAccessToken();

      if (!token) {
        // If env token failed, try database token
        console.log('⚠️  Environment refresh token failed, trying database...');
        const dbToken = await this.loadRefreshTokenFromDB();

        if (dbToken) {
          this.oauth2Client.setCredentials({ refresh_token: dbToken });
          const { token: newToken } = await this.oauth2Client.getAccessToken();

          if (newToken) {
            console.log('✅ Successfully refreshed using database token');
            return true;
          }
        }

        throw new Error('Unable to obtain valid access token');
      }

      return true;
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      throw error;
    }
  }

  /**
   * Send email using Gmail API with auto-refresh
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
      // Ensure we have a valid access token before sending
      await this.ensureValidToken();

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

      // If token refresh fails, throw error to trigger SMTP fallback
      if (error.message.includes('invalid_grant') || error.message.includes('Invalid Credentials')) {
        console.error('⚠️  Gmail refresh token expired. Falling back to SMTP...');
      }

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
