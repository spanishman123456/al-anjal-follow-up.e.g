# 03 — Database and Data Model

**CONFIRMED** collections used via Motor `db.<name>` in `server.py`:

| Collection | Purpose |
|------------|---------|
| `users` | Admin/Teacher (and seeded Counselor role users); auth, profile, schedule, assigned classes, Google linkage, gmail_approval_status |
| `roles` | Role definitions + permission string lists (permissions largely unused for route checks) |
| `classes` | Class sections (e.g. 4A–8B); name, grade metadata |
| `students` | Student identity + class membership + some denormalized score fields |
| `weeks` | Academic weeks per semester/quarter (Q1: 1–9, Q2: 10–18) |
| `student_scores` | Per-student per-week score documents |
| `remedial_plans` | Support plans |
| `rewards` | Reward definitions |
| `reward_events` | Award/remove badge events |
| `audit_logs` | Action logging |
| `app_settings` | General keyed settings such as sms_templates, promotion, and calendar_sync |
| `calendar_events` | Synced academic calendar rows |
| `notification_logs` | In-app notification history |
| `report_settings` | Weekly admin report configuration (`id: weekly_report`, grade, report type, update timestamp) |

Default DB name: `school_db` (`DB_NAME`).

### Settings storage split (CONFIRMED)

- `app_settings` stores general keyed settings such as SMS templates, promotion, and calendar sync.
- `report_settings` is a separate collection used by `/api/reports/settings` and the scheduled weekly admin-report job.
- Do not consolidate or rename these collections without an explicit schema/API impact review.

## Entity notes

### Student (CONFIRMED)

- Identity: `id`, `full_name`, `class_id`, optional student number fields used in import.
- Lifecycle: create, update, transfer (class change), promote (settings-gated), delete.
- Scores primarily live in `student_scores` keyed by week; some endpoints also surface aggregated fields on student payloads.

### StudentScoreRecord / week scores (CONFIRMED fields)

Typical numeric fields (maxima in UI/comments):

- `attendance` (2.5) — **score criterion, not daily attendance**
- `participation` (2.5)
- `behavior` (5) — UI may label “Project”
- `homework` (5)
- `quiz1`…`quiz4` (5 each; best-of-two logic per quarter)
- `chapter_test1_practical` / `chapter_test2_practical` (10)
- `quarter1_practical` / `quarter1_theory` / `quarter2_practical` / `quarter2_theory` (10 each)

### Week (CONFIRMED)

- Belongs to semester + quarter.
- Number ranges differ by quarter (1–9 vs 10–18).
- Deleting weeks can cascade score cleanup (Admin operations — high risk).

### Class (CONFIRMED)

- Seeded 4A–8B if empty.
- Teachers may be auto-assigned on create depending on role flows.

### User / Teacher (CONFIRMED)

- `role_name`, `active`, `password_hash`, `auth_version`, `assigned_class_ids`, schedule, subjects, avatar_base64.
- Google: `google_sub` / email linkage + `gmail_approval_status` ∈ pending|approved|rejected (exact enum strings as implemented in server).

## Indexes (CONFIRMED on startup)

Startup creates indexes on students, student_scores, weeks, classes, users (ids and common query fields).

## Secrets

Do **not** document credential values. Env names: see `15-SETUP-AND-RUNBOOK.md`.
If `mongo.txt` or similar appears in tree: treat as sensitive; never copy contents into docs.
