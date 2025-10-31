# 🚀 Quick Deployment Reference

## Problem: Deployment Timing Out After 14-15 Minutes

## Root Cause:
Email service initialization was **blocking** `server.listen()`, preventing AWS health checks from succeeding.

## Solution Applied:
Moved email service init to run **after** server starts (non-blocking).

---

## Deploy Now:

```bash
# 1. Commit changes
git add .
git commit -m "Fix: Email service blocking server startup"
git push

# 2. Deploy
cd server
eb deploy

# 3. Monitor
eb logs --stream
```

---

## Expected Timeline:
- ⏱️ **Before**: 14-15 min → Timeout ❌
- ⏱️ **After**: 2-3 min → Success ✅

---

## Success Indicators:
```
✅ 🚀 Server running on port 5000
✅ ✅ Connected to MongoDB
✅ Environment health: GREEN
✅ Deployment completed
```

---

## If Still Failing:

### 1. Check MongoDB Connection
```bash
# In AWS Console, verify:
MONGODB_URI=mongodb+srv://sam_db_user:sam_db_user_password@cluster0.0rzvp7j.mongodb.net/
```

### 2. Check Logs
```bash
eb logs
# Look for: "MONGODB_URI not set" or connection errors
```

### 3. Verify AWS Environment Variables
All these must be set in AWS EB Console:
- `PORT=5000`
- `NODE_ENV=production`
- `MONGODB_URI=...`
- `JWT_SECRET=...`
- `FRONTEND_ORIGIN=...`

---

## Files Changed:
1. ✅ `server/app.js` - Email service moved to background
2. ✅ `server/.ebextensions/websocket.config` - Restored to working config
3. ✅ `client/src/pages/TodayStatusPage.jsx` - Fixed React hooks
4. ✅ `client/src/components/payment/PaymentBlockOverlay.jsx` - Fixed API URL

---

## Post-Deployment:
1. Re-enable payment routes (currently commented out)
2. Test all endpoints
3. Verify WebSocket connections

---

## Emergency Rollback:
```bash
eb deploy --version <previous-version-label>
```

Find previous version:
```bash
eb appversion lifecycle
```
