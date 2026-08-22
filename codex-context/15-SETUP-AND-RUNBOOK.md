# 15 — Setup and Runbook

## Academic calendar PDF import

- Calendar data comes from an Admin-uploaded, approved Al Anjal school PDF. Normal page loading makes no Ministry or other external calendar request.
- `backend/calendar_pdf_import.py` extracts the four-page school template once, validates 19 teaching weeks per semester plus required holidays/events, and flags malformed source cells for manual review.
- `/api/calendar/import` parses fully before writing. It inserts an immutable event version first and changes that academic year's active pointer only after the insert succeeds.
- `/api/calendar/years` lists preserved years. `/api/calendar/events` and `/api/calendar/status` accept an optional historical `academic_year`; omission resolves the current imported year by its date range.
- The same records serve both school sections. No section-specific calendar copies are created.
- No additional environment variable is required.

## Prerequisites

- Node.js (project historically targets modern Node; Render frontend is Node runtime)
- Python **3.13** (see `render.yaml` / `.python-version`)
- MongoDB Atlas or compatible `MONGO_URL`

### Verified local development baseline (CONFIRMED 2026-08-22)

- Python **3.13.15** is installed and working locally.
- The broken repository-root `.venv` was removed and successfully recreated with Python 3.13.15.
- Existing backend dependencies install successfully from `backend/requirements.txt`; `pip check` reports no broken requirements.
- Node.js **20.20.0** and npm **10.8.2** are working locally.
- `.venv`, `frontend/node_modules`, `frontend/build`, and backend PDF smoke outputs are ignored local artifacts and must not be committed.

## Install

```bash
# Frontend
cd frontend
npm ci

# Backend (from repository root)
python -m venv .venv
# activate .venv for your OS, then:
python -m pip install -r backend/requirements.txt
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

`npm run build` uses POSIX inline environment-variable syntax and works in the Linux Render environment, but is not directly portable to Windows `cmd.exe`. Verified Windows PowerShell equivalent:

```powershell
cd frontend
$env:DISABLE_ESLINT_PLUGIN="true"
npm exec -- craco build
node scripts/postbuild-spa.cjs
```

The Windows-equivalent command compiled the production build successfully on 2026-08-22. Do not change the build script or dependencies merely to remove this portability limitation without explicit approval.

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

### Baseline verification results (2026-08-22)

- Backend focused pytest: **22 synchronous tests passed**; the legacy async `test_connection.py` still requires a pytest async plugin when the entire folder is collected.
- Offline `server.py` import: **passed**.
- Offline International quarter, International semester/midterm, and Arabic quarter PDF smoke generation: **passed**. Multipage inspection found no blank/near-empty pages; Arabic output embeds Amiri and contains no replacement/tofu glyphs.
- Frontend Jest: **2 suites / 7 tests passed**.
- Frontend production compilation via the Windows-equivalent command: **passed**.
- Live MongoDB/login/integration scripts were intentionally not run because they require external credentials and may read or mutate live services.

`npm ci` currently reports **58 dependency vulnerabilities** (12 low, 14 moderate, 30 high, 2 critical). Do **not** run `npm audit fix`, force upgrades, or change dependency versions without explicit owner approval and a scoped compatibility/security review.

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
