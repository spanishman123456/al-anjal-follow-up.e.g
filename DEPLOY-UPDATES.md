# Deploy the latest updates

Push code to GitHub and let **Render** redeploy **both** the frontend and backend services.

---

## 1. Open a terminal in the project folder

```powershell
cd "C:\Users\hosam\OneDrive\Desktop\Desktop Stuff to review\New Source file of Al Anjal Foloow up Record Website\Hosam-main\Hosam-main"
```

---

## 2. Commit and push

```powershell
git status
git add -A
git commit -m "Your commit message here"
git push origin main
```

---

## 3. Deploy on Render

If auto-deploy is enabled (recommended), Render starts new builds for connected services when you push to `main`.

Otherwise, for **each** service (frontend + backend):

1. Open [dashboard.render.com](https://dashboard.render.com).
2. Select the service.
3. **Manual Deploy** → **Deploy latest commit**.

Wait until both show **Live**.

---

## 4. Verify

1. Open your **frontend Render URL** (not the backend API URL).
2. Log in and spot-check the pages you changed.
3. Optional: open `https://your-backend.onrender.com/health` — should return OK.

---

## Environment variables (usually unchanged)

| Service | Variable | Value |
|---------|----------|--------|
| Frontend | `REACT_APP_BACKEND_URL` | Backend Render URL (no `/api`) |
| Backend | `CORS_ORIGINS` | Frontend Render URL (no trailing slash) |
| Backend | `MONGO_URL`, `JWT_SECRET`, `DB_NAME` | As already configured |

If you change any `REACT_APP_*` variable on the frontend, you must **redeploy** the frontend so the build picks it up.

---

## Summary

| Step | Action |
|------|--------|
| 1 | `git add` / `commit` / `push` to `main` |
| 2 | Wait for Render frontend + backend deploys |
| 3 | Test the live frontend URL |

Full setup guide: [DEPLOY-FULL-ON-RENDER.md](DEPLOY-FULL-ON-RENDER.md).
