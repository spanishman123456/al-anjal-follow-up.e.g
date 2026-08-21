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
