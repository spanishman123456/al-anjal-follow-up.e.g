# 13 — Feature Map

## School sections (CONFIRMED 2026-08-22)

- Global International/Arabic switcher in `AppShell`; legacy default is International.
- Section/year-scoped Classes and Students with Teacher `assigned_class_ids` preserved.
- International routes retain the `/15 → /30 → /50` pages and calculations.
- Arabic Section has exact-class, preview-before-apply Excel enrollment import with Arabic identity/header safeguards and legacy numeric-name repair; quarter `/100` grade entry (`/40` continuous + best theory `/30` + practical `/30`), Dashboard, Analytics, Reports, three-attempt completion lists, and Arabic-safe PDF/Excel export.
- International and Arabic Dashboards share one user-owned weekly timetable editor; timetable records are isolated by school section and academic year, with legacy schedules treated as current-year International only.
- Arabic performance thresholds proportionally mirror International (`/100`: on level 92+, approach 86+; weekly `/40`: on level 34.6667+, approach 26.6667+).

| Feature | UI | Logic | Database | API (examples) | Main files |
|---------|----|-------|----------|----------------|------------|
| Login | `Login.jsx` | Immediate JWT request; background warm-up only; one bounded connection retry; browser session expires after 30 minutes of human inactivity across refreshes/tabs | `users` (idle deadline is browser-local) | `/api/auth/login` | `App.js`, `api.js`, `idleSession.js`, `server.py`, login/idle tests |
| Google approval | Login + Admin Settings | Every first Google identity/link is pending→approved; provider-bound JWT re-checks approval; rejection preserves separate local login | `users`, `notification_logs` | `/api/auth/google`, gmail-pending-* | `server.py`, `Settings.jsx`, auth-security tests |
| Dashboard | `Dashboard.jsx` | summary metrics | scores/students | `/analytics/summary`, missed-assessments | `Dashboard.jsx`, `server.py` |
| Dashboard timetable | Both section Dashboards | Sunday–Thursday, 8 editable periods | `users.timetable_records` + legacy International `schedule` | `/timetables/profile` | `DashboardTimetable.jsx`, `TimetableEditor.jsx`, `server.py` |
| Students / enrollment import | `Students.jsx`, `ArabicStudents.jsx` | International /15 follow-up; Arabic exact-class preview/apply import and Admin exact-class roster deletion | `students` (`student_number` optional), `student_scores`, `arabic_quarter_scores`, `weeks` | students CRUD, `/import/excel`, scoped `DELETE /students`, bulk-scores | pages + `server.py` + import/deletion tests |
| Quizzes/Chapter Q1 | `AssessmentMarks.jsx` | /30; previewed Excel import targets quiz1 or quiz2 only | scores | students/export, `/score-sheet/import`, bulk | page + `ScoreSheetImportControl.jsx` + server |
| Quizzes/Chapter Q2 | `AssessmentMarksQ2.jsx` | /30; previewed Excel import targets quiz3 or quiz4 only | scores | same | page + shared import control + server |
| Finals Q1 | `FinalExamsAssessment.jsx` | /50 | scores | same | page + server |
| Finals Q2 | `FinalExamsAssessmentQ2.jsx` | /50 | scores | same | page + server |
| Total marks matrix | `TotalMarks.jsx` | combined edit | scores | bulk-scores | `TotalMarks.jsx` |
| Pre-test / diagnostic marks | `BaselineAssessments.jsx` entry mode | Variable maximum; independent >=75 / >=50 bands; revision-safe totals; title/snapshot-class-label editing; class-scoped maximum fill/clear; whole-record delete; Arabic exact-class enrollment import before snapshot creation; previewed score Excel import | `baseline_assessments` | `/baseline-assessments`, `DELETE /{id}`, `/{id}/metadata`, `/{id}/scores`, `/{id}/import`, `/import/excel` | page + `studentEnrollmentImport.js` + `baseline_assessments.py` + `score_sheet.py` |
| Baseline analytics/PDF/Excel | Same page | Shared snapshot, student donut, horizontal bars, numerical interpretation; exact 11-column Excel template | Same collection | `/{id}`, `/{id}/export.pdf`, `/{id}/export.xlsx` | `baseline_assessments.py`, `baseline_pdf.py`, `score_sheet.py` |
| Arabic weekly continuous assessment | `ArabicStudents.jsx` | Weeks 1–9 / 10–18; four `/10` components; entered-week average `/40`; exact-class maximum fill and weekly clear; one-student weekly eraser; performance; reward/comment/transfer/delete; Arabic promotion | `arabic_weekly_scores` | `/arabic/weekly-scores`, `/students/promote`, student transfer/delete | page + server + tests |
| Arabic quarter grades | `ArabicGrades.jsx` | Derived weekly average `/40` + best theory `/30` + practical `/30`; editor changes only three exams; exact-class maximum fill/clear; one-student exam eraser; Excel import targets one theory attempt; weekly history remains intact | `arabic_quarter_scores` + derived `arabic_weekly_scores` | `/arabic/grades` GET/DELETE, `/arabic/grades/bulk`, `/score-sheet/import`, Arabic exports | page + grading helper/tests + server |
| Classes | `Classes.jsx` | CRUD + summary; Arabic grade required and legacy Arabic ordinal metadata backfill | `classes` | `/classes*` | `Classes.jsx` + server startup migration |
| Analytics | `Analytics.jsx`, `ArabicAnalytics.jsx` | Shared class-first then student workflow; Arabic uses isolated `/100`, completion, distribution/class/student/component/raw-test/contribution charts, top/support lists and weekly `/40` average | aggregated | `/analytics/overview`, `/arabic/grades`, export | shared analytics components + server |
| Reports | `Reports.jsx`, `ArabicReports.jsx` | International grade reports; Arabic reuses the Analytics class-first/optional-student visual board and exports the same seven chart families plus detailed analysis | aggregated | `/reports/grade`, `/arabic/reports/export` | Reports, ArabicAnalytics, server + PDF engine |
| Weekly report settings | Settings/report scheduling paths | scheduled admin report configuration | `report_settings` | `/reports/settings` | `server.py` |
| Remedial | `RemedialPlans.jsx` | Section/term/class-scoped diagnostic, quarter-test, quarter-total and semester-total sources; strict recorded `<50%`; manual weakness details; stale-safe bilingual PDF | Existing score collections + baseline snapshots (legacy `remedial_plans` CRUD retained) | `/remedial-reports/sources`, `/preview`, `/export.pdf` | page + `server.py` + `remedial_report.py` |
| Rewards | `Rewards.jsx` | Active section/year roster, badges/certs/comments with bilingual UI | `rewards`, `reward_events` + local reward state | award-badge, certificates, `/students` | page + server |
| Lesson plans | `LessonPlanGenerator.jsx` | DOCX fill in both sections; English/Arabic label aliases; uploaded Word template remains formatting source | files on disk | lesson-plan* | `lesson_plan_service.py` |
| Teachers | `Teachers.jsx`, `TeacherProfile.jsx` | profiles | `users` | `/teachers*` | pages + server |
| Notifications | Admin bell + `Notifications.jsx` | Admin-only polling bell; Gmail request and Teacher password-change alerts; logs/SMS templates | `notification_logs`, settings | `/notifications*` | `AppShell.jsx`, page + server |
| Calendar | `Calendar.jsx` | Admin PDF import, year history/switching, bilingual week/event display | `academic_calendars` + versioned `calendar_events` | `/calendar/years`, `/calendar/events`, `/calendar/status`, `/calendar/import` | page + `calendar_pdf_import.py` + server |
| Settings | `Settings.jsx` | Profile for signed-in user; exact-Admin-only users/roles/promotion/Gmail approvals | `users`, `roles`, `app_settings` | various admin | `Settings.jsx`, `server.py` |
| Term selection | Header + `AcademicTermSelect` | global state | localStorage | query params | `App.js`, `academicScope.js` |
| i18n/RTL | all pages | dictionaries | — | — | `i18n.js` |
| PDF premium | export buttons | ReportLab | — | export endpoints | `pdf_report_engine.py`, `server.py` |
| Daily attendance roll-call | — | — | — | — | **NOT IMPLEMENTED** |

## Partial / local-only

| Feature | Notes |
|---------|-------|
| Some reward UI state | `studentRewardsStorage.js` (localStorage) — verify vs server rewards |
| Reward certificate Arabic | Certificate canvas currently uses Helvetica/direct text in `server.py`; unlike premium report PDFs, Arabic shaping/Amiri embedding is not yet applied |
| Counselor role | Seeded; limited dedicated UI enforcement |
