"""
One-time script: Keep only weeks 1-9 for 1st quarter (semester 1) and weeks 10-18 for 2nd quarter (semester 2).
Deletes any other weeks and their scores.

Run from the backend folder (with .env present):
  python cleanup_weeks.py

Requires: MONGO_URL (and optionally DB_NAME) in backend/.env
"""
import os
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL")
if not mongo_url:
    print("ERROR: MONGO_URL not set in backend/.env")
    exit(1)

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


def main():
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=10000)
    db_name = os.environ.get("DB_NAME", "school_db")
    db = client[db_name]

    # --- 1st quarter: keep only semester=1, number in 1..9 ---
    to_delete_q1 = list(
        db.weeks.find(
            {"semester": 1, "$or": [{"number": {"$lt": 1}}, {"number": {"$gt": 9}}]},
            {"_id": 0, "id": 1, "number": 1},
        )
    )
    ids_q1 = [w["id"] for w in to_delete_q1]
    if ids_q1:
        deleted_scores_q1 = db.student_scores.delete_many({"week_id": {"$in": ids_q1}})
        deleted_weeks_q1 = db.weeks.delete_many({"id": {"$in": ids_q1}})
        print(f"1st quarter: deleted {deleted_weeks_q1.deleted_count} week(s) (numbers: {[w['number'] for w in to_delete_q1]}) and {deleted_scores_q1.deleted_count} score row(s).")
    else:
        print("1st quarter: no extra weeks to delete (only 1–9 kept).")

    # --- 2nd quarter: keep only semester=2, number in 10..18 ---
    to_delete_q2 = list(
        db.weeks.find(
            {"semester": 2, "$or": [{"number": {"$lt": 10}}, {"number": {"$gt": 18}}]},
            {"_id": 0, "id": 1, "number": 1},
        )
    )
    ids_q2 = [w["id"] for w in to_delete_q2]
    if ids_q2:
        deleted_scores_q2 = db.student_scores.delete_many({"week_id": {"$in": ids_q2}})
        deleted_weeks_q2 = db.weeks.delete_many({"id": {"$in": ids_q2}})
        print(f"2nd quarter: deleted {deleted_weeks_q2.deleted_count} week(s) (numbers: {[w['number'] for w in to_delete_q2]}) and {deleted_scores_q2.deleted_count} score row(s).")
    else:
        print("2nd quarter: no extra weeks to delete (only 10–18 kept).")

    remaining = list(db.weeks.find({}, {"_id": 0, "semester": 1, "number": 1, "label": 1}).sort([("semester", 1), ("number", 1)]))
    print(f"\nRemaining weeks: {len(remaining)} total.")
    for w in remaining:
        print(f"  Semester {w['semester']}, number {w['number']}: {w.get('label', '')}")

    client.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
