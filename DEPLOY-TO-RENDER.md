# Deploy to Render – All Fixes & Updates

All changes are **already in your project files**. Use this guide to push them to Render.

---

## Files that were modified

### Backend (1 file)
- **`backend/server.py`**
  - Score formulas: Assessment 30 (students 15 + best quiz + chapter test), Final 50 (assessment 30 + practical 10 + theory 10)
  - Students total for assessment: max of 9-week average and best single week (so 15 in one week = 15)
  - Full-year score map so Dashboard, Analytics, Classes, Reports use both Q1 and Q2 data
  - Q2 assessment: `compute_assessment_combined_q2` (quiz3, quiz4, chapter_test2)
  - Effective scores helpers: `_effective_scores_q1`, `_effective_scores_q2`
  - Enrich students with `assessment_combined_total`, `final_exams_combined_total`, and Q2 equivalents
  - Try/except on `/analytics/summary` and `/classes/summary` with clear error responses

### Frontend (8 files)
- **`frontend/src/lib/api.js`** – (no changes in this round; already had timeout and getApiErrorMessage)
- **`frontend/src/pages/Dashboard.jsx`** – (already used getApiErrorMessage)
- **`frontend/src/pages/AssessmentMarks.jsx`** – Use backend `assessment_combined_total`; show getApiErrorMessage on load failure
- **`frontend/src/pages/FinalExamsAssessment.jsx`** – Use backend `final_exams_combined_total`; show getApiErrorMessage on load failure
- **`frontend/src/pages/AssessmentMarksQ2.jsx`** – Use backend `assessment_q2_combined_total`; getApiErrorMessage on load failure
- **`frontend/src/pages/FinalExamsAssessmentQ2.jsx`** – Use backend `final_exams_q2_combined_total`; getApiErrorMessage on load failure
- **`frontend/src/pages/Students.jsx`** – getApiErrorMessage on “Failed to load students” and “Failed to load weeks”
- **`frontend/src/pages/Classes.jsx`** – getApiErrorMessage on “Failed to load classes”; import getApiErrorMessage
- **`frontend/src/pages/Analytics.jsx`** – getApiErrorMessage on “Failed to load analytics”; import getApiErrorMessage; fix fallbackError in catch

---

## Commands to push to Render

Run these in your project folder (PowerShell or Command Prompt).

### 1. Go to your project folder
```bash
cd "c:\Users\hosam\OneDrive\Desktop\Desktop Stuff to review\New Source file of Al Anjal Foloow up Record Website\Hosam-main\Hosam-main"
```

### 2. See what changed
```bash
git status
```

### 3. Stage all changes
```bash
git add backend/server.py
git add frontend/src/pages/AssessmentMarks.jsx
git add frontend/src/pages/FinalExamsAssessment.jsx
git add frontend/src/pages/AssessmentMarksQ2.jsx
git add frontend/src/pages/FinalExamsAssessmentQ2.jsx
git add frontend/src/pages/Students.jsx
git add frontend/src/pages/Classes.jsx
git add frontend/src/pages/Analytics.jsx
git add DEPLOY-TO-RENDER.md
```
Or stage everything at once:
```bash
git add -A
```

### 4. Commit with a clear message
```bash
git commit -m "Fix marks sync and errors: Assessment 30/30, Final 50/50, full-year data, better error messages"
```

### 5. Push to your repository (GitHub/GitLab/etc.)
```bash
git push
```

If your branch is not `main`:
```bash
git push origin YOUR_BRANCH_NAME
```

---

## After pushing

1. **Render** will pick up the push (if auto-deploy is on) and build the backend and/or frontend.
2. Wait for the deploy to finish in the Render dashboard.
3. If the backend is on the free tier and was sleeping, the first load may take up to a minute; refresh or try again.
4. Test: Dashboard, Students, Assessment Marks, Final Exams, Classes, Analytics, Reports – all should use the same scoring and show clearer errors when the server is unreachable.

---

## Summary of fixes included

| Area | Change |
|------|--------|
| **Assessment Marks** | Total = students (15) + best(Quiz1, Quiz2) + Chapter Test (15) = 30; backend sends `assessment_combined_total`; page shows 30/30 when data is full. |
| **Final Exams + Assessment** | Total = 30 + Practical 10 + Theory 10 = 50; backend sends `final_exams_combined_total`; page shows 50/50 when full. |
| **Students total for assessment** | Uses max(9-week average, best single week) so 15 in any one week counts as 15. |
| **Classes / Analytics / Reports / Dashboard** | Use full-year score map (both semesters) so Q1 and Q2 data both load; same 50-point final-exams logic. |
| **2nd Quarter** | Same logic for Q2 (quiz3, quiz4, chapter test 2, quarter2 practical/theory). |
| **Errors** | All load failures show the same API error (e.g. “server may be waking up—please try again in a minute”) via `getApiErrorMessage`. |
| **Backend** | `/analytics/summary` and `/classes/summary` wrapped in try/except so they return 500 with a message instead of crashing. |

You do **not** need to copy code from anywhere else; everything is already in the files above. Just run the git commands to push and let Render deploy.
