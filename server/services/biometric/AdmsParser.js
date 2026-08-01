// services/biometric/AdmsParser.js
//
// Pure parsing/formatting helpers for the ZKTeco/Identix ADMS ("PUSH") protocol.
// Deliberately free of database access and side effects so it can be unit-tested
// against captured device payloads.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THE DEVICE ACTUALLY SENDS
// ─────────────────────────────────────────────────────────────────────────────
// This is NOT a JSON API. The terminal speaks a plain-text protocol:
//
//   1. Handshake (device boot / periodic):
//        GET /iclock/cdata?SN=ABC123&options=all&pushver=2.4.1&language=69
//      The server must reply with a plain-text key=value config block. If the
//      reply is JSON, or is missing required keys, many firmwares will accept
//      the HTTP 200 and then never push anything — the integration looks
//      "connected" while silently delivering nothing.
//
//   2. Attendance push:
//        POST /iclock/cdata?SN=ABC123&table=ATTLOG&Stamp=9999
//        Content-Type: text/plain
//
//        1001<TAB>2026-08-01 09:30:00<TAB>0<TAB>1<TAB>0<TAB>0<TAB>0
//        1002<TAB>2026-08-01 09:31:12<TAB>1<TAB>1<TAB>0<TAB>0<TAB>0
//
//      Fields: PIN, DateTime, Status(check type), VerifyMode, WorkCode, then
//      firmware-specific reserved columns. Note the identifying information
//      (SN, table) lives in the QUERY STRING, not the body.
//
//   3. Command poll:
//        GET /iclock/getrequest?SN=ABC123
//      Server replies "OK" (nothing to do) or a command string.
//
// Every response must be plain text. The device ignores/chokes on JSON.
// ─────────────────────────────────────────────────────────────────────────────

// ZKTeco "check type" (the Status column). Recorded for audit; see
// BiometricAttendanceService for why we don't blindly trust it.
const ATTLOG_STATUS = {
  0: "CHECK_IN",
  1: "CHECK_OUT",
  2: "BREAK_OUT",
  3: "BREAK_IN",
  4: "OVERTIME_IN",
  5: "OVERTIME_OUT",
};

// Verification method used at the sensor
const VERIFY_MODE = {
  0: "PASSWORD",
  1: "FINGERPRINT",
  2: "CARD",
  3: "PASSWORD",
  4: "CARD",
  15: "FACE",
};

/**
 * Offset (ms) of a named IANA timezone at a given UTC instant.
 * Uses Intl so DST and historical offset changes are handled correctly, with no
 * external dependency and no risk of a date library major-version change
 * silently altering behaviour.
 *
 * @param {Date|number} utcInstant
 * @param {String} timeZone e.g. "Asia/Kolkata"
 * @returns {Number} milliseconds to ADD to UTC to get local wall-clock time
 */
