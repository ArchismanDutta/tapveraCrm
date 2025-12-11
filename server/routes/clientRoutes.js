const express = require("express");
const Client = require("../models/Client");
const { protect, authorize } = require("../middlewares/authMiddleware");
const emailNotificationService = require("../services/emailNotificationService");
const emailService = require("../services/email/emailService");

const router = express.Router();

// Get unique regions from all clients (for dropdown population)
router.get("/regions", protect, async (req, res) => {
  try {
    const regions = await Client.distinct("region");
    // Always include 'Global' as an option
    const uniqueRegions = [
      "Global",
      ...regions.filter((r) => r && r !== "Global"),
    ].sort();
    res.json(uniqueRegions);
  } catch (err) {
    console.error("Error fetching regions:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Add new client
router.post(
  "/",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { clientName, businessName, email, password, region } = req.body;
      const newClient = new Client({
        clientName,
        businessName,
        email: String(email).trim().toLowerCase(), // Normalize email for consistency with login
        password: String(password).trim(), // Trim password for consistency with login
        region: region || "Global",
      });
      await newClient.save();

      // Send welcome email with login credentials
      try {
        await emailNotificationService.sendClientWelcomeEmail(newClient);
      } catch (emailError) {
        console.error("❌ Failed to send welcome email:", emailError);
        // Don't fail the request if email fails, just log it
      }

      res.status(201).json(newClient);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server Error" });
    }
  }
);

// Get all clients (filtered by user regions)
router.get(
  "/",
  protect,
  authorize("admin", "super-admin", "hr"),
  async (req, res) => {
    try {
      const user = req.user;
      let query = {};

      console.log(
        `[Client Filtering] User: ${user.email}, Role: ${user.role}, Regions:`,
        user.regions || [user.region]
      );

      // Super-admin sees ALL clients
      if (user.role === "super-admin" || user.role === "superadmin") {
        console.log(
          "[Client Filtering] Super-admin detected - showing all clients"
        );
        query = {};
      }
      // Users with 'Global' in their regions array see everything
      else if (user.regions && user.regions.includes("Global")) {
        console.log(
          "[Client Filtering] User has Global region - showing all clients"
        );
        query = {};
      }
      // Region-specific users ONLY see clients in their assigned regions (strict filtering)
      else if (user.regions && user.regions.length > 0) {
        query = { region: { $in: user.regions } };
        console.log(
          "[Client Filtering] Strict filtering by regions:",
          user.regions,
          "Query:",
          JSON.stringify(query)
        );
      }
      // Fallback for old single region field (backwards compatibility)
      else if (user.region) {
        if (user.region === "Global") {
          console.log(
            "[Client Filtering] User has Global region (old field) - showing all clients"
          );
          query = {};
        } else {
          query = { region: user.region };
          console.log(
            "[Client Filtering] Strict filtering by single region:",
            user.region,
            "Query:",
            JSON.stringify(query)
          );
        }
      }
      // Safety: If no regions defined at all, grant Global access (backward compatibility)
      else {
        console.log(
          "[Client Filtering] No regions defined - granting Global access (safety fallback)"
        );
        query = {};
      }

      const clients = await Client.find(query).sort({ createdAt: -1 });
      console.log(
        `[Client Filtering] Found ${clients.length} clients matching filter`
      );
      res.json(clients);
    } catch (err) {
      console.error("Error fetching clients:", err);
      res.status(500).json({ error: "Server Error" });
    }
  }
);

// Update client
router.put(
  "/:id",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { clientName, businessName, email, region, password } = req.body;
      const client = await Client.findById(req.params.id);

      if (!client) return res.status(404).json({ error: "Client not found" });

      client.clientName = clientName;
      client.businessName = businessName;
      client.email = String(email).trim().toLowerCase(); // Normalize email for consistency with login
      if (region !== undefined) client.region = region;

      // Only super-admin can update password
      if (password && password.trim()) {
        const userRole = req.user.role.toLowerCase();
        if (userRole === "super-admin" || userRole === "superadmin") {
          // Trim the password before saving (matches login logic)
          client.password = String(password).trim();
        } else {
          return res
            .status(403)
            .json({ error: "Only super-admin can change client passwords" });
        }
      }

      await client.save();

      res.json(client);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server Error" });
    }
  }
);

// Delete client
router.delete(
  "/:id",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const client = await Client.findByIdAndDelete(req.params.id);
      if (!client) return res.status(404).json({ error: "Client not found" });

      res.json({ message: "Client deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server Error" });
    }
  }
);

// Toggle status manually
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ error: "Client not found" });

      client.status = client.status === "Active" ? "Inactive" : "Active";
      await client.save();
      res.json(client);
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  }
);

// Send bulk email to multiple clients
router.post(
  "/bulk-email",
  protect,
  authorize("admin", "super-admin"),
  async (req, res) => {
    try {
      const { clientIds, subject, body } = req.body;

      // Validation
      if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
        return res
          .status(400)
          .json({ error: "Please select at least one client" });
      }

      if (!subject || !subject.trim()) {
        return res.status(400).json({ error: "Email subject is required" });
      }

      if (!body || !body.trim()) {
        return res.status(400).json({ error: "Email body is required" });
      }

      // Fetch selected clients
      const clients = await Client.find({ _id: { $in: clientIds } });

      if (clients.length === 0) {
        return res.status(404).json({ error: "No clients found" });
      }

      // Send emails to all selected clients
      const results = {
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (const client of clients) {
        try {
          await emailService.sendEmail({
            to: client.email,
            subject: subject.trim(),
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #6d28d9;">Hello ${client.clientName},</h2>
              <div style="margin: 20px 0;">
                ${body}
              </div>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #6b7280; font-size: 14px;">
                Best regards,<br>
                <strong>Tapvera Team</strong>
              </p>
            </div>
          `,
            text: `Hello ${client.clientName},\n\n${body.replace(
              /<[^>]*>/g,
              ""
            )}\n\nBest regards,\nTapvera Team`,
            emailType: "bulk_email",
            relatedClient: client._id,
            metadata: {
              sentBy: req.user.email,
              sentByName: req.user.name,
            },
          });

          results.successCount++;
        } catch (emailError) {
          console.error(
            `❌ Failed to send email to ${client.email}:`,
            emailError
          );
          results.failedCount++;
          results.errors.push({
            client: client.clientName,
            email: client.email,
            error: emailError.message,
          });
        }
      }

      // Return results
      if (results.successCount === 0) {
        return res.status(500).json({
          message: "Failed to send emails to any clients",
          results,
        });
      }

      res.json({
        message: `Successfully sent ${results.successCount} out of ${clients.length} emails`,
        successCount: results.successCount,
        failedCount: results.failedCount,
        errors: results.errors,
      });
    } catch (err) {
      console.error("Error sending bulk emails:", err);
      res.status(500).json({ error: "Server Error", message: err.message });
    }
  }
);

module.exports = router;
