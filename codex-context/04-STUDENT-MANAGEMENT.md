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
- Arabic Students reuses the same endpoint with explicit `school_section=arabic` + `academic_year`; it imports enrollment/class identity only and never writes International weekly score fields.
- `GET /api/students/import-template` accepts the same section/year scope and returns the compatible two-column Arabic enrollment template when Arabic is active.
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
6. The global `school_section` scope defaults to International for existing users/data. Class/student create, transfer, promotion, import, bulk delete, and grade writes must not cross sections.
7. Arabic students use the dedicated quarter `/100` editor and `arabic_quarter_scores`; never send them through weekly International bulk-score endpoints.

## Related

- Scores/levels → `06-STUDENT-PROGRESS-SYSTEM.md`
- Weekly `attendance` field → `05-ATTENDANCE-SYSTEM.md`
