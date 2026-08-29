import asyncio
import io
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException, UploadFile

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
            if included:
                rows = [{key: row.get(key) for key in included if key in row} for row in rows]
            else:
                excluded = {key for key, value in projection.items() if not value}
                rows = [{key: value for key, value in row.items() if key not in excluded} for row in rows]
        return _Cursor(rows)

    async def find_one(self, query=None, projection=None):
        rows = await self.find(query, projection).to_list(1)
        return rows[0] if rows else None

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

    async def delete_many(self, query):
        kept = [row for row in self.rows if not _matches(row, query)]
        deleted_count = len(self.rows) - len(kept)
        self.rows = kept
        return SimpleNamespace(deleted_count=deleted_count)


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
    arabic_class = {
        "id": "arabic-4a",
        "name": "رابع أ",
        "grade": 4,
        "section": "A",
        "school_section": "arabic",
        "academic_year": "2026-2027",
    }
    fake_db = SimpleNamespace(
        classes=_Collection([international_class, arabic_class]),
        students=_Collection([international_student]),
        student_scores=_Collection(),
    )
    csv_bytes = "Student Name,Class,Attendance (2.5)\nطالب تجريبي,4A,2.5\n,,2.5\n".encode("utf-8-sig")
    upload = UploadFile(filename="arabic-students.csv", file=io.BytesIO(csv_bytes))

    with patch.object(server, "db", fake_db), patch.object(server, "log_user_action", AsyncMock()):
        result = asyncio.run(
            server.import_excel(
                file=upload,
                week_id=None,
                school_section="arabic",
                academic_year="2026-2027",
                class_id="arabic-4a",
                dry_run=False,
                current_user={"id": "admin", "role_name": "Admin", "name": "Admin"},
            )
        )

    arabic_classes = [row for row in fake_db.classes.rows if row.get("school_section") == "arabic"]
    arabic_students = [row for row in fake_db.students.rows if row.get("school_section") == "arabic"]
    assert result["created_students"] == 1
    assert result["updated_students"] == 0
    assert result["created_classes"] == 0
    assert result["processed_rows"] == 1
    assert result["skipped_rows"] == 1
    assert result["target_class_id"] == "arabic-4a"
    assert result["dry_run"] is False
    assert len(arabic_classes) == 1 and arabic_classes[0]["id"] != international_class["id"]
    assert len(arabic_students) == 1
    assert arabic_students[0]["class_id"] == arabic_classes[0]["id"]
    assert arabic_students[0].get("attendance") is None
    assert fake_db.student_scores.rows == []
    assert international_student["attendance"] == 2.5


def test_arabic_import_uses_selected_class_and_repairs_numeric_names_from_identity_column():
    target_class = {
        "id": "arabic-4a",
        "name": "رابع أ",
        "grade": 4,
        "section": "A",
        "school_section": "arabic",
        "academic_year": "2026-2027",
    }
    wrong_class = {
        "id": "arabic-6b",
        "name": "سادس ب",
        "grade": 6,
        "section": "B",
        "school_section": "arabic",
        "academic_year": "2026-2027",
    }
    corrupted = {
        "id": "legacy-student",
        "full_name": "1184142782",
        "class_id": "arabic-6b",
        "class_name": "سادس ب",
        "school_section": "arabic",
        "academic_year": "2026-2027",
    }
    fake_db = SimpleNamespace(
        classes=_Collection([target_class, wrong_class]),
        students=_Collection([corrupted]),
        student_scores=_Collection(),
    )
    content = "رقم الهوية,الاسم\n1184142782,علي ايمن الغزال\n1184967345,سعد محمد بوبشيت\n".encode("utf-8-sig")

    async def run(dry_run):
        return await server.import_excel(
            file=UploadFile(filename="رابع أ.csv", file=io.BytesIO(content)),
            week_id=None,
            school_section="arabic",
            academic_year="2026-2027",
            class_id="arabic-4a",
            dry_run=dry_run,
            current_user={"id": "admin", "role_name": "Admin", "name": "Admin"},
        )

    with patch.object(server, "db", fake_db), patch.object(server, "log_user_action", AsyncMock()):
        preview = asyncio.run(run(True))
        assert preview["created_students"] == 1
        assert preview["updated_students"] == 1
        assert preview["repaired_students"] == 1
        assert fake_db.students.rows == [corrupted]

        result = asyncio.run(run(False))

    assert result["created_students"] == 1
    assert result["updated_students"] == 1
    assert result["repaired_students"] == 1
    repaired = next(row for row in fake_db.students.rows if row["id"] == "legacy-student")
    assert repaired["full_name"] == "علي ايمن الغزال"
    assert repaired["student_number"] == "1184142782"
    assert repaired["class_id"] == "arabic-4a"
    added = next(row for row in fake_db.students.rows if row["id"] != "legacy-student")
    assert added["full_name"] == "سعد محمد بوبشيت"
    assert added["student_number"] == "1184967345"
    assert added["class_id"] == "arabic-4a"


