# AGENTS.md — Al Anjal School Follow-up Record

> Persistent rules for OpenAI Codex (and any AI agent) working on this repository.
> Full knowledge base: [`codex-context/`](./codex-context/) — start with [`codex-context/17-CODEX-START-HERE.md`](./codex-context/17-CODEX-START-HERE.md).

---

## Project Mission

**Al Anjal School Follow-up Record** is a bilingual (English/Arabic, RTL) web system for **Al Anjal National Schools** used by **Admin** and **Teacher** staff to:

- Enroll and manage students in classes (grades 4–8, sections A/B).
- Record **weekly follow-up marks** and **assessment / final exam scores** on a **50-point quarter** model.
- Classify performance (**On Level / Approach / Below / No Data**).
- Run analytics and generate **PDF/Excel** reports suitable for school administration.
- Support remedial plans, rewards/certificates, lesson-plan generation, calendar, notifications, and user management.

It is **not** a daily roll-call attendance product. The field named `attendance` is a **weekly scored criterion (max 2.5 points)**, not present/absent tracking.

---

## Owner Working Style

(Summary — details in `codex-context/09-OWNER-WORKING-STYLE.md`)

- Prefers **premium, consistent UI** (navy/purple/cyan PageHero, top nav) over generic dashboards.
- Demands **Arabic + English** correctness (especially PDF embedding / RTL).
- Prefers **preserving working behavior** and **scoped visual/UX upgrades** over rewrites.
- Wants **global academic term sync** (semester/quarter) everywhere.
- Iterates visually from screenshots; expects **full redesigns when asked**, not tiny cosmetic tweaks.
- Expects **commit + push** when requested; deploys via **Render**.
- Confidence on style inferences: mix of **High** (code + recent Cursor work) and **Medium** (repeated requests).

---

## Golden Rules

1. **Read existing implementation before editing** — especially `backend/server.py` scoring helpers and shared frontend libs.
2. **Preserve working behavior** unless the user explicitly asks to change it.
3. **Prefer extending** existing components (`PageHero`, `AcademicTermSelect`, analytics kit, shadcn `ui/*`) over new frameworks.
4. **Do not invent features** (e.g. daily attendance, new roles) that are not in the codebase.
5. **Never silently change score formulas or performance thresholds** (quarter /50: On Level ≥46, Approach ≥43, Below &lt;43).
6. **Never silently modify MongoDB collections/field meanings** without impact analysis and docs update.
7. **Protect student data integrity** — no accidental mass deletes, score wipes, or import overwrites without clear UX.
8. **Keep bilingual + RTL** parity for any user-facing string.
9. **Keep global term state in sync** (`App.js` semester/quarter → outlet → `AcademicTermSelect` / header).
10. **Semester 2 display quarters**: internal `quarter: 1|2` → display **Q3|Q4** (`academicScope.js` / exports / PDF labels).
11. **Do not remove working features** as collateral damage.
12. **Do not commit secrets** (`.env`, passwords, API keys). Document env **names** only.
13. **Scope changes** to the request; prefer small, testable commits.
14. After large features, **update `codex-context/`** (see Keep Project Memory Updated).

---

## Before Every Change

- [ ] Identify whether the change is UI-only, API, scoring, or schema-related.
- [ ] Locate the real source of truth (often `server.py` for scores; `academicScope.js` for terms).
- [ ] Check Teacher vs Admin permission impact (`assigned_class_ids`, `require_admin`).
- [ ] If touching scores/reports/analytics: note which of /15, /30, /50 pipelines apply.
- [ ] If touching PDF: Amiri fonts + arabic-reshaper/bidi + `pdf_report_engine.py`. Reward certificates are a known exception that still use Helvetica/direct canvas text and are not Arabic-safe.
- [ ] If renaming routes: update `navigationConfig.js` and Q1/Q2 redirects in `AppShell`.

## After Every Change

- [ ] Verify EN + AR (and RTL layout if UI).
- [ ] Verify term selector still syncs (header ↔ Analytics/Reports/Dashboard).
- [ ] If scores changed: spot-check Students → Assessment → Final → Total Marks consistency.
- [ ] If PDF/Excel: sample export with Arabic class/student names.
- [ ] Summarize: what changed, files, why, tested, residual risk.
- [ ] Update relevant `codex-context/*.md` if behavior/architecture/preferences changed.

---

## Important Project Files

| Area | Path |
|------|------|
| Backend monolith | `backend/server.py` |
| Premium PDF engine | `backend/pdf_report_engine.py` |
| Lesson plans | `backend/lesson_plan_service.py` |
| Frontend entry / auth shell | `frontend/src/App.js` |
| Chrome + outlet context | `frontend/src/components/layout/AppShell.jsx` |
| Nav groups | `frontend/src/lib/navigationConfig.js` |
| Term model | `frontend/src/lib/academicScope.js` |
| Global term UI | `frontend/src/components/layout/AcademicTermSelect.jsx` |
| Page banners | `frontend/src/components/layout/PageHero.jsx`, `pageHeroConfig.js` |
| i18n | `frontend/src/lib/i18n.js` |
| API client | `frontend/src/lib/api.js` |
| Deploy | `render.yaml`, `DEPLOY-FULL-ON-RENDER.md` |

