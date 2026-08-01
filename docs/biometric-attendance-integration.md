# Identix Fingerprint → TapCRM Attendance Integration

How the fingerprint terminal feeds attendance into the CRM, how to set it up,
and what to check when a punch doesn't appear.

---

## 1. What was built

The terminal pushes punches to `https://web.tapvera.io/iclock/cdata`. The CRM
resolves each punch to an employee and writes it through the **existing**
attendance engine, so a fingerprint punch and an in-app punch produce identical
records, calculations and reports.

```
Employee scans finger
        │
        ▼
Identix terminal ──HTTPS POST──▶ Cloudflare ──▶ VPS ──▶ Express /iclock/cdata
                                                             │
                                          ┌──────────────────┴──────────────────┐
                                          │  1. Verify device serial (allowlist) │
                                          │  2. Parse plain-text ATTLOG rows     │
                                          │  3. Save raw punch  (BiometricPunch) │
                                          │  4. Map PIN → User.biometricPin      │
                                          │  5. Collapse re-scans (90s window)   │
                                          │  6. Decide PUNCH_IN vs PUNCH_OUT     │
                                          └──────────────────┬──────────────────┘
                                                             ▼
                                    AttendanceService.recordPunchEvent()
                                    (shift resolution, night-shift date, late
                                     calculation, leave handling, daily stats)
                                                             │
                                                             ▼
                                              AttendanceRecord  ──socket──▶ CRM UI
```

### Division of responsibility

| Action | Where it happens |
|---|---|
| Punch in / punch out | **Fingerprint terminal only** — in-app buttons hidden |
| Break start / resume | **CRM app** — unchanged |
| Missed / corrected punches | **Admin manual punch** — unchanged |

---

## 2. Files

### New

| File | Purpose |
|---|---|
| `server/routes/iclockRoutes.js` | ADMS protocol endpoints the device talks to |
| `server/routes/biometricAdminRoutes.js` | Admin API: PIN mapping, punch log, device health |
| `server/services/biometric/AdmsParser.js` | Plain-text protocol parsing + timezone conversion |
| `server/services/biometric/BiometricAttendanceService.js` | Maps punches to employees and applies them |
| `server/models/BiometricDevice.js` | Device registry + allowlist + telemetry |
| `server/models/BiometricPunch.js` | Raw device log, dedupe index, audit trail |
| `client/.../admin/BiometricAttendanceManagement.jsx` | Admin UI: PIN mapping, device status, punch feed |

### Modified (additive only — nothing removed)

| File | Change |
|---|---|
| `server/models/User.js` | Added optional `biometricPin` (sparse unique) |
| `server/services/AttendanceService.js` | `recordPunchEvent` now honours `options.timestamp`; `validatePunchEvent` accepts `allowEarlyPunch` / `maxPastHours` |
| `server/app.js` | Mounted `/iclock` (before `express.json()`) and `/api/biometric` |
| `client/.../AttendanceHero.jsx` | Punch buttons hidden behind `BIOMETRIC_ATTENDANCE_ENABLED`; original JSX intact |
| `client/src/App.jsx` | Route `/admin/biometric-attendance` (admin/HR/super-admin) |
| `client/.../dashboard/Sidebar.jsx` | "Biometric Device" nav entry for HR and super-admin |

---

## 3. Setup

### Step 1 — Device configuration

On the terminal (`Menu → Comm → Cloud Server` / ADMS):

| Setting | Value |
|---|---|
| Server Mode / ADMS | ON |
| Domain Name (use DNS) | ON |
| Server Address | `web.tapvera.io` |
| Server Port | `443` |
| Enable Proxy | OFF |
| HTTPS / SSL | ON |
| Device time & timezone | Correct local time, IST (UTC+5:30) |

The device clock matters. It has no timezone awareness — it reports whatever
its own clock reads, and that's the time recorded against the punch.

### Step 2 — Cloudflare

`web.tapvera.io` already resolves to the VPS, so no new DNS record and no new
subdomain is needed. Two settings can silently break the integration:

