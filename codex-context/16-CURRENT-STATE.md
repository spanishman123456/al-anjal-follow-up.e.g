# 16 — Current State

## Arabic diagnostic roster replacement (2026-08-30)

- Diagnostic dropdown items are now explicitly deletable mark-entry records. Revision-guarded deletion removes only the selected frozen roster and its diagnostic marks; it leaves enrollment, classes and every other record unchanged, and tolerates legacy records with no title.
- Arabic diagnostic setup now imports one exact class roster from Excel through the same preview/apply guard used by Arabic Student Management. The selected class remains authoritative, Arabic `الاسم` / `رقم الهوية` headers and legacy numeric-name repair are preserved, and the subsequently created record snapshots real student and class names.
- A source-level lifecycle test protects Arabic enrollment import/deletion, actual class deletion, diagnostic roster import and diagnostic record deletion from silently disappearing.
- Verification: all 74 backend tests and all 14 frontend suites / 75 tests pass; Python compilation, optimized CRACO build and SPA fallback generation also pass. No live MongoDB writes were used.

## Score-entry deletion coverage (2026-08-30)

- All eight score-entry pages have a visible clear/delete control, protected by a source-level coverage test so future page changes cannot silently omit it.
- Arabic quarter grades now delete persisted records only for one explicitly selected Arabic class and the active year/semester/quarter. Confirmation shows class, displayed quarter and affected scored-student count; unsaved edits block deletion. Teacher class assignment is enforced server-side.

## Arabic page load recovery (2026-08-29)

- Live read-only diagnosis confirmed that the repeated `load_failed` was not the normal empty-roster state: six Arabic classes had valid names (`رابع أ` through `سادس ب`) but null numeric `grade` metadata, causing `/api/arabic/grades` to fail before reading the empty student roster.
- Arabic class-name parsing now understands Arabic ordinals and Arabic A/B suffixes. Startup safely backfills only unambiguous missing grade/section values; new Arabic classes cannot be created without a resolvable numeric grade.
- An unresolved empty legacy class no longer takes down the Arabic grades/dashboard response. If enrolled students depend on unresolved metadata, score entry fails closed with the stable bilingual `arabic_class_grade_required` message.
- Arabic Grades, Students and Overview no longer replace a failed request with misleading zero cards. They show a persistent bilingual error with Retry; shared API error localization prevents raw keys such as `load_failed` appearing to users.
- Verification: all 68 backend tests passed, all 10 frontend suites / 51 tests passed, Python compilation passed, and the optimized CRACO production build plus SPA postbuild passed. The legacy Mongo connection utility remains directly runnable but is no longer mis-collected as an async unit test.

## Score-sheet import/export (2026-08-29)

- Pre-test (International) and diagnostic-test (Arabic) entry now show Import Excel, Export Excel and Export PDF together. Excel export uses the supplied 11 Arabic headers in the exact order and preserves the unshaded A/C/D/E versus shaded B/F–K convention.
- Import trusts student name and submission grade for persistence, previews matches and overwrites, rejects out-of-range rows, and never imports shaded metadata or creates students/classes. Baseline apply is revision-safe and blank rows never clear existing scores.
- International Q1/Q2 assessment pages now use one file per selected short-quiz attempt (`quiz1/quiz2` or `quiz3/quiz4`, `/5`). The legacy broad page import was removed. Chapter practical remains manual.
- Arabic quarter grades now have the missing Excel import control for Theory 1 or Theory 2, using the per-student `/15` or `/20` raw maximum. Practical remains manual and the `/40 + /30 + /30 = /100` formulas are unchanged.
- Verification: 48 protected backend tests and all 47 frontend tests passed. Production CRACO build plus SPA postbuild passed. A generated Excel export was inspected structurally and rendered visually; headers, RTL direction, values and white/gray column fills match the supplied layout. Live MongoDB was not used.

**Handoff created:** 2026-08-21 (Cursor → Codex knowledge transfer)

## Automatic idle logout (2026-08-29)

