# 🌍 Region-Based Access Control Implementation

## ✅ BACKEND CHANGES COMPLETED

### 1. **Database Models Updated**

#### Client Model (`models/Client.js`)
- ✅ Added `region` field (String, default: 'Global', required)
- User can enter any region name (USA, Australia, Canada, etc.)

#### User Model (`models/User.js`)
- ✅ Added `region` field (String, default: 'Global', required)
- All users get 'Global' access by default
- Can be changed to specific regions via Employee Management

### 2. **API Routes Updated**

#### Client Routes (`routes/clientRoutes.js`)
- ✅ **GET /api/clients/regions** - Fetch unique regions for dropdown (NEW)
- ✅ **POST /api/clients** - Accept region field during creation
- ✅ **GET /api/clients** - Filter clients by user's region
- ✅ **PUT /api/clients/:id** - Update client region

**Region Filtering Logic:**
```javascript
// Super-admin: Sees ALL clients
// Global region: Sees ALL clients
// Specific region: Only sees clients in their region + Global clients
```

#### Project Routes (`routes/projectRoutes.js`)
- ✅ **GET /api/projects** - Filter projects based on client region
- ✅ Projects populated with client region info

**Region Filtering Logic:**
```javascript
// Super-admin: Sees ALL projects
// Global region: Sees ALL projects
// Specific region: Only sees projects from clients in their region + Global
// Employees: Always see projects they're assigned to (regardless of region)
```

### 3. **Migration Script Created**

**File:** `scripts/migrateRegions.js`

**What it does:**
- Sets all existing clients to 'Global' region
- Sets all existing users to 'Global' region
- Ensures super-admins have 'Global' region
- Shows summary of migration

**Run it:**
```bash
cd server
node scripts/migrateRegions.js
```

---

## 🎨 FRONTEND CHANGES NEEDED

### 1. **Client Management Page** (`client/src/pages/ClientsPage.jsx`)

#### A. Add Region Input to Client Creation Form

```jsx
// In the client creation/edit form
<div className="form-group">
  <label htmlFor="region">Region *</label>
  <input
    type="text"
    id="region"
    name="region"
    value={formData.region || 'Global'}
    onChange={handleChange}
    placeholder="Enter region (e.g., USA, Australia, Canada)"
    className="form-control"
    required
  />
  <small className="text-muted">
    Specify the region for this client. Admins assigned to this region will see this client.
  </small>
</div>
```

#### B. Display Region in Client List

```jsx
// In the clients table
<tbody>
  {clients.map(client => (
    <tr key={client._id}>
      <td>{client.clientName}</td>
      <td>{client.businessName}</td>
      <td>
        <span className="badge bg-info">
          🌍 {client.region || 'Global'}
        </span>
      </td>
      <td>{client.email}</td>
      <td>
        <span className={`badge ${client.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
          {client.status}
        </span>
      </td>
      {/* Actions */}
    </tr>
  ))}
</tbody>
```

### 2. **Employee Management Page** (`client/src/pages/EmployeeManagement.jsx`)

#### A. Add Dynamic Region Dropdown

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

const EmployeeManagement = () => {
  const [regions, setRegions] = useState(['Global']);
  const [formData, setFormData] = useState({
    // ... existing fields
    region: 'Global'  // Add region field
  });

  // Fetch available regions from clients
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/clients/regions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRegions(response.data);
      } catch (error) {
        console.error('Error fetching regions:', error);
      }
    };
    fetchRegions();
  }, []);

  return (
    <form>
      {/* ... existing fields ... */}

      {/* NEW: Region Selection */}
      <div className="form-group">
        <label htmlFor="region">Access Region *</label>
        <select
          id="region"
          name="region"
          value={formData.region}
          onChange={handleChange}
          className="form-select"
          required
        >
          {regions.map(region => (
            <option key={region} value={region}>
              {region === 'Global' ? '🌍 Global (All Regions)' : `📍 ${region}`}
            </option>
          ))}
        </select>
        <small className="text-muted">
          {formData.role === 'super-admin'
            ? 'Super-admins automatically have Global access'
            : 'Select which region this user can access. They will only see clients/projects in their region.'}
        </small>
      </div>
    </form>
  );
};
```

#### B. Display Region in Employee List

```jsx
// In the employees table
<tbody>
  {employees.map(employee => (
    <tr key={employee._id}>
      <td>{employee.name}</td>
      <td>{employee.email}</td>
      <td>{employee.role}</td>
      <td>
        <span className="badge bg-primary">
          {employee.region || 'Global'}
        </span>
      </td>
      {/* Other columns */}
    </tr>
  ))}
</tbody>
```

### 3. **Projects Page** (`client/src/pages/ProjectsPage.jsx`)

#### Display Client Region in Project List

```jsx
// In the projects table
<tbody>
  {projects.map(project => (
    <tr key={project._id}>
      <td>{project.projectName}</td>
      <td>
        {project.client?.clientName}
        {project.client?.region && (
          <span className="badge bg-info ms-2">
            {project.client.region}
          </span>
        )}
      </td>
      <td>{project.type?.join(', ')}</td>
      <td>{project.status}</td>
      {/* Other columns */}
    </tr>
  ))}
</tbody>
```