def test_arabic_import_rejects_numeric_names_and_conflicting_classes_before_writes():
    target_class = {
        "id": "arabic-4a",
        "name": "رابع أ",
        "grade": 4,
        "section": "A",
        "school_section": "arabic",
        "academic_year": "2026-2027",
    }
    fake_db = SimpleNamespace(
        classes=_Collection([target_class]),
        students=_Collection(),
        student_scores=_Collection(),
    )

    async def import_content(content):
        return await server.import_excel(
            file=UploadFile(filename="students.csv", file=io.BytesIO(content.encode("utf-8-sig"))),
            week_id=None,
            school_section="arabic",
            academic_year="2026-2027",
            class_id="arabic-4a",
            dry_run=False,
            current_user={"id": "admin", "role_name": "Admin", "name": "Admin"},
        )

    with patch.object(server, "db", fake_db), patch.object(server, "log_user_action", AsyncMock()):
        with pytest.raises(HTTPException) as numeric_error:
            asyncio.run(import_content("Student Name\n1184142782\n"))
        assert numeric_error.value.status_code == 400
        assert numeric_error.value.detail["code"] == "student_import_validation_failed"
        assert fake_db.students.rows == []

        with pytest.raises(HTTPException) as class_error:
            asyncio.run(import_content("Student Name,Class\nطالب صحيح,سادس ب\n"))
        assert class_error.value.status_code == 400
        assert class_error.value.detail["code"] == "student_import_validation_failed"
        assert fake_db.students.rows == []


def test_arabic_import_rejects_unassigned_teacher_target_class():
    target_class = {
        "id": "arabic-4a",
        "name": "رابع أ",
        "grade": 4,
        "section": "A",
        "school_section": "arabic",
        "academic_year": "2026-2027",
    }
    fake_db = SimpleNamespace(
        classes=_Collection([target_class]),
        students=_Collection(),
        student_scores=_Collection(),
    )
    upload = UploadFile(
        filename="students.csv",
        file=io.BytesIO("Student Name\nطالب صحيح\n".encode("utf-8-sig")),
    )
    with patch.object(server, "db", fake_db), patch.object(server, "log_user_action", AsyncMock()):
        with pytest.raises(HTTPException) as forbidden:
            asyncio.run(
                server.import_excel(
                    file=upload,
                    week_id=None,
                    school_section="arabic",
                    academic_year="2026-2027",
                    class_id="arabic-4a",
                    dry_run=True,
                    current_user={
                        "id": "teacher",
                        "role_name": "Teacher",
                        "assigned_class_ids": ["arabic-6b"],
                    },
                )
            )
    assert forbidden.value.status_code == 403
    assert forbidden.value.detail == "student_import_target_class_forbidden"
    assert fake_db.students.rows == []


def test_delete_all_students_can_be_scoped_to_one_arabic_class():
    class_4a = {
        "id": "arabic-4a", "name": "رابع أ", "school_section": "arabic", "academic_year": "2026-2027",
    }
    class_6b = {
        "id": "arabic-6b", "name": "سادس ب", "school_section": "arabic", "academic_year": "2026-2027",
    }
    students = [
        {"id": "keep-4a", "class_id": "arabic-4a", "school_section": "arabic", "academic_year": "2026-2027"},
        {"id": "delete-6b-1", "class_id": "arabic-6b", "school_section": "arabic", "academic_year": "2026-2027"},
        {"id": "delete-6b-2", "class_id": "arabic-6b", "school_section": "arabic", "academic_year": "2026-2027"},
        {"id": "keep-international", "class_id": "international-6b", "school_section": "international", "academic_year": "2026-2027"},
    ]
    fake_db = SimpleNamespace(
        classes=_Collection([class_4a, class_6b]),
        students=_Collection(students),
        student_scores=_Collection([
            {"student_id": "keep-4a"}, {"student_id": "delete-6b-1"}, {"student_id": "delete-6b-2"},
        ]),
        arabic_quarter_scores=_Collection([
            {"student_id": "keep-4a"}, {"student_id": "delete-6b-1"}, {"student_id": "delete-6b-2"},
        ]),
    )
    with patch.object(server, "db", fake_db), patch.object(server, "log_user_action", AsyncMock()):
        result = asyncio.run(
            server.delete_all_students(
                school_section="arabic",
                academic_year="2026-2027",
                class_id="arabic-6b",
                current_user={"id": "admin", "role_name": "Admin", "name": "Admin"},
            )
        )

    assert result["students_deleted"] == 2
    assert result["scores_deleted"] == 2
    assert result["arabic_scores_deleted"] == 2
    assert result["target_class_name"] == "سادس ب"
    assert {row["id"] for row in fake_db.students.rows} == {"keep-4a", "keep-international"}
    assert fake_db.student_scores.rows == [{"student_id": "keep-4a"}]
    assert fake_db.arabic_quarter_scores.rows == [{"student_id": "keep-4a"}]
