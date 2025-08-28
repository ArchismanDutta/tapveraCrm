// models/Wish.js
const mongoose = require("mongoose");

const wishSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["birthday", "anniversary"], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent OverwriteModelError if model already exists
module.exports = mongoose.models.Wish || mongoose.model("Wish", wishSchema);
