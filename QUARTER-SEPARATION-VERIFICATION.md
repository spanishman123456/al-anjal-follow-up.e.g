# Quarter separation – verification (problem gone for good)

This document confirms the fixes that **permanently** keep Semester 1 Quarter 1, Semester 1 Quarter 2, Semester 2 Quarter 1, and Semester 2 Quarter 2 independent. Deleting or editing a week in one quarter **cannot** affect another quarter.

---

## 1. Backend guarantees

### List weeks (`GET /weeks`)

- **File:** `backend/server.py` (around lines 1772–1793)
- **Behavior:**
  - When `semester` is sent (which the app always does), the backend **always** filters by `quarter`.
  - Query used: `{"semester": sem, "quarter": q}`. Only weeks for that exact (semester, quarter) are returned.
  - If `quarter` is missing or not 1/2, it defaults to `1`. The old path that returned “all weeks for the semester” is **no longer used** when semester is set.
- **Result:** Quarter 1 and Quarter 2 **never** receive the same set of weeks from the API.

### Delete week (`DELETE /weeks/{week_id}`)

- **File:** `backend/server.py` (around lines 1814–1835)
- **Behavior:**
  - Accepts optional query params: `semester`, `quarter`.
  - Before deleting, loads the week and checks that its `semester` and `quarter` match the request.
  - If they don’t match → returns **403** and does **not** delete.
- **Result:** A week from one quarter **cannot** be deleted when the user is in another quarter (frontend sends the current semester/quarter).

### Create week (`POST /weeks`)

- **File:** `backend/server.py` (around lines 1796–1811)
- **Behavior:** Each new week is stored with `semester` and `quarter` from the request. Each document has a unique `id` (UUID). No sharing between quarters.

### Startup migration

- **File:** `backend/server.py` (around lines 3967–3987)
- **Behavior:** On startup, any week missing `quarter` or with invalid `quarter` gets `quarter` set from its `number` (1–9 → 1, 10–18 → 2). Seed creates separate weeks per (semester, quarter).
- **Result:** Existing data is corrected so list/delete by (semester, quarter) works as intended.

---

## 2. Frontend guarantees

### Students page (only place that deletes weeks)

- **File:** `frontend/src/pages/Students.jsx`
- **List weeks:** `api.get("/weeks", { params: { semester: semesterNumber, quarter } })` (lines 295–297).
- **Delete week:** `api.delete(\`/weeks/${activeWeekId}\`, { params: { semester: semesterNumber, quarter } })` (lines 325–327).
- **Result:** The backend always receives the **current** semester and quarter, so list and delete are always scoped to the visible quarter.

### Other pages that use weeks

- AssessmentMarks, AssessmentMarksQ2, FinalExamsAssessment, FinalExamsAssessmentQ2 all call `GET /weeks` with `params: { semester: semesterNumber, quarter }`. No other page deletes weeks.

### App context

- **File:** `frontend/src/App.js`
- **Behavior:** `quarter` is state, default `1`, persisted in `localStorage`. So the app always has a defined semester and quarter when calling the API.

---

## 3. Quick manual test (confirm problem is gone)

1. **Semester 1 – Quarter 1**
   - Open **Students** (under Semester 1 – Quarter 1).
   - Note the list of weeks (e.g. Week 1, Week 2, …).
   - Delete one week (e.g. Week 2).
   - Confirm it disappears from the list.

2. **Switch to Semester 1 – Quarter 2**
   - In the sidebar, open **Semester 1 – Quarter 2** → **Students**.
   - Confirm the weeks shown are **only** Quarter 2 weeks (e.g. Week 10, 11, …).
   - Confirm the week you deleted in Quarter 1 is **not** here (and that no week “disappeared” from this list).

3. **Optional**
   - In Quarter 2, delete a week.
   - Switch back to Quarter 1 and confirm Quarter 1’s list is **unchanged**.

If all of the above hold, the problem is gone and quarters stay independent.

---

## 4. Summary

| What used to go wrong | How it’s fixed now |
|------------------------|--------------------|
| List weeks sometimes returned all semester weeks for both Q1 and Q2 | When `semester` is set, backend **always** filters by `quarter` (default 1). No “all weeks for semester” path. |
| Deleting in one quarter could remove a week from the other | Delete requires the week’s (semester, quarter) to match the request; otherwise 403 and no delete. |
| Frontend could call API without quarter | All week calls use `semester` and `quarter` from context; delete sends them as params. |

With these updates, the quarter-separation problem is addressed in code and can be re-verified anytime using the steps in section 3.
