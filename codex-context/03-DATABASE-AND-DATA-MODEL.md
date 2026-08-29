# 03 — Database and Data Model

**CONFIRMED** collections used via Motor `db.<name>` in `server.py`:

| Collection | Purpose |
|------------|---------|
| `users` | Admin/Teacher (and seeded Counselor role users); auth, profile, scoped timetable records, assigned classes, Google linkage, gmail_approval_status |
| `roles` | Role definitions + permission string lists (permissions largely unused for route checks) |
| `classes` | Class sections (e.g. 4A–8B); name, grade metadata |
| `students` | Student identity + class membership + some denormalized score fields |
| `weeks` | Academic weeks per semester/quarter (Q1: 1–9, Q2: 10–18) |
| `student_scores` | Per-student per-week score documents |
| `arabic_quarter_scores` | Arabic Section quarter-level /100 grades, keyed by student + academic year + semester + quarter |
| `baseline_assessments` | Separate pre-test / diagnostic mark-entry records; teacher, section, year, term, fixed maximum/roster, totals, revision |
| `remedial_plans` | Support plans |
| `rewards` | Reward definitions |
| `reward_events` | Award/remove badge events |
| `audit_logs` | Action logging |
| `app_settings` | General keyed settings such as sms_templates and promotion; legacy calendar_sync records may remain but are no longer read |
| `academic_calendars` | One metadata/active-version record per imported academic year |
| `calendar_events` | Immutable versioned rows extracted once from approved school calendar PDFs |
| `notification_logs` | In-app notification history |
| `report_settings` | Weekly admin report configuration (`id: weekly_report`, grade, report type, update timestamp) |

Default DB name: `school_db` (`DB_NAME`).

### Settings storage split (CONFIRMED)

- `app_settings` stores general keyed settings such as SMS templates and promotion. Calendar imports now use `academic_calendars`; no external calendar synchronization runs.
- `report_settings` is a separate collection used by `/api/reports/settings` and the scheduled weekly admin-report job.
- Do not consolidate or rename these collections without an explicit schema/API impact review.

### Academic calendars (CONFIRMED)

- `academic_calendars.academic_year` is unique and points to one immutable `active_version` in `calendar_events`.
- Re-importing a year inserts and validates a new event version before changing that pointer; older years and prior event versions are preserved.
- Default calendar resolution is date-based (`academic_year_start <= today < next_academic_year_start`), while the API can request a historical `academic_year` explicitly.
- Calendar records are school-wide and intentionally have no International/Arabic section field.

## Entity notes

### Student (CONFIRMED)

- Identity: `id`, `full_name`, `class_id`, optional student number fields used in import.
- Lifecycle: create, update, transfer (class change), promote (settings-gated), delete.
- Scores primarily live in `student_scores` keyed by week; some endpoints also surface aggregated fields on student payloads.
- `school_section` is `international|arabic`; legacy records are migrated/defaulted to `international`.
- `academic_year` scopes enrollment records. The student's section/year must match the target class.

### School section ownership (CONFIRMED)

- `classes.section` still means the A/B classroom suffix. It was deliberately **not** repurposed.
- `classes.school_section` and `students.school_section` hold the school division.
- `classes.academic_year` and `students.academic_year` support year isolation.
- `classes.grade` is required scoring metadata for Arabic classes. Startup safely backfills a missing/invalid grade and A/B section only when an Arabic class name is unambiguous (for example `رابع أ`); it never renames the class or guesses an unparseable grade.
- Arabic grades are stored separately in `arabic_quarter_scores`; International grades remain in `student_scores` unchanged.
- Arabic score documents denormalize `school_section: arabic` and `academic_year` and have a unique compound index on student/year/semester/quarter.

### ArabicQuarterScore (CONFIRMED)

- Continuous `/40`: `performance_tasks`, `participation`, `interaction`, `attendance` (each `/10`).
- Tests `/60`: `theory_test_1`, `theory_test_2`, and `practical_test` are raw attempts. Only the better valid theory attempt contributes (`/30` weighted), and the practical contributes `/30` weighted.
- Raw maximum is derived from canonical `classes.grade`: Primary grades 1–6 use `/15`; Middle grades 7–9 and Secondary grade 10+ use `/20`.
- `null` means missing; numeric `0` means entered/tested.
- Legacy `practical_test_1` / `practical_test_2` fields are never deleted. Startup migration copies a sole/equal legacy practical score to `practical_test`; conflicting values are retained in `legacy_exam_backup` and flagged with `legacy_migration_status: manual_review`.

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
- `timetable_records.<school_section>__<academic_year>` stores each user's Sunday–Thursday, 8-period timetable by school section and academic year. The existing `schedule` field remains the current-year International fallback/mirror for backward compatibility; Arabic never reads or writes it.
- Google: `google_sub` / email linkage + `gmail_approval_status` ∈ pending|approved|rejected (exact enum strings as implemented in server).

## Indexes (CONFIRMED on startup)

### Baseline record impact (2026-08-28)

- New collection only; no migration or write to existing enrollment, weekly or Arabic quarter scores.
- Mongo `_id` and public `id` are the same UUID. An indexed scope is `school_section + academic_year + semester + quarter + teacher_id + created_at`.
- Setup stores a title, test date, positive finite `max_score`, class IDs and names, and an immutable roster snapshot (`id`, `full_name`, `class_id`, `class_name`). It does not store questions or administer tests.
- `scores` maps roster student IDs to numeric totals or `null`; omitted means unscored. `revision` starts at 1; writes compare and increment it atomically and store `updated_by` / `updated_at`.
- Maximum, term and roster cannot be edited through the scores endpoint. A different test/maximum requires a separate record. Later enrollment/transfer/promotion/deletion does not silently rewrite historical rosters or clear saved results. Historical retention/deletion must be handled explicitly if a future policy requires it.
- Teachers can read/update only their own records while **all** included classes remain assigned; Admin can read/update all. Lists, details and PDF exports use the same guard. Revoking one included class hides the whole record from that teacher rather than leaking the remaining roster.
- No destructive baseline endpoint is supplied. Partial score updates preserve all untouched students; clearing a mark uses explicit `null` and the UI confirms clearing previously saved totals.

Startup creates indexes on students, student_scores, weeks, classes, users (ids and common query fields).

## Secrets

Do **not** document credential values. Env names: see `15-SETUP-AND-RUNBOOK.md`.
If `mongo.txt` or similar appears in tree: treat as sensitive; never copy contents into docs.
