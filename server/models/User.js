const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    contact: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    // prefer not to say in not added yet in the backend
    gender: { type: String, enum: ["male", "female", "other"], required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["super-admin", "admin", "employee"],
      default: "employee",
    },
  },
  {
    timestamps: true,
  }
);

const bcrypt = require("bcryptjs");

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});


module.exports = mongoose.model("User", userSchema);
