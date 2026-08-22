"""Parse approved Al Anjal school calendar PDFs into year-scoped structured records.

The parser targets the four-page Al Anjal calendar table layout, but derives every
year and date from the uploaded document. It performs no network requests and does
not contain a permanent academic-year dataset.
"""

from __future__ import annotations

import hashlib
import io
import re
import uuid
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from pypdf import PdfReader


SOURCE_NAME_EN = "Al Anjal Private Schools Academic Calendar"
SOURCE_NAME_AR = "التقويم الدراسي لمدارس الأنجال الأهلية"
SOURCE_TYPE = "approved_school_pdf"

DATE_PAIR_RE = re.compile(
    r"(?P<hday>\d{1,2})\s*/\s*(?P<hmonth>\d{1,2})\s*/\s*(?P<hyear>\d{4})\s*هـ"
    r"[\s\S]{0,45}?"
    r"(?P<gday>\d{1,2})\s*/\s*(?P<gmonth>\d{1,2})\s*/\s*(?P<gyear>\d{4})\s*م"
)

ARABIC_WEEK_NAMES = {
    1: "الأسبوع الأول", 2: "الأسبوع الثاني", 3: "الأسبوع الثالث", 4: "الأسبوع الرابع",
    5: "الأسبوع الخامس", 6: "الأسبوع السادس", 7: "الأسبوع السابع", 8: "الأسبوع الثامن",
    9: "الأسبوع التاسع", 10: "الأسبوع العاشر", 11: "الأسبوع الحادي عشر",
    12: "الأسبوع الثاني عشر", 13: "الأسبوع الثالث عشر", 14: "الأسبوع الرابع عشر",
    15: "الأسبوع الخامس عشر", 16: "الأسبوع السادس عشر", 17: "الأسبوع السابع عشر",
    18: "الأسبوع الثامن عشر", 19: "الأسبوع التاسع عشر",
}


class CalendarImportError(ValueError):
    pass


def select_calendar_for_date(calendars: List[Dict[str, Any]], today: str) -> Optional[Dict[str, Any]]:
    """Select the imported year whose date window contains today, with safe fallbacks."""
    ordered = sorted(calendars, key=lambda item: item.get("academic_year_start") or "", reverse=True)
    in_range = [
        item for item in ordered
        if (item.get("academic_year_start") or "") <= today
        and (not item.get("next_academic_year_start") or today < item["next_academic_year_start"])
    ]
    if in_range:
        return in_range[0]
    already_started = [item for item in ordered if (item.get("academic_year_start") or "") <= today]
    return already_started[0] if already_started else (ordered[-1] if ordered else None)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_iso(year: int, month: int, day: int) -> Optional[str]:
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _hijri_value(year: int, month: int, day: int) -> Optional[str]:
    if not (1 <= month <= 12 and 1 <= day <= 30):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def _date_pairs(text: str) -> List[Dict[str, Any]]:
    pairs: List[Dict[str, Any]] = []
    for match in DATE_PAIR_RE.finditer(text):
        values = {key: int(value) for key, value in match.groupdict().items()}
        pairs.append({
            **values,
            "gregorian": _safe_iso(values["gyear"], values["gmonth"], values["gday"]),
            "hijri": _hijri_value(values["hyear"], values["hmonth"], values["hday"]),
            "raw": match.group(0).strip(),
        })
    return pairs


def _dominant_gregorian_year(pairs: Iterable[Dict[str, Any]]) -> Optional[int]:
    years = [pair["gyear"] for pair in pairs if pair.get("gregorian")]
    return Counter(years).most_common(1)[0][0] if years else None


