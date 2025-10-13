# AWS Deployment Guide - WebSocket & Real-Time Notifications

## Current AWS Setup

**Backend URL**: `http://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com`
**Platform**: AWS Elastic Beanstalk
**Region**: ap-south-1 (Mumbai)

---

## Deploy to AWS (Step-by-Step)

### 1. Update Client Environment Variables

**For Production Build:**

Edit `client/.env`:

```bash
# ========================================
# PRODUCTION (AWS Elastic Beanstalk)
# ========================================
VITE_API_BASE=http://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
VITE_WS_BASE=ws://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com

# ========================================
# LOCAL DEVELOPMENT (Comment out for production)
# ========================================
# VITE_API_BASE=http://localhost:5000
# VITE_WS_BASE=ws://localhost:5000
```

**Important Notes:**
- ✅ Removed `/ws` from `VITE_WS_BASE` (WebSocket connects at root, not /ws)
- ⚠️ Using `ws://` (not secure) - see SSL section below for `wss://` upgrade
- The `useWebSocket.js` hook automatically removes `/ws` if present, but it's cleaner without it

---

### 2. Update Server Environment Variables

**On AWS Elastic Beanstalk Console:**

Go to: **Configuration** → **Software** → **Environment Properties**

Add/Update:
```bash
FRONTEND_URL=http://your-frontend-domain.com
FRONTEND_ORIGIN=http://your-frontend-domain.com
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
# ... other variables
```

**Important**: Update `FRONTEND_URL` to match your actual frontend domain!

---

### 3. Build Frontend for Production

```bash
cd client
npm run build
```

This creates `client/dist/` folder with optimized production files.

---

### 4. Deploy Backend to AWS

**Option A: Using EB CLI**
```bash
cd server
eb deploy
```

**Option B: Using AWS Console**
1. Zip your `server/` folder (exclude node_modules)
2. Go to Elastic Beanstalk Console
3. Click **Upload and Deploy**
4. Upload the zip file
5. Wait for deployment to complete

---

### 5. Deploy Frontend

**Option A: Serve from Backend (Current Setup)**

The backend is already configured to serve the frontend in production mode:

```javascript
// server/app.js:126-131
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "client", "build")));
  app.get("*", (req, res) =>
    res.sendFile(path.join(__dirname, "client", "build", "index.html"))
  );
}
```

**Steps:**
1. Copy `client/dist/*` to `server/client/build/`
2. Deploy server (includes frontend)

```bash
# On your local machine
cd client
npm run build
mkdir -p ../server/client/build
cp -r dist/* ../server/client/build/
cd ../server
eb deploy
```

**Option B: Separate Frontend Deployment (Recommended)**

Deploy frontend to S3 + CloudFront or Vercel:
- Faster loading
- Better caching
- Separate scaling

---

## WebSocket Configuration for AWS

### Issue: WebSocket Connection Fails on AWS

**Symptoms:**
- WebSocket connects locally ✅
- WebSocket fails on AWS ❌
- Console shows: "WebSocket connection failed"

**Root Cause:**

AWS Elastic Beanstalk needs special configuration for WebSocket support.

---

### Solution 1: Enable WebSocket in Elastic Beanstalk

**Create `.ebextensions/websocket.config` in server folder:**

```yaml
# server/.ebextensions/websocket.config

option_settings:
  aws:elasticbeanstalk:environment:proxy:
    ProxyServer: nginx

files:
  "/etc/nginx/conf.d/websocket.conf":
    mode: "000644"
    owner: root
    group: root
    content: |
      upstream nodejs {
        server 127.0.0.1:5000;
        keepalive 256;
      }

      server {
        listen 80;

        location / {
          proxy_pass http://nodejs;
          proxy_http_version 1.1;

          # WebSocket support
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";

          # Standard proxy headers
          proxy_set_header Host $host;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;

          # Timeouts for WebSocket
          proxy_connect_timeout 7d;
          proxy_send_timeout 7d;
          proxy_read_timeout 7d;
        }
      }

container_commands:
  01_reload_nginx:
    command: "sudo service nginx reload"
```

