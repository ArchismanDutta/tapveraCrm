const express = require("express");
const Client = require("../models/Client");
const { protect, authorize } = require("../middlewares/authMiddleware");
const emailNotificationService = require("../services/emailNotificationService");

const router = express.Router();

// Add new client
router.post("/", protect, authorize("admin", "super-admin"), async (req, res) => {
  try {
    const { clientName, businessName, email, password } = req.body;
    const newClient = new Client({ clientName, businessName, email, password });
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