def _week_event(
    *, semester: int, week_number: Optional[int], row_type: str, pairs: List[Dict[str, Any]],
    order: str, academic_year: str, hijri_year: str, source_document: str,
) -> Dict[str, Any]:
    if len(pairs) != 5:
        raise CalendarImportError("Each calendar table row must contain five school-day date pairs")
    ordered = pairs if order == "forward" else list(reversed(pairs))
    start_pair, end_pair = ordered[0], ordered[-1]
    dominant_year = _dominant_gregorian_year(pairs)
    issues: List[str] = []
    for position, pair in enumerate(ordered, start=1):
        if pair.get("gregorian") is None:
            issues.append(f"Invalid Gregorian value in school-day cell {position}: {pair['raw']}")
        elif dominant_year and pair["gyear"] != dominant_year:
            issues.append(f"Gregorian year anomaly in school-day cell {position}: {pair['raw']}")
        if pair.get("hijri") is None:
            issues.append(f"Invalid Hijri value in school-day cell {position}: {pair['raw']}")
    for position, (previous, current) in enumerate(zip(ordered, ordered[1:]), start=2):
        if previous.get("hijri") and current.get("hijri"):
            same_month_next_day = current["hmonth"] == previous["hmonth"] and current["hday"] == previous["hday"] + 1
            valid_month_rollover = (
                current["hmonth"] == previous["hmonth"] + 1
                and current["hday"] == 1
                and previous["hday"] in {29, 30}
            )
            if not (same_month_next_day or valid_month_rollover):
                issues.append(f"Non-consecutive Hijri value in school-day cell {position}: {current['raw']}")

    start_gregorian = start_pair.get("gregorian") if start_pair.get("gyear") == dominant_year else None
    end_gregorian = end_pair.get("gregorian") if end_pair.get("gyear") == dominant_year else None
    if row_type == "preparation_week":
        title_ar, title_en = "أسبوع التهيئة", "Preparation Week"
    elif row_type == "autumn_break":
        title_ar, title_en = "إجازة الخريف", "Autumn Break"
    else:
        title_ar = ARABIC_WEEK_NAMES.get(week_number or 0, f"الأسبوع {week_number}")
        title_en = f"Teaching Week {week_number}"

    return {
        "id": str(uuid.uuid4()),
        "academic_year": academic_year,
        "hijri_year": hijri_year,
        "semester": semester,
        "week_number": week_number,
        "event_type": row_type,
        "title_ar": title_ar,
        "title_en": title_en,
        "gregorian_start": start_gregorian,
        "gregorian_end": end_gregorian,
        "hijri_start": start_pair.get("hijri"),
        "hijri_end": end_pair.get("hijri"),
        "is_holiday": row_type == "autumn_break",
        "is_exam_period": False,
        "source": SOURCE_NAME_EN,
        "source_document": source_document,
        "verified": not issues,
        "manual_review_note": "; ".join(issues) or None,
        "details": {"source_date_cells": [pair["raw"] for pair in ordered]},
    }


def _event_from_dates(
    *, academic_year: str, hijri_year: str, semester: Optional[int], event_type: str,
    title_ar: str, title_en: str, start: Dict[str, Any], end: Optional[Dict[str, Any]] = None,
    source_document: str, is_holiday: bool = False, is_exam_period: bool = False,
    verified: bool = True, note: Optional[str] = None,
) -> Dict[str, Any]:
    end = end or start
    return {
        "id": str(uuid.uuid4()), "academic_year": academic_year, "hijri_year": hijri_year,
        "semester": semester, "week_number": None, "event_type": event_type,
        "title_ar": title_ar, "title_en": title_en,
        "gregorian_start": start.get("gregorian"), "gregorian_end": end.get("gregorian"),
        "hijri_start": start.get("hijri"), "hijri_end": end.get("hijri"),
        "is_holiday": is_holiday, "is_exam_period": is_exam_period,
        "source": SOURCE_NAME_EN, "source_document": source_document,
        "verified": verified and bool(start.get("gregorian")) and bool(end.get("gregorian")),
        "manual_review_note": note,
        "details": {},
    }


def _page_rows(
    page_pairs: List[List[Dict[str, Any]]], academic_year: str, hijri_year: str, source_document: str
) -> List[Dict[str, Any]]:
    layout: List[Tuple[int, str, List[Tuple[str, Optional[int]]]]] = [
        (1, "forward", [("preparation_week", 0)] + [("teaching_week", n) for n in range(1, 13)]),
        (1, "forward", [("teaching_week", 13), ("autumn_break", None)] + [("teaching_week", n) for n in range(14, 20)]),
        (2, "reverse", [("teaching_week", n) for n in range(1, 14)]),
        (2, "reverse", [("teaching_week", n) for n in range(14, 20)]),
    ]
    rows: List[Dict[str, Any]] = []
    for page_index, (semester, order, descriptors) in enumerate(layout):
        expected_pairs = len(descriptors) * 5
        if len(page_pairs[page_index]) < expected_pairs:
            raise CalendarImportError(
                f"PDF page {page_index + 1} has {len(page_pairs[page_index])} date pairs; {expected_pairs} are required"
            )
        for row_index, (row_type, week_number) in enumerate(descriptors):
            offset = row_index * 5
            rows.append(_week_event(
                semester=semester, week_number=week_number, row_type=row_type,
                pairs=page_pairs[page_index][offset:offset + 5], order=order,
                academic_year=academic_year, hijri_year=hijri_year, source_document=source_document,
            ))
    return rows


