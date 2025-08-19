const mongoose = require("mongoose");

const LeaveRequestSchema = new mongoose.Schema({
  employee: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: String,
    email: String,
    avatar: String,
    department: String,
    designation: String,
  },
  period: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  type: {
    type: String,
    enum: ["maternity", "paid", "unpaid", "sick", "workFromHome", "halfDay"],
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending",
  },
  reason: { type: String, required: true },
  document: {
    name: String,
    size: String,
    url: String,
  },
  adminRemarks: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("LeaveRequest", LeaveRequestSchema);
