# LocalStorage to SecureStorage Migration Guide

## Quick Start

Replace all token storage with the new secure implementation:

```javascript
import secureStorage from './utils/secureStorage';
```

---

## Migration Examples

### 1. Login Page (PRIORITY 1)

**File**: `client/src/pages/LoginPage.jsx`

**Before** (Line 51):
```javascript
localStorage.setItem("token", data.token);
```

**After**:
```javascript
import secureStorage from '../utils/secureStorage';

// In handleSubmit function:
const rememberMe = false; // Get from checkbox if you have one
secureStorage.setToken(data.token, rememberMe);

// Optional: Store user data (non-sensitive)
secureStorage.setUserData(data.user);
```

---

### 2. Service Files (API Calls)

**Files**:
- `client/src/services/newAttendanceService.js`
- `client/src/services/projectService.js`
- `client/src/services/aiAnalyticsService.js`

**Before**:
```javascript
getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}
```

**After**:
```javascript
import secureStorage from '../utils/secureStorage';

getAuthHeaders() {
  const token = secureStorage.getToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}
```

---

### 3. App Component (Auth Check)

**File**: `client/src/App.jsx`

**Before**:
```javascript
const token = localStorage.getItem("token");
if (!token) {
  navigate('/login');
}
```

**After**:
```javascript
import secureStorage from './utils/secureStorage';

if (!secureStorage.hasValidToken()) {
  navigate('/login');
}

// Or get the token directly:
const token = secureStorage.getToken();
if (!token) {
  navigate('/login');
}
```

---

### 4. Logout Functionality

**File**: `client/src/components/dashboard/Sidebar.jsx`

**Before**:
```javascript
const handleLogout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  navigate("/login");
};
```

**After**:
```javascript
import secureStorage from '../../utils/secureStorage';

const handleLogout = () => {
  secureStorage.clearAll(); // Clears token AND user data
  navigate("/login");
};
```

---

### 5. Protected Routes

**Before**:
```javascript
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" />;
};
```

**After**:
```javascript
import secureStorage from './utils/secureStorage';

const ProtectedRoute = ({ children }) => {
  return secureStorage.hasValidToken() ? children : <Navigate to="/login" />;
};
```

---

## API Reference

### Core Methods

```javascript
// Set token (sessionStorage - default)
secureStorage.setToken(token);

// Set token with "Remember Me" (encrypted localStorage)
secureStorage.setToken(token, true);

// Get token (returns null if expired/invalid)
const token = secureStorage.getToken();

// Check if valid token exists
if (secureStorage.hasValidToken()) {
  // User is authenticated
}

// Clear token only
secureStorage.clearToken();

// Clear everything (logout)
secureStorage.clearAll();
```

### User Data Methods

```javascript
// Store user data (non-sensitive only)
secureStorage.setUserData({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role
  // NO passwords, tokens, or secrets!
});

// Get user data
const userData = secureStorage.getUserData();

// Clear user data
secureStorage.clearUserData();
```

### Advanced Methods

```javascript
// Get token expiration time (in minutes)
const minutesLeft = secureStorage.getTokenTimeRemaining();
console.log(`Token expires in ${minutesLeft} minutes`);

// Refresh token expiration (extend by 8 hours)
secureStorage.refreshTokenExpiration();
```

---

## Files to Update (20 files found)

Priority order for migration:

### HIGH PRIORITY (Auth-related):
1. ✅ `client/src/pages/LoginPage.jsx` - Store token on login
2. ✅ `client/src/App.jsx` - Auth validation
3. ✅ `client/src/components/dashboard/Sidebar.jsx` - Logout
4. ✅ `client/src/services/newAttendanceService.js` - API calls
5. ✅ `client/src/services/projectService.js` - API calls
6. ✅ `client/src/services/aiAnalyticsService.js` - API calls

### MEDIUM PRIORITY (Pages):
7. `client/src/pages/TodayStatusPage.jsx`
8. `client/src/pages/ProjectDetailPage.jsx`
9. `client/src/pages/ClientPortal.jsx`
10. `client/src/pages/EmployeePortal.jsx`
11. `client/src/pages/EmployeeDirectory.jsx`
12. `client/src/pages/AdminTaskPage.jsx`
13. `client/src/pages/Tasks.jsx`
14. `client/src/pages/ChatPage.jsx`

### LOW PRIORITY (Components):
15. `client/src/components/project/OnPageSEO.jsx`
16. `client/src/components/project/OffPageSEO.jsx`
17. `client/src/components/project/BlogUpdates.jsx`
18. `client/src/components/admintask/TaskTable.jsx`
19. `client/src/components/admintask/TaskRow.jsx`
20. `client/src/components/message/UnreadMessageBadge.jsx`

---

## Testing After Migration

After updating each file, test:

1. **Login Flow**:
   - Login successfully
   - Check browser DevTools → Application → Session Storage
   - Should see `auth_token` in sessionStorage (NOT localStorage)

2. **API Calls**:
   - Make authenticated requests
   - Check Network tab for Authorization header
   - Should include `Bearer <token>`

3. **Logout**:
   - Click logout
   - Check Session Storage should be cleared
   - Should redirect to login

4. **Token Expiration**:
   - Wait 8 hours (or modify TOKEN_EXPIRATION in secureStorage.js for testing)
   - Token should auto-expire
   - Should redirect to login

5. **Remember Me** (if implemented):
   - Login with "Remember Me" checked
   - Close browser completely
   - Reopen browser
   - Should still be logged in (token in encrypted localStorage)

---

## Security Improvements

| Feature | Before | After |
|---------|--------|-------|
| Storage Type | localStorage (persistent) | sessionStorage (default) |
| Expiration | None ❌ | 8 hours ✅ |
| Validation | None ❌ | JWT format check ✅ |
| Encryption | None ❌ | Optional XOR encryption ✅ |
| Auto-cleanup | None ❌ | On expiration ✅ |
| XSS Protection | Vulnerable ❌ | Reduced surface ✅ |

---

## Common Pitfalls

### ❌ DON'T:
```javascript
// Don't store sensitive data in user data
secureStorage.setUserData({
  password: "secret123", // NEVER!
  token: "jwt...",       // NEVER!
  creditCard: "1234"     // NEVER!
});

// Don't bypass secureStorage
localStorage.setItem("token", token); // Use secureStorage instead!
```

### ✅ DO:
```javascript
// Only store non-sensitive user info
secureStorage.setUserData({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar
});

// Always use secureStorage for tokens
secureStorage.setToken(token);
```

---

## Rollback Plan

If issues occur after migration, you can temporarily rollback:

1. Comment out secureStorage import
2. Restore original localStorage code
3. Report the issue
4. Fix and re-apply

**However**: The security improvements are critical, so rollback should only be temporary during debugging.

---

## Additional Resources

- **Implementation**: `client/src/utils/secureStorage.js`
- **Security Report**: `SECURITY_FIXES_APPLIED.md`
- **Full Audit**: See comprehensive audit report

---

**Last Updated**: 2025-01-20
