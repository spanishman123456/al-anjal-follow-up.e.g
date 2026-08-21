# 04 — Student Management

## Purpose (CONFIRMED)

Manage enrollment, class placement, weekly mark entry, transfers, promotion, import/export, and teacher-scoped visibility.

## Primary UI

- `frontend/src/pages/Students.jsx` — main weekly follow-up entry (/15).
- `Classes.jsx` — class CRUD and summaries.
- Assessment / Final / Total Marks pages — broader score matrices.
- `Settings.jsx` — promotion rules, users.

## Key API groups (CONFIRMED)

- `GET/POST/PUT/DELETE` students (and bulk-scores).
- Import Excel `POST /api/import/excel`.
- Export students Excel.
- Transfer / promote / delete (Admin or permitted flows).
- Class filters respect Teacher `assigned_class_ids`.

## Workflows

See `12-WORKFLOWS.md` (enroll, edit weekly scores, import, transfer).

## Business rules Codex must preserve

1. Teacher sees only assigned classes (CONFIRMED pattern).
2. Week selection is semester/quarter aware; storage keys include semester/quarter.
3. Bulk save and blur-save paths must not race (pages use request id guards).
4. Import must tolerate Arabic/English header aliases (CONFIRMED intent in PRD + import code).
5. Destructive “clear all scores” / delete-all operations are Admin-grade — confirm UX before changing.

## Related

- Scores/levels → `06-STUDENT-PROGRESS-SYSTEM.md`
- Weekly `attendance` field → `05-ATTENDANCE-SYSTEM.md`
