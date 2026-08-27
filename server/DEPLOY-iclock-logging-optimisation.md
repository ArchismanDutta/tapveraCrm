# Deploy: ADMS poll load + log volume

Fixes the 90k no-op device polls and the 6.25M-line pm2 log. No behaviour
change to attendance: punch capture, durations, late calculation and the ADMS
protocol handshake are byte-for-byte unchanged apart from one `Delay=` line.

## What changed

| File | Change |
|---|---|
| `services/biometric/AdmsParser.js` | Handshake `Delay=` now env-driven, default 60s (was hardcoded 10s) |
| `models/BiometricDevice.js` | `touch()` throttles bare heartbeat writes; new `findEnabledCached()` + `invalidateCache()` |
| `routes/iclockRoutes.js` | Poll endpoints use the cached lookup; the no-op poll is no longer logged |
| `routes/biometricAdminRoutes.js` | Device create/update invalidate the cache |
| `services/AttendanceService.js` | Hot-path `console.log` → `debug` namespaces (silent by default) |
| `app.js` | morgan gated on `NODE_ENV`, skips successful health/socket.io polls |
| `.env.example` | Documents the six new variables |

Nothing was deleted. Every diagnostic is still there, behind a switch.

## 1. Add to the production `.env` (all optional — these are the defaults)

```bash
BIOMETRIC_POLL_DELAY_SECONDS=60
BIOMETRIC_TOUCH_THROTTLE_SECONDS=300
BIOMETRIC_DEVICE_CACHE_SECONDS=300
BIOMETRIC_LOG_POLLS=false
```

Confirm `NODE_ENV=production` is set — the morgan change keys off it.

> `BIOMETRIC_DEVICE_CACHE_SECONDS` must stay comfortably larger than
> `BIOMETRIC_POLL_DELAY_SECONDS` (~5x). If they're equal, entries expire in step
> with the polls meant to hit them and the cache does nothing.

## 2. Deploy and restart

```bash
cd ~/apps/tapveraCrm/server
git pull
pm2 restart tapveraCrm-api --update-env    # --update-env is required for new vars
```

## 3. Install log rotation (do this regardless)

The single log file reached 6.25M lines because nothing rotates it.

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

Then truncate the existing backlog:

```bash
pm2 flush tapveraCrm-api
```

## 4. Verify (over the following hour)

```bash
# Polls should now appear at ~1/min/device, not ~6/min — and are no longer logged,
# so count the DB heartbeat instead via the admin UI "last seen" label.

# Log growth: should be a few hundred lines/hour, not tens of thousands
wc -l ~/.pm2/logs/tapveraCrm-api-out.log; sleep 600; wc -l ~/.pm2/logs/tapveraCrm-api-out.log

# The debug blocks must be gone
grep -c "Duration Calculation Debug" ~/.pm2/logs/tapveraCrm-api-out.log   # expect 0

# Punches must still arrive normally
grep -c "Recording punch event" ~/.pm2/logs/tapveraCrm-api-out.log        # expect to keep climbing
grep "✅ \[iclock\]" ~/.pm2/logs/tapveraCrm-api-out.log | tail -5          # push summaries still logged
grep "🤝 \[iclock\]" ~/.pm2/logs/tapveraCrm-api-out.log | tail -3          # handshakes still logged
```

**The `Delay=60` only takes effect at the device's next handshake** — on boot,
or at a `TransTimes` sync point (00:00 / 14:05). To apply it immediately, power
cycle the terminal. Until then it keeps polling at 10s; that's expected.

## Getting the diagnostics back

The debug output writes to **stderr**, so it lands in `tapveraCrm-api-error.log`.

```bash
pm2 restart tapveraCrm-api --update-env    # after adding DEBUG=... to .env
```

| `DEBUG=` value | Restores |
|---|---|
| `attendance:*` | everything below |
| `attendance:calc` | duration / work-session / break arithmetic |
| `attendance:late` | `lateMinutes` plumbing through `getEmployeeAttendance` |
| `attendance:shift` | shift resolution in `getUserShift` |

Poll logging: `BIOMETRIC_LOG_POLLS=true`.

## Rollback

Nothing here writes to the database schema, so rollback is just the code:

```bash
git revert <commit>          # or: git checkout <previous-sha> -- server/
pm2 restart tapveraCrm-api --update-env
```

Or, without touching code at all, restore the old behaviour via env alone:

```bash
BIOMETRIC_POLL_DELAY_SECONDS=10
BIOMETRIC_TOUCH_THROTTLE_SECONDS=0
BIOMETRIC_DEVICE_CACHE_SECONDS=0
BIOMETRIC_LOG_POLLS=true
DEBUG=attendance:*
HTTP_LOG_FORMAT=dev
```

## Known follow-up (deliberately NOT done here)

`getEmployeeAttendance` calls `recalculateEmployeeData` for **every** day in the
requested range on every read — a 30-day view replays 30 event timelines. For
closed days the stored `calculated` block is already correct, so this is wasted
CPU.

It was left alone because skipping it changes *when* derived values are
recomputed, and `recalculateEmployeeData` is the single point where the
control-machine break factor and the break-absence policy are applied. Stored
values computed under an older factor would stop being corrected on read. That
needs its own change with its own tests — it is a performance question, not a
logging one.

## Verification performed before this was committed

- Six attendance test suites (`controlMachine`, `breakPolicy`, `completeShiftTest`,
  `actualRequirementsTest`, `manualNightShiftTest`, `earlyMorningShiftTest`) produce
  **byte-identical results** to a pre-change baseline, including two failures that
  were already failing beforehand.
- Handshake response diffed old vs new: **exactly one line changed** (`Delay=10` → `Delay=60`).
  `Realtime`, `TransInterval`, `ErrorDelay`, `TimeZone`, all `*Stamp` values and the
  trailing newline are untouched.
- `parseAttlog` output byte-identical on a mixed tab/space/CRLF/malformed payload.
- 24 checks on `pollDelaySeconds` clamping — `0`, negatives and garbage all fall back
  to 60 rather than producing a hot-polling device.
- 11 checks on the cache and throttle: patched `touch()` never throttled, throttle is
  per-serial, a failed write retries immediately, `findEnabled` unchanged for existing
  callers, `invalidateCache` forces a fresh read, null results not cached.
