import axios from "axios";

// Backend must be running (Start_App.bat locally) or deployed (e.g. Render)
const BACKEND_ROOT = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API_BASE = `${BACKEND_ROOT}/api`;

// Render free tier spins down after ~15 min; cold start can take 50+ seconds
const isProductionBackend = (BACKEND_ROOT || "").includes("onrender.com");
// Health check must outlast Render cold start; short timeout causes false "offline" and UI flicker every few seconds
const HEALTH_CHECK_MS = isProductionBackend ? 90000 : 10000;
const API_TIMEOUT_MS = isProductionBackend ? 120000 : 30000; // 2 min for production (bulk save can be slow)
/** Use for bulk-scores and other long-running writes to avoid timeout. */
export const BULK_SAVE_TIMEOUT_MS = isProductionBackend ? 180000 : 60000; // 3 min prod, 1 min dev

export const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
});

export const AUTH_TOKEN_KEY = "auth_token";

export function getStoredAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
  try {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // ignore storage errors
  }
}

export function clearStoredAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
  try {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

/** Check if backend server is reachable (for login page status). */
export async function checkBackendHealth() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), HEALTH_CHECK_MS);
    const r = await fetch(`${BACKEND_ROOT}/health`, { method: "GET", signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/** True when the API accepts HTTP (Render dyno awake). Does not wait on Mongo — see /health for DB. */
export async function checkBackendLive() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), HEALTH_CHECK_MS);
    const r = await fetch(`${BACKEND_ROOT}/health/live`, { method: "GET", signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/** Fire-and-forget warm-up ping to reduce cold-start delays (hits /health/live, not /health, so Mongo is not required). */
export function warmBackendInBackground() {
  return fetch(`${BACKEND_ROOT}/health/live`, {
    method: "GET",
    cache: "no-store",
    keepalive: true,
  }).catch(() => null);
}

export const isProductionBackendUrl = isProductionBackend;

api.interceptors.request.use((config) => {
  const token = getStoredAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = `${error?.config?.baseURL || ""}${error?.config?.url || ""}`;
    const isAuthRequest = /\/auth\/(login|google)(\/|$)/.test(requestUrl);
    if (error?.response?.status === 401 && !isAuthRequest) {
      // Ignore duplicate 401s from parallel requests — token is already cleared on the first one.
      if (!getStoredAuthToken()) {
        return Promise.reject(error);
      }
      const detail = error?.response?.data?.detail;
      clearStoredAuthToken();
      window.dispatchEvent(new CustomEvent("auth-logout", {
        detail: {
          reason: detail === "Session expired by a newer login" ? "session_replaced" : "unauthorized",
          message: typeof detail === "string" ? detail : null,
        },
      }));
    }
    return Promise.reject(error);
  },
);

/**
 * User-friendly message for API errors (timeout, network, or server detail).
 * Use in catch blocks: toast.error(getApiErrorMessage(error))
 */
export function getApiErrorMessage(error) {
  if (!error) return "Something went wrong.";
  if (error.code === "ECONNABORTED" || error.message === "Network Error") {
    return isProductionBackend
      ? "Request timed out or server unreachable. The server may be waking up—please try again in a minute."
      : "Request timed out or server unreachable. Make sure the backend is running (Start_App.bat).";
  }
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") return detail.msg || JSON.stringify(detail);
  return error.message || "Something went wrong.";
}

export const API_BASE_URL = API_BASE;
export const BACKEND_ROOT_URL = BACKEND_ROOT;