const User = require("../models/User");
const Position = require("../models/Position");

/**
 * Get all users that the current user can access based on position hierarchy
 * @param {Object} currentUser - The logged-in user object
 * @returns {Promise<Array>} - Array of user IDs that can be accessed
 */
async function getAccessibleUserIds(currentUser) {
  try {
    // Super-admin can access everyone
    if (currentUser.role === "super-admin" || currentUser.role === "superadmin") {
      const allUsers = await User.find({ status: "active" }).select("_id");
      return allUsers.map(u => u._id.toString());
    }

    // Admin can access everyone
    if (currentUser.role === "admin") {
      const allUsers = await User.find({ status: "active" }).select("_id");
      return allUsers.map(u => u._id.toString());
    }

    // If user has no position, they can only access their own data
    if (!currentUser.position || !currentUser.positionLevel) {
      return [currentUser._id.toString()];
    }

    // Get the user's position configuration
    const userPosition = await Position.findOne({
      name: currentUser.position,
      status: "active"
    });

    if (!userPosition) {
      return [currentUser._id.toString()];
    }

    const accessibleUserIds = [currentUser._id.toString()]; // Always include self

    // Get hierarchical access configuration
    const { hierarchicalAccess } = userPosition;

    // Check data scope
    if (hierarchicalAccess?.dataScope === "all") {
      // Can access all users
      const allUsers = await User.find({ status: "active" }).select("_id");
      return allUsers.map(u => u._id.toString());
    }

    if (hierarchicalAccess?.dataScope === "department") {
      // Can access all users in the same department
      const departmentUsers = await User.find({
        status: "active",
        department: currentUser.department
      }).select("_id");
      return departmentUsers.map(u => u._id.toString());
    }

    if (hierarchicalAccess?.dataScope === "team") {
      // Team scope with hierarchical access

      // 1. Check if can access lower levels
      if (hierarchicalAccess.accessLowerLevels) {
        const minimumLevelGap = hierarchicalAccess.minimumLevelGap || 0;
        const minAccessibleLevel = currentUser.positionLevel - minimumLevelGap;

        // Get users with positions at lower levels
        const lowerLevelUsers = await User.find({
          status: "active",
          positionLevel: { $lt: currentUser.positionLevel, $gte: minAccessibleLevel },
          department: currentUser.department // Same department
        }).select("_id");

        lowerLevelUsers.forEach(u => {
          if (!accessibleUserIds.includes(u._id.toString())) {
            accessibleUserIds.push(u._id.toString());
          }
        });
      }

      // 2. Check specific positions that can be accessed
      if (hierarchicalAccess.canAccessPositions && hierarchicalAccess.canAccessPositions.length > 0) {
        const specificUsers = await User.find({
          status: "active",
          position: { $in: hierarchicalAccess.canAccessPositions }
        }).select("_id");

        specificUsers.forEach(u => {
          if (!accessibleUserIds.includes(u._id.toString())) {
            accessibleUserIds.push(u._id.toString());
          }
        });
      }
    }

    return accessibleUserIds;
  } catch (error) {
    console.error("Error in getAccessibleUserIds:", error);
    return [currentUser._id.toString()]; // Fallback to own data only
  }
}

/**
 * Check if current user can access target user's data
 * @param {Object} currentUser - The logged-in user object
 * @param {String} targetUserId - The user ID to check access for
 * @returns {Promise<Boolean>}
 */
async function canAccessUserData(currentUser, targetUserId) {
  // User can always access their own data
  if (currentUser._id.toString() === targetUserId.toString()) {
    return true;
  }

  // Super-admin can access everyone
  if (currentUser.role === "super-admin" || currentUser.role === "superadmin") {
    return true;
  }

  // Admin can access everyone
  if (currentUser.role === "admin") {
    return true;
  }

  const accessibleUserIds = await getAccessibleUserIds(currentUser);
  return accessibleUserIds.includes(targetUserId.toString());
}