**Deploy:**
```bash
cd server
eb deploy
```

---

### Solution 2: Use Application Load Balancer (Recommended)

If using ALB (not Classic Load Balancer):

1. **Go to EC2 Console** → **Load Balancers**
2. Select your ALB
3. **Edit Attributes**
4. Enable **Sticky Sessions** (helps with WebSocket)
5. **Edit Target Group**
6. Set **Health Check Path**: `/` (or `/health`)
7. Set **Deregistration Delay**: 30 seconds

**Add Listener Rule:**
- Protocol: HTTP
- Port: 80
- Path pattern: `/*`
- Target group: Your Elastic Beanstalk environment

---

## Enable SSL/TLS (HTTPS + WSS)

WebSockets over SSL (`wss://`) are more secure and required for HTTPS sites.

### Step 1: Get SSL Certificate

**Option A: AWS Certificate Manager (Free)**
1. Go to **AWS Certificate Manager**
2. **Request a certificate**
3. Add your domain: `crm.yourdomain.com`
4. Validate via DNS or Email
5. Wait for certificate to be issued

**Option B: Let's Encrypt** (if using custom server)

---

### Step 2: Configure SSL in Elastic Beanstalk

1. Go to **Elastic Beanstalk Console**
2. Click **Configuration** → **Load Balancer**
3. **Add Listener**:
   - Protocol: HTTPS
   - Port: 443
   - SSL Certificate: Select from ACM
4. **Save** and apply changes

---

### Step 3: Update Frontend URLs

**Update `client/.env`:**

```bash
# PRODUCTION with SSL
VITE_API_BASE=https://crm-be.yourdomain.com
VITE_WS_BASE=wss://crm-be.yourdomain.com

# Or using Elastic Beanstalk URL with HTTPS
VITE_API_BASE=https://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
VITE_WS_BASE=wss://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
```

**Rebuild and redeploy frontend!**

---

## Testing WebSocket on AWS

### 1. Check WebSocket Connection

**Browser Console:**
```javascript
// Should see:
"WebSocket connected"
"User authenticated: [userId]"
```

**Server Logs (AWS Console):**
```
User authenticated: 12345
User connection established
```

---

### 2. Test Real-Time Messaging

1. Open app in **2 browser tabs** (different users)
2. User A sends message → User B sees it **instantly** ✅
3. Admin assigns task → Employee sees **PC notification** ✅

---

### 3. Troubleshooting WebSocket on AWS

**Issue: WebSocket connects then immediately disconnects**

**Check 1:** Load Balancer Timeout
```bash
# Increase idle timeout to 1 hour (3600 seconds)
aws elbv2 modify-target-group-attributes \
  --target-group-arn <your-target-group-arn> \
  --attributes Key=deregistration_delay.timeout_seconds,Value=3600
```

**Check 2:** Nginx Configuration
- Verify `.ebextensions/websocket.config` is deployed
- Check `/var/log/nginx/error.log` on EC2 instance

**Check 3:** CORS Settings
```javascript
// server/app.js - Ensure AWS domain is in CORS
const frontendOrigins = [
  process.env.FRONTEND_ORIGIN,
  "http://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com",
  "https://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com",
  // Add your custom domain here
];
```

**Check 4:** Security Group
- Go to **EC2** → **Security Groups**
- Ensure **Inbound Rules** allow:
  - HTTP (80)
  - HTTPS (443)
  - WebSocket uses same ports, no special port needed

---

## Environment Variables Checklist

### Server (.env)
```bash
✅ PORT=5000
✅ MONGODB_URI=mongodb+srv://...
✅ JWT_SECRET=your_secret
✅ FRONTEND_URL=http://your-frontend-domain.com
✅ FRONTEND_ORIGIN=http://your-frontend-domain.com
✅ NODE_ENV=production
```

### Client (.env)
```bash
✅ VITE_API_BASE=http://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
✅ VITE_WS_BASE=ws://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com
```

**With SSL:**
```bash
✅ VITE_API_BASE=https://crm-be.yourdomain.com
✅ VITE_WS_BASE=wss://crm-be.yourdomain.com
```

