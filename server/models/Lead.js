const mongoose = require("mongoose");

// Lead Schema for CRM
const leadSchema = new mongoose.Schema(
  {
    leadId: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },

    // Client Information
    clientName: {
      type: String,
      required: true,
      trim: true,
    },

    businessName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^\+?\d{7,15}$/, "Invalid phone number"],
    },

    alternatePhone: {
      type: String,
      trim: true,
    },

    // Lead Details
    source: {
      type: String,
      enum: ["Website", "Referral", "Cold Call", "Social Media", "Email Campaign", "Other"],
      default: "Website",
    },

    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Proposal Sent", "Negotiation", "Won", "Lost", "On Hold"],
      default: "New",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },

    industry: {
      type: String,
      trim: true,
    },

    websiteUrl: {
      type: String,
      trim: true,
      match: [/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/, "Invalid URL format"],
    },

    expectedRevenue: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Address
    address: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
      default: "India",
    },

    zipCode: {
      type: String,
      trim: true,
    },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Additional Info
    notes: {
      type: String,
      trim: true,
    },

    tags: [{
      type: String,
      trim: true,
    }],

    // Tracking
    lastContactedDate: {
      type: Date,
    },

    nextFollowUpDate: {
      type: Date,
    },

    convertedToCustomer: {
      type: Boolean,
      default: false,
    },

    convertedDate: {
      type: Date,
    },

    lostReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
// Note: leadId already has index via unique:true, no need to duplicate
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });

// Auto-generate leadId before saving
leadSchema.pre("save", async function (next) {
  if (!this.leadId) {
    const count = await mongoose.model("Lead").countDocuments();
    this.leadId = `LEAD${String(count + 1).padStart(5, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Lead", leadSchema);
