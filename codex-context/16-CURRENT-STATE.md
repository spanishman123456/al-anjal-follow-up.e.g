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
- Verified local baseline: Python 3.13.15, healthy root `.venv`, Node.js 20.20.0, and npm 10.8.2
- Backend focused verification passes (12 tests), offline server import passes, and Arabic PDF smoke generation passes
- Frontend Jest verification passes (2 suites / 7 tests) and production compilation succeeds with the Windows-equivalent build command

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
- Normal `npm run build` remains non-portable on Windows because its script uses POSIX inline environment-variable syntax; the documented PowerShell-equivalent build succeeds
- `npm ci` reports 58 dependency vulnerabilities; do not apply automatic audit fixes or upgrades without explicit approval
- Live MongoDB/login/integration tests are not part of the safe offline baseline because they require external credentials and may touch live services

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
8. Plan dependency-security review separately before changing the existing lockfile or package versions

## Owner expectation at handoff

Continue iterating with **visual consistency**, **Arabic fidelity**, **term coherence**, and **no silent score regressions**, deploying via **git push to main → Render**.
