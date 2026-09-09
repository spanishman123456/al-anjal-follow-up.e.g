"""Remedial-candidate snapshots and bilingual PDF reports.

The score source is resolved by ``server.py`` so this module stays database-free.
Only recorded scores strictly below 50% are included; blanks are never treated as
zero.  PDF copy follows the school's supplied Arabic and English diagnostic-report
examples while keeping the assessment name, subject and weakness editable.
"""

from __future__ import annotations

import hashlib
import io
import json
import textwrap
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT_DIR = Path(__file__).resolve().parent
FONT_DIR = ROOT_DIR / "assets" / "fonts"
LOGO_PATH = ROOT_DIR.parent / "frontend" / "public" / "logo.png"
ARABIC_FONT = "Amiri"
ARABIC_FONT_BOLD = "Amiri-Bold"
LATIN_FONT = "Helvetica"
LATIN_FONT_BOLD = "Helvetica-Bold"


def _register_fonts() -> None:
    if ARABIC_FONT not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(ARABIC_FONT, str(FONT_DIR / "Amiri-Regular.ttf")))
    if ARABIC_FONT_BOLD not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(ARABIC_FONT_BOLD, str(FONT_DIR / "Amiri-Bold.ttf")))


def _number(value: Any) -> str:
    if value is None:
        return "-"
    numeric = round(float(value), 2)
    if numeric.is_integer():
        return str(int(numeric))
    return f"{numeric:.2f}".rstrip("0").rstrip(".")


