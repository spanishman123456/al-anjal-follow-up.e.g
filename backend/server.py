from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Query, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Setup logging early
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import pandas as pd
import re
import io
import base64
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage, PageBreak
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import (
    Mail,
    Attachment,
    FileContent,
    FileName,
    FileType,
    Disposition,
    Email as SGEmail,
)
import requests
from pymongo import UpdateOne
from twilio.rest import Client as TwilioClient
import jwt
from passlib.context import CryptContext
import re


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    raise ValueError("MONGO_URL environment variable is not set. Please check your .env file.")

# URL encode special characters in password if needed
from urllib.parse import quote_plus
if '@' in mongo_url and '://' in mongo_url:
    # Extract and encode password if it contains special characters
    try:
        protocol_end = mongo_url.find('://') + 3
        at_pos = mongo_url.find('@', protocol_end)
        if at_pos > protocol_end:
            user_pass = mongo_url[protocol_end:at_pos]
            if ':' in user_pass:
                username, password = user_pass.split(':', 1)
                # Only encode if password contains special chars
                if any(c in password for c in ['@', '#', '$', '%', '&', '+', '=']):
                    encoded_password = quote_plus(password)
                    mongo_url = mongo_url[:protocol_end] + f"{username}:{encoded_password}" + mongo_url[at_pos:]
    except Exception:
        pass  # If encoding fails, use original URL

try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
except Exception as e:
    logger.error(f"Failed to create MongoDB client: {e}")
    raise

db = client[os.environ.get('DB_NAME', 'school_db')]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: Dict[str, Any], expires_minutes: int = 60 * 24 * 30):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire})
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    return jwt.encode(to_encode, secret, algorithm="HS256")


async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = credentials.credentials
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


app = FastAPI()
auth_router = APIRouter(prefix="/api/auth")
api_router = APIRouter(prefix="/api", dependencies=[Depends(get_current_user)])


@app.get("/health")
async def health_check():
    return {"status": "ok"}

PERFORMANCE_THRESHOLDS = {
    "exceeding": 47,
    "meeting": 45,
    "approaching": 43,
    "below": 40,
}
MAX_RAW_TOTAL = 30
NORMALIZED_MAX = 50
NORMALIZATION_FACTOR = NORMALIZED_MAX / MAX_RAW_TOTAL

