const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  businessName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },

  // Region for access control (free text, user-defined)
  region: {
    type: String,
    trim: true,
    default: 'Global',
    required: true
  },
}, { timestamps: true });

module.exports = mongoose.model("Client", clientSchema);
