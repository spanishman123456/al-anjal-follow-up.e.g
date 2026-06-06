## Deploy frontend + backend on Render

This project runs **entirely on Render** (frontend and backend). Use the Blueprint in `render.yaml`.

### What is included

- `al-anjal-frontend` — **Node Web Service** (`npm run build` + `npm run serve:prod` for React Router / SPA)
- `al-anjal-backend` — Python Web Service (`uvicorn server:app`)
- Optional keep-awake cron for the backend (`/health` ping)

### One-time setup in Render

1. Open [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Select this GitHub repository and branch `main`.
4. Render detects `render.yaml` and creates the services.
5. Set required secrets when prompted (see below).

### Required environment variables

**Backend** (`al-anjal-backend`):

| Key | Notes |
|-----|--------|
| `MONGO_URL` | MongoDB Atlas connection string (secret) |
| `JWT_SECRET` | Long random secret |
| `DB_NAME` | e.g. `school_db` |
| `CORS_ORIGINS` | Your **frontend** Render URL after first deploy (no trailing slash) |

**Frontend** (`al-anjal-frontend`):

| Key | Notes |
|-----|--------|
| `REACT_APP_BACKEND_URL` | Backend Render URL, e.g. `https://al-anjal-follow-up-e-g.onrender.com` — **no** `/api` suffix |

Optional Gmail login: `GOOGLE_CLIENT_ID` (backend) and `REACT_APP_GOOGLE_CLIENT_ID` (frontend, same value). See [GMAIL_LOGIN_SETUP.md](GMAIL_LOGIN_SETUP.md).

### After first deploy

1. Copy the **frontend** service URL from Render.
2. Set backend `CORS_ORIGINS` to that exact URL.
3. **Redeploy the backend** once.

### Deploying updates

1. Push to `main` on GitHub.
2. Render auto-deploys both services (if connected), or use **Manual Deploy → Deploy latest commit** on each service.
3. Frontend env changes require a **new build** (redeploy), not just a restart.

### Two different URLs (normal)

| URL | What it is |
|-----|------------|
| Backend `https://…onrender.com` | API — `/health`, `/docs`, JSON |
| Frontend `https://…onrender.com` | **Website** — login page and app |

Always share the **frontend** URL with teachers.

### SPA routing (“Not Found” on refresh)

The Blueprint frontend uses Node + `serve -s build`, so React Router works without extra rewrite rules.

If you still have an **old manual Static Site** on Render, delete it or add rewrite `/*` → `/index.html`, or recreate the frontend using `render.yaml`.

### Performance (free tier)

Render free services can sleep after inactivity. The first request may take 30–60 seconds (cold start). The optional cron job in `render.yaml` pings `/health` to reduce sleep; you can also use UptimeRobot on the backend `/health` URL.

### Related docs

- [DEPLOYMENT.md](DEPLOYMENT.md) — overview and troubleshooting
- [DEPLOY-UPDATES.md](DEPLOY-UPDATES.md) — push and redeploy workflow
- [GMAIL_LOGIN_SETUP.md](GMAIL_LOGIN_SETUP.md) — Google sign-in env vars on Render
