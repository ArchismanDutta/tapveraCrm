// services/dailyChatNotificationService.js
const ChatNotification = require('../models/ChatNotification');
const User = require('../models/User');
const Project = require('../models/Project');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const emailService = require('./email/emailService');

/**
 * Daily Chat Notification Service
 * Sends ONE email per day to project participants when chat activity starts
 */
class DailyChatNotificationService {

  /**
   * Process new chat message and send notifications if needed
   * @param {Object} message - The chat message object
   * @param {String} conversationId - The conversation ID
   * @param {String} senderId - ID of user who sent the message
   */
  async processNewMessage(message, conversationId, senderId) {
    try {
      console.log(`📧 Processing daily chat notifications for conversation: ${conversationId}`);

      // Get conversation details
      const conversation = await Conversation.findById(conversationId)
        .populate('members', '_id name email role')
        .populate('project', '_id name client');

      if (!conversation) {
        console.warn(`⚠️ Conversation ${conversationId} not found`);
        return;
      }

      // Get project details if this is a project conversation
      let project = null;
      let client = null;
      let assignedEmployees = [];

      if (conversation.project) {
        project = await Project.findById(conversation.project._id)
          .populate('client', '_id name email')
          .populate('assignedTo', '_id name email role');

        if (project) {
          client = project.client;
          assignedEmployees = project.assignedTo || [];
        }
      }

      // Determine who should receive notifications
      const recipients = await this.getNotificationRecipients(
        conversation,
        project,
        senderId
      );

      console.log(`📬 Found ${recipients.length} potential recipients`);

      // Send notifications to recipients who haven't been notified today
      const sentCount = await this.sendNotificationsToRecipients(
        recipients,
        conversationId,
        message,
        senderId,
        project
      );

      console.log(`✅ Sent ${sentCount} daily chat initiation emails`);

      return sentCount;

    } catch (error) {
      console.error('❌ Error processing daily chat notifications:', error);
      // Don't throw - we don't want to break message sending if notifications fail
      return 0;
    }
  }

  /**
   * Get list of users who should receive notifications
   */
  async getNotificationRecipients(conversation, project, senderId) {
    const recipients = new Set();

    // Add conversation members (excluding sender)
    if (conversation.members) {
      conversation.members.forEach(member => {
        if (member._id.toString() !== senderId.toString()) {
          recipients.add(member._id.toString());
        }
      });
    }

    // Add project participants if this is a project conversation
    if (project) {
      // Add client
      if (project.client && project.client._id) {
        recipients.add(project.client._id.toString());
      }

      // Add assigned employees
      if (project.assignedTo) {
        project.assignedTo.forEach(employee => {
          if (employee._id.toString() !== senderId.toString()) {
            recipients.add(employee._id.toString());
          }
        });
      }
    }

    // Convert Set to array of user IDs and fetch full user objects
    const userIds = Array.from(recipients);
    const users = await User.find({
      _id: { $in: userIds },
      email: { $exists: true, $ne: null }
    }).select('_id name email role department');

    return users;
  }

  /**
   * Send notifications to recipients who haven't been notified today
   */
  async sendNotificationsToRecipients(recipients, conversationId, message, senderId, project) {
    let sentCount = 0;

    for (const recipient of recipients) {
      try {
        // Check if user was already notified today
        const wasNotified = await ChatNotification.wasNotifiedToday(
          recipient._id,
          conversationId
        );

        if (wasNotified) {
          console.log(`⏭️ User ${recipient.name} already notified today for conversation ${conversationId}`);
          continue;
        }

        // Send email notification
        const emailSent = await this.sendChatInitiationEmail(
          recipient,
          conversationId,
          message,
          senderId,
          project
        );

        // Record notification
        await ChatNotification.recordNotification({
          userId: recipient._id,
          conversationId,
          projectId: project?._id,
          triggeredByMessage: message._id,
          triggeredByUser: senderId,
          emailStatus: emailSent ? 'sent' : 'failed'
        });

        if (emailSent) {
          sentCount++;
          console.log(`✉️ Sent chat initiation email to ${recipient.email}`);
        }

      } catch (error) {
        console.error(`❌ Failed to notify ${recipient.email}:`, error.message);

        // Record failed notification
        try {
          await ChatNotification.recordNotification({
            userId: recipient._id,
            conversationId,
            projectId: project?._id,
            triggeredByMessage: message._id,
            triggeredByUser: senderId,
            emailStatus: 'failed',
            errorMessage: error.message
          });
        } catch (recordError) {
          console.error('Failed to record notification error:', recordError);
        }
      }
    }

    return sentCount;
  }

