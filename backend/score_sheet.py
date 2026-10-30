"""Strict score-sheet parsing and reference-format Excel export helpers.

The uploaded school-platform sheet contains many metadata columns, but score
imports deliberately trust only the unshaded source columns needed for matching:
student name and submission grade. No enrollment or assessment metadata is read.
"""
from __future__ import annotations

import io
import math
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Any, Callable, Dict, Iterable, List, Tuple

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill


REFERENCE_HEADERS = [
    "اسم الطالب",
    "اسم المعلم",
    "المستوى",
    "درجة التسليم",
    "النسبة المئوية%",
    "تم التصحيح",
    "اسم الاختبار",
    "زمن الاختبار",
    "تم التسليم",
    "تاريخ النشر",
    "تاريخ التسليم",
]

NAME_HEADERS = {
    "اسمالطالب", "الطالب", "studentname", "student", "fullname", "studentfullname",
    # The newer test-platform export labels the same column "الاسم الكامل".
    "الاسمالكامل", "الاسم",
}
SCORE_HEADERS = {
    "درجةالتسليم", "درجهالتسليم", "submissiongrade", "submittedgrade", "submissionscore",
    # The school's actual test-platform export for the International section uses
    # "Submission Mark" rather than "Submission Grade" - both mean the same column.
    "submissionmark", "submittedmark",
    # The newer Arabic export simply calls it "الدرجة".
    "الدرجة", "الدرجه",
}
# Only used when no header matches SCORE_HEADERS exactly, so a future export that
# names the column "درجة الاختبار" still imports. Deliberately not mirrored for
# names: "اسم المعلم" would otherwise be picked up as the student column.
SCORE_HEADER_PREFIXES = ("درجة", "درجه")
# Optional column. When present it is far more reliable than the name, which the
# test platform and the roster often spell differently.
ID_HEADERS = {
    "رقمالهوية", "الهوية", "رقمالطالب", "رقمالهويةالوطنية",
    "studentid", "studentnumber", "identitynumber", "nationalid",
}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class ScoreSheetError(ValueError):
    """Stable API-facing validation code."""


