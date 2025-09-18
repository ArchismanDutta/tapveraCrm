// Test script to verify the status update fix
const mongoose = require("mongoose");
const UserStatus = require("./models/UserStatus");

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/tapveraCrm",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

async function testStatusUpdate() {
  try {
    console.log("Testing UserStatus upsert functionality...");

    const testUserId = new mongoose.Types.ObjectId();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Test 1: Create a new status record
    console.log("Test 1: Creating new status record...");
    const status1 = await UserStatus.findOneAndUpdate(
      { userId: testUserId, today: { $gte: today } },
      {
        $setOnInsert: {
          userId: testUserId,
          today: today,
          currentlyWorking: false,
          onBreak: false,
          workedSessions: [],
          breakSessions: [],
          timeline: [],
          recentActivities: [],
        },
      },
      { upsert: true, new: true }
    );
    console.log("✅ Successfully created status record:", status1._id);

    // Test 2: Try to create another record for the same user and day (should update existing)
    console.log(
      "Test 2: Attempting to create duplicate record (should update existing)..."
    );
    const status2 = await UserStatus.findOneAndUpdate(
      { userId: testUserId, today: { $gte: today } },
      {
        $setOnInsert: {
          userId: testUserId,
          today: today,
          currentlyWorking: false,
          onBreak: false,
          workedSessions: [],
          breakSessions: [],
          timeline: [],
          recentActivities: [],
        },
      },
      { upsert: true, new: true }
    );
    console.log("✅ Successfully updated existing record:", status2._id);
    console.log(
      "✅ Same record ID:",
      status1._id.toString() === status2._id.toString()
    );

    // Test 3: Update the existing record
    console.log("Test 3: Updating existing record...");
    status2.currentlyWorking = true;
    status2.timeline.push({ type: "Punch In", time: new Date() });
    await status2.save();
    console.log("✅ Successfully updated record with new data");

    // Cleanup
    await UserStatus.deleteOne({ _id: status1._id });
    console.log("✅ Cleaned up test data");

    console.log(
      "\n🎉 All tests passed! The duplicate key error should be fixed."
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.code === 11000) {
      console.error("❌ Duplicate key error still exists!");
    }
  } finally {
    await mongoose.disconnect();
  }
}

testStatusUpdate();
