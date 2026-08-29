# 10 — Decision History

## Decision: Every score-entry page must expose safe score correction (2026-08-30)

The score-entry UX contract now requires a visible clear/delete control on all eight entry surfaces. Existing International screens retain their week/class-scoped controls; baseline/diagnostic retains revision-guarded clearing; Arabic quarter grading gains a dedicated server DELETE limited to one selected class and exact academic term. Destructive actions show scope before execution and must not silently affect another class or term.

## Decision: Diagnostic/pre-test bulk correction tools (2026-08-30)

Added two class-scope-aware actions to baseline/diagnostic entry: stage the record maximum for every visible student, and clear all saved visible marks after a destructive confirmation showing scope and affected count. Clearing reuses the existing revision-guarded score patch rather than adding a second persistence path; staged maximums still require the normal Save marks action so teachers can review before committing.

## Decision: Baseline assessments record existing test totals only (2026-08-28)

Owner approved publishing the reviewed pre-test/diagnostic preview. Implemented an isolated collection and API; no question authoring, test delivery, reading/grammar/vocabulary categories or changes to quarter grading. Each record fixes a maximum and historical roster, then accepts score corrections with optimistic concurrency. Teachers own records and require all assigned classes; Admin retains oversight. New enrollments or a changed maximum require a separate record, avoiding silent historical rescaling.

Owner-approved baseline bands are High >=75%, Medium >=50%, Support <50%; missing is separate. A shared server snapshot drives the page and vector PDF, with snapshot validation before export. Numeric evidence and general action suggestions are valid; topic-specific diagnoses cannot be inferred from a total alone.

Format: Decision → Context → Why → Status → Codex Guidance.

---

## Decision: Use HashRouter instead of BrowserRouter path routing

**Context:** Static/CDN hosting and Render frontend service.  
**Why:** INFERRED — avoids server rewrite pain for SPA; code imports HashRouter as BrowserRouter.  
**Status:** CONFIRMED in `App.js`.  
**Codex Guidance:** Do not switch to BrowserRouter without deploy rewrite plan.

---

## Decision: Global semester/quarter in App.js + AcademicTermSelect

**Context:** Analytics/Reports local `termScopeId` drifted from header.  
**Why:** Owner required all quarter lists to match.  
**Status:** CONFIRMED (commit `8276c12`).  
**Codex Guidance:** Never reintroduce page-local term state that does not write `setSemester`/`setQuarter`.

---

## Decision: Display S2 quarters as Q3/Q4

**Context:** School labeling vs internal quarter 1|2 storage.  
**Why:** CONFIRMED i18n + `displayQuarterNumber`.  
**Status:** Active.  
**Codex Guidance:** Exports/PDF/UI labels must use display quarter; API keeps 1|2.

---

## Decision: Duplicate Assessment/Final pages for Q1 and Q2

**Context:** Different weeks (1–9 vs 10–18) and field sets.  
**Why:** INFERRED — faster isolation per term half.  
**Status:** Active.  
**Codex Guidance:** Patch both files or carefully share components; AppShell redirects routes on quarter change.

---

## Decision: Monolithic FastAPI `server.py`

**Context:** Entire domain in one module.  
**Why:** Reason unknown — do not speculate beyond MVP speed.  
**Status:** Active; `pdf_report_engine.py` and `lesson_plan_service.py` partially extracted.  
**Codex Guidance:** Prefer additive extraction only when necessary; avoid drive-by rewrites.

---

## Decision: Premium PDF via ReportLab + Amiri + reshaper/bidi

**Context:** Arabic squares in PDF; plain layout.  
**Why:** Owner demanded embedded Arabic fonts and admin-ready design.  
**Status:** CONFIRMED (`pdf_report_engine.py`, fonts under `backend/assets/fonts/`).  
**Codex Guidance:** Never fall back to Helvetica for Arabic text; keep matplotlib Amiri registration. The current reward-certificate generator is a known legacy exception: it uses direct Helvetica canvas text and is not yet Arabic-safe. Do not assume certificate PDFs have the same guarantees as Analytics/Reports PDFs.

---

## Decision: Top navigation replacing left sidebar

**Context:** Redesign toward Al Mubarmij Workshop look.  
**Why:** Owner request.  
**Status:** CONFIRMED.  
**Codex Guidance:** Keep grouped nav config in `navigationConfig.js`.