- Authenticated users are automatically signed out after 30 minutes without deliberate browser activity. Pointer/touch interaction, keyboard input, scrolling, and the mouse wheel renew the deadline; API/background traffic does not.
- The last-activity deadline survives refreshes and is synchronized across open tabs. Returning to a suspended or backgrounded tab after the deadline cannot revive the expired browser session.
- Idle logout clears the stored JWT and activity timestamp, returns to Login, and shows a bilingual EN/AR data-protection explanation. Existing JWT claims, backend expiry, login approval, permissions, score data, and schemas are unchanged.
- Frontend verification passes: all seven Jest suites / 45 tests, including five focused idle-session cases plus bilingual Login feedback coverage. The optimized production build and SPA fallback step complete successfully; existing Browserslist/deprecation notices remain unchanged.

## Baseline maximum field precision (2026-08-29)

- Replaced the maximum input's `0.000001` minimum / unrestricted step with `0.01` minimum and step, preventing the spinner from inserting six decimal places.
- Empty input shows `0.00`; exact hundredths are padded to two decimal places on blur. Zero is displayed as `0.00` but cannot be submitted. Excess precision is rejected, not silently rounded; existing maxima, student totals, thresholds, APIs and PDFs are untouched.
- All six frontend suites / 38 tests pass, including EN/AR spinner, fixed-decimal formatting, clearing, and rejecting over-precise/zero new maxima.
- Production build passes; local browser QA confirms `30.00` / `30.50` after blur and a clean Arabic RTL layout using synthetic records only.

## Baseline / diagnostic records (2026-08-28)

- Entry mode now provides class-scope-aware smart controls to fill the visible score column with the record maximum (review then save) and to clear all saved marks in the visible scope after confirming the class scope and affected count.

- Implemented the owner-approved preview as real authenticated score-entry and analytics pages in both school sections. No existing grades changed; a separate collection holds teacher-owned records, fixed maxima/rosters and revision-safe totals.
- Both sections use baseline-only >=75 / >=50 / <50 bands. Zero and missing stay distinct; percentages and numerical narratives are server-owned.
- Real export uses the screen snapshot with stale-export protection. Arabic/English PDFs include class overview, all student bars, selected student donut and detailed interpretation; longer rosters paginate without dropping students.
- Offline verification: 49 backend tests including 14 baseline tests and the protected grading suites passed. All six frontend suites / 35 tests passed, covering entry, validation, draft restoration, concurrent save rejection, bilingual navigation and donut data. Production build and SPA postbuild passed. Three-page Arabic and English PDF samples were rendered and all six pages visually inspected; a 100-student export retained all names.
- Local browser check with synthetic in-memory data verified actual saving (15/20 →16/20 =80%, then restored), Arabic overview with 75% donut, class charts, section naming/filtering and an actual HTTP 200 PDF export. Mobile rendering had equal client/scroll width (375px) and a readable stacked donut. Production real-account acceptance remains separate; no student credentials or live marks were used for testing.
- Baseline settings are intentionally immutable; use a separate record for a new maximum/test/roster. Historical results are retained after enrollment changes unless the user explicitly deletes that whole record. No question creation UI is included.

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