  /**
   * Send chat initiation email
   */
  async sendChatInitiationEmail(recipient, conversationId, message, senderId, project) {
    try {
      // Get sender details
      const sender = await User.findById(senderId).select('name role');

      // Get recent messages count for today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const messageCount = await ChatMessage.countDocuments({
        conversation: conversationId,
        createdAt: { $gte: startOfDay }
      });

      // Prepare email content
      const projectInfo = project ? {
        name: project.name,
        id: project._id
      } : null;

      const emailData = {
        recipientName: recipient.name,
        senderName: sender?.name || 'Someone',
        senderRole: sender?.role || 'Team member',
        messagePreview: this.truncateMessage(message.content || message.message || '', 150),
        projectName: projectInfo?.name,
        conversationId,
        messageCount,
        conversationUrl: this.getConversationUrl(conversationId, project)
      };

      // Create HTML email
      const htmlContent = this.createEmailHTML(emailData);

      // Send email using email service
      await emailService.sendEmail({
        to: recipient.email,
        subject: projectInfo
          ? `New message in ${projectInfo.name} project chat`
          : 'New message in conversation',
        html: htmlContent,
        emailType: 'chat_notification',
        relatedProject: projectInfo?.id,
        relatedUser: recipient._id,
        relatedMessage: message._id,
        metadata: {
          conversationId,
          messageCount,
          notificationType: 'daily_chat_initiation'
        }
      });

      return true;

    } catch (error) {
      console.error('Failed to send chat initiation email:', error);
      return false;
    }
  }

  /**
   * Create HTML email content
   */
  createEmailHTML(data) {
    const {
      recipientName,
      senderName,
      senderRole,
      messagePreview,
      projectName,
      messageCount,
      conversationUrl
    } = data;

    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || '#';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Chat Message</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                💬 New Chat Activity
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                Hi <strong>${recipientName}</strong>,
              </p>

              ${projectName ? `
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                There's new activity in the <strong>${projectName}</strong> project chat.
              </p>
              ` : `
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333333;">
                You have new messages in a conversation.
              </p>
              `}

              <!-- Message Preview Box -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
                  <strong>${senderName}</strong>
                  <span style="color: #999999; font-size: 13px;">(${senderRole})</span>
                </p>
                <p style="margin: 0; font-size: 15px; color: #333333; line-height: 1.5;">
                  ${messagePreview}
                </p>
              </div>

              ${messageCount > 1 ? `
              <p style="margin: 20px 0; font-size: 14px; color: #666666;">
                📊 <strong>${messageCount} messages</strong> sent today in this conversation
              </p>
              ` : ''}

              <!-- Call to Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${conversationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View Conversation
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

              <p style="margin: 0; font-size: 13px; color: #999999; line-height: 1.6;">
                <strong>Note:</strong> You'll receive only one notification per day for each active conversation.
                To stay updated, check the chat regularly or enable real-time notifications in your settings.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #666666;">
                This is an automated notification from Tapvera CRM
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                <a href="${frontendUrl}/messages" style="color: #667eea; text-decoration: none;">View All Messages</a>
                •
                <a href="${frontendUrl}/profile" style="color: #667eea; text-decoration: none;">Notification Settings</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Truncate message for preview
   */
  truncateMessage(text, maxLength = 150) {
    if (!text) return 'No message content';

    // Remove HTML tags if any
    const cleanText = text.replace(/<[^>]*>/g, '');

    if (cleanText.length <= maxLength) {
      return cleanText;
    }

    return cleanText.substring(0, maxLength).trim() + '...';
  }

  /**
   * Get conversation URL
   */
  getConversationUrl(conversationId, project) {
    const frontendUrl = process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || '#';

    if (project && project._id) {
      return `${frontendUrl}/project/${project._id}?tab=chat`;
    }

    return `${frontendUrl}/messages?conversation=${conversationId}`;
  }

  /**
   * Clean up old notifications (run daily via cron)
   */
  async cleanupOldNotifications() {
    try {
      const deletedCount = await ChatNotification.cleanupOldNotifications(30);
      console.log(`🧹 Cleaned up ${deletedCount} old chat notifications`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old notifications:', error);
      return 0;
    }
  }
}

module.exports = new DailyChatNotificationService();
