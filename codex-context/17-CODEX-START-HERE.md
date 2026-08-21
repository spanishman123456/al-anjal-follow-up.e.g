# 17 — Codex Start Here

> If you are Codex and this is your first time working on this project, read this file first.

## Read order

1. [`/AGENTS.md`](../AGENTS.md) — golden rules + behavior contract  
2. [`01-PROJECT-OVERVIEW.md`](./01-PROJECT-OVERVIEW.md) — what the product is (and is not)  
3. [`09-OWNER-WORKING-STYLE.md`](./09-OWNER-WORKING-STYLE.md) — how the owner evaluates work  
4. **This file** (`17-CODEX-START-HERE.md`)  
5. Then only the docs needed for the requested feature:

| If the task involves… | Read… |
|-----------------------|--------|
| Scores / levels / analytics math | `06-STUDENT-PROGRESS-SYSTEM.md`, `14-SAFE-CHANGE-GUIDE.md` |
| Field named attendance / weekly marks | `05-ATTENDANCE-SYSTEM.md` (clarifies: not roll-call) |
| Students/classes/import | `04-STUDENT-MANAGEMENT.md`, `12-WORKFLOWS.md` |
| UI / new page / banner | `07-UI-UX-DNA.md`, `pageHeroConfig.js` |
| PDF/Excel Arabic | `02-ARCHITECTURE.md`, `pdf_report_engine.py` notes in overview |
| Schema/Mongo | `03-DATABASE-AND-DATA-MODEL.md` |
| Deploy/run | `15-SETUP-AND-RUNBOOK.md` |
| Risk | `11-KNOWN-ISSUES-AND-TECH-DEBT.md`, `14-SAFE-CHANGE-GUIDE.md` |

Machine summary: [`project-context.json`](./project-context.json)

## Non-negotiables (short)

- **Never assume** project-specific behavior without checking these docs **and** the live code.
- Do **not** invent a daily attendance system.
- Do **not** break `/50` thresholds or S2→Q3/Q4 display mapping.
- Keep term selectors globally synced.
- Preserve bilingual RTL.
- Prefer extending existing UI DNA over new design systems.
- No secrets in commits or docs.

## First commands when unsure

```text
1. Grep the feature keyword in frontend/src and backend/server.py
2. Trace the API path in server.py
3. Check academicScope.js if semester/quarter involved
4. Check i18n.js for both languages before adding UI strings
```

## After you ship a meaningful change

Update the relevant `codex-context` files (see AGENTS.md → Keep Project Memory Updated).
