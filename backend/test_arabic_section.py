import io

import pytest
from openpyxl import load_workbook

from server import (
    SCHOOL_SECTION_ARABIC,
    SCHOOL_SECTION_INTERNATIONAL,
    arabic_educational_stage_for_grade,
    arabic_exam_raw_max_for_grade,
    arabic_score_summary,
    classify_legacy_arabic_practical,
    generate_arabic_grades_excel,
    generate_arabic_grades_pdf,
    school_section_query,
    validate_arabic_exam_values,
)


def test_primary_uses_best_theory_and_weights_each_contribution_to_30():
    result = arabic_score_summary(
        {"theory_test_1": 11, "theory_test_2": 13, "practical_test": 12}, exam_raw_max=15
    )
    assert result["best_theory_raw"] == 13
    assert result["best_theory_weighted"] == 26
    assert result["practical_weighted"] == 24
    assert result["tests_total"] == 50


def test_middle_secondary_uses_raw_max_20_without_early_rounding():
    result = arabic_score_summary(
        {"theory_test_1": 14, "theory_test_2": 17, "practical_test": 18}, exam_raw_max=20
    )
    assert result["best_theory_raw"] == 17
    assert result["best_theory_weighted"] == 25.5
    assert result["practical_weighted"] == 27
    assert result["tests_total"] == 52.5


@pytest.mark.parametrize(
    ("theory_1", "theory_2", "expected"),
    [(10, 13, 13), (15, 12, 15), (0, 8, 8), (0, None, 0), (None, 11, 11), (None, None, None)],
)
def test_best_theory_preserves_zero_and_null(theory_1, theory_2, expected):
    result = arabic_score_summary(
        {"theory_test_1": theory_1, "theory_test_2": theory_2}, exam_raw_max=15
    )
    assert result["best_theory_raw"] == expected


def test_completion_requires_all_three_attempts_but_allows_provisional_total():
    result = arabic_score_summary(
        {"performance_tasks": 10, "theory_test_1": 0, "theory_test_2": None, "practical_test": None},
        exam_raw_max=15,
    )
    assert result["quarter_total"] == 10
    assert result["test_completion"] == {
        "theory_test_1": True,
        "theory_test_2": False,
        "practical_test": False,
    }
    assert result["test_completion_count"] == 1
    assert result["all_tests_completed"] is False

    complete_zero = arabic_score_summary(
        {"theory_test_1": 0, "theory_test_2": 0, "practical_test": 0}, exam_raw_max=15
    )
    assert complete_zero["all_tests_completed"] is True
    assert complete_zero["tests_total"] == 0
    assert complete_zero["quarter_total"] == 0


def test_arabic_blank_quarter_stays_no_data():
    result = arabic_score_summary({})
    assert result["quarter_total"] is None
    assert result["has_grades"] is False
    assert result["test_completion_count"] == 0


def test_stage_is_derived_from_canonical_class_grade():
    assert arabic_educational_stage_for_grade(4) == "primary"
    assert arabic_exam_raw_max_for_grade(6) == 15
    assert arabic_educational_stage_for_grade(7) == "middle"
    assert arabic_exam_raw_max_for_grade(9) == 20
    assert arabic_educational_stage_for_grade(10) == "secondary"
    assert arabic_exam_raw_max_for_grade(12) == 20
    with pytest.raises(ValueError):
        arabic_exam_raw_max_for_grade(None)


def test_stage_specific_raw_validation_rejects_scores_above_maximum():
    validate_arabic_exam_values({"theory_test_1": 15, "practical_test": 0}, 15)
    validate_arabic_exam_values({"theory_test_2": 20, "practical_test": 20}, 20)
    with pytest.raises(ValueError):
        validate_arabic_exam_values({"theory_test_1": 15.5}, 15)


def test_legacy_practical_migration_only_maps_unambiguous_values():
    assert classify_legacy_arabic_practical({"practical_test_1": 12}) == {
        "status": "migrated_unambiguous", "practical_test": 12
    }
    assert classify_legacy_arabic_practical({"practical_test_1": 8, "practical_test_2": 8}) == {
        "status": "migrated_unambiguous", "practical_test": 8
    }
    assert classify_legacy_arabic_practical({"practical_test_1": 8, "practical_test_2": 12}) == {
        "status": "manual_review", "practical_test": None
    }
    assert classify_legacy_arabic_practical({
        "practical_test_1": 8, "practical_test_2": 12, "practical_test": 10,
        "legacy_migration_status": "manual_review",
    }) == {"status": "resolved_manual_review", "practical_test": 10}


def test_section_and_academic_year_filters_keep_scopes_isolated():
    international = school_section_query(SCHOOL_SECTION_INTERNATIONAL, "2026-2027")
    arabic_2026 = school_section_query(SCHOOL_SECTION_ARABIC, "2026-2027")
    arabic_2027 = school_section_query(SCHOOL_SECTION_ARABIC, "2027-2028")
    assert {"school_section": {"$exists": False}} in international["$and"][0]["$or"]
    assert arabic_2026 != arabic_2027
    assert arabic_2026 == {
        "$and": [
            {"school_section": SCHOOL_SECTION_ARABIC},
            {"$or": [{"academic_year": "2026-2027"}]},
        ]
    }


def test_quarters_remain_independent_inputs():
    q1 = arabic_score_summary({"theory_test_1": 15, "practical_test": 15}, 15)
    q2 = arabic_score_summary({"theory_test_1": 5, "practical_test": 5}, 15)
    assert q1["tests_total"] == 60
    assert q2["tests_total"] == 20


def test_arabic_pdf_and_excel_exports_render_new_model_rows():
    payload = {
        "academic_year": "2026-2027", "semester": 1, "quarter": 1, "display_quarter": 1,
        "tests_completed": 3, "tests_missing": 0,
        "students": [{
            "full_name": "محمد أحمد", "class_name": "رابع أ", "has_grades": True,
            "exam_raw_max": 15, "theory_test_1": 11, "theory_test_2": 13, "practical_test": 12,
            "continuous_total": 40, "best_theory_weighted": 26, "practical_weighted": 24,
            "tests_total": 50, "quarter_total": 90, "test_completion_count": 3,
        }],
    }
    pdf = generate_arabic_grades_pdf(payload, "ar")
    pdf_en = generate_arabic_grades_pdf(payload, "en")
    excel = generate_arabic_grades_excel(payload, "ar")
    assert pdf.startswith(b"%PDF") and len(pdf) > 2000
    assert pdf_en.startswith(b"%PDF") and len(pdf_en) > 2000
    assert excel.startswith(b"PK") and len(excel) > 2000
    headers = [cell.value for cell in next(load_workbook(io.BytesIO(excel)).active.iter_rows())]
    assert "الاختبار العملي (خام)" in headers
    assert all("العملي 1" not in str(header) and "العملي 2" not in str(header) for header in headers)
