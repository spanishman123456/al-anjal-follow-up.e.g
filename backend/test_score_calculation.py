import os
import sys
import types

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")


class _Dummy:
    def __init__(self, *args, **kwargs):
        pass

    def __getattr__(self, name):
        return _Dummy()

    def __call__(self, *args, **kwargs):
        return _Dummy()

    def __getitem__(self, key):
        return _Dummy()


def _stub_module(name, **attrs):
    module = types.ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    sys.modules.setdefault(name, module)
    return module


_stub_module("motor", motor_asyncio=_stub_module("motor.motor_asyncio", AsyncIOMotorClient=_Dummy))
_stub_module("motor.motor_asyncio", AsyncIOMotorClient=_Dummy)
_stub_module("apscheduler", schedulers=_Dummy(), triggers=_Dummy())
_stub_module("apscheduler.schedulers", asyncio=_stub_module("apscheduler.schedulers.asyncio", AsyncIOScheduler=_Dummy))
_stub_module("apscheduler.schedulers.asyncio", AsyncIOScheduler=_Dummy)
_stub_module("apscheduler.triggers", cron=_stub_module("apscheduler.triggers.cron", CronTrigger=_Dummy))
_stub_module("apscheduler.triggers.cron", CronTrigger=_Dummy)
_stub_module("sendgrid", SendGridAPIClient=_Dummy)
_stub_module("sendgrid.helpers", mail=_Dummy())
_stub_module(
    "sendgrid.helpers.mail",
    Mail=_Dummy,
    Attachment=_Dummy,
    FileContent=_Dummy,
    FileName=_Dummy,
    FileType=_Dummy,
    Disposition=_Dummy,
    Email=_Dummy,
)
_stub_module("twilio", rest=_stub_module("twilio.rest", Client=_Dummy))
_stub_module("twilio.rest", Client=_Dummy)
_stub_module("jwt")
_stub_module("passlib", context=_stub_module("passlib.context", CryptContext=_Dummy))
_stub_module("passlib.context", CryptContext=_Dummy)

from server import (
    compute_assessment_combined,
    compute_assessment_combined_q2,
    compute_avg_weeks_10_18,
    compute_cumulative_quarter_score_50,
    compute_final_exams_combined,
    compute_students_total_for_assessment,
)


def test_empty_quarter_q2_scores_return_no_data_not_15():
    sw = {}
    avg = compute_avg_weeks_10_18(sw)
    assert avg is None
    students_total = compute_students_total_for_assessment(sw, avg_weeks_10_18=avg, weeks_10_18=True)
    assert students_total is None

    assess = compute_assessment_combined_q2(
        {"quiz3": None, "quiz4": None, "chapter_test2_practical": None},
        avg_weeks_10_18=avg,
        students_total_override=students_total,
    )
    assert assess["combined_total"] is None
    assert assess["students_total"] is None

    final = compute_final_exams_combined(
        {"quiz3": None, "quiz4": None, "chapter_test2_practical": None, "quarter2_practical": None, "quarter2_theory": None},
        avg_weeks_10_18=avg,
        quarter=2,
        students_total_override=students_total,
    )
    assert final["combined_total"] is None
    assert final["performance_level"] == "no_data"

    cumulative = compute_cumulative_quarter_score_50(sw, quarter=2)
    assert cumulative["total_50"] is None
    assert cumulative["combined_total"] is None
    assert cumulative["performance_level"] == "no_data"


def test_assessment_only_contributes_followup_to_50():
    sw = {
        10: {"attendance": 2.5, "participation": 2.5, "behavior": 5, "homework": 5},
    }
    cumulative = compute_cumulative_quarter_score_50(sw, quarter=2)
    assert cumulative["followup_15"] == 15.0
    assert cumulative["quizzes_chapter_15"] == 0.0
    assert cumulative["exams_20"] == 0.0
    assert cumulative["total_50"] == 15.0


def test_quizzes_only_contribute_quiz_chapter_part():
    sw = {11: {"quiz3": 4, "quiz4": 3, "chapter_test2_practical": 10}}
    cumulative = compute_cumulative_quarter_score_50(sw, quarter=2)
    assert cumulative["followup_15"] == 0.0
    assert cumulative["quizzes_chapter_15"] == 14.0
    assert cumulative["exams_20"] == 0.0
    assert cumulative["total_50"] == 14.0


def test_final_exams_only_contribute_exam_part():
    sw = {12: {"quarter2_practical": 9, "quarter2_theory": 8}}
    cumulative = compute_cumulative_quarter_score_50(sw, quarter=2)
    assert cumulative["followup_15"] == 0.0
    assert cumulative["quizzes_chapter_15"] == 0.0
    assert cumulative["exams_20"] == 17.0
    assert cumulative["total_50"] == 17.0


def test_all_sections_sum_to_50():
    sw = {
        10: {"attendance": 2.5, "participation": 2.5, "behavior": 5, "homework": 5},
        11: {"quiz3": 5, "quiz4": 4, "chapter_test2_practical": 10},
        12: {"quarter2_practical": 10, "quarter2_theory": 10},
    }
    cumulative = compute_cumulative_quarter_score_50(sw, quarter=2)
    assert cumulative["followup_15"] == 15.0
    assert cumulative["quizzes_chapter_15"] == 15.0
    assert cumulative["exams_20"] == 20.0
    assert cumulative["total_50"] == 50.0


def test_blank_null_and_missing_values_count_as_zero():
    sw = {
        10: {"attendance": None, "participation": "", "behavior": None, "homework": None},
        11: {"quiz3": None, "quiz4": None, "chapter_test2_practical": None},
    }
    cumulative = compute_cumulative_quarter_score_50(sw, quarter=2)
    assert cumulative["total_50"] is None

    assess = compute_assessment_combined_q2(
        {"quiz3": None, "quiz4": "", "chapter_test2_practical": None},
        avg_weeks_10_18=None,
        students_total_override=None,
    )
    assert assess["combined_total"] is None


def test_class_5b_style_empty_week_10_record_does_not_default_to_15():
    """Score row exists for week 10 but every field is blank — must not produce 15/50."""
    sw = {
        10: {
            "attendance": None,
            "participation": None,
            "behavior": None,
            "homework": None,
            "quiz3": None,
            "quiz4": None,
            "chapter_test2_practical": None,
            "quarter2_practical": None,
            "quarter2_theory": None,
        }
    }
    cumulative = compute_cumulative_quarter_score_50(sw, quarter=2)
    assert cumulative["total_50"] is None
    assert cumulative.get("followup_15", 0) == 0.0


def test_q1_empty_scores_return_no_data():
    cumulative = compute_cumulative_quarter_score_50({}, quarter=1)
    assert cumulative["total_50"] is None
    assert cumulative["performance_level"] == "no_data"


def test_assessment_combined_never_treats_zero_override_as_implicit_full_marks():
    """Passing students_total_override=0 when no follow-up data existed must not create a scored row."""
    result = compute_assessment_combined_q2(
        {"quiz3": None, "quiz4": None, "chapter_test2_practical": None},
        avg_weeks_10_18=None,
        students_total_override=None,
    )
    assert result["combined_total"] is None
