# Deploy Al Anjal School Follow-up Record

**Frontend and backend both run on [Render](https://render.com).** Vercel is no longer used for this project.

For step-by-step setup, see **[DEPLOY-FULL-ON-RENDER.md](DEPLOY-FULL-ON-RENDER.md)**.

---

## What you get

| Service | Host | Example URL |
|---------|------|-------------|
| **Frontend** (React app) | Render Web Service | `https://al-anjal-frontend.onrender.com` |
| **Backend** (FastAPI API) | Render Web Service | `https://al-anjal-follow-up-e-g.onrender.com` |
| **Database** | MongoDB Atlas | (your existing cluster) |

Open the **frontend** URL in the browser. The **backend** URL returns JSON (`/health`, `/docs`) — it is not the login page.

---

## Quick deploy after code changes

1. Commit and push to GitHub (`main`).
2. In **Render**, open **both** services (frontend + backend).
3. Wait for auto-deploy, or use **Manual Deploy → Deploy latest commit** on each.
4. Confirm the deploy includes your latest commit hash.

---

## Required environment variables

### Backend (`al-anjal-backend`)

| Variable | Example |
|----------|---------|
| `MONGO_URL` | Your Atlas connection string |
| `JWT_SECRET` | Long random secret |
| `DB_NAME` | `school_db` |
| `CORS_ORIGINS` | Your **frontend** Render URL (no trailing slash) |

Optional: `GOOGLE_CLIENT_ID` for Gmail sign-in — see [GMAIL_LOGIN_SETUP.md](GMAIL_LOGIN_SETUP.md).

### Frontend (`al-anjal-frontend`)

| Variable | Example |
|----------|---------|
| `REACT_APP_BACKEND_URL` | `https://al-anjal-follow-up-e-g.onrender.com` (no `/api`) |

Optional: `REACT_APP_GOOGLE_CLIENT_ID` (same value as backend `GOOGLE_CLIENT_ID`).

**Important:** React reads `REACT_APP_*` at **build time**. After changing frontend env vars, trigger a **new deploy** (not just a restart).

---

## First-time setup

Use **Render Blueprint** with the repo’s `render.yaml`:

1. Render dashboard → **New +** → **Blueprint**.
2. Connect this GitHub repo, branch `main`.
3. Set secret env vars when prompted (`MONGO_URL`, `REACT_APP_BACKEND_URL`, etc.).
4. After the frontend deploys, copy its URL and set backend `CORS_ORIGINS` to that exact URL, then redeploy the backend once.

Details: [DEPLOY-FULL-ON-RENDER.md](DEPLOY-FULL-ON-RENDER.md).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails / “Cannot reach backend” | Frontend `REACT_APP_BACKEND_URL` must be the backend Render URL. Open `…/health` in a browser — should return OK. |
| CORS errors in browser console | Backend `CORS_ORIGINS` must match the **frontend** Render URL exactly (no trailing slash). |
| First request very slow (~30–60 s) | Render free tier cold start. Use the keep-awake cron in `render.yaml` or an external ping to `/health`. |
| “Not Found” on refresh inside the app | Frontend must use Node + `npm run serve:prod` (see `render.yaml`), not a static site without SPA rewrite. |

---

## Legacy docs

Older guides that mention Vercel are outdated. Use **DEPLOY-FULL-ON-RENDER.md** and this file instead.
