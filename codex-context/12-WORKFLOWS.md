# 12 — Workflows

## Bulk-correct pre-test / diagnostic marks

1. Open Pre-test Scores / Diagnostic Test Scores and select the mark-entry record.
2. Optionally select one included class; leaving “All included classes” applies the action to the entire saved roster.
3. Use **Fill column with maximum** to stage the fixed maximum for every visible student, review the table, then select **Save marks**.
4. Use **Clear recorded marks** only with no unsaved draft. The confirmation names the current class scope and affected saved-score count; confirmation clears only that scope and advances the record revision.

## W1 — Login (password)

1. User opens SPA → if no token, `Login`.
2. Frontend may probe backend health (`/health` or `/health/live`).
3. `POST /api/auth/login` → JWT stored.
4. `GET /api/auth/me` → profile into shell.
5. Routes render under `AppShell`.

## W2 — Google / Gmail first-time teacher

1. Google ID token to `POST /api/auth/google`.
2. New email → inactive Teacher + `pending` approval + admin notification.
3. Admin approves via Settings/users Gmail pending APIs.
4. Teacher can log in when `active` + approved.

## W3 — Select academic term (global)

1. User changes term in header **or** `AcademicTermSelect` on Dashboard/Analytics/Reports.
2. `setSemester` + `setQuarter` in `App.js` (+ localStorage).
3. AppShell may redirect assessment routes Q1↔Q2.
4. Pages refetch using new semester/quarter.

## W4 — Weekly follow-up entry (Students)

1. Teacher/Admin selects class + week.
2. Edits attendance/participation/behavior/homework cells.
3. Save blur or bulk → `/students/bulk-scores` (or update endpoints).
4. Performance badge updates from /15 rules.
5. `students-updated` event may refresh other views.

## W5 — Quizzes / chapter / finals

1. Navigate Assessments group (path depends on quarter).
2. Filter class/search/performance.
3. Bulk edit → confirm → save.
4. Totals roll into /30 or /50 as documented in page comments.

## W6 — Analytics export PDF

1. Set term (+ class/student filters).
2. Load `/analytics/overview` (+ related).
3. Download PDF → backend ReportLab path with Amiri + charts DPI.
4. Filename uses display quarter helpers.

## W7 — Grade report

1. Reports page: grade + report type.
2. Generate → `/reports/grade`.
3. Insights autofill optional.
4. PDF/Excel/print.

## W8 — Excel import

Enrollment import:

1. Dashboard or Students import control.
2. Arabic enrollment requires one exact class selection, then `POST /api/import/excel?dry_run=true` with explicit section/year/class scope.
3. The server recognizes Arabic/English name and identity headers, validates the full file without writes, and rejects numeric names, duplicate identities, or a class conflicting with the selected class.
4. User confirms the preview; the same file is applied to the exact selected class. Existing legacy rows whose `full_name` is the uploaded identity number are repaired/moved instead of duplicated.
5. Classes/students are upserted per mapping rules; Arabic enrollment import does not map grades.
6. Refresh lists.

Score-sheet import:

1. Select the exact quiz/theory attempt, then upload the approved Excel layout.
2. `POST /api/score-sheet/import?apply=false` (or baseline `/{id}/import`) previews matching and validation counts.
3. User confirms overwrites; the same file is posted with `apply=true`.
4. Backend writes only the selected score field for existing scoped students. Practical and shaded metadata remain untouched.

Class roster deletion:

1. Admin selects one exact class on Arabic Student Management.
2. UI displays the loaded roster count and irreversible confirmation.
3. `DELETE /api/students` sends section/year/class scope.
4. Backend verifies the class belongs to that scope, then deletes only its students and their weekly/Arabic-quarter score records. Other classes and sections remain untouched.

Arabic smart bulk grading:

1. Select one exact class and one editable grade column.
2. “Fill maximum” stages `/10` for continuous fields or each student’s stage-aware `/15` or `/20` raw exam maximum.
3. Confirm before overwriting an entered non-maximum value.
4. Review the table and use the existing Save Grades action; the fill action itself does not persist.

## W9 — Award reward certificate

1. Rewards UI selects student/reward.
2. Backend generates PDF certificate → stored/served under certificates path.
3. `reward_events` logged.

## W10 — Lesson plan generate

1. Upload Word template + PDF source.
2. Preview endpoints.
3. Generate DOCX via `lesson_plan_service`.
4. Download generated file.