**a. Security features must not challenge `/iclock/*`.** Bot Fight Mode, Under
Attack Mode, and managed WAF rules serve a JavaScript challenge page. The device
cannot solve one — it receives HTML instead of the protocol response and stops.
Add a Configuration Rule:

```
If   URI Path starts with  /iclock
Then Security Level        → Essentially Off
     Bot Fight Mode        → Off
     Browser Integrity Check → Off
```

**b. Minimum TLS version.** Embedded ADMS firmware often supports only TLS 1.0/1.1.
If SSL/TLS → Edge Certificates → Minimum TLS Version is 1.2 or higher, the
handshake fails before any HTTP request is made. Check `Zone → SSL/TLS` and lower
it if the device won't connect.

### Step 3 — Environment variables

Add to `server/.env`:

```bash
# Timezone the device clock is set to
BIOMETRIC_DEVICE_TIMEZONE=Asia/Kolkata

# Two scans closer than this are treated as one punch (finger re-scans)
BIOMETRIC_MIN_PUNCH_GAP_SECONDS=90

# How far back a device may backfill after an outage (hours)
BIOMETRIC_MAX_BACKFILL_HOURS=168

# Minutes without contact before a device is shown offline
BIOMETRIC_STALE_MINUTES=15

# Let an unknown device self-register on first contact.
# Convenient for setup — set to false once the device is registered.
BIOMETRIC_AUTO_REGISTER_DEVICES=true

# --- Recommended for production ---
# Office public IP(s), comma-separated. Empty = no IP restriction.
BIOMETRIC_ALLOWED_IPS=

# Shared secret. If set, the device must append ?key=<secret> to its server URL.
BIOMETRIC_PUSH_SECRET=
```

### Step 4 — Register the device

Power on the terminal and watch the server log:

```
📟 [iclock] GET /cdata SN=ZK9900123 ...
🆕 [iclock] Auto-registered new device ZK9900123 (dry-run mode)
🤝 [iclock] Handshake completed with ZK9900123
```

It registers in **dry-run**: punches are captured and interpreted but not
written to attendance. This is deliberate — watch a day of real traffic before
letting the machine affect anyone's timesheet.

### Step 5 — Map employees to PINs

Nothing works until this is done: an unmapped PIN produces no attendance.

Go to **Sidebar → Biometric Device** (`/admin/biometric-attendance`), available
to admin, HR and super-admin.

The page has four sections:

1. **Health strip** — devices online, punches applied in the last 24h, and how
   many staff still have no PIN
2. **PINs waiting to be assigned** — the work queue. Every PIN the device has
   sent that matches nobody, with a dropdown to pick the employee. This is the
   fastest path: have everyone scan once, then assign from this list rather than
   typing numbers.
3. **Employee PIN mapping** — the full roster with an editable PIN per row.
   Search by name, employee ID or PIN; filter to unmapped only.
4. **Terminals + Recent punches** — device online status, the dry-run toggle,
   and a live feed of exactly what the hardware sent and what the CRM did with it

Mapping someone **automatically replays** their earlier unmapped punches, so
enrolling staff on the device before mapping them in the CRM loses nothing —
you'll see a toast confirming how many were recovered.

The equivalent API calls, if you'd rather script it:

```http
GET  /api/biometric/unmapped-pins        # PINs the device has sent
GET  /api/biometric/mappings             # employees + who's still unmapped
PUT  /api/biometric/mappings/:userId     # { "biometricPin": "1001" }
```

### Step 6 — Go live

On the Biometric Device page, find your terminal under **Terminals** and click
the **Dry-run** toggle to switch it off. Punches start counting from that
moment.

Or via API:

```http
PUT /api/biometric/devices/:id     { "dryRun": false, "name": "Reception" }
```

---

## 4. How a punch becomes IN or OUT

Decided from the employee's current CRM state, not the device's status column:

