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
    recurring: { type: Boolean, default: false },
    optional: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Holiday", holidaySchema);
