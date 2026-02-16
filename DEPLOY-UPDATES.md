# Deploy the latest updates (Q1/Q2 separation + Classes fix)

Follow these steps to get the updates live on Vercel (frontend) and Render (backend).

---

## 1. Open a terminal in the project folder

In PowerShell or Command Prompt:

```powershell
cd "c:\Users\hosam\OneDrive\Desktop\Desktop Stuff to review\New Source file of Al Anjal Foloow up Record Website\Hosam-main\Hosam-main"
```

---

## 2. Check what changed

```powershell
git status
```

You should see modified files in `frontend/src`, `frontend/src/pages`, and `backend/server.py`.

---

## 3. Stage all changes

```powershell
git add -A
```

---

## 4. Commit with a clear message

```powershell
git commit -m "Fix Q1/Q2 marks separation and classes list: Q2 uses quiz3/quiz4/chapter_test2, pages fetch classes when empty"
```

---

## 5. Push to GitHub

```powershell
git push
```

If you use a different branch (e.g. `main`):

```powershell
git push origin main
```

---

## 6. Let Vercel and Render deploy

- **Vercel** (frontend): If the repo is connected, Vercel will detect the push and start a new build. Check the Vercel dashboard for the deploy status.
- **Render** (backend): If the repo is connected, Render will redeploy the backend. Check the Render dashboard for the deploy status.

If auto-deploy is **not** set up:

- **Vercel**: Dashboard → your project → **Deployments** → **Redeploy** (or connect the repo and enable “Deploy on push”).
- **Render**: Dashboard → your Web Service → **Manual Deploy** → **Deploy latest commit**.

---

## 7. Verify after deploy

1. Open your **Vercel app URL** (e.g. `https://your-app.vercel.app`).
2. Log in and check:
   - **1st Quarter Marks** (Assessment): edit Quiz 1 / Quiz 2 / Chapter Test 1 — only Q1 data should change.
   - **2nd Quarter Marks** (Assessment): you should see **Quiz 3**, **Quiz 4**, **Chapter Test 2**; editing them should not change Q1.
   - **Classes dropdown** and **Class** column should show the list of classes on Overview Students and both Assessment pages.

---

## Summary

| Step | Action |
|------|--------|
| 1 | `cd` to project folder |
| 2 | `git status` (optional) |
| 3 | `git add -A` |
| 4 | `git commit -m "..."` |
| 5 | `git push` (or `git push origin main`) |
| 6 | Wait for Vercel + Render to finish deploying |
| 7 | Test the app in the browser |

No need to change env vars or build commands; the same `REACT_APP_BACKEND_URL` and Render settings continue to work.
