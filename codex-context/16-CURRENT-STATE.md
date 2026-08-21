# 16 — Current State

**Handoff created:** 2026-08-21 (Cursor → Codex knowledge transfer)

## What works today (CONFIRMED)

- JWT login + Google pending-approval teachers
- Class/student CRUD, weeks, weekly scores, assessment/final/total mark pages
- Global semester/quarter sync (header + AcademicTermSelect)
- Top navigation + PageHero banners (EN/AR)
- Analytics & Reports with Visual Board and premium PDF/Excel paths
- Remedial plans, rewards/certificates, lesson plan generator
- Calendar sync page, notifications log, settings/users
- Favicon from Al Anjal logo
- Render deployment blueprint
- Lazy Mongo init + offline PDF test script

## Recently modified themes (git)

- Export filenames / academic year / display quarter
- Page background theming experiments
- Analytics/Reports quarter alignment
- Exam column ordering/titles
- Login stability
- Score cumulative fixes
- Term sync, PageHero, PDF Arabic, top nav

## Partial / needs care

- Permission strings on roles vs actual route guards
- Frontend/backend score helper duplication
- PRD backlog not fully aligned with shipped auth
- Hardcoded calendar year content
- Local reward storage vs server rewards (verify when editing Rewards)
- Weekly report configuration lives in the separate `report_settings` collection, not `app_settings`
- Reward certificates still use Helvetica/direct canvas text and do not yet support the protected Amiri Arabic rendering pipeline
- Frontend academic year is dynamically 2026–2027, but synced calendar seed data remains hardcoded to 1447H / 2025–2026
- Local root `.venv` is unusable on the current machine because it references a missing Python 3.14 interpreter; project configuration still targets Python 3.13

## Not implemented (CONFIRMED)

- Daily present/absent attendance system
- Full Counselor-centric product surface

## Logical next areas (INFERRED — not ordered commitments)

1. Deduplicate Q1/Q2 assessment pages safely
2. Shared frontend scoring module matching `compute_cumulative_quarter_score_50`
3. Strengthen automated tests around thresholds and imports
4. Calendar year data maintenance workflow
5. Further PDF/report polish only if owner requests
6. Bring reward certificates into the Amiri + Arabic shaping pipeline when explicitly requested
7. Replace or refresh hardcoded calendar seed data for the active academic year
8. Recreate the local Python environment with Python 3.13 before running backend verification locally

## Owner expectation at handoff

Continue iterating with **visual consistency**, **Arabic fidelity**, **term coherence**, and **no silent score regressions**, deploying via **git push to main → Render**.