---

## 🎯 HOW IT WORKS

### **Scenario 1: Creating a USA Client**

1. Super-admin creates client "Tesla USA"
2. Enters region as: **"USA"**
3. Client is saved with region: "USA"

### **Scenario 2: Assigning Employee to USA Region**

1. Super-admin goes to Employee Management
2. Selects employee "John Doe" (role: Admin)
3. Opens region dropdown → sees: Global, USA (fetched from clients)
4. Selects: **"USA"**
5. John's region is updated to "USA"

### **Scenario 3: John Logs In (USA Admin)**

**Clients page:**
- ✅ Sees "Tesla USA" (region: USA)
- ✅ Sees "Global Client Inc" (region: Global)
- ❌ Does NOT see "Telstra Australia" (region: Australia)

**Projects page:**
- ✅ Sees all projects for USA clients
- ✅ Sees all projects for Global clients
- ✅ Sees Australian project if he's assigned to it
- ❌ Does NOT see other Australian projects

### **Scenario 4: Super-Admin Logs In**

- ✅ Sees EVERYTHING (all clients, all projects)
- Region setting is ignored for super-admins

---

## 📊 DATABASE STRUCTURE

### Client Document Example:
```json
{
  "_id": "abc123",
  "clientName": "Tesla USA",
  "businessName": "Tesla Inc",
  "email": "contact@tesla.com",
  "region": "USA",  // ← NEW FIELD
  "status": "Active",
  "createdAt": "2025-01-15T10:00:00Z"
}
```

### User Document Example:
```json
{
  "_id": "user456",
  "name": "John Doe",
  "email": "john@tapvera.io",
  "role": "admin",
  "region": "USA",  // ← NEW FIELD
  "department": "executives"
}
```

---

## 🚀 DEPLOYMENT STEPS

### 1. **Backend Deployment**

```bash
# Commit changes
git add server/models/Client.js server/models/User.js server/routes/clientRoutes.js server/routes/projectRoutes.js server/scripts/migrateRegions.js
git commit -m "feat: Add region-based access control for clients and projects"
git push origin archi

# After deployment to AWS, run migration
ssh into-aws-instance
cd /path/to/server
node scripts/migrateRegions.js
```

### 2. **Frontend Deployment**

```bash
# Update client forms and employee management
# Add region field to ClientsPage.jsx
# Add region dropdown to EmployeeManagement.jsx
# Display region badges in lists

git add client/src/pages/
git commit -m "feat: Add region input for clients and dropdown for employees"
git push origin archi
```

### 3. **Testing Checklist**

- [ ] Run migration script successfully
- [ ] Create a client with region "USA"
- [ ] Create an admin user and assign region "USA"
- [ ] Login as that admin - verify they only see USA clients
- [ ] Login as super-admin - verify they see all clients
- [ ] Check projects are filtered by client region
- [ ] Check employee assigned to foreign project can still see it

---

## 💡 TIPS & BEST PRACTICES

### **Region Naming Convention:**
- Use consistent names (e.g., "USA" not "usa" or "United States")
- Suggest common regions in UI but allow free text
- Consider adding autocomplete for common regions

### **Future Enhancements:**
- Add region management page for super-admin to standardize regions
- Bulk assign employees to regions
- Region-based analytics and reports
- Multi-region support (employees in multiple regions)

---

## 🐛 TROUBLESHOOTING

### **Q: Admin can't see any clients after update**
**A:** Check their region field - it might be empty/null. Run migration script or manually set to 'Global'

### **Q: Regions dropdown is empty**
**A:** No clients created yet with regions. Create at least one client with a region first.

### **Q: Employee sees projects they shouldn't**
**A:** Employees always see projects they're assigned to, regardless of region. This is intentional.

### **Q: How to give admin access to multiple regions?**
**A:** Currently, set them to 'Global'. For multi-region support, future enhancement needed.

---

## ✅ IMPLEMENTATION CHECKLIST

### Backend:
- [x] Update Client model with region field
- [x] Update User model with region field
- [x] Add GET /api/clients/regions endpoint
- [x] Update client routes with region filtering
- [x] Update project routes with region filtering
- [x] Create migration script

### Frontend:
- [ ] Add region text input to Client creation form
- [ ] Add region to Client edit form
- [ ] Display region badge in Clients list
- [ ] Fetch regions API in Employee Management
- [ ] Add region dropdown in Employee creation/edit
- [ ] Display region in Employees list
- [ ] Show client region in Projects list

### Testing:
- [ ] Run migration script
- [ ] Test client creation with region
- [ ] Test region filtering for admins
- [ ] Test super-admin sees everything
- [ ] Test employee assigned to foreign project
- [ ] Test regions dropdown populates correctly

---

**Implementation completed by:** Claude Code Assistant
**Date:** 2025-01-03
**Status:** Backend ✅ | Frontend ⏳
