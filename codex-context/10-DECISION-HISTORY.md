# 10 — Decision History

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

---

## Decision: Calendar sync fails closed and preserves cache

**Context:** The old sync deleted all events and reinserted a hardcoded 1447H list.
**Why:** The authoritative source is now the Ministry General Education `rss.aspx / استعلام المحتوى` detailed event listing. The isolated adapter intersects those public events with the Ministry's own structured Hijri/Gregorian date map, validates completeness, and preserves the active verified version when a refresh fails. It never substitutes an older year for an incomplete latest publication.

## Superseding decision: Approved school PDF calendars are versioned by academic year

**Context:** The Ministry workflow was unreliable and did not represent the approved Al Anjal school calendar.
**Decision:** Live synchronization and its scheduled job were removed. Admins import an approved four-page school PDF; each academic year owns an active immutable event version, historical years remain selectable, and current-year resolution follows imported date ranges.
**Safety:** Parsing and structural validation complete before database writes, and the active version pointer changes only after the new event version is stored. Printed anomalies remain flagged for manual review rather than guessed.

## Decision: Arabic Excel import is enrollment-only

**Context:** Arabic Section needs practical bulk enrollment without passing `/100` grades through the International score mapper.
**Status:** Active.
**Codex Guidance:** Reuse `/api/import/excel` and its header/class detection with explicit Arabic section/year scope, but persist only student/class identity. Arabic grades remain exclusively in `arabic_quarter_scores`.
**Status:** Active.
**Codex Guidance:** Use the isolated official-source adapter, strict validation, versioned activation, and last-good cache. Never delete active events before a new version succeeds.