def normalize_header(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().lower()
    return re.sub(r"[^\w\d]+", "", text, flags=re.UNICODE)


def normalize_student_name(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).strip().lower()
    text = re.sub(r"[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]", "", text)
    text = text.translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي"}))
    return re.sub(r"[^\w\d]+", "", text, flags=re.UNICODE)


def normalize_student_number(value: Any) -> str:
    """Reduce an identity number to bare digits.

    The same ID arrives as text in one export and as a spreadsheet number in
    another, so a plain str() would turn 1182751840 into "1182751840.0" and
    never match the roster.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    if isinstance(value, bool):
        return ""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    text = unicodedata.normalize("NFKC", str(value)).strip()
    text = text.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    return "".join(character for character in text if character.isdigit())


def parse_score_value(value: Any) -> float | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, bool):
        raise ScoreSheetError("score_sheet_invalid_score")
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        cleaned = cleaned.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
        cleaned = cleaned.replace("٫", ".").replace("٬", "").replace(",", ".")
        try:
            number = float(cleaned)
        except ValueError as exc:
            raise ScoreSheetError("score_sheet_invalid_score") from exc
    else:
        try:
            number = float(value)
        except (TypeError, ValueError) as exc:
            raise ScoreSheetError("score_sheet_invalid_score") from exc
    if not math.isfinite(number):
        raise ScoreSheetError("score_sheet_invalid_score")
    return number


def _header_positions(values: Iterable[Any]) -> Dict[str, int]:
    positions: Dict[str, int] = {}
    prefixed_score: int | None = None
    for index, value in enumerate(values):
        normalized = normalize_header(value)
        if normalized in NAME_HEADERS and "name" not in positions:
            positions["name"] = index
        if normalized in SCORE_HEADERS and "score" not in positions:
            positions["score"] = index
        if normalized in ID_HEADERS and "number" not in positions:
            positions["number"] = index
        if prefixed_score is None and normalized.startswith(SCORE_HEADER_PREFIXES):
            prefixed_score = index
    if "score" not in positions and prefixed_score is not None:
        positions["score"] = prefixed_score
    return positions


def read_score_sheet(content: bytes, filename: str) -> Dict[str, Any]:
    """Read only the exact student-name and submission-grade source columns."""
    lowered = (filename or "").lower()
    if not lowered.endswith((".xlsx", ".xls", ".csv")):
        raise ScoreSheetError("score_sheet_file_type")
    if not content or len(content) > MAX_UPLOAD_BYTES:
        raise ScoreSheetError("score_sheet_file_size")

    candidates: List[Tuple[str, pd.DataFrame]] = []
    try:
        if lowered.endswith(".csv"):
            candidates.append((filename or "CSV", pd.read_csv(io.BytesIO(content), header=None, dtype=object)))
        else:
            engine = "xlrd" if lowered.endswith(".xls") else None
            book = pd.ExcelFile(io.BytesIO(content), engine=engine)
            for sheet_name in book.sheet_names:
                candidates.append((sheet_name, book.parse(sheet_name, header=None, dtype=object)))
    except Exception as exc:
        raise ScoreSheetError("score_sheet_invalid_file") from exc

    selected = None
    for sheet_name, frame in candidates:
        for row_index in range(min(10, len(frame.index))):
            positions = _header_positions(frame.iloc[row_index].tolist())
            if "name" in positions and "score" in positions:
                selected = (sheet_name, frame, row_index, positions)
                break
        if selected:
            break
    if not selected:
        raise ScoreSheetError("score_sheet_missing_columns")

    sheet_name, frame, header_row, positions = selected
    rows: List[Dict[str, Any]] = []
    blank_name_count = 0
    for row_index in range(header_row + 1, len(frame.index)):
        row = frame.iloc[row_index]
        raw_name = row.iloc[positions["name"]] if positions["name"] < len(row) else None
        if raw_name is None or (isinstance(raw_name, float) and pd.isna(raw_name)) or not str(raw_name).strip():
            blank_name_count += 1
            continue
        raw_score = row.iloc[positions["score"]] if positions["score"] < len(row) else None
        number_index = positions.get("number")
        raw_number = row.iloc[number_index] if number_index is not None and number_index < len(row) else None
        rows.append({
            "row": row_index + 1,
            "name": str(raw_name).strip(),
            "raw_score": raw_score,
            "student_number": normalize_student_number(raw_number),
        })
    if not rows:
        raise ScoreSheetError("score_sheet_no_students")
    return {"sheet_name": sheet_name, "rows": rows, "blank_name_count": blank_name_count}


def match_score_rows(
    imported_rows: List[Dict[str, Any]],
    roster: List[Dict[str, Any]],
    max_score_for: Callable[[Dict[str, Any]], float],
    current_score_for: Callable[[Dict[str, Any]], Any],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Match each row to one roster student and validate against its maximum."""
    roster_by_name: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    roster_by_number: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for student in roster:
        number = normalize_student_number(student.get("student_number"))
        if number:
            roster_by_number[number].append(student)
        # alt_full_name lets one student match under either script (e.g. a name kept in
        # English for an International-section roster plus an Arabic alias), since the
        # source test platform sometimes exports the same class's names in either
        # language. Dedupe keys per student first so a student whose two names happen
        # to normalize the same doesn't get listed twice under that key (which would
        # make them look ambiguous against themselves).
        keys = {normalize_student_name(value) for value in (student.get("full_name"), student.get("alt_full_name"))}
        for key in keys:
            if key:
                roster_by_name[key].append(student)

    def resolve(row: Dict[str, Any]) -> Tuple[str, Dict[str, Any] | None, bool]:
        """Identify the roster student for one row: (identity, student, ambiguous).

        The identity number wins when it is present and unique, because the test
        platform and the roster regularly spell the same student's name
        differently; the name is only consulted as a fallback.
        """
        number = normalize_student_number(row.get("student_number"))
        if number:
            found = roster_by_number.get(number, [])
            if len(found) == 1:
                return f"number:{number}", found[0], False
            if len(found) > 1:
                return f"number:{number}", None, True
        key = normalize_student_name(row.get("name"))
        found = roster_by_name.get(key, [])
        if len(found) == 1:
            return f"name:{key}", found[0], False
        return f"name:{key}", None, len(found) > 1

    resolutions = [resolve(row) for row in imported_rows]
    # Two rows pointing at the same student are ambiguous and are applied to nobody.
    duplicate_keys = {
        identity for identity, count in Counter(identity for identity, _, _ in resolutions).items()
        if count > 1 and identity not in ("name:", "number:")
    }
    matches: List[Dict[str, Any]] = []
    unmatched_names: List[str] = []
    ambiguous_names: List[str] = []
    invalid_rows: List[Dict[str, Any]] = []
    blank_scores = 0
    duplicate_count = 0
    new_count = overwrite_count = unchanged_count = 0

    for row, (identity, student, ambiguous) in zip(imported_rows, resolutions):
        if identity in duplicate_keys:
            duplicate_count += 1
            continue
        if ambiguous:
            ambiguous_names.append(row["name"])
            continue
        if student is None:
            unmatched_names.append(row["name"])
            continue
        try:
            score = parse_score_value(row.get("raw_score"))
            if score is None:
                blank_scores += 1
                continue
            maximum = float(max_score_for(student))
            if score < 0 or score > maximum:
                raise ScoreSheetError("score_sheet_score_out_of_range")
        except (ScoreSheetError, TypeError, ValueError) as exc:
            code = str(exc) if isinstance(exc, ScoreSheetError) else "score_sheet_invalid_score"
            invalid_rows.append({"row": row["row"], "name": row["name"], "reason": code})
            continue
        current = current_score_for(student)
        if current is None:
            new_count += 1
        elif float(current) == score:
            unchanged_count += 1
        else:
            overwrite_count += 1
        matches.append({"student_id": student["id"], "name": student.get("full_name"), "score": score, "current": current})

    summary = {
        "rows_total": len(imported_rows),
        "matched_count": len(matches),
        "new_count": new_count,
        "overwrite_count": overwrite_count,
        "unchanged_count": unchanged_count,
        "unmatched_count": len(unmatched_names),
        "ambiguous_count": len(ambiguous_names),
        "duplicate_count": duplicate_count,
        "invalid_count": len(invalid_rows),
        "blank_score_count": blank_scores,
        "unmatched_names": unmatched_names[:20],
        "ambiguous_names": ambiguous_names[:20],
        "invalid_rows": invalid_rows[:20],
    }
    return summary, matches


def _excel_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value
    return "" if value is None else value


def build_reference_score_workbook(rows: List[Dict[str, Any]]) -> bytes:
    """Export the exact 11-column reference order and shaded-column convention."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Sheet1"
    ws.sheet_view.rightToLeft = True
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:K{max(1, len(rows) + 1)}"
    ws.append(REFERENCE_HEADERS)

    keys = [
        "student_name", "teacher_name", "level", "score", "percentage", "corrected",
        "test_name", "duration", "submitted_at", "published_at", "due_at",
    ]
    for row in rows:
        ws.append([_excel_value(row.get(key)) for key in keys])

    gray = PatternFill("solid", fgColor="D9D9D9")
    white = PatternFill("solid", fgColor="FFFFFF")
    shaded_columns = {2, 6, 7, 8, 9, 10, 11}
    for column in range(1, 12):
        fill = gray if column in shaded_columns else white
        for cell in ws.iter_cols(min_col=column, max_col=column, min_row=1, max_row=max(1, len(rows) + 1)):
            for item in cell:
                item.fill = fill
                item.font = Font(name="Calibri", size=11)
                item.alignment = Alignment(horizontal="right", vertical="center")
    for cell in ws[1]:
        cell.font = Font(name="Calibri", size=11, bold=True)

    widths = [28, 24, 14, 16, 18, 16, 34, 14, 22, 22, 22]
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[chr(64 + index)].width = width
    for row_index in range(2, len(rows) + 2):
        ws.cell(row_index, 5).number_format = "0.00"

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()
