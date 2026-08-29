import {
  AUTH_LOGOUT_REASON_KEY,
  IDLE_SESSION_ACTIVITY_KEY,
  IDLE_SESSION_TIMEOUT_MS,
  clearIdleSessionActivity,
  getStoredLogoutReason,
  markIdleSessionActivity,
  setStoredLogoutReason,
  startIdleSessionMonitor,
} from "./idleSession";

describe("idle session protection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-29T08:00:00Z"));
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    localStorage.clear();
  });

  it("logs out after exactly 30 minutes without activity", () => {
    const onIdle = jest.fn();
    const stop = startIdleSessionMonitor({ onIdle });

    jest.advanceTimersByTime(IDLE_SESSION_TIMEOUT_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });

  it("resets the deadline when the user interacts with the page", () => {
    const onIdle = jest.fn();
    const stop = startIdleSessionMonitor({ onIdle });

    jest.advanceTimersByTime(20 * 60 * 1000);
    window.dispatchEvent(new Event("pointerdown"));
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(onIdle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(20 * 60 * 1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not revive a session when the first interaction happens after its deadline", () => {
    const onIdle = jest.fn();
    markIdleSessionActivity(Date.now() - IDLE_SESSION_TIMEOUT_MS);

    const stop = startIdleSessionMonitor({ onIdle });

    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });

  it("uses newer activity from another tab", () => {
    const onIdle = jest.fn();
    const stop = startIdleSessionMonitor({ onIdle });

    jest.advanceTimersByTime(20 * 60 * 1000);
    const otherTabActivity = Date.now();
    localStorage.setItem(IDLE_SESSION_ACTIVITY_KEY, String(otherTabActivity));
    window.dispatchEvent(new StorageEvent("storage", {
      key: IDLE_SESSION_ACTIVITY_KEY,
      newValue: String(otherTabActivity),
    }));
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(onIdle).not.toHaveBeenCalled();

    jest.advanceTimersByTime(20 * 60 * 1000);
    expect(onIdle).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stores logout reasons and clears activity safely", () => {
    markIdleSessionActivity();
    setStoredLogoutReason("idle_timeout");

    expect(getStoredLogoutReason()).toBe("idle_timeout");
    expect(localStorage.getItem(AUTH_LOGOUT_REASON_KEY)).toBe("idle_timeout");

    clearIdleSessionActivity();
    expect(localStorage.getItem(IDLE_SESSION_ACTIVITY_KEY)).toBeNull();
  });
});
