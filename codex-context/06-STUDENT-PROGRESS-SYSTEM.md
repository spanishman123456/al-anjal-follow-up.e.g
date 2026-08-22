# 06 — Student Progress System

In this codebase, **“progress” means academic follow-up scoring and performance classification**, not a separate skill-tree module.

## Score stack (CONFIRMED)

| Layer | Max | Composition |
|-------|-----|-------------|
| Follow-up (Students) | 15 | attendance + participation + behavior + homework |
| Quizzes + chapter | 15 | Best of two quizzes (≤5) + chapter practical (≤10) |
| Assessment total | 30 | Follow-up 15 + quizzes/chapter 15 |
| Quarter exams | 20 | Practical 10 + theory 10 |
| **Quarter total** | **50** | Assessment 30 + exams 20 |
| Semester | ≤100 | Q1 + Q2 when both present |

Canonical backend function: `compute_cumulative_quarter_score_50` in `server.py`.

**CONFIRMED quirks:**

- Quizzes: take **max** of the two quiz slots for the quarter (one counted).
- Effective exam/chapter values often take **best across weeks** (not naive averages of blanks).
- Spillover/remap helpers exist for mis-keyed week numbers — fragile.

## Performance levels (CONFIRMED)

### Quarter total /50

| Level | Range |
|-------|--------|
| `on_level` | ≥ 46 |
| `approach` | ≥ 43 and &lt; 46 |
| `below` | &lt; 43 (with substance guards) |
| `no_data` | insufficient meaningful marks |

Constants: `QUARTER_TOTAL_ON_LEVEL = 46`, `QUARTER_TOTAL_APPROACH = 43`.

### Follow-up /15 and Assessment /30

Separate thresholds in UI/backend comments (e.g. Students on-level ≥13/15; assessment ≥25/30). Keep frontend `performanceBadges.js` aligned with backend labels: `on_level`, `approach`, `below`, `no_data`.

### Need support

Typically scored students below on-level (&lt;46/50) or in approach/below lists — used by Dashboard/Reports/Analytics support tables.

## Where progress is shown

- Dashboard metrics + charts
- Analytics Visual Board + tabs (struggling/excelling)
- Reports grade PDF/Excel
- Classes summary
- Performance badges on tables

## Historical tracking

Per-week documents in `student_scores` provide history within the academic term structure (weeks). There is **no** separate longitudinal “progress events” collection beyond scores, remedial plans, and reward events.

## Formulas Codex must not casually change

1. Quarter /50 composition.
2. On-level rate = on_level count / cohort total (including how no_data is counted — verify call site).
3. Display quarter numbering for S2 (Q3/Q4) in exports/PDF — must stay consistent with UI.

## Related files

- `backend/server.py` — compute + analytics + PDF
- `frontend/src/lib/performanceBadges.js`
- `frontend/src/lib/insightAutofill.js`
- Assessment/Final/TotalMarks/Students pages

## Arabic Section quarter model (CONFIRMED)

Arabic grading is dispatched separately from the protected International pipeline:

```
Continuous /40 = performance tasks 10 + participation 10 + interaction 10 + attendance 10
Tests /60 = theory 1 15 + theory 2 15 + practical 1 15 + practical 2 15
Quarter /100 = continuous 40 + tests 60
```

Semester 1 displays Q1/Q2; Semester 2 displays Q3/Q4. Each quarter is independent. A score of `0` counts as entered/tested; `null` is missing. Arabic performance thresholds are intentionally **not configured** yet, so Arabic analytics report totals and completion rather than applying International bands.
