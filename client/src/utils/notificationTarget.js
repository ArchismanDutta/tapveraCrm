// utils/notificationTarget.js
//
// One place that answers "where does this notification take you?".
//
// Three surfaces need that answer and each used to carry its own version:
// the notification list, the in-app toast, and OS/desktop notifications.
// They disagreed. The toast sent chat clicks to "/chat" and payslip clicks to
// a "#payslip" hash — neither is a route — and desktop notifications only
// focused the window without navigating anywhere at all.
//
// Two payload shapes arrive here. A notification fetched from the API keeps
// its identifiers under `relatedData`; the live socket payload spreads those
// same identifiers onto the top level. Both are accepted.

const pick = (notification, key) => {
  if (!notification) return null;
  const nested = notification.relatedData && notification.relatedData[key];
  return nested ?? notification[key] ?? null;
};

/**
 * Repair paths that were emitted before the routes settled. Old rows in the
 * database still carry them, so they are fixed on the way out rather than
 * left to fall through to the 404 route.
 */
const normalizePath = (path) => {
  if (!path || typeof path !== "string") return null;
  if (path === "/chat") return "/messages";
  if (path === "/payslips") return "/my-payslips";
  // The project detail route is singular: /project/:projectId
  return path.replace(/^\/projects\/([^/?#]+)/, "/project/$1");
};

/** Append ?key=value, unless the path already carries that key. */
const withQuery = (path, key, value) => {
  if (!value) return path;
  const [base, hash] = path.split("#");
  if (new RegExp(`[?&]${key}=`).test(base)) return path;
  const separator = base.includes("?") ? "&" : "?";
  const suffix = hash ? `#${hash}` : "";
  return `${base}${separator}${key}=${encodeURIComponent(value)}${suffix}`;
};

/**
 * Where a notification should take the user.
 *
 * The identifier decides the destination and the server's `url` is kept as
 * the base path when it has one, because some notifications are role-aware
 * (a leave request sends approvers to /admin/leaves and the employee to
 * /leaves). The identifier is then added as a query parameter so the same
 * link works from an OS notification, which can only hand over a URL — React
 * Router state does not survive a click from outside the tab.
 *
 * @param {Object} notification
 * @returns {{path: string, state: Object}|null}
 */
export const resolveNotificationTarget = (notification) => {
  if (!notification) return null;

  const url = normalizePath(pick(notification, "url"));
  const messageId = pick(notification, "messageId");

  const conversationId = pick(notification, "conversationId");
  if (conversationId) {
    let path = withQuery(url || "/messages", "conversation", conversationId);
    path = withQuery(path, "message", messageId);
    return { path, state: { openConversationId: conversationId, messageId } };
  }

  const projectId = pick(notification, "projectId");
  if (projectId) {
    const path = withQuery(url || `/project/${projectId}`, "message", messageId);
    return { path, state: { scrollToMessages: true, messageId } };
  }

  const taskId = pick(notification, "taskId");
  if (taskId) {
    return {
      path: withQuery(url || "/tasks", "task", taskId),
      state: { highlightTaskId: taskId },
    };
  }

  const payslipId = pick(notification, "payslipId");
  if (payslipId) {
    return {
      path: withQuery(url || "/my-payslips", "payslip", payslipId),
      state: { highlightPayslipId: payslipId },
    };
  }

  const leaveId = pick(notification, "leaveId");
  if (leaveId) {
    return {
      path: withQuery(url || "/leaves", "leave", leaveId),
      state: { highlightLeaveId: leaveId },
    };
  }

  // Nothing identifiable: honour a plain url, otherwise the notification
  // centre, where the user can at least see what arrived.
  return { path: url || "/notifications", state: {} };
};

/** The same destination as a plain URL, for notifications shown by the OS. */
export const notificationTargetUrl = (notification) => {
  const target = resolveNotificationTarget(notification);
  return target ? target.path : null;
};

/**
 * Navigate the app to a URL from outside React Router.
 *
 * Desktop notification click handlers live in a plain module with no access
 * to the router, so they raise an event the app listens for. If nothing
 * answers — the listener has not mounted, or the tab is mid-reload — the
 * navigation still happens, just with a full page load.
 */
export const navigateFromNotification = (url) => {
  if (!url) return;
  const event = new CustomEvent("notification-navigate", {
    detail: { url, handled: false },
  });
  window.dispatchEvent(event);

  if (!event.detail.handled) {
    window.location.assign(url);
  }
};
