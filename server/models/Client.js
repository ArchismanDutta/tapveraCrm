const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  clientName: { type: String, required: true },
  businessName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
}, { timestamps: true });

module.exports = mongoose.model("Client", clientSchema);
