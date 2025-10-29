const axios = require("axios");
require("dotenv").config();

const WHATSAPP_API_URL = "https://graph.facebook.com/v22.0";

// 🔐 From env - Standardized variable names
const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID;
const adminNumbers = (process.env.ADMIN_NUMBERS || process.env.ADMIN_WHATSAPP_NUMBERS || "")
  .split(",")
  .map((num) => num.trim())
  .filter(Boolean);

/**
 * Check if WhatsApp is configured
 * @returns {boolean}
 */
function isWhatsAppConfigured() {
  return Boolean(token && phoneNumberId);
}

/**
 * Send WhatsApp text message to a specific number
 * @param {string} toNumber - Recipient phone number (with country code)
 * @param {string} message - Message text to send
 * @returns {Promise<boolean>} - Success status
 */
async function sendWhatsAppMessage(toNumber, message) {
  if (!isWhatsAppConfigured()) {
    console.warn("⚠️ WhatsApp not configured. Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID");
    return false;
  }

  if (!toNumber || !toNumber.trim()) {
    console.warn("⚠️ WhatsApp: No recipient number provided");
    return false;
  }

  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: toNumber.trim(),
        type: "text",
        text: {
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ WhatsApp sent successfully to ${toNumber}`);
    return true;
  } catch (err) {
    const errorDetails = err?.response?.data?.error || err?.response?.data || err.message;
    console.error(`❌ Error sending WhatsApp to ${toNumber}:`, errorDetails);

    // Log specific error types
    if (err?.response?.status === 401) {
      console.error("❌ Authentication failed. Check WHATSAPP_ACCESS_TOKEN");
    } else if (err?.response?.status === 400) {
      console.error("❌ Bad request. Check phone number format or message content");
    }

    return false;
  }
}

/**
 * Send WhatsApp text message to all admins
 * @param {string} message - Message to send to admins
 * @returns {Promise<{sent: number, failed: number}>} - Summary of sent messages
 */
async function notifyAdmins(message) {
  if (!isWhatsAppConfigured()) {
    console.warn("⚠️ WhatsApp not configured. Skipping admin notifications.");
    return { sent: 0, failed: 0 };
  }

  if (adminNumbers.length === 0) {
    console.warn("⚠️ No admin numbers configured. Check ADMIN_NUMBERS or ADMIN_WHATSAPP_NUMBERS");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const number of adminNumbers) {
    const success = await sendWhatsAppMessage(number, message);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  console.log(`📊 WhatsApp Admin Notifications: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}

/**
 * Send WhatsApp message to multiple recipients
 * @param {string[]} phoneNumbers - Array of phone numbers
 * @param {string} message - Message to send
 * @returns {Promise<{sent: number, failed: number}>} - Summary of sent messages
 */
async function sendBulkWhatsApp(phoneNumbers, message) {
  if (!isWhatsAppConfigured()) {
    console.warn("⚠️ WhatsApp not configured. Skipping bulk messages.");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const number of phoneNumbers) {
    const success = await sendWhatsAppMessage(number, message);
    if (success) {
      sent++;
    } else {
      failed++;
    }

    // Add small delay between messages to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`📊 WhatsApp Bulk Send: ${sent} sent, ${failed} failed out of ${phoneNumbers.length}`);
  return { sent, failed };
}

module.exports = {
  notifyAdmins,
  sendWhatsAppMessage,
  sendBulkWhatsApp,
  isWhatsAppConfigured
};