- JWT login + Google pending-approval teachers + synchronized 30-minute inactivity logout
- Authentication security hardening (2026-08-31): matching an existing Teacher email no longer bypasses Gmail approval. First-use/new Google identities are queued for exact Admin approval; provider-bound JWTs re-check Google approval, and old provider-less sessions sign out once after rollout. Roles, users, promotion, Gmail approvals and the notification bell are hidden from non-Admins and server-guarded. Admins receive polled in-app alerts for Gmail requests and Teacher password changes without passwords in logs. Verification: 83 backend tests and 15 frontend suites / 97 tests pass; optimized production build and SPA fallback generation pass.
- Class/student CRUD, weeks, weekly scores, assessment/final/total mark pages
- Global semester/quarter sync (header + AcademicTermSelect)
- Top navigation + PageHero banners (EN/AR)
- Analytics & Reports with Visual Board and premium PDF/Excel paths
- Remedial plans, rewards/certificates, lesson plan generator
- Programs now appears in both sections. Remedial reports select a real diagnostic/pre-test, quarter final-test block, quarter total or semester aggregate and list only actual marks strictly below 50%; blanks are excluded and zero remains a real score. Subject/weakness/date/signatories are editable, while names/classes/marks come from a protected snapshot and export to a bilingual school PDF. Rewards load the active section/year roster, and the lesson-plan mapper recognizes common Arabic template labels.
- Remedial-program verification (2026-09-01): 86 backend tests and 16 frontend suites / 99 tests pass; the optimized production build succeeds. The Arabic two-page QA PDF was rendered at 144 DPI and inspected page by page for logo, RTL line order, repeated table header, marks, names and signatures.
- Multi-year approved-school-PDF calendar import/history page, notifications log, settings/users
- Favicon from Al Anjal logo
- Render deployment blueprint
- Lazy Mongo init + offline PDF test script
- Verified local baseline: Python 3.13.15, healthy root `.venv`, Node.js 20.20.0, and npm 10.8.2
- Backend focused verification passes (19 tests), frontend tests pass, production build passes, and live Arabic/International exports pass
- Frontend Jest verification passes (4 suites / 13 tests) and production compilation succeeds with the Windows-equivalent build command
- International/Arabic Section switching with section/year-scoped classes and students; legacy data defaults to International
- Arabic scoped Excel enrollment import now requires one exact class, previews before apply, recognizes `الاسم`/`رقم الهوية`, rejects numeric names/duplicate identities/class conflicts before writes, and repairs the prior numeric-name/wrong-class failure on confirmed re-import. Quarter `/100` entry remains unchanged: continuous `/40`, better of Theory 1/Theory 2 weighted to `/30`, and one Practical weighted to `/30`; raw maximum comes from class grade (`/15` Primary, `/20` Middle/Secondary).
- Arabic Student Management now localizes `اسم الطالب / الصف / حذف` correctly and gives Admin an exact-class roster delete with irreversible confirmation; its API deletes only that class’s students and related scores. Arabic Grades adds an exact-class smart fill tool for any editable column, using `/10` continuous maxima and stage-aware `/15` or `/20` exam maxima, with overwrite confirmation and normal Save Grades persistence.
- Score safety hardening (2026-08-31): all all-classes score-clear buttons are removed from weekly, assessment, final and total matrices. Bulk clearing and maximum fill require one selected class, while International, Arabic weekly, Arabic exams and baseline/diagnostic tables expose a one-student eraser for the current scope. Blank International fill values use the column maximum.
- Arabic Analytics now matches the International analysis depth without changing the Arabic formula: class-first then student, test/week completion, performance and contribution donuts, class/student/component/raw-test bars, top/support lists, narrative insights and the detailed `/40 + /30 + /30 = /100` table.
- Arabic Reports now uses that same analytical surface in report mode, including Arabic RTL, class-first then optional-student scope, all seven chart families, narrative insights and the detailed table. PDF/Excel carry the selected student when present; the Arabic PDF includes the matching visual sections, analytical explanation, class overview, detailed paginated rows, top totals and completion follow-up.
- Verification for the Arabic Analytics/Reports work: 14 frontend suites / 94 tests and 77 backend tests pass; optimized production build and SPA postbuild pass. Local browser QA with synthetic data confirmed Arabic RTL, class-to-student filtering and all report chart sections. A nine-page Arabic PDF was rendered and visually inspected page by page for chart clarity, Arabic shaping, table pagination and repeated headers. No live student data was used.
- Import regression verification (2026-08-30): the supplied `رابع أ.xlsx` previews as 30 valid names, target `رابع أ`, zero new classes and zero writes; 37 related backend tests, one focused frontend safeguard test, and the optimized production build pass.
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
7. Keep the explicitly adopted Arabic proportional performance thresholds aligned across weekly entry, quarter grading, analytics and exports
8. Plan dependency-security review separately before changing the existing lockfile or package versions

## Owner expectation at handoff

Continue iterating with **visual consistency**, **Arabic fidelity**, **term coherence**, and **no silent score regressions**, deploying via **git push to main → Render**.
