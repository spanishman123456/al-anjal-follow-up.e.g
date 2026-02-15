# Fix "Database or server temporarily unavailable" – MongoDB

Your backend is running but **cannot reach MongoDB**, so login fails. Do the following **in order**.

---

## Step 1: Run the connection test

1. Open a command prompt.
2. Go to the **backend** folder:
   ```
   cd path\to\your\project\backend
   ```
   (Replace with the real path, e.g. the folder that contains `server.py` and `.env`.)

3. Run:
   ```
   test_mongo_and_fix.bat
   ```
   Or:
   ```
   py test_mongo_and_fix.bat
   ```
   Or double‑click **`test_mongo_and_fix.bat`** in the backend folder.

4. Read the result:
   - **SUCCESS** → MongoDB is reachable; if login still fails, restart **Start_App.bat** and try again.
   - **FAILED: bad auth : authentication failed** → your username or password is wrong. Go to **Step 4** (reset the database user password in Atlas, then update `.env` with that exact password), then run the test again.
   - **FAILED** + another error (e.g. timeout, DNS) → continue with Step 2 (Network Access, etc.).

---

## Step 2: Log in to MongoDB Atlas

1. Open: **https://cloud.mongodb.com**
2. Sign in with the account that owns the cluster (the one where you created the database).
3. In the left sidebar, make sure the correct **organization** and **project** are selected (where your cluster is).

---

## Step 3: Allow your IP (Network Access)

1. In the left menu, click **Network Access** (under "Security").
2. Click **"+ ADD IP ADDRESS"**.
3. Either:
   - Click **"ADD CURRENT IP ADDRESS"** and then **"Confirm"**,  
   or
   - Choose **"ALLOW ACCESS FROM ANYWHERE"** and use `0.0.0.0/0` (less secure, but works from any network).
4. Wait 1–2 minutes for the new rule to apply.

---

## Step 4: Check database user and password (Database Access)

1. In the left menu, click **Database Access** (under "Security").
2. Find the user that appears in your connection string.  
   In your `.env` the URL contains **`spanishman123456_db_user`** – that is the username.
3. Click that user (or create it if it does not exist).
4. **Reset the password** so you know it exactly:
   - Click **"EDIT"** (or "Edit User").
   - Click **"Edit Password"**.
   - Set a password (e.g. **BabaMama1**).  
   - **Write it down.**
   - Save / confirm.

---

## Step 5: Get the connection string and put it in `.env`

1. In the left menu, click **Database** (or "Cluster").
2. On your cluster, click **"Connect"**.
3. Choose **"Drivers"** (or "Connect your application").
4. Copy the connection string. It looks like:
   ```
   mongodb+srv://USERNAME:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Open the **backend** folder and edit the file **`.env`** (with Notepad or any editor).
6. Find the line that starts with **`MONGO_URL=`**.
7. Replace it with your connection string, and put your **real password** where it says `<password>`:
   - If the password has **no** special characters (e.g. `BabaMama1`), you can put it as is:
     ```
     MONGO_URL=mongodb+srv://spanishman123456_db_user:BabaMama1@cluster0.8fcn9r5.mongodb.net/?retryWrites=true&w=majority
     ```
   - If the password contains **@ # $ % & + =** or similar, you must **encode** it in the URL:
     - `@` → `%40`
     - `#` → `%23`
     - `$` → `%24`
     - `%` → `%25`
     - `&` → `%26`
     - `+` → `%2B`
     - `=` → `%3D`
8. Save the `.env` file.

---

## Step 6: Test again and start the app

1. Run **`test_mongo_and_fix.bat`** again from the **backend** folder.  
   You should see **SUCCESS**.
2. Close any open **Start_App.bat** (or backend) window.
3. Double‑click **Start_App.bat** (in the project root) and **keep that window open**.
4. In the browser, go to the login page and log in with **2297033843** / **BabaMama1**.

---

## If it still fails

- Run **`test_mongo_and_fix.bat`** again and **copy the full error message** (the line that says `FAILED: ...`).
- Check:
  - **Internet** is working.
  - **Firewall / antivirus** is not blocking Python or the app.
  - In Atlas, **Network Access** shows your current IP (or `0.0.0.0/0`) and **Database Access** has the correct user and password.
  - The **password in `.env`** is exactly the one you set in Atlas (and URL‑encoded if it has special characters).

Once the test script reports **SUCCESS**, login with the backend (Start_App.bat) should work.
