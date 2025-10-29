# WhatsApp Integration Setup Guide

## Overview

This CRM system integrates with **Meta WhatsApp Business API** to send automated notifications to administrators. This guide will help you set up and test the WhatsApp integration.

---

## Features

The WhatsApp integration currently supports:

### 1. **Task Notifications** (to Admins)
- ✅ New task created
- ✅ Task updated
- ✅ Task status changed
- ✅ Task deleted
- ✅ Task rejected
- ✅ Task submission received
- ✅ Task submission approved
- ✅ Task submission rejected

### 2. **Help Center Notifications** (to Admins)
- ✅ New help issue submitted
- ✅ Includes issue title, priority, and description preview

### 3. **Future Capabilities** (infrastructure ready)
- Send WhatsApp to specific phone numbers
- Bulk WhatsApp sending
- Callback/Lead follow-up reminders (when implemented)

---

## Prerequisites

1. **Meta Business Account**
   - Sign up at https://business.facebook.com/

2. **WhatsApp Business Account**
   - Connected to your Meta Business Account

3. **WhatsApp Business API Access**
   - Approved by Meta (instant approval for test mode)

4. **Test Phone Number(s)**
   - At least one phone number to receive test messages

---

## Step-by-Step Setup

### Step 1: Create Meta Business Account

1. Go to https://business.facebook.com/
2. Click **Create Account**
3. Follow the prompts to set up your business profile
4. Verify your business (email verification)

### Step 2: Add WhatsApp to Your Business Account

1. In Meta Business Suite, click **Add Assets**
2. Select **WhatsApp Accounts**
3. Click **Add** and follow the setup wizard
4. Choose **Start using the API** (not the app)

### Step 3: Get API Credentials

1. In Meta Business Suite, navigate to **WhatsApp > API Setup**
2. You'll see:
   - **Temporary access token** (valid for 24 hours)
   - **Phone number ID**
3. Copy both values

**Important Notes:**
- The temporary token expires in 24 hours
- For production, generate a permanent token (see "Production Setup" below)
- The Phone Number ID never changes

### Step 4: Add Test Phone Numbers

1. In **WhatsApp > API Setup**, scroll to **To** field
2. Click **Manage phone number list**
3. Add your test phone numbers (with country code)
4. Verify each number via the 6-digit code sent

### Step 5: Configure Environment Variables

Edit `server/.env` and add:

```env
# WhatsApp Business API Credentials
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here

# Admin phone numbers (comma-separated, with country code)
ADMIN_NUMBERS=+1234567890,+9876543210

# Admin emails (for help center)
ADMIN_EMAILS=admin@example.com
```

**Phone Number Format:**
- ✅ Correct: `+919876543210` (country code + number, no spaces)
- ❌ Wrong: `9876543210` (missing country code)
- ❌ Wrong: `+91 98765 43210` (contains spaces)

### Step 6: Restart Server

```bash
cd server
npm start
```

Check the console for:
```
✅ WhatsApp configured successfully
```

Or warnings if credentials are missing:
```
⚠️ WhatsApp not configured. Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID
```

---

## Testing the Integration

### Test 1: Task Notification

1. Log in to the CRM as an admin/super-admin
2. Create a new task
3. Assign it to an employee
4. Check admin phone numbers for WhatsApp message

**Expected Message:**
```
📝 *New Task Created*
📌 Title: *Task Name*
📅 Due: *2024-01-15*
🎯 Priority: *High*
👤 Assigned By: *Admin Name*
👥 Assigned To: Employee Name
```

### Test 2: Help Center Notification

1. Navigate to Help Center page
2. Submit a new issue with:
   - Title: "Test WhatsApp Integration"
   - Priority: High
   - Description: "Testing the system"
3. Check admin phone numbers for WhatsApp message

**Expected Message:**
```
🆘 *New Help Issue*
📌 Title: *Test WhatsApp Integration*
🎯 Priority: *High*
📝 Description: Testing the system
```

### Test 3: Task Update Notification

1. Edit an existing task
2. Change status or priority
3. Check for WhatsApp notification

**Expected Message:**
```
✏️ *Task Updated*
📌 Title: *Task Name*
📅 Due: *2024-01-15*
📊 Status: *In Progress*
🎯 Priority: *High*
👤 Updated By: *Admin Name*
```

---

## Troubleshooting

### Issue 1: No Messages Received

**Check:**
1. Are environment variables set correctly?
   ```bash
   # In server directory
   node -e "console.log(process.env.WHATSAPP_ACCESS_TOKEN ? '✅ Token found' : '❌ Token missing')"
   ```

2. Is the phone number in test mode list?
   - Go to Meta Business Suite > WhatsApp > API Setup
   - Check "Manage phone number list"

3. Is the access token valid?
   - Test tokens expire in 24 hours
   - Generate a new one or use permanent token

4. Check server logs:
   ```
   ❌ Error sending WhatsApp: {"error":{"message":"...","code":...}}
   ```

### Issue 2: Authentication Failed (401)

**Solution:**
- Access token expired or invalid
- Generate new token from Meta Business Suite
- Update `WHATSAPP_ACCESS_TOKEN` in `.env`
- Restart server

