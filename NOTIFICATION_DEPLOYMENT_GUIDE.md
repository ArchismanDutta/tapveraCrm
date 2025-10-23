# Notification System - Complete Deployment Guide

**Date:** 2025-10-21
**Project:** TapveraCRM
**Status:** ✅ **Production Ready** (After SSL setup)

---

## 📋 Quick Start

### Local Development (No Changes Needed)

Your notification system is **ready to use** for local development:

```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Start client
cd client
npm run dev
```

✅ Notifications will work out of the box on `http://localhost:5173`

---

## 🚀 AWS Production Deployment

### Prerequisites

Before deploying, ensure you have:

- [x] AWS Elastic Beanstalk environment configured
- [x] MongoDB Atlas or AWS DocumentDB connection
- [ ] **SSL Certificate** (REQUIRED for wss:// WebSocket)
- [ ] Domain name (optional but recommended)

---

## Step-by-Step AWS Deployment

### Step 1: Set Up SSL Certificate (Critical)

WebSocket Secure (wss://) requires HTTPS/SSL. Choose one option:

#### Option A: AWS Certificate Manager (Free, Recommended)

1. **Request Certificate:**
   ```
   AWS Console → Certificate Manager → Request Certificate
   - Domain: yourdomain.com
   - DNS validation (recommended)
   ```

2. **Validate Certificate:**
   - Add DNS CNAME record provided by ACM
   - Wait for validation (5-30 minutes)

3. **Add to Elastic Beanstalk:**
   ```
   EB Console → Your Environment → Configuration → Load Balancer
   - Add Listener: HTTPS (port 443)
   - Select your ACM certificate
   - Save & Apply
   ```

#### Option B: Use Elastic Beanstalk Default URL

If you don't have a custom domain, AWS provides HTTPS on their default URLs:

```
http://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
→ Available with HTTPS too:
https://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
```

**Just update your URLs to use `https://` and `wss://`**

---

### Step 2: Configure Environment Variables

#### Server Environment Variables (AWS EB Console)

Go to: **Configuration → Software → Environment Properties**

**Required Variables:**
```bash
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET=your_jwt_secret_here

# Frontend Configuration
FRONTEND_URL=https://yourdomain.com
FRONTEND_ORIGIN=https://yourdomain.com

# Email (if used)
EMAIL_USER=your_email@domain.com
EMAIL_PASS=your_email_password

# WhatsApp (if used)
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
```

**Important:** Update `FRONTEND_URL` to match your actual frontend URL!

---

#### Client Environment Variables

**Option 1: Use .env.production (Recommended)**

1. Copy the example:
   ```bash
   cd client
   cp .env.production.example .env.production
   ```

2. Edit `.env.production`:
   ```bash
   # For custom domain
   VITE_API_BASE=https://api.yourdomain.com
   VITE_WS_BASE=wss://api.yourdomain.com

   # OR for Elastic Beanstalk URL
   VITE_API_BASE=https://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
   VITE_WS_BASE=wss://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
   ```

3. Build will automatically use `.env.production`:
   ```bash
   npm run build
   ```

**Option 2: Manual .env Editing**

Edit `client/.env` and uncomment AWS lines:
```bash
# LOCAL DEVELOPMENT (Commented for production)
# VITE_API_BASE=http://localhost:5000
# VITE_WS_BASE=ws://localhost:5000

# AWS PRODUCTION (Active)
VITE_API_BASE=https://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
VITE_WS_BASE=wss://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
```

---

### Step 3: Verify AWS WebSocket Configuration

Check that `server/.ebextensions/websocket.config` exists (it should):

```bash
ls server/.ebextensions/websocket.config
# Should show: websocket.config exists ✅
```

This file configures nginx to properly handle WebSocket connections. **No changes needed.**

---

### Step 4: Build Frontend

```bash
cd client
npm run build
```

This creates `client/dist/` with production-optimized files.

**Verify build:**
```bash
ls -lh dist/
# Should show: index.html, assets folder
```

---

### Step 5: Deploy to AWS

#### Option A: Serve Frontend from Backend (Current Setup)

This is the **easiest method** for initial deployment.

1. **Copy frontend build to server:**
   ```bash
   # From project root
   mkdir -p server/client/build
   cp -r client/dist/* server/client/build/
   ```

2. **Verify server will serve it:**
   The server is already configured (in `server/app.js:135-140`):
   ```javascript
   if (process.env.NODE_ENV === "production") {
     app.use(express.static(path.join(__dirname, "client", "build")));
     app.get("*", (req, res) =>
       res.sendFile(path.join(__dirname, "client", "build", "index.html"))
     );
   }
   ```

3. **Deploy server (includes frontend):**
   ```bash
   cd server
   eb deploy
   ```

4. **Wait for deployment:**
   ```bash
   eb status
   # Wait until "Health: Green" and "Status: Ready"
   ```

5. **Access application:**
   ```
   https://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
   ```

---

#### Option B: Separate Frontend Deployment (Recommended for Scale)

Deploy frontend to AWS S3 + CloudFront for better performance:

**Benefits:**
- Faster loading (CDN)
- Better caching
- Independent scaling
- Lower costs

**Steps:**

1. **Create S3 Bucket:**
   ```
   AWS Console → S3 → Create Bucket
   - Name: your-crm-frontend
   - Region: ap-south-1 (same as backend)
   - Uncheck "Block all public access"
   ```

2. **Enable Static Website Hosting:**
   ```
   Bucket → Properties → Static Website Hosting
   - Enable
   - Index: index.html
   - Error: index.html (for SPA routing)
   ```

3. **Add Bucket Policy:**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-crm-frontend/*"
       }
     ]
   }
   ```

4. **Upload Build:**
   ```bash
   cd client
   aws s3 sync dist/ s3://your-crm-frontend/
   ```

5. **Access:**
   ```
   http://your-crm-frontend.s3-website.ap-south-1.amazonaws.com
   ```

6. **Optional: Add CloudFront for HTTPS and CDN**

---

### Step 6: Test Deployment

After deployment, test all notification types:

#### 1. Test WebSocket Connection

1. Open deployed application
2. Open DevTools → Console
3. Login
4. Should see: `"WebSocket connected"`
5. Check Network tab → WS filter
6. Should see: Connection to `wss://...` with status "101"

**If connection fails:**
- Verify SSL certificate is installed
- Check `VITE_WS_BASE` uses `wss://` not `ws://`
- Check `.ebextensions/websocket.config` exists
- Check EB logs: `eb logs`

---

#### 2. Test Task Notifications

1. Login as employee (e.g., test@example.com)
2. Allow browser notifications when prompted
3. In another browser/incognito, login as admin
4. Create a task assigned to the employee
5. **Expected on employee browser:**
   - ✅ PC notification appears
   - ✅ Sound plays
   - ✅ In-app toast shows
   - ✅ Notification bell updates

---

#### 3. Test Payslip Notifications

1. Login as employee
2. Have admin generate payslip for this employee
3. **Expected:**
   - ✅ Toast notification with salary amount
   - ✅ Sound plays
   - ✅ "View Payslip" button works

---

#### 4. Test Chat Notifications

1. Login as User A
2. Have User B send a message
3. **Expected:**
   - ✅ PC notification with message preview
   - ✅ Sound plays
   - ✅ Unread counter updates

---

### Step 7: Monitor and Debug

#### Check Application Logs

```bash
cd server
eb logs

# Or live logs
eb logs --stream
```

#### Check for WebSocket Errors

Look for:
- ❌ "WebSocket connection failed"
- ❌ "CORS error"
- ❌ "401 Unauthorized"

**Common solutions:**
- Verify JWT_SECRET matches
- Check FRONTEND_ORIGIN includes your frontend URL
- Ensure SSL certificate is active

---

#### Health Check

```bash
# Check server health
curl https://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com/

# Should return:
{
  "status": "ok",
  "message": "Your server is up and running",
  "timestamp": 1234567890
}
```

---

## 🔍 Troubleshooting

### Issue: "WebSocket connection failed"

**Possible Causes:**
1. SSL not configured (using wss:// without HTTPS)
2. Wrong WebSocket URL
3. nginx not configured for WebSocket

**Solutions:**
```bash
# 1. Verify SSL certificate
eb console
# → Configuration → Load Balancer → Listeners
# Should show HTTPS:443 with certificate

# 2. Check VITE_WS_BASE
# Should be: wss://your-domain.com (not ws://)

# 3. Verify websocket.config
ls server/.ebextensions/websocket.config
# Should exist ✅
```

---

### Issue: "Notifications not showing"

**Possible Causes:**
1. Browser notification permission denied
2. User not authenticated
3. WebSocket not connected

**Solutions:**
```javascript
// Check permission
console.log(Notification.permission); // Should be "granted"

// Check WebSocket
console.log("WS State:", wsRef.current?.readyState);
// Should be 1 (OPEN)

// Check token
console.log("Token:", localStorage.getItem("token"));
// Should exist
```

---

### Issue: "CORS Error"

**Possible Causes:**
1. FRONTEND_ORIGIN not set
2. Wrong frontend URL

**Solutions:**
```bash
# In AWS EB Console → Configuration → Software → Environment Properties
# Add/Update:
FRONTEND_ORIGIN=https://your-frontend-domain.com
FRONTEND_URL=https://your-frontend-domain.com

# Then restart:
eb restart
```

---

### Issue: "502 Bad Gateway"

**Possible Causes:**
1. Server crashed
2. Database connection failed
3. Environment variables missing

**Solutions:**
```bash
# Check logs
eb logs

# Common fixes:
# - Verify MONGODB_URI is correct
# - Verify JWT_SECRET is set
# - Check node version matches (eb setenv NODE_VERSION=18.x)
# - Redeploy: eb deploy
```

---

## 📊 Performance Optimization

### For Better Performance:

1. **Enable Gzip Compression** (Already configured in nginx)
2. **Use CloudFront** for frontend (if using S3)
3. **Enable Auto-Scaling** in Elastic Beanstalk
4. **Monitor with CloudWatch**
5. **Consider Redis** for session management at scale

---

## 🔒 Security Best Practices

### ✅ Already Implemented:

- JWT authentication for WebSocket
- CORS configuration
- Environment variable protection

### 🔐 Additional Recommendations:

1. **Enable Web Application Firewall (WAF)**
2. **Use Secrets Manager** for sensitive environment variables
3. **Enable CloudTrail** for audit logging
4. **Implement rate limiting** for API endpoints
5. **Regular security updates:**
   ```bash
   npm audit fix
   npm update
   ```

---

## 📈 Scaling Considerations

### When to Scale:

- **Concurrent Users > 500:** Enable auto-scaling
- **WebSocket Connections > 1000:** Consider separate WebSocket server
- **Database Load High:** Use MongoDB Atlas cluster
- **High Traffic:** Add CloudFront CDN

### How to Scale:

1. **Auto-Scaling Configuration:**
   ```
   EB Console → Configuration → Capacity
   - Min instances: 2
   - Max instances: 10
   - Scaling trigger: Network Out > 6 MB
   ```

2. **Separate WebSocket Server:**
   - Create dedicated EB environment for WebSocket
   - Use Redis for pub/sub between instances
   - Update VITE_WS_BASE to WebSocket server URL

---

## ✅ Deployment Checklist

Use this checklist before deploying to production:

### Pre-Deployment

- [ ] SSL certificate configured on AWS
- [ ] Environment variables set (server)
- [ ] `.env.production` configured (client)
- [ ] Frontend built (`npm run build`)
- [ ] Server tests passing
- [ ] Database connection verified

### Deployment

- [ ] Frontend copied to server/client/build
- [ ] Deployed to EB (`eb deploy`)
- [ ] Deployment successful (status green)
- [ ] Application accessible via HTTPS

### Post-Deployment Testing

- [ ] WebSocket connects (wss://)
- [ ] Login working
- [ ] Task notifications working
- [ ] Payslip notifications working
- [ ] Chat notifications working
- [ ] Browser notifications permission working
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Performance acceptable (< 3s load time)

### Monitoring

- [ ] Set up CloudWatch alarms
- [ ] Configure log monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Monitor WebSocket connection stability

---

## 📚 Additional Resources

### Documentation

- [Notification System Analysis Report](./NOTIFICATION_SYSTEM_ANALYSIS_REPORT.md)
- [Notification System Fixes](./NOTIFICATION_SYSTEM_FIXES.md)
- [AWS Deployment Guide](./AWS_DEPLOYMENT_GUIDE.md)

### AWS Documentation

- [Elastic Beanstalk Documentation](https://docs.aws.amazon.com/elasticbeanstalk/)
- [Certificate Manager](https://docs.aws.amazon.com/acm/)
- [S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)

### Troubleshooting Resources

- [WebSocket Testing Tool](https://www.websocket.org/echo.html)
- [Elastic Beanstalk Troubleshooting](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/troubleshooting.html)

---

## 🎉 Success!

If you've followed this guide, your notification system should now be:

- ✅ **Working on local development**
- ✅ **Deployed to AWS with SSL**
- ✅ **Sending real-time notifications**
- ✅ **Secure (wss:// with HTTPS)**
- ✅ **Monitored and scalable**

**Questions or issues?** Check the troubleshooting section or review the analysis report.

---

**Last Updated:** 2025-10-21
**Deployment Status:** ✅ **Production Ready**

