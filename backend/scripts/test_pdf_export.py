#!/usr/bin/env python3
"""
Generate sample Analytics / Reports PDFs locally without MongoDB.

Usage (from backend folder):
  python scripts/test_pdf_export.py
  python scripts/test_pdf_export.py --lang ar --out ./test_exports

Requires: reportlab, matplotlib, arabic-reshaper, python-bidi (see requirements.txt).
Does NOT require MONGO_URL or network access.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _sample_report() -> dict:
    report = {
        "semester": 2,
        "quarter": 1,
        "total_students": 194,
        "avg_total_score": 48.94,
        "exceeding_rate": 93.8,
        "distribution": [
            {"level": "on_level", "count": 182},
            {"level": "approach", "count": 10},
            {"level": "below", "count": 2},
            {"level": "no_data", "count": 0},
        ],
        "class_breakdown": [
            {"class_name": "الصف الرابع أ", "student_count": 40},
            {"class_name": "الصف الخامس ب", "student_count": 38},
            {"class_name": "Grade 6A", "student_count": 35},
        ],
        "quarter1": {"avg_total": 24.5, "total_with_data": 190, "distribution": []},
        "quarter2": {"avg_total": 0, "total_with_data": 0, "distribution": []},
        "top_performers": [],
        "students_needing_support": [],
    }
    for index in range(1, 29):
        common = {
            "full_name": f"Sample Student {index:02d}",
            "class_name": ["Grade 4A", "Grade 5B", "Grade 6A"][index % 3],
            "quarter1_total": round(43 + (index % 8) * 0.8, 1),
            "total_score_normalized": round(43 + (index % 8) * 0.8, 1),
            "focus_assessment": 27,
            "focus_quiz_primary": 5,
            "focus_quiz_secondary": 4,
            "focus_chapter_test": 9,
            "focus_exam_practical": 9,
            "focus_exam_theory": 9,
        }
        if index <= 14:
            report["top_performers"].append({**common, "strengths": ["Assessment", "Quarter exams"]})
        else:
            report["students_needing_support"].append({
                **common,
                "performance_label": "Approach",
                "weak_areas": ["Quiz follow-up", "Theory exam"],
            })
    return report


def _sample_overview(report: dict) -> dict:
    dist = report["distribution"]
    return {
        "semester": report["semester"],
        "quarter": report["quarter"],
        "quarter1": {"distribution": dist},
        "quarter2": {"distribution": []},
    }


def _sample_classes() -> list:
    return [
        {"class_name": "الصف الرابع أ", "avg_total_score": 48.5},
        {"class_name": "الصف الخامس ب", "avg_total_score": 48.4},
        {"class_name": "Grade 6A", "avg_total_score": 49.1},
    ]


def _sample_insights(lang: str) -> dict:
    if lang == "ar":
        return {
            "analysis_strengths": "أداء قوي في معظم الصفوف مع نسبة عالية على المستوى.",
            "analysis_performance": "غالبية الطلاب يحققون متطلبات الفصل الدراسي.",
            "analysis_weaknesses": "مجموعة صغيرة تحتاج دعمًا مستهدفًا.",
            "analysis_standout_data": "الصف الرابع أ يظهر متوسطًا متميزًا.",
            "analysis_actions": "متابعة الطلاب دون المستوى؛ مراجعة المهارات الضعيفة حسب الصف.",
            "analysis_recommendations": "جدولة تقييمات متابعة للفصل القادم.",
        }
    return {
        "analysis_strengths": "Strong cohort performance across most classes.",
        "analysis_performance": "Majority of students meet term expectations.",
        "analysis_weaknesses": "A small group needs targeted support.",
        "analysis_standout_data": "Grade 4A shows a standout average.",
        "analysis_actions": "Support below-level students; review weak skills by class.",
        "analysis_recommendations": "Schedule follow-up assessments next term.",
    }


def _sample_arabic_payload() -> dict:
    students = []
    for index in range(1, 57):
        class_name = "الرابع أ" if index <= 28 else "الخامس ب"
        complete = index % 5 != 0
        continuous = 30 + index % 11
        tests_total = 48 + index % 13 if complete else None
        students.append({
            "full_name": f"طالب عربي {index:02d}",
            "class_name": class_name,
            "continuous_total": continuous,
            "tests_total": tests_total,
            "quarter_total": continuous + tests_total if tests_total is not None else continuous,
            "test_completion_count": 4 if complete else 2,
            "has_grades": True,
        })
    completed = sum(item["test_completion_count"] for item in students)
    return {
        "academic_year": "2026-2027",
        "semester": 1,
        "quarter": 1,
        "display_quarter": 1,
        "students": students,
        "tests_completed": completed,
        "tests_missing": len(students) * 4 - completed,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline PDF export smoke test")
    parser.add_argument("--lang", choices=("en", "ar"), default="ar", help="Report language")
    parser.add_argument(
        "--out",
        type=Path,
        default=BACKEND_DIR / "test_exports",
        help="Output directory for PDF files",
    )
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    import server as s

    report = _sample_report()
    overview = _sample_overview(report)
    classes = _sample_classes()
    insights = _sample_insights(args.lang)

    analytics_path = args.out / f"international_quarter_analytics_{args.lang}.pdf"
    analytics_bytes = s.generate_analytics_dashboard_pdf(
        report,
        "Grades 4–8",
        overview,
        classes,
        selected_grade_labels=["4", "5", "6", "7", "8"],
        insights=insights,
        lang=args.lang,
    )
    analytics_path.write_bytes(analytics_bytes)

    semester_report = dict(report)
    semester_report["reporting_period_label"] = {
        "en": "Semester 2 · Midterm management review",
        "ar": "الفصل الدراسي الثاني · مراجعة منتصف الفصل",
    }
    reports_path = args.out / f"international_semester_midterm_{args.lang}.pdf"
    reports_bytes = s.generate_reports_dashboard_pdf(
        semester_report,
        "Grades 4–8",
        insights=insights,
        report_type="full",
        lang=args.lang,
    )
    reports_path.write_bytes(reports_bytes)

    arabic_path = args.out / "arabic_quarter_report_ar.pdf"
    arabic_bytes = s.generate_arabic_grades_pdf(_sample_arabic_payload(), "ar")
    arabic_path.write_bytes(arabic_bytes)

    print(f"OK: wrote {analytics_path} ({len(analytics_bytes):,} bytes)")
    print(f"OK: wrote {reports_path} ({len(reports_bytes):,} bytes)")
    print(f"OK: wrote {arabic_path} ({len(arabic_bytes):,} bytes)")
    print("Open the PDFs and verify Arabic text and chart axis labels (no square boxes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
