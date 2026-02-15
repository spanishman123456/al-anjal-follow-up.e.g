import axios from "axios";

// Backend must be running (Start_App.bat) for login and all features
const BACKEND_ROOT = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
const API_BASE = `${BACKEND_ROOT}/api`;

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
});

/** Check if backend server is reachable (for login page status). */
export async function checkBackendHealth() {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await fetch(`${BACKEND_ROOT}/health`, { method: "GET", signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

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

export const API_BASE_URL = API_BASE;
export const BACKEND_ROOT_URL = BACKEND_ROOT;