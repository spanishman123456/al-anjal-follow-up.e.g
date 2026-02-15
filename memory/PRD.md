# Al Anjal School Follow-up Record PRD

## Original Problem Statement
Develop an innovative website that effectively tracks and enhances students' progress, leveraging the information from the provided Excel sheet. The platform must allow role management, import class structures (4A–8B), enroll/transfer students, record Quiz 1/2 and Chapter Test 1/2 results, analyze performance with charts and reports, manage remedial plans and rewards, and generate grade-level analysis reports. Bilingual Arabic + English UI, manual Excel upload, thresholds: Exceeding ≥47, Meeting ≥45, Approaching ≥43, Below <40. Roles: Admin, Teacher, Counselor.

## Architecture Decisions
- Full-stack: React (CRA) frontend, FastAPI backend, MongoDB via MONGO_URL.
- Bilingual (Arabic/English) with RTL support toggled on the client.
- Performance scoring normalized to 50 (from raw 30) for threshold evaluation.
- Role management and staff user records without authentication enforcement (MVP scope).

## Implemented Features
- Class seeding (4A–8B), class CRUD, and class performance summaries.
- Student CRUD, score entry (Quiz 1/2, Chapter Test 1/2), transfer via class change.
- Analytics summaries, performance distribution, class/grade charts, and reports.
- Excel import endpoint for batch class/student creation and score ingestion, plus bulk import tools and templates in UI.
- Remedial plans and rewards workflows with structured steps.
- Role and user management for Admin/Teacher/Counselor.
- UI: Dashboard, Students, Classes, Analytics, Remedial Plans, Rewards, Reports, Settings.
- Advanced student filters and report print/download actions.
- PDF/Excel report exports for Reports, Analytics, and Classes, plus weekly admin email scheduling.
- Inline student score editing on the Students page and profile settings with avatar upload.
- Teacher profile pages with schedules, class performance, audit logs, and admin-managed permissions.
- Promotion toggle in settings, student action menu (transfer/edit grades/delete), and academic calendar sync page.
- SMS notifications to admin on calendar sync and promotions; timetable moved to dashboard with editable grid.
- SMS notifications to admin on student transfer and deletion events.
- Notification log page with filters and PDF/Excel export.
- JWT-based login (username/password) with admin default credentials and auth-protected APIs.
- Profile settings allow updating username/password.
- Calendar sync now falls back to Saudi academic year template if MOE data is unavailable.
- Students page now supports weekly organization (default 19 weeks) with week CRUD and week-specific scores/imports.
- Analytics page includes class selector filter.
- Dashboard now exposes academic year + semester switcher and shows avg chapter test score.
- Students week tabs filter by semester (semester 1/2).
- Weeks are now per semester (1-19) with dropdown selection and new weekly scoring fields (attendance/participation/behavior/homework + special tests in weeks 4/16).
- Added quarter totals to student table and reports; clear-all-scores workflow in Students page.
- Added admin reset password flow for users (fixes missing password hashes).
- Excel import now auto-detects header rows/sheets and supports Arabic/English column variations.
- Added student marks export (Excel) for selected week/class.
- Excel/CSV import now accepts regular sheets with auto header + class inference; Classes page includes delete action.
- Added quarter practical/theory exams (weeks 9/10/17/18) and teacher class filtering + class delete cascade.
- Extended JWT session lifetime to reduce frequent logouts.
- SMS template editor (Arabic/English) with previews in Settings and saved templates used for SMS sends.

## Prioritized Backlog
### P0
- Add authentication and permission enforcement per role.
- Bulk edit scores and student transfers from table views.

### P1
- Excel column mapping UI and validation errors preview.
- Export reports to PDF/Excel.
- Set weekly email schedule management UI.

### P2
- Notifications for at-risk students.
- Trend analytics over time and cohort comparisons.

## Next Tasks
- Confirm exact Excel column headers and finalize import mapping UI.
- Add login flow (if required) and protect admin-only actions.
