// services/callbackAlarmService.js
//
// Which callbacks should be ringing right now, for one agent.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY DUE-NESS IS DERIVED, NOT PUSHED
// ─────────────────────────────────────────────────────────────────────────────
// The obvious build is a cron job that fires a socket event at the callback's
// due moment. It is also the wrong one: that event reaches only whoever happens
// to be connected and looking at that exact second. An agent on another call,
// on a different page, or with the tab closed misses it permanently, and the
// one thing an alarm must not do is fail silently.
//
// So nothing is "fired". Due-ness is recomputed from the stored date, time,
// snooze and dismissal on every poll. The consequences are all the ones you
// want from an alarm:
//
//   • refresh the page  → still ringing
//   • open a second tab → ringing in both
//   • away for an hour  → waiting when you return, marked overdue
//   • snooze, then reload → still snoozed (the state is in Mongo, not the tab)
//
// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE
// ─────────────────────────────────────────────────────────────────────────────
// `callbackDate` is a Date and `callbackTime` is a bare "HH:MM" string, so the
// two must be combined against SOME zone. This uses the server's local zone,
// which is exactly what the existing `isOverdue` virtual on the model does.
// That consistency is deliberate: two different answers to "when is this due"
// would mean the list badge and the alarm disagree, which is worse than either
// convention on its own. Both share dueAtFor() below so they cannot drift.
'use strict';

const Callback = require('../models/Callback');

/** Statuses that are finished — these never alarm. */
const TERMINAL_STATUSES = ['Completed', 'Cancelled'];

/** How early the quiet heads-up fires, in minutes. */
const HEADS_UP_MINUTES = Number(process.env.CALLBACK_HEADS_UP_MINUTES || 5);

/**
 * How far back an overdue callback still rings, in days.
 *
 * Without a floor, switching this feature on would ring every un-completed
 * callback in the history of the system at once — an alarm storm on deploy
 * day, which teaches everyone to dismiss alarms without reading them. Older
 * items are still overdue and still visible in the callback list; they just
 * stop shouting.
 */
const LOOKBACK_DAYS = Number(process.env.CALLBACK_ALARM_LOOKBACK_DAYS || 7);

/** Snooze durations the API will accept, in minutes. */
const ALLOWED_SNOOZE_MINUTES = [5, 10, 15, 30];

/**
 * The moment a callback is due: its date at its HH:MM.
 *
 * Returns null rather than an Invalid Date for malformed input — a callback
 * with a corrupt time must be skipped, not treated as due at the epoch and
 * rung forever.
 */
function dueAtFor(callback) {
  if (!callback?.callbackDate || !callback?.callbackTime) return null;

  const due = new Date(callback.callbackDate);
  if (Number.isNaN(due.getTime())) return null;

  const [hours, minutes] = String(callback.callbackTime).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  // Bounds matter because setHours ROLLS OVER rather than rejecting: given
  // "99:99" it happily produces a date four days later, so a corrupt time
  // would become a real-looking due moment in the future and the callback
  // would just never ring. The schema has a regex validator, but data written
  // before it existed — or inserted directly — would not have been checked.
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  due.setHours(hours, minutes, 0, 0);
  return due;
}

/**
 * Classify one callback at a given instant.
 *
 * @returns {'ringing'|'headsUp'|'snoozed'|'dismissed'|'pending'|'skip'}
 */
function classify(callback, now = new Date()) {
  if (!callback) return 'skip';
  if (TERMINAL_STATUSES.includes(callback.status)) return 'skip';

  const dueAt = dueAtFor(callback);
  if (!dueAt) return 'skip';

  // Too old to shout about — see LOOKBACK_DAYS.
  const floor = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  if (dueAt < floor) return 'skip';

  // Dismissal is checked BEFORE snooze: an agent who explicitly closed the
  // alarm has answered it, and a stale snooze timestamp underneath must not
  // resurrect it.
  if (callback.alarmDismissedAt) return 'dismissed';

  if (callback.snoozedUntil && new Date(callback.snoozedUntil) > now) {
    return 'snoozed';
  }

  if (dueAt <= now) return 'ringing';

  const headsUpAt = new Date(dueAt.getTime() - HEADS_UP_MINUTES * 60 * 1000);
  if (headsUpAt <= now) return 'headsUp';

  return 'pending';
}

/** Shape handed to the client. Deliberately small — the alarm needs identity
 *  and context, not the whole document. */
