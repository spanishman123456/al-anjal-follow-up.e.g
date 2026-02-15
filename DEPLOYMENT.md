# Deploy Al Anjal School Follow-up Record to a Free URL

This guide walks you through hosting the app so you can use it from anywhere (school, home, etc.) with **all features working**. You will get:

- **Frontend**: A free URL like `https://your-app.vercel.app`
- **Backend**: A free URL like `https://your-app-backend.onrender.com`
- **Database**: Your existing MongoDB Atlas (free tier) — no change needed

---

## What You Need Before Starting

1. **GitHub account** (free) — [github.com](https://github.com)
2. **MongoDB Atlas** — You already use this. Keep your `MONGO_URL` from `backend\.env`.
3. **Vercel account** (free) — [vercel.com](https://vercel.com) — for the frontend
4. **Render account** (free) — [render.com](https://render.com) — for the backend

---

## Step 1: Push Your Code to GitHub

1. Create a new repository on GitHub (e.g. `al-anjal-school-app`). Do **not** add a README if you already have local code.
2. On your PC, open a terminal in the project folder (the one that contains `frontend`, `backend`, and `Start_App.bat`).
3. Run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

4. **Important**: Do **not** commit your real `.env` file. Create a `.gitignore` in the project root (if it doesn’t exist) and add:

   ```
   .env
   backend/.env
   frontend/.env
   frontend/.env.local
   node_modules/
   .venv/
   __pycache__/
   *.pyc
   ```

   Then commit again if you added `.gitignore` or fixed it.

---

## Step 2: MongoDB Atlas (Allow Cloud Access)

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Go to **Network Access** → **Add IP Address**.
3. Click **Allow Access from Anywhere** (adds `0.0.0.0/0`). This lets Render’s servers connect. Save.
4. Keep your `MONGO_URL` from `backend\.env` — you will paste it into Render in the next steps (as a secret).

---

## Step 3: Deploy the Backend on Render (Free)

1. Go to [render.com](https://render.com) and sign up / log in (GitHub is fine).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account if needed, then select the repository you pushed (e.g. `al-anjal-school-app`).
4. Configure the service:
   - **Name**: e.g. `al-anjal-backend`
   - **Region**: Choose one close to you (e.g. Frankfurt or Oregon).
   - **Root Directory**: leave empty or set to `backend` if your repo root is the repo root (see note below).
   - **Runtime**: **Python 3**.
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
     (If Root Directory is `backend`, use the same command; Render will run it in `backend`.)
   - **Start Command**:
     ```bash
     uvicorn server:app --host 0.0.0.0 --port $PORT
     ```
     (If Root Directory is **not** set, use:  
     `cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT`.)
5. **Environment Variables** (use “Add Environment Variable” and mark secrets as **Secret** where noted):
   - `MONGO_URL` — your full MongoDB Atlas connection string (from `backend\.env`). **Secret.**
   - `JWT_SECRET` — a long random string (e.g. generate one at [randomkeygen.com](https://randomkeygen.com)). **Secret.**
   - `DB_NAME` — e.g. `school_db` (same as in your `.env`).
   - `CORS_ORIGINS` — your frontend URL. You will set this **after** deploying the frontend (e.g. `https://your-app.vercel.app`). Until then you can use `*` to test, then change to the real URL.
6. Click **Create Web Service**. Wait for the first deploy to finish.
7. Copy your backend URL from the top of the dashboard (e.g. `https://al-anjal-backend.onrender.com`). You will use it in the next step and in `CORS_ORIGINS`.

**Note**: On the free plan, the backend may “spin down” after 15 minutes of no use. The first request after that can take 30–60 seconds; then it runs normally.

---

## Step 4: Deploy the Frontend on Vercel (Free)

1. Go to [vercel.com](https://vercel.com) and sign up / log in (with GitHub).
2. Click **Add New…** → **Project**.
3. Import the same GitHub repository.
4. Configure the project:
   - **Framework Preset**: Create React App (or leave Vercel to detect it).
   - **Root Directory**: select `frontend` (so Vercel builds the React app).
   - **Build Command**: `npm run build` (default is usually fine).
   - **Output Directory**: `build` (default for CRA).
5. **Environment Variables**:
   - **Name**: `REACT_APP_BACKEND_URL`  
   - **Value**: Your **backend URL from Render** **without** `/api` at the end.  
     Example: `https://al-anjal-backend.onrender.com`  
     The app will call `REACT_APP_BACKEND_URL/api/...` and `REACT_APP_BACKEND_URL/health`.
6. Click **Deploy**. Wait for the build to finish.
7. Copy your frontend URL (e.g. `https://al-anjal-school-app.vercel.app`).

---

## Step 5: Connect Frontend and Backend

1. **Render (backend)**  
   - Open your Web Service → **Environment**.
   - Set `CORS_ORIGINS` to your **exact** Vercel URL, e.g. `https://al-anjal-school-app.vercel.app` (no trailing slash).
   - Save. Render will redeploy if needed.
2. **Vercel (frontend)**  
   - You already set `REACT_APP_BACKEND_URL`; no change unless your backend URL changed.

---

## Step 6: Test From Anywhere

1. Open your **Vercel URL** in a browser (e.g. on your phone, at school, at home).
2. Log in with your usual credentials (e.g. the ones from `Start_App.bat`).
3. Try: Dashboard, Students, Analytics, Reports, Classes, etc. All features use the same backend and MongoDB, so they should work the same as on your PC.

---

## Your “Free Domain”

- **Frontend**: `https://your-project.vercel.app` (or a custom name in Vercel).
- **Backend**: `https://your-service.onrender.com`.

You don’t get a custom domain like `alanjal.edu` for free, but these URLs are stable and you can use them from anywhere. Later you can add a custom domain in Vercel (you’d need to buy the domain, e.g. from Namecheap or Google Domains).

---

## Troubleshooting

| Issue | What to do |
|--------|------------|
| “Cannot reach backend” / Login fails | 1) Check `REACT_APP_BACKEND_URL` in Vercel (no `/api`). 2) Open `REACT_APP_BACKEND_URL/health` in a browser — it should return OK. 3) On Render, check that the service is not “suspended” and that the last deploy succeeded. |
| CORS errors in browser console | Set `CORS_ORIGINS` on Render to exactly your Vercel URL (e.g. `https://your-app.vercel.app`), then redeploy. |
| Backend very slow on first load | Free tier spins down after ~15 min. First request wakes it up (30–60 s); later requests are fast. |
| MongoDB connection errors on Render | In Atlas, ensure **Network Access** includes `0.0.0.0/0`. Check `MONGO_URL` in Render (no typos, correct password encoding if it has special characters). |

---

## Optional: Root Directory Layout

If your GitHub repo **root** is the folder that contains both `frontend` and `backend`:

- On **Render**: set **Root Directory** to `backend` so the build and start commands run in `backend`.
- On **Vercel**: set **Root Directory** to `frontend` so the build runs in `frontend`.

If your repo root is **inside** `frontend` or **inside** `backend`, adjust Root Directory and paths in the build/start commands so they match your structure.

---

## Summary

- **Frontend**: Vercel (free) → your app URL.
- **Backend**: Render (free) → API URL; use `CORS_ORIGINS` and `REACT_APP_BACKEND_URL` to connect them.
- **Database**: MongoDB Atlas (free) → same as now; only add `0.0.0.0/0` in Network Access.

After this, you can use the same app from school, home, or anywhere with all features working.
