# System checkup – reliability and performance

This document summarizes a full-stack check of the Al Anjal School Follow-up Record app (frontend, backend, deployment) and the fixes applied so the site behaves reliably like other well-performing websites.

---

## 1. What was audited

| Area | What was checked |
|------|------------------|
| **Frontend** | API client timeouts, health check, error handling, login/server messages, file uploads |
| **Backend** | Health endpoint, CORS, startup, MongoDB, error responses |
| **Deployment** | Vercel (frontend), Render (backend), env vars, cold start |

---

## 2. Issues found and fixes applied

### 2.1 Backend – CORS origins

- **Issue:** `CORS_ORIGINS` was split by comma without trimming. A value like `https://a.vercel.app, https://b.vercel.app` could produce an origin with a leading space and CORS could reject requests.
- **Fix:** Origins are now trimmed: `[o.strip() for o in raw.split(",") if o.strip()]`.

### 2.2 Frontend – user-friendly API errors

- **Issue:** On timeout or network failure, users saw raw messages like “timeout of 90000ms exceeded” or “Network Error”, which hurt trust and clarity.
- **Fix:** Added `getApiErrorMessage(error)` in `api.js` to return clear text for timeouts/network (including “server may be waking up” on production). Dashboard now uses it for loading and import errors; other pages can use it in `catch` blocks: `toast.error(getApiErrorMessage(error))`.

### 2.3 Already in place (from earlier work)

- **Production timeouts:** 90-second health check and API timeout when the backend URL is Render, so cold start has time to complete.
- **Login UX:** “Checking server…”, “Server may be waking up…”, and login button stays clickable on production so users can try again.
- **Excel import:** Name/class detection by content (any column order), new classes created from codes (4A, 5B, etc.), clearer “no students imported” message.

---

## 3. What causes slowness and “server not connected”

### 3.1 Render free tier (backend)

- The backend **spins down after about 15 minutes** of no traffic.
- The **first request** after spin-down (login, dashboard, import, etc.) can take **50+ seconds** while the server wakes up.
- Until that first request completes, the frontend may show “Server not connected” or “Server may be waking up” if the health check or first API call is still in progress.

So: **slowness and connection messages are expected when the backend has been idle**, not necessarily a bug in your app.

### 3.2 How to make it feel like a “well-performing” site

1. **Keep the backend awake (recommended)**  
   Use a free uptime pinger so the server is rarely sleeping:
   - **[UptimeRobot](https://uptimerobot.com)** (or similar): create an HTTP monitor for `https://al-anjal-follow-up-e-g.onrender.com/health` with a **5–10 minute** interval.
   - Result: Backend stays warm; first load and actions stay fast and reliable.

2. **Vercel (frontend)**  
   - Ensure **Environment Variable** `REACT_APP_BACKEND_URL` is set to your Render URL (e.g. `https://al-anjal-follow-up-e-g.onrender.com`) for **Production** (and Preview if you use it).
   - Redeploy after changing env vars so the build picks them up.

3. **Render (backend)**  
   - **Environment** → `CORS_ORIGINS` = your exact Vercel URL (e.g. `https://al-anjal-follow-up-e-g.vercel.app`), no trailing slash.
   - After changing env, Render redeploys automatically.

---

## 4. Quick checklist for “everything works smoothly”

| Check | Where | What to verify |
|-------|--------|----------------|
| Backend URL in frontend | Vercel → Project → Settings → Environment Variables | `REACT_APP_BACKEND_URL` = `https://...onrender.com` (no `/api`) |
| CORS | Render → Service → Environment | `CORS_ORIGINS` = `https://...vercel.app` (no trailing slash, no extra spaces) |
| Backend awake | UptimeRobot (or similar) | HTTP monitor every 5–10 min to `.../health` |
| Login | Live site | After idle: wait up to ~1 min once; then login and navigation should be fast |
| Excel import | Dashboard or Students | File with name + class (any order); no “class column required” or “no students” unless file really has no valid name/class |

---

## 5. Optional improvements (later)

- **Other pages:** Use `getApiErrorMessage(error)` in more `catch` blocks (Students, Settings, Reports, etc.) so all API failures show the same friendly timeout/network message where applicable.
- **Loading states:** Ensure every button that triggers an API call shows a loading state so users don’t think the app is stuck during the first slow request after idle.
- **Paid tier:** If you move the backend to a paid plan (e.g. Render paid) that does not spin down, cold-start delay and “server waking up” messages go away without UptimeRobot.

---

## 6. Summary

- **CORS** and **API error messages** were fixed in code; **timeouts** and **login/server messaging** were already adjusted for production.
- **Slowness and “server not connected”** are mainly due to **Render free tier spin-down**; they are addressed by **longer timeouts**, **clearer messages**, and **keeping the server awake** (e.g. UptimeRobot).
- With **correct env vars** and an **uptime ping**, the site can run **efficiently and reliably** like other well-performing websites.
