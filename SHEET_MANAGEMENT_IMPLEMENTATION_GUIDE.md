# 📊 Sheet Management Feature - Complete Implementation Guide

## ✨ Feature Overview

This feature allows users to embed and edit Google Sheets and Excel Online directly inside the CRM with real-time sync to the original sheets.

### Key Features:
- ✅ Embed Google Sheets and Excel Online with full editing capabilities
- ✅ Real-time sync - all changes reflected in original sheet
- ✅ No data stored in CRM database (only links and metadata)
- ✅ Sheet sharing with specific users or roles
- ✅ Access control based on user permissions
- ✅ Search and filter functionality
- ✅ Category and tag organization

---

## 🗂️ Files Created

### Backend Files:

1. **`server/models/Sheet.js`** - Database model for sheets
   - Stores sheet metadata (name, URL, type, etc.)
   - Access control methods
   - Sharing functionality

2. **`server/routes/sheetRoutes.js`** - API routes for sheet management
   - CRUD operations
   - Sharing endpoints
   - Access filtering

3. **`server/app.js`** - Updated to include sheet routes
   - Added `const sheetRoutes = require("./routes/sheetRoutes");`
   - Added `app.use("/api/sheets", sheetRoutes);`

### Frontend Files:

1. **`client/src/pages/SheetManagerPage.jsx`** - Main sheet management page
   - List all sheets
   - Add/Edit/Delete sheets
   - Open sheets in viewer
   - Share sheets (super-admin only)

2. **`client/src/components/sheets/SheetViewer.jsx`** - Sheet embedding component
   - Full-screen iframe viewer
   - Real-time editing
   - Updates last accessed info

3. **`client/src/components/sheets/ShareSheetModal.jsx`** - Sheet sharing modal
   - Share with specific users
   - Share with roles (admin, hr, employee)
   - Remove sharing

4. **`client/src/App.jsx`** - Updated to include sheet routes
   - Added import for SheetManagerPage
   - Added route `/sheets`

---

## 🚀 Deployment Steps

### 1. Backend Deployment

```bash
# Navigate to server directory
cd server

# Install dependencies (if any new ones were added)
npm install

# Restart the server
npm run dev
```

### 2. Frontend Deployment

```bash
# Navigate to client directory
cd client

# Build the frontend
npm run build

# Deploy to S3 or your hosting platform
```

### 3. Test the API Endpoints

```bash
# Test getting sheets (requires authentication)
curl -X GET http://localhost:5000/api/sheets \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# Test adding a sheet (super-admin only)
curl -X POST http://localhost:5000/api/sheets \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Sheet",
    "originalUrl": "https://docs.google.com/spreadsheets/d/SHEET_ID/edit",
    "description": "Test description"
  }'
```

---

## 🔐 Permissions & Access Control

### Role-Based Access:

| Action | Super-Admin | Admin | HR | Employee |
|--------|------------|-------|----|----|
| **See in Sidebar** | ✅ Sheet Manager | ✅ Sheet Manager | ✅ Shared Sheets | ✅ Shared Sheets |
| **View sheets** | All sheets | Shared with them | Shared with them | Shared with them |
| **Add sheets** | ✅ | ✅ | ❌ | ❌ |
| **Edit sheets** | Own + All | Own sheets | ❌ | ❌ |
| **Delete sheets** | Own + All | Own sheets | ❌ | ❌ |
| **Share sheets** | ✅ | ❌ | ❌ | ❌ |
| **Edit sheet content** | ✅ (if Google permissions) | ✅ (if Google permissions) | ✅ (if Google permissions) | ✅ (if Google permissions) |

### Sharing Options:

1. **Share with Specific Users**
   - Select individual users to grant access
   - Users can view and edit the sheet

2. **Share with Roles**
   - Share with all users of a specific role
   - Options: Admin, HR, Employee

---

## 📋 How to Use

### For Super-Admins:

#### Adding a New Sheet:

1. Navigate to `/sheets` in your CRM
2. Click "Add Sheet" button
3. Fill in the form:
   - **Sheet Name** (required)
   - **Sheet URL** (required) - Google Sheets or Excel Online link
   - **Description** (optional)
   - **Category** (optional)
   - **Tags** (optional, comma-separated)
4. Click "Add Sheet"

**Important:** Make sure the sheet URL has "Anyone with the link can edit" permissions!

#### Sharing a Sheet:

1. Find the sheet you want to share
2. Click the "Share" button (purple icon)
3. Select users or roles to share with:
   - **Share with Roles:** Click on Admin, HR, or Employee
   - **Share with Users:** Search and select specific users
4. Click "Share Sheet"

