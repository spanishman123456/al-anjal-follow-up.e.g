# 15 — Setup and Runbook

## Prerequisites

- Node.js (project historically targets modern Node; Render frontend is Node runtime)
- Python **3.13** (see `render.yaml` / `.python-version`)
- MongoDB Atlas or compatible `MONGO_URL`

### Current local Python environment warning (CONFIRMED 2026-08-22)

- `.python-version` requests Python 3.13 and Render pins Python 3.13.5.
- The existing repository-root `.venv/pyvenv.cfg` was created from Python 3.14 and points to an interpreter path that is no longer available on this machine.
- Do not rely on that `.venv` until it has been recreated with an installed Python 3.13 runtime. This is a local environment issue, not an application dependency change.
- After installing Python 3.13, recreate the virtual environment using the normal platform command and reinstall `backend/requirements.txt`; do not commit the virtual environment.

## Install

```bash
# Frontend
cd frontend
npm ci

# Backend
cd backend
python -m venv .venv
# activate venv for your OS
pip install -r requirements.txt
```

## Environment variable **names** (no values)

### Backend (common)

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `CORS_ORIGINS`
- `RESET_PASSWORD_SECRET`
- `SENDGRID_API_KEY`
- `SENDER_EMAIL`
- `SENDER_NAME`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `ADMIN_SMS_NUMBER`
- `ADMIN_EMAIL`
- `RECOVERY_ID`
- `RECOVERY_PASSWORD`
- `FRONTEND_URL`
- `PUBLIC_FRONTEND_URL`
- `RENDER`
- `BACKEND_HEALTH_URL` (keep-awake cron)

### Frontend

- `REACT_APP_BACKEND_URL`
- `REACT_APP_GOOGLE_CLIENT_ID` (if used by Login — verify `Login.jsx`)

Copy from `backend/.env.example` / `backend/env.example` / `frontend/.env.example`. **Never commit `.env`.**

## Run locally

```bash
# Backend
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
# Windows PowerShell may need: $env:DISABLE_ESLINT_PLUGIN="true"
npm start
```

Helpers: `Start_App.bat`, `backend/start_backend.bat`, `HOW_TO_START.txt`.

## Build / production serve

```bash
cd frontend
npm run build
npm run serve:prod   # as per package.json / Render
```

Backend: `uvicorn server:app --host 0.0.0.0 --port $PORT`

## Tests

```bash
cd backend
pytest
# or targeted:
python test_score_calculation.py
python scripts/test_pdf_export.py --lang ar
```

Frontend: `npm test` (limited coverage).

If Python commands fail before test collection because the interpreter cannot be found, verify the active interpreter and recreate the stale root `.venv` with Python 3.13 before treating the failure as an application-test regression.

## Lint / format (backend tooling present)

`black`, `isort`, `flake8`, `mypy` listed in requirements — not mandatory gate in all workflows.

## Deploy

- Primary: **Render** via `render.yaml` (frontend Node web + backend Python web + optional cron).
- Docs: `DEPLOY-FULL-ON-RENDER.md`, `DEPLOYMENT.md`.

## PDF offline smoke (no Mongo DNS)

```bash
cd backend
python scripts/test_pdf_export.py --lang ar
# outputs under backend/test_exports/ (gitignored)
```
