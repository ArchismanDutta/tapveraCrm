const mongoose = require("mongoose");

const TodoTaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  label: { type: String, enum: ["High", "Medium", "Low"], default: null },
  time: { type: String, default: "" }, // e.g., "10:00 AM"
  date: { type: Date, required: true }, // normalized to 00:00:00 for day
  completed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

TodoTaskSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  if (this.completed && !this.completedAt) {
    this.completedAt = new Date();
  }
  if (!this.completed) {
    this.completedAt = null;
  }
  next();
});

module.exports = mongoose.model("TodoTask", TodoTaskSchema);
