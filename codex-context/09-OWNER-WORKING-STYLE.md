# 09 — Owner Working Style

Evidence sources: recent Cursor conversation (PDF redesign, PageHero, favicon, term sync), git commit messages, live UI code.  
Each claim includes **Confidence**.

---

## DEVELOPMENT DNA

### How the owner works with agents

- Gives **long, explicit, screenshot-backed** briefs for visual work; expects a **full professional result**, not minor polish. (**High**)
- Frequently asks to **commit and push** after features land (Render deploy). (**High**)
- Values **Arabic correctness** (no tofu boxes in PDF; RTL). (**High**)
- Wants **system-wide consistency** (same banner everywhere; term dropdowns all sync). (**High**)
- Prefers **preserve data/calculations** while redesigning presentation. (**High** — explicit in PDF brief)

### Preferred solutions

- Extend shared components (`PageHero`, `AcademicTermSelect`) rather than one-off copies. (**High**)
- Premium academic aesthetic: navy/purple/cyan, rounded heroes, clear hierarchy. (**High**)
- Global academic year / semester / quarter always visible and coherent. (**High**)

### Dislikes / pushback patterns

- Plain / “default” PDF or headers. (**High**)
- Broken Arabic glyphs. (**High**)
- Term selectors that disagree across pages. (**High**)
- Login flicker / unstable session UX (multiple commits). (**High**)
- Inventing features not requested. (**Medium** — strong agent rule; owner briefs are scoped)

### Change size

- Accepts **large UI redesigns** when requested as such. (**High**)
- Still expects **no silent logic breakage**. (**High**)
- Small follow-ups (“one more modification”) are common after a big ship. (**High**)

### How success is judged

- Looks right in screenshots (desktop + identity).
- Works in Arabic and English.
- Deployed on Render after push.
- Existing numbers/workflows still correct.

### UI preferences

- Wide gradient heroes with purpose text per page. (**High**)
- Top nav (not old sidebar). (**High**)
- Brand logo as favicon/tab identity. (**High**)
- Readable cards/tables; performance color language (green/amber/red). (**High**)

### Data / teacher workflow preferences

- Term-first filtering.
- Class-scoped teaching.
- Excel import/export remains critical.
- Reports must be admin-shareable (PDF quality). (**High**)

---

## Things the owner consistently prefers

1. Bilingual + RTL fidelity.
2. Shared visual system across pages.
3. Accurate quarter labeling (S2 → Q3/Q4 display).
4. Push to `main` for Render.
5. Explicit testing guidance after complex changes.

## Things the owner dislikes

1. Generic SaaS-looking sparse reports.
2. Desynced filters.
3. Unreadable Arabic in exports.
4. Unstable login/session loops.

## How features should be implemented

1. Inspect current code path first.
2. Reuse layout/score helpers.
3. Keep API contracts stable unless asked.
4. Update i18n for both languages.
5. Commit message in repo style (imperative, why-focused).

## How changes should be proposed

- Lead with the user-visible outcome.
- List files touched.
- Call out risks to scoring/PDF/auth.

## Preference for preserving existing systems

**High confidence:** Owner repeatedly says preserve calculations/DB while improving layout — treat scoring as sacred unless explicitly changing pedagogy/thresholds.

## Incomplete / uncertain preferences

- Exact future product roadmap beyond PRD backlog: **UNCERTAIN**.
- Preferred TypeScript migration: **UNCERTAIN** (project is JS).
- Daily attendance product desire: **UNCERTAIN** — not in code; do not assume.