---

## Decision: PageHero on all main pages

**Context:** Analytics banner became system standard.  
**Why:** Owner request for consistent identity + purpose text.  
**Status:** CONFIRMED (`1d132b7`).  
**Codex Guidance:** New pages must use `PageHeader`/`pageKey` copy in i18n.

---

## Decision: Lazy Mongo client initialization

**Context:** Importing `server.py` failed without Mongo DNS during PDF tests.  
**Why:** Enable offline PDF smoke tests.  
**Status:** CONFIRMED.  
**Codex Guidance:** Do not recreate client at import time.

---

## Decision: Gmail login creates pending Teacher until Admin approves

**Context:** Security/ops for school staff.  
**Why:** CONFIRMED commit `f81ce0e` + routes.  
**Status:** Active.  
**Codex Guidance:** Do not auto-activate new Google users.

---

## Decision: Authenticated browser sessions expire after 30 minutes of human inactivity

**Context:** An unattended signed-in school workstation must not leave student data accessible indefinitely.
**Why:** Owner-requested protection against unrelated users accessing an already authenticated browser.
**Status:** Active (`frontend/src/lib/idleSession.js`, integrated by `App.js`).
**Codex Guidance:** Count deliberate pointer/touch, keyboard, wheel, and scroll activity—not API/background traffic. Preserve the deadline across refreshes and synchronize it across tabs. Idle expiry clears browser auth state and presents bilingual feedback; it does not change JWT claims, backend schema, login approval, or score data.

---

## Decision: Render-only hosting (remove Vercel config)

**Context:** Commit `d0211b0`.  
**Why:** CONFIRMED docs/render.yaml.  
**Codex Guidance:** Prefer Render instructions; don’t reintroduce Vercel unless asked.

---

## Decision: `attendance` as score points not roll-call

**Context:** Domain modeling of weekly follow-up.  
**Why:** CONFIRMED field maxima and UI.  
**Status:** Active.  
**Codex Guidance:** See `05-ATTENDANCE-SYSTEM.md`.

---

## Decision: One application, two isolated school sections

**Context:** Arabic Section added alongside the existing International Section.
**Why:** Preserve one shared application/chrome while preventing records and scoring models from mixing.
**Status:** Active.
**Codex Guidance:** Use `school_section`, never repurpose `classes.section` (A/B). Legacy records default to International. Keep `assigned_class_ids` as the Teacher permission boundary inside both sections.

---

## Decision: Arabic grades use a separate quarter score collection

**Context:** Arabic quarters are `/100` and are not weekly `/15 → /30 → /50`.
**Why:** A dedicated `arabic_quarter_scores` collection prevents accidental reuse of International formulas while shared UI/report shells remain reusable.
**Status:** Active; Arabic performance thresholds intentionally unset.
**Codex Guidance:** Preserve `null` vs entered `0`; use student/year/semester/quarter keys and the Arabic calculation adapter.

## Decision: Arabic exams use best-of-two theory plus one stage-scaled practical

**Context:** The former four-test `/15 + /15 + /15 + /15` model was replaced by the approved Arabic grading policy.
**Why:** Theory 1 and Theory 2 are improvement attempts; only the better valid raw result contributes `/30`, while one Practical Test contributes `/30`.
**Status:** Active. Primary raw exams are `/15`; Middle/Secondary raw exams are `/20`, derived from `classes.grade`.
**Codex Guidance:** Never add both theory attempts, never infer stage from teacher identity, preserve entered `0`, require all three attempts for completion, and retain/flag ambiguous legacy practical data rather than overwriting it.

## Decision: Arabic class grade metadata fails safely and self-repairs only when unambiguous

**Context:** Legacy Arabic classes could have names such as `رابع أ` while `classes.grade` was null. The Arabic grades API validated every class before reading students, so even an empty roster returned `load_failed` and the UI displayed misleading zero metrics.
**Why:** Arabic raw exam maxima depend on the numeric grade, but an empty legacy class must not take down every Arabic dashboard.
**Status:** Active. Arabic ordinal names are parsed bilingually, startup backfills missing grade/section metadata when unambiguous, and new Arabic classes require a numeric grade.
**Codex Guidance:** Keep `classes.grade` authoritative. Do not guess unparseable names. Allow unresolved empty legacy classes to load with a configuration issue, but block score operations with stable `arabic_class_grade_required` once students depend on that class.

