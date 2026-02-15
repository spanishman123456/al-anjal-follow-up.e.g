# Deploy Al Anjal App — Visual Step-by-Step Guide

Follow each step below. The images show what to look for on each screen.

> **Images:** The guide references images in the `assets` folder (`deploy-guide-step1-github.png` through `deploy-guide-step5-mongo.png`). If you opened this in Cursor, check the `assets` folder in your project. You can also follow the steps using only the text and the table at the end.

---

## Step 1: Create a GitHub repository

1. Go to **[github.com](https://github.com)** and sign in (or create a free account).
2. Click the **+** icon (top right), then **New repository**.
3. Enter a **Repository name** (e.g. `al-anjal-app`). Leave "Public" selected.
4. **Do not** check "Add a README" (you already have code).
5. Click **Create repository**.

![Step 1 - Create GitHub repo](assets/deploy-guide-step1-github.png)

After the repo is created, you will see a page with a green **Code** button.

---

## Step 2: Copy your repository URL

1. On the new repository page, click the green **Code** button.
2. Make sure **HTTPS** is selected.
3. Copy the URL (e.g. `https://github.com/YOUR_USERNAME/al-anjal-app.git`).
4. Keep this URL — you will paste it when you run the setup script.

![Step 2 - Copy repo URL](assets/deploy-guide-step2-copy-url.png)

---

## Step 3: Push your code (run the setup script)

1. On your PC, open **PowerShell** or **Command Prompt**.
2. Go to your project folder (the one that contains `frontend`, `backend`, and `Start_App.bat`):
   ```bash
   cd "c:\Users\hosam\OneDrive\Desktop\Desktop Stuff to review\New Source file of Al Anjal Foloow up Record Website\Hosam-main\Hosam-main"
   ```
3. Run:
   ```bash
   git init
   git add .
   git commit -m "Prepare for deployment"
   git branch -M main
   git remote add origin PASTE_YOUR_URL_HERE
   git push -u origin main
   ```
   Replace `PASTE_YOUR_URL_HERE` with the URL you copied (e.g. `https://github.com/YourUsername/al-anjal-app.git`).
4. If Git asks for your GitHub username and password, use your GitHub username and a **Personal Access Token** (not your normal password). Create a token at: GitHub → Settings → Developer settings → Personal access tokens → Generate new token.

---

## Step 4: Allow MongoDB Atlas to accept cloud connections

1. Go to **[cloud.mongodb.com](https://cloud.mongodb.com)** and sign in.
2. In the left sidebar, click **Network Access**.
3. Click **Add IP Address**.
4. Select **Allow Access from Anywhere** (this adds `0.0.0.0/0`).
5. Click **Confirm**.

![Step 5 - MongoDB Atlas Network Access](assets/deploy-guide-step5-mongo.png)

Keep your `MONGO_URL` from `backend\.env` — you will paste it into Render in the next step.

---

## Step 5: Deploy the backend on Render

1. Go to **[render.com](https://render.com)** and sign up or log in (use **Sign in with GitHub**).
2. Click **New +** → **Web Service**.
3. Under **Connect a repository**, select your **al-anjal-app** (or whatever you named it) repo. If you don’t see it, click **Configure account** and grant Render access to the repo.
4. Use these settings:

   | Field | Value |
   |-------|--------|
   | **Name** | `al-anjal-backend` (or any name you like) |
   | **Region** | Choose one close to you (e.g. Frankfurt or Oregon) |
   | **Root Directory** | `backend` |
   | **Runtime** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn server:app --host 0.0.0.0 --port $PORT` |

5. Click **Advanced** and add **Environment Variables**:

   | Key | Value | Secret? |
   |-----|--------|---------|
   | `MONGO_URL` | Your full MongoDB connection string from `backend\.env` | Yes |
   | `JWT_SECRET` | A long random string (e.g. from [randomkeygen.com](https://randomkeygen.com)) | Yes |
   | `DB_NAME` | `school_db` | No |
   | `CORS_ORIGINS` | `*` for now (you’ll change this after deploying the frontend) | No |

6. Click **Create Web Service**. Wait until the deploy finishes (status shows **Live**).
7. At the top of the page you’ll see your backend URL (e.g. `https://al-anjal-backend.onrender.com`). **Copy this URL** — you need it for Vercel.

![Step 3 - Render Web Service](assets/deploy-guide-step3-render.png)

---

## Step 6: Deploy the frontend on Vercel

1. Go to **[vercel.com](https://vercel.com)** and sign up or log in (use **Continue with GitHub**).
2. Click **Add New…** → **Project**.
3. Under **Import Git Repository**, select the same repo (**al-anjal-app**). Click **Import**.
4. Before deploying, set:
   - **Root Directory**: click **Edit**, choose **frontend**, then **Continue**.
   - **Environment Variables**: add one variable:
     - **Name:** `REACT_APP_BACKEND_URL`
     - **Value:** Your **Render backend URL** from Step 5 (e.g. `https://al-anjal-backend.onrender.com`) — **no** `/api` at the end.
5. Click **Deploy**. Wait until the build is done.
6. You’ll get a frontend URL (e.g. `https://al-anjal-app.vercel.app`). **Copy this URL** — you need it for the next step.

![Step 4 - Vercel Import and Deploy](assets/deploy-guide-step4-vercel.png)

---

## Step 7: Connect frontend and backend (CORS)

1. Go back to **Render** → your backend service (e.g. **al-anjal-backend**).
2. Open the **Environment** tab.
3. Find **CORS_ORIGINS** and change its value from `*` to your **exact Vercel URL** (e.g. `https://al-anjal-app.vercel.app` — no trailing slash).
4. Save. Render will redeploy once; wait until it’s **Live** again.

---

## Step 8: Use your app from anywhere

1. Open your **Vercel URL** in a browser (e.g. on your phone, at school, at home).
2. Log in with your usual credentials (e.g. the ones from `Start_App.bat`).
3. All features (Dashboard, Students, Analytics, Reports, etc.) work the same as on your PC.

**Your free “domain”:**
- **App (frontend):** `https://your-project.vercel.app`
- **API (backend):** `https://your-service.onrender.com`

---

## Quick reference

| Step | Where | What to do |
|------|--------|------------|
| 1 | GitHub | New repository, name it, Create |
| 2 | GitHub | Code → copy HTTPS URL |
| 3 | Your PC | Run git commands, paste URL, push |
| 4 | MongoDB Atlas | Network Access → Allow from Anywhere |
| 5 | Render | New Web Service, connect repo, Root `backend`, add env vars, Create |
| 6 | Vercel | New Project, import repo, Root `frontend`, add `REACT_APP_BACKEND_URL`, Deploy |
| 7 | Render | Environment → set `CORS_ORIGINS` to your Vercel URL |
| 8 | Browser | Open Vercel URL and log in |

If something doesn’t work, check **DEPLOYMENT.md** for troubleshooting (e.g. “Cannot reach backend”, CORS, MongoDB).