### Issue 3: Invalid Phone Number (400)

**Solution:**
- Ensure phone number format: `+[country_code][number]`
- No spaces, dashes, or parentheses
- Example: `+919876543210` not `+91 98765 43210`

### Issue 4: Phone Number Not in Test Mode

**Error:**
```json
{
  "error": {
    "message": "(#131030) Recipient phone number not in allowed list",
    "code": 131030
  }
}
```

**Solution:**
1. Go to Meta Business Suite
2. Navigate to WhatsApp > API Setup
3. Add the phone number to test list
4. Verify with 6-digit code

### Issue 5: Rate Limiting

**Error:**
```json
{
  "error": {
    "message": "Too many messages sent",
    "code": 4
  }
}
```

**Solution:**
- Meta has rate limits in test mode
- Wait a few minutes before retrying
- For production, request rate limit increase

---

## Production Setup

### Generate Permanent Access Token

**Why?**
- Test tokens expire in 24 hours
- Production needs long-lived tokens

**Steps:**

1. **Create System User** (in Meta Business Suite)
   - Go to Business Settings > Users > System Users
   - Click **Add** > Create new system user
   - Name: "WhatsApp CRM Bot"
   - Role: Admin

2. **Generate Token**
   - Select the system user
   - Click **Generate New Token**
   - Select your WhatsApp app
   - Permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
   - Save the token securely (can't view again!)

3. **Update Environment Variables**
   ```env
   WHATSAPP_ACCESS_TOKEN=your_permanent_token_here
   ```

### Verify Your Business Phone Number

**Test Mode Limitations:**
- Only verified test numbers can receive messages
- Maximum 5 test numbers
- 1,000 messages per 24 hours

**Production Benefits:**
- Send to any phone number
- Higher rate limits
- Better deliverability

**How to Verify:**
1. In WhatsApp > Phone Numbers
2. Click **Verify** next to your number
3. Complete business verification process (may take 1-3 days)

### Request Production Access

1. Submit your app for **Business Verification**
2. Complete **WhatsApp Business Account verification**
3. Wait for Meta approval (usually 1-3 business days)

---

## API Reference

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WHATSAPP_ACCESS_TOKEN` | Yes | Meta API access token | `EAAB...` |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Your WhatsApp phone number ID | `123456789012345` |
| `ADMIN_NUMBERS` | Yes | Admin phone numbers (comma-separated) | `+919876543210,+911234567890` |
| `ADMIN_EMAILS` | No | Admin emails for help center | `admin@example.com` |

### Service Functions

#### `notifyAdmins(message)`
Send WhatsApp to all admin numbers.

**Parameters:**
- `message` (string): Message text (supports markdown-style formatting with `*bold*`)

**Returns:**
- `{sent: number, failed: number}`: Summary of sent/failed messages

**Example:**
```javascript
const { notifyAdmins } = require('./services/whatsappService');

await notifyAdmins('📝 *New Task Created*\nTitle: Test Task');
// Returns: { sent: 2, failed: 0 }
```

#### `sendWhatsAppMessage(toNumber, message)`
Send WhatsApp to a specific number.

**Parameters:**
- `toNumber` (string): Recipient phone number with country code (e.g., `+919876543210`)
- `message` (string): Message text

**Returns:**
- `boolean`: `true` if sent successfully, `false` otherwise

**Example:**
```javascript
const { sendWhatsAppMessage } = require('./services/whatsappService');

const success = await sendWhatsAppMessage('+919876543210', 'Hello from CRM!');
console.log(success ? '✅ Sent' : '❌ Failed');
```

#### `sendBulkWhatsApp(phoneNumbers, message)`
Send WhatsApp to multiple recipients.

**Parameters:**
- `phoneNumbers` (string[]): Array of phone numbers
- `message` (string): Message text

**Returns:**
- `{sent: number, failed: number}`: Summary of sent/failed messages

**Example:**
```javascript
const { sendBulkWhatsApp } = require('./services/whatsappService');

const numbers = ['+919876543210', '+911234567890'];
const result = await sendBulkWhatsApp(numbers, '📢 Important announcement');
console.log(`Sent: ${result.sent}, Failed: ${result.failed}`);
```

#### `isWhatsAppConfigured()`
Check if WhatsApp is properly configured.

**Returns:**
- `boolean`: `true` if credentials are present

**Example:**
```javascript
const { isWhatsAppConfigured } = require('./services/whatsappService');

if (isWhatsAppConfigured()) {
  console.log('✅ WhatsApp ready');
} else {
  console.log('⚠️ WhatsApp not configured');
}
```

---

## Message Formatting

WhatsApp supports basic markdown-style formatting:

| Format | Syntax | Example | Result |
|--------|--------|---------|--------|
| **Bold** | `*text*` | `*Important*` | **Important** |
| _Italic_ | `_text_` | `_emphasis_` | _emphasis_ |
| ~~Strikethrough~~ | `~text~` | `~old price~` | ~~old price~~ |
| `Monospace` | ` ```text``` ` | ` ```code``` ` | `code` |

**Example:**
```javascript
await notifyAdmins(`
📝 *New Task Created*
📌 Title: *${taskTitle}*
🎯 Priority: _${priority}_
👤 Assigned By: ${userName}
`);
```

---

## Best Practices

### 1. Message Length
- Keep messages under 4096 characters
- Use concise, clear language
- Include only essential information

### 2. Rate Limiting
- Test mode: ~1,000 messages per 24 hours
- Production: Higher limits (request increase if needed)
- Add delays between bulk messages (100ms minimum)

### 3. Error Handling
- Always check return values
- Log errors for debugging
- Have fallback notification methods (email)

### 4. User Privacy
- Only send to opted-in numbers
- Provide opt-out mechanism
- Follow GDPR/privacy regulations

### 5. Testing
- Use test mode during development
- Test all notification scenarios
- Monitor message delivery rates

---

## Security Considerations

### 1. Protect Access Tokens
- ❌ Never commit tokens to Git
- ✅ Store in environment variables
- ✅ Use `.env` file (add to `.gitignore`)
- ✅ Rotate tokens periodically

### 2. Validate Phone Numbers
- Check format before sending
- Remove invalid numbers from lists
- Handle errors gracefully

### 3. Monitor Usage
- Track message counts
- Watch for unusual patterns
- Set up alerts for failures

---

## Cost Estimation

### Test Mode
- **Free** for verified test numbers
- Limited to 5 test numbers
- 1,000 messages per 24 hours

### Production
Pricing varies by country. Example for India:

| Conversation Type | Cost (USD) |
|-------------------|------------|
| Business-initiated | $0.0088 |
| User-initiated | $0.0041 |

**Important:**
- Charged per 24-hour conversation window
- Multiple messages in window = same cost
- No charge for failed messages

**Cost Calculator:**
- 100 tasks/day × 30 days = 3,000 messages/month
- ~26 USD/month (if all business-initiated)

---

## Monitoring & Logs

### Success Logs
```
✅ WhatsApp sent successfully to +919876543210
📊 WhatsApp Admin Notifications: 2 sent, 0 failed
```

### Error Logs
```
❌ Error sending WhatsApp to +919876543210: {...}
❌ Authentication failed. Check WHATSAPP_ACCESS_TOKEN
⚠️ WhatsApp not configured. Skipping admin notifications.
```

### Debugging
Enable detailed logging:
```javascript
// In whatsappService.js
console.log('WhatsApp Config:', {
  hasToken: Boolean(token),
  hasPhoneId: Boolean(phoneNumberId),
  adminCount: adminNumbers.length
});
```

---

## Frequently Asked Questions

### Q: Can I send WhatsApp to clients/employees automatically?

**A:** Yes, infrastructure is ready! Use `sendWhatsAppMessage()` or `sendBulkWhatsApp()` from the service. However, you must:
1. Get user consent (opt-in)
2. Comply with WhatsApp policies
3. Follow local regulations (GDPR, etc.)

### Q: What's the difference between test and production mode?

**A:**
- **Test:** Limited to verified test numbers, 1000 msg/day, free
- **Production:** Send to any number, higher limits, paid

### Q: How do I get a permanent access token?

**A:** Create a system user in Meta Business Suite and generate a token with proper permissions (see "Production Setup" section).

### Q: Can I send images/files via WhatsApp?

**A:** Yes! The API supports media messages. This requires extending the `sendWhatsAppMessage()` function to handle media uploads.

### Q: How do I handle opt-outs?

**A:** Implement a callback webhook to receive user messages. When users reply "STOP", remove them from notification lists.

### Q: What happens if WhatsApp is not configured?

**A:** The system gracefully skips WhatsApp notifications and logs warnings. Other features (email, in-app notifications) continue working.

---

## Support & Resources

### Official Documentation
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Meta Business Suite](https://business.facebook.com/)
- [API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)

### Common Issues
- [WhatsApp Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
- [Rate Limits](https://developers.facebook.com/docs/whatsapp/cloud-api/overview/rate-limits)

### Getting Help
- Check server logs for detailed errors
- Review this guide's troubleshooting section
- Test with Meta's API testing tools
- Contact Meta support for account issues

---

## Changelog

### Version 2.0 (Current)
- ✅ Standardized environment variable names
- ✅ Improved error handling with specific error messages
- ✅ Added `sendWhatsAppMessage()` for individual sends
- ✅ Added `sendBulkWhatsApp()` for multiple recipients
- ✅ Added `isWhatsAppConfigured()` validation
- ✅ Better logging and debugging
- ✅ Rate limiting protection (100ms delay between bulk messages)
- ✅ Centralized WhatsApp service (removed duplicate code)

### Version 1.0 (Initial)
- Basic admin notifications for tasks
- Help center WhatsApp support
- Test mode configuration

---

## Next Steps

1. ✅ Complete setup following this guide
2. ✅ Test all notification types
3. ✅ Monitor logs for errors
4. 🔄 Request production access when ready
5. 🔄 Implement opt-in/opt-out mechanism
6. 🔄 Add WhatsApp to callback reminders
7. 🔄 Extend to client/employee notifications

---

**Need Help?** Check the troubleshooting section or review server logs for detailed error messages.
