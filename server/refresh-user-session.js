const mongoose = require("mongoose");
const User = require("./models/User");
const Position = require("./models/Position");
require("dotenv").config();

async function checkAndRefreshUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("==========================================");
    console.log("USER SESSION CHECK");
    console.log("==========================================\n");

    // Find Azad
    const azad = await User.findOne({ name: { $regex: /azad/i } }).lean();

    if (!azad) {
      console.log("❌ Azad not found\n");
      process.exit(1);
    }

    console.log("✅ Azad's Current Data:");
    console.log(`   Name: ${azad.name}`);
    console.log(`   Email: ${azad.email}`);
    console.log(`   Employee ID: ${azad.employeeId}`);
    console.log(`   Role: ${azad.role}`);
    console.log(`   Department: ${azad.department}`);
    console.log(`   Position: ${azad.position}`);
    console.log(`   Position Level: ${azad.positionLevel}`);
    console.log("");

    // Check position configuration
    if (azad.position) {
      const position = await Position.findOne({
        name: azad.position,
        status: "active"
      }).lean();

      if (position) {
        console.log(`✅ Position Configuration for "${azad.position}":`);
        console.log(`   Level: ${position.level}`);
        console.log(`   Permissions:`);
        console.log(`     - canViewSubordinateLeads: ${position.permissions?.canViewSubordinateLeads}`);
        console.log(`     - canEditSubordinateLeads: ${position.permissions?.canEditSubordinateLeads}`);
        console.log(`   Hierarchical Access:`);
        console.log(`     - accessLowerLevels: ${position.hierarchicalAccess?.accessLowerLevels}`);
        console.log(`     - dataScope: ${position.hierarchicalAccess?.dataScope}`);
        console.log(`     - canAccessPositions: [${position.hierarchicalAccess?.canAccessPositions?.join(", ")}]`);
        console.log("");
      }
    }

    // Get accessible users
    const { getAccessibleUserIds } = require("./utils/hierarchyUtils");
    const accessibleUserIds = await getAccessibleUserIds(azad);

    console.log(`✅ Azad can access ${accessibleUserIds.length} user(s):`);
    const accessibleUsers = await User.find({ _id: { $in: accessibleUserIds } })
      .select("name employeeId position")
      .lean();

    accessibleUsers.forEach(u => {
      console.log(`   - ${u.name} (${u.employeeId}) [${u.position || "No Position"}]`);
    });
    console.log("");

    // Check leads
    const Lead = require("./models/Lead");
    const leads = await Lead.find({
      assignedTo: { $in: accessibleUserIds }
    })
    .populate("assignedTo", "name employeeId")
    .lean();

    console.log(`✅ Leads accessible to Azad: ${leads.length}`);
    if (leads.length > 0) {
      leads.forEach(lead => {
        console.log(`   - ${lead.leadId}: ${lead.clientName} (Assigned to: ${lead.assignedTo?.name})`);
      });
    } else {
      console.log("   (No leads found)");
    }
    console.log("");

    // Check callbacks
    const Callback = require("./models/Callback");
    const callbacks = await Callback.find({
      assignedTo: { $in: accessibleUserIds }
    })
    .populate("assignedTo", "name employeeId")
    .lean();

    console.log(`✅ Callbacks accessible to Azad: ${callbacks.length}`);
    if (callbacks.length > 0) {
      callbacks.forEach(callback => {
        console.log(`   - ${callback.callbackId}: ${callback.clientName} (Assigned to: ${callback.assignedTo?.name})`);
      });
    } else {
      console.log("   (No callbacks found)");
    }
    console.log("");

    console.log("==========================================");
    console.log("NEXT STEPS");
    console.log("==========================================\n");

    console.log("Azad needs to LOG OUT and LOG BACK IN to refresh the session.");
    console.log("");
    console.log("The issue is that the user's session data in localStorage still has");
    console.log("the OLD position and positionLevel values. Logging out and back in");
    console.log("will fetch the UPDATED values from the database.\n");

    console.log("After logging back in, Azad should see:");
    console.log(`  - ${leads.length} lead(s) in the Team Leads page`);
    console.log(`  - ${callbacks.length} callback(s) in the Team Callbacks page\n`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkAndRefreshUser();