function toAlarmPayload(callback, now) {
  const dueAt = dueAtFor(callback);
  return {
    _id: String(callback._id),
    callbackId: callback.callbackId,
    clientName: callback.clientName,
    businessName: callback.businessName,
    callbackType: callback.callbackType,
    priority: callback.priority,
    remarks: callback.remarks || null,
    leadId: callback.leadId ? String(callback.leadId) : null,
    dueAt,
    // Precomputed so the UI doesn't re-derive it and land on a different
    // answer from the server's.
    overdueMinutes: Math.max(0, Math.round((now - dueAt) / 60000)),
    snoozeCount: callback.snoozeCount || 0,
  };
}

/**
 * Everything that should be ringing or warning for this agent, right now.
 *
 * One query, then classified in memory: the due moment is a composite of two
 * fields (a Date and an "HH:MM" string), which Mongo cannot compare against
 * `now` without an aggregation pipeline that would be considerably harder to
 * read than this, for a result set of at most a handful of rows.
 */
async function getActiveAlarms(userId, now = new Date()) {
  // Narrow to the window that could possibly matter before doing any work in
  // JS — without this the scan grows with the agent's entire callback history.
  const floor = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  floor.setHours(0, 0, 0, 0);

  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const candidates = await Callback.find({
    assignedTo: userId,
    status: { $nin: TERMINAL_STATUSES },
    callbackDate: { $gte: floor, $lte: horizon },
  })
    .select(
      'callbackId clientName businessName callbackType priority remarks leadId ' +
        'callbackDate callbackTime status snoozedUntil snoozeCount alarmDismissedAt reminderSent'
    )
    .lean();

  const ringing = [];
  const headsUp = [];

  for (const callback of candidates) {
    const state = classify(callback, now);
    if (state === 'ringing') ringing.push(toAlarmPayload(callback, now));
    // A heads-up that has already been shown is not repeated — otherwise the
    // toast reappears on every poll for the whole five minutes.
    else if (state === 'headsUp' && !callback.reminderSent) {
      headsUp.push(toAlarmPayload(callback, now));
    }
  }

  // Oldest first: the most overdue call is the one to make next.
  ringing.sort((a, b) => a.dueAt - b.dueAt);
  headsUp.sort((a, b) => a.dueAt - b.dueAt);

  return { ringing, headsUp, serverTime: now };
}

/**
 * Snooze an alarm.
 *
 * The duration is validated against a fixed list rather than trusted, so a
 * crafted request can't park a callback a year into the future — which would
 * silently remove it from the agent's day with no trace in the UI.
 */
async function snooze(userId, callbackId, minutes) {
  const mins = Number(minutes);
  if (!ALLOWED_SNOOZE_MINUTES.includes(mins)) {
    const err = new Error(
      `Snooze must be one of ${ALLOWED_SNOOZE_MINUTES.join(', ')} minutes`
    );
    err.statusCode = 400;
    throw err;
  }

  // Scoped to the assignee in the QUERY, not checked afterwards — an agent
  // must not be able to silence someone else's callback by id.
  const updated = await Callback.findOneAndUpdate(
    { _id: callbackId, assignedTo: userId },
    {
      $set: { snoozedUntil: new Date(Date.now() + mins * 60 * 1000) },
      $inc: { snoozeCount: 1 },
    },
    { new: true }
  ).lean();

  if (!updated) {
    const err = new Error('Callback not found');
    err.statusCode = 404;
    throw err;
  }

  return { snoozedUntil: updated.snoozedUntil, snoozeCount: updated.snoozeCount };
}

/**
 * Dismiss an alarm without completing the callback.
 *
 * Deliberately does NOT touch `status`: acknowledging an alarm and having made
 * the call are different facts, and merging them would mark callbacks complete
 * that nobody actioned — corrupting exactly the metric this panel exists to
 * report.
 */
async function dismiss(userId, callbackId) {
  const updated = await Callback.findOneAndUpdate(
    { _id: callbackId, assignedTo: userId },
    { $set: { alarmDismissedAt: new Date() } },
    { new: true }
  ).lean();

  if (!updated) {
    const err = new Error('Callback not found');
    err.statusCode = 404;
    throw err;
  }

  return { alarmDismissedAt: updated.alarmDismissedAt };
}

/** Record that the pre-call heads-up has been shown, so it fires once. */
async function markHeadsUpShown(userId, callbackIds = []) {
  if (!callbackIds.length) return { updated: 0 };

  const result = await Callback.updateMany(
    { _id: { $in: callbackIds }, assignedTo: userId },
    { $set: { reminderSent: true, reminderSentDate: new Date() } }
  );

  return { updated: result.modifiedCount ?? result.nModified ?? 0 };
}

module.exports = {
  ALLOWED_SNOOZE_MINUTES,
  HEADS_UP_MINUTES,
  LOOKBACK_DAYS,
  TERMINAL_STATUSES,
  dueAtFor,
  classify,
  getActiveAlarms,
  snooze,
  dismiss,
  markHeadsUpShown,
};
