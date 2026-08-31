# 02 — Architecture

## Diagram (CONFIRMED)

```
Browser (HashRouter SPA)
    │  Axios + JWT Bearer
    ▼
React frontend (App.js → AppShell → pages)
    │  REACT_APP_BACKEND_URL/api
    ▼
FastAPI (backend/server.py)
    │  Motor async
    ▼
MongoDB (collections: users, students, student_scores, …)
    │
    ├─► ReportLab / Matplotlib / pdf_report_engine.py  → PDF bytes
    ├─► pandas/openpyxl → Excel
    ├─► SendGrid / Twilio → email/SMS (optional env)
    └─► APScheduler → weekly admin report email
```

## Frontend architecture

**CONFIRMED:**

- `App.js`: auth gate, language/theme/semester/quarter state, class cache, routes.
- `AppShell`: chrome, `TopNavigation`, academic bar, outlet context.
- Pages lazy-loaded except Dashboard.
- Shared libs under `frontend/src/lib/`.
- Design primitives: `components/ui/*` (shadcn), layout heroes, analytics kit.

**INFERRED:** No Redux/Zustand — React state + localStorage/sessionStorage + outlet context.

## Backend architecture

**CONFIRMED:**

- Nearly all API + scoring + PDF chart generation live in **`server.py`** (~8k+ lines).
- `pdf_report_engine.py` provides premium PDF layout; lazy-imports `server` helpers (fonts/shaping).
- `lesson_plan_service.py` handles DOCX/PDF template mapping for lesson plans.
- Lazy Mongo client init (allows offline PDF smoke tests without DNS).

**CONFIRMED exception:** Reward certificate generation remains in `server.py` and currently draws names/award text directly with ReportLab canvas Helvetica fonts. It does not yet use the Amiri + Arabic reshaper/bidi pipeline used by premium Analytics/Reports PDFs, so Arabic certificate text is not guaranteed to render correctly.

## Auth flow

```
Login or Google ID token
  → user record (active + approval status)
  → JWT (sub, role, auth_version, provider)
  → Authorization: Bearer on /api/*
```

Every first-time Google identity, including a Gmail link to an existing local user, is fail-closed with `gmail_approval_status=pending` until an Admin explicitly approves it. Pending/rejected Google sessions receive no usable token. Rejecting a link preserves an existing local password account; a pure Google-created account remains inactive. Provider-less legacy JWTs are invalidated once after this security rollout so old sessions cannot bypass provider-specific checks.

Admin surfaces are protected twice: exact `role_name == Admin` controls frontend visibility for roles/users/promotion/Gmail approvals/notification bell, while `require_admin` remains authoritative on their APIs. Admin notifications poll while an Admin session is open; Gmail requests and Teacher self-service password changes write notification records without storing or exposing passwords.

## Academic term model

```
UI display: Semester 1·Q1|Q2, Semester 2·Q3|Q4
Storage/API: semester 1|2, quarter 1|2
Mapping: displayQuarterNumber(sem,q) → S2 uses q+2
```

Global state must stay synchronized via `setSemester`/`setQuarter` in `App.js`.

## Deployment

**CONFIRMED:** `render.yaml` — Node frontend (`serve -s build`), Python backend (`uvicorn server:app`), optional keep-awake cron.

## Dependencies between layers

| Concern | Frontend | Backend |
|---------|----------|---------|
| Term | `academicScope.js`, outlet | query params semester/quarter |
| Scores | page local editors | `student_scores`, compute_* helpers |
| Levels | `performanceBadges.js` | thresholds in `server.py` |
| PDF labels | export filenames display Q | `_display_quarter_number`, Amiri (except current reward-certificate path) |
| Nav Q1/Q2 paths | `navigationConfig` + AppShell redirect | separate weeks 1–9 vs 10–18 |
