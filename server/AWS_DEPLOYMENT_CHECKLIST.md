# AWS Elastic Beanstalk Deployment Checklist

## Issues Fixed (2025-10-30)

### Critical Port Mismatch
- **Problem**: Nginx was configured to proxy to port 8081, but Node.js app was using port 5000
- **Solution**: Added `PORT: 8081` to environment variables in `.ebextensions/websocket.config`
- **Impact**: This was causing health check failures and deployment timeouts

### MongoDB Connection Timeout
- **Problem**: MongoDB connection could hang indefinitely during deployment
- **Solution**: Added connection timeouts (`serverSelectionTimeoutMS: 10000`)
- **Impact**: Prevents deployment from hanging if database is unreachable

### Email Service Blocking
- **Problem**: Email service initialization was blocking server startup
- **Solution**: Moved email service init to background after server starts
- **Impact**: Faster server startup, non-critical service doesn't block deployment

## Pre-Deployment Checklist

### 1. Environment Variables
Ensure these are set in AWS Elastic Beanstalk Console:

#### Required Variables:
- [ ] `MONGODB_URI` - MongoDB connection string
- [ ] `JWT_SECRET` - Secret key for JWT tokens
- [ ] `PORT` - Set to `8081` (matches nginx config)
- [ ] `NODE_ENV` - Set to `production`

#### Frontend Configuration:
- [ ] `FRONTEND_ORIGIN` or `FRONTEND_URL` - Your frontend URL
- [ ] Example: `http://tapvera-crm-frontend.s3-website.ap-south-1.amazonaws.com`

#### Email Configuration (Optional but recommended):
- [ ] `GMAIL_CLIENT_ID`
- [ ] `GMAIL_CLIENT_SECRET`
- [ ] `GMAIL_REFRESH_TOKEN`
- [ ] `GMAIL_USER`

### 2. Code Verification

#### Check package.json:
```json
{
  "scripts": {
    "start": "node app.js"
  }
}
```

#### Verify .ebextensions/websocket.config:
- Upstream port matches `PORT` env var (8081)
- Nginx configuration is valid
- Container commands are correct

### 3. Health Check Endpoints

Your application has two health check endpoints:

1. **Main endpoint**: `GET /`
   - Returns detailed server information
   - Shows all loaded routes

2. **Health check endpoint**: `GET /health`
   - Returns HTTP 200 if healthy
   - Returns HTTP 503 if database is down
   - Shows database connection status

### 4. Database Connection

Ensure your MongoDB instance:
- [ ] Is accessible from AWS (check security groups/IP whitelist)
- [ ] Connection string is correct (check for typos)
- [ ] Has proper authentication credentials
- [ ] Is not blocking connections from AWS IP ranges

### 5. Deployment Process

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Fix: Port mismatch and deployment issues"
   git push
   ```

2. **Deploy to Elastic Beanstalk**:
   ```bash
   eb deploy
   ```

3. **Monitor deployment**:
   - Watch the Elastic Beanstalk console
   - Check for green health status
   - Look for "Successfully deployed" message

4. **Verify deployment**:
   ```bash
   # Test main endpoint
   curl https://your-app-url.elasticbeanstalk.com/

   # Test health endpoint
   curl https://your-app-url.elasticbeanstalk.com/health
   ```

## Troubleshooting Deployment Failures

### Symptom: Deployment times out after 14-15 minutes

**Possible Causes:**
1. Port mismatch (Fixed ✅)
2. Database connection hanging (Fixed ✅)
3. Missing environment variables
4. MongoDB not accessible from AWS

**How to diagnose:**
1. SSH into the instance: `eb ssh`
2. Check application logs: `cat /var/log/nodejs/nodejs.log`
3. Check nginx logs: `sudo cat /var/log/nginx/error.log`
4. Check if app is running: `ps aux | grep node`
5. Check which port app is using: `netstat -tulpn | grep node`

### Symptom: Instances not sending health data

**Possible Causes:**
1. Application crashed on startup
2. Port mismatch preventing health checks
3. Health check endpoint not responding

**How to fix:**
1. Check if `PORT=8081` is set in environment
2. Verify nginx upstream points to correct port
3. Check app logs for startup errors

### Symptom: "No data" health status

**Possible Causes:**
1. Application not listening on correct port
2. Health check path incorrect
3. Application crashed

**How to fix:**
1. Verify app is listening on `0.0.0.0:8081`
2. Check Elastic Beanstalk health check configuration
3. Review application logs for errors

## Environment Variable Configuration in AWS Console

1. Go to AWS Elastic Beanstalk Console
2. Select your environment (e.g., `Crmproduction-env`)
3. Click "Configuration" in left sidebar
4. Find "Software" category, click "Edit"
5. Scroll to "Environment properties"
6. Add/update the following:

```
PORT = 8081
NODE_ENV = production
MONGODB_URI = mongodb+srv://user:pass@cluster.mongodb.net/dbname
JWT_SECRET = your-secret-key-here
FRONTEND_ORIGIN = http://your-frontend-url.com
```

7. Click "Apply" and wait for environment update

## Monitoring After Deployment

### Check Application Logs:
```bash
eb logs
```

### Real-time Log Streaming:
```bash
eb logs --stream
```

### SSH into Instance:
```bash
eb ssh
```

### Check Server Status:
```bash
# After SSH'ing
sudo systemctl status nodejs
curl http://localhost:8081/health
```

## Common Error Messages and Solutions

### "MONGODB_URI not set in .env file"
- Add `MONGODB_URI` to Elastic Beanstalk environment variables
- Do NOT rely on .env file in production

### "ECONNREFUSED" or "ETIMEDOUT" for MongoDB
- Check MongoDB Atlas whitelist (allow AWS IP ranges or 0.0.0.0/0)
- Verify connection string is correct
- Ensure MongoDB cluster is running

### "Address already in use :::8081"
- Another process is using port 8081
- Restart the environment or instance

### Nginx 502 Bad Gateway
- App not running on expected port
- Check `PORT` environment variable matches nginx upstream
- Review app logs for startup errors

## Rollback Procedure

If deployment fails and environment is unstable:

1. **Via Console**:
   - Go to Elastic Beanstalk > Your Environment
   - Click "Actions" > "Restore previous version"
   - Select last working version

2. **Via CLI**:
   ```bash
   eb deploy --version <previous-version-label>
   ```

## Post-Deployment Verification

- [ ] Health check returns 200: `curl /health`
- [ ] Main endpoint accessible: `curl /`
- [ ] WebSocket connections work
- [ ] Database queries successful
- [ ] Email service operational (check logs)
- [ ] Cron jobs initialized
- [ ] Frontend can connect to backend
- [ ] CORS working properly

## Support

If issues persist after following this checklist:
1. Review all logs carefully
2. Check AWS service health dashboard
3. Verify all security groups and network settings
4. Consider increasing instance size if resource-constrained
