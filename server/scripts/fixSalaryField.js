// Script to fix salary field for users with primitive salary values
// This is a one-time migration script

const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");

const fixSalaryFields = async () => {
  try {
    console.log("🔧 Connecting to database...");
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI not found in environment variables");
    }
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database");

    console.log("\n🔍 Finding users with invalid salary format...");

    // Get all users
    const users = await User.find({}).lean();
    console.log(`Found ${users.length} total users`);

    let fixedCount = 0;
    let alreadyValidCount = 0;
    let errors = [];

    for (const user of users) {
      try {
        const userDoc = await User.findById(user._id);

        // Check if salary is a primitive value
        if (userDoc.salary && typeof userDoc.salary === 'number') {
          console.log(`\n📝 Fixing user: ${userDoc.name} (${userDoc.employeeId})`);
          console.log(`   Old salary: ${userDoc.salary}`);

          userDoc.salary = {
            basic: userDoc.salary,
            total: userDoc.salary,
            paymentMode: 'bank'
          };

          await userDoc.save({ validateBeforeSave: true });
          console.log(`   ✅ Fixed! New salary:`, userDoc.salary);
          fixedCount++;
        } else if (!userDoc.salary || (typeof userDoc.salary === 'object' && !userDoc.salary.basic && !userDoc.salary.total)) {
          console.log(`\n📝 Setting default salary for user: ${userDoc.name} (${userDoc.employeeId})`);

          userDoc.salary = {
            basic: 0,
            total: 0,
            paymentMode: 'bank'
          };

          await userDoc.save({ validateBeforeSave: true });
          console.log(`   ✅ Set default salary`);
          fixedCount++;
        } else {
          alreadyValidCount++;
        }
      } catch (err) {
        console.error(`   ❌ Error fixing user ${user.name} (${user.employeeId}):`, err.message);
        errors.push({
          userId: user._id,
          name: user.name,
          employeeId: user.employeeId,
          error: err.message
        });
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Fixed users: ${fixedCount}`);
    console.log(`✓  Already valid: ${alreadyValidCount}`);
    console.log(`❌ Errors: ${errors.length}`);

    if (errors.length > 0) {
      console.log("\n❌ Users with errors:");
      errors.forEach(err => {
        console.log(`   - ${err.name} (${err.employeeId}): ${err.error}`);
      });
    }

    console.log("\n✅ Migration completed!");

  } catch (error) {
    console.error("❌ Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n👋 Disconnected from database");
    process.exit(0);
  }
};

// Run the migration
fixSalaryFields();
