const mongoose = require("mongoose");

const NoticeSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date }, // for auto-expiry
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notice", NoticeSchema);