def _jsonable(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


def build_remedial_snapshot(
    *,
    source_type: str,
    source_id: Optional[str],
    source_label: str,
    school_section: str,
    academic_year: str,
    semester: int,
    quarter: Optional[int],
    maximum: float,
    rows: Iterable[Dict[str, Any]],
    classes: Iterable[Dict[str, Any]],
    class_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create the canonical DTO consumed by preview and PDF export."""
    max_score = float(maximum)
    if max_score <= 0:
        raise ValueError("Remedial report maximum must be greater than zero")

    normalized_rows: List[Dict[str, Any]] = []
    # Mirrors normalized_rows for the >=50% side, so a report can still be built (praising
    # the whole class and proposing enrichment work) when nobody actually needs remediation -
    # otherwise that "everyone passed" case would have no student list to put in the letter at all.
    top_rows: List[Dict[str, Any]] = []
    scored_count = 0
    for item in rows:
        if class_id and item.get("class_id") != class_id:
            continue
        score = item.get("score")
        if score is None:
            continue
        numeric_score = float(score)
        scored_count += 1
        percentage = numeric_score / max_score * 100
        entry = {
            "id": str(item.get("id") or item.get("student_id") or ""),
            "full_name": str(item.get("full_name") or item.get("student_name") or "").strip(),
            "class_id": str(item.get("class_id") or ""),
            "class_name": str(item.get("class_name") or "").strip(),
            "score": round(numeric_score, 2),
            "maximum": round(max_score, 2),
            "score_label": f"{_number(numeric_score)} / {_number(max_score)}",
            "percentage": round(percentage, 2),
        }
        (normalized_rows if percentage < 50 else top_rows).append(entry)

    normalized_rows.sort(key=lambda item: (item["class_name"].casefold(), item["full_name"].casefold()))
    top_rows.sort(key=lambda item: (item["class_name"].casefold(), item["full_name"].casefold()))
    visible_classes = [
        {
            "id": str(item.get("id") or ""),
            "name": str(item.get("name") or item.get("class_name") or item.get("id") or ""),
        }
        for item in classes
        if not class_id or str(item.get("id") or "") == class_id
    ]
    snapshot: Dict[str, Any] = {
        "source": {
            "type": source_type,
            "id": source_id,
            "label": source_label,
            "maximum": round(max_score, 2),
            "threshold": round(max_score * 0.5, 2),
            "threshold_percentage": 50,
        },
        "scope": {
            "school_section": school_section,
            "academic_year": academic_year,
            "semester": semester,
            "quarter": quarter,
            "class_id": class_id,
        },
        "classes": visible_classes,
        "stats": {
            "scored": scored_count,
            "below_50": len(normalized_rows),
            "at_or_above_50": max(scored_count - len(normalized_rows), 0),
        },
        "students": normalized_rows,
        "top_students": top_rows,
    }
    digest_payload = json.dumps(_jsonable(snapshot), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    snapshot["snapshot_id"] = hashlib.sha256(digest_payload.encode("utf-8")).hexdigest()
    return snapshot


def _shape(value: Any) -> str:
    text = str(value or "")
    return get_display(arabic_reshaper.reshape(text)) if text else ""


def _safe(value: Any) -> str:
    return str(value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _wrap_by_width(text: str, font_name: str, font_size: float, max_width: float) -> List[str]:
    """Greedily wraps LOGICAL Arabic text into lines whose *reshaped* (ligature-joined)
    width fits max_width, measured in the actual font - unlike a fixed character count,
    this adapts to the real column/paragraph width instead of guessing and either
    under-filling the line (a ragged block that reads like a narrow column) or overflowing it.
    """
    words = text.split(" ")
    lines: List[str] = []
    current: List[str] = []
    for word in words:
        candidate = " ".join(current + [word]) if current else word
        width = pdfmetrics.stringWidth(_shape(candidate), font_name, font_size)
        if current and width > max_width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines or [""]


def _p(
    text: Any,
    style: ParagraphStyle,
    *,
    arabic: bool = False,
    wrap_chars: Optional[int] = None,
    wrap_width: Optional[float] = None,
    wrap_font: Optional[str] = None,
    wrap_font_size: Optional[float] = None,
) -> Paragraph:
    raw = str(text or "")
    if not arabic:
        return Paragraph(_safe(raw).replace("\n", "<br/>"), style)
    logical_lines: List[str] = []
    for explicit_line in raw.splitlines() or [""]:
        if wrap_width and wrap_font and wrap_font_size:
            logical_lines.extend(_wrap_by_width(explicit_line, wrap_font, wrap_font_size, wrap_width))
        elif wrap_chars and len(explicit_line) > wrap_chars:
            logical_lines.extend(textwrap.wrap(explicit_line, width=wrap_chars, break_long_words=False, break_on_hyphens=False))
        else:
            logical_lines.append(explicit_line)
    return Paragraph("<br/>".join(_safe(_shape(line)) for line in logical_lines), style)


def render_remedial_pdf(snapshot: Dict[str, Any], details: Dict[str, Any], lang: str = "en") -> bytes:
    """Render the school remedial-analysis report from a previously previewed snapshot."""
    _register_fonts()
    is_arabic = lang == "ar"
    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=15 * mm,
        title="تقرير الخطة العلاجية" if is_arabic else "Remedial Assessment Report",
        author="Al Anjal National School",
    )

    font = ARABIC_FONT if is_arabic else LATIN_FONT
    bold = ARABIC_FONT_BOLD if is_arabic else LATIN_FONT_BOLD
    align = TA_RIGHT if is_arabic else TA_LEFT
    styles = getSampleStyleSheet()
    normal = ParagraphStyle(
        "RemedialNormal",
        parent=styles["BodyText"],
        fontName=font,
        fontSize=10,
        leading=17 if is_arabic else 14,
        alignment=align,
        textColor=colors.HexColor("#10162A"),
        wordWrap="RTL" if is_arabic else None,
    )
    small = ParagraphStyle(
        "RemedialSmall",
        parent=normal,
        fontSize=8.5,
        leading=13 if is_arabic else 11,
    )
    title = ParagraphStyle(
        "RemedialTitle",
        parent=normal,
        fontName=bold,
        fontSize=17,
        leading=24,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#241244"),
        spaceAfter=5,
    )
    center = ParagraphStyle("RemedialCenter", parent=normal, alignment=TA_CENTER)
    center_bold = ParagraphStyle("RemedialCenterBold", parent=center, fontName=bold, fontSize=9)
    header_cell = ParagraphStyle("RemedialHeaderCell", parent=center_bold, textColor=colors.white)
    label = ParagraphStyle("RemedialLabel", parent=normal, fontName=bold)

    school_ar = "مدارس الأنجال الأهلية"
    school_en = "AL ANJAL NATIONAL SCHOOL"
    dept_default = "قسم الحاسب" if is_arabic else "Computer Science Department"
    department = details.get("department") or dept_default
    teacher_name = details.get("teacher_name") or ("المعلم" if is_arabic else "Teacher")
    supervisor_name = details.get("supervisor_name") or ""
    # Roles carried by the letter: the department's teacher and supervisor, as in the
    # school's own report ("Computer Teacher" / "Computer Supervisor").
    teacher_role = "معلم الحاسب الآلي" if is_arabic else "Computer Teacher"
    supervisor_role = "مشرف الحاسب الآلي" if is_arabic else "Computer Supervisor"
    # The course this report belongs to is fixed per section; the teacher's own
    # "subject / learning area" entry (e.g. "Microbit") is the topic the struggling
    # students could not grasp, which is a different thing and reads that way below.
    course_name = "المهارات الرقمية" if is_arabic else "Computer Science"
    learning_area = details.get("subject") or (
        "المهارات التي تناولها هذا الاختبار" if is_arabic else "the skills covered in this test"
    )
    # Falls back to a phrase that still reads naturally inside "...their inability to grasp {weakness}"
    # rather than a dead-end placeholder, while staying honest that the system has no way to infer
    # which specific skill a student struggled with from a total score alone - only the teacher,
    # who wrote and marked the test, knows that (e.g. "Variables Blocks - Micro Bit Components").
    weakness = details.get("skill_weakness") or (
        "المهارات التي تناولها هذا الاختبار" if is_arabic else "the skills covered in this test"
    )
    plan_date = details.get("remedial_plan_date") or "-"
    # Test administration, result analysis, and the remedial plan itself are three
    # separate moments in the letter's opening ("a test was conducted during week 1&2,
    # results were then analyzed during week 3, then a remedial plan for week 4 was
    # put in place") - analysis necessarily happens before the plan it feeds into, so
    # analysis_date must stay a distinct field from remedial_plan_date rather than
    # reusing it. Both test_conducted_date and analysis_date are optional since not
    # every teacher fills them in immediately, in which case the corresponding opening
    # clause is skipped rather than shown with a placeholder dash.
    test_conducted_date = (details.get("test_conducted_date") or "").strip()
    analysis_date = (details.get("analysis_date") or "").strip()
    class_names = ", ".join(item["name"] for item in snapshot.get("classes") or [] if item.get("name"))
    semester_number = snapshot.get("scope", {}).get("semester")
    if is_arabic:
        semester_word = {1: "الأول", 2: "الثاني"}.get(semester_number, "")
    else:
        semester_word = {1: "first", 2: "second"}.get(semester_number, "")
    source_label = snapshot["source"]["label"]
    year = snapshot["scope"]["academic_year"]
    threshold = _number(snapshot["source"]["threshold"])
    maximum = _number(snapshot["source"]["maximum"])
    weak_students = snapshot.get("students") or []
    # No one scored below 50% - there's nobody to list as needing remediation, so the
    # letter instead praises the whole class and proposes enrichment work, listing
    # everyone's marks (top_students) below rather than blocking the export entirely.
    no_weak_students = not weak_students

    logo = Image(str(LOGO_PATH), width=31 * mm, height=20 * mm) if LOGO_PATH.exists() else Spacer(31 * mm, 20 * mm)
    if is_arabic:
        header_data = [[logo, _p(f"{school_ar}\n{school_en}\n{department}", label, arabic=True)]]
        header_widths = [38 * mm, 138 * mm]
    else:
        # school_ar is Arabic text inside an otherwise-Latin header line; the Paragraph's
        # own style (label -> LATIN_FONT_BOLD) has no Arabic glyphs, which rendered that
        # line as solid tofu boxes. Wrap just that line in a <font> span using the Arabic
        # bold font (already registered by _register_fonts() above regardless of report
        # language) with its text shaped/bidi-reordered, while the English lines stay in
        # the Paragraph's default Latin font.
        header_text = Paragraph(
            f"{_safe(school_en)}<br/>"
            f'<font name="{ARABIC_FONT_BOLD}">{_safe(_shape(school_ar))}</font><br/>'
            f"{_safe(department)}",
            label,
        )
        header_data = [[header_text, logo]]
        header_widths = [138 * mm, 38 * mm]
    header = Table(header_data, colWidths=header_widths)
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (0, 0), "LEFT"), ("ALIGN", (-1, 0), (-1, 0), "RIGHT")]))

    story: List[Any] = [header, Spacer(1, 4 * mm)]
    if no_weak_students:
        report_title = (
            f"تقرير تحليل {source_label} وخطة الإثراء" if is_arabic else f"{source_label} Analysis and Enrichment Plan Report"
        )
    else:
        report_title = (
            f"تقرير تحليل {source_label} والخطة العلاجية"
            if is_arabic
            else f"{source_label} Analysis and Remedial Plan Report"
        )
    story.extend([_p(report_title, title, arabic=is_arabic), Spacer(1, 2 * mm)])

    if is_arabic:
        # ReportLab lays table columns left-to-right regardless of the text inside them,
        # so an Arabic [label, value] row (correct for English's "From: value") puts the
        # label on the physical LEFT - backwards for RTL, where the label should read
        # first, on the right. Put the value column first (left) and the label second
        # (right) instead; the student table below already does this for the same reason.
        meta_rows = [
            [_p(f"{teacher_role}/ {teacher_name}", normal, arabic=True), _p("من:", label, arabic=True)],
            [_p(f"{supervisor_role}/ {supervisor_name}".rstrip("/ ").rstrip(), normal, arabic=True), _p("إلى:", label, arabic=True)],
            [_p(f"نتيجة تحليل {source_label} لمادة {course_name}", normal, arabic=True), _p("الموضوع:", label, arabic=True)],
        ]
        meta_widths = [152 * mm, 24 * mm]
    else:
        meta_rows = [
            [_p("From:", label), _p(f"{teacher_role} / {teacher_name}", normal)],
            [_p("To:", label), _p(f"{supervisor_role} / {supervisor_name}".rstrip("/ ").rstrip(), normal)],
            [_p("About:", label), _p(f"Analysis of {source_label} results for {course_name}", normal)],
        ]
        meta_widths = [24 * mm, 152 * mm]
    meta = Table(meta_rows, colWidths=meta_widths)
    meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, colors.HexColor("#B9C2D3")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([meta, Spacer(1, 5 * mm)])

    at_or_above = snapshot.get("stats", {}).get("at_or_above_50", 0)
    # analysis_date is when results were analyzed - necessarily before remedial_plan_date
    # (the plan it feeds into), so it must never default to reusing plan_date's value
    # except as a last-resort fallback for reports created before this field existed.
    effective_analysis_date = analysis_date or plan_date
    if is_arabic:
        if test_conducted_date:
            # Two separate moments, as in the letter: the test was administered during
            # one window, the results were analyzed during another (often later) one.
            semester_clause = f" للفصل {semester_word}" if semester_word else ""
            opening = (
                f"تم عمل اختبار تشخيصي لصف {class_names or source_label} في مادة {course_name} خلال "
                f"{test_conducted_date}{semester_clause} من العام الدراسي {year}. ثم تم إجراء تحليل لنتائج الطلاب "
                f"خلال {effective_analysis_date}، وجاءت النتائج العامة مبشّرة، "
            )
        else:
            # No test-administration date on hand: fall back to naming just the analysis.
            opening = (
                f"تم إجراء تحليل لنتائج {source_label} لمادة {course_name} خلال {effective_analysis_date} من العام الدراسي {year}. "
                "وجاءت النتائج العامة مبشّرة، "
            )
        if no_weak_students:
            paragraph = (
                opening
                + f"حيث حصل جميع الطلاب ({at_or_above}) على 50% فأكثر من الدرجة النهائية. ويمثل ذلك تحديًا كبيرًا "
                "وإيجابيًا للمعلم، الذي يتطلع إلى الاستمرار في تطوير أداء هؤلاء الطلاب بالانتقال بهم من مستوى الأداء "
                "المتوسط إلى مستوى الطالب الممتاز والمحترف، من خلال إسناد تحديات ذات مستوى أعلى وأوراق عمل إضافية "
                "تنمّي مهاراتهم بشكل مستمر."
            )
            paragraph_above = ""
        else:
            paragraph = (
                opening
                + f"حيث حصل {at_or_above} من الطلاب على 50% فأكثر من الدرجة النهائية. إلا أن "
                f"الطلاب الذين حصلوا على أقل من {threshold} من {maximum} يمثلون تحديًا كبيرًا ليس لأنفسهم فقط بل لزملائهم "
                f"أيضًا المتأثرين بعدم استيعابهم لمحتوى {learning_area}. ولمعالجة هذا الأمر، سيتم تنفيذ خطة علاجية لهؤلاء "
                "الطلاب الذين حصلوا على درجات أقل من المتوسط بوضوح، مع قائمة بأسمائهم موضحة في الجدول التالي."
            )
            paragraph_above = (
                f"الطلاب الذين حصلوا على {threshold} فأكثر، يمثل ذلك تحديًا إيجابيًا للمعلم، الذي يتطلع إلى استمرار "
                "تطور أدائهم مع الوقت من خلال إسناد تحديات لهم ذات مستوى أعلى."
            )
    else:
        if test_conducted_date:
            semester_clause = f" of the {semester_word} semester" if semester_word else ""
            opening = (
                # No "during" before {effective_analysis_date}: its value already
                # supplies it (e.g. "During Week 3"), same as the fallback opening below.
                f"A diagnostic test was conducted for {class_names or source_label} in {course_name} during "
                f"{test_conducted_date}{semester_clause} of the {year} academic year. An analysis of the students' "
                f"results was then conducted {effective_analysis_date}, and the overall results are promising, "
            )
        else:
            # No "during" before {effective_analysis_date} here: the placeholder ("During
            # Weeks 1 & 2") already supplies it, matching how the same value reads
            # standalone in the table's date column.
            opening = (
                f"An analysis of the {source_label} results for {course_name} was conducted {effective_analysis_date} of the "
                f"{year} academic year. The overall results are promising, "
            )
        if no_weak_students:
            paragraph = (
                opening
                + f"with all {at_or_above} student(s) scoring at or above 50% of the final mark. This represents a "
                "significant and positive challenge for the teacher, who looks forward to continuing to develop these "
                "students' performance, moving them from an average level to that of an excellent, professional-performing "
                "student, by assigning them higher-level challenges and additional worksheets to continuously build their "
                "skills."
            )
            paragraph_above = ""
        else:
            paragraph = (
                opening
                + f"with {at_or_above} student(s) scoring at or "
                f"above 50% of the final mark. However, I am concerned about the students who scored less than {threshold} "
                f"out of {maximum}, as they present a significant challenge, not only to themselves but also to their peers, "
                f"who are affected by their inability to grasp {learning_area}. To address this issue, I will implement a "
                "remedial plan for those students who scored well below average, along with a list of those involved below."
            )
            paragraph_above = (
                f"The students who scored {threshold} or above represent a positive challenge for the teacher, "
                "who looks forward to continued improvement in their performance over time by assigning them higher-level challenges."
            )
    # Full content width (A4 minus the 14mm side margins), so lines actually fill it
    # instead of stopping short - a fixed character count was cutting lines well before
    # the real margin, leaving the paragraph looking like a narrow half-empty column.
    # SimpleDocTemplate's page Frame also carries its own default 6pt left/right padding
    # on top of the page margins; without subtracting it, a line wrapped to exactly the
    # margin width is a hair too wide for the frame, so ReportLab silently re-wraps that
    # single pre-wrapped line on its own (LTR, word-count) logic - which, applied to an
    # already bidi-reordered Arabic string, tears a word like the sentence's own first
    # word out onto its own garbled line. Subtract the frame padding plus a small buffer
    # for glyph-metric rounding so our line never needs ReportLab's own further wrapping.
    body_width = A4[0] - 28 * mm - 16
    story.append(_p(paragraph, normal, arabic=is_arabic, wrap_width=body_width if is_arabic else None, wrap_font=font, wrap_font_size=10))
    if paragraph_above:
        story.extend([
            Spacer(1, 3 * mm),
            _p(paragraph_above, normal, arabic=is_arabic, wrap_width=body_width if is_arabic else None, wrap_font=font, wrap_font_size=10),
        ])
    story.append(Spacer(1, 5 * mm))

    # No student table at all when nobody needs remediation - there's no remedial plan
    # to list anyone against, so the letter stands on the praise paragraph alone.
    if not no_weak_students:
        students = weak_students
        if is_arabic:
            header_values = ["تاريخ الخطة العلاجية", "نقطة الضعف المهارية", "الدرجة", "الفصل", "اسم الطالب", "م"]
            rows = [
                [
                    plan_date,
                    weakness,
                    item["score_label"],
                    item["class_name"],
                    item["full_name"],
                    str(index),
                ]
                for index, item in enumerate(students, 1)
            ]
            widths = [30 * mm, 49 * mm, 22 * mm, 20 * mm, 48 * mm, 9 * mm]
        else:
            header_values = ["No.", "Name", "Class", "Marks", "Skill Weakness Point", "Date of Remedial Plan"]
            rows = [
                [
                    str(index),
                    item["full_name"],
                    item["class_name"],
                    item["score_label"],
                    weakness,
                    plan_date,
                ]
                for index, item in enumerate(students, 1)
            ]
            widths = [10 * mm, 47 * mm, 21 * mm, 23 * mm, 48 * mm, 29 * mm]

        table_data = [[_p(value, header_cell, arabic=is_arabic) for value in header_values]]
        for row in rows:
            arabic_wraps = [24, 27, 12, 14, 26, 4]
            table_data.append([
                _p(value, small, arabic=is_arabic, wrap_chars=arabic_wraps[index] if is_arabic else None)
                for index, value in enumerate(row)
            ])
        table = Table(table_data, colWidths=widths, repeatRows=1, hAlign="CENTER")
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#241244")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.65, colors.HexColor("#667085")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F8FC")]),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(table)
        story.append(Spacer(1, 9 * mm))

    if is_arabic:
        signature_data = [[
            _p(f"{teacher_role}\n{teacher_name}", center, arabic=True),
            _p(f"{supervisor_role}\n{supervisor_name or '........................'}", center, arabic=True),
        ]]
    else:
        signature_data = [[
            _p(f"{teacher_role}\n{teacher_name}", center),
            _p(f"{supervisor_role}\n{supervisor_name or '........................'}", center),
        ]]
    signatures = Table(signature_data, colWidths=[88 * mm, 88 * mm])
    signatures.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(KeepTogether(signatures))

    def _page(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#7683A0"))
        canvas.setLineWidth(0.7)
        canvas.rect(8 * mm, 8 * mm, A4[0] - 16 * mm, A4[1] - 16 * mm)
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor("#667085"))
        page_label = f"صفحة {document.page}" if is_arabic else f"Page {document.page}"
        canvas.drawCentredString(A4[0] / 2, 9.5 * mm, _shape(page_label) if is_arabic else page_label)
        canvas.restoreState()

    doc.build(story, onFirstPage=_page, onLaterPages=_page)
    return output.getvalue()
