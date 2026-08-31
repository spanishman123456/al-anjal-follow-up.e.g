# 06 — Student Progress System

In this codebase, **“progress” means academic follow-up scoring and performance classification**, not a separate skill-tree module.

## Score stack (CONFIRMED)

### Isolated pre-test / diagnostic analysis (2026-08-28)

Entry mode includes class-scope-aware smart tools: fill the visible score column with the fixed record maximum for review before saving, or immediately clear all saved marks in the selected class scope after an explicit count/scope confirmation. Both reuse the optimistic-revision score update and do not alter the record maximum or historical roster.

The entire record can also be deleted with its current revision after a destructive confirmation. This removes only that baseline/diagnostic snapshot and its saved marks; enrollment, the class itself, and other assessment records are untouched. Arabic setup may import/repair one exact class roster through the guarded enrollment preview/apply flow before record creation, after which the new snapshot displays the stored student and class names.

`baseline_assessments.py` is authoritative for this new score-only workflow. Percentage = raw total / teacher-specified maximum × 100. A record can use any positive finite maximum (up to 1,000,000); it is not inferred from teacher or grade. High is >=75%, Medium >=50% and <75%, Needs support <50% (including 30%). Blank remains missing; numeric zero is assessed. Classification uses the unrounded Decimal ratio; displayed numbers are rounded half-up to two places.

These thresholds apply in **both sections only to baseline tests**; they do not define Arabic quarter thresholds or change International grading. Averages exclude missing marks, completion counts numeric zero, distribution includes missing separately, and class comparisons stay within one test. Total scores support numerical interpretation/general recommendations, never invented topic weaknesses.

One deterministic server snapshot provides students, class means, distribution, narratives and labels to both the UI and `baseline_pdf.py`. Export requires the screen's snapshot SHA-256; concurrent changes, a different language or a different class scope cause 409 instead of exporting mismatched results. PDF includes every student bar (paginated) and the chosen student's donut/comparison/interpretation.

Baseline entry also supports the approved 11-column Excel layout. Import reads only student identity plus `درجة التسليم`, previews matched/new/overwrite/unmatched/duplicate/invalid counts, and applies only after confirmation with the record revision still current. It never changes enrollment or shaded metadata. Excel export preserves the exact header order and the white/gray column convention; PDF export remains snapshot-protected.

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
Weekly continuous /40 = performance tasks 10 + participation 10 + interaction 10 + attendance 10
Quarter continuous /40 = arithmetic mean of entered weekly totals
Best Theory /30 = max(valid Theory 1 raw, valid Theory 2 raw) / stage raw maximum × 30
Practical /30 = Practical Test raw / stage raw maximum × 30
Tests /60 = Best Theory 30 + Practical 30
Quarter /100 = continuous 40 + tests 60
```

Primary (grades 1–6) raw exams are `/15`; Middle (grades 7–9) and Secondary (grade 10+) raw exams are `/20`. Stage is derived only from canonical `classes.grade`. All three attempts—Theory 1, Theory 2, and Practical—must be entered for full completion, while available valid entries may produce a provisional total. Semester 1 displays Q1/Q2; Semester 2 displays Q3/Q4. Each quarter is independent. Internal quarter 1 uses weeks 1–9 and internal quarter 2 uses weeks 10–18 in both semesters. A score of `0` counts as entered/tested; `null` is missing. Only weeks containing at least one entered component participate in the continuous average.

Arabic performance bands now mirror the International mechanism proportionally to their different maxima: weekly continuous `/40` uses on-level `>=34.6667`, approach `>=26.6667`; quarter `/100` uses on-level `>=92`, approach `>=86`; lower scored totals are `below`, and wholly empty records remain `no_data`. Analytics, class summaries, student rows, PDF and Excel must use the same backend result.

The Arabic student-management page owns weekly continuous entry and the student-level actions. The Arabic grade editor shows the derived `/40` as one read-only column beside the three exam attempts and edits only those exam attempts. Legacy quarter-level continuous fields are not overwritten by exam-only saves.

Every score-entry surface exposes a clear/delete action: weekly follow-up, Q1/Q2 quiz and chapter marks, Q1/Q2 final exams, Total Marks editing, baseline/diagnostic entry, and Arabic quarter grades. The Arabic action deletes persisted `arabic_quarter_scores` rows only for one explicitly selected Arabic class, academic year, semester and quarter; teacher assignment is enforced, and other classes/terms are preserved. Unsaved Arabic edits must be saved or reloaded before deletion.

The dedicated score-sheet import maps `درجة التسليم` to one explicitly chosen Theory 1 or Theory 2 attempt and validates each student's `/15` or `/20` maximum. Practical remains manual. International assessment import uses the same one-file/one-target rule for Quiz 1 or Quiz 2 of the active quarter (stored as quiz1/quiz2 in Q1 and quiz3/quiz4 in Q2), maximum `/5`; chapter practical is never imported. These imports do not create or transfer students and do not use the broad enrollment importer.
