# Enable “Sign in with Gmail” on Your Site

To make the **Sign in with Gmail** button work (so teachers can log in with their Gmail account), you need to create a Google OAuth client and add its Client ID in two places: **backend** and **frontend**.

---

## Step 1: Get a Google OAuth Client ID

1. Open **[Google Cloud Console](https://console.cloud.google.com/)** and sign in with your Google account.
2. Create or select a project:
   - Top bar: click the project name → **New Project** (e.g. “Al Anjal Login”) → **Create**, or pick an existing project.
3. Go to **APIs & Services** → **[Credentials](https://console.cloud.google.com/apis/credentials)**.
4. Click **+ Create Credentials** → **OAuth client ID**.
5. If asked to configure the OAuth consent screen:
   - Choose **External** (or Internal if you use Google Workspace) → **Create**.
   - Fill **App name** (e.g. “Al Anjal School”) and **User support email** → **Save and Continue** → **Back to Dashboard**.
6. Again: **Create Credentials** → **OAuth client ID**.
7. **Application type:** choose **Web application**.
8. **Name:** e.g. “Al Anjal Web”.
9. **Authorized JavaScript origins** — click **+ Add URI** and add:
   - Your live site (e.g. `https://your-frontend.onrender.com`) — **no trailing slash**
   - For local testing: `http://localhost:3000`
10. Click **Create**.
11. Copy the **Client ID** (long string like `123456789-xxxx.apps.googleusercontent.com`). You will use it in the next steps.

---

## Step 2: Backend (Render)

1. Open your **Render** dashboard → your **backend** service.
2. Go to **Environment** (or **Environment Variables**).
3. Add a variable:
   - **Key:** `GOOGLE_CLIENT_ID`
   - **Value:** the Client ID you copied (paste exactly, no spaces).
4. **Save**. Render will redeploy the backend.

---

## Step 3: Frontend (Render)

The frontend needs the **same** Client ID so the “Sign in with Gmail” button can get a token and send it to your backend.

1. Open **Render** → your **frontend** service (e.g. `al-anjal-frontend`).
2. Go to **Environment**.
3. Add:
   - **Key:** `REACT_APP_GOOGLE_CLIENT_ID`
   - **Value:** the **same** Client ID as in Step 2.
4. **Save** and **Manual Deploy → Deploy latest commit** (React reads `REACT_APP_*` at build time).

### If you run the frontend locally

1. In the **frontend** folder, create or edit `.env`.
2. Add:
   ```env
   REACT_APP_GOOGLE_CLIENT_ID=your_client_id_here
   ```
   (Replace with your real Client ID.)
3. Restart the dev server (`npm start`).

---

## Step 4: Backend locally (optional)

If you test login locally with the backend on your machine:

1. In the **backend** folder, create or edit `.env`.
2. Add:
   ```env
   GOOGLE_CLIENT_ID=your_client_id_here
   ```
3. Restart the backend.

---

## Checklist

- [ ] Google Cloud: **Web application** OAuth client created.
- [ ] **Authorized JavaScript origins** include your live **frontend Render URL** (e.g. `https://your-frontend.onrender.com`) and, for local, `http://localhost:3000`.
- [ ] **Render (backend):** `GOOGLE_CLIENT_ID` set → backend redeployed.
- [ ] **Render (frontend):** `REACT_APP_GOOGLE_CLIENT_ID` set → frontend **redeployed**.
- [ ] After redeploy, open the login page and click **Sign in with Gmail** — it should open Google, then show that Admin approval is pending.
- [ ] Sign in as Admin → Settings → **Pending Gmail Approval Requests** → approve the requester.
- [ ] The approved person can now click **Sign in with Gmail** again and enter the site.

---

## If it still says “Gmail sign-in is not configured”

- **Frontend:** The message appears when `REACT_APP_GOOGLE_CLIENT_ID` is missing or not present at build time. Add the variable and **redeploy** (new build).
- **Backend:** If the button loads but login fails, check Render logs. Often the cause is `GOOGLE_CLIENT_ID` not set or not redeployed after adding it.
- **Google Console:** If you see “origin_mismatch” or “redirect_uri” errors, add the exact URL (no trailing slash) to **Authorized JavaScript origins**. Changes can take a few minutes to apply.

---

## Summary

| Where        | Variable                     | Value              |
|-------------|------------------------------|--------------------|
| Render (backend) | `GOOGLE_CLIENT_ID` | Your Google Client ID |
| Render (frontend) / local `.env` | `REACT_APP_GOOGLE_CLIENT_ID` | Same Client ID |

Same Client ID in both places; add your site URL in Google Console under Authorized JavaScript origins; redeploy backend and frontend after changing env vars.

---

# Click-by-click: Render (backend + frontend)

Use this section when you already have your **Google Client ID** and need to know exactly where to click on Render.

---

## A. Google Cloud Console (get the Client ID)

1. In your browser go to: **https://console.cloud.google.com/**
2. Sign in with the Google account you want to use for this app.
3. **Top bar** (next to “Google Cloud”): click the **project name** (e.g. “My Project”).
   - If you see a project you want to use → click it.
   - Otherwise click **“New Project”** → type a name (e.g. “Al Anjal”) → **Create** → wait, then select it.
4. **Left menu** (☰) → **“APIs & Services”** → **“Credentials”**  
   Or go directly: **https://console.cloud.google.com/apis/credentials**
5. If you see **“Configure consent screen”** or **“OAuth consent screen”** first:
   - Click it → **“External”** → **Create**.
   - **App name:** e.g. “Al Anjal School”  
     **User support email:** your email → **Save and Continue** → **Back to Dashboard**.
6. On the Credentials page, click **“+ Create Credentials”** (top) → **“OAuth client ID”**.
7. **Application type:** open the dropdown → choose **“Web application”**.
8. **Name:** e.g. “Al Anjal Web” (any name is fine).
9. **Authorized JavaScript origins:**
   - Click **“+ Add URI”**.
   - Type your **live frontend URL** exactly as in the browser, e.g. `https://al-anjal-frontend.onrender.com` (no trailing slash, no path).
   - Click **“+ Add URI”** again and add: `http://localhost:3000` (for local testing).
10. Click **“Create”**.
11. A popup shows **Client ID** and **Client secret**. **Copy the Client ID** (long string ending in `.apps.googleusercontent.com`). You can close the popup after copying.
12. Keep this tab open or save the Client ID somewhere — you will paste it in Render (backend and frontend).

---

## B. Render (backend)

1. Go to **https://dashboard.render.com/** and log in.
2. Click your **backend service** (the one that runs the API, e.g. “al-anjal-follow-up-e-g” or similar).
3. In the left sidebar, click **“Environment”** (or **“Environment Variables”** depending on the layout).
4. In the **Environment Variables** section:
   - Click **“Add Environment Variable”** or **“+ Add”**.
   - **Key:** type exactly: `GOOGLE_CLIENT_ID`
   - **Value:** paste the **Client ID** you copied from Google (no spaces before/after).
5. If there is a **“Save Changes”** or **“Save”** button, click it.
6. Render will show that a new deploy has started. Wait until the deploy status is **“Live”** (or green). The backend must finish redeploying for the new variable to be used.

---

## C. Render (frontend)

1. Go to **https://dashboard.render.com/** and log in.
2. Click your **frontend** service (e.g. `al-anjal-frontend`).
3. In the left sidebar, click **Environment**.
4. Add:
   - **Key:** `REACT_APP_GOOGLE_CLIENT_ID`
   - **Value:** the **same** Client ID you used on the backend.
5. **Save**, then **Manual Deploy → Deploy latest commit**.
6. Wait until the deploy status is **Live**.

---

## D. Test

1. Open your **frontend Render URL** in the browser (the same URL you added in Google as “Authorized JavaScript origin”).
2. Go to the **login page**.
3. Click **Sign in with Gmail**.
   - If configured correctly: a Google sign-in window appears and the first attempt is added to the Admin's pending-approval queue. It does **not** enter the app yet.
   - Sign in with the Admin account, open **Settings → Pending Gmail Approval Requests**, and approve or reject the exact Gmail identity.
   - After approval, the requester clicks **Sign in with Gmail** again and can enter. Rejecting a Gmail link for an existing local user does not disable that user's separate username/password login.
   - If you still see “Gmail sign-in is not configured”: wait 2–3 minutes after the frontend redeploy, hard-refresh the page (Ctrl+F5 or Cmd+Shift+R), and try again. If it still fails, double-check the variable name is exactly `REACT_APP_GOOGLE_CLIENT_ID` and that you redeployed **after** saving it.
