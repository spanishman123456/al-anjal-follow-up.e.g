# 16 — Current State

**Handoff created:** 2026-08-21 (Cursor → Codex knowledge transfer)

## What works today (CONFIRMED)

- JWT login + Google pending-approval teachers
- Class/student CRUD, weeks, weekly scores, assessment/final/total mark pages
- Global semester/quarter sync (header + AcademicTermSelect)
- Top navigation + PageHero banners (EN/AR)
- Analytics & Reports with Visual Board and premium PDF/Excel paths
- Remedial plans, rewards/certificates, lesson plan generator
- Multi-year approved-school-PDF calendar import/history page, notifications log, settings/users
- Favicon from Al Anjal logo
- Render deployment blueprint
- Lazy Mongo init + offline PDF test script
- Verified local baseline: Python 3.13.15, healthy root `.venv`, Node.js 20.20.0, and npm 10.8.2
- Backend focused verification passes (19 tests), frontend tests pass, production build passes, and live Arabic/International exports pass
- Frontend Jest verification passes (3 suites / 10 tests) and production compilation succeeds with the Windows-equivalent build command
- International/Arabic Section switching with section/year-scoped classes and students; legacy data defaults to International
- Arabic scoped Excel student/class import, quarter `/100` entry (`/40 + /60`), zero-vs-null completion semantics, dashboard/analytics/test lists, and Arabic PDF/Excel reports
- Arabic Dashboard/Analytics now include `/100` quarter distribution, students-per-class, top-student, and data-aware average cards; the support card deliberately remains uncalculated until an Arabic threshold is approved
- School-wide multi-year academic calendars imported once from approved Al Anjal PDFs, with immutable versions, automatic current-year selection, preserved history, and no live external synchronization
- International Dashboard/Analytics now include compact completion + classes organization while retaining existing `/15 → /30 → /50` APIs and calculations; the superseded large Incomplete Assessment Alerts card has been removed
- Shared illuminated button variants and navy-header table styling now normalize both application sections
- International and Arabic Dashboards share the same editable weekly timetable in the same visual position, scoped per user + school section + academic year; legacy timetables remain current-year International.
- Shared premium PDF system now covers International Analytics/Reports and Arabic `/100` reports, omits meaningless charts, uses compact empty states, repeats long-table headers, and preserves Amiri RTL rendering
- Focused backend regression verification passes 23 synchronous tests, including protected International scoring, Arabic calculations/import isolation, scoped timetable persistence, multi-year PDF calendar parsing/rollover, and Arabic PDF/Excel generation

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
- The 1448H source PDF visibly contains three anomalies: Semester 1 Week 17 prints two Gregorian dates in 2020, Semester 1 Week 19 prints malformed Hijri cells, and Semester 2 Week 19 includes a stray `96`; imported rows are flagged rather than silently corrected.
- Local reward storage vs server rewards (verify when editing Rewards)
- Weekly report configuration lives in the separate `report_settings` collection, not `app_settings`
- Reward certificates still use Helvetica/direct canvas text and do not yet support the protected Amiri Arabic rendering pipeline
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
4. Visually review manual-review calendar cells and replace them only from an approved corrected school document
5. Further PDF/report polish only if owner requests
6. Bring reward certificates into the Amiri + Arabic shaping pipeline when explicitly requested
7. Define Arabic Section performance thresholds only after an explicit owner decision
8. Plan dependency-security review separately before changing the existing lockfile or package versions

## Owner expectation at handoff

Continue iterating with **visual consistency**, **Arabic fidelity**, **term coherence**, and **no silent score regressions**, deploying via **git push to main → Render**.