---

## Quick Deployment Commands

### Full Production Deployment

```bash
# 1. Update environment variables
# Edit client/.env (set production URLs)

# 2. Build frontend
cd client
npm run build

# 3. Copy to server (if serving from backend)
mkdir -p ../server/client/build
cp -r dist/* ../server/client/build/

# 4. Deploy to AWS
cd ../server
eb deploy

# 5. Monitor logs
eb logs --stream
```

---

## Common Issues & Solutions

### Issue 1: "WebSocket connection to 'ws://...' failed"

**Solution:**
- Check if `.ebextensions/websocket.config` exists
- Verify Load Balancer type (ALB, not Classic)
- Check Security Group allows HTTP/HTTPS

---

### Issue 2: WebSocket connects but messages don't arrive

**Solution:**
- Check server logs for errors
- Verify `users[userId]` array is populated
- Check MongoDB connection (messages must be saved first)

---

### Issue 3: Notifications work locally but not on AWS

**Solution:**
- Update `VITE_WS_BASE` to AWS URL
- Rebuild frontend: `npm run build`
- Clear browser cache
- Verify browser notification permission granted

---

### Issue 4: Mixed Content Error (HTTPS page loading WS)

**Error:** "Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://...'"

**Solution:**
- Use `wss://` instead of `ws://`
- Enable SSL certificate on AWS
- Update `VITE_WS_BASE=wss://...`

---

## Performance Optimization

### 1. Connection Pooling

Already implemented! Server now supports **multiple connections per user**:
- ✅ All 3 WebSocket hooks can coexist
- ✅ Messages broadcast to all user connections
- ✅ Proper connection cleanup on close

---

### 2. Message Compression

Add WebSocket compression in production:

```javascript
// server/app.js
const wss = new WebSocket.Server({
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});
```

---

### 3. Auto-Scaling

Configure Elastic Beanstalk Auto Scaling:
- Min instances: 1
- Max instances: 4 (or based on traffic)
- Scaling trigger: CPU > 70% for 5 minutes

**Note:** Sticky sessions required for WebSocket with multiple instances!

---

## Security Checklist

- [ ] Use `wss://` (secure WebSocket) in production
- [ ] Enable HTTPS with SSL certificate
- [ ] Validate JWT tokens on WebSocket authentication
- [ ] Set proper CORS origins (no wildcards)
- [ ] Enable rate limiting on WebSocket connections
- [ ] Monitor failed authentication attempts
- [ ] Set WebSocket timeout limits
- [ ] Use environment variables (never hardcode secrets)

---

## Monitoring & Logs

### View Server Logs
```bash
# Real-time logs
eb logs --stream

# Download recent logs
eb logs
```

### Key Log Messages

**Success:**
```
✅ Connected to MongoDB
🚀 Server running at http://localhost:5000
WebSocket connected
User authenticated: [userId]
```

**Issues:**
```
❌ MongoDB connection error
WebSocket error: [error details]
Invalid JSON: [error details]
```

---

## Final Checklist

Before going live:

- [ ] Server deployed to AWS Elastic Beanstalk
- [ ] Frontend built and deployed
- [ ] Environment variables updated (both client & server)
- [ ] WebSocket nginx config added (`.ebextensions/websocket.config`)
- [ ] SSL certificate configured (for wss://)
- [ ] CORS origins updated with production URLs
- [ ] Load Balancer configured for WebSocket
- [ ] Tested real-time messaging on production
- [ ] Tested PC notifications on production
- [ ] Browser notification permission enabled
- [ ] Monitoring/logging enabled

---

## Support

If WebSocket still doesn't work after following this guide:

1. **Check Server Logs**: `eb logs --stream`
2. **Check Browser Console**: Look for WebSocket errors
3. **Test WebSocket Endpoint**: Use [WebSocket Test Tool](https://www.websocket.org/echo.html)
4. **Verify Load Balancer**: Ensure ALB, not Classic LB
5. **Check Security Group**: Port 80/443 open

---

**Status**: ✅ System is production-ready with WebSocket support
**Last Updated**: 2025-01-13
**Version**: 1.0
