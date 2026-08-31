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
        if percentage >= 50:
            continue
        normalized_rows.append(
            {
                "id": str(item.get("id") or item.get("student_id") or ""),
                "full_name": str(item.get("full_name") or item.get("student_name") or "").strip(),
                "class_id": str(item.get("class_id") or ""),
                "class_name": str(item.get("class_name") or "").strip(),
                "score": round(numeric_score, 2),
                "maximum": round(max_score, 2),
                "score_label": f"{_number(numeric_score)} / {_number(max_score)}",
                "percentage": round(percentage, 2),
            }
        )

    normalized_rows.sort(key=lambda item: (item["class_name"].casefold(), item["full_name"].casefold()))
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
    }
    digest_payload = json.dumps(_jsonable(snapshot), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    snapshot["snapshot_id"] = hashlib.sha256(digest_payload.encode("utf-8")).hexdigest()
    return snapshot


def _shape(value: Any) -> str:
    text = str(value or "")
    return get_display(arabic_reshaper.reshape(text)) if text else ""


def _safe(value: Any) -> str:
    return str(value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _p(
    text: Any,
    style: ParagraphStyle,
    *,
    arabic: bool = False,
    wrap_chars: Optional[int] = None,
) -> Paragraph:
    raw = str(text or "")
    if not arabic:
        return Paragraph(_safe(raw).replace("\n", "<br/>"), style)
    logical_lines: List[str] = []
    for explicit_line in raw.splitlines() or [""]:
        if wrap_chars and len(explicit_line) > wrap_chars:
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
    subject = details.get("subject") or ("المادة" if is_arabic else "the selected subject")
    weakness = details.get("skill_weakness") or ("تُحدد بواسطة المعلم" if is_arabic else "To be specified by the teacher")
    plan_date = details.get("remedial_plan_date") or "-"
    source_label = snapshot["source"]["label"]
    year = snapshot["scope"]["academic_year"]
    threshold = _number(snapshot["source"]["threshold"])
    maximum = _number(snapshot["source"]["maximum"])

    logo = Image(str(LOGO_PATH), width=31 * mm, height=20 * mm) if LOGO_PATH.exists() else Spacer(31 * mm, 20 * mm)
    if is_arabic:
        header_data = [[logo, _p(f"{school_ar}\n{school_en}\n{department}", label, arabic=True)]]
        header_widths = [38 * mm, 138 * mm]
    else:
        header_data = [[_p(f"{school_en}\n{school_ar}\n{department}", label), logo]]
        header_widths = [138 * mm, 38 * mm]
    header = Table(header_data, colWidths=header_widths)
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (0, 0), "LEFT"), ("ALIGN", (-1, 0), (-1, 0), "RIGHT")]))

    story: List[Any] = [header, Spacer(1, 4 * mm)]
    report_title = (
        f"تقرير تحليل {source_label} والخطة العلاجية"
        if is_arabic
        else f"{source_label} Analysis and Remedial Plan Report"
    )
    story.extend([_p(report_title, title, arabic=is_arabic), Spacer(1, 2 * mm)])

    if is_arabic:
        meta_rows = [
            [_p("من:", label, arabic=True), _p(teacher_name, normal, arabic=True)],
            [_p("إلى:", label, arabic=True), _p(supervisor_name or "المشرف التربوي", normal, arabic=True)],
            [_p("الموضوع:", label, arabic=True), _p(f"نتيجة تحليل {source_label} لمادة {subject}", normal, arabic=True)],
        ]
    else:
        meta_rows = [
            [_p("From:", label), _p(teacher_name, normal)],
            [_p("To:", label), _p(supervisor_name or "Academic Supervisor", normal)],
            [_p("About:", label), _p(f"Analysis of {source_label} results for {subject}", normal)],
        ]
    meta = Table(meta_rows, colWidths=[24 * mm, 152 * mm])
    meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.35, colors.HexColor("#B9C2D3")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.extend([meta, Spacer(1, 5 * mm)])

    if is_arabic:
        paragraph = (
            f"تم تحليل نتائج {source_label} لمادة {subject} للعام الدراسي {year}. وبعد مراجعة الدرجات المرصودة، "
            f"تبين وجود طلاب حصلوا على أقل من {threshold} من {maximum}، أي أقل من 50% من الدرجة النهائية. "
            f"ويحتاج هؤلاء الطلاب إلى دعم موجه في: {weakness}. ولمعالجة ذلك سيتم تنفيذ خطة علاجية للطلاب الموضحة أسماؤهم ودرجاتهم في الجدول التالي."
        )
    else:
        paragraph = (
            f"An analysis of the {source_label} results for {subject} was conducted for the {year} academic year. "
            f"After reviewing the recorded results, the students listed below scored less than {threshold} out of {maximum}, "
            f"which is below 50% of the final mark. These students require targeted support in: {weakness}. "
            "To address this concern, a remedial plan will be implemented for the students shown in the following table."
        )
    story.extend([_p(paragraph, normal, arabic=is_arabic, wrap_chars=90 if is_arabic else None), Spacer(1, 5 * mm)])

    students = snapshot.get("students") or []
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
            _p(f"المعلم\n{teacher_name}", center, arabic=True),
            _p(f"المشرف التربوي\n{supervisor_name or '........................'}", center, arabic=True),
        ]]
    else:
        signature_data = [[
            _p(f"Teacher\n{teacher_name}", center),
            _p(f"Supervisor\n{supervisor_name or '........................'}", center),
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
