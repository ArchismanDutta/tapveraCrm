const axios = require("axios");
require("dotenv").config();

const WHATSAPP_API_URL = "https://graph.facebook.com/v22.0";

// 🔐 From env
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const adminNumbers = (process.env.ADMIN_NUMBERS || "")
  .split(",")
  .map((num) => num.trim());

/**
 * Send WhatsApp template message to all admins
 * @param {string} message
 */
async function notifyAdmins(message) {
  try {
    for (const number of adminNumbers) {
      console.log("Admin numbers:", adminNumbers);

      await axios.post(
        `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: number,
          type: "template",
          template: {
            name: "hello_world", // no params allowed here
            language: { code: "en_US" },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );


      console.log(`✅ WhatsApp sent to ${number}`);
    }
  } catch (err) {
    console.error(
      "❌ Error sending WhatsApp:",
      err?.response?.data || err.message
    );
  }
}

module.exports = { notifyAdmins };