| CRM state | Device punch becomes |
|---|---|
| `NOT_STARTED` | `PUNCH_IN` — first punch of the day |
| `WORKING` | `PUNCH_OUT` — ends the session |
| `ON_BREAK` | *skipped* — break must be ended in the app first |
| `FINISHED` | `PUNCH_IN` — returning, new session |

**Why not use the device's status column?** It reflects which mode key the
employee pressed before scanning. Almost nobody presses it — they just scan — so
it reads `0` ("check-in") regardless of intent. Trusting it would mean nobody
ever punches out. The raw value is still stored on every punch for audit.

---

## 5. Safety properties

**Duplicate punches are impossible.** A unique index on
`(serialNumber, pin, punchedAt, rawStatus)` means a device re-sending a batch —
which they routinely do after a network drop — hits a duplicate-key error and
stops before touching attendance.

**Nothing is lost.** Every raw row is saved before it's interpreted. Unmapped
PINs, wrong shift config, or a logic bug leave the original data intact and
replayable via `POST /api/biometric/replay`.

**The device never sees an error.** ADMS firmware re-sends indefinitely on any
non-`OK` response, and it retries the failed batch *before* sending anything
new — so one poison record would block all future attendance. Every response is
`200 OK` in plain text; problems are surfaced in the admin API instead.

**Backdated punches land correctly.** A terminal that loses connectivity buffers
internally and dumps the backlog on reconnect. Those punches are recorded at
sensor time, not delivery time.

> **Bug fixed along the way:** `recordPunchEvent` accepted an `options.timestamp`
> but always overwrote it with `new Date()`. `AttendanceController.manualPunchAction`
> has been passing that field all along, so **admin manual corrections were
> silently recorded at the time the admin clicked, not the time entered**. Now
> honoured. Worth spot-checking any past manual corrections.

---

## 6. Troubleshooting

**Device connects but no attendance arrives.**
The handshake response format is almost always the cause — the device requires a
specific plain-text config block before it will push anything, and returns HTTP
200 the whole time. Confirm `🤝 Handshake completed` appears in the log, then
check for a Cloudflare challenge on `/iclock/*`.

**A specific employee's punches don't appear.**
`GET /api/biometric/punches?pin=1001` and read the `status`:

| Status | Meaning |
|---|---|
| `APPLIED` | Written to attendance |
| `UNMAPPED` | No employee has this PIN — map them, punches replay automatically |
| `DUPLICATE` | Device re-send, or a finger re-scan within the gap window |
| `SKIPPED` | A business rule declined it — read `message` |
| `DRY_RUN` | Device still in dry-run |
| `FAILED` | Unexpected error — safe to replay |

**Times are off by 5h30m.** `BIOMETRIC_DEVICE_TIMEZONE` doesn't match the
device's actual clock, or the device clock is set to UTC.

**Everyone is marked late.** Device clock drift. The terminal has no NTP by
default and drifts minutes per month.

**Is the machine alive?** `GET /api/biometric/health`.

---

## 7. Rollback

Bring the in-app punch buttons back instantly: set
`BIOMETRIC_ATTENDANCE_ENABLED = false` in
`client/src/components/attendance/AttendanceHero.jsx` and rebuild. The original
JSX is untouched beneath it.

To stop the device without touching code:
`PUT /api/biometric/devices/:id` with `{ "enabled": false }`.

The `POST /api/attendance-new/punch` endpoint was never disabled — the app punch
path still works if called directly.

---

## 8. Suggested next steps

- **Alert on device silence.** A `node-cron` job (already a dependency) checking
  `lastSeenAt` and notifying HR after ~30 minutes turns a silent hardware
  failure into a notification rather than a payroll surprise a week later.
- **Missing punch-out sweep.** People forget to scan on the way out. A nightly
  job flagging `WORKING` employees for HR review is worth adding.
- **Tighten security before this is public for long.** `BIOMETRIC_ALLOWED_IPS`
  and `BIOMETRIC_PUSH_SECRET` are both off by default; the serial allowlist is
  the only active guard, and serials are guessable.
