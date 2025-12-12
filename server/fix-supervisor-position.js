const mongoose = require("mongoose");
const Position = require("./models/Position");
const User = require("./models/User");
require("dotenv").config();

async function fixSupervisorPosition() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("==========================================");
    console.log("FIXING SUPERVISOR POSITION CONFIGURATION");
    console.log("==========================================\n");

    // 1. Update Supervisor Position
    console.log("📝 Updating Supervisor position...\n");

    const supervisorUpdate = await Position.findOneAndUpdate(
      { name: "Supervisor", status: "active" },
      {
        $set: {
          level: 70,
          permissions: {
            canManageUsers: false,
            canManageClients: false,
            canManageProjects: true,
            canAssignTasks: true,
            canApproveLeaves: false,
            canApproveShifts: false,
            canViewReports: false,
            canManageAttendance: false,
            canViewSubordinateLeads: true,          // ✅ ENABLE
            canViewSubordinateCallbacks: true,      // ✅ ENABLE
            canViewSubordinateTasks: false,
            canViewSubordinateProjects: false,
            canEditSubordinateLeads: true,          // ✅ ENABLE
            canEditSubordinateCallbacks: true,      // ✅ ENABLE
            canAssignToSubordinates: true,          // ✅ ENABLE
            canViewDepartmentLeads: false,
            canViewDepartmentCallbacks: false,
            canViewDepartmentTasks: false
          },
          hierarchicalAccess: {
            accessLowerLevels: true,                 // ✅ ENABLE
            minimumLevelGap: 0,
            canAccessPositions: ["Web Consultant"],  // ✅ ADD Web Consultant
            dataScope: "team"                        // ✅ SET TO TEAM
          }
        }
      },
      { new: true }
    );

    if (!supervisorUpdate) {
      console.log("❌ Supervisor position not found!\n");
      process.exit(1);
    }

    console.log("✅ Supervisor position updated successfully!");
    console.log(`   Level: ${supervisorUpdate.level}`);
    console.log(`   Permissions:`);
    console.log(`     - canViewSubordinateLeads: ${supervisorUpdate.permissions.canViewSubordinateLeads}`);
    console.log(`     - canEditSubordinateLeads: ${supervisorUpdate.permissions.canEditSubordinateLeads}`);
    console.log(`     - canAssignToSubordinates: ${supervisorUpdate.permissions.canAssignToSubordinates}`);
    console.log(`   Hierarchical Access:`);
    console.log(`     - accessLowerLevels: ${supervisorUpdate.hierarchicalAccess.accessLowerLevels}`);
    console.log(`     - dataScope: ${supervisorUpdate.hierarchicalAccess.dataScope}`);
    console.log(`     - canAccessPositions: [${supervisorUpdate.hierarchicalAccess.canAccessPositions.join(", ")}]`);
    console.log("");

    // 2. Update Web Consultant Position Level
    console.log("📝 Updating Web Consultant position level...\n");

    const webConsultantUpdate = await Position.findOneAndUpdate(
      { name: "Web Consultant", status: "active" },
      { $set: { level: 60 } },
      { new: true }
    );

    if (!webConsultantUpdate) {
      console.log("❌ Web Consultant position not found!\n");
      process.exit(1);
    }

    console.log("✅ Web Consultant position updated successfully!");
    console.log(`   Level: ${webConsultantUpdate.level}`);
    console.log("");

    // 3. Update all users with these positions to have correct positionLevel
    console.log("📝 Updating user position levels...\n");

    const supervisorUsers = await User.updateMany(
      { position: "Supervisor", status: "active" },
      { $set: { positionLevel: 70 } }
    );

    console.log(`✅ Updated ${supervisorUsers.modifiedCount} Supervisor user(s) to level 70`);

    const webConsultantUsers = await User.updateMany(
      { position: "Web Consultant", status: "active" },
      { $set: { positionLevel: 60 } }
    );

    console.log(`✅ Updated ${webConsultantUsers.modifiedCount} Web Consultant user(s) to level 60`);
    console.log("");

    // 4. Verify the fix
    console.log("🔍 VERIFYING FIX...\n");

    const { getAccessibleUserIds } = require("./utils/hierarchyUtils");

    const azad = await User.findOne({ name: { $regex: /azad/i } }).lean();
    const rahul = await User.findOne({ name: { $regex: /rahul/i } }).lean();

    if (azad && rahul) {
      const azadAccessibleIds = await getAccessibleUserIds(azad);
      const canAccessRahul = azadAccessibleIds.includes(rahul._id.toString());

      console.log(`Azad can now access ${azadAccessibleIds.length} user(s):`);
      const accessibleUsers = await User.find({ _id: { $in: azadAccessibleIds } })
        .select("name employeeId position")
        .lean();

      accessibleUsers.forEach(u => {
        console.log(`   - ${u.name} (${u.employeeId}) [${u.position || "No Position"}]`);
      });
      console.log("");

      if (canAccessRahul) {
        console.log("✅ SUCCESS! Azad can now access Rahul's data");
        console.log("✅ Azad will be able to see Rahul's leads in the portal\n");
      } else {
        console.log("❌ FAILED! Azad still cannot access Rahul's data\n");
      }
    }

    console.log("==========================================");
    console.log("✅ FIX COMPLETE!");
    console.log("==========================================\n");

    console.log("Next steps:");
    console.log("1. Have Azad log out and log back in (to refresh session)");
    console.log("2. Azad should now be able to see Rahul's leads in the portal");
    console.log("3. Azad can now edit and reassign Rahul's leads\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error fixing Supervisor position:", error);
    process.exit(1);
  }
}

fixSupervisorPosition();