/**
 * Build query filter for hierarchical data access
 * @param {Object} currentUser - The logged-in user object
 * @param {String} userField - The field name that references the user (e.g., "assignedTo", "createdBy")
 * @returns {Promise<Object>} - MongoDB query filter
 */
async function buildHierarchicalQuery(currentUser, userField = "assignedTo") {
  const accessibleUserIds = await getAccessibleUserIds(currentUser);

  // Build query filter
  return {
    [userField]: { $in: accessibleUserIds }
  };
}

/**
 * Check if user has specific permission
 * @param {Object} currentUser - The logged-in user object
 * @param {String} permission - Permission key to check
 * @returns {Promise<Boolean>}
 */
async function hasPermission(currentUser, permission) {
  // Super-admin has all permissions
  if (currentUser.role === "super-admin" || currentUser.role === "superadmin") {
    return true;
  }

  // If no position, no special permissions
  if (!currentUser.position) {
    return false;
  }

  const userPosition = await Position.findOne({
    name: currentUser.position,
    status: "active"
  });

  if (!userPosition) {
    return false;
  }

  // Check if permission exists and is true
  return userPosition.permissions?.[permission] === true;
}

/**
 * Get user's effective data scope
 * @param {Object} currentUser - The logged-in user object
 * @returns {Promise<String>} - "own", "team", "department", or "all"
 */
async function getUserDataScope(currentUser) {
  // Super-admin sees all
  if (currentUser.role === "super-admin" || currentUser.role === "superadmin") {
    return "all";
  }

  // Admin sees all
  if (currentUser.role === "admin") {
    return "all";
  }

  // If no position, only own data
  if (!currentUser.position) {
    return "own";
  }

  const userPosition = await Position.findOne({
    name: currentUser.position,
    status: "active"
  });

  if (!userPosition) {
    return "own";
  }

  return userPosition.hierarchicalAccess?.dataScope || "own";
}

/**
 * Get subordinate user IDs (users at lower position levels)
 * @param {Object} currentUser - The logged-in user object
 * @returns {Promise<Array>} - Array of subordinate user IDs
 */
async function getSubordinateUserIds(currentUser) {
  try {
    // Super-admin and admin have no subordinates concept (they see all)
    if (currentUser.role === "super-admin" || currentUser.role === "superadmin" || currentUser.role === "admin") {
      return [];
    }

    if (!currentUser.position || !currentUser.positionLevel) {
      return [];
    }

    const userPosition = await Position.findOne({
      name: currentUser.position,
      status: "active"
    });

    if (!userPosition || !userPosition.hierarchicalAccess?.accessLowerLevels) {
      return [];
    }

    const minimumLevelGap = userPosition.hierarchicalAccess.minimumLevelGap || 0;
    const minAccessibleLevel = currentUser.positionLevel - minimumLevelGap;

    // Get users with positions at lower levels in the same department
    const subordinates = await User.find({
      status: "active",
      positionLevel: { $lt: currentUser.positionLevel, $gte: minAccessibleLevel },
      department: currentUser.department,
      _id: { $ne: currentUser._id } // Exclude self
    }).select("_id");

    // Also include users from specific accessible positions
    if (userPosition.hierarchicalAccess.canAccessPositions?.length > 0) {
      const specificUsers = await User.find({
        status: "active",
        position: { $in: userPosition.hierarchicalAccess.canAccessPositions },
        _id: { $ne: currentUser._id }
      }).select("_id");

      const allSubordinates = [...subordinates, ...specificUsers];
      // Remove duplicates
      const uniqueIds = [...new Set(allSubordinates.map(u => u._id.toString()))];
      return uniqueIds;
    }

    return subordinates.map(u => u._id.toString());
  } catch (error) {
    console.error("Error in getSubordinateUserIds:", error);
    return [];
  }
}

module.exports = {
  getAccessibleUserIds,
  canAccessUserData,
  buildHierarchicalQuery,
  hasPermission,
  getUserDataScope,
  getSubordinateUserIds
};