function timeZoneOffsetMs(utcInstant, timeZone) {
  const date = new Date(utcInstant);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = {};
  for (const { type, value } of dtf.formatToParts(date)) {
    if (type !== "literal") parts[type] = value;
  }

  // Intl renders midnight as hour "24" in some environments
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

/**
 * Convert a wall-clock date/time string reported by the device into a real UTC
 * Date.
 *
 * The terminal has no timezone awareness — it reports whatever its own clock
 * reads ("2026-08-01 09:30:00"). Interpreting that as UTC would shift every
 * punch by 5h30m for an IST device, turning a 09:30 arrival into a 15:00 one and
 * marking the whole office late.
 *
 * @param {String} raw e.g. "2026-08-01 09:30:00" or "2026-08-01T09:30:00"
 * @param {String} timeZone IANA zone the device clock is set to
 * @returns {Date|null} null when unparseable
 */
function deviceTimeToUtc(raw, timeZone = "Asia/Kolkata") {
  if (!raw) return null;

  const match = String(raw)
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match.map(Number);

  // Treat the components as if they were UTC, then correct by the zone's offset
  // at that approximate instant. A second pass handles the rare case where the
  // first guess lands on the other side of a DST transition. (India has no DST,
  // but this keeps the helper correct for any deployment.)
  const guess = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  let offset = timeZoneOffsetMs(guess, timeZone);
  let utc = guess - offset;

  const refined = timeZoneOffsetMs(utc, timeZone);
  if (refined !== offset) utc = guess - refined;

  const result = new Date(utc);
  return Number.isNaN(result.getTime()) ? null : result;
}

/**
 * Parse an ATTLOG push body into structured punch records.
 *
 * Tolerant by design: firmwares differ in whether they use tabs or runs of
 * spaces, send CRLF or LF, include a trailing newline, or append extra reserved
 * columns. A malformed line is reported rather than throwing, because one bad
 * row must never cost us the rest of a batch.
 *
 * @param {String} body raw request body
 * @param {String} timeZone device clock timezone
 * @returns {{records: Array, invalid: Array}}
 */
function parseAttlog(body, timeZone = "Asia/Kolkata") {
  const records = [];
  const invalid = [];

  if (!body || typeof body !== "string") return { records, invalid };

  const lines = body.split(/\r?\n/);

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return; // blank / trailing newline

    // Split on tabs, or on 2+ spaces when the firmware pads with spaces.
    // A single space is NOT a separator — it sits inside "2026-08-01 09:30:00".
    const cols = trimmed.includes("\t")
      ? trimmed.split("\t").map((c) => c.trim())
      : trimmed.split(/\s{2,}/).map((c) => c.trim());

    let [pin, dateTime, status, verify, workCode] = cols;

    // Fallback for firmwares that use single spaces throughout:
    // "1001 2026-08-01 09:30:00 0 1 0"
    if (cols.length < 2 || !dateTime) {
      const loose = trimmed.split(/\s+/);
      if (loose.length >= 3) {
        pin = loose[0];
        dateTime = `${loose[1]} ${loose[2]}`;
        status = loose[3];
        verify = loose[4];
        workCode = loose[5];
      }
    }

    const punchedAt = deviceTimeToUtc(dateTime, timeZone);

    if (!pin || !punchedAt) {
      invalid.push({ line: trimmed, lineNumber: index + 1, reason: !pin ? "missing PIN" : "unparseable timestamp" });
      return;
    }

    records.push({
      pin: String(pin).trim(),
      punchedAt,
      deviceTimeRaw: String(dateTime).trim(),
      rawStatus: status !== undefined && status !== "" ? String(status).trim() : "",
      rawVerify: verify !== undefined && verify !== "" ? String(verify).trim() : "",
      rawWorkCode: workCode !== undefined && workCode !== "" ? String(workCode).trim() : "",
      rawLine: trimmed,
      statusLabel: ATTLOG_STATUS[Number(status)] || "UNKNOWN",
      verifyLabel: VERIFY_MODE[Number(verify)] || "UNKNOWN",
    });
  });

  return { records, invalid };
}

/**
 * Build the plain-text handshake response.
 *
 * Getting this wrong is the single most common reason an ADMS integration
 * "connects" but never delivers data — the device requires this exact shape
 * before it will begin pushing.
 *
 * @param {String} serialNumber
 * @param {Object} opts
 */
function buildHandshakeResponse(serialNumber, opts = {}) {
  const {
    // "None" tells the device to send everything it has rather than resuming
    // from a server-side cursor. Our own dedupe index makes re-sends harmless,
    // so this is the safe choice: we would rather receive a punch twice than
    // never receive it.
    attLogStamp = "None",
    opLogStamp = "9999",
    attPhotoStamp = "None",
    errorDelay = 30, // seconds to wait after a failed push
    delay = 10, // seconds between command polls
    transTimes = "00:00;14:05", // scheduled full-sync times
    transInterval = 1, // minutes between incremental pushes
    // Which record types to transmit: AttLog, OpLog, AttPhoto, EnrollUser,
    // ChgUser, EnrollFP, ChgFP, UserPic
    transFlag = "TransData AttLog OpLog AttPhoto EnrollUser ChgUser EnrollFP ChgFP UserPic",
    timeZone = "5.5", // device-facing UTC offset in hours (IST = 5.5)
    realtime = 1, // 1 = push immediately on each punch, don't wait for interval
    encrypt = 0,
  } = opts;

  return [
    `GET OPTION FROM: ${serialNumber}`,
    `ATTLOGStamp=${attLogStamp}`,
    `OPERLOGStamp=${opLogStamp}`,
    `ATTPHOTOStamp=${attPhotoStamp}`,
    `ErrorDelay=${errorDelay}`,
    `Delay=${delay}`,
    `TransTimes=${transTimes}`,
    `TransInterval=${transInterval}`,
    `TransFlag=${transFlag}`,
    `TimeZone=${timeZone}`,
    `Realtime=${realtime}`,
    `Encrypt=${encrypt}`,
    "",
  ].join("\n");
}

/**
 * The device expects "OK" (optionally "OK: <count>") after a successful push.
 * Anything else and it assumes failure and re-sends the same batch forever.
 */
function buildPushAck(count) {
  return typeof count === "number" ? `OK: ${count}` : "OK";
}

module.exports = {
  ATTLOG_STATUS,
  VERIFY_MODE,
  timeZoneOffsetMs,
  deviceTimeToUtc,
  parseAttlog,
  buildHandshakeResponse,
  buildPushAck,
};
