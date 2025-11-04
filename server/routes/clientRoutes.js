const express = require("express");
const Client = require("../models/Client");
const { protect, authorize } = require("../middlewares/authMiddleware");
const emailNotificationService = require("../services/emailNotificationService");

const router = express.Router();

// Get unique regions from all clients (for dropdown population)
router.get("/regions", protect, async (req, res) => {
  try {
    const regions = await Client.distinct("region");
    // Always include 'Global' as an option
    const uniqueRegions = ['Global', ...regions.filter(r => r && r !== 'Global')].sort();
    res.json(uniqueRegions);
  } catch (err) {
    console.error("Error fetching regions:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Add new client
router.post("/", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const { clientName, businessName, email, password, region } = req.body;
    const newClient = new Client({
      clientName,
      businessName,
      email,
      password,
      region: region || 'Global'
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
});

// Get all clients (filtered by user regions)
router.get("/", protect, authorize("admin", "super-admin", "hr"), async (req, res) => {
  try {
    const user = req.user;
    let query = {};

    console.log(`[Client Filtering] User: ${user.email}, Role: ${user.role}, Regions:`, user.regions || [user.region]);

    // Super-admin sees ALL clients
    if (user.role === 'super-admin' || user.role === 'superadmin') {
      console.log('[Client Filtering] Super-admin detected - showing all clients');
      query = {};
    }
    // Users with 'Global' in their regions array see everything
    else if (user.regions && user.regions.includes('Global')) {
      console.log('[Client Filtering] User has Global region - showing all clients');
      query = {};
    }
    // Region-specific users ONLY see clients in their assigned regions (strict filtering)
    else if (user.regions && user.regions.length > 0) {
      query = { region: { $in: user.regions } };
      console.log('[Client Filtering] Strict filtering by regions:', user.regions, 'Query:', JSON.stringify(query));
    }
    // Fallback for old single region field (backwards compatibility)
    else if (user.region) {
      if (user.region === 'Global') {
        console.log('[Client Filtering] User has Global region (old field) - showing all clients');
        query = {};
      } else {
        query = { region: user.region };
        console.log('[Client Filtering] Strict filtering by single region:', user.region, 'Query:', JSON.stringify(query));
      }
    }

    const clients = await Client.find(query).sort({ createdAt: -1 });
    console.log(`[Client Filtering] Found ${clients.length} clients matching filter`);
    res.json(clients);
  } catch (err) {
    console.error("Error fetching clients:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// Update client
router.put("/:id", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const { clientName, businessName, email, region } = req.body;
    const client = await Client.findById(req.params.id);

    if (!client) return res.status(404).json({ error: "Client not found" });

    client.clientName = clientName;
    client.businessName = businessName;
    client.email = email;
    if (region !== undefined) client.region = region;
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
