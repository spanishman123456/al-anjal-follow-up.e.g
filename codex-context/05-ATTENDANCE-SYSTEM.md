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

The Arabic Section also has a field named `attendance`, but it is a **weekly scored criterion `/10`** inside `arabic_weekly_scores`. Together with performance tasks, participation, and interaction it forms each week's `/40`; the arithmetic mean of entered weeks becomes the quarter Continuous Assessment `/40`. It is not daily roll-call and does not use the International weekly `/2.5` aggregation. Legacy quarter-level values in `arabic_quarter_scores` are read only as a fallback when the quarter has no weekly Arabic records.

## Codex guidance

1. **Do not build** a full attendance product unless the owner explicitly requests it and accepts schema/UI scope.
2. When the owner says “attendance”, first confirm whether they mean:
   - the International **2.5-point weekly mark**,
   - the Arabic **10-point weekly mark**, or
   - a **new** daily presence feature (does not exist today).
3. Renaming the field is **high risk** (Excel aliases, UI labels, exports, bilingual keys).
4. Empty vs zero scores affect `no_data` vs `below` guards — preserve that logic.
5. The per-student score eraser sends explicit `null` for the active scope only. On International weekly/total pages that includes the weekly `attendance /2.5`; on Arabic Student Management it includes the selected week's `attendance /10`. It must not clear another week, quarter, student, or class.

## If a true attendance system is requested later

Treat as **greenfield feature**: new collection, statuses, date/timezone (Asia/Riyadh is used elsewhere via `REPORT_TIMEZONE`), reports, permissions — and document it here by replacing this clarification section.