REPORT_TIMEZONE = ZoneInfo("Asia/Riyadh")
scheduler = AsyncIOScheduler(timezone=REPORT_TIMEZONE)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_score(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def average_values(values: List[Optional[float]]) -> float:
    filtered = [value for value in values if value is not None]
    if not filtered:
        return 0.0
    return float(sum(filtered)) / len(filtered)


def compute_quarter_totals(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> Dict[str, float]:
    # Keep quarter boundaries aligned across the codebase:
    # Q1 = weeks 1-9, Q2 = weeks 10-18
    quarter1_weeks = [week for week in scores_by_week.keys() if week <= 9]
    quarter2_weeks = [week for week in scores_by_week.keys() if week >= 10]

    def avg_field(weeks: List[int], field: str) -> float:
        return average_values([scores_by_week.get(week, {}).get(field) for week in weeks])

    avg_quiz12 = average_values([
        scores_by_week.get(4, {}).get("quiz1"),
        scores_by_week.get(4, {}).get("quiz2"),
    ])
    avg_quiz34 = average_values([
        scores_by_week.get(16, {}).get("quiz3"),
        scores_by_week.get(16, {}).get("quiz4"),
    ])
    chapter1 = scores_by_week.get(4, {}).get("chapter_test1_practical") or 0.0
    chapter2 = scores_by_week.get(16, {}).get("chapter_test2_practical") or 0.0
    quarter1_practical = scores_by_week.get(9, {}).get("quarter1_practical") or 0.0
    quarter1_theory = scores_by_week.get(10, {}).get("quarter1_theory") or scores_by_week.get(9, {}).get("quarter1_theory") or 0.0
    quarter2_practical = scores_by_week.get(17, {}).get("quarter2_practical") or 0.0
    quarter2_theory = scores_by_week.get(18, {}).get("quarter2_theory") or 0.0

    quarter1_total = (
        avg_quiz12
        + chapter1
        + quarter1_practical
        + quarter1_theory
        + avg_field(quarter1_weeks, "attendance")
        + avg_field(quarter1_weeks, "participation")
        + avg_field(quarter1_weeks, "behavior")
        + avg_field(quarter1_weeks, "homework")
    )
    quarter2_total = (
        avg_quiz34
        + chapter2
        + quarter2_practical
        + quarter2_theory
        + avg_field(quarter2_weeks, "attendance")
        + avg_field(quarter2_weeks, "participation")
        + avg_field(quarter2_weeks, "behavior")
        + avg_field(quarter2_weeks, "homework")
    )
    return {
        "quarter1_total": round(quarter1_total, 2),
        "quarter2_total": round(quarter2_total, 2),
        "semester_total": round(quarter1_total + quarter2_total, 2),
    }


# Quarter total max ~55 (follow-up 15 + quiz 5 + chapter 10 + exams 20). Thresholds for performance level.
QUARTER_TOTAL_ON_LEVEL = 44   # ~80%
QUARTER_TOTAL_APPROACH = 33   # ~60%


def quarter_total_to_level(quarter_total: Optional[float]) -> str:
    """Map quarter total to performance level (on_level, approach, below, no_data)."""
    if quarter_total is None or (isinstance(quarter_total, float) and pd.isna(quarter_total)):
        return "no_data"
    v = float(quarter_total)
    if v >= QUARTER_TOTAL_ON_LEVEL:
        return "on_level"
    if v >= QUARTER_TOTAL_APPROACH:
        return "approach"
    return "below"


def _safe_float(val: Any) -> Optional[float]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def compute_student_insights(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> Dict[str, List[str]]:
    """
    From semester scores, compute weak_areas and strengths (display labels).
    Weak: dimension avg below 60% of max or missing. Strength: >= 85% of max.
    """
    weak_areas: List[str] = []
    strengths: List[str] = []
    q1_weeks = [w for w in scores_by_week.keys() if w <= 10]
    q2_weeks = [w for w in scores_by_week.keys() if w >= 11]

    def avg_field(weeks: List[int], field: str) -> Optional[float]:
        vals = [scores_by_week.get(w, {}).get(field) for w in weeks]
        nums = [v for v in vals if _safe_float(v) is not None]
        return (sum(nums) / len(nums)) if nums else None

    # Follow-up dimensions (max 2.5, 2.5, 5, 5)
    for label, field, max_val in [
        ("Attendance", "attendance", 2.5),
        ("Participation", "participation", 2.5),
        ("Behavior", "behavior", 5.0),
        ("Homework", "homework", 5.0),
    ]:
        v1 = avg_field(q1_weeks, field)
        v2 = avg_field(q2_weeks, field)
        v = v2 if v2 is not None else v1
        if v is None:
            weak_areas.append(label)
        elif v < 0.6 * max_val:
            weak_areas.append(label)
        elif v >= 0.85 * max_val:
            strengths.append(label)

    # Quiz (best of quiz1/2 in Q1, quiz3/4 in Q2; max 5 each)
    q1_quiz = average_values([
        scores_by_week.get(4, {}).get("quiz1"),
        scores_by_week.get(4, {}).get("quiz2"),
    ])
    q2_quiz = average_values([
        scores_by_week.get(16, {}).get("quiz3"),
        scores_by_week.get(16, {}).get("quiz4"),
    ])
    quiz_val = q2_quiz if q2_quiz is not None else q1_quiz
    if quiz_val is None:
        weak_areas.append("Quizzes")
    elif quiz_val < 3.0:
        weak_areas.append("Quizzes")
    elif quiz_val >= 4.25:
        strengths.append("Quizzes")

    # Chapter tests (max 10 each)
    ch1 = _safe_float(scores_by_week.get(4, {}).get("chapter_test1_practical"))
    ch2 = _safe_float(scores_by_week.get(16, {}).get("chapter_test2_practical"))
    ch_val = ch2 if ch2 is not None else ch1
    if ch_val is None:
        weak_areas.append("Chapter tests")
    elif ch_val < 6.0:
        weak_areas.append("Chapter tests")
    elif ch_val >= 8.5:
        strengths.append("Chapter tests")

    # Quarter exams (practical + theory, max 10 each per quarter). Q1 has only weeks 1-9, so fallback to week 9 for theory.
    q1_p = _safe_float(scores_by_week.get(9, {}).get("quarter1_practical"))
    q1_t = _safe_float(scores_by_week.get(10, {}).get("quarter1_theory") or scores_by_week.get(9, {}).get("quarter1_theory"))
    q2_p = _safe_float(scores_by_week.get(17, {}).get("quarter2_practical"))
    q2_t = _safe_float(scores_by_week.get(18, {}).get("quarter2_theory"))
    exam_q1 = (q1_p or 0) + (q1_t or 0)
    exam_q2 = (q2_p or 0) + (q2_t or 0)
    exam_val = exam_q2 if (q2_p is not None or q2_t is not None) else exam_q1
    if exam_val == 0 and q1_p is None and q1_t is None:
        weak_areas.append("Quarter exams")
    elif exam_val < 12:  # 60% of 20
        weak_areas.append("Quarter exams")
    elif exam_val >= 17:  # 85% of 20
        strengths.append("Quarter exams")

    return {"weak_areas": weak_areas, "strengths": strengths}


def _week_quarter(week: Dict[str, Any]) -> int:
    """Infer quarter from week doc (for backward compat when quarter is missing)."""
    if "quarter" in week and week["quarter"] in (1, 2):
        return week["quarter"]
    num = week.get("number", 1)
    return 1 if num <= 9 else 2


async def build_semester_score_map(student_ids: List[str], semester: int) -> Dict[str, Dict[int, Dict[str, Optional[float]]]]:
    if not student_ids:
        return {}
    semester_weeks = await db.weeks.find({"semester": semester}, {"_id": 0}).to_list(200)
    week_number_map = {week["id"]: week["number"] for week in semester_weeks}
    semester_week_ids = list(week_number_map.keys())
    if not semester_week_ids:
        return {}
    all_scores = await db.student_scores.find(
        {"week_id": {"$in": semester_week_ids}, "student_id": {"$in": student_ids}}, {"_id": 0}
    ).to_list(5000)
    scores_by_student: Dict[str, Dict[int, Dict[str, Optional[float]]]] = {}
    for score in all_scores:
        week_number = week_number_map.get(score.get("week_id"))
        if not week_number:
            continue
        scores_by_student.setdefault(score["student_id"], {})[week_number] = score
    return scores_by_student


async def build_quarter_score_map(
    student_ids: List[str], semester: int, quarter: int
) -> Dict[str, Dict[int, Dict[str, Optional[float]]]]:
    """Load scores only for weeks in (semester, quarter). Full separation: S1Q1, S1Q2, S2Q1, S2Q2."""
    if not student_ids:
        return {}
    query = {"semester": semester, "quarter": quarter}
    quarter_weeks = await db.weeks.find(query, {"_id": 0}).to_list(200)
    if not quarter_weeks:
        # Backward compat: weeks may lack quarter field
        all_sem = await db.weeks.find({"semester": semester}, {"_id": 0}).to_list(200)
        quarter_weeks = [w for w in all_sem if _week_quarter(w) == quarter]
    week_number_map = {w["id"]: w["number"] for w in quarter_weeks}
    week_ids = list(week_number_map.keys())
    if not week_ids:
        return {}
    all_scores = await db.student_scores.find(
        {"week_id": {"$in": week_ids}, "student_id": {"$in": student_ids}}, {"_id": 0}
    ).to_list(5000)
    scores_by_student: Dict[str, Dict[int, Dict[str, Optional[float]]]] = {}
    for score in all_scores:
        wn = week_number_map.get(score.get("week_id"))
        if wn is not None:
            scores_by_student.setdefault(score["student_id"], {})[wn] = score
    return scores_by_student


def _normalized_week_number(week: Dict[str, Any]) -> int:
    """Map to global week index: semester 1 = 1-9, semester 2 = 10-18. So Q1 and Q2 never overwrite."""
    num = week.get("number", 1)
    sem = week.get("semester", 1)
    if sem == 2 and num <= 9:
        return 9 + num  # 1->10, 2->11, ... 9->18
    return num


async def build_full_year_score_map(student_ids: List[str]) -> Dict[str, Dict[int, Dict[str, Optional[float]]]]:
    """Load scores for weeks from BOTH semesters so Q1 (weeks 1-9) and Q2 (weeks 10-18) both have data for Dashboard, Analytics, Classes, Reports."""
    if not student_ids:
        return {}
    all_weeks = await db.weeks.find({"semester": {"$in": [1, 2]}}, {"_id": 0}).to_list(200)
    week_number_map = {week["id"]: _normalized_week_number(week) for week in all_weeks}
    week_ids = list(week_number_map.keys())
    if not week_ids:
        return {}
    all_scores = await db.student_scores.find(
        {"week_id": {"$in": week_ids}, "student_id": {"$in": student_ids}}, {"_id": 0}
    ).to_list(10000)
    scores_by_student: Dict[str, Dict[int, Dict[str, Optional[float]]]] = {}
    for score in all_scores:
        week_number = week_number_map.get(score.get("week_id"))
        if not week_number:
            continue
        scores_by_student.setdefault(score["student_id"], {})[week_number] = score
    return scores_by_student


def compute_avg_first_9_weeks(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> Optional[float]:
    """Average of student's follow-up total (attendance+participation+behavior+homework, max 15) over weeks 1-9. Only includes weeks that have at least one non-null score; returns None if no such weeks."""
    week_totals: List[float] = []
    for week_num in range(1, 10):
        score = scores_by_week.get(week_num) or {}
        a, p, b, h = score.get("attendance"), score.get("participation"), score.get("behavior"), score.get("homework")
        if all(v is None or (isinstance(v, float) and pd.isna(v)) for v in [a, p, b, h]):
            continue
        total = sum(
            float(v) if v is not None and not (isinstance(v, float) and pd.isna(v)) else 0
            for v in [a, p, b, h]
        )
        week_totals.append(min(total, TOTAL_SCORE_MAX))
    if not week_totals:
        return None
    return round(sum(week_totals) / len(week_totals), 2)


def compute_avg_first_9_weeks_inclusive(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> float:
    """Average over all 9 weeks (1-9); weeks with no data count as 0. Makes totals cumulative so empty weeks reduce the score."""
    n_weeks = 9
    total_sum = 0.0
    for week_num in range(1, 10):
        score = scores_by_week.get(week_num) or {}
        a, p, b, h = score.get("attendance"), score.get("participation"), score.get("behavior"), score.get("homework")
        week_total = sum(
            float(v) if v is not None and not (isinstance(v, float) and pd.isna(v)) else 0
            for v in [a, p, b, h]
        )
        total_sum += min(week_total, TOTAL_SCORE_MAX)
    return round(total_sum / n_weeks, 2)


def compute_avg_weeks_10_18(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> Optional[float]:
    """Average of student's follow-up total (attendance+participation+behavior+homework, max 15) over weeks 10-18. Only includes weeks that have at least one non-null score; returns None if no such weeks."""
    week_totals: List[float] = []
    for week_num in range(10, 19):
        score = scores_by_week.get(week_num) or {}
        a, p, b, h = score.get("attendance"), score.get("participation"), score.get("behavior"), score.get("homework")
        if all(v is None or (isinstance(v, float) and pd.isna(v)) for v in [a, p, b, h]):
            continue
        total = sum(
            float(v) if v is not None and not (isinstance(v, float) and pd.isna(v)) else 0
            for v in [a, p, b, h]
        )
        week_totals.append(min(total, 15))
    if not week_totals:
        return None
    return round(sum(week_totals) / len(week_totals), 2)


def compute_avg_weeks_10_18_inclusive(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> float:
    """Average over all 9 weeks (10-18); weeks with no data count as 0. Makes totals cumulative."""
    n_weeks = 9
    total_sum = 0.0
    for week_num in range(10, 19):
        score = scores_by_week.get(week_num) or {}
        a, p, b, h = score.get("attendance"), score.get("participation"), score.get("behavior"), score.get("homework")
        week_total = sum(
            float(v) if v is not None and not (isinstance(v, float) and pd.isna(v)) else 0
            for v in [a, p, b, h]
        )
        total_sum += min(week_total, 15)
    return round(total_sum / n_weeks, 2)


def compute_students_total_for_assessment(
    scores_by_week: Dict[int, Dict[str, Optional[float]]],
    avg_first_9_weeks: Optional[float] = None,
    weeks_10_18: bool = False,
) -> float:
    """Students total (max 15) for Assessment/Final: average over all weeks in range, with empty weeks = 0 (cumulative)."""
    if weeks_10_18:
        avg_inclusive = compute_avg_weeks_10_18_inclusive(scores_by_week)
    else:
        avg_inclusive = compute_avg_first_9_weeks_inclusive(scores_by_week)
    return round(min(max(0, avg_inclusive), 15), 2)


def _safe_float_score(val: Any) -> float:
    """Return float value or 0 if None/NaN."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0.0
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def compute_inclusive_quiz_chapter_q1(
    scores_by_week: Dict[int, Dict[str, Optional[float]]],
) -> tuple:
    """Avg quiz (max 5) and avg chapter (max 10) over weeks 1-9; empty weeks = 0. Returns (avg_quiz, avg_chapter)."""
    n = 9
    quiz_sum = 0.0
    chapter_sum = 0.0
    for w in range(1, 10):
        s = scores_by_week.get(w) or {}
        q1 = _safe_float_score(s.get("quiz1"))
        q2 = _safe_float_score(s.get("quiz2"))
        quiz_sum += min(max(q1, q2), 5.0)
        ch = _safe_float_score(s.get("chapter_test1_practical"))
        chapter_sum += min(ch, 10.0)
    return (round(quiz_sum / n, 2), round(chapter_sum / n, 2))


def compute_inclusive_quiz_chapter_q2(
    scores_by_week: Dict[int, Dict[str, Optional[float]]],
) -> tuple:
    """Avg quiz (max 5) and avg chapter (max 10) over weeks 10-18; empty weeks = 0. Returns (avg_quiz, avg_chapter)."""
    n = 9
    quiz_sum = 0.0
    chapter_sum = 0.0
    for w in range(10, 19):
        s = scores_by_week.get(w) or {}
        q3 = _safe_float_score(s.get("quiz3"))
        q4 = _safe_float_score(s.get("quiz4"))
        quiz_sum += min(max(q3, q4), 5.0)
        ch = _safe_float_score(s.get("chapter_test2_practical"))
        chapter_sum += min(ch, 10.0)
    return (round(quiz_sum / n, 2), round(chapter_sum / n, 2))


def compute_inclusive_quarter_exams_q1(
    scores_by_week: Dict[int, Dict[str, Optional[float]]],
) -> tuple:
    """Avg practical/theory (max 10 each) over weeks 1-9; empty weeks = 0. Returns (avg_practical, avg_theory)."""
    n = 9
    practical_sum = 0.0
    theory_sum = 0.0
    for w in range(1, 10):
        s = scores_by_week.get(w) or {}
        practical_sum += min(_safe_float_score(s.get("quarter1_practical")), 10.0)
        theory_sum += min(_safe_float_score(s.get("quarter1_theory")), 10.0)
    return (round(practical_sum / n, 2), round(theory_sum / n, 2))


def compute_inclusive_quarter_exams_q2(
    scores_by_week: Dict[int, Dict[str, Optional[float]]],
) -> tuple:
    """Avg practical/theory (max 10 each) over weeks 10-18; empty weeks = 0. Returns (avg_practical, avg_theory)."""
    n = 9
    practical_sum = 0.0
    theory_sum = 0.0
    for w in range(10, 19):
        s = scores_by_week.get(w) or {}
        practical_sum += min(_safe_float_score(s.get("quarter2_practical")), 10.0)
        theory_sum += min(_safe_float_score(s.get("quarter2_theory")), 10.0)
    return (round(practical_sum / n, 2), round(theory_sum / n, 2))


# Students page total: attendance (2.5) + participation (2.5) + behavior (5) + homework (5) = 15 max.
# Assessment Marks: Students total (15) + best(Quiz1, Quiz2)(5) + Chapter Test 1 Practical(10) = 30 max.
# Final Exams: Assessment (30) + Quarter Practical(10) + Quarter Theory(10) = 50 max.
# Performance: On Level 13-15 (Students), 25-30 (Assessment), 42-50 (Final); Approach/Below per thresholds.
TOTAL_SCORE_MAX = 15  # 2.5 + 2.5 + 5 + 5


def compute_performance(scores: Dict[str, Optional[float]]) -> Dict[str, Any]:
    behavioral = {
        "attendance": scores.get("attendance"),
        "participation": scores.get("participation"),
        "behavior": scores.get("behavior"),
        "homework": scores.get("homework"),
    }
    if all(v is None or (isinstance(v, float) and pd.isna(v)) for v in behavioral.values()):
        return {
            "performance_level": "no_data",
            "performance_label": "No Data",
            "total_score_raw": None,
            "total_score_normalized": None,
        }
    # Direct sum: attendance + participation + behavior + homework (out of 15). Cap at 15.
    total = sum(float(v) if v is not None and not (isinstance(v, float) and pd.isna(v)) else 0 for v in behavioral.values())
    total_score = round(min(max(0, total), TOTAL_SCORE_MAX), 2)
    if total_score >= 13:
        level = "on_level"
    elif total_score >= 10:
        level = "approach"
    else:
        level = "below"
    label_map = {
        "on_level": "On Level",
        "approach": "Approach",
        "below": "Below",
        "no_data": "No Data",
    }
    return {
        "performance_level": level,
        "performance_label": label_map[level],
        "total_score_raw": round(total, 2),
        "total_score_normalized": total_score,
    }


def compute_assessment_combined(
    scores: Dict[str, Optional[float]],
    avg_first_9_weeks: Optional[float] = None,
    avg_weeks_10_18: Optional[float] = None,
    students_total_override: Optional[float] = None,
) -> Dict[str, Any]:
    """Combined total = students part (max 15) + best(Quiz1, Quiz2) + Chapter Test (max 15), total max 30."""
    avg_to_use = None  # so has_any can always reference it
    if students_total_override is not None:
        students_total = round(min(max(0, float(students_total_override)), 15), 2)
        avg_to_use = students_total_override
    else:
        avg_to_use = avg_weeks_10_18 if avg_weeks_10_18 is not None else avg_first_9_weeks
        if avg_to_use is not None:
            students_total = round(min(max(0, float(avg_to_use)), 15), 2)
        else:
            behavioral = {
                "attendance": scores.get("attendance"),
                "participation": scores.get("participation"),
                "behavior": scores.get("behavior"),
                "homework": scores.get("homework"),
            }
            students_total = sum(
                float(v) if v is not None and not (isinstance(v, float) and pd.isna(v)) else 0
                for v in behavioral.values()
            )
            students_total = round(min(max(0, students_total), 15), 2)
    q1 = float(scores.get("quiz1")) if scores.get("quiz1") is not None and not (isinstance(scores.get("quiz1"), float) and pd.isna(scores.get("quiz1"))) else 0
    q2 = float(scores.get("quiz2")) if scores.get("quiz2") is not None and not (isinstance(scores.get("quiz2"), float) and pd.isna(scores.get("quiz2"))) else 0
    pt = float(scores.get("chapter_test1_practical")) if scores.get("chapter_test1_practical") is not None and not (isinstance(scores.get("chapter_test1_practical"), float) and pd.isna(scores.get("chapter_test1_practical"))) else 0
    assessment_total = round(min(max(0, max(q1, q2) + pt), 15), 2)
    combined = round(min(students_total + assessment_total, 30), 2)
    has_any = (
        avg_to_use is not None
        or any(
            v is not None and not (isinstance(v, float) and pd.isna(v))
            for v in [scores.get("quiz1"), scores.get("quiz2"), scores.get("chapter_test1_practical")]
        )
        or any(
            v is not None and not (isinstance(v, float) and pd.isna(v))
            for v in [scores.get("attendance"), scores.get("participation"), scores.get("behavior"), scores.get("homework")]
        )
    )
    if not has_any:
        return {"combined_total": None, "students_total": None, "performance_level": "no_data", "performance_label": "No Data"}
    if combined >= 25:
        level, label = "on_level", "On Level"
    elif combined >= 20:
        level, label = "approach", "Approach"
    else:
        level, label = "below", "Below"
    return {"combined_total": combined, "students_total": students_total, "performance_level": level, "performance_label": label}


def compute_assessment_combined_q2(
    scores: Dict[str, Optional[float]],
    avg_weeks_10_18: Optional[float] = None,
    students_total_override: Optional[float] = None,
) -> Dict[str, Any]:
    """Q2 Assessment combined: students part (max 15) + best(Quiz3, Quiz4) + Chapter Test 2 Practical (max 15), total max 30."""
    if students_total_override is not None:
        students_total = round(min(max(0, float(students_total_override)), 15), 2)
    elif avg_weeks_10_18 is not None:
        students_total = round(min(max(0, float(avg_weeks_10_18)), 15), 2)
    else:
        behavioral = {
            "attendance": scores.get("attendance"),
            "participation": scores.get("participation"),
            "behavior": scores.get("behavior"),
            "homework": scores.get("homework"),
        }
        students_total = sum(
            float(v) if v is not None and not (isinstance(v, float) and pd.isna(v)) else 0
            for v in behavioral.values()
        )
        students_total = round(min(max(0, students_total), 15), 2)
    q3 = float(scores.get("quiz3")) if scores.get("quiz3") is not None and not (isinstance(scores.get("quiz3"), float) and pd.isna(scores.get("quiz3"))) else 0
    q4 = float(scores.get("quiz4")) if scores.get("quiz4") is not None and not (isinstance(scores.get("quiz4"), float) and pd.isna(scores.get("quiz4"))) else 0
    pt = float(scores.get("chapter_test2_practical")) if scores.get("chapter_test2_practical") is not None and not (isinstance(scores.get("chapter_test2_practical"), float) and pd.isna(scores.get("chapter_test2_practical"))) else 0
    assessment_total = round(min(max(0, max(q3, q4) + pt), 15), 2)
    combined = round(min(students_total + assessment_total, 30), 2)
    has_any = (
        avg_weeks_10_18 is not None
        or students_total_override is not None
        or any(
            v is not None and not (isinstance(v, float) and pd.isna(v))
            for v in [scores.get("quiz3"), scores.get("quiz4"), scores.get("chapter_test2_practical")]
        )
    )
    if not has_any:
        return {"combined_total": None, "students_total": None, "performance_level": "no_data", "performance_label": "No Data"}
    if combined >= 25:
        level, label = "on_level", "On Level"
    elif combined >= 20:
        level, label = "approach", "Approach"
    else:
        level, label = "below", "Below"
    return {"combined_total": combined, "students_total": students_total, "performance_level": level, "performance_label": label}


def compute_final_exams_combined(
    scores: Dict[str, Optional[float]],
    avg_first_9_weeks: Optional[float] = None,
    avg_weeks_10_18: Optional[float] = None,
    quarter: int = 1,
    students_total_override: Optional[float] = None,
) -> Dict[str, Any]:
    """Final total = assessment part (30) + quarter practical (10) + quarter theory (10), max 50. quarter=1 uses weeks 1-9 and quarter1_*; quarter=2 uses weeks 10-18 and quarter2_*."""
    if quarter == 2:
        assessment_result = compute_assessment_combined_q2(
            scores, avg_weeks_10_18=avg_weeks_10_18, students_total_override=students_total_override
        )
    else:
        assessment_result = compute_assessment_combined(
            scores,
            avg_first_9_weeks=avg_first_9_weeks,
            avg_weeks_10_18=avg_weeks_10_18,
            students_total_override=students_total_override,
        )
    assessment_part = assessment_result.get("combined_total") or 0
    students_total = assessment_result.get("students_total") or 0
    if quarter == 2:
        qp = float(scores.get("quarter2_practical")) if scores.get("quarter2_practical") is not None and not (isinstance(scores.get("quarter2_practical"), float) and pd.isna(scores.get("quarter2_practical"))) else 0
        qt = float(scores.get("quarter2_theory")) if scores.get("quarter2_theory") is not None and not (isinstance(scores.get("quarter2_theory"), float) and pd.isna(scores.get("quarter2_theory"))) else 0
        quarter_fields = [scores.get("quarter2_practical"), scores.get("quarter2_theory")]
    else:
        qp = float(scores.get("quarter1_practical")) if scores.get("quarter1_practical") is not None and not (isinstance(scores.get("quarter1_practical"), float) and pd.isna(scores.get("quarter1_practical"))) else 0
        qt = float(scores.get("quarter1_theory")) if scores.get("quarter1_theory") is not None and not (isinstance(scores.get("quarter1_theory"), float) and pd.isna(scores.get("quarter1_theory"))) else 0
        quarter_fields = [scores.get("quarter1_practical"), scores.get("quarter1_theory")]
    quarter_sum = round(min(max(0, qp + qt), 20), 2)
    # When quarter exam scores are cleared, show only students/follow-up part (15/50), matching Assessment Marks (15/30).
    if quarter_sum == 0:
        combined = round(min(students_total, 50), 2)
    else:
        combined = round(min(assessment_part + quarter_sum, 50), 2)
    has_any = (
        assessment_result.get("combined_total") is not None
        or any(
            v is not None and not (isinstance(v, float) and pd.isna(v))
            for v in quarter_fields
        )
    )
    if not has_any:
        return {"combined_total": None, "performance_level": "no_data", "performance_label": "No Data"}
    if combined >= 42:
        level, label = "on_level", "On Level"
    elif combined >= 35:
        level, label = "approach", "Approach"
    else:
        level, label = "below", "Below"
    return {"combined_total": combined, "performance_level": level, "performance_label": label}


def _effective_scores_q1(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> Dict[str, Optional[float]]:
    """Build effective Q1 scores from weeks 1-9: best quiz/chapter from any week, exams from week 9 (or 9/10 if both exist).
    Note: Quarter 1 only has weeks 1-9 in the DB, so week 10 is never present when loading Q1 only. Read quarter1_theory
    from week 9 as fallback so theory marks are not lost and students are not wrongly marked Below."""
    q1_list = []
    q2_list = []
    ch1_list = []
    for w in range(1, 10):
        s = scores_by_week.get(w) or {}
        if s.get("quiz1") is not None:
            q1_list.append(float(s["quiz1"]) if not (isinstance(s["quiz1"], float) and pd.isna(s["quiz1"])) else 0)
        if s.get("quiz2") is not None:
            q2_list.append(float(s["quiz2"]) if not (isinstance(s["quiz2"], float) and pd.isna(s["quiz2"])) else 0)
        if s.get("chapter_test1_practical") is not None:
            ch1_list.append(float(s["chapter_test1_practical"]) if not (isinstance(s["chapter_test1_practical"], float) and pd.isna(s["chapter_test1_practical"])) else 0)
    quiz1 = max(q1_list) if q1_list else None
    quiz2 = max(q2_list) if q2_list else None
    ch1 = max(ch1_list) if ch1_list else None
    s9 = scores_by_week.get(9) or {}
    s10 = scores_by_week.get(10) or {}
    quarter1_theory = s10.get("quarter1_theory") or s9.get("quarter1_theory")
    return {
        "quiz1": quiz1, "quiz2": quiz2, "chapter_test1_practical": ch1,
        "quarter1_practical": s9.get("quarter1_practical"), "quarter1_theory": quarter1_theory,
    }


def _effective_scores_q2(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> Dict[str, Optional[float]]:
    """Build effective Q2 scores from weeks 10-18: best quiz/chapter from any week, exams from 17/18."""
    q3_list = []
    q4_list = []
    ch2_list = []
    for w in range(10, 19):
        s = scores_by_week.get(w) or {}
        if s.get("quiz3") is not None:
            q3_list.append(float(s["quiz3"]) if not (isinstance(s["quiz3"], float) and pd.isna(s["quiz3"])) else 0)
        if s.get("quiz4") is not None:
            q4_list.append(float(s["quiz4"]) if not (isinstance(s["quiz4"], float) and pd.isna(s["quiz4"])) else 0)
        if s.get("chapter_test2_practical") is not None:
            ch2_list.append(float(s["chapter_test2_practical"]) if not (isinstance(s["chapter_test2_practical"], float) and pd.isna(s["chapter_test2_practical"])) else 0)
    quiz3 = max(q3_list) if q3_list else None
    quiz4 = max(q4_list) if q4_list else None
    ch2 = max(ch2_list) if ch2_list else None
    s17 = scores_by_week.get(17) or {}
    s18 = scores_by_week.get(18) or {}
    return {
        "quiz3": quiz3, "quiz4": quiz4, "chapter_test2_practical": ch2,
        "quarter2_practical": s17.get("quarter2_practical"), "quarter2_theory": s18.get("quarter2_theory"),
    }


# Only these fields count as "entered marks". Ignore id, student_id, week_id, etc.
_SCORE_VALUE_KEYS = (
    "attendance", "participation", "behavior", "homework",
    "quiz1", "quiz2", "quiz3", "quiz4",
    "chapter_test1_practical", "chapter_test2_practical",
    "quarter1_practical", "quarter1_theory", "quarter2_practical", "quarter2_theory",
)


def _is_meaningful_score(v: Any) -> bool:
    """True if value counts as 'entered' (non-null, non-NaN, and non-zero). Avoids treating all-zero/blank as 'has data'."""
    if v is None:
        return False
    if isinstance(v, float) and pd.isna(v):
        return False
    try:
        if float(v) == 0:
            return False
    except (TypeError, ValueError):
        return False
    return True


def _has_any_scores(scores_by_week: Dict[int, Dict[str, Optional[float]]]) -> bool:
    """True only if at least one week has at least one *meaningful* score (non-null, non-NaN, non-zero). So no marks / all zeros = no data."""
    for week_data in scores_by_week.values():
        doc = week_data or {}
        for key in _SCORE_VALUE_KEYS:
            if _is_meaningful_score(doc.get(key)):
                return True
    return False


def _compute_cumulative_final_quarter(
    scores_by_week: Dict[int, Dict[str, Optional[float]]],
    quarter: int,
) -> Dict[str, Any]:
    """Cumulative quarter total (50 max): include empty weeks as 0 for consistent cross-page syncing."""
    if quarter == 2:
        students_total = compute_students_total_for_assessment(scores_by_week, weeks_10_18=True)
        avg_quiz, avg_chapter = compute_inclusive_quiz_chapter_q2(scores_by_week)
        avg_practical, avg_theory = compute_inclusive_quarter_exams_q2(scores_by_week)
        week_range = range(10, 19)
        quarter_keys = ("quiz3", "quiz4", "chapter_test2_practical", "quarter2_practical", "quarter2_theory")
    else:
        students_total = compute_students_total_for_assessment(scores_by_week, weeks_10_18=False)
        avg_quiz, avg_chapter = compute_inclusive_quiz_chapter_q1(scores_by_week)
        avg_practical, avg_theory = compute_inclusive_quarter_exams_q1(scores_by_week)
        week_range = range(1, 10)
        quarter_keys = ("quiz1", "quiz2", "chapter_test1_practical", "quarter1_practical", "quarter1_theory")

    has_any = False
    for w in week_range:
        s = scores_by_week.get(w) or {}
        for k in ("attendance", "participation", "behavior", "homework", *quarter_keys):
            if _is_meaningful_score(s.get(k)):
                has_any = True
                break
        if has_any:
            break
    if not has_any:
        return {"combined_total": None, "performance_level": "no_data", "performance_label": "No Data"}

    combined = round(min(students_total + avg_quiz + avg_chapter + avg_practical + avg_theory, 50), 2)
    if combined >= 42:
        level, label = "on_level", "On Level"
    elif combined >= 35:
        level, label = "approach", "Approach"
    else:
        level, label = "below", "Below"
    return {"combined_total": combined, "performance_level": level, "performance_label": label}


def _enrich_student_single_quarter(
    student: Dict[str, Any],
    sw: Dict[int, Dict[str, Optional[float]]],
    quarter: int,
) -> None:
    """Enrich student with only one quarter's total and performance (for S1Q1, S1Q2, S2Q1, S2Q2 separation)."""
    if not _has_any_scores(sw):
        student["quarter1_total"] = None
        student["quarter2_total"] = None
        student["performance_level_q1"] = "no_data"
        student["performance_level_q2"] = "no_data"
        student["performance_level"] = "no_data"
        student["semester_total"] = None
        student["total_score_normalized"] = None
        student["performance_label"] = "No Data"
        for k in ("quiz1", "quiz2", "quiz3", "quiz4", "chapter_test1", "chapter_test2"):
            student[k] = None
        return
    if quarter == 2:
        effective = _effective_scores_q2(sw)
        res = _compute_cumulative_final_quarter(sw, quarter=2)
        student["quarter1_total"] = None
        student["quarter2_total"] = res.get("combined_total")
        student["performance_level_q1"] = "no_data"
        student["performance_level_q2"] = res.get("performance_level", "no_data")
        student["performance_level"] = res.get("performance_level", "no_data")
        val = res.get("combined_total")
        student["semester_total"] = round(float(val), 2) if val is not None else None
        student["total_score_normalized"] = round(float(val), 2) if val is not None else None
        student["quiz3"] = effective.get("quiz3")
        student["quiz4"] = effective.get("quiz4")
        student["chapter_test2"] = effective.get("chapter_test2_practical")
        student["quiz1"] = None
        student["quiz2"] = None
        student["chapter_test1"] = None
    else:
        effective = _effective_scores_q1(sw)
        res = _compute_cumulative_final_quarter(sw, quarter=1)
        student["quarter1_total"] = res.get("combined_total")
        student["quarter2_total"] = None
        student["performance_level_q1"] = res.get("performance_level", "no_data")
        student["performance_level_q2"] = "no_data"
        student["performance_level"] = res.get("performance_level", "no_data")
        val = res.get("combined_total")
        student["semester_total"] = round(float(val), 2) if val is not None else None
        student["total_score_normalized"] = round(float(val), 2) if val is not None else None
        student["quiz1"] = effective.get("quiz1")
        student["quiz2"] = effective.get("quiz2")
        student["chapter_test1"] = effective.get("chapter_test1_practical")
        student["quiz3"] = None
        student["quiz4"] = None
        student["chapter_test2"] = None
    label_map = {"on_level": "On Level", "approach": "Approach", "below": "Below", "no_data": "No Data"}
    student["performance_label"] = label_map.get(student["performance_level"], "No Data")


def parse_class_name(name: str) -> Dict[str, Optional[Any]]:
    match = re.search(r"(\d+)\s*([A-Za-z])", name.strip())
    grade = int(match.group(1)) if match else None
    section = match.group(2).upper() if match else None
    return {"grade": grade, "section": section}


def _class_sort_key(class_name: str) -> tuple:
    """Sort key for class names: (grade, section) so 6A before 6B, 7A before 7B."""
    parsed = parse_class_name(class_name)
    grade = parsed.get("grade") if parsed.get("grade") is not None else 999
    section = parsed.get("section") or "Z"
    return (grade, section)


def enrich_student(student: Dict[str, Any]) -> Dict[str, Any]:
    performance = compute_performance(
        {
            "attendance": student.get("attendance"),
            "participation": student.get("participation"),
            "behavior": student.get("behavior"),
            "homework": student.get("homework"),
            "quiz1": student.get("quiz1"),
            "quiz2": student.get("quiz2"),
            "quiz3": student.get("quiz3"),
            "quiz4": student.get("quiz4"),
            "chapter_test1": student.get("chapter_test1"),
            "chapter_test2": student.get("chapter_test2"),
            "chapter_test1_practical": student.get("chapter_test1_practical"),
            "chapter_test2_practical": student.get("chapter_test2_practical"),
            "quarter1_practical": student.get("quarter1_practical"),
            "quarter1_theory": student.get("quarter1_theory"),
            "quarter2_practical": student.get("quarter2_practical"),
            "quarter2_theory": student.get("quarter2_theory"),
        }
    )
    return {**student, **performance}


def average(values: List[float]) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def default_schedule() -> Dict[str, List[str]]:
    days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
    return {day: [""] * 8 for day in days}


def normalize_schedule(schedule: Optional[Dict[str, List[str]]]) -> Dict[str, List[str]]:
    base = default_schedule()
    if not schedule:
        return base
    for day, periods in schedule.items():
        if day not in base:
            continue
        normalized = list(periods)[:8] + [""] * max(0, 8 - len(periods))
        base[day] = normalized
    return base


def create_distribution_chart(distribution: List[Dict[str, Any]]) -> io.BytesIO:
    labels = [item["level"].replace("_", " ").title() for item in distribution]
    sizes = [item["count"] for item in distribution]
    colors_map = {
        "on_level": "#10b981",
        "approach": "#f59e0b",
        "below": "#ef4444",
        "no_data": "#94a3b8",
    }
    chart_colors = [colors_map.get(item["level"], "#94a3b8") for item in distribution]
    if sum(sizes) == 0:
        sizes = [1 for _ in sizes]
    fig, ax = plt.subplots(figsize=(5.0, 3.8))
    wedges, _, _ = ax.pie(
        sizes,
        labels=None,  # use legend to avoid label overlaps on small segments
        colors=chart_colors,
        autopct=lambda pct: f"{pct:.0f}%" if pct >= 4 else "",
        startangle=90,
        counterclock=False,
        textprops={"fontsize": 9},
    )
    legend_labels = [f"{label}: {count}" for label, count in zip(labels, sizes)]
    ax.legend(
        wedges,
        legend_labels,
        title="Levels",
        loc="center left",
        bbox_to_anchor=(1.0, 0.5),
        frameon=False,
        fontsize=8,
        title_fontsize=9,
    )
    ax.axis("equal")
    buffer = io.BytesIO()
    plt.tight_layout()
    plt.savefig(buffer, format="png", dpi=150)
    plt.close(fig)
    buffer.seek(0)
    return buffer


def create_class_breakdown_chart(class_breakdown: List[Dict[str, Any]]) -> io.BytesIO:
    names = [item["class_name"] for item in class_breakdown]
    counts = [item["student_count"] for item in class_breakdown]
    fig, ax = plt.subplots(figsize=(5.4, 3.2))
    ax.bar(names, counts, color="#1e3a8a")
    ax.set_ylabel("Students")
    ax.set_xlabel("Class")
    ax.tick_params(axis="x", labelsize=8, rotation=20)
    ax.tick_params(axis="y", labelsize=8)
    plt.tight_layout()
    buffer = io.BytesIO()
    plt.savefig(buffer, format="png", dpi=150)
    plt.close(fig)
    buffer.seek(0)
    return buffer


def format_scope_label(scope: Any) -> str:
    if isinstance(scope, int):
        return f"Grade {scope}"
    return str(scope)


def generate_report_pdf(
    report: Dict[str, Any],
    scope: Any,
    insights: Optional[Dict[str, str]] = None,
) -> bytes:
    def _fmt(value: Any, suffix: str = "") -> str:
        if value is None or value == "":
            return "-"
        return f"{value}{suffix}"

    def _styled_table(data: List[List[Any]], col_widths: Optional[List[int]] = None, repeat_header: bool = True) -> Table:
        wrapped_rows: List[List[Any]] = []
        for row_idx, row in enumerate(data):
            wrapped_row: List[Any] = []
            for cell in row:
                if isinstance(cell, Paragraph):
                    wrapped_row.append(cell)
                    continue
                text = escape("" if cell is None else str(cell)).replace("\n", "<br/>")
                if row_idx == 0:
                    wrapped_row.append(Paragraph(text, table_header_style))
                else:
                    wrapped_row.append(Paragraph(text, table_body_style))
            wrapped_rows.append(wrapped_row)
        tbl = Table(wrapped_rows, colWidths=col_widths, repeatRows=1 if repeat_header else 0, hAlign="LEFT")
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 9),
                    ("FONTSIZE", (0, 1), (-1, -1), 8),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#9ca3af")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        return tbl

    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        name="ReportTitle",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        name="ReportSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#475569"),
        spaceAfter=10,
    )
    section_style = ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#0f766e"),
        spaceBefore=6,
        spaceAfter=6,
    )
    table_header_style = ParagraphStyle(
        name="TableHeaderCell",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        textColor=colors.whitesmoke,
        leading=10,
        wordWrap="CJK",
    )
    table_body_style = ParagraphStyle(
        name="TableBodyCell",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#111827"),
        leading=10,
        wordWrap="CJK",
    )

    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=28, rightMargin=28, topMargin=28, bottomMargin=28)
    elements: List[Any] = []
    scope_label = format_scope_label(scope)

    elements.append(Paragraph(f"{scope_label} Report", title_style))
    elements.append(
        Paragraph(
            f"Generated on {datetime.now(REPORT_TIMEZONE).strftime('%Y-%m-%d %H:%M')} | Professional Performance Summary",
            subtitle_style,
        )
    )

    q1 = report.get("quarter1") or {}
    q2 = report.get("quarter2") or {}
    summary_data = [
        ["Metric", "Value"],
        ["Scope", scope_label],
        ["Total Students", _fmt(report.get("total_students"))],
        ["Average Total Score", _fmt(report.get("avg_total_score"))],
        ["On Level (Both Quarters)", _fmt(report.get("exceeding_rate"), "%")],
        ["Quarter 1 On Level", _fmt(q1.get("on_level_rate"), "%")],
        ["Quarter 1 Avg Total", _fmt(q1.get("avg_total"))],
        ["Quarter 2 On Level", _fmt(q2.get("on_level_rate"), "%")],
        ["Quarter 2 Avg Total", _fmt(q2.get("avg_total"))],
    ]
    elements.append(_styled_table(summary_data, col_widths=[210, 320]))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Quarter Comparison", section_style))
    quarter_table_data = [
        ["Metric", "Quarter 1", "Quarter 2"],
        ["On Level %", _fmt(q1.get("on_level_rate"), "%"), _fmt(q2.get("on_level_rate"), "%")],
        ["Avg Quarter Total", _fmt(q1.get("avg_total")), _fmt(q2.get("avg_total"))],
        ["Students With Data", _fmt(q1.get("total_with_data")), _fmt(q2.get("total_with_data"))],
    ]
    elements.append(_styled_table(quarter_table_data, col_widths=[180, 175, 175]))
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Performance Distribution", section_style))
    distribution = report.get("distribution") or []
    dist_rows = [["Level", "Count"]]
    for item in distribution:
        dist_rows.append([str(item.get("level", "")).replace("_", " ").title(), _fmt(item.get("count"))])
    if len(dist_rows) == 1:
        dist_rows.append(["No Data", "0"])
    elements.append(_styled_table(dist_rows, col_widths=[260, 270]))
    elements.append(Spacer(1, 8))

    distribution_chart = create_distribution_chart(distribution)
    class_breakdown = report.get("class_breakdown", []) or []
    class_chart = create_class_breakdown_chart(class_breakdown)
    chart_table = Table(
        [[RLImage(distribution_chart, width=250, height=200), RLImage(class_chart, width=250, height=190)]],
        colWidths=[260, 270],
        hAlign="LEFT",
    )
    chart_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(chart_table)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Class Breakdown", section_style))
    class_table_data = [["Class", "Students"]]
    for item in class_breakdown:
        class_table_data.append([_fmt(item.get("class_name")), _fmt(item.get("student_count"))])
    if len(class_table_data) == 1:
        class_table_data.append(["-", "0"])
    elements.append(_styled_table(class_table_data, col_widths=[350, 180]))
    elements.append(PageBreak())

    top_performers = report.get("top_performers", []) or []
    elements.append(Paragraph("Top Performers", section_style))
    top_table_data = [["Student", "Class", "Q1", "Q2", "Total", "Strengths"]]
    for student in top_performers:
        strengths = ", ".join(student.get("strengths") or []) or "-"
        top_table_data.append(
            [
                _fmt(student.get("full_name")),
                _fmt(student.get("class_name")),
                _fmt(student.get("quarter1_total")),
                _fmt(student.get("quarter2_total")),
                _fmt(student.get("total_score_normalized")),
                strengths,
            ]
        )
    if len(top_table_data) == 1:
        top_table_data.append(["-", "-", "-", "-", "-", "-"])
    elements.append(_styled_table(top_table_data, col_widths=[130, 58, 38, 38, 45, 220]))
    elements.append(Spacer(1, 10))

    support_students = report.get("students_needing_support", []) or []
    elements.append(Paragraph("Students Needing Support", section_style))
    support_table_data = [["Student", "Class", "Q1", "Q2", "Performance", "Areas to Improve"]]
    for student in support_students:
        weak_areas = ", ".join(student.get("weak_areas") or []) or "-"
        support_table_data.append(
            [
                _fmt(student.get("full_name")),
                _fmt(student.get("class_name")),
                _fmt(student.get("quarter1_total")),
                _fmt(student.get("quarter2_total")),
                _fmt(student.get("performance_label") or student.get("performance_level")),
                weak_areas,
            ]
        )
    if len(support_table_data) == 1:
        support_table_data.append(["-", "-", "-", "-", "-", "-"])
    elements.append(_styled_table(support_table_data, col_widths=[130, 58, 38, 38, 65, 210]))

    insights = insights or {}
    insight_rows = [
        ["Insight", "Details"],
        ["Strengths", (insights.get("analysis_strengths") or "").strip() or "-"],
        ["Weaknesses", (insights.get("analysis_weaknesses") or "").strip() or "-"],
        ["Student Performance", (insights.get("analysis_performance") or "").strip() or "-"],
        ["Standout Data", (insights.get("analysis_standout_data") or "").strip() or "-"],
        ["Recommended Actions", (insights.get("analysis_actions") or "").strip() or "-"],
        ["Recommendations", (insights.get("analysis_recommendations") or "").strip() or "-"],
    ]
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("Key Insights", section_style))
    elements.append(_styled_table(insight_rows, col_widths=[130, 380], repeat_header=True))

    doc.build(elements)
    pdf_value = buffer.getvalue()
    buffer.close()
    return pdf_value


def generate_report_excel(report: Dict[str, Any], scope: Any) -> bytes:
    buffer = io.BytesIO()
    scope_label = format_scope_label(scope)
    summary_df = pd.DataFrame([
        {
            "Scope": scope_label,
            "Total Students": report.get("total_students", 0),
            "Avg Total Score": report.get("avg_total_score"),
            "Exceeding Rate": report.get("exceeding_rate"),
        }
    ])
    top_df = pd.DataFrame([
        {
            "Student": student.get("full_name"),
            "Class": student.get("class_name"),
            "Quarter 1": student.get("quarter1_total"),
            "Quarter 2": student.get("quarter2_total"),
            "Total Score": student.get("total_score_normalized"),
            "Strengths": ", ".join(student.get("strengths") or []),
        }
        for student in report.get("top_performers", [])
    ])
    support_df = pd.DataFrame([
        {
            "Student": student.get("full_name"),
            "Class": student.get("class_name"),
            "Quarter 1": student.get("quarter1_total"),
            "Quarter 2": student.get("quarter2_total"),
            "Performance": student.get("performance_label"),
            "Areas to Improve": ", ".join(student.get("weak_areas") or []),
        }
        for student in report.get("students_needing_support", [])
    ])
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        summary_df.to_excel(writer, sheet_name="Summary", index=False)
        top_df.to_excel(writer, sheet_name="Top Performers", index=False)
        support_df.to_excel(writer, sheet_name="Support List", index=False)
    buffer.seek(0)
    return buffer.getvalue()


def generate_class_summary_pdf(class_summary: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = [Paragraph("Class Summary Report (aligned with both quarters)", styles["Title"]), Spacer(1, 12)]
    table_data = [["Class", "Students", "Avg Total", "Q1 On Level %", "Q2 On Level %", "Need Support", "Top Performers"]]
    for item in class_summary:
        table_data.append([
            item.get("class_name"),
            item.get("student_count"),
            item.get("avg_total_score") or "-",
            f"{item.get('quarter1_on_level_rate', 0)}%",
            f"{item.get('quarter2_on_level_rate', 0)}%",
            item.get("students_needing_support_count", 0),
            item.get("top_performers_count", 0),
        ])
    table = Table(table_data, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(table)
    doc.build(elements)
    pdf_value = buffer.getvalue()
    buffer.close()
    return pdf_value


def generate_class_summary_excel(class_summary: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    class_df = pd.DataFrame([
        {
            "Class": item.get("class_name"),
            "Students": item.get("student_count"),
            "Avg Total": item.get("avg_total_score"),
            "Q1 On Level %": item.get("quarter1_on_level_rate", 0),
            "Q2 On Level %": item.get("quarter2_on_level_rate", 0),
            "Need Support": item.get("students_needing_support_count", 0),
            "Top Performers": item.get("top_performers_count", 0),
        }
        for item in class_summary
    ])
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        class_df.to_excel(writer, sheet_name="Class Summary", index=False)
    buffer.seek(0)
    return buffer.getvalue()


def generate_notifications_pdf(logs: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = [Paragraph("Notification Log", styles["Title"]), Spacer(1, 12)]
    table_data = [["Type", "Message", "Recipient", "Status", "Time"]]
    for log in logs:
        table_data.append([
            log.get("event_type"),
            log.get("message"),
            log.get("recipient"),
            log.get("status"),
            log.get("created_at"),
        ])
    table = Table(table_data, hAlign="LEFT", colWidths=[70, 200, 90, 60, 80])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(table)
    doc.build(elements)
    pdf_value = buffer.getvalue()
    buffer.close()
    return pdf_value


def generate_notifications_excel(logs: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    df = pd.DataFrame([
        {
            "Type": log.get("event_type"),
            "Message": log.get("message"),
            "Recipient": log.get("recipient"),
            "Status": log.get("status"),
            "Time": log.get("created_at"),
        }
        for log in logs
    ])
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Notifications", index=False)
    buffer.seek(0)
    return buffer.getvalue()


def get_sender_identity() -> SGEmail:
    sender_email = os.environ.get("SENDER_EMAIL", "")
    sender_name = os.environ.get("SENDER_NAME")
    if sender_name:
        return SGEmail(sender_email, sender_name)
    return SGEmail(sender_email)


def send_report_email(recipients: List[str], report_pdf: bytes, report_excel: bytes, grade: int):
    api_key = os.environ.get("SENDGRID_API_KEY")
    if not api_key:
        raise RuntimeError("SENDGRID_API_KEY not configured")
    sender = get_sender_identity()
    subject = f"Weekly Grade {grade} Performance Report"
    html_content = "<p>Your weekly grade report is attached (PDF and Excel).</p>"
    message = Mail(
        from_email=sender,
        to_emails=recipients,
        subject=subject,
        html_content=html_content,
    )
    attachments = [
        Attachment(
            FileContent(base64.b64encode(report_pdf).decode()),
            FileName(f"grade_{grade}_report.pdf"),
            FileType("application/pdf"),
            Disposition("attachment"),
        ),
        Attachment(
            FileContent(base64.b64encode(report_excel).decode()),
            FileName(f"grade_{grade}_report.xlsx"),
            FileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Disposition("attachment"),
        ),
    ]
    message.attachment = attachments
    sg = SendGridAPIClient(api_key)
    sg.send(message)


async def get_admin_name() -> str:
    admin = await db.users.find_one({"role_name": "Admin"}, {"_id": 0})
    return admin.get("name", "Administrator") if admin else "Administrator"


async def log_audit(action: str, target_user: Dict[str, Any]):
    editor_name = await get_admin_name()
    log = AuditLogRecord(
        target_user_id=target_user.get("id"),
        target_user_name=target_user.get("name"),
        action=action,
        editor_name=editor_name,
    )
    await db.audit_logs.insert_one(log.model_dump())


def normalize_phone_number(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    value = phone.strip()
    if value.startswith("+9660"):
        return "+966" + value[5:]
    if value.startswith("0") and len(value) == 10:
        return "+966" + value[1:]
    if value.startswith("00"):
        return "+" + value[2:]
    return value


DEFAULT_SMS_TEMPLATES = {
    "calendar_sync": {
        "ar": "تم تحديث التقويم الدراسي. عدد الأحداث: {count} بتاريخ {date}.",
        "en": "Academic calendar synced. Events: {count} on {date}.",
    },
    "promotion": {
        "ar": "تمت ترقية {count} طالبًا إلى {class_name}.",
        "en": "{count} students promoted to {class_name}.",
    },
    "student_transfer": {
        "ar": "تم نقل الطالب {student_name} إلى {class_name}.",
        "en": "Student {student_name} transferred to {class_name}.",
    },
    "student_delete": {
        "ar": "تم حذف الطالب {student_name} من {class_name}.",
        "en": "Student {student_name} deleted from {class_name}.",
    },
}


def render_sms_template(template: str, variables: Dict[str, Any]) -> str:
    text = template
    for key, value in variables.items():
        text = text.replace("{" + key + "}", str(value))
    return text


async def get_sms_templates() -> Dict[str, Dict[str, str]]:
    settings = await db.app_settings.find_one({"id": "sms_templates"}, {"_id": 0})
    if not settings:
        settings = {"id": "sms_templates", "templates": DEFAULT_SMS_TEMPLATES, "updated_at": iso_now()}
        await db.app_settings.insert_one(settings)
    return settings.get("templates", DEFAULT_SMS_TEMPLATES)


async def log_notification(event_type: str, message: str, recipient: str, status: str):
    log = NotificationLogRecord(
        event_type=event_type,
        message=message,
        recipient=recipient or "",
        status=status,
    )
    await db.notification_logs.insert_one(log.model_dump())


async def send_sms_notification(event_type: str, variables: Dict[str, Any]):
    templates = await get_sms_templates()
    template_set = templates.get(event_type, {})
    message_ar = render_sms_template(template_set.get("ar", ""), variables)
    message_en = render_sms_template(template_set.get("en", ""), variables)
    message = " | ".join([text for text in [message_ar, message_en] if text])
    if not message:
        message = f"Notification: {event_type}"
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = normalize_phone_number(os.environ.get("TWILIO_PHONE_NUMBER"))
    admin = await db.users.find_one({"role_name": "Admin"}, {"_id": 0})
    to_number = normalize_phone_number(admin.get("phone") if admin else None) or normalize_phone_number(
        os.environ.get("ADMIN_SMS_NUMBER")
    )
    if not sid or not token or not from_number or not to_number:
        logger.warning("SMS notification skipped: missing Twilio configuration")
        await log_notification(event_type, message, to_number or "", "skipped")
        return
    try:
        client = TwilioClient(sid, token)
        client.messages.create(body=message, from_=from_number, to=to_number)
        await log_notification(event_type, message, to_number, "sent")
    except Exception as exc:
        logger.error("SMS send failed: %s", exc)
        await log_notification(event_type, message, to_number or "", "failed")


def build_anjal_academic_calendar() -> List[Dict[str, Any]]:
    """Returns Al Anjal National School academic calendar for 1447H (2025-2026)."""
    SOURCE = "anjal-academic-calendar-1447H"
    raw_events = [
        # --- Preparation Week ---
        ("أسبوع التهيئة / Preparation Week",              "2025-08-17T00:00:00+00:00"),
        ("استقبال الروضة / KG Reception",                  "2025-08-19T00:00:00+00:00"),
        ("استقبال المرحلة الابتدائية / Primary Reception", "2025-08-20T00:00:00+00:00"),
        ("استقبال المرحلة المتوسطة والثانوية / Middle & Secondary Reception", "2025-08-21T00:00:00+00:00"),
        # --- First Semester ---
        ("بداية الفصل الدراسي الأول / First Semester Starts",   "2025-08-24T00:00:00+00:00"),
        ("إجازة اليوم الوطني / National Day Holiday",            "2025-09-23T00:00:00+00:00"),
        ("إجازة إضافية / Additional Holiday",                    "2025-10-12T00:00:00+00:00"),
        ("بداية إجازة الخريف / Autumn Break Starts",             "2025-11-23T00:00:00+00:00"),
        ("نهاية إجازة الخريف / Autumn Break Ends",               "2025-11-30T00:00:00+00:00"),
        ("إجازة إضافية (الخميس) / Additional Holiday (Thu)",     "2025-12-11T00:00:00+00:00"),
        ("إجازة إضافية (الأحد) / Additional Holiday (Sun)",      "2025-12-14T00:00:00+00:00"),
        ("نهاية الفصل الدراسي الأول / First Semester Ends",      "2026-01-08T00:00:00+00:00"),
        # --- Second Semester ---
        ("بداية الفصل الدراسي الثاني / Second Semester Starts",  "2026-01-18T00:00:00+00:00"),
        ("إجازة يوم التأسيس / Foundation Day Holiday",           "2026-02-22T00:00:00+00:00"),
        ("بداية إجازة عيد الفطر / Eid Al-Fitr Break Starts",    "2026-03-05T00:00:00+00:00"),
        ("العودة بعد إجازة عيد الفطر / Return from Eid Al-Fitr", "2026-03-29T00:00:00+00:00"),
        ("بداية إجازة عيد الأضحى / Eid Al-Adha Break Starts",   "2026-05-21T00:00:00+00:00"),
        ("العودة بعد إجازة عيد الأضحى / Return from Eid Al-Adha","2026-06-02T00:00:00+00:00"),
        ("نهاية العام الدراسي للطلاب / Academic Year Ends",      "2026-06-25T00:00:00+00:00"),
    ]
    events = [
        CalendarEventRecord(title=title, date=date, details={"source": SOURCE})
        for title, date in raw_events
    ]
    return [event.model_dump() for event in events]


async def sync_moe_calendar() -> int:
    events = build_anjal_academic_calendar()
    source_value = "anjal-academic-calendar-1447H"

    await db.calendar_events.delete_many({})
    if events:
        await db.calendar_events.insert_many(events)
    await db.app_settings.update_one(
        {"id": "calendar_sync"},
        {"$set": {"id": "calendar_sync", "synced_at": iso_now(), "source": source_value}},
        upsert=True,
    )
    return len(events)


class ClassBase(BaseModel):
    name: str
    grade: Optional[int] = None
    section: Optional[str] = None
    notes: Optional[str] = None


class ClassRecord(ClassBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=iso_now)
    updated_at: str = Field(default_factory=iso_now)


class ClassUpdate(BaseModel):
    name: Optional[str] = None
    grade: Optional[int] = None
    section: Optional[str] = None
    notes: Optional[str] = None


class StudentBase(BaseModel):
    full_name: str
    class_id: str
    class_name: str
    attendance: Optional[float] = None
    participation: Optional[float] = None
    behavior: Optional[float] = None
    homework: Optional[float] = None
    quiz1: Optional[float] = None
    quiz2: Optional[float] = None
    chapter_test1: Optional[float] = None
    chapter_test2: Optional[float] = None
    quiz3: Optional[float] = None
    quiz4: Optional[float] = None
    chapter_test1_practical: Optional[float] = None
    chapter_test2_practical: Optional[float] = None
    quarter1_practical: Optional[float] = None
    quarter1_theory: Optional[float] = None
    quarter2_practical: Optional[float] = None
    quarter2_theory: Optional[float] = None


class StudentRecord(StudentBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=iso_now)
    updated_at: str = Field(default_factory=iso_now)


class StudentCreate(BaseModel):
    full_name: str
    class_id: str
    attendance: Optional[float] = None
    participation: Optional[float] = None
    behavior: Optional[float] = None
    homework: Optional[float] = None
    quiz1: Optional[float] = None
    quiz2: Optional[float] = None
    chapter_test1: Optional[float] = None
    chapter_test2: Optional[float] = None
    quiz3: Optional[float] = None
    quiz4: Optional[float] = None
    chapter_test1_practical: Optional[float] = None
    chapter_test2_practical: Optional[float] = None
    quarter1_practical: Optional[float] = None
    quarter1_theory: Optional[float] = None
    quarter2_practical: Optional[float] = None
    quarter2_theory: Optional[float] = None
    week_id: Optional[str] = None


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    class_id: Optional[str] = None
    attendance: Optional[float] = None
    participation: Optional[float] = None
    behavior: Optional[float] = None
    homework: Optional[float] = None
    quiz1: Optional[float] = None
    quiz2: Optional[float] = None
    chapter_test1: Optional[float] = None
    chapter_test2: Optional[float] = None
    quiz3: Optional[float] = None
    quiz4: Optional[float] = None
    chapter_test1_practical: Optional[float] = None
    chapter_test2_practical: Optional[float] = None
    quarter1_practical: Optional[float] = None
    quarter1_theory: Optional[float] = None
    quarter2_practical: Optional[float] = None
    quarter2_theory: Optional[float] = None
    week_id: Optional[str] = None


class StudentTransferRequest(BaseModel):
    class_id: str


class PromotionRequest(BaseModel):
    from_class_id: str
    to_class_id: str


class WeekRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    semester: int  # 1 or 2
    quarter: int = 1  # 1 or 2 — full separation: S1Q1, S1Q2, S2Q1, S2Q2
    number: int
    label: str
    created_at: str = Field(default_factory=iso_now)


class WeekCreate(BaseModel):
    label: Optional[str] = None
    semester: int = 1
    quarter: int = 1  # 1 or 2


class StudentScoreRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    week_id: str
    attendance: Optional[float] = None
    participation: Optional[float] = None
    behavior: Optional[float] = None
    homework: Optional[float] = None
    quiz1: Optional[float] = None
    quiz2: Optional[float] = None
    quiz3: Optional[float] = None
    quiz4: Optional[float] = None
    chapter_test1_practical: Optional[float] = None
    chapter_test2_practical: Optional[float] = None
    quarter1_practical: Optional[float] = None
    quarter1_theory: Optional[float] = None
    quarter2_practical: Optional[float] = None
    quarter2_theory: Optional[float] = None
    updated_at: str = Field(default_factory=iso_now)


class BulkScoreUpdate(BaseModel):
    id: str
    attendance: Optional[float] = None
    participation: Optional[float] = None
    behavior: Optional[float] = None
    homework: Optional[float] = None
    quiz1: Optional[float] = None
    quiz2: Optional[float] = None
    quiz3: Optional[float] = None
    quiz4: Optional[float] = None
    chapter_test1_practical: Optional[float] = None
    chapter_test2_practical: Optional[float] = None
    quarter1_practical: Optional[float] = None
    quarter1_theory: Optional[float] = None
    quarter2_practical: Optional[float] = None
    quarter2_theory: Optional[float] = None


class BulkScoresPayload(BaseModel):
    updates: List[BulkScoreUpdate]
    week_id: Optional[str] = None


class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    permissions: List[str] = []


class RoleRecord(RoleBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=iso_now)
    updated_at: str = Field(default_factory=iso_now)


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None


class UserBase(BaseModel):
    name: str
    email: str
    username: Optional[str] = None
    role_id: str
    role_name: str
    active: bool = True
    avatar_base64: Optional[str] = None
    phone: Optional[str] = None
    subjects: List[str] = []
    assigned_class_ids: List[str] = []
    permissions: List[str] = []
    schedule: Dict[str, List[str]] = Field(default_factory=default_schedule)


class UserRecord(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=iso_now)
    updated_at: str = Field(default_factory=iso_now)
    password_hash: Optional[str] = Field(default=None, exclude=True)


class UserCreate(BaseModel):
    name: str
    email: str
    username: str
    password: str
    role_id: str
    active: Optional[bool] = True
    avatar_base64: Optional[str] = None
    phone: Optional[str] = None
    subjects: List[str] = []
    assigned_class_ids: List[str] = []
    permissions: Optional[List[str]] = None
    schedule: Optional[Dict[str, List[str]]] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role_id: Optional[str] = None
    active: Optional[bool] = None
    avatar_base64: Optional[str] = None
    phone: Optional[str] = None
    subjects: Optional[List[str]] = None
    assigned_class_ids: Optional[List[str]] = None
    permissions: Optional[List[str]] = None
    schedule: Optional[Dict[str, List[str]]] = None


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    avatar_base64: Optional[str] = None
    phone: Optional[str] = None
    subjects: Optional[List[str]] = None
    assigned_class_ids: Optional[List[str]] = None
    schedule: Optional[Dict[str, List[str]]] = None


class TeacherProfileUpdate(BaseModel):
    phone: Optional[str] = None
    subjects: Optional[List[str]] = None
    assigned_class_ids: Optional[List[str]] = None
    schedule: Optional[Dict[str, List[str]]] = None
    avatar_base64: Optional[str] = None


class AuthLogin(BaseModel):
    username: str
    password: str


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ResetAllPasswordsPayload(BaseModel):
    secret: str
    new_password: str = "BabaMama1"


class SmsTemplatesPayload(BaseModel):
    templates: Dict[str, Dict[str, str]]


class PasswordUpdate(BaseModel):
    password: str


class PlanStep(BaseModel):
    title: str
    owner_role: Optional[str] = None
    due_date: Optional[str] = None
    completed: bool = False


class RemedialPlanBase(BaseModel):
    student_id: str
    student_name: str
    class_name: str
    focus_areas: List[str] = []
    strategies: List[str] = []
    status: str = "active"
    steps: List[PlanStep] = []


class RemedialPlanRecord(RemedialPlanBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=iso_now)
    updated_at: str = Field(default_factory=iso_now)


class RemedialPlanUpdate(BaseModel):
    focus_areas: Optional[List[str]] = None
    strategies: Optional[List[str]] = None
    status: Optional[str] = None
    steps: Optional[List[PlanStep]] = None


class RewardPlanBase(BaseModel):
    student_id: str
    student_name: str
    class_name: str
    title: str
    criteria: Optional[str] = None
    status: str = "proposed"
    steps: List[PlanStep] = []


class RewardPlanRecord(RewardPlanBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=iso_now)
    updated_at: str = Field(default_factory=iso_now)


class RewardPlanUpdate(BaseModel):
    title: Optional[str] = None
    criteria: Optional[str] = None
    status: Optional[str] = None
    steps: Optional[List[PlanStep]] = None


class ReportSettings(BaseModel):
    grade: int = 4
    report_type: str = "full"


class AuditLogRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    target_user_id: str
    target_user_name: str
    action: str
    editor_name: str
    timestamp: str = Field(default_factory=iso_now)


class CalendarEventRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    date: str
    details: Dict[str, Any] = {}


class NotificationLogRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    message: str
    recipient: str
    status: str
    created_at: str = Field(default_factory=iso_now)


@api_router.get("/")
async def root():
    return {"message": "EduTrack API is running"}


def _teacher_class_filter(current_user: Dict[str, Any]) -> Dict[str, Any]:
    """Return MongoDB query to restrict classes for teachers to assigned_class_ids only."""
    role = (current_user.get("role_name") or "").strip().lower()
    if role != "teacher":
        return {}
    assigned = current_user.get("assigned_class_ids")
    if not isinstance(assigned, list):
        assigned = list(assigned) if assigned else []
    return {"id": {"$in": assigned}} if assigned else {"id": {"$in": []}}


@api_router.get("/classes", response_model=List[ClassRecord])
async def get_classes(current_user: Dict[str, Any] = Depends(get_current_user)):
    query = _teacher_class_filter(current_user)
    classes = await db.classes.find(query, {"_id": 0}).sort("grade", 1).to_list(200)
    return classes


@api_router.post("/classes", response_model=ClassRecord)
async def create_class(payload: ClassBase):
    data = payload.model_dump()
    if not data.get("grade") or not data.get("section"):
        parsed = parse_class_name(payload.name)
        data["grade"] = data.get("grade") or parsed.get("grade")
        data["section"] = data.get("section") or parsed.get("section")
    class_record = ClassRecord(**data)
    await db.classes.insert_one(class_record.model_dump())
    return class_record


@api_router.put("/classes/{class_id}", response_model=ClassRecord)
async def update_class(class_id: str, payload: ClassUpdate):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "name" in update_data and ("grade" not in update_data or "section" not in update_data):
        parsed = parse_class_name(update_data["name"])
        update_data.setdefault("grade", parsed.get("grade"))
        update_data.setdefault("section", parsed.get("section"))
    update_data["updated_at"] = iso_now()
    result = await db.classes.find_one_and_update({"id": class_id}, {"$set": update_data}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="Class not found")
    result.pop("_id", None)
    return result


@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str):
    class_doc = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    students = await db.students.find({"class_id": class_id}, {"_id": 0, "id": 1}).to_list(5000)
    student_ids = [student["id"] for student in students]
    if student_ids:
        await db.student_scores.delete_many({"student_id": {"$in": student_ids}})
    await db.students.delete_many({"class_id": class_id})
    await db.users.update_many({}, {"$pull": {"assigned_class_ids": class_id}})
    await db.classes.delete_one({"id": class_id})
    return {"status": "deleted"}


@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str):
    class_doc = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    students = await db.students.find({"class_id": class_id}, {"_id": 0, "id": 1}).to_list(5000)
    student_ids = [student["id"] for student in students]
    if student_ids:
        await db.student_scores.delete_many({"student_id": {"$in": student_ids}})
    await db.students.delete_many({"class_id": class_id})
    await db.users.update_many({}, {"$pull": {"assigned_class_ids": class_id}})
    await db.classes.delete_one({"id": class_id})
    return {"status": "deleted"}


@api_router.get("/weeks", response_model=List[WeekRecord])
async def list_weeks(
    semester: Optional[int] = Query(default=None),
    quarter: Optional[int] = Query(default=None, description="1 = weeks 1-9, 2 = weeks 10-18 (per semester)"),
):
    """Return weeks for the given semester and quarter only. Full separation: S1Q1, S1Q2, S2Q1, S2Q2 each have their own weeks. Never returns weeks from another quarter."""
    # When semester is set, always filter by quarter (default 1). Avoid ever returning "all weeks" for a semester.
    sem = semester if semester is not None else 1
    q = quarter if quarter in (1, 2) else 1
    if semester is not None:
        query = {"semester": sem, "quarter": q}
        all_weeks = await db.weeks.find(query, {"_id": 0}).sort("number", 1).to_list(200)
        for w in all_weeks:
            if "quarter" not in w or w["quarter"] not in (1, 2):
                w["quarter"] = 1 if w.get("number", 1) <= 9 else 2
        return all_weeks
    # No semester: return all weeks (e.g. admin tools) with quarter backfilled
    all_weeks = await db.weeks.find({"semester": {"$in": [1, 2]}}, {"_id": 0}).sort([("semester", 1), ("number", 1)]).to_list(200)
    for w in all_weeks:
        if "quarter" not in w or w["quarter"] not in (1, 2):
            w["quarter"] = 1 if w.get("number", 1) <= 9 else 2
    return all_weeks


@api_router.post("/weeks", response_model=WeekRecord)
async def create_week(payload: WeekCreate):
    """Create week in (semester, quarter). Q1 = numbers 1-9, Q2 = numbers 10-18; each (semester, quarter) is independent."""
    q = payload.quarter if payload.quarter in (1, 2) else 1
    query = {"semester": payload.semester, "quarter": q}
    last_week = await db.weeks.find(query, {"_id": 0}).sort("number", -1).to_list(1)
    if q == 1:
        next_number = (last_week[0]["number"] + 1) if last_week else 1
        next_number = min(max(next_number, 1), 9)
    else:
        next_number = (last_week[0]["number"] + 1) if last_week and last_week[0].get("number", 0) >= 10 else 10
        next_number = min(max(next_number, 10), 18)
    label = payload.label or f"Week {next_number}"
    week = WeekRecord(semester=payload.semester, quarter=q, number=next_number, label=label)
    await db.weeks.insert_one(week.model_dump())
    return week


@api_router.delete("/weeks/{week_id}")
async def delete_week(
    week_id: str,
    semester: Optional[int] = Query(default=None),
    quarter: Optional[int] = Query(default=None),
):
    """Delete a week only if it belongs to the given (semester, quarter). Prevents deleting a week from another quarter."""
    week_doc = await db.weeks.find_one({"id": week_id}, {"_id": 0, "semester": 1, "quarter": 1, "number": 1})
    if not week_doc:
        raise HTTPException(status_code=404, detail="Week not found")
    if semester is not None and quarter is not None:
        doc_quarter = week_doc.get("quarter")
        if doc_quarter not in (1, 2):
            doc_quarter = 1 if (week_doc.get("number", 1) <= 9) else 2
        if week_doc.get("semester") != semester or doc_quarter != quarter:
            raise HTTPException(
                status_code=403,
                detail="Week does not belong to the selected semester/quarter. Deletion refused to keep quarters separate.",
            )
    await db.weeks.delete_one({"id": week_id})
    await db.student_scores.delete_many({"week_id": week_id})
    return {"status": "deleted"}


@api_router.delete("/classes/{class_id}/quarter-scores")
async def clear_class_quarter_scores(
    class_id: str,
    semester: int = Query(..., ge=1, le=2),
    quarter: int = Query(..., ge=1, le=2),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Clear all score records for this class for the given (semester, quarter) only. Use when a class has stale/wrong data and should show 'No Data' for that quarter."""
    class_doc = await db.classes.find_one({"id": class_id}, {"_id": 0})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    if current_user.get("role_name") == "Teacher":
        assigned = current_user.get("assigned_class_ids", [])
        if assigned and class_id not in assigned:
            raise HTTPException(status_code=403, detail="Not allowed to clear scores for this class")
    query = {"semester": semester, "quarter": quarter}
    quarter_weeks = await db.weeks.find(query, {"_id": 0, "id": 1}).to_list(200)
    if not quarter_weeks:
        all_sem = await db.weeks.find({"semester": semester}, {"_id": 0, "id": 1, "number": 1, "quarter": 1}).to_list(200)
        quarter_weeks = [w for w in all_sem if _week_quarter(w) == quarter]
    week_ids = [w["id"] for w in quarter_weeks]
    students = await db.students.find({"class_id": class_id}, {"_id": 0, "id": 1}).to_list(5000)
    student_ids = [s["id"] for s in students]
    if not student_ids:
        return {"status": "cleared", "deleted": 0, "message": "No students in class"}
    if not week_ids:
        return {"status": "cleared", "deleted": 0, "message": "No weeks for this semester/quarter"}
    result = await db.student_scores.delete_many(
        {"student_id": {"$in": student_ids}, "week_id": {"$in": week_ids}}
    )
    return {"status": "cleared", "deleted": result.deleted_count}


@api_router.get("/students")
async def get_students(
    class_id: Optional[str] = Query(default=None),
    week_id: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if current_user.get("role_name") == "Teacher":
        assigned = current_user.get("assigned_class_ids", [])
        if class_id and class_id not in assigned:
            return []
        query["class_id"] = {"$in": assigned} if assigned else {"$in": []}
    if class_id:
        query["class_id"] = class_id
    students = await db.students.find(query, {"_id": 0}).sort("full_name", 1).to_list(5000)
    if week_id and students:
        student_ids = [student["id"] for student in students]
        scores = await db.student_scores.find(
            {"week_id": week_id, "student_id": {"$in": student_ids}}, {"_id": 0}
        ).to_list(5000)
        score_map = {score["student_id"]: score for score in scores}
        score_fields = [
            "attendance", "participation", "behavior", "homework",
            "quiz1", "quiz2", "quiz3", "quiz4",
            "chapter_test1_practical", "chapter_test2_practical",
            "quarter1_practical", "quarter1_theory", "quarter2_practical", "quarter2_theory",
            "chapter_test1", "chapter_test2",
        ]
        for student in students:
            for key in score_fields:
                student.pop(key, None)
            score = score_map.get(student["id"])
            if score:
                student["attendance"] = score.get("attendance")
                student["participation"] = score.get("participation")
                student["behavior"] = score.get("behavior")
                student["homework"] = score.get("homework")
                student["quiz1"] = score.get("quiz1")
                student["quiz2"] = score.get("quiz2")
                student["quiz3"] = score.get("quiz3")
                student["quiz4"] = score.get("quiz4")
                student["chapter_test1_practical"] = score.get("chapter_test1_practical")
                student["chapter_test2_practical"] = score.get("chapter_test2_practical")
                student["quarter1_practical"] = score.get("quarter1_practical")
                student["quarter1_theory"] = score.get("quarter1_theory")
                student["quarter2_practical"] = score.get("quarter2_practical")
                student["quarter2_theory"] = score.get("quarter2_theory")
        week_doc = await db.weeks.find_one({"id": week_id}, {"_id": 0})
        if week_doc:
            sem = week_doc.get("semester", 1)
            q = _week_quarter(week_doc)
            # Only load scores for this (semester, quarter) — full separation S1Q1, S1Q2, S2Q1, S2Q2
            scores_by_student = await build_quarter_score_map(student_ids, sem, q)
            for student in students:
                sw = scores_by_student.get(student["id"], {})
                totals = compute_quarter_totals(sw)
                student.update(totals)
                avg_9 = compute_avg_first_9_weeks(sw)
                avg_10_18 = compute_avg_weeks_10_18(sw)
                student["avg_first_9_weeks"] = avg_9
                student["avg_weeks_10_18"] = avg_10_18
                students_total_q1 = compute_students_total_for_assessment(sw, avg_first_9_weeks=avg_9, weeks_10_18=False)
                students_total_q2 = compute_students_total_for_assessment(sw, weeks_10_18=True)
                scores_dict = {
                    "attendance": student.get("attendance"),
                    "participation": student.get("participation"),
                    "behavior": student.get("behavior"),
                    "homework": student.get("homework"),
                    "quiz1": student.get("quiz1"),
                    "quiz2": student.get("quiz2"),
                    "quiz3": student.get("quiz3"),
                    "quiz4": student.get("quiz4"),
                    "chapter_test1_practical": student.get("chapter_test1_practical"),
                    "chapter_test2_practical": student.get("chapter_test2_practical"),
                    "quarter1_practical": student.get("quarter1_practical"),
                    "quarter1_theory": student.get("quarter1_theory"),
                    "quarter2_practical": student.get("quarter2_practical"),
                    "quarter2_theory": student.get("quarter2_theory"),
                }
                if q == 1:
                    res_q1 = compute_assessment_combined(
                        scores_dict, avg_first_9_weeks=avg_9, students_total_override=students_total_q1
                    )
                    student["assessment_combined_total"] = res_q1.get("combined_total")
                    student["assessment_performance_level"] = res_q1.get("performance_level")
                    student["assessment_performance_label"] = res_q1.get("performance_label")
                    student["assessment_q2_combined_total"] = None
                    student["assessment_q2_performance_level"] = None
                    student["assessment_q2_performance_label"] = None
                    effective_q1 = _effective_scores_q1(sw)
                    # Use current week's quarter exam values only (no fallback to week 9) so cleared scores show 15/50.
                    effective_q1_edit = {
                        **effective_q1,
                        "quarter1_practical": student.get("quarter1_practical"),
                        "quarter1_theory": student.get("quarter1_theory"),
                    }
                    res_final_q1 = compute_final_exams_combined(
                        effective_q1_edit, avg_first_9_weeks=avg_9, quarter=1, students_total_override=students_total_q1
                    )
                    student["final_exams_combined_total"] = res_final_q1.get("combined_total")
                    student["final_exams_performance_level"] = res_final_q1.get("performance_level")
                    student["final_exams_performance_label"] = res_final_q1.get("performance_label")
                    student["final_exams_q2_combined_total"] = None
                    student["final_exams_q2_performance_level"] = None
                    student["final_exams_q2_performance_label"] = None
                else:
                    student["assessment_combined_total"] = None
                    student["assessment_performance_level"] = None
                    student["assessment_performance_label"] = None
                    res_q2 = compute_assessment_combined_q2(
                        scores_dict, avg_weeks_10_18=avg_10_18, students_total_override=students_total_q2
                    )
                    student["assessment_q2_combined_total"] = res_q2.get("combined_total")
                    student["assessment_q2_performance_level"] = res_q2.get("performance_level")
                    student["assessment_q2_performance_label"] = res_q2.get("performance_label")
                    effective_q2 = _effective_scores_q2(sw)
                    # Use current week's quarter exam values only so cleared scores show 15/50.
                    effective_q2_edit = {
                        **effective_q2,
                        "quarter2_practical": student.get("quarter2_practical"),
                        "quarter2_theory": student.get("quarter2_theory"),
                    }
                    res_final_q2 = compute_final_exams_combined(
                        effective_q2_edit, avg_weeks_10_18=avg_10_18, quarter=2, students_total_override=students_total_q2
                    )
                    student["final_exams_combined_total"] = None
                    student["final_exams_performance_level"] = None
                    student["final_exams_performance_label"] = None
                    student["final_exams_q2_combined_total"] = res_final_q2.get("combined_total")
                    student["final_exams_q2_performance_level"] = res_final_q2.get("performance_level")
                    student["final_exams_q2_performance_label"] = res_final_q2.get("performance_label")
    return [enrich_student(student) for student in students]


@api_router.post("/students")
async def create_student(payload: StudentCreate):
    class_doc = await db.classes.find_one({"id": payload.class_id}, {"_id": 0})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    student_data = payload.model_dump()
    week_id = student_data.pop("week_id", None)
    student_data["class_name"] = class_doc["name"]
    for field in [
        "attendance",
        "participation",
        "behavior",
        "homework",
        "quiz1",
        "quiz2",
        "quiz3",
        "quiz4",
        "chapter_test1_practical",
        "chapter_test2_practical",
        "quarter1_practical",
        "quarter1_theory",
        "quarter2_practical",
        "quarter2_theory",
    ]:
        student_data[field] = normalize_score(student_data.get(field))
    if student_data.get("chapter_test1_practical") is not None:
        student_data["chapter_test1"] = student_data.get("chapter_test1_practical")
    if student_data.get("chapter_test2_practical") is not None:
        student_data["chapter_test2"] = student_data.get("chapter_test2_practical")
    student_record = StudentRecord(**student_data)
    await db.students.insert_one(student_record.model_dump())
    if week_id:
        score = StudentScoreRecord(
            student_id=student_record.id,
            week_id=week_id,
            attendance=student_record.attendance,
            participation=student_record.participation,
            behavior=student_record.behavior,
            homework=student_record.homework,
            quiz1=student_record.quiz1,
            quiz2=student_record.quiz2,
            quiz3=student_record.quiz3,
            quiz4=student_record.quiz4,
            chapter_test1_practical=student_record.chapter_test1_practical,
            chapter_test2_practical=student_record.chapter_test2_practical,
            quarter1_practical=student_record.quarter1_practical,
            quarter1_theory=student_record.quarter1_theory,
            quarter2_practical=student_record.quarter2_practical,
            quarter2_theory=student_record.quarter2_theory,
        )
        await db.student_scores.insert_one(score.model_dump())
    return enrich_student(student_record.model_dump())


@api_router.put("/students/{student_id}")
async def update_student(student_id: str, payload: StudentUpdate):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    week_id = update_data.pop("week_id", None)
    if "class_id" in update_data:
        class_doc = await db.classes.find_one({"id": update_data["class_id"]}, {"_id": 0})
        if not class_doc:
            raise HTTPException(status_code=404, detail="Class not found")
        update_data["class_name"] = class_doc["name"]
    for field in [
        "attendance",
        "participation",
        "behavior",
        "homework",
        "quiz1",
        "quiz2",
        "quiz3",
        "quiz4",
        "chapter_test1_practical",
        "chapter_test2_practical",
        "quarter1_practical",
        "quarter1_theory",
        "quarter2_practical",
        "quarter2_theory",
    ]:
        if field in update_data:
            update_data[field] = normalize_score(update_data[field])
    if "chapter_test1_practical" in update_data:
        update_data["chapter_test1"] = update_data.get("chapter_test1_practical")
    if "chapter_test2_practical" in update_data:
        update_data["chapter_test2"] = update_data.get("chapter_test2_practical")
    update_data["updated_at"] = iso_now()
    score_fields_put = {
        "attendance", "participation", "behavior", "homework",
        "quiz1", "quiz2", "quiz3", "quiz4",
        "chapter_test1_practical", "chapter_test2_practical",
        "quarter1_practical", "quarter1_theory", "quarter2_practical", "quarter2_theory",
        "chapter_test1", "chapter_test2",
    }
    if week_id:
        student_update = {k: v for k, v in update_data.items() if k not in score_fields_put}
        result = await db.students.find_one_and_update({"id": student_id}, {"$set": student_update}, return_document=True)
        if not result:
            raise HTTPException(status_code=404, detail="Student not found")
        await db.student_scores.update_one(
            {"student_id": student_id, "week_id": week_id},
            {
                "$set": {
                    "attendance": update_data.get("attendance"),
                    "participation": update_data.get("participation"),
                    "behavior": update_data.get("behavior"),
                    "homework": update_data.get("homework"),
                    "quiz1": update_data.get("quiz1"),
                    "quiz2": update_data.get("quiz2"),
                    "quiz3": update_data.get("quiz3"),
                    "quiz4": update_data.get("quiz4"),
                    "chapter_test1_practical": update_data.get("chapter_test1_practical"),
                    "chapter_test2_practical": update_data.get("chapter_test2_practical"),
                    "quarter1_practical": update_data.get("quarter1_practical"),
                    "quarter1_theory": update_data.get("quarter1_theory"),
                    "quarter2_practical": update_data.get("quarter2_practical"),
                    "quarter2_theory": update_data.get("quarter2_theory"),
                    "updated_at": iso_now(),
                }
            },
            upsert=True,
        )
        score_doc = await db.student_scores.find_one({"student_id": student_id, "week_id": week_id}, {"_id": 0})
        if score_doc:
            for key in list(score_doc.keys()):
                if key != "student_id" and key != "week_id":
                    result[key] = score_doc.get(key)
    else:
        result = await db.students.find_one_and_update({"id": student_id}, {"$set": update_data}, return_document=True)
        if not result:
            raise HTTPException(status_code=404, detail="Student not found")
    result.pop("_id", None)
    return enrich_student(result)


@api_router.post("/students/bulk-scores")
async def bulk_update_scores(payload: BulkScoresPayload):
    """Bulk update scores in one DB round-trip for speed (no per-student round-trips)."""
    score_field_names = {
        "attendance", "participation", "behavior", "homework",
        "quiz1", "quiz2", "quiz3", "quiz4",
        "chapter_test1_practical", "chapter_test2_practical",
        "quarter1_practical", "quarter1_theory", "quarter2_practical", "quarter2_theory",
        "updated_at",
    }
    operations = []
    for item in payload.updates:
        update_data = {
            k: normalize_score(v)
            for k, v in item.model_dump(exclude_unset=True).items()
            if k
            in {
                "attendance",
                "participation",
                "behavior",
                "homework",
                "quiz1",
                "quiz2",
                "quiz3",
                "quiz4",
                "chapter_test1_practical",
                "chapter_test2_practical",
                "quarter1_practical",
                "quarter1_theory",
                "quarter2_practical",
                "quarter2_theory",
            }
        }
        if not update_data:
            continue
        if "chapter_test1_practical" in update_data:
            update_data["chapter_test1"] = update_data.get("chapter_test1_practical")
        if "chapter_test2_practical" in update_data:
            update_data["chapter_test2"] = update_data.get("chapter_test2_practical")
        update_data["updated_at"] = iso_now()
        set_dict = {k: update_data[k] for k in score_field_names if k in update_data}
        if payload.week_id and set_dict:
            operations.append(
                UpdateOne(
                    {"student_id": item.id, "week_id": payload.week_id},
                    {"$set": set_dict},
                    upsert=True,
                )
            )
        else:
            operations.append(
                UpdateOne(
                    {"id": item.id},
                    {"$set": update_data},
                )
            )
    if not operations:
        return {"status": "updated", "updated": 0}
    collection = db.student_scores if payload.week_id else db.students
    result = await collection.bulk_write(operations)
    updated = (result.upserted_count or 0) + (result.modified_count or 0)
    return {"status": "updated", "updated": updated}


@api_router.get("/students/import-template")
async def download_import_template(
    week_id: Optional[str] = Query(default=None),
    class_id: Optional[str] = Query(default=None),
    view: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return an Excel template for the score sheet / student import.
    If view=assessment: columns match Assessment Marks page (Quiz 1, Quiz 2, Chapter Test 1 Practical, Total Score, Performance Level).
    If view=final_exams: columns match Final Exams + Assessment (1st Quarter Practical (10), 1st Quarter Theoretical (10), Total Score, Performance Level).
    Otherwise: Students page columns (Attendance, Participation, Behavior, Homework, Total Score, Performance Level).
    If class_id is provided, rows are pre-filled with student names and class; otherwise one empty row.
    """
    view_lower = (view or "").lower()
    assessment_view = view_lower == "assessment"
    assessment_q2_view = view_lower == "assessment_q2"
    final_exams_view = view_lower == "final_exams"
    final_exams_q2_view = view_lower == "final_exams_q2"
    if class_id:
        students = await get_students(class_id=class_id, week_id=week_id, current_user=current_user)
        if students:
            if assessment_view:
                template_rows = [
                    {
                        "Student Name": s.get("full_name"),
                        "Class": s.get("class_name"),
                        "Quiz 1 (5)": "",
                        "Quiz 2 (5)": "",
                        "Chapter Test 1 (Practical) (10)": "",
                        "Total Score": "",
                        "Performance Level": "",
                    }
                    for s in students
                ]
            elif assessment_q2_view:
                template_rows = [
                    {
                        "Student Name": s.get("full_name"),
                        "Class": s.get("class_name"),
                        "Quiz 3 (5)": "",
                        "Quiz 4 (5)": "",
                        "Chapter Test 2 (Practical) (10)": "",
                        "Total Score": "",
                        "Performance Level": "",
                    }
                    for s in students
                ]
            elif final_exams_view:
                template_rows = [
                    {
                        "Student Name": s.get("full_name"),
                        "Class": s.get("class_name"),
                        "1st Quarter Practical Exam (10)": "",
                        "1st Quarter Theoretical Exam (10)": "",
                        "Total Score": "",
                        "Performance Level": "",
                    }
                    for s in students
                ]
            elif final_exams_q2_view:
                template_rows = [
                    {
                        "Student Name": s.get("full_name"),
                        "Class": s.get("class_name"),
                        "2nd Quarter Practical Exam (10)": "",
                        "2nd Quarter Theoretical Exam (10)": "",
                        "Total Score": "",
                        "Performance Level": "",
                    }
                    for s in students
                ]
            else:
                template_rows = [
                    {
                        "Student Name": s.get("full_name"),
                        "Class": s.get("class_name"),
                        "Attendance (2.5)": "",
                        "Participation (2.5)": "",
                        "Behavior (5)": "",
                        "Homework (5)": "",
                        "Total Score": "",
                        "Performance Level": "",
                    }
                    for s in students
                ]
        else:
            if assessment_view:
                empty_row = {"Student Name": "", "Class": "", "Quiz 1 (5)": "", "Quiz 2 (5)": "", "Chapter Test 1 (Practical) (10)": "", "Total Score": "", "Performance Level": ""}
            elif assessment_q2_view:
                empty_row = {"Student Name": "", "Class": "", "Quiz 3 (5)": "", "Quiz 4 (5)": "", "Chapter Test 2 (Practical) (10)": "", "Total Score": "", "Performance Level": ""}
            elif final_exams_view:
                empty_row = {"Student Name": "", "Class": "", "1st Quarter Practical Exam (10)": "", "1st Quarter Theoretical Exam (10)": "", "Total Score": "", "Performance Level": ""}
            elif final_exams_q2_view:
                empty_row = {"Student Name": "", "Class": "", "2nd Quarter Practical Exam (10)": "", "2nd Quarter Theoretical Exam (10)": "", "Total Score": "", "Performance Level": ""}
            else:
                empty_row = {"Student Name": "", "Class": "", "Attendance (2.5)": "", "Participation (2.5)": "", "Behavior (5)": "", "Homework (5)": "", "Total Score": "", "Performance Level": ""}
            template_rows = [empty_row]
    else:
        if assessment_view:
            empty_row = {"Student Name": "", "Class": "", "Quiz 1 (5)": "", "Quiz 2 (5)": "", "Chapter Test 1 (Practical) (10)": "", "Total Score": "", "Performance Level": ""}
        elif assessment_q2_view:
            empty_row = {"Student Name": "", "Class": "", "Quiz 3 (5)": "", "Quiz 4 (5)": "", "Chapter Test 2 (Practical) (10)": "", "Total Score": "", "Performance Level": ""}
        elif final_exams_view:
            empty_row = {"Student Name": "", "Class": "", "1st Quarter Practical Exam (10)": "", "1st Quarter Theoretical Exam (10)": "", "Total Score": "", "Performance Level": ""}
        elif final_exams_q2_view:
            empty_row = {"Student Name": "", "Class": "", "2nd Quarter Practical Exam (10)": "", "2nd Quarter Theoretical Exam (10)": "", "Total Score": "", "Performance Level": ""}
        else:
            empty_row = {"Student Name": "", "Class": "", "Attendance (2.5)": "", "Participation (2.5)": "", "Behavior (5)": "", "Homework (5)": "", "Total Score": "", "Performance Level": ""}
        template_rows = [empty_row]
    df = pd.DataFrame(template_rows)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Score Sheet")
        sheet = writer.sheets["Score Sheet"]
        center_fmt = writer.book.add_format({"align": "center"})
        for col in range(len(df.columns)):
            sheet.set_column(col, col, 16, center_fmt)
    buffer.seek(0)
    headers = {"Content-Disposition": "attachment; filename=student_score_sheet_template.xlsx"}
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@api_router.get("/students/export")
async def export_students_marks(
    week_id: Optional[str] = Query(default=None),
    class_id: Optional[str] = Query(default=None),
    view: Optional[str] = Query(default=None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    students = await get_students(class_id=class_id, week_id=week_id, current_user=current_user)
    view_lower = (view or "").lower()
    assessment_view = view_lower == "assessment"
    assessment_q2_view = view_lower == "assessment_q2"
    final_exams_view = view_lower == "final_exams"
    final_exams_q2_view = view_lower == "final_exams_q2"
    export_rows = []
    for student in students:
        if assessment_view:
            combined = compute_assessment_combined(
                {
                    "attendance": student.get("attendance"),
                    "participation": student.get("participation"),
                    "behavior": student.get("behavior"),
                    "homework": student.get("homework"),
                    "quiz1": student.get("quiz1"),
                    "quiz2": student.get("quiz2"),
                    "chapter_test1_practical": student.get("chapter_test1_practical"),
                },
                avg_first_9_weeks=student.get("avg_first_9_weeks"),
            )
            total_display = f"{combined['combined_total']}/30" if combined.get("combined_total") is not None else ""
            export_rows.append(
                {
                    "Student Name": student.get("full_name"),
                    "Class": student.get("class_name"),
                    "Quiz 1 (5)": student.get("quiz1"),
                    "Quiz 2 (5)": student.get("quiz2"),
                    "Chapter Test 1 (Practical) (10)": student.get("chapter_test1_practical"),
                    "Total Score": total_display,
                    "Performance Level": combined.get("performance_label") or "No Data",
                }
            )
        elif assessment_q2_view:
            combined = compute_assessment_combined_q2(
                {
                    "attendance": student.get("attendance"),
                    "participation": student.get("participation"),
                    "behavior": student.get("behavior"),
                    "homework": student.get("homework"),
                    "quiz3": student.get("quiz3"),
                    "quiz4": student.get("quiz4"),
                    "chapter_test2_practical": student.get("chapter_test2_practical"),
                },
                avg_weeks_10_18=student.get("avg_weeks_10_18"),
            )
            total_display = f"{combined['combined_total']}/30" if combined.get("combined_total") is not None else ""
            export_rows.append(
                {
                    "Student Name": student.get("full_name"),
                    "Class": student.get("class_name"),
                    "Quiz 3 (5)": student.get("quiz3"),
                    "Quiz 4 (5)": student.get("quiz4"),
                    "Chapter Test 2 (Practical) (10)": student.get("chapter_test2_practical"),
                    "Total Score": total_display,
                    "Performance Level": combined.get("performance_label") or "No Data",
                }
            )
        elif final_exams_view:
            combined = compute_final_exams_combined(
                {
                    "attendance": student.get("attendance"),
                    "participation": student.get("participation"),
                    "behavior": student.get("behavior"),
                    "homework": student.get("homework"),
                    "quiz1": student.get("quiz1"),
                    "quiz2": student.get("quiz2"),
                    "chapter_test1_practical": student.get("chapter_test1_practical"),
                    "quarter1_practical": student.get("quarter1_practical"),
                    "quarter1_theory": student.get("quarter1_theory"),
                },
                avg_first_9_weeks=student.get("avg_first_9_weeks"),
            )
            total_display = f"{combined['combined_total']}/50" if combined.get("combined_total") is not None else ""
            export_rows.append(
                {
                    "Student Name": student.get("full_name"),
                    "Class": student.get("class_name"),
                    "1st Quarter Practical Exam (10)": student.get("quarter1_practical"),
                    "1st Quarter Theoretical Exam (10)": student.get("quarter1_theory"),
                    "Total Score": total_display,
                    "Performance Level": combined.get("performance_label") or "No Data",
                }
            )
        elif final_exams_q2_view:
            combined = compute_final_exams_combined(
                {
                    "attendance": student.get("attendance"),
                    "participation": student.get("participation"),
                    "behavior": student.get("behavior"),
                    "homework": student.get("homework"),
                    "quiz1": student.get("quiz1"),
                    "quiz2": student.get("quiz2"),
                    "chapter_test1_practical": student.get("chapter_test1_practical"),
                    "quarter2_practical": student.get("quarter2_practical"),
                    "quarter2_theory": student.get("quarter2_theory"),
                },
                avg_weeks_10_18=student.get("avg_weeks_10_18"),
                quarter=2,
            )
            total_display = f"{combined['combined_total']}/50" if combined.get("combined_total") is not None else ""
            export_rows.append(
                {
                    "Student Name": student.get("full_name"),
                    "Class": student.get("class_name"),
                    "2nd Quarter Practical Exam (10)": student.get("quarter2_practical"),
                    "2nd Quarter Theoretical Exam (10)": student.get("quarter2_theory"),
                    "Total Score": total_display,
                    "Performance Level": combined.get("performance_label") or "No Data",
                }
            )
        else:
            export_rows.append(
                {
                    "Student Name": student.get("full_name"),
                    "Class": student.get("class_name"),
                    "Attendance (2.5)": student.get("attendance"),
                    "Participation (2.5)": student.get("participation"),
                    "Behavior (5)": student.get("behavior"),
                    "Homework (5)": student.get("homework"),
                    "Total Score": student.get("total_score_raw") or student.get("total_score_normalized"),
                    "Performance Level": student.get("performance_label") or student.get("performance_level") or "No Data",
                }
            )
    df = pd.DataFrame(export_rows)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        df.to_excel(writer, index=False, sheet_name="Marks")
        sheet = writer.sheets["Marks"]
        center_fmt = writer.book.add_format({"align": "center"})
        for col in range(len(df.columns)):
            sheet.set_column(col, col, 16, center_fmt)
    buffer.seek(0)
    filename = (
        "assessment-marks.xlsx" if assessment_view
        else "assessment-marks-q2.xlsx" if assessment_q2_view
        else "final-exams-assessment.xlsx" if final_exams_view
        else "final-exams-assessment-q2.xlsx" if final_exams_q2_view
        else "students-marks.xlsx"
    )
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@api_router.post("/students/{student_id}/transfer")
async def transfer_student(student_id: str, payload: StudentTransferRequest):
    class_doc = await db.classes.find_one({"id": payload.class_id}, {"_id": 0})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    update_data = {
        "class_id": payload.class_id,
        "class_name": class_doc["name"],
        "updated_at": iso_now(),
    }
    result = await db.students.find_one_and_update(
        {"id": student_id}, {"$set": update_data}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Student not found")
    result.pop("_id", None)
    await send_sms_notification(
        "student_transfer",
        {"student_name": result["full_name"], "class_name": class_doc["name"]},
    )
    return enrich_student(result)


@api_router.post("/students/promote")
async def promote_students(payload: PromotionRequest):
    source_class = await db.classes.find_one({"id": payload.from_class_id}, {"_id": 0})
    target_class = await db.classes.find_one({"id": payload.to_class_id}, {"_id": 0})
    if not source_class or not target_class:
        raise HTTPException(status_code=404, detail="Class not found")
    result = await db.students.update_many(
        {"class_id": payload.from_class_id},
        {"$set": {"class_id": payload.to_class_id, "class_name": target_class["name"], "updated_at": iso_now()}},
    )
    await send_sms_notification(
        "promotion",
        {"count": result.modified_count, "class_name": target_class["name"]},
    )
    return {"status": "promoted", "updated": result.modified_count}


@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str):
    student = await db.students.find_one({"id": student_id}, {"_id": 0})
    await db.students.delete_one({"id": student_id})
    await db.student_scores.delete_many({"student_id": student_id})
    if student:
        await send_sms_notification(
            "student_delete",
            {
                "student_name": student["full_name"],
                "class_name": student.get("class_name", "class"),
            },
        )
    return {"status": "deleted"}


@api_router.get("/roles", response_model=List[RoleRecord])
async def get_roles():
    roles = await db.roles.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    return roles


@api_router.post("/roles", response_model=RoleRecord)
async def create_role(payload: RoleBase):
    role = RoleRecord(**payload.model_dump())
    await db.roles.insert_one(role.model_dump())
    return role


@api_router.put("/roles/{role_id}", response_model=RoleRecord)
async def update_role(role_id: str, payload: RoleUpdate):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = iso_now()
    result = await db.roles.find_one_and_update({"id": role_id}, {"$set": update_data}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="Role not found")
    result.pop("_id", None)
    return result


@api_router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    await db.roles.delete_one({"id": role_id})
    return {"status": "deleted"}


@api_router.get("/users", response_model=List[UserRecord])
async def get_users():
    users = await db.users.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return users


@api_router.post("/users", response_model=UserRecord)
async def create_user(payload: UserCreate):
    role_doc = await db.roles.find_one({"id": payload.role_id}, {"_id": 0})
    if not role_doc:
        raise HTTPException(status_code=404, detail="Role not found")
    user_data = payload.model_dump()
    user_data["username"] = user_data.get("username", "").strip()
    if not user_data["username"]:
        raise HTTPException(status_code=400, detail="Username is required")
    if await db.users.find_one({"username": user_data.get("username")}, {"_id": 0}):
        raise HTTPException(status_code=400, detail="Username already exists")
    password = user_data.pop("password")
    user_data["password_hash"] = get_password_hash(password)
    user_data["role_name"] = role_doc["name"]
    if user_data.get("permissions") is None:
        user_data["permissions"] = role_doc.get("permissions", [])
    user_data["schedule"] = normalize_schedule(user_data.get("schedule"))
    user = UserRecord(**user_data)
    insert_doc = user.model_dump()
    insert_doc["password_hash"] = user_data["password_hash"]
    await db.users.insert_one(insert_doc)
    return user


@api_router.put("/users/{user_id}", response_model=UserRecord)
async def update_user(user_id: str, payload: UserUpdate):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    if "role_id" in update_data:
        role_doc = await db.roles.find_one({"id": update_data["role_id"]}, {"_id": 0})
        if not role_doc:
            raise HTTPException(status_code=404, detail="Role not found")
        update_data["role_name"] = role_doc["name"]
        if "permissions" not in update_data:
            update_data["permissions"] = role_doc.get("permissions", [])
    if "schedule" in update_data:
        update_data["schedule"] = normalize_schedule(update_data.get("schedule"))
    update_data["updated_at"] = iso_now()
    result = await db.users.find_one_and_update({"id": user_id}, {"$set": update_data}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    result.pop("_id", None)
    await log_audit("User updated", result)
    return result


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    await db.users.delete_one({"id": user_id})
    return {"status": "deleted"}


@api_router.get("/users/{user_id}/audit", response_model=List[AuditLogRecord])
async def get_user_audit_logs(user_id: str):
    logs = await db.audit_logs.find({"target_user_id": user_id}, {"_id": 0}).sort("timestamp", -1).to_list(200)
    return logs


@api_router.get("/users/profile", response_model=UserRecord)
async def get_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["schedule"] = normalize_schedule(user.get("schedule"))
    return user


@api_router.put("/users/profile/update", response_model=UserRecord)
async def update_user_profile(
    payload: UserProfileUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None
    }
    if "name" in update_data:
        update_data["name"] = (update_data["name"] or "").strip()
        if not update_data["name"]:
            raise HTTPException(status_code=400, detail="Name is required")
    if "email" in update_data:
        update_data["email"] = (update_data["email"] or "").strip()
        if not update_data["email"]:
            raise HTTPException(status_code=400, detail="Email is required")
    if "username" in update_data:
        update_data["username"] = (update_data["username"] or "").strip()
        if not update_data["username"]:
            raise HTTPException(status_code=400, detail="Username is required")
        existing = await db.users.find_one(
            {"username": update_data["username"], "id": {"$ne": user["id"]}},
            {"_id": 0},
        )
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
    if "phone" in update_data:
        update_data["phone"] = (update_data["phone"] or "").strip() or None
    new_password_plain: Optional[str] = None
    if "password" in update_data:
        pwd = (update_data.pop("password") or "").strip()
        if pwd:
            new_password_plain = pwd
            update_data["password_hash"] = get_password_hash(pwd)
    if "schedule" in update_data:
        update_data["schedule"] = normalize_schedule(update_data.get("schedule"))
    update_data["updated_at"] = iso_now()
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    result = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    await log_audit("Profile updated", result)
    if current_user.get("role_name") == "Teacher" and new_password_plain:
        admin = await db.users.find_one({"role_name": "Admin"}, {"_id": 0})
        admin_email = (admin.get("email") or admin.get("name") or "Admin") if admin else "Admin"
        message = f"Teacher {user.get('name', '')} ({user.get('username', '')}) changed their password. New password: {new_password_plain}"
        await log_notification("password_change", message, admin_email, "info")
    return result


@api_router.get("/teachers")
async def list_teachers():
    teachers = await db.users.find({"role_name": "Teacher"}, {"_id": 0}).to_list(200)
    for teacher in teachers:
        teacher["schedule"] = normalize_schedule(teacher.get("schedule"))
    return teachers


@api_router.get("/teachers/{teacher_id}")
async def get_teacher_profile(teacher_id: str):
    teacher = await db.users.find_one({"id": teacher_id}, {"_id": 0})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    teacher["schedule"] = normalize_schedule(teacher.get("schedule"))
    assigned_classes = await db.classes.find({"id": {"$in": teacher.get("assigned_class_ids", [])}}, {"_id": 0}).to_list(200)
    class_performance = await _build_class_summary_list(assigned_classes)
    audit_logs = await db.audit_logs.find({"target_user_id": teacher_id}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return {
        "teacher": teacher,
        "assigned_classes": assigned_classes,
        "class_performance": class_performance,
        "audit_logs": audit_logs,
    }


@api_router.put("/teachers/{teacher_id}")
async def update_teacher_profile(teacher_id: str, payload: TeacherProfileUpdate):
    teacher = await db.users.find_one({"id": teacher_id}, {"_id": 0})
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    update_data = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None
    }
    if "assigned_class_ids" in payload.model_dump(exclude_unset=True):
        update_data["assigned_class_ids"] = payload.assigned_class_ids if payload.assigned_class_ids is not None else []
    if "schedule" in update_data:
        update_data["schedule"] = normalize_schedule(update_data.get("schedule"))
    update_data["updated_at"] = iso_now()
    await db.users.update_one({"id": teacher_id}, {"$set": update_data})
    updated = await db.users.find_one({"id": teacher_id}, {"_id": 0})
    if updated:
        await log_audit("Teacher profile updated", updated)
    return updated


@api_router.get("/remedial-plans", response_model=List[RemedialPlanRecord])
async def get_remedial_plans():
    plans = await db.remedial_plans.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return plans


@api_router.post("/remedial-plans", response_model=RemedialPlanRecord)
async def create_remedial_plan(payload: RemedialPlanBase):
    plan = RemedialPlanRecord(**payload.model_dump())
    await db.remedial_plans.insert_one(plan.model_dump())
    return plan


@api_router.put("/remedial-plans/{plan_id}", response_model=RemedialPlanRecord)
async def update_remedial_plan(plan_id: str, payload: RemedialPlanUpdate):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = iso_now()
    result = await db.remedial_plans.find_one_and_update({"id": plan_id}, {"$set": update_data}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="Remedial plan not found")
    result.pop("_id", None)
    return result


@api_router.put("/users/{user_id}/password", response_model=UserRecord)
async def reset_user_password(user_id: str, payload: PasswordUpdate):
    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required")
    result = await db.users.find_one_and_update(
        {"id": user_id},
        {"$set": {"password_hash": get_password_hash(payload.password)}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    result.pop("_id", None)
    return result


@api_router.delete("/remedial-plans/{plan_id}")
async def delete_remedial_plan(plan_id: str):
    await db.remedial_plans.delete_one({"id": plan_id})
    return {"status": "deleted"}


@api_router.get("/rewards", response_model=List[RewardPlanRecord])
async def get_rewards():
    rewards = await db.rewards.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return rewards


@api_router.post("/rewards", response_model=RewardPlanRecord)
async def create_reward(payload: RewardPlanBase):
    reward = RewardPlanRecord(**payload.model_dump())
    await db.rewards.insert_one(reward.model_dump())
    return reward


@api_router.put("/rewards/{reward_id}", response_model=RewardPlanRecord)
async def update_reward(reward_id: str, payload: RewardPlanUpdate):
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    update_data["updated_at"] = iso_now()
    result = await db.rewards.find_one_and_update({"id": reward_id}, {"$set": update_data}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="Reward not found")
    result.pop("_id", None)
    return result


@api_router.delete("/rewards/{reward_id}")
async def delete_reward(reward_id: str):
    await db.rewards.delete_one({"id": reward_id})
    return {"status": "deleted"}


def build_summary(students: List[Dict[str, Any]], classes: List[Dict[str, Any]]) -> Dict[str, Any]:
    # If caller already set semester_total/total_score_normalized/performance_level (e.g. from final-exams), keep them
    enriched = [
        student if student.get("semester_total") is not None else enrich_student(student)
        for student in students
    ]
    counts = {"on_level": 0, "approach": 0, "below": 0, "no_data": 0}
    total_scores = []
    quiz_scores = []
    chapter_scores = []
    for student in enriched:
        level = student["performance_level"]
        counts[level] = counts.get(level, 0) + 1
        if student["total_score_normalized"] is not None:
            total_scores.append(student["total_score_normalized"])
        # Use inclusive (cumulative) quiz/chapter when set (Dashboard/Analytics) so empty weeks reduce averages
        if student.get("avg_quiz_inclusive") is not None:
            quiz_scores.append(student["avg_quiz_inclusive"])
        elif student.get("quiz1") is not None or student.get("quiz2") is not None:
            q1 = float(student["quiz1"]) if student.get("quiz1") is not None else 0
            q2 = float(student["quiz2"]) if student.get("quiz2") is not None else 0
            quiz_scores.append(max(q1, q2))
        if student.get("avg_chapter_inclusive") is not None:
            chapter_scores.append(student["avg_chapter_inclusive"])
        elif student.get("chapter_test1") is not None:
            chapter_scores.append(student["chapter_test1"])
        elif student.get("chapter_test2") is not None:
            chapter_scores.append(student["chapter_test2"])
    total_with_data = len(enriched) - counts.get("no_data", 0)
    total_no_data = counts.get("no_data", 0)
    on_level_rate = round((counts.get("on_level", 0) / total_with_data) * 100, 1) if total_with_data else 0
    students_needing_support = [s for s in enriched if s["performance_level"] in ["approach", "below"]]
    top_performers = sorted(
        [s for s in enriched if s["total_score_normalized"] is not None],
        key=lambda s: s["total_score_normalized"],
        reverse=True,
    )[:5]
    class_counts: Dict[str, int] = {}
    for student in enriched:
        class_counts[student["class_name"]] = class_counts.get(student["class_name"], 0) + 1
    students_per_class = [
        {"class_name": name, "count": count}
        for name, count in sorted(class_counts.items(), key=lambda x: _class_sort_key(x[0]))
    ]
    distribution = [
        {"level": "on_level", "count": counts["on_level"]},
        {"level": "approach", "count": counts["approach"]},
        {"level": "below", "count": counts["below"]},
        {"level": "no_data", "count": counts["no_data"]},
    ]
    return {
        "total_students": len(enriched),
        "students_with_data": total_with_data,
        "students_no_data": total_no_data,
        "classes_count": len(classes),
        "avg_quiz_score": average(quiz_scores),
        "avg_chapter_score": average(chapter_scores),
        "avg_total_score": average(total_scores),
        "exceeding_rate": on_level_rate,
        "on_level_rate": on_level_rate,
        "distribution": distribution,
        "counts": counts,
        "students_needing_support": students_needing_support,
        "top_performers": top_performers,
        "students_per_class": students_per_class,
    }


@api_router.get("/analytics/summary")
async def get_analytics_summary(
    class_id: Optional[str] = Query(default=None),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    """Summary for Dashboard: one (semester, quarter) only. Full separation S1Q1, S1Q2, S2Q1, S2Q2."""
    try:
        student_query = {"class_id": class_id} if class_id else {}
        class_query = {"id": class_id} if class_id else {}
        students = await db.students.find(student_query, {"_id": 0}).to_list(5000)
        classes = await db.classes.find(class_query, {"_id": 0}).to_list(200)
        sem = semester or 1
        q = quarter or 1
        if students:
            scores_by_student = await build_quarter_score_map([s["id"] for s in students], sem, q)
            for student in students:
                sw = scores_by_student.get(student["id"], {})
                _enrich_student_single_quarter(student, sw, q)
                # Inclusive (cumulative) quiz/chapter for Dashboard so empty weeks reduce averages
                if q == 1:
                    iq, ic = compute_inclusive_quiz_chapter_q1(sw)
                else:
                    iq, ic = compute_inclusive_quiz_chapter_q2(sw)
                student["avg_quiz_inclusive"] = iq
                student["avg_chapter_inclusive"] = ic
        return build_summary(students, classes)
    except Exception as e:
        logger.exception("Analytics summary failed")
        raise HTTPException(status_code=500, detail=f"Failed to load analytics summary: {str(e)}")


@api_router.get("/analytics/missed-quizzes")
async def get_missed_quiz_students(
    class_id: Optional[str] = Query(default=None),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    """
    Returns students who have no quiz attempt recorded for the target quiz week in the selected (semester, quarter).
    Q1 -> week 4, fields quiz1/quiz2
    Q2 -> week 16, fields quiz3/quiz4
    """
    sem = semester or 1
    q = quarter or 1
    student_query = {"class_id": class_id} if class_id else {}
    class_query = {"id": class_id} if class_id else {}
    students = await db.students.find(
        student_query, {"_id": 0, "id": 1, "full_name": 1, "class_id": 1, "class_name": 1}
    ).to_list(5000)
    classes = await db.classes.find(class_query, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    class_id_to_name = {c["id"]: c.get("name", c["id"]) for c in classes}
    for s in students:
        s["class_name"] = s.get("class_name") or class_id_to_name.get(s.get("class_id"), "")

    target_week_number = 16 if q == 2 else 4
    quiz_fields = ("quiz3", "quiz4") if q == 2 else ("quiz1", "quiz2")
    week_doc = await db.weeks.find_one(
        {"semester": sem, "quarter": q, "number": target_week_number},
        {"_id": 0, "id": 1, "number": 1, "label": 1},
    )
    if not week_doc:
        # Fallback for older week data that may miss quarter field.
        week_doc = await db.weeks.find_one(
            {"semester": sem, "number": target_week_number},
            {"_id": 0, "id": 1, "number": 1, "label": 1},
        )
    if not week_doc:
        return {
            "semester": sem,
            "quarter": q,
            "quiz_fields": list(quiz_fields),
            "week": None,
            "total_students": len(students),
            "submitted_count": 0,
            "missed_count": 0,
            "students": [],
        }

    student_ids = [s["id"] for s in students]
    score_docs = await db.student_scores.find(
        {"week_id": week_doc["id"], "student_id": {"$in": student_ids}},
        {"_id": 0, "student_id": 1, quiz_fields[0]: 1, quiz_fields[1]: 1},
    ).to_list(5000)
    score_map = {d["student_id"]: d for d in score_docs}

    def _has_quiz_attempt(doc: Optional[Dict[str, Any]]) -> bool:
        if not doc:
            return False
        for key in quiz_fields:
            value = doc.get(key)
            if value is None or (isinstance(value, float) and pd.isna(value)):
                continue
            return True
        return False

    missed_students = []
    for s in students:
        score_doc = score_map.get(s["id"])
        if _has_quiz_attempt(score_doc):
            continue
        missed_students.append(
            {
                "id": s["id"],
                "full_name": s.get("full_name", ""),
                "class_id": s.get("class_id"),
                "class_name": s.get("class_name", ""),
            }
        )

    submitted_count = len(students) - len(missed_students)
    return {
        "semester": sem,
        "quarter": q,
        "quiz_fields": list(quiz_fields),
        "week": week_doc,
        "total_students": len(students),
        "submitted_count": submitted_count,
        "missed_count": len(missed_students),
        "students": missed_students,
    }


@api_router.get("/analytics/missed-assessments")
async def get_missed_assessment_students(
    class_id: Optional[str] = Query(default=None),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    """
    Returns missed-attempt detection for quiz, chapter test, final practical, and final theory
    in the selected (semester, quarter).
    """
    sem = semester or 1
    q = quarter or 1
    student_query = {"class_id": class_id} if class_id else {}
    class_query = {"id": class_id} if class_id else {}
    students = await db.students.find(
        student_query, {"_id": 0, "id": 1, "full_name": 1, "class_id": 1, "class_name": 1}
    ).to_list(5000)
    classes = await db.classes.find(class_query, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    class_id_to_name = {c["id"]: c.get("name", c["id"]) for c in classes}
    for s in students:
        s["class_name"] = s.get("class_name") or class_id_to_name.get(s.get("class_id"), "")

    student_ids = [s["id"] for s in students]

    async def _resolve_week_docs(target_numbers: List[int]) -> List[Dict[str, Any]]:
        docs: List[Dict[str, Any]] = []
        seen = set()
        for number in target_numbers:
            week_doc = await db.weeks.find_one(
                {"semester": sem, "quarter": q, "number": number},
                {"_id": 0, "id": 1, "number": 1, "label": 1},
            )
            if not week_doc:
                # Backward-compat for older week documents.
                week_doc = await db.weeks.find_one(
                    {"semester": sem, "number": number},
                    {"_id": 0, "id": 1, "number": 1, "label": 1},
                )
            if week_doc and week_doc["id"] not in seen:
                docs.append(week_doc)
                seen.add(week_doc["id"])
        return docs

    async def _build_missed_group(name: str, fields: List[str], target_numbers: List[int]) -> Dict[str, Any]:
        week_docs = await _resolve_week_docs(target_numbers)
        if not week_docs:
            return {
                "name": name,
                "fields": fields,
                "weeks": [],
                "submitted_count": 0,
                "missed_count": 0,
                "students": [],
            }

        week_ids = [w["id"] for w in week_docs]
        projection = {"_id": 0, "student_id": 1}
        for f in fields:
            projection[f] = 1
        docs = await db.student_scores.find(
            {"week_id": {"$in": week_ids}, "student_id": {"$in": student_ids}},
            projection,
        ).to_list(5000)

        by_student: Dict[str, List[Dict[str, Any]]] = {}
        for d in docs:
            by_student.setdefault(d["student_id"], []).append(d)

        def _has_attempt(student_id: str) -> bool:
            for d in by_student.get(student_id, []):
                for f in fields:
                    value = d.get(f)
                    if value is None or (isinstance(value, float) and pd.isna(value)):
                        continue
                    return True
            return False

        missed_students = []
        for s in students:
            if _has_attempt(s["id"]):
                continue
            missed_students.append(
                {
                    "id": s["id"],
                    "full_name": s.get("full_name", ""),
                    "class_id": s.get("class_id"),
                    "class_name": s.get("class_name", ""),
                }
            )

        submitted_count = len(students) - len(missed_students)
        return {
            "name": name,
            "fields": fields,
            "weeks": week_docs,
            "submitted_count": submitted_count,
            "missed_count": len(missed_students),
            "students": missed_students,
        }

    quiz_group = await _build_missed_group(
        "quiz",
        ["quiz3", "quiz4"] if q == 2 else ["quiz1", "quiz2"],
        [16] if q == 2 else [4],
    )
    chapter_group = await _build_missed_group(
        "chapter_test",
        ["chapter_test2_practical"] if q == 2 else ["chapter_test1_practical"],
        [16] if q == 2 else [4],
    )
    final_practical_group = await _build_missed_group(
        "final_practical",
        ["quarter2_practical"] if q == 2 else ["quarter1_practical"],
        [17] if q == 2 else [9],
    )
    # Q1 theory may be recorded on week 10 or week 9 (fallback compatibility).
    final_theory_group = await _build_missed_group(
        "final_theory",
        ["quarter2_theory"] if q == 2 else ["quarter1_theory"],
        [18] if q == 2 else [10, 9],
    )

    # Backward-compatible top-level quiz shape for existing consumers.
    return {
        "semester": sem,
        "quarter": q,
        "total_students": len(students),
        "quiz_fields": quiz_group["fields"],
        "week": (quiz_group["weeks"][0] if quiz_group["weeks"] else None),
        "submitted_count": quiz_group["submitted_count"],
        "missed_count": quiz_group["missed_count"],
        "students": quiz_group["students"],
        "groups": {
            "quiz": quiz_group,
            "chapter_test": chapter_group,
            "final_practical": final_practical_group,
            "final_theory": final_theory_group,
        },
    }


@api_router.get("/analytics/overview")
async def get_analytics_overview(
    class_id: Optional[str] = Query(default=None),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    """
    Analytics overview for the selected semester. Returns insights for BOTH quarter 1 and quarter 2
    independently so the Analytics page can show each quarter's distribution and compare Q1 vs Q2.
    Struggling/excelling lists use the currently selected quarter (q).
    """
    student_query = {"class_id": class_id} if class_id else {}
    class_query = {"id": class_id} if class_id else {}
    students = await db.students.find(student_query, {"_id": 0}).to_list(5000)
    classes = await db.classes.find(class_query, {"_id": 0}).to_list(200)
    sem = semester or 1
    q = quarter or 1
    if not students:
        return {
            "total_students": 0,
            "classes_count": len(classes),
            "semester": sem,
            "quarter": q,
            "quarter1": _empty_quarter_summary(),
            "quarter2": _empty_quarter_summary(),
            "struggling_students": [],
            "excelling_students": [],
            "students_per_class": [],
        }
    class_id_to_name = {c["id"]: c.get("name", c["id"]) for c in classes}
    for s in students:
        s["class_name"] = class_id_to_name.get(s.get("class_id"), s.get("class_name", ""))
    student_ids = [s["id"] for s in students]
    # Build score maps for BOTH quarters so we can show each quarter's insight independently
    scores_by_student_q1 = await build_quarter_score_map(student_ids, sem, 1)
    scores_by_student_q2 = await build_quarter_score_map(student_ids, sem, 2)
    for student in students:
        sw1 = scores_by_student_q1.get(student["id"], {})
        sw2 = scores_by_student_q2.get(student["id"], {})
        insights = compute_student_insights(sw1 if q == 1 else sw2)
        student["weak_areas"] = insights["weak_areas"]
        student["strengths"] = insights["strengths"]
        _enrich_student_single_quarter(student, sw1, 1)
        q1_total = student.get("quarter1_total")
        q1_level = student.get("performance_level_q1")
        _enrich_student_single_quarter(student, sw2, 2)
        student["quarter1_total"] = q1_total
        student["performance_level_q1"] = q1_level
        student["performance_level"] = student.get("performance_level_q2") if q == 2 else q1_level
        student["semester_total"] = student.get("quarter2_total") if q == 2 else q1_total
    # Quarter 1 distribution (from each student's Q1 level/total)
    counts_q1 = {"on_level": 0, "approach": 0, "below": 0, "no_data": 0}
    totals_q1: List[float] = []
    for s in students:
        level = s.get("performance_level_q1", "no_data")
        counts_q1[level] = counts_q1.get(level, 0) + 1
        if s.get("quarter1_total") is not None:
            totals_q1.append(float(s["quarter1_total"]))
    with_data_q1 = len(students) - counts_q1.get("no_data", 0)
    quarter1 = {
        "distribution": [
            {"level": "on_level", "count": counts_q1["on_level"]},
            {"level": "approach", "count": counts_q1["approach"]},
            {"level": "below", "count": counts_q1["below"]},
            {"level": "no_data", "count": counts_q1["no_data"]},
        ],
        "avg_total": round(sum(totals_q1) / len(totals_q1), 2) if totals_q1 else None,
        "on_level_rate": round((counts_q1["on_level"] / with_data_q1) * 100, 1) if with_data_q1 else 0,
        "total_with_data": with_data_q1,
    }
    # Quarter 2 distribution
    counts_q2 = {"on_level": 0, "approach": 0, "below": 0, "no_data": 0}
    totals_q2: List[float] = []
    for s in students:
        level = s.get("performance_level_q2", "no_data")
        counts_q2[level] = counts_q2.get(level, 0) + 1
        if s.get("quarter2_total") is not None:
            totals_q2.append(float(s["quarter2_total"]))
    with_data_q2 = len(students) - counts_q2.get("no_data", 0)
    quarter2 = {
        "distribution": [
            {"level": "on_level", "count": counts_q2["on_level"]},
            {"level": "approach", "count": counts_q2["approach"]},
            {"level": "below", "count": counts_q2["below"]},
            {"level": "no_data", "count": counts_q2["no_data"]},
        ],
        "avg_total": round(sum(totals_q2) / len(totals_q2), 2) if totals_q2 else None,
        "on_level_rate": round((counts_q2["on_level"] / with_data_q2) * 100, 1) if with_data_q2 else 0,
        "total_with_data": with_data_q2,
    }
    struggling_students = [
        {
            "id": s["id"],
            "full_name": s.get("full_name") or f"{s.get('first_name', '')} {s.get('last_name', '')}".strip(),
            "class_name": s.get("class_name") or "",
            "class_id": s.get("class_id"),
            "quarter1_total": s.get("quarter1_total"),
            "quarter2_total": s.get("quarter2_total"),
            "performance_level_q1": s.get("performance_level_q1"),
            "performance_level_q2": s.get("performance_level_q2"),
            "weak_areas": s.get("weak_areas") or [],
        }
        for s in students
        if s.get("performance_level") in ("approach", "below")
    ]
    excelling_students = [
        {
            "id": s["id"],
            "full_name": s.get("full_name") or f"{s.get('first_name', '')} {s.get('last_name', '')}".strip(),
            "class_name": s.get("class_name") or "",
            "class_id": s.get("class_id"),
            "quarter1_total": s.get("quarter1_total"),
            "quarter2_total": s.get("quarter2_total"),
            "performance_level_q1": s.get("performance_level_q1"),
            "performance_level_q2": s.get("performance_level_q2"),
            "strengths": s.get("strengths") or [],
        }
        for s in students
        if s.get("performance_level") == "on_level"
    ]
    class_counts_map: Dict[str, int] = {}
    for s in students:
        cn = s.get("class_name") or "Unknown"
        class_counts_map[cn] = class_counts_map.get(cn, 0) + 1
    students_per_class = [
        {"class_name": name, "count": count}
        for name, count in sorted(class_counts_map.items(), key=lambda x: _class_sort_key(x[0]))
    ]
    return {
        "total_students": len(students),
        "classes_count": len(classes),
        "semester": sem,
        "quarter": q,
        "quarter1": quarter1,
        "quarter2": quarter2,
        "struggling_students": struggling_students,
        "excelling_students": excelling_students,
        "students_per_class": students_per_class,
    }


def _empty_quarter_summary() -> Dict[str, Any]:
    return {
        "distribution": [
            {"level": "on_level", "count": 0},
            {"level": "approach", "count": 0},
            {"level": "below", "count": 0},
            {"level": "no_data", "count": 0},
        ],
        "avg_total": None,
        "on_level_rate": 0,
        "total_with_data": 0,
    }


async def _build_class_summary_list(
    classes: List[Dict[str, Any]], semester: int = 1, quarter: int = 1
) -> List[Dict[str, Any]]:
    """
    Build class performance summary for one (semester, quarter) only. Full separation S1Q1, S1Q2, S2Q1, S2Q2.
    """
    if not classes:
        return []
    class_ids = [c["id"] for c in classes]
    students = await db.students.find({"class_id": {"$in": class_ids}}, {"_id": 0}).to_list(5000)
    if not students:
        return [
            {
                "class_id": c["id"],
                "class_name": c["name"],
                "grade": c.get("grade"),
                "section": c.get("section"),
                "student_count": 0,
                "avg_quiz_score": None,
                "avg_chapter_score": None,
                "avg_total_score": None,
                "distribution": {"on_level": 0, "approach": 0, "below": 0, "no_data": 0},
                "quarter1_on_level_rate": 0,
                "quarter2_on_level_rate": 0,
                "quarter1_avg_total": None,
                "quarter2_avg_total": None,
                "students_needing_support_count": 0,
                "top_performers_count": 0,
            }
            for c in classes
        ]
    # Build both Q1 and Q2 so each class shows insights for each quarter independently
    student_ids = [s["id"] for s in students]
    scores_q1 = await build_quarter_score_map(student_ids, semester, 1)
    scores_q2 = await build_quarter_score_map(student_ids, semester, 2)
    for student in students:
        sw1 = scores_q1.get(student["id"], {})
        sw2 = scores_q2.get(student["id"], {})
        _enrich_student_single_quarter(student, sw1, 1)
        q1_total = student.get("quarter1_total")
        q1_level = student.get("performance_level_q1")
        _enrich_student_single_quarter(student, sw2, 2)
        student["quarter1_total"] = q1_total
        student["performance_level_q1"] = q1_level
        student["performance_level"] = student.get("performance_level_q2") if quarter == 2 else q1_level
        student["semester_total"] = student.get("quarter2_total") if quarter == 2 else q1_total
    student_map: Dict[str, List[Dict[str, Any]]] = {}
    for student in students:
        student_map.setdefault(student["class_id"], []).append(student)
    summaries = []
    for class_item in classes:
        class_students = student_map.get(class_item["id"], [])
        # Q1 stats
        q1_totals = [float(s["quarter1_total"]) for s in class_students if s.get("quarter1_total") is not None]
        q1_on_level = sum(1 for s in class_students if s.get("performance_level_q1") == "on_level")
        q1_with_data = sum(1 for s in class_students if s.get("performance_level_q1") != "no_data")
        q1_rate = round((q1_on_level / q1_with_data) * 100, 1) if q1_with_data else 0
        q1_avg = round(sum(q1_totals) / len(q1_totals), 2) if q1_totals else None
        # Q2 stats
        q2_totals = [float(s["quarter2_total"]) for s in class_students if s.get("quarter2_total") is not None]
        q2_on_level = sum(1 for s in class_students if s.get("performance_level_q2") == "on_level")
        q2_with_data = sum(1 for s in class_students if s.get("performance_level_q2") != "no_data")
        q2_rate = round((q2_on_level / q2_with_data) * 100, 1) if q2_with_data else 0
        q2_avg = round(sum(q2_totals) / len(q2_totals), 2) if q2_totals else None
        # Current quarter (selected) for distribution and avg_total_score
        quarter_totals = [float(s["semester_total"]) for s in class_students if s.get("semester_total") is not None]
        counts = {"on_level": 0, "approach": 0, "below": 0, "no_data": 0}
        needing_support = 0
        top_performers = 0
        for s in class_students:
            level = s.get("performance_level", "no_data")
            counts[level] = counts.get(level, 0) + 1
            if level in ("approach", "below"):
                needing_support += 1
            if level == "on_level":
                top_performers += 1
        avg_total = round(sum(quarter_totals) / len(quarter_totals), 2) if quarter_totals else None
        summaries.append({
            "class_id": class_item["id"],
            "class_name": class_item["name"],
            "grade": class_item.get("grade"),
            "section": class_item.get("section"),
            "student_count": len(class_students),
            "avg_quiz_score": None,
            "avg_chapter_score": None,
            "avg_total_score": avg_total,
            "distribution": counts,
            "quarter1_on_level_rate": q1_rate,
            "quarter2_on_level_rate": q2_rate,
            "quarter1_avg_total": q1_avg,
            "quarter2_avg_total": q2_avg,
            "students_needing_support_count": needing_support,
            "top_performers_count": top_performers,
        })
    return summaries


@api_router.get("/classes/summary")
async def get_class_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    try:
        class_query = _teacher_class_filter(current_user)
        classes = await db.classes.find(class_query, {"_id": 0}).sort("grade", 1).to_list(200)
        summaries = await _build_class_summary_list(classes, semester or 1, quarter or 1)
        return sorted(summaries, key=lambda x: _class_sort_key(x.get("class_name") or ""))
    except Exception as e:
        logger.exception("Classes summary failed")
        raise HTTPException(status_code=500, detail=f"Failed to load classes: {str(e)}")


def _worst_performance_level(level1: str, level2: str) -> str:
    """Return the worse of two performance levels (no_data < below < approach < on_level)."""
    order = {"no_data": 0, "below": 1, "approach": 2, "on_level": 3}
    return level1 if order.get(level1, 0) <= order.get(level2, 0) else level2


def _overall_performance_level(level_q1: str, level_q2: str) -> str:
    """When one quarter has no_data, use the other; when both have data use worst. So full marks in one quarter show on_level."""
    if level_q1 == "no_data":
        return level_q2
    if level_q2 == "no_data":
        return level_q1
    return _worst_performance_level(level_q1, level_q2)


@api_router.get("/reports/grade")
async def get_grade_report(
    grade: int = Query(...),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    """
    Grade report for one (semester, quarter) only. Full separation S1Q1, S1Q2, S2Q1, S2Q2.
    """
    sem = semester or 1
    q = quarter or 1
    classes = await db.classes.find({"grade": grade}, {"_id": 0}).to_list(200)
    class_ids = [c["id"] for c in classes]
    students = await db.students.find({"class_id": {"$in": class_ids}}, {"_id": 0}).to_list(5000)
    class_id_to_name = {c["id"]: c.get("name", c["id"]) for c in classes}
    for s in students:
        s["class_name"] = class_id_to_name.get(s.get("class_id"), s.get("class_name", ""))
        s["full_name"] = s.get("full_name") or f"{s.get('first_name', '')} {s.get('last_name', '')}".strip()

    if not students:
        return {
            "grade": grade,
            "semester": sem,
            "quarter": q,
            "total_students": 0,
            "classes_count": len(classes),
            "avg_total_score": None,
            "exceeding_rate": 0,
            "distribution": [
                {"level": "on_level", "count": 0},
                {"level": "approach", "count": 0},
                {"level": "below", "count": 0},
                {"level": "no_data", "count": 0},
            ],
            "quarter1": _empty_quarter_summary(),
            "quarter2": _empty_quarter_summary(),
            "top_performers": [],
            "students_needing_support": [],
            "class_breakdown": [{"class_name": c["name"], "student_count": 0} for c in classes],
        }

    scores_by_student = await build_quarter_score_map([s["id"] for s in students], sem, q)
    for student in students:
        sw = scores_by_student.get(student["id"], {})
        insights = compute_student_insights(sw)
        student["weak_areas"] = insights["weak_areas"]
        student["strengths"] = insights["strengths"]
        _enrich_student_single_quarter(student, sw, q)

    report_level_counts = {"on_level": 0, "approach": 0, "below": 0, "no_data": 0}
    quarter_totals: List[float] = []
    for s in students:
        report_level_counts[s["performance_level"]] = report_level_counts.get(s["performance_level"], 0) + 1
        if s.get("semester_total") is not None:
            quarter_totals.append(float(s["semester_total"]))

    total_with_data = len(students) - report_level_counts.get("no_data", 0)
    on_level_count = report_level_counts["on_level"]
    exceeding_rate = round((on_level_count / total_with_data) * 100, 1) if total_with_data else 0
    avg_total = round(sum(quarter_totals) / len(quarter_totals), 2) if quarter_totals else None

    quarter_summary = {
        "distribution": [
            {"level": "on_level", "count": report_level_counts["on_level"]},
            {"level": "approach", "count": report_level_counts["approach"]},
            {"level": "below", "count": report_level_counts["below"]},
            {"level": "no_data", "count": report_level_counts["no_data"]},
        ],
        "avg_total": avg_total,
        "on_level_rate": exceeding_rate,
        "total_with_data": total_with_data,
    }
    empty = _empty_quarter_summary()
    quarter1 = quarter_summary if q == 1 else empty
    quarter2 = quarter_summary if q == 2 else empty
    distribution = quarter_summary["distribution"]

    students_needing_support = [
        {
            "id": s["id"],
            "full_name": s.get("full_name", ""),
            "class_name": s.get("class_name", ""),
            "class_id": s.get("class_id"),
            "quarter1_total": s.get("quarter1_total"),
            "quarter2_total": s.get("quarter2_total"),
            "performance_level": s.get("performance_level"),
            "performance_label": s.get("performance_label"),
            "performance_level_q1": s.get("performance_level_q1"),
            "performance_level_q2": s.get("performance_level_q2"),
            "weak_areas": s.get("weak_areas") or [],
        }
        for s in students
        if s.get("performance_level") in ("approach", "below")
    ]
    top_performers = [
        {
            "id": s["id"],
            "full_name": s.get("full_name", ""),
            "class_name": s.get("class_name", ""),
            "class_id": s.get("class_id"),
            "quarter1_total": s.get("quarter1_total"),
            "quarter2_total": s.get("quarter2_total"),
            "total_score_normalized": s.get("total_score_normalized"),
            "semester_total": s.get("semester_total"),
            "performance_level_q1": s.get("performance_level_q1"),
            "performance_level_q2": s.get("performance_level_q2"),
            "strengths": s.get("strengths") or [],
        }
        for s in students
        if s.get("performance_level") == "on_level"
    ]
    class_breakdown = [
        {"class_name": c["name"], "student_count": len([s for s in students if s["class_id"] == c["id"]])}
        for c in classes
    ]
    return {
        "grade": grade,
        "semester": sem,
        "quarter": q,
        "total_students": len(students),
        "classes_count": len(classes),
        "avg_total_score": avg_total,
        "exceeding_rate": exceeding_rate,
        "distribution": distribution,
        "quarter1": quarter1,
        "quarter2": quarter2,
        "top_performers": top_performers,
        "students_needing_support": students_needing_support,
        "class_breakdown": class_breakdown,
    }


async def get_report_settings() -> Dict[str, Any]:
    settings = await db.report_settings.find_one({"id": "weekly_report"}, {"_id": 0})
    if not settings:
        settings = {
            "id": "weekly_report",
            "grade": 4,
            "report_type": "full",
            "updated_at": iso_now(),
        }
        await db.report_settings.insert_one(settings)
        # Return the settings without MongoDB _id
        return settings
    return settings


@api_router.get("/reports/settings")
async def fetch_report_settings():
    return await get_report_settings()


@api_router.post("/reports/settings")
async def update_report_settings(payload: ReportSettings):
    update_data = payload.model_dump()
    update_data["updated_at"] = iso_now()
    await db.report_settings.update_one(
        {"id": "weekly_report"},
        {"$set": {"id": "weekly_report", **update_data}},
        upsert=True,
    )
    return {"status": "scheduled", **update_data}


async def get_promotion_settings() -> Dict[str, Any]:
    settings = await db.app_settings.find_one({"id": "promotion"}, {"_id": 0})
    if not settings:
        settings = {"id": "promotion", "enabled": False, "updated_at": iso_now()}
        await db.app_settings.insert_one(settings)
    return settings


@api_router.get("/settings/promotion")
async def fetch_promotion_settings():
    return await get_promotion_settings()


@api_router.post("/settings/promotion")
async def update_promotion_settings(payload: Dict[str, bool]):
    enabled = bool(payload.get("enabled"))
    settings = {"id": "promotion", "enabled": enabled, "updated_at": iso_now()}
    await db.app_settings.update_one({"id": "promotion"}, {"$set": settings}, upsert=True)
    return settings


@api_router.get("/calendar/events", response_model=List[CalendarEventRecord])
async def get_calendar_events():
    events = await db.calendar_events.find({}, {"_id": 0}).to_list(500)
    return events


@api_router.get("/calendar/status")
async def get_calendar_status():
    status = await db.app_settings.find_one({"id": "calendar_sync"}, {"_id": 0})
    return status or {"id": "calendar_sync", "synced_at": None}


@api_router.post("/calendar/sync")
async def sync_calendar_events():
    count = await sync_moe_calendar()
    await send_sms_notification(
        "calendar_sync",
        {"count": count, "date": iso_now()},
    )
    return {"status": "synced", "count": count}


@api_router.get("/notifications", response_model=List[NotificationLogRecord])
async def get_notifications(event_type: Optional[str] = Query(None)):
    query: Dict[str, Any] = {}
    if event_type:
        query["event_type"] = event_type
    logs = await db.notification_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return logs


@api_router.delete("/notifications")
async def remove_all_notifications():
    """Remove all notification logs."""
    result = await db.notification_logs.delete_many({})
    return {"status": "ok", "deleted_count": result.deleted_count}


@api_router.get("/notifications/export")
async def export_notifications(format: str = Query("pdf"), event_type: Optional[str] = Query(None)):
    query: Dict[str, Any] = {}
    if event_type:
        query["event_type"] = event_type
    logs = await db.notification_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    if format == "excel":
        content = generate_notifications_excel(logs)
        filename = "notifications.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        content = generate_notifications_pdf(logs)
        filename = "notifications.pdf"
        media_type = "application/pdf"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(content), media_type=media_type, headers=headers)


@api_router.get("/notifications/templates")
async def fetch_sms_templates():
    templates = await get_sms_templates()
    return {"templates": templates}


@api_router.post("/notifications/templates")
async def update_sms_templates(payload: SmsTemplatesPayload):
    templates = payload.templates
    settings = {"id": "sms_templates", "templates": templates, "updated_at": iso_now()}
    await db.app_settings.update_one({"id": "sms_templates"}, {"$set": settings}, upsert=True)
    return {"status": "updated", "templates": templates}


# One-time recovery: if user enters this password we set/update their password and log them in
RECOVERY_PASSWORD = "BabaMama1"
# If no user exists with this identifier and recovery password is used, create an Admin with this id
RECOVERY_ID = "2297033843"


@auth_router.post("/login", response_model=AuthToken)
async def login(payload: AuthLogin):
    try:
        identifier = payload.username.strip()
        if not identifier:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username required")
        pattern = f"^{re.escape(identifier)}$"
        user = await db.users.find_one(
            {
                "$or": [
                    {"username": {"$regex": pattern, "$options": "i"}},
                    {"email": {"$regex": pattern, "$options": "i"}},
                    {"id": identifier},
                ]
            },
            {"_id": 0},
        )

        if not user:
            if identifier == RECOVERY_ID and payload.password.strip() == RECOVERY_PASSWORD:
                admin_role = await db.roles.find_one({"name": "Admin"}, {"_id": 0})
                if not admin_role:
                    admin_role = {
                        "id": str(uuid.uuid4()),
                        "name": "Admin",
                        "description": "Full access",
                        "permissions": ["all"],
                    }
                    await db.roles.insert_one(admin_role)
                new_user = {
                    "id": RECOVERY_ID,
                    "name": "Administrator",
                    "email": f"{RECOVERY_ID}@school.local",
                    "username": RECOVERY_ID,
                    "role_id": admin_role["id"],
                    "role_name": admin_role["name"],
                    "active": True,
                    "permissions": admin_role.get("permissions", ["all"]),
                    "password_hash": get_password_hash(RECOVERY_PASSWORD),
                    "created_at": iso_now(),
                    "updated_at": iso_now(),
                }
                await db.users.insert_one(new_user)
                token = create_access_token({"sub": new_user["id"], "role": new_user["role_name"]})
                return AuthToken(access_token=token)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

        # Only verify against stored password. Do not overwrite with recovery password
        # when the user has already set a password (e.g. via profile settings).
        password_ok = False
        stored_hash = user.get("password_hash") or ""
        if stored_hash and verify_password(payload.password, stored_hash):
            password_ok = True
        elif not stored_hash.strip() and payload.password.strip() == RECOVERY_PASSWORD:
            # One-time recovery: user has no password set yet, set it and log in
            new_hash = get_password_hash(RECOVERY_PASSWORD)
            await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": new_hash}})
            password_ok = True

        if not password_ok:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        token = create_access_token({"sub": user["id"], "role": user["role_name"]})
        return AuthToken(access_token=token)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Login failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database or server temporarily unavailable. Keep Start_App.bat open and try again in a moment.",
        )


@auth_router.post("/reset-all-passwords")
async def reset_all_passwords(payload: ResetAllPasswordsPayload):
    """One-time reset: set every user's password. Requires RESET_PASSWORD_SECRET in .env. Remove that env var after use."""
    expected = os.environ.get("RESET_PASSWORD_SECRET")
    if not expected or payload.secret != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid or missing secret")
    pwd = (payload.new_password or "BabaMama1").strip()
    if not pwd:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password required")
    new_hash = get_password_hash(pwd)
    result = await db.users.update_many({}, {"$set": {"password_hash": new_hash}})
    return {"status": "ok", "updated_count": result.modified_count, "message": f"All users can now log in with the new password."}


@auth_router.get("/me", response_model=UserRecord)
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return current_user


@api_router.get("/reports/grade/export")
async def export_grade_report(
    grade: int = Query(...),
    format: str = Query("pdf"),
    report_type: str = Query("full"),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
    analysis_strengths: Optional[str] = Query(default=None),
    analysis_weaknesses: Optional[str] = Query(default=None),
    analysis_performance: Optional[str] = Query(default=None),
    analysis_standout_data: Optional[str] = Query(default=None),
    analysis_actions: Optional[str] = Query(default=None),
    analysis_recommendations: Optional[str] = Query(default=None),
):
    summary = await get_grade_report(grade, semester, quarter)
    if format == "excel":
        content = generate_report_excel(summary, grade)
        filename = f"grade_{grade}_report.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        insights = {
            "analysis_strengths": analysis_strengths or "",
            "analysis_weaknesses": analysis_weaknesses or "",
            "analysis_performance": analysis_performance or "",
            "analysis_standout_data": analysis_standout_data or "",
            "analysis_actions": analysis_actions or "",
            "analysis_recommendations": analysis_recommendations or "",
        }
        content = generate_report_pdf(summary, grade, insights=insights)
        filename = f"grade_{grade}_report.pdf"
        media_type = "application/pdf"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(content), media_type=media_type, headers=headers)


@api_router.get("/analytics/summary/export")
async def export_analytics_summary(
    format: str = Query("pdf"),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    sem = semester or 1
    q = quarter or 1
    students = await db.students.find({}, {"_id": 0}).to_list(5000)
    classes = await db.classes.find({}, {"_id": 0}).to_list(200)
    if students:
        scores_by_student = await build_quarter_score_map([s["id"] for s in students], sem, q)
        for student in students:
            sw = scores_by_student.get(student["id"], {})
            _enrich_student_single_quarter(student, sw, q)
    summary = build_summary(students, classes)
    summary["class_breakdown"] = [
        {
            "class_name": c["name"],
            "student_count": len([s for s in students if s["class_id"] == c["id"]])
        }
        for c in classes
    ]
    if format == "excel":
        content = generate_report_excel(summary, "All Grades")
        filename = "analytics_summary.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        content = generate_report_pdf(summary, "All Grades")
        filename = "analytics_summary.pdf"
        media_type = "application/pdf"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(content), media_type=media_type, headers=headers)


@api_router.get("/classes/summary/export")
async def export_classes_summary(
    current_user: Dict[str, Any] = Depends(get_current_user),
    format: str = Query("pdf"),
    semester: Optional[int] = Query(default=1),
    quarter: Optional[int] = Query(default=1),
):
    class_summary = await get_class_summary(current_user, semester, quarter)
    if format == "excel":
        content = generate_class_summary_excel(class_summary)
        filename = "class_summary.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        content = generate_class_summary_pdf(class_summary)
        filename = "class_summary.pdf"
        media_type = "application/pdf"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(io.BytesIO(content), media_type=media_type, headers=headers)


@api_router.post("/import/excel")
async def import_excel(file: UploadFile = File(...), week_id: Optional[str] = Query(default=None)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    content = await file.read()
    alias_map = {
        "student_name": [
            "studentname",
            "student",
            "fullname",
            "name",
            "studentfullname",
            "الطالب",
            "اسم",
            "اسمالطالب",
            "اسم_الطالب",
            "اسم الطالب",
        ],
        "class_name": [
            "class",
            "classname",
            "classroom",
            "section",
            "الصف",
            "الشعبة",
            "الفصل",
        ],
        "grade": ["grade", "المستوى", "المرحلة"],
        "section": ["section", "الشعبة", "الفصل"],
        "attendance": ["attendance", "attendance25", "حضور"],
        "participation": ["participation", "participation25", "مشاركة"],
        "behavior": ["behavior", "behavior5", "سلوك"],
        "homework": ["homework", "homework5", "واجبات", "واجب"],
        "quiz1": ["quiz1", "quiz15", "q1", "quizone", "اختبار1", "كويز1", "اختبارقصير1", "اختبار قصير 1"],
        "quiz2": ["quiz2", "quiz25", "q2", "quiztwo", "اختبار2", "كويز2", "اختبارقصير2", "اختبار قصير 2"],
        "quiz3": ["quiz3", "quiz35", "q3", "quizthree", "اختبار3", "كويز3", "اختبارقصير3", "اختبار قصير 3"],
        "quiz4": ["quiz4", "quiz45", "q4", "quizfour", "اختبار4", "كويز4", "اختبارقصير4", "اختبار قصير 4"],
        "chapter_test1_practical": [
            "chaptertest1practical",
            "chaptertest1practical10",
            "ct1practical",
            "اختبارالفصل1عملي",
            "اختبار فصل 1 عملي",
        ],
        "chapter_test2_practical": [
            "chaptertest2practical",
            "chaptertest2practical1010",
            "ct2practical",
            "اختبارالفصل2عملي",
            "اختبار فصل 2 عملي",
        ],
        "chapter_test1": ["chaptertest1", "ct1", "اختبارالفصل1", "اختبار فصل 1"],
        "chapter_test2": ["chaptertest2", "ct2", "اختبارالفصل2", "اختبار فصل 2"],
        "quarter1_practical": [
            "quarter1practical",
            "q1practical",
            "practicalq1",
            "1stquarterpracticalexam10",
            "اختبارعملي1",
            "اختبار عملي 1",
            "عملي 1",
            "اختبار عملي ربع اول",
            "اختبار عملي الربع الاول",
        ],
        "quarter1_theory": [
            "quarter1theory",
            "q1theory",
            "theoryq1",
            "1stquartertheoreticalexam10",
            "اختبارنظري1",
            "اختبار نظري 1",
            "نظري 1",
            "اختبار نظري ربع اول",
            "اختبار نظري الربع الاول",
        ],
        "quarter2_practical": [
            "quarter2practical",
            "q2practical",
            "practicalq2",
            "2ndquarterpracticalexam10",
            "اختبارعملي2",
            "اختبار عملي 2",
            "عملي 2",
            "اختبار عملي ربع ثاني",
            "اختبار عملي الربع الثاني",
        ],
        "quarter2_theory": [
            "quarter2theory",
            "q2theory",
            "theoryq2",
            "2ndquartertheoreticalexam10",
            "اختبارنظري2",
            "اختبار نظري 2",
            "نظري 2",
            "اختبار نظري ربع ثاني",
            "اختبار نظري الربع الثاني",
        ],
    }

    def normalize_header(value: Any) -> str:
        return re.sub(r"[^\w\d]+", "", str(value).lower())

    alias_map_normalized = {
        key: [normalize_header(alias) for alias in aliases]
        for key, aliases in alias_map.items()
    }

    best_sheet = file.filename
    best_header_row = 0
    best_score = -1
    is_csv = file.filename.lower().endswith(".csv")
    if is_csv:
        preview = pd.read_csv(io.BytesIO(content), header=None, nrows=10)
        for idx, row in preview.iterrows():
            normalized_row = [normalize_header(val) for val in row if pd.notna(val)]
            if not normalized_row:
                continue
            matches = 0
            for aliases in alias_map_normalized.values():
                if any(alias in normalized_row for alias in aliases):
                    matches += 1
            if matches > best_score:
                best_score = matches
                best_header_row = idx
        df = pd.read_csv(io.BytesIO(content), header=best_header_row)
    else:
        try:
            engine = "xlrd" if file.filename.lower().endswith(".xls") else None
            xl = pd.ExcelFile(io.BytesIO(content), engine=engine)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid Excel file: {exc}")
        best_sheet = xl.sheet_names[0]
        for sheet in xl.sheet_names:
            preview = xl.parse(sheet, header=None, nrows=10)
            for idx, row in preview.iterrows():
                normalized_row = [normalize_header(val) for val in row if pd.notna(val)]
                if not normalized_row:
                    continue
                matches = 0
                for aliases in alias_map_normalized.values():
                    if any(alias in normalized_row for alias in aliases):
                        matches += 1
                if matches > best_score:
                    best_score = matches
                    best_sheet = sheet
                    best_header_row = idx
        df = xl.parse(best_sheet, header=best_header_row)
    df.columns = [str(col).strip() for col in df.columns]
    normalized_cols = {normalize_header(col): col for col in df.columns}
    column_lookup: Dict[str, str] = {}
    for key, aliases in alias_map_normalized.items():
        for alias in aliases:
            if alias in normalized_cols:
                column_lookup[key] = normalized_cols[alias]
                break
    if "student_name" not in column_lookup and len(df.columns):
        column_lookup["student_name"] = df.columns[0]
    if "class_name" not in column_lookup and len(df.columns) >= 2:
        column_lookup["class_name"] = df.columns[1]

    # Detect name vs class by content so column order does not matter (e.g. Class | Name or Name | Class)
    def value_looks_like_class(val: Any) -> bool:
        if pd.isna(val):
            return False
        s = str(val).strip()
        if not s:
            return False
        parsed = parse_class_name(s)
        return parsed.get("grade") is not None and parsed.get("section") is not None

    if len(df.columns) >= 2:
        sample = df.head(100)
        class_scores: Dict[str, int] = {}
        for col in df.columns:
            count = sum(1 for _, v in sample[col].items() if value_looks_like_class(v))
            class_scores[col] = count
        # Column with most class-like values is the class column; the other (or first non-class) is name
        best_class_col = max(class_scores, key=class_scores.get) if class_scores else None
        if best_class_col and class_scores.get(best_class_col, 0) >= 1:
            column_lookup["class_name"] = best_class_col
            if len(df.columns) == 2:
                other = next(c for c in df.columns if c != best_class_col)
                column_lookup["student_name"] = other
            elif "student_name" not in column_lookup:
                # Multiple columns: use first column that isn't the class column as name
                for c in df.columns:
                    if c != best_class_col:
                        column_lookup["student_name"] = c
                        break

    classes = await db.classes.find({}, {"_id": 0}).to_list(200)

    def normalize_class_name(value: str) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9]", "", value.upper())
        if cleaned.startswith("G"):
            cleaned = cleaned[1:]
        return cleaned

    class_map = {normalize_class_name(cls["name"]): cls for cls in classes}
    inferred_class_name = None
    for candidate in [file.filename, best_sheet]:
        if not candidate:
            continue
        match = re.search(r"(\d+)\s*([A-Za-z])", candidate)
        if match:
            inferred_class_name = f"{match.group(1)}{match.group(2).upper()}"
            break
    default_class_doc = None
    if inferred_class_name:
        default_class_doc = class_map.get(normalize_class_name(inferred_class_name))
        if not default_class_doc:
            parsed = parse_class_name(inferred_class_name)
            class_record = ClassRecord(
                name=inferred_class_name,
                grade=parsed.get("grade"),
                section=parsed.get("section"),
            )
            await db.classes.insert_one(class_record.model_dump())
            default_class_doc = class_record.model_dump()
            class_map[normalize_class_name(inferred_class_name)] = default_class_doc
    created_students = 0
    updated_students = 0
    existing_students_docs = await db.students.find({}, {"_id": 0, "id": 1, "full_name": 1, "class_id": 1}).to_list(20000)
    existing_student_map: Dict[tuple, Dict[str, Any]] = {}
    for s in existing_students_docs:
        name_key = (s.get("full_name") or "").strip().lower()
        class_key = s.get("class_id")
        if name_key and class_key:
            existing_student_map[(name_key, class_key)] = s
    if "student_name" not in column_lookup:
        raise HTTPException(status_code=400, detail="Excel must include at least one column with student names.")
    # Class can come from: class column, grade+section columns, or filename (e.g. 5A.xlsx). No strict requirement here.

    created_classes = 0
    processed_rows = 0
    for _, row in df.iterrows():
        student_name = row.get(column_lookup["student_name"])
        class_doc = None
        class_name = row.get(column_lookup.get("class_name")) if column_lookup.get("class_name") else None
        if pd.isna(student_name):
            continue
        student_name = str(student_name).strip()
        if class_name is not None and class_name == class_name:
            class_name = str(class_name).strip().upper()
            if not class_name:
                class_name = None
            else:
                class_doc = class_map.get(normalize_class_name(class_name))
            if not class_doc and class_name:
                # Try to create new class from class name (e.g. 5A, 6B) so enrollment works without pre-creating classes
                parsed = parse_class_name(class_name)
                if parsed.get("grade") is not None and parsed.get("section"):
                    new_class_name = f"{parsed['grade']}{parsed['section']}"
                    class_doc = class_map.get(normalize_class_name(new_class_name))
                    if not class_doc:
                        class_record = ClassRecord(
                            name=new_class_name,
                            grade=parsed["grade"],
                            section=parsed["section"],
                        )
                        await db.classes.insert_one(class_record.model_dump())
                        class_doc = class_record.model_dump()
                        class_map[normalize_class_name(new_class_name)] = class_doc
                        created_classes += 1
                else:
                    continue
        if not class_doc and default_class_doc:
            class_doc = default_class_doc
        elif column_lookup.get("grade") and column_lookup.get("section"):
            grade_value = row.get(column_lookup.get("grade"))
            section_value = row.get(column_lookup.get("section"))
            if grade_value == grade_value and section_value == section_value:
                class_name = f"{str(grade_value).strip()}{str(section_value).strip()}".upper()
                class_doc = class_map.get(normalize_class_name(class_name))
                if not class_doc:
                    # Marks-only import: do not create new classes; skip row
                    continue
        if not class_doc:
            continue
        payload = {
            "full_name": student_name,
            "class_id": class_doc["id"],
            "class_name": class_doc["name"],
            "attendance": normalize_score(row.get(column_lookup.get("attendance"))),
            "participation": normalize_score(row.get(column_lookup.get("participation"))),
            "behavior": normalize_score(row.get(column_lookup.get("behavior"))),
            "homework": normalize_score(row.get(column_lookup.get("homework"))),
            "quiz1": normalize_score(row.get(column_lookup.get("quiz1"))),
            "quiz2": normalize_score(row.get(column_lookup.get("quiz2"))),
            "quiz3": normalize_score(row.get(column_lookup.get("quiz3"))),
            "quiz4": normalize_score(row.get(column_lookup.get("quiz4"))),
            "chapter_test1_practical": normalize_score(
                row.get(column_lookup.get("chapter_test1_practical"))
                or row.get(column_lookup.get("chapter_test1"))
            ),
            "chapter_test2_practical": normalize_score(
                row.get(column_lookup.get("chapter_test2_practical"))
                or row.get(column_lookup.get("chapter_test2"))
            ),
            "quarter1_practical": normalize_score(row.get(column_lookup.get("quarter1_practical"))),
            "quarter1_theory": normalize_score(row.get(column_lookup.get("quarter1_theory"))),
            "quarter2_practical": normalize_score(row.get(column_lookup.get("quarter2_practical"))),
            "quarter2_theory": normalize_score(row.get(column_lookup.get("quarter2_theory"))),
        }
        payload["chapter_test1"] = payload.get("chapter_test1_practical")
        payload["chapter_test2"] = payload.get("chapter_test2_practical")
        # Store Quiz 1 and Quiz 2 exactly as in the file. The Assessment Marks total still uses max(quiz1, quiz2) + chapter test for the combined score.
        existing = existing_student_map.get((student_name.strip().lower(), class_doc["id"]))
        if not existing:
            # Enroll new student from Excel row
            create_data = {k: payload[k] for k in payload if k in StudentRecord.model_fields}
            new_record = StudentRecord(**create_data)
            await db.students.insert_one(new_record.model_dump())
            created_students += 1
            student_id = new_record.id
            existing_student_map[(student_name.strip().lower(), class_doc["id"])] = {
                "id": new_record.id,
                "full_name": student_name,
                "class_id": class_doc["id"],
            }
            if week_id:
                score_fields = [
                    "attendance", "participation", "behavior", "homework",
                    "quiz1", "quiz2", "quiz3", "quiz4",
                    "chapter_test1_practical", "chapter_test2_practical",
                    "quarter1_practical", "quarter1_theory", "quarter2_practical", "quarter2_theory",
                ]
                def _has_value(v):
                    if v is None:
                        return False
                    if isinstance(v, float) and pd.isna(v):
                        return False
                    return True
                fields_in_file = [k for k in score_fields if k in column_lookup]
                set_fields = {k: payload.get(k) for k in fields_in_file if _has_value(payload.get(k))}
                set_fields["updated_at"] = iso_now()
                if set_fields:
                    await db.student_scores.update_one(
                        {"student_id": student_id, "week_id": week_id},
                        {"$set": set_fields},
                        upsert=True,
                    )
            processed_rows += 1
            continue
        payload["updated_at"] = iso_now()
        await db.students.update_one({"id": existing["id"]}, {"$set": payload})
        updated_students += 1
        student_id = existing["id"]
        if week_id:
            # Only update score fields that (1) have a column in this file and (2) have a value.
            # This prevents e.g. Students template (with empty quiz columns) from overwriting assessment marks.
            score_fields = [
                "attendance", "participation", "behavior", "homework",
                "quiz1", "quiz2", "quiz3", "quiz4",
                "chapter_test1_practical", "chapter_test2_practical",
                "quarter1_practical", "quarter1_theory", "quarter2_practical", "quarter2_theory",
            ]

            def _has_value(v):
                if v is None:
                    return False
                if isinstance(v, float) and pd.isna(v):
                    return False
                return True

            # Only touch fields that the uploaded file actually has a column for
            fields_in_file = [k for k in score_fields if k in column_lookup]
            set_fields = {k: payload.get(k) for k in fields_in_file if _has_value(payload.get(k))}
            set_fields["updated_at"] = iso_now()
            if set_fields:
                await db.student_scores.update_one(
                    {"student_id": student_id, "week_id": week_id},
                    {"$set": set_fields},
                    upsert=True,
                )
        processed_rows += 1
    if processed_rows == 0:
        raise HTTPException(
            status_code=400,
            detail="No students were imported. Please use an Excel file with one column for student names and one for class (e.g. 4A, 5B, 6A). Columns can be in any order.",
        )
    return {
        "created_students": created_students,
        "updated_students": updated_students,
        "created_classes": created_classes,
    }


async def send_weekly_admin_reports():
    try:
        settings = await get_report_settings()
        grade = int(settings.get("grade", 4))
        summary = await get_grade_report(grade)
        report_pdf = generate_report_pdf(summary, grade)
        report_excel = generate_report_excel(summary, grade)
        admins = await db.users.find({"role_name": "Admin", "active": True}, {"_id": 0}).to_list(200)
        recipients = [admin["email"] for admin in admins if admin.get("email")]
        if recipients:
            send_report_email(recipients, report_pdf, report_excel, grade)
    except Exception as exc:
        logger.error("Weekly report email failed: %s", exc)


@app.on_event("startup")
async def start_scheduler():
    if not scheduler.running:
        scheduler.start()
    scheduler.add_job(
        send_weekly_admin_reports,
        CronTrigger(day_of_week="sun", hour=8, minute=0, timezone=REPORT_TIMEZONE),
        id="weekly_admin_report",
        replace_existing=True,
    )


@app.on_event("startup")
async def seed_defaults():
    try:
        # Test MongoDB connection
        await client.admin.command('ping')
        logger.info("MongoDB connection successful")
    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        logger.error("Please check your MONGO_URL in .env file and ensure MongoDB Atlas is accessible")
        return  # Don't proceed if connection fails
    
    try:
        # Performance: ensure key indexes exist for frequent reads/writes.
        await db.students.create_index([("id", 1)])
        await db.students.create_index([("class_id", 1)])
        await db.students.create_index([("full_name", 1), ("class_id", 1)])
        await db.student_scores.create_index([("student_id", 1)])
        await db.student_scores.create_index([("week_id", 1)])
        await db.student_scores.create_index([("student_id", 1), ("week_id", 1)])
        await db.weeks.create_index([("id", 1)])
        await db.weeks.create_index([("semester", 1), ("quarter", 1), ("number", 1)])
        await db.classes.create_index([("id", 1)])
        await db.classes.create_index([("name", 1)])
        await db.users.create_index([("id", 1)])
        await db.users.create_index([("role_name", 1)])

        if await db.classes.count_documents({}) == 0:
            default_classes = []
            for grade in range(4, 9):
                for section in ["A", "B"]:
                    name = f"{grade}{section}"
                    default_classes.append(
                        ClassRecord(name=name, grade=grade, section=section).model_dump()
                    )
            await db.classes.insert_many(default_classes)
        if await db.roles.count_documents({}) == 0:
            roles = [
                RoleRecord(name="Admin", description="Full access", permissions=["all"]).model_dump(),
                RoleRecord(
                    name="Teacher",
                    description="Manage classes and students",
                    permissions=["students:view", "scores:edit", "remedial:manage", "reports:view", "timetable:manage"],
                ).model_dump(),
                RoleRecord(name="Counselor", description="Remedial and rewards", permissions=["remedial", "rewards", "reports"]).model_dump(),
            ]
            await db.roles.insert_many(roles)
        await db.weeks.update_many({"semester": {"$exists": False}}, {"$set": {"semester": 1}})
        # Migration: set quarter on existing weeks (1-9 -> Q1, 10-18 -> Q2) for full S1Q1/S1Q2/S2Q1/S2Q2 separation
        async for doc in db.weeks.find({"$or": [{"quarter": {"$exists": False}}, {"quarter": {"$nin": [1, 2]}}]}, {"_id": 1, "number": 1}):
            q = 1 if (doc.get("number", 1) <= 9) else 2
            await db.weeks.update_one({"_id": doc["_id"]}, {"$set": {"quarter": q}})
        existing_weeks = await db.weeks.find({}, {"_id": 0, "number": 1, "semester": 1, "quarter": 1}).to_list(500)
        existing_map = {}
        for week in existing_weeks:
            sem = week.get("semester", 1)
            q = week.get("quarter", 1 if week.get("number", 1) <= 9 else 2)
            existing_map.setdefault((sem, q), set()).add(week.get("number"))
        weeks_to_insert = []
        for semester in [1, 2]:
            for quarter in [1, 2]:
                lo, hi = (1, 9) if quarter == 1 else (10, 18)
                existing_numbers = existing_map.get((semester, quarter), set())
                for i in range(lo, hi + 1):
                    if i not in existing_numbers:
                        weeks_to_insert.append(
                            WeekRecord(semester=semester, quarter=quarter, number=i, label=f"Week {i}").model_dump()
                        )
        if weeks_to_insert:
            await db.weeks.insert_many(weeks_to_insert)
        if await db.users.count_documents({}) == 0:
            admin_role = await db.roles.find_one({"name": "Admin"}, {"_id": 0})
            if admin_role:
                admin_user = UserRecord(
                    name="Administrator",
                    email="admin@school.local",
                    username="admin",
                    role_id=admin_role["id"],
                    role_name=admin_role["name"],
                    active=True,
                    permissions=admin_role.get("permissions", []),
                    password_hash=get_password_hash("Admin@123"),
                )
                await db.users.insert_one(admin_user.model_dump())
        admin_user = await db.users.find_one({"role_name": "Admin"}, {"_id": 0})
        if admin_user:
            updates = {}
            if not admin_user.get("username"):
                updates["username"] = "admin"
            if not admin_user.get("password_hash"):
                updates["password_hash"] = get_password_hash("Admin@123")
            if updates:
                await db.users.update_one({"id": admin_user["id"]}, {"$set": updates})
        # Remove legacy sample student "Sara Ali" (4A) if present – was never a real student
        sample_students = await db.students.find(
            {"full_name": "Sara Ali", "class_name": "4A"}, {"_id": 0, "id": 1}
        ).to_list(10)
        for s in sample_students:
            sid = s.get("id")
            if sid:
                await db.student_scores.delete_many({"student_id": sid})
                await db.students.delete_one({"id": sid})
                logger.info("Removed legacy sample student Sara Ali (4A)")
    except Exception as e:
        logger.error(f"Error during database seeding: {e}")
        logger.warning("Continuing without seeding defaults. Some features may not work correctly.")


app.include_router(auth_router)
app.include_router(api_router)

_cors_origins_raw = os.environ.get("CORS_ORIGINS", "*").strip()
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()] if _cors_origins_raw else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()