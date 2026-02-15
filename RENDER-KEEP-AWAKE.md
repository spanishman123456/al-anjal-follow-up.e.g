# Keep the backend fast

On **Render’s free tier**, your backend **spins down after about 15 minutes** of no traffic. The **first request** after that can take **50+ seconds** while it wakes up, then it’s fast again until the next idle period.

## Built-in keep-alive (no setup)

While **someone has the app open and is logged in**, the frontend **pings the backend every 10 minutes**. That keeps the server awake so your next action (save marks, import, etc.) is fast instead of waiting for a cold start. So:

- If you or a colleague keep the app open during the school day, the backend stays awake and the site stays fast.
- If nobody has the app open for more than ~15 minutes, the next person to open it may still see one slow first load; then the keep-alive starts again.

## What we changed in the app

- The **live site** now waits up to **90 seconds** for the backend to respond (so the “Server not connected” message is less likely when the server is just waking up).
- On the **login page**, when the backend is slow, you’ll see: *“Server is waking up. Wait up to a minute and try again.”* instead of the Start_App.bat message.

So the site should work even when the server was sleeping; you may just need to wait once after a long idle time.

## Optional: keep the server awake so it’s always fast

If you want to **avoid** the 50-second wait (e.g. at school), you can ping the backend every 10–14 minutes so Render never spins it down.

1. Go to **[uptimerobot.com](https://uptimerobot.com)** (free).
2. Create a **Monitor**:
   - **Monitor Type:** HTTP(s)
   - **URL:** `https://al-anjal-follow-up-e-g.onrender.com/health`
   - **Monitoring Interval:** 5 minutes (or 10 minutes if you prefer)
3. Save. UptimeRobot will call your backend every 5 minutes, so it stays awake and the site stays fast.

No code changes needed; this is optional and only for better speed.
