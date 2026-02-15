# How to use the app ONLINE (with backend – full data)

When the app shows **"Backend offline"** and **"Failed to load dashboard data"**, it means the frontend is running but the backend is not. To go **online** and load real data:

---

## Step 1: Start the backend and frontend

1. **Double‑click `Start_App.bat`** (in the project root folder).
2. **Leave the first window open** – that’s where the backend runs. You should see something like “Backend is running…” and the window will stay open.
3. A **second window** will open for the frontend. Wait until the browser opens at **http://localhost:3000**.

---

## Step 2: Log in so the app uses the backend

1. In the app, if you see the **yellow “Backend offline”** bar at the top, click **“Go online: log in again…”** in that bar (or use **Logout** in the menu).
2. On the login page, enter:
   - **Username:** `2297033843`
   - **Password:** `BabaMama1`
3. Click **Login**.

After this, the yellow bar should disappear and the dashboard should load data (students, classes, etc.) from the backend. You are now **online**.

---

## Keep the backend window open

- The **first window** (where you ran `Start_App.bat`) must stay open while you use the app.
- If you close it, the backend stops and the app will show “Backend offline” again when you refresh or open another page.
- When you’re done, you can close that window to stop the backend.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Run **Start_App.bat** and keep its window open. |
| 2 | In the app, click **“Go online: log in again…”** (or Logout), then log in with **2297033843** / **BabaMama1**. |

After that, the app is online and data will load from the backend.
