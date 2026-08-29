"""Manual MongoDB connection diagnostic. Run: py test_mongo_login.py"""
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus


def mask_uri(uri):
    if "://" not in uri or "@" not in uri:
        return "mongodb+srv://***@***"
    start = uri.find("://") + 3
    at = uri.find("@", start)
    if at == -1:
        return uri[:20] + "***"
    user_part = uri[start:at]
    user = user_part.split(":", 1)[0] if ":" in user_part else "***"
    return uri[:start] + user + ":****" + uri[at:]


def load_environment(env_path):
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except ImportError:
        if env_path.exists():
            with open(env_path, encoding="utf-8") as env_file:
                for line in env_file:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        os.environ[key.strip()] = value.strip().strip('"').strip("'")


def normalized_mongo_url(mongo_url):
    if "@" not in mongo_url or "://" not in mongo_url:
        return mongo_url
    try:
        start = mongo_url.find("://") + 3
        at = mongo_url.find("@", start)
        if at <= start or ":" not in mongo_url[start:at]:
            return mongo_url
        user, password = mongo_url[start:at].split(":", 1)
        stripped = password.strip()
        if stripped != password:
            mongo_url = mongo_url[:start] + user + ":" + stripped + mongo_url[at:]
            print("(Removed spaces from password in URL)")
        if any(char in stripped for char in ["@", "#", "$", "%", "&", "+", "="]):
            mongo_url = mongo_url[:start] + user + ":" + quote_plus(stripped) + mongo_url[at:]
            print("(URL-encoded password because it contains special characters)")
    except Exception:
        pass
    return mongo_url


def main():
    root = Path(__file__).resolve().parent
    env_path = root / ".env"
    load_environment(env_path)
    mongo_url = (os.environ.get("MONGO_URL") or "").strip()
    db_name = (os.environ.get("DB_NAME") or "school_db").strip()
    if not mongo_url:
        print("ERROR: MONGO_URL not set in .env")
        print("Using .env at:", env_path)
        return 1

    print("Using .env:", env_path)
    print("Connection (masked):", mask_uri(mongo_url))
    print("Database:", db_name)
    print()
    mongo_url = normalized_mongo_url(mongo_url)
    print("Testing MongoDB connection...")
    print()
    try:
        from pymongo import MongoClient
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=12000)
        client.admin.command("ping")
        print("SUCCESS: MongoDB is reachable.")
        db = client[db_name]
        collections = db.list_collection_names()
        print("Collections:", ", ".join(collections) if collections else "(none)")
        print("Users in 'users' collection:", db.users.count_documents({}))
        client.close()
        print()
        print("You can now run Start_App.bat and log in.")
        return 0
    except Exception as exc:
        error = str(exc)
        print("FAILED:", error)
        print()
        if "bad auth" in error.lower() or "authentication failed" in error.lower():
            print("--- BAD AUTH: Fix the password ---")
            print("1. In Atlas: Security -> Database Access -> edit the database user's password.")
            print("2. Open backend\\.env and replace only the password in MONGO_URL, without spaces.")
            print("3. Save .env and run this diagnostic again.")
        else:
            print("Open FIX_MONGODB_LOGIN.md in the backend folder and follow the steps.")
            print("Most often: MongoDB Atlas Network Access must allow your IP.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
