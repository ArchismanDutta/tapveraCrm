// services/email/smtpService.js
const nodemailer = require('nodemailer');

class SMTPService {
  constructor() {
    this.transporter = null;
  }

  /**
   * Initialize SMTP transporter
   */
  initialize() {
    try {
      const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
      const EMAIL_PORT = parseInt(process.env.EMAIL_PORT) || 587;
      const EMAIL_USER = process.env.EMAIL_USER || process.env.GMAIL_USER;
      const EMAIL_PASS = process.env.EMAIL_PASS;

      if (!EMAIL_USER || !EMAIL_PASS) {
        console.warn('⚠️  SMTP credentials not configured');
        return false;
      }

      this.transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_PORT === 465, // true for 465, false for other ports
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS
        },
        tls: {
          rejectUnauthorized: false // Accept self-signed certificates
        }
      });

      console.log(`✅ SMTP Service initialized (${EMAIL_HOST}:${EMAIL_PORT})`);
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize SMTP:', error.message);
      return false;
    }
  }

  /**
   * Send email using SMTP
   * @param {Object} emailData - Email data
   * @returns {Promise<Object>} - Result with messageId
   */
  async sendEmail(emailData) {
    if (!this.transporter) {
      this.initialize();
    }

    if (!this.transporter) {
      throw new Error('SMTP not initialized. Check your credentials.');
    }

    try {
      const { to, cc, bcc, subject, html, text } = emailData;
      const from = process.env.EMAIL_USER || process.env.GMAIL_USER;

      const mailOptions = {
        from: `Tapvera CRM <${from}>`,
        to,
        cc,
        bcc,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✅ Email sent via SMTP to ${to} (ID: ${info.messageId})`);

      return {
        success: true,
        messageId: info.messageId,
        method: 'smtp'
      };

    } catch (error) {
      console.error('❌ SMTP send error:', error.message);
      throw error;
    }
  }

  /**
   * Simple HTML to text conversion
   * @param {String} html - HTML content
   * @returns {String} - Plain text
   */
  htmlToText(html) {
    if (!html) return '';
    return html
      .replace(/<style[^>]*>.*<\/style>/gm, '')
      .replace(/<script[^>]*>.*<\/script>/gm, '')
      .replace(/<[^>]+>/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Verify SMTP connection
   * @returns {Promise<Boolean>}
   */
  async verify() {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified');
      return true;
    } catch (error) {
      console.error('❌ SMTP verification failed:', error.message);
      return false;
    }
  }

  /**
   * Check if SMTP is available
   * @returns {Boolean}
   */
  isAvailable() {
    return this.transporter !== null;
  }
}

// Export singleton instance
module.exports = new SMTPService();