def _pair_from_event(event: Dict[str, Any], edge: str) -> Dict[str, Any]:
    return {"gregorian": event.get(f"gregorian_{edge}"), "hijri": event.get(f"hijri_{edge}")}


def _major_events(rows: List[Dict[str, Any]], page_texts: List[str], academic_year: str, hijri_year: str, source_document: str) -> List[Dict[str, Any]]:
    weeks = {(row["semester"], row["week_number"]): row for row in rows if row["event_type"] == "teaching_week"}
    s1w1, s1w5, s1w13, s1w19 = weeks[(1, 1)], weeks[(1, 5)], weeks[(1, 13)], weeks[(1, 19)]
    s2w1, s2w6, s2w7, s2w14, s2w15, s2w19 = (weeks[(2, n)] for n in (1, 6, 7, 14, 15, 19))
    autumn = next(row for row in rows if row["event_type"] == "autumn_break")

    # The Semester 1 footer visibly confirms 29/7/1448 for the mid-year start even
    # though the Week 19 Thursday table cell itself is malformed (79/7/1448).
    midyear_hijri_match = re.search(r"إجازة منتصف العام[\s\S]{0,100}?(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})\s*هـ", page_texts[1])
    midyear_start = _pair_from_event(s1w19, "end")
    if midyear_hijri_match:
        day, month, year = (int(value) for value in midyear_hijri_match.groups())
        midyear_start["hijri"] = _hijri_value(year, month, day)

    next_year_pairs = _date_pairs(page_texts[3].split("بداية العام الدراسي", 1)[-1])
    next_year_start = next_year_pairs[-1] if next_year_pairs else {"gregorian": None, "hijri": None}

    # Build highlighted holidays from their visually identified weekday cells.
    def row_cell(row: Dict[str, Any], index: int) -> Dict[str, Any]:
        raw = row["details"]["source_date_cells"][index]
        pairs = _date_pairs(raw)
        return pairs[0] if pairs else {"gregorian": None, "hijri": None}

    # The footer defines Autumn Break from the end of Week 13 Thursday dismissal,
    # while the highlighted break row lists the following Sunday through Thursday.
    autumn["gregorian_start"] = s1w13["gregorian_end"]
    autumn["hijri_start"] = s1w13["hijri_end"]
    events = [
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=1, event_type="semester_start", title_ar="بداية الفصل الدراسي الأول", title_en="Semester 1 Starts", start=_pair_from_event(s1w1, "start"), source_document=source_document),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=1, event_type="national_day", title_ar="إجازة اليوم الوطني", title_en="National Day Holiday", start=row_cell(s1w5, 3), end=row_cell(s1w5, 4), source_document=source_document, is_holiday=True),
    ]
    events.extend([
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=1, event_type="final_exams", title_ar="الاختبارات النهائية للفصل الدراسي الأول", title_en="Semester 1 Final Examination Period", start=_pair_from_event(s1w19, "start"), end=midyear_start, source_document=source_document, is_exam_period=True),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=1, event_type="semester_end", title_ar="نهاية الفصل الدراسي الأول", title_en="Semester 1 Ends", start=midyear_start, source_document=source_document, verified=bool(midyear_start.get("gregorian"))),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=1, event_type="midyear_vacation", title_ar="بداية إجازة منتصف العام", title_en="Mid-Year Vacation Starts", start=midyear_start, source_document=source_document, is_holiday=True),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="semester_start", title_ar="بداية الفصل الدراسي الثاني", title_en="Semester 2 Starts", start=_pair_from_event(s2w1, "start"), source_document=source_document),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="foundation_day", title_ar="إجازة يوم التأسيس", title_en="Foundation Day Holiday", start=row_cell(s2w6, 0), end=row_cell(s2w6, 1), source_document=source_document, is_holiday=True),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="eid_fitr_vacation", title_ar="بداية إجازة عيد الفطر", title_en="Eid Al-Fitr Vacation Starts", start=row_cell(s2w6, 4), source_document=source_document, is_holiday=True),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="eid_fitr_return", title_ar="العودة بعد إجازة عيد الفطر", title_en="Return After Eid Al-Fitr", start=row_cell(s2w7, 0), source_document=source_document),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="eid_adha_vacation", title_ar="بداية إجازة عيد الأضحى", title_en="Eid Al-Adha Vacation Starts", start=row_cell(s2w14, 4), source_document=source_document, is_holiday=True),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="eid_adha_return", title_ar="العودة بعد إجازة عيد الأضحى", title_en="Return After Eid Al-Adha", start=row_cell(s2w15, 0), source_document=source_document),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="final_exams", title_ar="الاختبارات النهائية للفصل الدراسي الثاني", title_en="Semester 2 Final Examination Period", start=_pair_from_event(s2w19, "start"), end=_pair_from_event(s2w19, "end"), source_document=source_document, is_exam_period=True),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="academic_year_end", title_ar="نهاية العام الدراسي للطلاب", title_en="End of Academic Year for Students", start=_pair_from_event(s2w19, "end"), source_document=source_document),
        _event_from_dates(academic_year=academic_year, hijri_year=hijri_year, semester=2, event_type="next_academic_year_start", title_ar="بداية العام الدراسي التالي", title_en="Next Academic Year Starts", start=next_year_start, source_document=source_document),
    ])
    autumn["details"]["note_ar"] = "تبدأ من نهاية دوام الخميس وتنتهي في التاريخ الموضح"
    autumn["details"]["note_en"] = "Begins after Thursday dismissal and ends on the displayed date"
    return events


