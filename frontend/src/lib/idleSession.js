export const IDLE_SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_SESSION_ACTIVITY_KEY = "auth_last_activity_at";
export const AUTH_LOGOUT_REASON_KEY = "auth_logout_reason";

const USER_ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll", "touchstart"];

export function readIdleSessionActivity() {
  try {
    const value = Number(localStorage.getItem(IDLE_SESSION_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function markIdleSessionActivity(at = Date.now()) {
  try {
    localStorage.setItem(IDLE_SESSION_ACTIVITY_KEY, String(at));
  } catch {
    // The in-memory monitor still protects the current tab when storage is unavailable.
  }
  return at;
}

export function clearIdleSessionActivity() {
  try {
    localStorage.removeItem(IDLE_SESSION_ACTIVITY_KEY);
  } catch {
    // ignore storage errors
  }
}

export function setStoredLogoutReason(reason) {
  try {
    if (reason) localStorage.setItem(AUTH_LOGOUT_REASON_KEY, reason);
    else localStorage.removeItem(AUTH_LOGOUT_REASON_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getStoredLogoutReason() {
  try {
    return localStorage.getItem(AUTH_LOGOUT_REASON_KEY);
  } catch {
    return null;
  }
}

/**
 * Monitor deliberate browser activity and expire the authenticated session after
 * a fixed idle period. The timestamp is shared through localStorage so reloads
 * and multiple tabs observe the same inactivity deadline.
 */
export function startIdleSessionMonitor({
  onIdle,
  timeoutMs = IDLE_SESSION_TIMEOUT_MS,
  now = () => Date.now(),
} = {}) {
  if (typeof onIdle !== "function") {
    throw new TypeError("startIdleSessionMonitor requires an onIdle callback");
  }

  let stopped = false;
  let timerId = null;
  let lastActivity = readIdleSessionActivity();

  if (!lastActivity) {
    lastActivity = markIdleSessionActivity(now());
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timerId !== null) clearTimeout(timerId);
    USER_ACTIVITY_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, handleActivity, true);
    });
    window.removeEventListener("focus", checkDeadline);
    window.removeEventListener("storage", handleStorage);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };

  const expire = () => {
    if (stopped) return;
    stop();
    onIdle();
  };

  const scheduleDeadline = () => {
    if (stopped) return;
    if (timerId !== null) clearTimeout(timerId);
    const remaining = timeoutMs - (now() - lastActivity);
    if (remaining <= 0) {
      expire();
      return;
    }
    timerId = setTimeout(checkDeadline, remaining);
  };

  function checkDeadline() {
    if (stopped) return;
    const storedActivity = readIdleSessionActivity();
    if (storedActivity && storedActivity > lastActivity) lastActivity = storedActivity;
    scheduleDeadline();
  }

  function handleActivity() {
    if (stopped) return;
    // A user returning after the deadline must sign in again; their first click
    // must not silently revive an already-expired session.
    if (now() - lastActivity >= timeoutMs) {
      expire();
      return;
    }
    lastActivity = markIdleSessionActivity(now());
    scheduleDeadline();
  }

  function handleStorage(event) {
    if (event.key !== IDLE_SESSION_ACTIVITY_KEY || !event.newValue) return;
    const storedActivity = Number(event.newValue);
    if (!Number.isFinite(storedActivity) || storedActivity <= lastActivity) return;
    lastActivity = storedActivity;
    scheduleDeadline();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") checkDeadline();
  }

  USER_ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, handleActivity, { capture: true, passive: true });
  });
  window.addEventListener("focus", checkDeadline);
  window.addEventListener("storage", handleStorage);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  scheduleDeadline();

  return stop;
}
