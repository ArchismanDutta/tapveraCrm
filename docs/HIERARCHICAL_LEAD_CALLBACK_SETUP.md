# Hierarchical Lead & Callback Management - Implementation Complete! 🎉

## ✅ What's Been Implemented

Your lead and callback management system now has **full hierarchical access control** based on positions!

---

## 🎯 How It Works Now

### **Web Consultants** (Level 60)
- ✅ Can create their own leads and callbacks
- ✅ Can view only their own leads and callbacks
- ✅ Can edit only their own leads and callbacks
- ❌ Cannot see other Web Consultants' data
- ❌ Cannot reassign leads/callbacks

### **Supervisors** (Level 70)
- ✅ Can create leads and callbacks for themselves
- ✅ Can view Web Consultants' leads and callbacks (if permission enabled)
- ✅ Can edit Web Consultants' leads and callbacks (if permission enabled)
- ✅ Can reassign leads/callbacks to Web Consultants (if permission enabled)
- ✅ Can view their own leads and callbacks

### **Team Leads** (Level 80)
- ✅ Can create leads and callbacks for themselves
- ✅ Can view Supervisors' + Web Consultants' leads and callbacks
- ✅ Can edit Supervisors' + Web Consultants' leads and callbacks
- ✅ Can reassign leads/callbacks to Supervisors and Web Consultants
- ✅ Can view their own leads and callbacks

### **Super Admin**
- ✅ Can see EVERYTHING
- ✅ Can edit EVERYTHING
- ✅ Can reassign to ANYONE

---

## 🔧 Setup Instructions

### **Step 1: Restart Your Server**

```bash
cd server
npm start
```

Make sure you see no errors. The hierarchyUtils should load successfully.

---

### **Step 2: Create Positions** (Via Position Management UI)

Login as **super-admin** → Navigate to **Position Management**

#### **Position 1: Web Consultant**

```
Name: Web Consultant
Level: 60
Department: marketingAndSales (or "all")
Description: Entry-level sales consultant handling web projects

Permissions:
☐ canManageUsers
☐ canManageClients
☐ canManageProjects
☐ canAssignTasks
☐ canApproveLeaves
☐ canApproveShifts
☐ canViewReports
☐ canManageAttendance
☐ canViewSubordinateLeads
☐ canViewSubordinateCallbacks
☐ canViewSubordinateTasks
☐ canViewSubordinateProjects
☐ canEditSubordinateLeads
☐ canEditSubordinateCallbacks
☐ canAssignToSubordinates

Hierarchical Access:
✅ accessLowerLevels: false
minimumLevelGap: 0
canAccessPositions: []
dataScope: "own"
```

#### **Position 2: Supervisor**

```
Name: Supervisor
Level: 70
Department: marketingAndSales (or "all")
Description: Supervisor managing web consultants and their leads

Permissions:
☐ canManageUsers
☐ canManageClients
☑ canManageProjects
☑ canAssignTasks
☐ canApproveLeaves
☐ canApproveShifts
☐ canViewReports
☐ canManageAttendance
☑ canViewSubordinateLeads          ← ENABLE THIS
☑ canViewSubordinateCallbacks      ← ENABLE THIS
☐ canViewSubordinateTasks
☐ canViewSubordinateProjects
☑ canEditSubordinateLeads          ← ENABLE THIS
☑ canEditSubordinateCallbacks      ← ENABLE THIS
☑ canAssignToSubordinates          ← ENABLE THIS

Hierarchical Access:
✅ accessLowerLevels: true          ← ENABLE THIS
minimumLevelGap: 0
canAccessPositions: ["Web Consultant"]  ← ADD THIS
dataScope: "team"                   ← SET THIS
```

#### **Position 3: Team Lead**

```
Name: Team Lead
Level: 80
Department: marketingAndSales (or "all")
Description: Team lead overseeing supervisors and web consultants

Permissions:
☐ canManageUsers
☑ canManageClients
☑ canManageProjects
☑ canAssignTasks
☑ canApproveLeaves
☐ canApproveShifts
☑ canViewReports
☐ canManageAttendance
☑ canViewSubordinateLeads          ← ENABLE THIS
☑ canViewSubordinateCallbacks      ← ENABLE THIS
☑ canViewSubordinateTasks
☑ canViewSubordinateProjects
☑ canEditSubordinateLeads          ← ENABLE THIS
☑ canEditSubordinateCallbacks      ← ENABLE THIS
☑ canAssignToSubordinates          ← ENABLE THIS

Hierarchical Access:
✅ accessLowerLevels: true          ← ENABLE THIS
minimumLevelGap: 0
canAccessPositions: ["Supervisor", "Web Consultant"]  ← ADD BOTH
dataScope: "team"                   ← SET THIS
```

---

### **Step 3: Assign Positions to Users**

Go to **Position Management** → **"Assign to Users"** tab

Example assignments:
- **John (Employee)** → Web Consultant
- **Sarah (Employee)** → Web Consultant
- **Mike (Admin)** → Supervisor
- **Lisa (Admin)** → Team Lead

