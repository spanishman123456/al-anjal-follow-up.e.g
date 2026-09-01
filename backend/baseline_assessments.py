"""Isolated, score-only baseline records. Never contributes to quarter grades.

Roster membership and maximum are fixed at setup. Totals and the record's
display metadata can be corrected with a revision check. The same analytics
snapshot drives the screen and PDF.
"""
import hashlib
import io
import json
import math
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.concurrency import run_in_threadpool

from score_sheet import (
    ScoreSheetError,
    build_reference_score_workbook,
    match_score_rows,
    read_score_sheet,
)


def fail(code, status=422):
    raise HTTPException(status_code=status, detail=code)


class Scope(BaseModel):
    school_section: Literal["international", "arabic"]
    academic_year: str = Field(pattern=r"^\d{4}-\d{4}$")
    semester: int = Field(ge=1, le=2)
    quarter: int = Field(ge=1, le=2)

    @field_validator("academic_year")
    @classmethod
    def consecutive_years(cls, value):
        start, end = map(int, value.split("-"))
        if end != start + 1:
            raise ValueError("Academic years must be consecutive")
        return value


class Setup(Scope):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=120)
    test_date: date
    max_score: float = Field(gt=0, le=1000000, allow_inf_nan=False)
    class_ids: List[str] = Field(min_length=1, max_length=200)

    @field_validator("max_score", mode="before")
    @classmethod
    def numeric_maximum(cls, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Maximum must be a number")
        return value

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        value = value.strip()
        if not value or any(ord(c) < 32 for c in value):
            raise ValueError("Enter a record title")
        return value

    @field_validator("class_ids")
    @classmethod
    def unique_classes(cls, value):
        if len(value) != len(set(value)):
            raise ValueError("Duplicate class")
        return value


class ScoreUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    scores: Dict[str, Optional[float]] = Field(min_length=1, max_length=5000)

    @field_validator("scores", mode="before")
    @classmethod
    def finite_numbers(cls, values):
        if not isinstance(values, dict):
            raise ValueError("Expected student score map")
        for score in values.values():
            if score is not None and (isinstance(score, bool) or not isinstance(score, (int, float)) or not math.isfinite(score)):
                raise ValueError("Scores must be finite numbers or null")
        return values


class MetadataUpdate(BaseModel):
    """Rename a record and its snapshot class labels without changing scope."""

    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=120)
    class_names: Dict[str, str] = Field(min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value):
        return clean_display_text(value, "Enter a record title")

    @field_validator("class_names")
    @classmethod
    def clean_class_names(cls, values):
        if not isinstance(values, dict):
            raise ValueError("Expected class name map")
        return {
            class_id: clean_display_text(name, "Enter a class name")
            for class_id, name in values.items()
        }


def clean_display_text(value, error_message):
    if not isinstance(value, str):
        raise ValueError(error_message)
    value = value.strip()
    if not value or len(value) > 120 or any(ord(c) < 32 for c in value):
        raise ValueError(error_message)
    return value


