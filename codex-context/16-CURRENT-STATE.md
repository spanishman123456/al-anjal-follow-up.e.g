# 16 — Current State

**Handoff created:** 2026-08-21 (Cursor → Codex knowledge transfer)

## Baseline / diagnostic records (2026-08-28)

- Implemented the owner-approved preview as real authenticated score-entry and analytics pages in both school sections. No existing grades changed; a separate collection holds teacher-owned records, fixed maxima/rosters and revision-safe totals.
- Both sections use baseline-only >=75 / >=50 / <50 bands. Zero and missing stay distinct; percentages and numerical narratives are server-owned.
- Real export uses the screen snapshot with stale-export protection. Arabic/English PDFs include class overview, all student bars, selected student donut and detailed interpretation; longer rosters paginate without dropping students.
- Offline verification: 49 backend tests including 14 baseline tests and the protected grading suites passed. All six frontend suites / 35 tests passed, covering entry, validation, draft restoration, concurrent save rejection, bilingual navigation and donut data. Production build and SPA postbuild passed. Three-page Arabic and English PDF samples were rendered and all six pages visually inspected; a 100-student export retained all names.
- Local browser check with synthetic in-memory data verified actual saving (15/20 →16/20 =80%, then restored), Arabic overview with 75% donut, class charts, section naming/filtering and an actual HTTP 200 PDF export. Mobile rendering had equal client/scroll width (375px) and a readable stacked donut. Production real-account acceptance remains separate; no student credentials or live marks were used for testing.
- Baseline settings are intentionally immutable; use a separate record for a new maximum/test/roster. Historical results are retained after enrollment changes. No question creation or baseline deletion UI is included.

## Login latency and contact button (2026-08-28)

- Removed the login page's automatic `/health` database probe and the always-visible English "Checking server status" row. That row was informational, not a precondition for submitting credentials.
- Password and Google sign-in now send their auth request immediately. A single non-blocking `/health/live` warm-up starts while the user types on Render; login never waits for it.
- Replaced the password login's chained 180-second requests, readiness polling, and final diagnostic probe with at most two direct attempts under one 90-second production budget (60 seconds first, remaining time for a retry after one second). Local login retains 30 seconds. Only connection failures and HTTP 502/504 retry; credential, approval, and database errors do not.
- Added duplicate-submit protection shared by password/Google sign-in, localized pending/connection messages, and a slow-request hint only after four seconds. Existing authentication, teacher approval, session validation, permissions, scoring, and global academic terms are unchanged.
- Login contact control now uses one bubble and a 12px flex gap, with explicit EN/AR direction.
- Regression tests: all five frontend Jest suites / 26 tests pass, including 13 login cases using simulated API responses (no live credentials or student data). Added Jest's `@/` alias to match webpack's existing source alias.
- Production compilation and SPA postbuild passed. Browser review of the built page confirmed EN/LTR and AR/RTL, no idle status text, and exactly one contact SVG with a computed 12px gap. Existing build warnings about Browserslist data / disabled ESLint remain; dependencies were not changed.
- Hosting limitation: Render Free services sleep after 15 minutes without traffic and take about a minute to restart ([Render docs](https://render.com/docs/free)). The current hosting plan was not verified or changed; removing UI waits cannot eliminate a host cold start. Real-account sign-in remains an owner-run acceptance check; no credentials are stored in this fix.

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
- Frontend Jest verification passes (4 suites / 13 tests) and production compilation succeeds with the Windows-equivalent build command
- International/Arabic Section switching with section/year-scoped classes and students; legacy data defaults to International
- Arabic scoped Excel student/class import and quarter `/100` entry: unchanged continuous `/40`, better of Theory 1/Theory 2 weighted to `/30`, and one Practical weighted to `/30`; raw maximum comes from class grade (`/15` Primary, `/20` Middle/Secondary). Zero-vs-null completion semantics, three-attempt dashboard/analytics lists, and Arabic PDF/Excel reports are aligned.
- Legacy Arabic practical fields are preserved; unambiguous single/equal values migrate to the new practical field, while conflicting old values are surfaced for manual review.
- Arabic Dashboard/Analytics now include `/100` quarter distribution, students-per-class, top-student, and data-aware average cards; the support card deliberately remains uncalculated until an Arabic threshold is approved
- School-wide multi-year academic calendars imported once from approved Al Anjal PDFs, with immutable versions, automatic current-year selection, preserved history, and no live external synchronization
- International Dashboard/Analytics now include compact completion + classes organization while retaining existing `/15 → /30 → /50` APIs and calculations; the superseded large Incomplete Assessment Alerts card has been removed
- Shared illuminated button variants and navy-header table styling now normalize both application sections
- International and Arabic Dashboards share the same editable weekly timetable in the same visual position, scoped per user + school section + academic year; legacy timetables remain current-year International.
- Shared premium PDF system now covers International Analytics/Reports and Arabic `/100` reports, omits meaningless charts, uses compact empty states, repeats long-table headers, and preserves Amiri RTL rendering
- Focused backend regression verification passes 35 synchronous tests, including protected International scoring, stage-aware Arabic calculations/import isolation, scoped timetable persistence, multi-year PDF calendar parsing/rollover, and Arabic PDF/Excel generation

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
