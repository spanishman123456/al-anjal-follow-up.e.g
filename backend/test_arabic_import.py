import asyncio
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import UploadFile

import server


def _matches(document, query):
    if not query:
        return True
    if "$and" in query:
        return all(_matches(document, part) for part in query["$and"])
    if "$or" in query:
        return any(_matches(document, part) for part in query["$or"])
    for key, expected in query.items():
        if isinstance(expected, dict) and "$exists" in expected:
            if (key in document) is not expected["$exists"]:
                return False
        elif isinstance(expected, dict) and "$in" in expected:
            if document.get(key) not in expected["$in"]:
                return False
        elif document.get(key) != expected:
            return False
    return True


class _Cursor:
    def __init__(self, rows):
        self.rows = rows

    async def to_list(self, _limit):
        return [dict(row) for row in self.rows]


class _Collection:
    def __init__(self, rows=None):
        self.rows = list(rows or [])
        self.updates = []

    def find(self, query=None, projection=None):
        rows = [row for row in self.rows if _matches(row, query or {})]
        if projection:
            included = [key for key, value in projection.items() if value and key != "_id"]
            rows = [{key: row.get(key) for key in included if key in row} for row in rows]
        return _Cursor(rows)

    async def insert_one(self, document):
        self.rows.append(dict(document))
        return SimpleNamespace(inserted_id=document.get("id"))

    async def update_one(self, query, update, upsert=False):
        self.updates.append((query, update, upsert))
        for row in self.rows:
            if _matches(row, query):
                row.update(update.get("$set", {}))
                return SimpleNamespace(modified_count=1, upserted_id=None)
        if upsert:
            new_row = {**query, **update.get("$set", {})}
            self.rows.append(new_row)
            return SimpleNamespace(modified_count=0, upserted_id="new")
        return SimpleNamespace(modified_count=0, upserted_id=None)


def test_arabic_excel_import_creates_only_arabic_identity_records():
    international_class = {
        "id": "international-4a",
        "name": "4A",
        "grade": 4,
        "section": "A",
        "school_section": "international",
        "academic_year": "2026-2027",
    }
    international_student = {
        "id": "international-student",
        "full_name": "طالب تجريبي",
        "class_id": "international-4a",
        "school_section": "international",
        "academic_year": "2026-2027",
        "attendance": 2.5,
    }
    fake_db = SimpleNamespace(
        classes=_Collection([international_class]),
        students=_Collection([international_student]),
        student_scores=_Collection(),
    )
    csv_bytes = "Student Name,Class,Attendance (2.5)\nطالب تجريبي,4A,2.5\nطالب بلا فصل,,2.5\n".encode("utf-8-sig")
    upload = UploadFile(filename="arabic-students.csv", file=io.BytesIO(csv_bytes))

    with patch.object(server, "db", fake_db), patch.object(server, "log_user_action", AsyncMock()):
        result = asyncio.run(
            server.import_excel(
                file=upload,
                week_id=None,
                school_section="arabic",
                academic_year="2026-2027",
                current_user={"id": "admin", "role_name": "Admin", "name": "Admin"},
            )
        )

    arabic_classes = [row for row in fake_db.classes.rows if row.get("school_section") == "arabic"]
    arabic_students = [row for row in fake_db.students.rows if row.get("school_section") == "arabic"]
    assert result == {
        "created_students": 1,
        "updated_students": 0,
        "created_classes": 1,
        "processed_rows": 1,
        "skipped_rows": 1,
        "school_section": "arabic",
        "academic_year": "2026-2027",
    }
    assert len(arabic_classes) == 1 and arabic_classes[0]["id"] != international_class["id"]
    assert len(arabic_students) == 1
    assert arabic_students[0]["class_id"] == arabic_classes[0]["id"]
    assert arabic_students[0].get("attendance") is None
    assert fake_db.student_scores.rows == []
    assert international_student["attendance"] == 2.5
