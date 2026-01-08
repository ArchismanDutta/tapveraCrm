# Payslip Notification System

## Features Implemented

✅ Real-time WebSocket notifications when payslips are created or updated
✅ Notification toast with sound on employee dashboard
✅ Auto-closes after 10 seconds with progress bar
✅ "View Payslip" button to navigate directly to payslip
✅ Shows net salary amount in notification
✅ Pleasant notification sound using Web Audio API

## Setup Instructions

### 1. Environment Variables

Your existing `.env` file already has the WebSocket configuration:

```env
VITE_WS_BASE=ws://localhost:5000/ws
```

The notification system uses this existing variable. No additional configuration needed!

For production, update to:
```env
VITE_WS_BASE=wss://yourdomain.com/ws
```

### 2. How It Works

**Backend:**
1. When a payslip is created/updated in `payslipController.js`
2. The system sends a WebSocket notification to the employee
3. Notification includes: title, message, payPeriod, netPayment

**Frontend:**
1. `useWebSocket` hook connects to WebSocket server on app load
2. Authenticates with JWT token
3. Listens for notifications with `channel: "payslip"`
4. Plays notification sound
5. Displays toast notification

### 3. Testing

1. Start the server: `cd server && npm run dev`
2. Start the client: `cd client && npm run dev`
3. Login as an employee
4. Have an admin/super-admin create a payslip for that employee
5. Employee should see notification toast with sound!

### 4. Notification Channels

Current channels:
- `chat` - Chat messages
- `payslip` - Payslip notifications (NEW)

You can easily add more channels like:
- `leave` - Leave approvals
- `task` - Task assignments
- `notice` - New notices

### 5. Customization

**Change notification sound:**
Edit `client/src/hooks/useWebSocket.js` in the `playNotificationSound()` function

**Change notification appearance:**
Edit `client/src/components/NotificationToast.jsx`

**Change auto-close duration:**
Modify the timeout in `NotificationToast.jsx` (currently 10 seconds)

### 6. Files Modified/Created

**Backend:**
- ✅ `server/utils/websocket.js` (NEW)
- ✅ `server/app.js` (modified - integrated websocket utility)
- ✅ `server/controllers/payslipController.js` (modified - emit notifications)

**Frontend:**
- ✅ `client/src/hooks/useWebSocket.js` (NEW)
- ✅ `client/src/components/NotificationToast.jsx` (NEW)
- ✅ `client/src/App.jsx` (modified - integrated notifications)

## Troubleshooting

**Notifications not working?**
1. Check WebSocket connection in browser console (should see "WebSocket connected")
2. Verify employee is logged in
3. Check that VITE_WS_BASE is correctly set in `.env`
4. Make sure server is running on the correct port (default: 5000)
5. Check browser console for errors
6. Verify the employee ID matches between login and payslip generation

**No sound?**
- Some browsers require user interaction before playing audio
- Check browser audio permissions
- Try clicking anywhere on the page first

## Future Enhancements

- [ ] Notification history/center
- [ ] Mark as read functionality
- [ ] Desktop notifications (browser API)
- [ ] Email notifications for offline users
- [ ] Notification preferences (sound on/off)
- [ ] Multiple notification stacking
