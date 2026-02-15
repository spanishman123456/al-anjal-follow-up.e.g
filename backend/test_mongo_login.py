"""Test MongoDB connection for login. Run: py test_mongo_login.py"""
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parent
env_path = ROOT / ".env"
try:
    from dotenv import load_dotenv
    load_dotenv(env_path)
except ImportError:
    if env_path.exists():
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")

mongo_url = (os.environ.get("MONGO_URL") or "").strip()
db_name = (os.environ.get("DB_NAME") or "school_db").strip()

if not mongo_url:
    print("ERROR: MONGO_URL not set in .env")
    print("Using .env at:", env_path)
    sys.exit(1)

# Show what we're using (masked) for debugging
def mask_uri(uri):
    if "://" not in uri or "@" not in uri:
        return "mongodb+srv://***@***"
    start = uri.find("://") + 3
    at = uri.find("@", start)
    if at == -1:
        return uri[:20] + "***"
    user_part = uri[start:at]
    if ":" in user_part:
        user = user_part.split(":", 1)[0]
    else:
        user = "***"
    rest = uri[at:]
    return uri[:start] + user + ":****" + rest

print("Using .env:", env_path)
print("Connection (masked):", mask_uri(mongo_url))
print("Database:", db_name)
print()

# Encode password in URL if it contains special characters
if "@" in mongo_url and "://" in mongo_url:
    try:
        start = mongo_url.find("://") + 3
        at = mongo_url.find("@", start)
        if at > start and ":" in mongo_url[start:at]:
            user, pw = mongo_url[start:at].split(":", 1)
            pw_stripped = pw.strip()
            if pw_stripped != pw:
                mongo_url = mongo_url[:start] + user + ":" + pw_stripped + mongo_url[at:]
                print("(Removed spaces from password in URL)")
            for c in ["@", "#", "$", "%", "&", "+", "="]:
                if c in pw_stripped:
                    enc = quote_plus(pw_stripped)
                    mongo_url = mongo_url[:start] + user + ":" + enc + mongo_url[at:]
                    print("(URL-encoded password because it contains special characters)")
                    break
    except Exception:
        pass

print("Testing MongoDB connection...")
print()
try:
    from pymongo import MongoClient
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=12000)
    client.admin.command("ping")
    print("SUCCESS: MongoDB is reachable.")
    db = client[db_name]
    cols = db.list_collection_names()
    print("Collections:", ", ".join(cols) if cols else "(none)")
    user_count = db.users.count_documents({})
    print("Users in 'users' collection:", user_count)
    client.close()
    print()
    print("You can now run Start_App.bat and log in.")
except Exception as e:
    err = str(e)
    print("FAILED:", err)
    print()
    if "bad auth" in err.lower() or "authentication failed" in err.lower():
        print("--- BAD AUTH: Fix the password ---")
        print("1. In Atlas: Security -> Database Access -> click 'spanishman123456_db_user' -> EDIT -> Edit Password.")
        print("2. Set a SIMPLE password (only letters and numbers, e.g. TestPass123). Write it down.")
        print("3. Open backend\\.env in Notepad. Find the line MONGO_URL=...")
        print("4. Replace the password (between the first : and the @) with that EXACT password. No spaces before or after.")
        print("5. Save .env and run this test again.")
        print()
        print("If it still fails: create a NEW database user in Atlas (Database Access -> Add New User),")
        print("use a simple password, then in .env use that new username and password in MONGO_URL.")
    else:
        print("Open FIX_MONGODB_LOGIN.md in the backend folder and follow the steps.")
        print("Most often: MongoDB Atlas Network Access must allow your IP.")
    sys.exit(1)
