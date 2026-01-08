# 🌍 Region-Based Access Control System

## Overview
The CRM now implements a comprehensive region-based access control system that restricts what clients and projects each user can see based on their assigned regions.

---

## 📋 Regions

The system supports the following regions:
- **USA** - United States
- **AUS** - Australia
- **CANADA** - Canada
- **IND** - India
- **Global** - Access to all regions (special permission)

---

## 🎭 User Roles & Access

### 1. **Super Admin**
- **Access**: Full access to ALL clients and projects
- **Regions**: Can assign regions to employees
- **No Restrictions**: Sees everything regardless of region assignment

### 2. **Admin**
- **Access**: Limited by assigned region(s)
- **Client Management**: Only sees clients in their assigned region(s)
- **Project Management**: Only sees projects whose clients are in their assigned region(s)
- **My Projects Area**: Same region restrictions apply

### 3. **HR**
- **Access**: Limited by assigned region(s)
- **Same restrictions as Admin**

### 4. **Employee**
- **Access**: Only sees projects they are assigned to
- **No region restrictions** (as they don't manage clients)

---

## 🔧 How It Works

### Client Assignment
1. When creating/editing a client, select a **single region** from the dropdown
2. This region determines which admins can see this client
3. Default: "Global" (visible to all admins)

### Employee Assignment
1. Super Admin assigns **multiple regions** to employees from the Employee Directory
2. Employees with "Global" region can see all clients/projects
3. Employees with specific regions only see clients/projects in those regions

### Project Filtering
1. Projects are filtered based on the **client's region**
2. If a project has multiple clients, admin must have access to at least ONE of the client regions
3. Example:
   - Project A: Client from USA
   - Admin with USA region ✅ Can see
   - Admin with AUS region ❌ Cannot see
   - Admin with Global region ✅ Can see

---

## 🎯 Use Cases

### Scenario 1: Regional Manager
**User**: John (Admin, Regions: USA, CANADA)
**Can See**:
- Clients in USA ✅
- Clients in CANADA ✅
- Projects from USA/CANADA clients ✅

**Cannot See**:
- Clients in AUS ❌
- Clients in IND ❌
- Projects from AUS/IND clients ❌

### Scenario 2: Global Manager
**User**: Sarah (Admin, Regions: Global)
**Can See**:
- ALL clients ✅
- ALL projects ✅

### Scenario 3: Super Admin
**User**: Alex (Super Admin)
**Can See**:
- ALL clients ✅
- ALL projects ✅
- Can assign regions to any employee ✅

---

## 📝 Configuration

### For Super Admins

#### Assigning Regions to Employees:
1. Go to **Employee Directory**
2. Find the employee
3. Toggle the region badges to assign/unassign regions
4. Employees can have multiple regions
5. "Global" region grants access to everything

#### Creating Clients with Regions:
1. Go to **Client Management**
2. Click "Add Client"
3. Select **one region** from the dropdown
4. Admins in that region will now see this client

---

## ✅ Implementation Details

### Database Schema

#### Client Model
```javascript
region: {
  type: String,
  enum: ['USA', 'AUS', 'CANADA', 'IND', 'Global'],
  default: 'Global',
  required: true
}
```

#### User Model
```javascript
regions: {
  type: [{
    type: String,
    enum: ['USA', 'AUS', 'CANADA', 'IND', 'Global']
  }],
  default: ['Global'],
  required: true
}
```

### API Filtering

#### Client Routes (`GET /api/clients`)
```javascript
// Super-admin: No filtering
// Global region: No filtering
// Specific regions: filter by client.region in user.regions
```

#### Project Routes (`GET /api/projects`)
```javascript
// Super-admin: No filtering
// Global region: No filtering
// Admin with regions: Only projects where client.region in user.regions
// Employee: Only projects where user is assignedTo
```

---

## 🔒 Security Notes

1. ✅ **Strict Filtering**: Admins CANNOT see projects outside their regions
2. ✅ **No Bypassing**: Even if assigned to a project, admins must have region access
3. ✅ **Backwards Compatible**: Old projects with single `client` field are handled
4. ✅ **Logging**: All region filtering is logged for audit purposes

---

## 🚀 Future Enhancements

Potential additions:
- Region-specific dashboards
- Region-based reporting
- Cross-region collaboration requests
- Region transfer workflows
- Multi-region projects support

---

## 📊 Testing

### Test Cases

**Test 1: Admin with USA region**
- Create client with USA region ✅ Should see
- Create client with AUS region ❌ Should NOT see
- Create project for USA client ✅ Should see
- Create project for AUS client ❌ Should NOT see

**Test 2: Admin with Global region**
- Should see ALL clients ✅
- Should see ALL projects ✅

**Test 3: Super Admin**
- Should see ALL clients ✅
- Should see ALL projects ✅
- Should be able to assign regions to employees ✅

---

## 🎓 Summary

The region-based access control system ensures:
- ✅ Data privacy across regions
- ✅ Scalable multi-region operations
- ✅ Role-based permissions
- ✅ Easy administration
- ✅ Backwards compatibility

Super Admins have full control, while Admins are restricted to their assigned regions for both clients and projects.

---

**Built with**: Node.js, MongoDB, React
**Status**: ✅ PRODUCTION READY
