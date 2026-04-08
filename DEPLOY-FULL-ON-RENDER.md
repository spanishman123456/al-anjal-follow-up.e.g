## Deploy frontend + backend on Render

This project can run fully on Render (not Vercel) using the existing `render.yaml`.

### What is included

- `al-anjal-frontend` (Static Site) from `frontend/`
- `al-anjal-backend` (Python Web Service) from `backend/`
- Optional keep-awake cron for backend

### One-time setup in Render

1. Open Render dashboard.
2. Click **New +** -> **Blueprint**.
3. Select this GitHub repository and branch `main`.
4. Render will detect `render.yaml` and create services.

### Required environment variables

Set these in Render before first successful run:

- For **backend**:
  - `MONGO_URL` (secret)
  - `JWT_SECRET` (secret)
  - `DB_NAME` (example: `school_db`)
  - `CORS_ORIGINS` (set to your frontend Render URL after frontend deploy)

- For **frontend**:
  - `REACT_APP_BACKEND_URL` (set to backend Render URL, no trailing `/api`)
    - Example: `https://al-anjal-follow-up-e-g.onrender.com`

### After deploy

1. Copy frontend URL from `al-anjal-frontend`.
2. Update backend `CORS_ORIGINS` to that exact frontend URL.
3. Redeploy backend once.

### Important performance note

Render free backend can sleep after inactivity. First request may take 30-60 seconds.
If this is the speed issue, moving frontend from Vercel to Render will not remove backend cold start.

