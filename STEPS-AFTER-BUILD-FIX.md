# Step-by-step: Push the fix and finish deployment

Follow these in order. You only need a browser and (for Step 1) a terminal on your PC.

---

## Step 1: Push the build fix to GitHub

We changed `frontend/package.json` so the Vercel build skips ESLint and succeeds. Push that change to GitHub.

1. **Open a terminal** on your PC (PowerShell or Command Prompt).
2. **Go to your project folder** (the one that contains `frontend`, `backend`, and `Start_App.bat`). For example:
   ```powershell
   cd "c:\Users\hosam\OneDrive\Desktop\Desktop Stuff to review\New Source file of Al Anjal Foloow up Record Website\Hosam-main\Hosam-main"
   ```
3. **Check that Git sees the change:**
   ```bash
   git status
   ```
   You should see `frontend/package.json` as modified (and maybe this file `STEPS-AFTER-BUILD-FIX.md`).
4. **Stage the files:**
   ```bash
   git add frontend/package.json
   ```
   (Optional: `git add STEPS-AFTER-BUILD-FIX.md` if you want to commit this guide too.)
5. **Commit:**
   ```bash
   git commit -m "Fix Vercel build: disable ESLint during production build"
   ```
6. **Push to GitHub:**
   ```bash
   git push origin main
   ```
   If it asks for login, use your GitHub username and (if needed) a **Personal Access Token** or browser sign-in as you did before.
7. When you see something like `Branch 'main' set up to track...` or `Everything up-to-date` (or no errors), **Step 1 is done.**

---

## Step 2: Let Vercel redeploy (get your frontend URL)

1. Open **[vercel.com](https://vercel.com)** and log in.
2. Open your **project** (the one connected to `al-anjal-follow-up.e.g` or your repo name).
3. After the push in Step 1, Vercel usually **starts a new deployment automatically**. Wait 1–2 minutes.
4. If you don’t see a new deployment, click **Deployments**, then **Redeploy** on the latest one (or use the **Deploy** button).
5. Wait until the deployment status is **Ready** (green). If it fails again, tell me the exact error from the build logs.
6. **Copy your frontend URL** from the top of the project page or from the deployment. It looks like:
   - `https://al-anjal-follow-up-e-g.vercel.app`  
   or  
   - `https://your-project-name.vercel.app`  
   **No slash at the end.** You need this for Step 3.

---

## Step 3: Set CORS on Render so the frontend can call the backend

1. Open **[render.com](https://render.com)** and log in.
2. Open your **backend** service (e.g. **al-anjal-follow-up-e-g**).
3. Go to **Environment** (left sidebar).
4. Find the variable **CORS_ORIGINS**.
   - If it exists: change its value to your **exact** Vercel URL from Step 2 (e.g. `https://al-anjal-follow-up-e-g.vercel.app`), **no trailing slash**.
   - If it doesn’t exist: click **Add Environment Variable**, set:
     - **Key:** `CORS_ORIGINS`
     - **Value:** your Vercel URL (e.g. `https://al-anjal-follow-up-e-g.vercel.app`)
5. Click **Save Changes**. Render will redeploy the backend (wait a few minutes).
6. When the service shows **Live** again, you’re done.

---

## Step 4: Use the app

1. Open your **Vercel URL** in a browser (the one you used for CORS).
2. Log in with:
   - **ID:** `2297033843`
   - **Password:** `babamama1`
3. You can use the app from anywhere (school, home) as long as you have the link.

If anything fails at a step (e.g. `git push` asks for login, or Vercel build still fails), say which step and what you see, and we’ll fix it.
