from server import (
    SCHOOL_SECTION_ARABIC,
    SCHOOL_SECTION_INTERNATIONAL,
    arabic_score_summary,
    generate_arabic_grades_excel,
    generate_arabic_grades_pdf,
    school_section_query,
)


def test_arabic_quarter_total_and_completion_include_entered_zero():
    result = arabic_score_summary(
        {
            "performance_tasks": 10,
            "participation": 9,
            "interaction": 8,
            "attendance": 7,
            "theory_test_1": 0,
            "theory_test_2": 14,
            "practical_test_1": 13,
            "practical_test_2": None,
        }
    )
    assert result["continuous_total"] == 34
    assert result["tests_total"] == 27
    assert result["quarter_total"] == 61
    assert result["test_completion"]["theory_test_1"] is True
    assert result["test_completion"]["practical_test_2"] is False
    assert result["test_completion_count"] == 3


def test_arabic_blank_quarter_stays_no_data():
    result = arabic_score_summary({})
    assert result["quarter_total"] is None
    assert result["has_grades"] is False
    assert result["test_completion_count"] == 0


def test_section_filters_keep_legacy_records_in_international_only():
    international = school_section_query(SCHOOL_SECTION_INTERNATIONAL, "2026-2027")
    arabic = school_section_query(SCHOOL_SECTION_ARABIC, "2026-2027")
    assert {"school_section": {"$exists": False}} in international["$and"][0]["$or"]
    assert arabic == {
        "$and": [
            {"school_section": SCHOOL_SECTION_ARABIC},
            {"$or": [{"academic_year": "2026-2027"}]},
        ]
    }


def test_arabic_pdf_and_excel_exports_render_bilingual_rows():
    payload = {
        "academic_year": "2026-2027",
        "semester": 1,
        "display_quarter": 1,
        "students": [
            {
                "full_name": "محمد أحمد",
                "class_name": "رابع أ",
                "continuous_total": 40,
                "tests_total": 60,
                "quarter_total": 100,
                "test_completion_count": 4,
            }
        ],
    }
    pdf = generate_arabic_grades_pdf(payload, "ar")
    excel = generate_arabic_grades_excel(payload, "ar")
    assert pdf.startswith(b"%PDF") and len(pdf) > 2000
    assert excel.startswith(b"PK") and len(excel) > 2000