def number(value):
    return float(Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def fmt(value):
    return "-" if value is None else f"{value:g}"


def percentage(score, maximum):
    if not math.isfinite(maximum) or maximum <= 0:
        raise ValueError("Invalid maximum")
    if score is None:
        return None
    if not math.isfinite(score) or score < 0 or score > maximum:
        raise ValueError("Invalid score")
    return Decimal(str(score)) * 100 / Decimal(str(maximum))


def level(percent):
    # Classify the unrounded ratio: 74.999% must not be promoted to High.
    return "missing" if percent is None else "high" if percent >= 75 else "medium" if percent >= 50 else "support"


COPY = {
    "en": {
        "pre": "Pre-test analytics", "diagnostic": "Diagnostic test analytics",
        "high": "High", "medium": "Medium", "support": "Needs support", "missing": "Not scored",
        "subject": "Computer Science", "overview": "Class overview", "mean": "Mean percentage",
        "completion": "Score completion", "graded": "Scored students", "total": "Total students",
        "class_means": "Class means - same test", "distribution": "Performance distribution",
        "students": "Student percentages", "individual": "Individual analysis", "comparison": "Student and class mean",
        "student": "Student", "class": "Class", "score": "Original score", "percent": "Percentage", "level": "Level",
        "scope_note": "This analysis describes this test only. Total marks do not identify specific topic strengths or weaknesses. Different teachers' tests may differ in difficulty, even after normalization.",
        "rules": "Percentage = score / maximum x 100. High: 75% or more; Medium: 50% to below 75%; Needs support: below 50%. Blank is not zero. Levels use the unrounded percentage; displayed values use two decimal places at most.",
        "reading": "Result interpretation", "evidence": "Evidence from total marks", "next": "Suggested next step",
        "support_title": "Support priorities", "summary_title": "Performance summary",
        "empty": "No scores have been recorded. No performance conclusion is available.",
        "recommend_high": "Offer a more challenging practical activity, then check that the student can apply learning independently.",
        "recommend_medium": "Review the actual answers with the student and practise the items missed before a short follow-up check.",
        "recommend_support": "Prioritize individual review of the actual answers, guided practice and a short follow-up assessment. Do not infer a specific weak topic from this total alone.",
        "recommend_missing": "Record the student's result before making a performance judgment.",
    },
    "ar": {
        "pre": "تحليلات الاختبارات القبلية", "diagnostic": "تحليلات الاختبارات التشخيصية",
        "high": "مرتفع", "medium": "متوسط", "support": "يحتاج دعمًا", "missing": "لم تُرصد",
        "subject": "الحاسب الآلي", "overview": "نظرة عامة على الصفوف", "mean": "متوسط النسبة المئوية",
        "completion": "اكتمال الرصد", "graded": "الطلاب المرصودة درجاتهم", "total": "إجمالي الطلاب",
        "class_means": "متوسطات الصفوف - الاختبار نفسه", "distribution": "توزيع مستويات الطلاب",
        "students": "النسب المئوية للطلاب", "individual": "التحليل الفردي", "comparison": "الطالب ومتوسط صفه",
        "student": "الطالب", "class": "الصف", "score": "الدرجة الأصلية", "percent": "النسبة المئوية", "level": "المستوى",
        "scope_note": "يصف التحليل نتيجة هذا الاختبار فقط. الدرجة الإجمالية لا تحدد موضوعات القوة والضعف بعينها. وقد تختلف صعوبة اختبارات المعلمين حتى بعد تحويل الدرجات إلى نسب مئوية.",
        "rules": "النسبة = الدرجة ÷ الدرجة الكاملة × 100. مرتفع: من 75% فأكثر؛ متوسط: من 50% إلى أقل من 75%؛ يحتاج دعمًا: أقل من 50%. الخانة الفارغة ليست صفرًا. التصنيف يعتمد على النسبة قبل التقريب، والعرض بمنزلتين عشريتين كحد أقصى.",
        "reading": "تفسير النتيجة", "evidence": "دلالات الدرجة الإجمالية", "next": "الخطوة المقترحة",
        "support_title": "أولويات الدعم", "summary_title": "ملخص الأداء",
        "empty": "لم تُرصد درجات بعد؛ لا تتوفر نتيجة للحكم على المستوى.",
        "recommend_high": "تقديم نشاط عملي أكثر تحديًا، ثم التحقق من قدرة الطالب على تطبيق ما تعلمه بصورة مستقلة.",
        "recommend_medium": "مراجعة الإجابات الفعلية مع الطالب والتدريب على الفقرات غير المجابة بصورة صحيحة، ثم إجراء متابعة قصيرة.",
        "recommend_support": "إعطاء أولوية لمراجعة الإجابات الفعلية بصورة فردية، وتدريب موجه ثم تقييم متابعة قصير. لا تُستنتج صعوبة في موضوع محدد من الدرجة وحدها.",
        "recommend_missing": "رصد نتيجة الطالب أولًا قبل إصدار حكم على مستواه.",
    },
}


def build_snapshot(record, lang="en", class_id=None):
    """Pure deterministic DTO. PDF consumes this DTO without recalculating scores."""
    c = COPY[lang]
    rows = [dict(s) for s in record["roster"] if not class_id or s["class_id"] == class_id]
    maximum = record["max_score"]
    ratios = {}
    for row in rows:
        row["score"] = record.get("scores", {}).get(row["id"])
        ratio = percentage(row["score"], maximum)
        ratios[row["id"]] = ratio
        row.update(percentage=None if ratio is None else number(ratio), level=level(ratio))
        row["level_label"] = c[row["level"]]
        row["score_label"] = f"{fmt(row['score'])} / {fmt(maximum)}"
    classes = []
    for cls in record["classes"]:
        if class_id and cls["id"] != class_id:
            continue
        members = [r for r in rows if r["class_id"] == cls["id"]]
        valid = [ratios[r["id"]] for r in members if ratios[r["id"]] is not None]
        classes.append({**cls, "total": len(members), "graded": len(valid), "mean": number(sum(valid) / len(valid)) if valid else None})
    valid = [v for v in ratios.values() if v is not None]
    counts = {key: sum(r["level"] == key for r in rows) for key in ("high", "medium", "support", "missing")}
    stats = {"total": len(rows), "graded": len(valid), "missing": len(rows) - len(valid),
             "mean": number(sum(valid) / len(valid)) if valid else None,
             "completion": number(len(valid) * 100 / len(rows)) if rows else 0}
    for row in rows:
        own_mean = next(cls["mean"] for cls in classes if cls["id"] == row["class_id"])
        row["class_mean"] = own_mean
        row["gap"] = None if row["percentage"] is None or own_mean is None else number(row["percentage"] - own_mean)
        p, score = row["percentage"], row["score"]
        if p is None:
            reading = c["empty"]
            evidence = c["recommend_missing"]
        elif lang == "ar":
            reading = f"حقق الطالب {fmt(score)} من {fmt(maximum)}، بنسبة {fmt(p)}%؛ ويُصنف مستواه: {row['level_label']}."
            evidence = f"الرصيد غير المحقق {fmt(number(maximum-score))} درجة. متوسط صفه {fmt(own_mean)}%، والفارق عنه {fmt(row['gap'])} نقطة مئوية."
        else:
            reading = f"The student scored {fmt(score)} out of {fmt(maximum)} ({fmt(p)}%); the performance level is {row['level_label']}."
            evidence = f"Unachieved marks: {fmt(number(maximum-score))}. Own class mean: {fmt(own_mean)}%; difference: {fmt(row['gap'])} percentage points."
        row["insights"] = [{"title": c["reading"], "body": reading}, {"title": c["evidence"], "body": evidence}, {"title": c["next"], "body": c[f"recommend_{row['level']}"]}]
    if lang == "ar":
        summary = f"رُصدت درجات {stats['graded']} من {stats['total']} طالبًا، باكتمال {fmt(stats['completion'])}%. متوسط النتائج المرصودة {fmt(stats['mean'])}%." if valid else c["empty"]
        support = f"يحتاج {counts['support']} من الطلاب المرصودة درجاتهم إلى دعم، و{counts['medium']} إلى تثبيت التعلم، و{counts['high']} إلى أنشطة إثرائية. لم تُرصد درجات {counts['missing']} طالبًا؛ ولا يُصنفون ضمن الضعاف."
    else:
        summary = f"Scores recorded for {stats['graded']} of {stats['total']} students ({fmt(stats['completion'])}% complete). Mean of recorded results: {fmt(stats['mean'])}%." if valid else c["empty"]
        support = f"{counts['support']} scored students need support, {counts['medium']} need consolidation, and {counts['high']} are ready for enrichment. {counts['missing']} are not scored and are not classified as weak."
    snapshot = {"record": {k: record[k] for k in ("id", "title", "test_date", "teacher_name", "school_section", "academic_year", "semester", "quarter", "max_score", "revision")},
                "lang": lang, "labels": c, "title": c["diagnostic" if record["school_section"] == "arabic" else "pre"],
                "stats": stats, "classes": classes, "students": rows,
                "distribution": [{"key": key, "label": c[key], "count": value, "percentage": number(value * 100 / len(rows)) if rows else 0} for key, value in counts.items()],
                "insights": [{"title": c["summary_title"], "body": summary}, {"title": c["support_title"], "body": support}],
                "class_id": class_id}
    snapshot["snapshot_id"] = hashlib.sha256(json.dumps(snapshot, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return snapshot


def make_router(db, get_current_user, section_query):
    router = APIRouter(prefix="/baseline-assessments", tags=["Baseline scores"])

    def role(user):
        value = str(user.get("role_name", "")).lower()
        if value not in ("admin", "teacher"):
            fail("baseline_forbidden", 403)
        return value

    def can_read(record, user):
        return role(user) == "admin" or (record["teacher_id"] == user["id"] and set(record["class_ids"]).issubset(user.get("assigned_class_ids") or []))

    async def record_for(record_id, user):
        role(user)
        record = await db.baseline_assessments.find_one({"_id": record_id})
        if not record or not can_read(record, user):
            fail("baseline_not_found", 404)
        return record

    def metadata(record):
        return {k: v for k, v in record.items() if k not in ("_id", "roster", "scores")}

    def query_scope(school_section: Literal["international", "arabic"], academic_year: str = Query(pattern=r"^\d{4}-\d{4}$"), semester: int = Query(ge=1, le=2), quarter: int = Query(ge=1, le=2)):
        try:
            return Scope(school_section=school_section, academic_year=academic_year, semester=semester, quarter=quarter)
        except ValueError:
            fail("baseline_invalid_scope")

    @router.get("")
    async def list_records(scope: Scope = Depends(query_scope), user=Depends(get_current_user)):
        query = scope.model_dump()
        if role(user) == "teacher":
            query["teacher_id"] = user["id"]
        records = await db.baseline_assessments.find(query, {"roster": 0, "scores": 0}).sort("created_at", -1).to_list(1001)
        if len(records) > 1000:
            fail("baseline_too_many_records")
        return [metadata(r) for r in records if can_read(r, user)]

    @router.post("", status_code=201)
    async def setup(payload: Setup, user=Depends(get_current_user)):
        if role(user) == "teacher" and not set(payload.class_ids).issubset(user.get("assigned_class_ids") or []):
            fail("baseline_forbidden", 403)
        scope_filter = section_query(payload.school_section, payload.academic_year)
        classes = await db.classes.find({"$and": [scope_filter, {"id": {"$in": payload.class_ids}}]}, {"_id": 0, "id": 1, "name": 1}).to_list(201)
        if set(c["id"] for c in classes) != set(payload.class_ids):
            fail("baseline_invalid_classes")
        students = await db.students.find({"$and": [scope_filter, {"class_id": {"$in": payload.class_ids}}]}, {"_id": 0, "id": 1, "full_name": 1, "class_id": 1}).sort("full_name", 1).to_list(5001)
        if not students or len(students) > 5000:
            fail("baseline_roster_size")
        names = {c["id"]: c["name"] for c in classes}
        # Snapshot enrollment preserves historical interpretation after promotion/transfer.
        roster = [{**s, "class_name": names[s["class_id"]]} for s in students]
        record_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        record = {**payload.model_dump(mode="json"), "_id": record_id, "id": record_id,
                  "teacher_id": user["id"], "teacher_name": user.get("full_name") or user.get("name") or user.get("username") or "Teacher",
                  "roster": roster, "classes": classes, "scores": {}, "revision": 1, "created_at": now, "updated_at": now}
        await db.baseline_assessments.insert_one(record)
        return metadata(record)

    @router.get("/{record_id}")
    async def get_record(record_id: str, lang: Literal["en", "ar"] = "en", class_id: Optional[str] = None, user=Depends(get_current_user)):
        record = await record_for(record_id, user)
        if class_id and class_id not in record["class_ids"]:
            fail("baseline_invalid_classes")
        return build_snapshot(record, lang, class_id)

    @router.delete("/{record_id}")
    async def delete_record(record_id: str, revision: int = Query(..., ge=1), user=Depends(get_current_user)):
        record = await record_for(record_id, user)
        if record["revision"] != revision:
            fail("baseline_conflict", 409)
        result = await db.baseline_assessments.delete_one({"_id": record_id, "revision": revision})
        if not result.deleted_count:
            fail("baseline_conflict", 409)
        return {
            "status": "deleted",
            "record_id": record_id,
            "title": record.get("title") or record_id,
            "students_in_snapshot": len(record.get("roster", [])),
        }

    @router.patch("/{record_id}/metadata")
    async def update_metadata(record_id: str, payload: MetadataUpdate, user=Depends(get_current_user)):
        record = await record_for(record_id, user)
        if record["revision"] != payload.revision:
            fail("baseline_conflict", 409)
        class_ids = list(record.get("class_ids") or [])
        if set(payload.class_names) != set(class_ids):
            fail("baseline_invalid_classes")
        classes = [
            {"id": class_id, "name": payload.class_names[class_id]}
            for class_id in class_ids
        ]
        roster = [
            {**student, "class_name": payload.class_names[student["class_id"]]}
            for student in record.get("roster", [])
        ]
        now = datetime.now(timezone.utc).isoformat()
        result = await db.baseline_assessments.update_one(
            {"_id": record_id, "revision": payload.revision},
            {
                "$set": {
                    "title": payload.title,
                    "classes": classes,
                    "roster": roster,
                    "updated_at": now,
                    "updated_by": user["id"],
                },
                "$inc": {"revision": 1},
            },
        )
        if not result.matched_count:
            fail("baseline_conflict", 409)
        return {
            "id": record_id,
            "title": payload.title,
            "classes": classes,
            "revision": payload.revision + 1,
        }

    @router.patch("/{record_id}/scores")
    async def save_scores(record_id: str, payload: ScoreUpdate, user=Depends(get_current_user)):
        record = await record_for(record_id, user)
        if record["revision"] != payload.revision:
            fail("baseline_conflict", 409)
        allowed = {s["id"] for s in record["roster"]}
        if not set(payload.scores).issubset(allowed):
            fail("baseline_invalid_students")
        for score in payload.scores.values():
            if score is not None and (score < 0 or score > record["max_score"]):
                fail("baseline_invalid_score")
        scores = {**record.get("scores", {}), **payload.scores}
        result = await db.baseline_assessments.update_one({"_id": record_id, "revision": payload.revision},
            {"$set": {"scores": scores, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user["id"]}, "$inc": {"revision": 1}})
        if not result.matched_count:
            fail("baseline_conflict", 409)
        return {"revision": payload.revision + 1}

    @router.post("/{record_id}/import")
    async def import_scores(
        record_id: str,
        file: UploadFile = File(...),
        apply: bool = Query(default=False),
        revision: int = Query(..., ge=1),
        class_id: Optional[str] = None,
        user=Depends(get_current_user),
    ):
        record = await record_for(record_id, user)
        if class_id and class_id not in record["class_ids"]:
            fail("baseline_invalid_classes")
        if record["revision"] != revision:
            fail("baseline_conflict", 409)
        try:
            parsed = await run_in_threadpool(read_score_sheet, await file.read(), file.filename or "")
        except ScoreSheetError as exc:
            fail(str(exc), 400)
        roster = [row for row in record["roster"] if not class_id or row["class_id"] == class_id]
        summary, matches = match_score_rows(
            parsed["rows"],
            roster,
            lambda _student: record["max_score"],
            lambda student: record.get("scores", {}).get(student["id"]),
        )
        response = {**summary, "sheet_name": parsed["sheet_name"], "revision": record["revision"]}
        if not apply:
            return response
        if not matches:
            fail("score_sheet_no_matches")
        changes = {
            item["student_id"]: item["score"]
            for item in matches
            if item["current"] is None or float(item["current"]) != item["score"]
        }
        if not changes:
            return {**response, "imported_count": 0, "revision": record["revision"]}
        scores = {**record.get("scores", {}), **changes}
        result = await db.baseline_assessments.update_one(
            {"_id": record_id, "revision": revision},
            {"$set": {"scores": scores, "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user["id"]}, "$inc": {"revision": 1}},
        )
        if not result.matched_count:
            fail("baseline_conflict", 409)
        return {**response, "imported_count": len(changes), "revision": revision + 1}

    @router.get("/{record_id}/export.xlsx")
    async def export_excel(
        record_id: str,
        snapshot_id: str = Query(min_length=64, max_length=64),
        lang: Literal["en", "ar"] = "en",
        class_id: Optional[str] = None,
        user=Depends(get_current_user),
    ):
        snapshot = await get_record(record_id, lang, class_id, user)
        if snapshot["snapshot_id"] != snapshot_id:
            fail("baseline_conflict", 409)
        record = snapshot["record"]
        rows = [
            {
                "student_name": student["full_name"],
                "teacher_name": record["teacher_name"],
                "level": student["class_name"],
                "score": student["score"],
                "percentage": None if student["percentage"] is None else number(student["percentage"] / 100),
                "corrected": "تم التصحيح" if student["score"] is not None else "",
                "test_name": record["title"],
                "duration": "",
                "submitted_at": "",
                "published_at": "",
                "due_at": record["test_date"],
            }
            for student in snapshot["students"]
        ]
        data = await run_in_threadpool(build_reference_score_workbook, rows)
        return StreamingResponse(io.BytesIO(data), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={
            "Content-Disposition": f'attachment; filename="baseline-{record_id}.xlsx"',
            "Cache-Control": "no-store", "X-Baseline-Snapshot": snapshot_id})

    @router.get("/{record_id}/export.pdf")
    async def export_pdf(record_id: str, snapshot_id: str = Query(min_length=64, max_length=64), lang: Literal["en", "ar"] = "en", class_id: Optional[str] = None, student_id: Optional[str] = None, user=Depends(get_current_user)):
        snapshot = await get_record(record_id, lang, class_id, user)
        if snapshot["snapshot_id"] != snapshot_id:
            fail("baseline_conflict", 409)
        if student_id and student_id not in {r["id"] for r in snapshot["students"]}:
            fail("baseline_invalid_students")
        from baseline_pdf import render_baseline_pdf
        data = await run_in_threadpool(render_baseline_pdf, snapshot, student_id)
        return StreamingResponse(io.BytesIO(data), media_type="application/pdf", headers={
            "Content-Disposition": f'attachment; filename="baseline-{record_id}-{lang}.pdf"',
            "Cache-Control": "no-store", "X-Baseline-Snapshot": snapshot_id})

    return router
