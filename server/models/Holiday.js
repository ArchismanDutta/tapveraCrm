const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ["NATIONAL", "COMPANY", "RELIGIOUS", "FESTIVAL"],
      required: true,
    },
    shifts: [
      {
        type: String,
        enum: ["standard", "flexiblePermanent", "ALL"],
        default: "ALL",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Holiday", holidaySchema);