def parse_anjal_calendar_pdf(content: bytes, filename: str) -> Dict[str, Any]:
    if not content.startswith(b"%PDF"):
        raise CalendarImportError("The uploaded file is not a valid PDF")
    try:
        reader = PdfReader(io.BytesIO(content))
    except Exception as exc:
        raise CalendarImportError("The PDF could not be opened") from exc
    if len(reader.pages) != 4:
        raise CalendarImportError("The approved Al Anjal calendar template must contain exactly four pages")

    page_texts = [page.extract_text() or "" for page in reader.pages]
    full_text = "\n".join(page_texts)
    title_match = re.search(r"للعام\s+(\d{4})\s*هـ", full_text)
    if not title_match:
        raise CalendarImportError("The Hijri academic year could not be read from the PDF title")
    hijri_year_number = int(title_match.group(1))
    hijri_year = f"{hijri_year_number}H"
    page_pairs = [_date_pairs(text) for text in page_texts]
    first_pair = page_pairs[0][0] if page_pairs and page_pairs[0] else None
    if not first_pair or not first_pair.get("gregorian"):
        raise CalendarImportError("The preparation-week start date could not be read")
    start_year = int(first_pair["gregorian"][:4])
    academic_year = f"{start_year}-{start_year + 1}"
    rows = _page_rows(page_pairs, academic_year, hijri_year, filename)
    if re.search(r"الأسبوع\s+التاسع[\s\n]+عشر\s*96", full_text):
        semester_two_week_nineteen = next(
            event for event in rows
            if event["semester"] == 2 and event["week_number"] == 19 and event["event_type"] == "teaching_week"
        )
        label_note = 'Unexpected "96" is printed beside the Semester 2 Week 19 label.'
        semester_two_week_nineteen["verified"] = False
        semester_two_week_nineteen["manual_review_note"] = "; ".join(
            note for note in [semester_two_week_nineteen.get("manual_review_note"), label_note] if note
        )
    events = rows + _major_events(rows, page_texts, academic_year, hijri_year, filename)

    teaching_weeks = [event for event in events if event["event_type"] == "teaching_week"]
    if len(teaching_weeks) != 38 or {event["semester"] for event in teaching_weeks} != {1, 2}:
        raise CalendarImportError("The PDF must contain 19 teaching weeks in each semester")
    required_types = {"preparation_week", "national_day", "autumn_break", "midyear_vacation", "foundation_day", "eid_fitr_vacation", "eid_fitr_return", "eid_adha_vacation", "eid_adha_return", "academic_year_end", "next_academic_year_start"}
    missing = required_types - {event["event_type"] for event in events}
    if missing:
        raise CalendarImportError(f"Required calendar events are missing: {', '.join(sorted(missing))}")

    next_start = next(event for event in events if event["event_type"] == "next_academic_year_start")
    manual_review = [event for event in events if not event["verified"]]
    imported_at = _iso_now()
    return {
        "calendar": {
            "id": f"academic-calendar:{academic_year}",
            "academic_year": academic_year,
            "hijri_year": hijri_year,
            "source_name": SOURCE_NAME_EN,
            "source_name_ar": SOURCE_NAME_AR,
            "source_type": SOURCE_TYPE,
            "source_document": filename,
            "source_sha256": hashlib.sha256(content).hexdigest(),
            "academic_year_start": first_pair["gregorian"],
            "next_academic_year_start": next_start.get("gregorian_start"),
            "imported_at": imported_at,
            "updated_at": imported_at,
            "event_count": len(events),
            "teaching_week_count": len(teaching_weeks),
            "manual_review_count": len(manual_review),
            "status": "needs_review" if manual_review else "verified",
        },
        "events": events,
    }
