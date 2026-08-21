# 01 — Project Overview

**Handoff date:** 2026-08-21  
**Classification key:** CONFIRMED = in code; INFERRED = strong pattern; UNCERTAIN = insufficient evidence; PLANNED = backlog/PRD only.

---

## What this project is

**CONFIRMED:** A school operations web app named **Al Anjal School Follow-up Record** (Arabic: سجل متابعة مدارس الأنجال) for tracking **student academic follow-up marks**, assessments, finals, performance levels, analytics, and administrative reports for Al Anjal National Schools.

Primary users: **Admin**, **Teacher** (class-scoped). Role **Counselor** exists in seeds/permissions but is not a first-class route enforcer.

## What it is not

**CONFIRMED:**

- Not a daily **present/absent attendance** system.
- Not a full LMS (no content delivery, no homework submission portal beyond score fields).
- Not Vercel-hosted (docs and config point to **Render**).

## Core product pillars (CONFIRMED)

1. **Student & class records** (grades 4–8, A/B).
2. **Weekly follow-up scores** (attendance/participation/behavior/homework → /15).
3. **Quizzes + chapter tests** → assessment /30.
4. **Quarter practical + theory exams** → quarter total /50.
5. **Performance bands** and support lists.
6. **Analytics & Reports** with PDF/Excel (Arabic-capable).
7. **Programs:** remedial plans, rewards/certificates, lesson-plan generator.
8. **Admin:** users/teachers, Gmail approval, calendar, notifications, settings, promotion.

## Current maturity (INFERRED from code + git + PRD)

| Area | Status |
|------|--------|
| Auth JWT + Google pending approval | Working (CONFIRMED) |
| Score entry pipelines | Working; fragile due to duplication (CONFIRMED) |
| Analytics/Reports/PDF premium redesign | Recently hardened (CONFIRMED via commits) |
| Top nav + PageHero consistency | Recently shipped (CONFIRMED) |
| Global term sync | Recently fixed (CONFIRMED) |
| PRD backlog items (permission matrix, etc.) | Partially outdated vs code (INFERRED) |

## Tech snapshot

| Layer | Stack |
|-------|--------|
| Frontend | React CRA + Craco, Tailwind, shadcn/Radix, Recharts, HashRouter |
| Backend | FastAPI, Motor/MongoDB, JWT, ReportLab, Matplotlib, pandas |
| Hosting | Render (`render.yaml`) |
| DB | MongoDB Atlas (`MONGO_URL`, `DB_NAME`) |

## Repository layout (top level)

- `frontend/` — SPA
- `backend/` — API + PDF/Excel + lesson plans
- `tests/`, `test_reports/`, `memory/PRD.md` — legacy/product notes
- `codex-context/` — this handoff pack
- Many Arabic/English deploy helper markdown files at root

## Related reading

- Architecture → `02-ARCHITECTURE.md`
- Current state → `16-CURRENT-STATE.md`
- Owner style → `09-OWNER-WORKING-STYLE.md`