---

## Knowledge Base

| # | File |
|---|------|
| 01 | [`codex-context/01-PROJECT-OVERVIEW.md`](./codex-context/01-PROJECT-OVERVIEW.md) |
| 02 | [`codex-context/02-ARCHITECTURE.md`](./codex-context/02-ARCHITECTURE.md) |
| 03 | [`codex-context/03-DATABASE-AND-DATA-MODEL.md`](./codex-context/03-DATABASE-AND-DATA-MODEL.md) |
| 04 | [`codex-context/04-STUDENT-MANAGEMENT.md`](./codex-context/04-STUDENT-MANAGEMENT.md) |
| 05 | [`codex-context/05-ATTENDANCE-SYSTEM.md`](./codex-context/05-ATTENDANCE-SYSTEM.md) |
| 06 | [`codex-context/06-STUDENT-PROGRESS-SYSTEM.md`](./codex-context/06-STUDENT-PROGRESS-SYSTEM.md) |
| 07 | [`codex-context/07-UI-UX-DNA.md`](./codex-context/07-UI-UX-DNA.md) |
| 08 | [`codex-context/08-CODING-CONVENTIONS.md`](./codex-context/08-CODING-CONVENTIONS.md) |
| 09 | [`codex-context/09-OWNER-WORKING-STYLE.md`](./codex-context/09-OWNER-WORKING-STYLE.md) |
| 10 | [`codex-context/10-DECISION-HISTORY.md`](./codex-context/10-DECISION-HISTORY.md) |
| 11 | [`codex-context/11-KNOWN-ISSUES-AND-TECH-DEBT.md`](./codex-context/11-KNOWN-ISSUES-AND-TECH-DEBT.md) |
| 12 | [`codex-context/12-WORKFLOWS.md`](./codex-context/12-WORKFLOWS.md) |
| 13 | [`codex-context/13-FEATURE-MAP.md`](./codex-context/13-FEATURE-MAP.md) |
| 14 | [`codex-context/14-SAFE-CHANGE-GUIDE.md`](./codex-context/14-SAFE-CHANGE-GUIDE.md) |
| 15 | [`codex-context/15-SETUP-AND-RUNBOOK.md`](./codex-context/15-SETUP-AND-RUNBOOK.md) |
| 16 | [`codex-context/16-CURRENT-STATE.md`](./codex-context/16-CURRENT-STATE.md) |
| 17 | [`codex-context/17-CODEX-START-HERE.md`](./codex-context/17-CODEX-START-HERE.md) |
| JSON | [`codex-context/project-context.json`](./codex-context/project-context.json) |

---

# CODEX BEHAVIOR CONTRACT

1. Read the current implementation before writing code.
2. Understand the user’s goal before coding.
3. Do not do a large refactor when a small fix is requested.
4. Do not replace a working solution only because a newer pattern exists.
5. Reuse existing components, services, and patterns.
6. Preserve UI consistency (PageHero, top nav, performance badge colors, RTL).
7. Do not change schema or score structures without impact study.
8. Keep backward compatibility where reasonable (Excel column aliases, legacy score fields).
9. Any change touching the weekly `attendance` **score field** must check Students, Total Marks, exports, and /15 rollups — this is **not** a daily attendance product.
10. Any change to “student progress” (scores, levels, analytics) must check calculations, historical week scores, dashboards, and PDF/Excel reports.
11. Before deleting “unused” code, grep for dependencies (especially duplicated Q1/Q2 pages).
12. Do not add dependencies without need.
13. Keep each change focused on the request.
14. When finished, explain: what changed, which files, why, what was tested, residual risk.
15. If a generic best practice conflicts with this project’s established approach, understand the project reason first (e.g. HashRouter, Q1/Q2 duplicate pages, monolithic `server.py`).

---

# KEEP PROJECT MEMORY UPDATED

After meaningful work, update living memory:

| If you change… | Update… |
|----------------|---------|
| Database fields/collections | `03-DATABASE-AND-DATA-MODEL.md` |
| Weekly score field named attendance / mark entry | `05-ATTENDANCE-SYSTEM.md` + `06-STUDENT-PROGRESS-SYSTEM.md` |
| Score formulas / thresholds / analytics | `06-STUDENT-PROGRESS-SYSTEM.md` |
| UI system / banners / nav | `07-UI-UX-DNA.md` |
| Repeated owner preferences | `09-OWNER-WORKING-STYLE.md` |
| Architectural product decisions | `10-DECISION-HISTORY.md` |
| Feature completion / new TODOs | `16-CURRENT-STATE.md` + `13-FEATURE-MAP.md` |
| Setup / env / deploy | `15-SETUP-AND-RUNBOOK.md` + `project-context.json` |

Also refresh `project-context.json` when stack or critical files change.
