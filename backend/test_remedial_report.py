import io

from pypdf import PdfReader

from remedial_report import build_remedial_snapshot, render_remedial_pdf


def _snapshot(rows, *, lang="en"):
    return build_remedial_snapshot(
        source_type="baseline",
        source_id="diagnostic-1",
        source_label="Diagnostic Test" if lang == "en" else "الاختبار التشخيصي",
        school_section="international" if lang == "en" else "arabic",
        academic_year="2026-2027",
        semester=1,
        quarter=1,
        maximum=30,
        rows=rows,
        classes=[{"id": "class-5a", "name": "5A"}],
    )


def test_remedial_snapshot_uses_strict_below_half_and_excludes_blanks():
    snapshot = _snapshot([
        {"id": "blank", "full_name": "Blank Student", "class_id": "class-5a", "class_name": "5A", "score": None},
        {"id": "below", "full_name": "Below Student", "class_id": "class-5a", "class_name": "5A", "score": 14.99},
        {"id": "half", "full_name": "Half Student", "class_id": "class-5a", "class_name": "5A", "score": 15},
        {"id": "above", "full_name": "Above Student", "class_id": "class-5a", "class_name": "5A", "score": 20},
        {"id": "zero", "full_name": "Zero Student", "class_id": "class-5a", "class_name": "5A", "score": 0},
    ])

    assert snapshot["stats"] == {"scored": 4, "below_50": 2, "at_or_above_50": 2}
    assert [row["id"] for row in snapshot["students"]] == ["below", "zero"]
    assert snapshot["students"][0]["score_label"] == "14.99 / 30"
    assert len(snapshot["snapshot_id"]) == 64


def test_remedial_pdf_renders_reference_table_and_can_paginate():
    rows = [
        {
            "id": f"student-{index}",
            "full_name": f"Student {index}",
            "class_id": "class-5a",
            "class_name": "5A",
            "score": index % 15,
        }
        for index in range(1, 38)
    ]
    snapshot = _snapshot(rows)
    pdf = render_remedial_pdf(snapshot, {
        "subject": "Computer Science",
        "skill_weakness": "Practical programming skills",
        "remedial_plan_date": "2026-09-10",
        "department": "Computer Science Department",
        "teacher_name": "Test Teacher",
        "supervisor_name": "Test Supervisor",
    }, "en")

    reader = PdfReader(io.BytesIO(pdf))
    assert len(reader.pages) >= 2
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "Diagnostic Test Analysis and Remedial Plan Report" in text
    assert "Student 1" in text
    assert "Skill Weakness Point" in text


def test_arabic_remedial_pdf_embeds_amiri_and_student_rows():
    snapshot = _snapshot([
        {"id": "ar-1", "full_name": "أحمد محمد", "class_id": "class-5a", "class_name": "خامس أ", "score": 12},
    ], lang="ar")
    pdf = render_remedial_pdf(snapshot, {
        "subject": "الحاسب",
        "skill_weakness": "مهارات البرمجة الأساسية",
        "remedial_plan_date": "2026-09-10",
        "department": "قسم الحاسب",
        "teacher_name": "معلم الحاسب",
        "supervisor_name": "المشرف التربوي",
    }, "ar")

    assert pdf.startswith(b"%PDF")
    assert b"Amiri" in pdf
    assert len(PdfReader(io.BytesIO(pdf)).pages) == 1
