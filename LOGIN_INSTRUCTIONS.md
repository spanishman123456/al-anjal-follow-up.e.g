# How to log in (2297033843 / BabaMama1)

The login only works when the **frontend talks to your local backend**. You must have **both** running.

## Easiest: one click

- **Double‑click `Start_App.bat`** in the project root folder.
- It opens **two windows**: Backend (port 8000) and Frontend (port 3000). **Leave both open.**
- When the frontend is ready, the browser will open at **http://localhost:3000**. Log in there.

## Or start them yourself

### 1. Start the backend

- Open a terminal, go to the `backend` folder, and run:
  - **Windows:** `start_backend.bat`  
  - Or: `python -m uvicorn server:app --reload --port 8000`
- Wait until you see something like: `Uvicorn running on http://...`
- **Keep this window open.**

### 2. Start the frontend

- Open **another** terminal, go to the `frontend` folder, and run:
  - `npm start`
- The app will open in your browser at **http://localhost:3000**

## 3. Use the app at localhost

- **Important:** Use **http://localhost:3000** in the browser (the address bar must say `localhost`).
- Do **not** use a different URL (e.g. a Vercel or “Emergent” preview link). Those use a different server and your password reset will not work there.

## 4. Log in

- **Username:** `2297033843`  
- **Password:** `BabaMama1`  
- Click **Login**.

On the login page, in development you’ll see a line like **API: http://localhost:8000**. If you see that, the frontend is using your local backend and login should work.

If you still see “Invalid username or password”, check that:
- The backend window is still running and shows no errors.
- You are on **http://localhost:3000** (not another URL).