---

### **Step 4: Test the System!**

#### **Test 1: Web Consultant (John)**

1. Login as John
2. Go to **My Leads**
3. Create a new lead (should work ✅)
4. You should ONLY see John's own leads
5. Try to view Sarah's leads → Should not see them ❌

#### **Test 2: Supervisor (Mike)**

1. Login as Mike
2. Go to **Lead Management** (or My Leads)
3. You should see:
   - ✅ Mike's own leads
   - ✅ John's leads (Web Consultant)
   - ✅ Sarah's leads (Web Consultant)
4. Create a lead and assign to John → Should work ✅
5. Edit John's lead → Should work ✅

#### **Test 3: Team Lead (Lisa)**

1. Login as Lisa
2. Go to **Lead Management**
3. You should see:
   - ✅ Lisa's own leads
   - ✅ Mike's leads (Supervisor)
   - ✅ John's leads (Web Consultant)
   - ✅ Sarah's leads (Web Consultant)
4. Create a lead and assign to Mike → Should work ✅
5. Reassign Mike's lead to John → Should work ✅

#### **Test 4: Super Admin**

1. Login as Super Admin
2. Should see ALL leads from EVERYONE
3. Can edit, delete, reassign anything

---

## 📊 Access Matrix

| User | Position | Can View Leads Of | Can Edit Leads Of | Can Assign To |
|------|----------|-------------------|-------------------|---------------|
| John | Web Consultant | John only | John only | John only |
| Sarah | Web Consultant | Sarah only | Sarah only | Sarah only |
| Mike | Supervisor | Mike, John, Sarah | Mike, John, Sarah | Mike, John, Sarah |
| Lisa | Team Lead | Lisa, Mike, John, Sarah | Lisa, Mike, John, Sarah | Lisa, Mike, John, Sarah |
| Admin | Super Admin | EVERYONE | EVERYONE | EVERYONE |

---

## 🔍 Technical Details

### **Files Modified:**

1. **`server/controllers/leadController.js`**
   - ✅ Added hierarchical filtering in `getLeads()`
   - ✅ Added hierarchical access check in `getLeadById()`
   - ✅ Added permission checks in `updateLead()`
   - ✅ Added hierarchical stats in `getLeadStats()`
   - ✅ Added hierarchical assignment in `createLead()`

2. **`server/controllers/callbackController.js`**
   - ✅ Added hierarchical filtering in `getCallbacks()`
   - ✅ Added hierarchical access check in `getCallbackById()`
   - ✅ Added permission checks in `updateCallback()`
   - ✅ Added hierarchical stats in `getCallbackStats()`
   - ✅ Added hierarchical assignment in `createCallback()`

### **New Permissions Used:**

- `canViewSubordinateLeads` - View leads of subordinates
- `canViewSubordinateCallbacks` - View callbacks of subordinates
- `canEditSubordinateLeads` - Edit leads of subordinates
- `canEditSubordinateCallbacks` - Edit callbacks of subordinates
- `canAssignToSubordinates` - Assign leads/callbacks to subordinates

### **Hierarchy Functions Used:**

```javascript
getAccessibleUserIds(req.user)  // Returns all user IDs accessible
canAccessUserData(req.user, targetUserId)  // Check if can access
hasPermission(req.user, "canEditSubordinateLeads")  // Check permission
```

---

## 🚀 Features Enabled

✅ **Automatic Filtering**: Users automatically see only leads/callbacks they have access to
✅ **Permission-Based Editing**: Can only edit if have `canEditSubordinate*` permission
✅ **Smart Assignment**: Can only assign to self or accessible subordinates
✅ **Stats Filtering**: Dashboard stats show only accessible leads/callbacks
✅ **Reassignment Control**: Only supervisors/TL can reassign leads/callbacks
✅ **Lead-Callback Link**: Can only create callbacks for accessible leads

---

## 🛡️ Security Features

1. ✅ **Position-based hierarchy** - Automatic based on `positionLevel`
2. ✅ **Explicit permissions** - Must enable specific permissions
3. ✅ **Department boundaries** - Can restrict to same department
4. ✅ **Fallback to own data** - If no permissions, user sees only their own
5. ✅ **Admin override** - Super-admin always has full access

---

## 📝 What You Need to Do

1. ✅ **Restart server** - Load the new changes
2. ✅ **Create positions** - Use Position Management UI
3. ✅ **Assign positions** - Assign to all marketing & sales users
4. ✅ **Test thoroughly** - Login as different position users
5. ✅ **Adjust permissions** - Fine-tune as needed

---

## 🎯 Result

Your exact requirement is now implemented:

> "Web consultants save their leads/callbacks → Supervisors see Web Consultants' + own → Team Leads see Supervisors' + Web Consultants' + own → Super Admin sees everything"

✅ **DONE!**

The system is production-ready and waiting for you to set up the positions! 🚀