### For Employees & HR:

#### Viewing Shared Sheets:

1. Click "Shared Sheets" in the sidebar
2. You'll see only sheets that have been shared with you:
   - Sheets shared with you specifically
   - Sheets shared with your role (Employee/HR)
3. You **cannot**:
   - Add new sheets
   - Delete sheets
   - Share sheets with others
4. You **can**:
   - View all shared sheets
   - Open and edit sheet content (if Google permissions allow)
   - Search and filter sheets

#### Editing a Sheet:

1. Find the sheet in your "Shared Sheets" list
2. Click "Open" button
3. Edit directly in the embedded view
4. All changes are automatically saved to the original sheet

### For Admins:

#### Managing Your Sheets:

1. Click "Sheet Manager" in the sidebar
2. You can:
   - Add new sheets
   - Edit/Delete your own sheets
   - View sheets shared with you
3. You **cannot**:
   - Share sheets with others (only super-admin can share)
   - Edit/Delete sheets created by others

### For Super-Admins:

#### Full Sheet Management:

1. Click "Sheet Manager" in the sidebar
2. You have full control:
   - Add new sheets
   - Edit/Delete any sheet
   - Share sheets with users or roles
   - View all sheets in the system

#### Using Search & Filters:

- **Search:** Type in the search box to find sheets by name, description, or tags
- **Filter by Type:** Select "Google Sheets" or "Excel Online" from dropdown
- **Filter by Category:** (if categories are used)

---

## 🔗 URL Handling

### Google Sheets:

**Original URL:**
```
https://docs.google.com/spreadsheets/d/1ABC123XYZ/edit#gid=0
```

**Converted to Embed URL (FULL EDIT MODE):**
```
https://docs.google.com/spreadsheets/d/1ABC123XYZ/edit?embedded=true
```

> **Note:** We removed `rm=minimal` to enable full editing capabilities including:
> - Add/remove rows and columns
> - Cell formatting (colors, fonts, borders)
> - Formulas and functions
> - Copy/paste with formatting
> - Charts and images
> - Comments and notes
> - All Google Sheets features!

### Excel Online:

**Original URL:**
```
https://onedrive.live.com/edit.aspx?resid=ABC&cid=XYZ
```

**Converted to Embed URL (EDIT MODE):**
```
https://onedrive.live.com/edit?resid=ABC&cid=XYZ&action=edit
```

> **Note:** Excel Online embed URLs are converted to `/edit` mode for full editing

---

## 🎯 API Endpoints Reference

### Base URL: `/api/sheets`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| **GET** | `/` | All authenticated | Get all accessible sheets |
| **GET** | `/:id` | All authenticated | Get single sheet (updates last accessed) |
| **POST** | `/` | Super-admin, Admin | Add new sheet |
| **PUT** | `/:id` | Owner, Super-admin | Update sheet metadata |
| **DELETE** | `/:id` | Owner, Super-admin | Delete sheet (soft delete) |
| **POST** | `/:id/share` | Super-admin | Share sheet with users/roles |
| **DELETE** | `/:id/share` | Super-admin | Remove sharing |
| **GET** | `/stats/summary` | Super-admin | Get sheet statistics |

### Query Parameters (GET `/`):

- `category` - Filter by category
- `type` - Filter by type (google or excel)
- `search` - Search by name, description, or tags

---

## 🛡️ Security Considerations

### iframe Sandboxing:

The `SheetViewer.jsx` component uses iframe with specific sandbox attributes:

```jsx
<iframe
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
  allow="clipboard-read; clipboard-write"
/>
```

This allows:
- ✅ Same-origin requests (for Google/Microsoft auth)
- ✅ JavaScript execution (for sheet functionality)
- ✅ Forms (for editing)
- ✅ Popups (for sharing dialogs)
- ✅ Clipboard access (for copy/paste)

### Access Control:

- All API endpoints require authentication (`protect` middleware)
- Sheet access is validated on every request
- Super-admin has full access to all sheets
- Users only see sheets they own or that are shared with them

---

## 🔧 Troubleshooting

### Issue: Sheet doesn't load in iframe

**Solution:**
1. Check if the sheet URL has proper sharing permissions
2. Ensure the URL is public with "Anyone with the link can edit"
3. For Google Sheets, verify the sheet isn't restricted to specific domains

### Issue: Changes not reflecting in original sheet

**Solution:**
- This is impossible! The iframe directly loads the original sheet
- All edits are made directly to the Google/Excel sheet
- No sync is needed - it's real-time by nature
- The embed URL uses `/edit` mode specifically for full editing capabilities

### Issue: Can't edit the sheet, only view it