---

## Decision: Calendar sync fails closed and preserves cache

**Context:** The old sync deleted all events and reinserted a hardcoded 1447H list.
**Why:** The authoritative source is now the Ministry General Education `rss.aspx / استعلام المحتوى` detailed event listing. The isolated adapter intersects those public events with the Ministry's own structured Hijri/Gregorian date map, validates completeness, and preserves the active verified version when a refresh fails. It never substitutes an older year for an incomplete latest publication.

## Superseding decision: Approved school PDF calendars are versioned by academic year

**Context:** The Ministry workflow was unreliable and did not represent the approved Al Anjal school calendar.
**Decision:** Live synchronization and its scheduled job were removed. Admins import an approved four-page school PDF; each academic year owns an active immutable event version, historical years remain selectable, and current-year resolution follows imported date ranges.
**Safety:** Parsing and structural validation complete before database writes, and the active version pointer changes only after the new event version is stored. Printed anomalies remain flagged for manual review rather than guessed.

## Decision: Generic Arabic Excel import is enrollment-only

**Context:** Arabic Section needs practical bulk enrollment without passing `/100` grades through the International score mapper.
**Status:** Active.
**Codex Guidance:** Reuse `/api/import/excel` with explicit Arabic section/year/exact-class scope, but persist only student/class identity. Preview the complete file before apply; the selected class is authoritative and conflicting spreadsheet class values fail before writes. Treat `student_number` as identity data, never as `full_name`; numeric-only names are invalid. Grade-sheet imports use the separate `/api/score-sheet/import` route and still persist Arabic scores exclusively in `arabic_quarter_scores`.

## Decision: Arabic enrollment import fails closed on headers and class scope (2026-08-30)

**Context:** A workbook headed `رقم الهوية | الاسم` was imported after the user selected `رابع أ`, but the UI did not send that selection. The backend did not recognize `الاسم`, fell back to the identity column as `full_name`, and its ASCII-only class key collapsed every Arabic string to an empty key; the last Arabic class (`سادس ب`) was therefore selected.

**Decision:** Require and authorize one exact Arabic target class, recognize Arabic name/identity aliases, use Unicode-safe class keys, preview before apply, and validate the whole target-scoped file before the first write. Store `student_number` separately and repair matching legacy numeric-name records during a confirmed re-import.

**Codex Guidance:** Never restore first-column-as-name or second-column-as-class fallbacks for recognized enrollment files. Never normalize Arabic class text with ASCII-only regexes. Keep the selected class authoritative and preserve the dry-run/apply sequence.

## Decision: Destructive roster actions and smart grade fills are exact-class scoped (2026-08-30)

**Context:** Removing a wrongly imported Arabic roster one student at a time was impractical, while a section-wide delete was too dangerous. Repeatedly entering full marks for an entire class was also unnecessary manual work.

**Decision:** Admins may delete all students only from one selected and server-verified class, including only those students’ related score records. Arabic bulk grade fill also requires one selected class, stages one chosen column at its correct fixed/stage-aware maximum, confirms overwrites, and relies on the existing Save Grades action for persistence.

**Codex Guidance:** Never broaden either action to “all classes” implicitly. Keep deletion Admin-only and irreversible-confirmed. Keep fill changes reviewable/unsaved until the normal bulk-save request.

## Decision: External score sheets import one explicit attempt only (2026-08-29)

**Context:** The owner replaced the older broad assessment-page import with the supplied 11-column school-platform Excel layout.

**Decision:** Preview and apply are separate requests. Only `اسم الطالب` and `درجة التسليم` are trusted for score persistence; shaded metadata never changes local records. A file targets exactly one permitted attempt: International short quiz 1/2 for the active quarter or Arabic theory 1/2. Practical scores remain manual. Baseline imports additionally require the current optimistic-concurrency revision. Blank, invalid, duplicate, ambiguous and unmatched rows do not clear or overwrite marks.

**Codex Guidance:** Never route score-page uploads back through the generic `/api/import/excel` enrollment upsert. Preserve the explicit target allowlist, academic scope, teacher class restrictions and preview warning before apply.
**Status:** Active.
**Codex Guidance:** Use the isolated official-source adapter, strict validation, versioned activation, and last-good cache. Never delete active events before a new version succeeds.
