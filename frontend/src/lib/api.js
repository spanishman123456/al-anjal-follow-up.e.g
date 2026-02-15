import axios from "axios";

// Backend must be running (Start_App.bat locally) or deployed (e.g. Render)
const BACKEND_ROOT = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API_BASE = `${BACKEND_ROOT}/api`;

// Render free tier spins down after ~15 min; cold start can take 50+ seconds
const isProductionBackend = (BACKEND_ROOT || "").includes("onrender.com");
const HEALTH_CHECK_MS = isProductionBackend ? 90000 : 4000;
const API_TIMEOUT_MS = isProductionBackend ? 120000 : 30000; // 2 min for production (bulk save can be slow)
/** Use for bulk-scores and other long-running writes to avoid timeout. */
export const BULK_SAVE_TIMEOUT_MS = isProductionBackend ? 180000 : 60000; // 3 min prod, 1 min dev

export const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
});

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

export const isProductionBackendUrl = isProductionBackend;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("auth_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
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