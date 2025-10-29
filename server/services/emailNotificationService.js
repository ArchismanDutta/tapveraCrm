// services/emailNotificationService.js
const emailService = require('./email/emailService');

class EmailNotificationService {
  /**
   * Send welcome email to new client with login credentials
   */
  async sendClientWelcomeEmail(clientData) {
    const { _id, clientName, email, password, businessName } = clientData;
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
          .credential-row { margin: 10px 0; }
          .label { font-weight: bold; color: #667eea; }
          .value { color: #333; font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 3px; display: inline-block; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Tapvera CRM!</h1>
          </div>
          <div class="content">
            <h2>Hello ${clientName},</h2>
            <p>Your account has been successfully created by our admin team. We're excited to have you on board!</p>

            <div class="credentials">
              <h3 style="margin-top: 0; color: #667eea;">Your Login Credentials</h3>
              <div class="credential-row">
                <span class="label">Email:</span><br>
                <span class="value">${email}</span>
              </div>
              <div class="credential-row">
                <span class="label">Password:</span><br>
                <span class="value">${password}</span>
              </div>
              <div class="credential-row">
                <span class="label">Business Name:</span><br>
                <span class="value">${businessName}</span>
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">Login to Your Account</a>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

            <p>Best regards,<br>
            <strong>Tapvera CRM Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} Tapvera Technologies. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = `
Welcome to Tapvera CRM!

Hello ${clientName},

Your account has been successfully created. Here are your login credentials:

Email: ${email}
Password: ${password}
Business Name: ${businessName}

Login URL: ${loginUrl}

If you have any questions, please contact our support team.

Best regards,
Tapvera CRM Team
    `;

    try {
      await emailService.sendEmail({
        to: email,
        subject: 'Welcome to Tapvera CRM - Your Account Details',
        html: emailHtml,
        text: emailText,
        emailType: 'client_welcome',
        relatedClient: _id
      });

      console.log(` Welcome email sent to ${email}`);
      return { success: true };
    } catch (error) {
      console.error(`L Failed to send welcome email to ${email}:`, error.message);
      throw error;
    }
  }

  /**
   * Send project message notification to client or employees
   */
  async sendProjectMessageEmail(messageData) {
    try {
      const Message = require('../models/Message');
      const Project = require('../models/Project');

      // Populate message with sender and project details
      const message = await Message.findById(messageData._id)
        .populate('sentBy', 'name email clientName')
        .populate('project');

      if (!message) {
        console.error('Message not found for email notification');
        return;
      }

      const project = await Project.findById(message.project)
        .populate('client', 'email clientName')
        .populate('assignedTo', 'email name');

      if (!project) {
        console.error('Project not found for email notification');
        return;
      }

      const senderName = message.sentBy?.name || message.sentBy?.clientName || 'Team Member';
      const projectUrl = `${process.env.FRONTEND_URL}/projects/${project._id}`;

      // If message is from employee to client
      if (message.senderType !== 'client' && project.client?.email) {
        const clientEmailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Message in Your Project</h1>
              </div>
              <div class="content">
                <h2>Project: ${project.projectName}</h2>
                <p><strong>From:</strong> ${senderName}</p>

                <div class="message-box">
                  <p>${message.message}</p>
                </div>

                <div style="text-align: center;">
                  <a href="${projectUrl}" class="button">View Project</a>
                </div>

                <p>Best regards,<br>
                <strong>Tapvera CRM Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; ${new Date().getFullYear()} Tapvera CRM. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const clientEmailText = `
New Message in Your Project

Project: ${project.projectName}
From: ${senderName}

Message:
${message.message}

View Project: ${projectUrl}

Best regards,
Tapvera CRM Team
        `;

        await emailService.sendEmail({
          to: project.client.email,
          subject: `New Message: ${project.projectName}`,
          html: clientEmailHtml,
          text: clientEmailText,
          emailType: 'project_message',
          relatedClient: project.client._id,
          relatedProject: project._id,
          relatedMessage: message._id
        });

        console.log(` Project message email sent to client: ${project.client.email}`);
      }

      // If message is from client to employees
      if (message.senderType === 'client' && project.assignedTo?.length > 0) {
        for (const employee of project.assignedTo) {
          if (employee.email) {
            const employeeEmailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                  .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
                  .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Client Message</h1>
                  </div>
                  <div class="content">
                    <h2>Project: ${project.projectName}</h2>
                    <p><strong>From Client:</strong> ${senderName}</p>

                    <div class="message-box">
                      <p>${message.message}</p>
                    </div>

                    <div style="text-align: center;">
                      <a href="${projectUrl}" class="button">View Project</a>
                    </div>

                    <p>Best regards,<br>
                    <strong>Tapvera CRM Team</strong></p>
                  </div>
                  <div class="footer">
                    <p>This is an automated email. Please do not reply to this message.</p>
                    <p>&copy; ${new Date().getFullYear()} Tapvera CRM. All rights reserved.</p>
                  </div>
                </div>
              </body>
              </html>
            `;

            const employeeEmailText = `
Client Message

Project: ${project.projectName}
From Client: ${senderName}

Message:
${message.message}

View Project: ${projectUrl}

Best regards,
Tapvera CRM Team
            `;

            await emailService.sendEmail({
              to: employee.email,
              subject: `Client Message: ${project.projectName}`,
              html: employeeEmailHtml,
              text: employeeEmailText,
              emailType: 'message_received',
              relatedUser: employee._id,
              relatedProject: project._id,
              relatedMessage: message._id
            });

            console.log(` Project message email sent to employee: ${employee.email}`);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('L Failed to send project message email:', error.message);
      // Don't throw error - email notification failure shouldn't break message sending
      return { success: false, error: error.message };
    }
  }

  /**
   * Send task assigned notification to employees
   */
  async sendTaskAssignedEmail(taskData) {
    try {
      const User = require('../models/User');

      for (const userId of taskData.assignedTo) {
        const user = await User.findById(userId);
        if (!user?.email) continue;

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .task-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Task Assigned</h1>
              </div>
              <div class="content">
                <h2>${taskData.title}</h2>

                <div class="task-box">
                  <p><strong>Description:</strong> ${taskData.description || 'No description provided'}</p>
                  <p><strong>Due Date:</strong> ${taskData.dueDate ? new Date(taskData.dueDate).toLocaleDateString() : 'Not set'}</p>
                  <p><strong>Priority:</strong> ${taskData.priority || 'Normal'}</p>
                </div>

                <div style="text-align: center;">
                  <a href="${process.env.FRONTEND_URL}/tasks" class="button">View Task</a>
                </div>

                <p>Best regards,<br>
                <strong>Tapvera CRM Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; ${new Date().getFullYear()} Tapvera CRM. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await emailService.sendEmail({
          to: user.email,
          subject: `New Task: ${taskData.title}`,
          html,
          emailType: 'task_assigned',
          relatedUser: userId,
          relatedTask: taskData._id
        });

        console.log(` Task assignment email sent to ${user.email}`);
      }

      return { success: true };
    } catch (error) {
      console.error('L Failed to send task assignment email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send task status update notification
   */
  async sendTaskStatusUpdatedEmail(task, oldStatus, newStatus) {
    try {
      const Task = require('../models/Task');
      const Project = require('../models/Project');

      const taskData = await Task.findById(task._id)
        .populate('assignedBy', 'email name')
        .populate('project');

      if (!taskData) {
        console.error('Task not found for status update email');
        return;
      }

      // Notify the person who assigned the task
      if (taskData.assignedBy?.email) {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .status-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Task Status Updated</h1>
              </div>
              <div class="content">
                <h2>${taskData.title}</h2>

                <div class="status-box">
                  <p><strong>Status changed from:</strong> ${oldStatus} � ${newStatus}</p>
                </div>

                <div style="text-align: center;">
                  <a href="${process.env.FRONTEND_URL}/tasks" class="button">View Task</a>
                </div>

                <p>Best regards,<br>
                <strong>Tapvera CRM Team</strong></p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; ${new Date().getFullYear()} Tapvera CRM. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        await emailService.sendEmail({
          to: taskData.assignedBy.email,
          subject: `Task Updated: ${taskData.title}`,
          html,
          emailType: 'task_updated',
          relatedTask: taskData._id
        });

        console.log(` Task status update email sent to ${taskData.assignedBy.email}`);
      }

      // If task completed, notify client
      if (newStatus === 'completed' && taskData.project) {
        const project = await Project.findById(taskData.project).populate('client', 'email clientName');

        if (project?.client?.email) {
          const clientHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .task-box { background: white; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 5px; }
                .button { display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Task Completed!</h1>
                </div>
                <div class="content">
                  <h2>Great News!</h2>
                  <p>A task for your project has been completed.</p>

                  <div class="task-box">
                    <p><strong>Task:</strong> ${taskData.title}</p>
                    <p><strong>Project:</strong> ${project.projectName}</p>
                  </div>

                  <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/projects/${project._id}" class="button">View Project</a>
                  </div>

                  <p>Best regards,<br>
                  <strong>Tapvera CRM Team</strong></p>
                </div>
                <div class="footer">
                  <p>This is an automated email. Please do not reply to this message.</p>
                  <p>&copy; ${new Date().getFullYear()} Tapvera CRM. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await emailService.sendEmail({
            to: project.client.email,
            subject: `Task Completed: ${taskData.title}`,
            html: clientHtml,
            emailType: 'task_completed',
            relatedClient: project.client._id,
            relatedProject: project._id,
            relatedTask: taskData._id
          });

          console.log(` Task completion email sent to client: ${project.client.email}`);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('L Failed to send task status update email:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
module.exports = new EmailNotificationService();
