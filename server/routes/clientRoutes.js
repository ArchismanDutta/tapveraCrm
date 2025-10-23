const express = require("express");
const Client = require("../models/Client");
const { protect, authorize } = require("../middlewares/authMiddleware");
const sendEmail = require("../utils/sendEmail");

const router = express.Router();

// Add new client
router.post("/", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const { clientName, businessName, email, password } = req.body;
    const newClient = new Client({ clientName, businessName, email, password });
    await newClient.save();

    // Send welcome email with login credentials
    try {
      const loginUrl = process.env.FRONTEND_URL || "http://localhost:5173";

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
              <h1>Welcome to Tapvera CRM! 🎉</h1>
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

              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong><br>
                Please change your password after your first login for security purposes.
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
              <p>&copy; ${new Date().getFullYear()} Tapvera CRM. All rights reserved.</p>
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

IMPORTANT: Please change your password after your first login for security purposes.

If you have any questions, please contact our support team.

Best regards,
Tapvera CRM Team
      `;

      await sendEmail({
        provider: "gmail",
        to: email,
        subject: "Welcome to Tapvera CRM - Your Account Details",
        text: emailText,
        html: emailHtml,
      });

      console.log(`✅ Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error("❌ Failed to send welcome email:", emailError);
      // Don't fail the request if email fails, just log it
    }

    res.status(201).json(newClient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Get all clients
router.get("/", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// Update client
router.put("/:id", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const { clientName, businessName, email } = req.body;
    const client = await Client.findById(req.params.id);

    if (!client) return res.status(404).json({ error: "Client not found" });

    client.clientName = clientName;
    client.businessName = businessName;
    client.email = email;
    await client.save();

    res.json(client);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Delete client
router.delete("/:id", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });

    res.json({ message: "Client deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Toggle status manually
router.patch("/:id/status", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: "Client not found" });

    client.status = client.status === "Active" ? "Inactive" : "Active";
    await client.save();
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;
