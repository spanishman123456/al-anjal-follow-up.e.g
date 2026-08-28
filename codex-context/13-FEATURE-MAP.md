# 13 — Feature Map

## School sections (CONFIRMED 2026-08-22)

- Global International/Arabic switcher in `AppShell`; legacy default is International.
- Section/year-scoped Classes and Students with Teacher `assigned_class_ids` preserved.
- International routes retain the `/15 → /30 → /50` pages and calculations.
- Arabic Section has scoped Excel student/class import, quarter `/100` grade entry (`/40` continuous + best theory `/30` + practical `/30`), Dashboard, Analytics, Reports, three-attempt completion lists, and Arabic-safe PDF/Excel export.
- International and Arabic Dashboards share one user-owned weekly timetable editor; timetable records are isolated by school section and academic year, with legacy schedules treated as current-year International only.
- Arabic performance thresholds remain intentionally undefined.

| Feature | UI | Logic | Database | API (examples) | Main files |
|---------|----|-------|----------|----------------|------------|
| Login | `Login.jsx` | Immediate JWT request; background warm-up only; one bounded connection retry | `users` | `/api/auth/login` | `App.js`, `api.js`, `server.py`, `Login.test.jsx` |
| Google approval | Login + Settings | pending→approved | `users`, `notification_logs` | `/api/auth/google`, gmail-pending-* | `server.py`, `Settings.jsx` |
| Dashboard | `Dashboard.jsx` | summary metrics | scores/students | `/analytics/summary`, missed-assessments | `Dashboard.jsx`, `server.py` |
| Dashboard timetable | Both section Dashboards | Sunday–Thursday, 8 editable periods | `users.timetable_records` + legacy International `schedule` | `/timetables/profile` | `DashboardTimetable.jsx`, `TimetableEditor.jsx`, `server.py` |
| Students weekly marks | `Students.jsx` | /15 follow-up | `students`, `student_scores`, `weeks` | students CRUD, bulk-scores | `Students.jsx`, `server.py` |
| Quizzes/Chapter Q1 | `AssessmentMarks.jsx` | /30 | scores | students/export, bulk | page + server |
| Quizzes/Chapter Q2 | `AssessmentMarksQ2.jsx` | /30 | scores | same | page + server |
| Finals Q1 | `FinalExamsAssessment.jsx` | /50 | scores | same | page + server |
| Finals Q2 | `FinalExamsAssessmentQ2.jsx` | /50 | scores | same | page + server |
| Total marks matrix | `TotalMarks.jsx` | combined edit | scores | bulk-scores | `TotalMarks.jsx` |
| Pre-test / diagnostic marks | `BaselineAssessments.jsx` entry mode | Variable maximum; independent >=75 / >=50 bands; revision-safe totals | `baseline_assessments` | `/baseline-assessments`, `/{id}/scores` | `baseline_assessments.py` |
| Baseline analytics/PDF | Same page analytics mode | Shared snapshot, student donut, horizontal bars, numerical interpretation | Same collection | `/{id}`, `/{id}/export.pdf` | `baseline_assessments.py`, `baseline_pdf.py` |
| Classes | `Classes.jsx` | CRUD + summary | `classes` | `/classes*` | `Classes.jsx` |
| Analytics | `Analytics.jsx` | charts/insights | aggregated | `/analytics/overview`, export | VisualBoard, server PDF |
| Reports | `Reports.jsx` | grade reports | aggregated | `/reports/grade`, export | Reports + pdf engine |
| Weekly report settings | Settings/report scheduling paths | scheduled admin report configuration | `report_settings` | `/reports/settings` | `server.py` |
| Remedial | `RemedialPlans.jsx` | plans CRUD | `remedial_plans` | `/remedial*` | page + server |
| Rewards | `Rewards.jsx` | badges/certs | `rewards`, `reward_events` | award-badge, certificates | page + server |
| Lesson plans | `LessonPlanGenerator.jsx` | DOCX fill | files on disk | lesson-plan* | `lesson_plan_service.py` |
| Teachers | `Teachers.jsx`, `TeacherProfile.jsx` | profiles | `users` | `/teachers*` | pages + server |
| Notifications | `Notifications.jsx` | logs/SMS templates | `notification_logs`, settings | `/notifications*` | page + server |
| Calendar | `Calendar.jsx` | Admin PDF import, year history/switching, bilingual week/event display | `academic_calendars` + versioned `calendar_events` | `/calendar/years`, `/calendar/events`, `/calendar/status`, `/calendar/import` | page + `calendar_pdf_import.py` + server |
| Settings | `Settings.jsx` | users/roles/promotion | `users`, `roles`, `app_settings` | various admin | `Settings.jsx` |
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
