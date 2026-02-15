"""
One-time script: set all application users' password to BabaMama1.
Run from the backend folder: python set_password.py
"""
import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from passlib.context import CryptContext
from pymongo import MongoClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL")
if not mongo_url:
    print("ERROR: MONGO_URL not set in .env")
    exit(1)

# Encode special characters in password (same as server.py)
if "@" in mongo_url and "://" in mongo_url:
    try:
        protocol_end = mongo_url.find("://") + 3
        at_pos = mongo_url.find("@", protocol_end)
        if at_pos > protocol_end:
            user_pass = mongo_url[protocol_end:at_pos]
            if ":" in user_pass:
                username, password = user_pass.split(":", 1)
                if any(c in password for c in ["@", "#", "$", "%", "&", "+", "="]):
                    encoded = quote_plus(password)
                    mongo_url = mongo_url[:protocol_end] + f"{username}:{encoded}" + mongo_url[at_pos:]
    except Exception:
        pass

NEW_PASSWORD = "BabaMama1"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    db_name = os.environ.get("DB_NAME", "school_db")
    db = client[db_name]

    new_hash = pwd_context.hash(NEW_PASSWORD)
    result = db.users.update_many({}, {"$set": {"password_hash": new_hash}})
    print(f"Updated {result.modified_count} user(s). All can now log in with password: {NEW_PASSWORD}")
    client.close()


if __name__ == "__main__":
    main()
