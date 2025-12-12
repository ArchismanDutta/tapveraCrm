const mongoose = require("mongoose");
const User = require("./models/User");
const Position = require("./models/Position");
const Lead = require("./models/Lead");
require("dotenv").config();

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("==========================================");
    console.log("HIERARCHICAL LEAD SYSTEM DIAGNOSTICS");
    console.log("==========================================\n");

    // 1. Check Positions
    console.log("📋 CHECKING POSITIONS...\n");
    const positions = await Position.find({ status: "active" }).lean();

    if (positions.length === 0) {
      console.log("❌ NO POSITIONS FOUND!");
      console.log("   You need to create positions first via Position Management UI\n");
    } else {
      console.log(`✅ Found ${positions.length} active position(s):\n`);
      positions.forEach(pos => {
        console.log(`   Position: ${pos.name}`);
        console.log(`   Level: ${pos.level}`);
        console.log(`   Department: ${pos.department}`);
        console.log(`   Permissions:`);
        console.log(`     - canViewSubordinateLeads: ${pos.permissions?.canViewSubordinateLeads || false}`);
        console.log(`     - canEditSubordinateLeads: ${pos.permissions?.canEditSubordinateLeads || false}`);
        console.log(`     - canAssignToSubordinates: ${pos.permissions?.canAssignToSubordinates || false}`);
        console.log(`   Hierarchical Access:`);
        console.log(`     - accessLowerLevels: ${pos.hierarchicalAccess?.accessLowerLevels || false}`);
        console.log(`     - dataScope: ${pos.hierarchicalAccess?.dataScope || "own"}`);
        console.log(`     - canAccessPositions: [${pos.hierarchicalAccess?.canAccessPositions?.join(", ") || ""}]`);
        console.log("");
      });
    }

    // 2. Check Users (Azad and Rahul)
    console.log("👥 CHECKING USERS (Azad & Rahul)...\n");

    const azad = await User.findOne({
      name: { $regex: /azad/i }
    }).select("name email employeeId role department position positionLevel").lean();

    const rahul = await User.findOne({
      name: { $regex: /rahul/i }
    }).select("name email employeeId role department position positionLevel").lean();

    if (!azad) {
      console.log("❌ Azad not found in database\n");
    } else {
      console.log(`✅ Found Azad:`);
      console.log(`   Name: ${azad.name}`);
      console.log(`   Email: ${azad.email}`);
      console.log(`   Employee ID: ${azad.employeeId}`);
      console.log(`   Role: ${azad.role}`);
      console.log(`   Department: ${azad.department}`);
      console.log(`   Position: ${azad.position || "NOT SET"}`);
      console.log(`   Position Level: ${azad.positionLevel || "NOT SET"}`);
      console.log("");
    }

    if (!rahul) {
      console.log("❌ Rahul not found in database\n");
    } else {
      console.log(`✅ Found Rahul:`);
      console.log(`   Name: ${rahul.name}`);
      console.log(`   Email: ${rahul.email}`);
      console.log(`   Employee ID: ${rahul.employeeId}`);
      console.log(`   Role: ${rahul.role}`);
      console.log(`   Department: ${rahul.department}`);
      console.log(`   Position: ${rahul.position || "NOT SET"}`);
      console.log(`   Position Level: ${rahul.positionLevel || "NOT SET"}`);
      console.log("");
    }

    // 3. Check Leads assigned to Rahul
    if (rahul) {
      console.log("📊 CHECKING LEADS ASSIGNED TO RAHUL...\n");
      const rahulLeads = await Lead.find({ assignedTo: rahul._id })
        .select("leadId clientName businessName status createdAt")
        .lean();

      if (rahulLeads.length === 0) {
        console.log("❌ No leads found assigned to Rahul\n");
      } else {
        console.log(`✅ Found ${rahulLeads.length} lead(s) assigned to Rahul:\n`);
        rahulLeads.forEach(lead => {
          console.log(`   Lead ID: ${lead.leadId}`);
          console.log(`   Client: ${lead.clientName}`);
          console.log(`   Business: ${lead.businessName}`);
          console.log(`   Status: ${lead.status}`);
          console.log(`   Created: ${lead.createdAt}`);
          console.log("");
        });
      }
    }

    // 4. Test Hierarchy Access
    if (azad && rahul) {
      console.log("🔍 TESTING HIERARCHY ACCESS...\n");

      const { getAccessibleUserIds } = require("./utils/hierarchyUtils");

      // Test what users Azad can access
      const azadAccessibleIds = await getAccessibleUserIds(azad);
      console.log(`Azad can access ${azadAccessibleIds.length} user(s):`);

      const accessibleUsers = await User.find({ _id: { $in: azadAccessibleIds } })
        .select("name employeeId position")
        .lean();

      accessibleUsers.forEach(u => {
        console.log(`   - ${u.name} (${u.employeeId}) [${u.position || "No Position"}]`);
      });
      console.log("");

      // Check if Azad can access Rahul
      const canAccessRahul = azadAccessibleIds.includes(rahul._id.toString());
      if (canAccessRahul) {
        console.log(`✅ Azad CAN access Rahul's data (hierarchy is working)\n`);
      } else {
        console.log(`❌ Azad CANNOT access Rahul's data (hierarchy is NOT working)\n`);
        console.log(`DIAGNOSIS:`);

        // Diagnose the issue
        const supervisorPos = await Position.findOne({ name: azad.position, status: "active" }).lean();
        const webConsultantPos = await Position.findOne({ name: rahul.position, status: "active" }).lean();

        if (!azad.position || azad.position === "") {
          console.log(`   ❌ Azad has NO position assigned`);
        } else if (!supervisorPos) {
          console.log(`   ❌ Azad's position "${azad.position}" not found in Position collection`);
        }

        if (!rahul.position || rahul.position === "") {
          console.log(`   ❌ Rahul has NO position assigned`);
        } else if (!webConsultantPos) {
          console.log(`   ❌ Rahul's position "${rahul.position}" not found in Position collection`);
        }

        if (supervisorPos && webConsultantPos) {
          console.log(`   ℹ️  Azad's Position Level: ${azad.positionLevel}`);
          console.log(`   ℹ️  Rahul's Position Level: ${rahul.positionLevel}`);

          if (azad.positionLevel <= rahul.positionLevel) {
            console.log(`   ❌ Azad's position level (${azad.positionLevel}) is NOT higher than Rahul's (${rahul.positionLevel})`);
          }

          if (!supervisorPos.hierarchicalAccess?.accessLowerLevels) {
            console.log(`   ❌ Supervisor position does NOT have "accessLowerLevels" enabled`);
          }

          if (supervisorPos.hierarchicalAccess?.dataScope !== "team") {
            console.log(`   ❌ Supervisor position dataScope is "${supervisorPos.hierarchicalAccess?.dataScope}", should be "team"`);
          }

          if (!supervisorPos.hierarchicalAccess?.canAccessPositions?.includes(rahul.position)) {
            console.log(`   ❌ Supervisor position canAccessPositions does NOT include "${rahul.position}"`);
          }

          if (azad.department !== rahul.department) {
            console.log(`   ❌ Azad and Rahul are in DIFFERENT departments (${azad.department} vs ${rahul.department})`);
          }

          if (!supervisorPos.permissions?.canViewSubordinateLeads) {
            console.log(`   ❌ Supervisor position does NOT have "canViewSubordinateLeads" permission`);
          }
        }
        console.log("");
      }
    }

    console.log("==========================================");
    console.log("RECOMMENDED ACTIONS:");
    console.log("==========================================\n");

    if (positions.length === 0) {
      console.log("1. Create positions via Position Management UI");
      console.log("   - Create 'Web Consultant' position with level 60");
      console.log("   - Create 'Supervisor' position with level 70");
    }

    if (!azad?.position) {
      console.log("2. Assign 'Supervisor' position to Azad via Position Management");
    }

    if (!rahul?.position) {
      console.log("3. Assign 'Web Consultant' position to Rahul via Position Management");
    }

    const supervisorPos = positions.find(p => p.name.toLowerCase().includes("supervisor"));
    if (supervisorPos && !supervisorPos.permissions?.canViewSubordinateLeads) {
      console.log("4. Enable 'canViewSubordinateLeads' permission for Supervisor position");
    }

    if (supervisorPos && !supervisorPos.hierarchicalAccess?.accessLowerLevels) {
      console.log("5. Enable 'accessLowerLevels' in Supervisor hierarchical access");
    }

    if (supervisorPos && supervisorPos.hierarchicalAccess?.dataScope !== "team") {
      console.log("6. Set Supervisor dataScope to 'team'");
    }

    console.log("\n✅ Diagnostics complete!\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error running diagnostics:", error);
    process.exit(1);
  }
}

diagnose();