**Solution:**
1. Make sure the Google Sheet has "Anyone with the link can edit" permissions
2. The embed URL should contain `/edit?embedded=true` (not `/view`)
3. Check that you're signed into your Google account in the same browser
4. The iframe sandbox must include: `allow-same-origin allow-scripts allow-forms allow-modals`

### Issue: User can't see shared sheets

**Solution:**
1. Verify the user is logged in
2. Check if the sheet is shared with their user ID or role
3. Check if `isActive` is true on the sheet
4. Verify the API endpoint is returning the sheet in the response

### Issue: "Access denied" error

**Solution:**
1. Check user role permissions
2. Verify JWT token is valid and not expired
3. Ensure the user has proper access (owner, shared, or super-admin)

---

## 📊 Database Schema

### Sheet Model:

```javascript
{
  name: String,                    // Sheet name
  description: String,             // Optional description
  originalUrl: String,             // Original sheet URL
  embedUrl: String,                // Converted embed URL
  type: "google" | "excel",        // Sheet type
  addedBy: ObjectId (User),        // Who added it
  sharedWith: [{                   // Specific users
    user: ObjectId (User),
    sharedAt: Date,
    sharedBy: ObjectId (User)
  }],
  sharedWithRoles: [{              // Role-based sharing
    role: String,
    sharedAt: Date,
    sharedBy: ObjectId (User)
  }],
  category: String,                // Optional category
  tags: [String],                  // Optional tags
  isActive: Boolean,               // Soft delete flag
  lastAccessedAt: Date,            // Last view timestamp
  lastAccessedBy: ObjectId (User), // Last viewer
  createdAt: Date,                 // Auto-generated
  updatedAt: Date                  // Auto-generated
}
```

---

## 🎨 UI/UX Features

### Sheet Manager Page:

- 📱 Fully responsive design
- 🔍 Real-time search and filtering
- 🎨 Beautiful card-based layout
- 🏷️ Tag and category support
- 📅 Shows creation date and last access
- 👥 Indicates shared status

### Sheet Viewer:

- 🖥️ Full-screen immersive experience
- ⚡ Instant loading
- 🔗 Direct link to open in native app
- 📊 Shows sheet metadata
- 🔄 Real-time editing (no save button needed!)

### Share Modal:

- 👥 Visual user selection
- 🎭 Role-based sharing
- ✅ Shows current sharing status
- 🔍 User search functionality

---

## 🚦 Next Steps / Enhancements

### Potential Future Features:

1. **Sheet Templates**
   - Pre-built templates for common use cases
   - Clone/duplicate functionality

2. **Version History**
   - Track when sheets were accessed
   - Who made changes (via sheet's native history)

3. **Notifications**
   - Notify users when a sheet is shared with them
   - Email/in-app notifications

4. **Analytics**
   - Track sheet usage
   - Most viewed sheets
   - Active users

5. **Bulk Operations**
   - Share multiple sheets at once
   - Bulk delete/archive

6. **Comments/Notes**
   - Add CRM-specific notes to sheets
   - Internal comments visible only in CRM

---

## ✅ Testing Checklist

### Backend Testing:

- [ ] Can add a Google Sheets link
- [ ] Can add an Excel Online link
- [ ] URL correctly converts to embed format
- [ ] Super-admin can see all sheets
- [ ] Regular users only see their accessible sheets
- [ ] Sharing works with specific users
- [ ] Sharing works with roles
- [ ] Can remove sharing
- [ ] Soft delete works (isActive = false)
- [ ] Last accessed info updates correctly

### Frontend Testing:

- [ ] Sheet list loads correctly
- [ ] Search functionality works
- [ ] Type filter works (google/excel)
- [ ] Add sheet modal works
- [ ] Edit sheet modal works
- [ ] Sheet viewer opens and displays sheet
- [ ] Can edit sheet directly in viewer
- [ ] Share modal opens and functions
- [ ] Role selection works
- [ ] User selection works
- [ ] Delete confirmation works
- [ ] Notifications display correctly

### Cross-Browser Testing:

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## 📞 Support

If you encounter any issues:

1. Check the browser console for errors
2. Verify backend logs for API errors
3. Ensure all environment variables are set
4. Check that MongoDB is running
5. Verify user authentication tokens

---

## 🎉 Conclusion

You now have a fully functional sheet management system integrated into your CRM! Users can:

- ✅ Embed Google Sheets and Excel Online
- ✅ Edit sheets directly in the CRM
- ✅ Share sheets with team members
- ✅ Organize sheets with categories and tags
- ✅ Search and filter sheets easily

All with real-time sync and no data duplication!

**Happy sheet managing! 🚀📊**
