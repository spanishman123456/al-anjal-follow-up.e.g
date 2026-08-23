# 05 — Attendance System (IMPORTANT CLARIFICATION)

## Status: CONFIRMED — No daily attendance module

This project **does not** implement school daily roll-call (Present / Absent / Late / Excused as attendance states).

Searches for attendance/absence/حضور/غياب as a **tracking system** find **no** dedicated collections, APIs, or UI screens.

## What *does* exist: weekly score field named `attendance`

**CONFIRMED:**

| Property | Value |
|----------|--------|
| Field name | `attendance` |
| Meaning | Graded weekly follow-up criterion |
| Max points | **2.5** |
| UI pages | Students, Total Marks (and included in /15 rollups used by assessment pages) |
| Excel alias | Includes Arabic header variants such as حضور (import mapping) |
| Storage | `student_scores` (and related student score payloads) |

### Contribution to totals

```
Follow-up /15 =
  attendance(≤2.5) + participation(≤2.5) + behavior(≤5) + homework(≤5)
  averaged/aggregated across weeks that have data (see server helpers)
```

Exact aggregation lives in `backend/server.py` (`compute_cumulative_*` / follow-up helpers). **Do not change without regression tests.**

### Arabic Section distinction

The Arabic Section also has a field named `attendance`, but it is an unchanged **continuous quarter grading component `/10`** inside `arabic_quarter_scores`. It contributes to Arabic Continuous Assessment `/40`; it is not daily roll-call and does not use the International weekly `/2.5` aggregation.

## Codex guidance

1. **Do not build** a full attendance product unless the owner explicitly requests it and accepts schema/UI scope.
2. When the owner says “attendance”, first confirm whether they mean:
   - the **2.5-point weekly mark**, or
   - a **new** daily presence feature (does not exist today).
3. Renaming the field is **high risk** (Excel aliases, UI labels, exports, bilingual keys).
4. Empty vs zero scores affect `no_data` vs `below` guards — preserve that logic.

## If a true attendance system is requested later

Treat as **greenfield feature**: new collection, statuses, date/timezone (Asia/Riyadh is used elsewhere via `REPORT_TIMEZONE`), reports, permissions — and document it here by replacing this clarification section.
