"""
Premium PDF report layout, Arabic font embedding, and chart rendering for Analytics / Reports exports.
"""
from __future__ import annotations

import io
import math
import re
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image as RLImage,
    KeepTogether,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# Re-use font + label helpers from server (import lazily to avoid circular import at module load)
_server = None


def _srv():
    global _server
    if _server is None:
        import server as _server_mod
        _server = _server_mod
    return _server


# --- Theme (Al Mubarmij-inspired) -------------------------------------------------
PDF_NAVY = "#0D1222"
PDF_PURPLE = "#8B2BEC"
PDF_MAGENTA = "#E91E8F"
PDF_CYAN = "#38BDF8"
PDF_BG_SOFT = "#F6F8FB"
PDF_BORDER = "#E2E8F0"
PDF_TEXT = "#0F172A"
PDF_MUTED = "#64748B"
PDF_SUCCESS = "#10B981"
PDF_WARNING = "#F59E0B"
PDF_DANGER = "#EF4444"

PDF_REPORT_ORG_NAME = "Al Anjal School Follow-up Record"
PDF_CONTENT_WIDTH = 530
PDF_EXPORT_CHART_DPI = 140

_MPL_FONT_READY = False


def ensure_matplotlib_arabic_font() -> None:
    """Register Amiri for matplotlib tick labels (Arabic class names, etc.)."""
    global _MPL_FONT_READY
    if _MPL_FONT_READY:
        return
    s = _srv()
    s._ensure_pdf_arabic_fonts()
    try:
        import matplotlib.pyplot as plt
        from matplotlib import font_manager as fm

        reg = s.AMIRI_REGULAR_PATH
        bold = s.AMIRI_BOLD_PATH
        if reg.exists() and reg.stat().st_size > 50_000:
            fm.fontManager.addfont(str(reg))
            if bold.exists():
                fm.fontManager.addfont(str(bold))
            plt.rcParams["font.family"] = "Amiri"
            plt.rcParams["font.sans-serif"] = ["Amiri", "DejaVu Sans", "sans-serif"]
        _MPL_FONT_READY = True
    except Exception:
        pass


def chart_axis_label(text: Any, max_len: int = 32) -> str:
    """Shape Arabic for matplotlib; truncate long labels."""
    raw = str(text or "?").strip()
    if len(raw) > max_len:
        raw = raw[: max_len - 1] + "…"
    if _srv()._has_arabic(raw):
        return _srv()._shape_arabic(raw)
    return raw


def pdf_font_name(bold: bool = False) -> str:
    s = _srv()
    s._ensure_pdf_arabic_fonts()
    return s.PDF_ARABIC_FONT_BOLD if bold else s.PDF_ARABIC_FONT


def pdf_paragraph_styles(lang: str) -> Dict[str, ParagraphStyle]:
    """Paragraph styles with embedded Arabic fonts when lang is ar."""
    s = _srv()
    s._ensure_pdf_arabic_fonts()
    lang = s._normalize_lang(lang)
    is_ar = lang == "ar"
    align = TA_RIGHT if is_ar else 0
    base_font = pdf_font_name(False)
    bold_font = pdf_font_name(True)
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            name="PdfTitle",
            parent=styles["Title"],
            fontName=bold_font,
            fontSize=20,
            leading=26,
            textColor=colors.HexColor(PDF_TEXT),
            alignment=align,
            spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            name="PdfSubtitle",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=10,
            leading=14,
            textColor=colors.HexColor(PDF_MUTED),
            alignment=align,
            spaceAfter=6,
        ),
        "section": ParagraphStyle(
            name="PdfSection",
            parent=styles["Heading2"],
            fontName=bold_font,
            fontSize=13,
            leading=17,
            textColor=colors.HexColor(PDF_PURPLE),
            alignment=align,
            spaceBefore=8,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            name="PdfBody",
            parent=styles["Normal"],
            fontName=base_font,
            fontSize=9.5,
            leading=14,
            textColor=colors.HexColor(PDF_TEXT),
            alignment=align,
        ),
        "table_header": ParagraphStyle(
            name="PdfTableHeader",
            fontName=bold_font,
            fontSize=9,
            leading=12,
            textColor=colors.white,
            alignment=align,
            wordWrap="RTL" if is_ar else "CJK",
        ),
        "table_body": ParagraphStyle(
            name="PdfTableBody",
            fontName=base_font,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor(PDF_TEXT),
            alignment=align,
            wordWrap="RTL" if is_ar else "CJK",
        ),
        "kpi_label": ParagraphStyle(
            name="PdfKpiLabel",
            fontName=base_font,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(PDF_MUTED),
            alignment=TA_CENTER,
        ),
        "kpi_value": ParagraphStyle(
            name="PdfKpiValue",
            fontName=bold_font,
            fontSize=16,
            leading=20,
            textColor=colors.HexColor(PDF_PURPLE),
            alignment=TA_CENTER,
        ),
        "insight_title": ParagraphStyle(
            name="PdfInsightTitle",
            fontName=bold_font,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor(PDF_CYAN),
            alignment=align,
        ),
        "insight_body": ParagraphStyle(
            name="PdfInsightBody",
            fontName=base_font,
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor(PDF_TEXT),
            alignment=align,
        ),
    }


def pdf_cover_header(
    *,
    report_title: str,
    org_name: str,
    scope_line: str,
    term_line: str,
    generated_on: str,
    meta_rows: List[Tuple[str, str]],
    lang: str,
    logo_path: Optional[Path] = None,
) -> List[Any]:
    s = _srv()
    st = pdf_paragraph_styles(lang)
    elements: List[Any] = []

    # Navy gradient band
    band = Table([[""]], colWidths=[PDF_CONTENT_WIDTH], rowHeights=[14])
    band.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(PDF_NAVY)),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(band)
    elements.append(Spacer(1, 10))

    header_cells: List[Any] = []
    if logo_path and logo_path.exists():
        try:
            header_cells.append(RLImage(str(logo_path), width=52, height=52))
        except Exception:
            header_cells.append(Spacer(52, 52))
    else:
        header_cells.append(Spacer(52, 4))

    title_block = [
        Paragraph(s._pdf_paragraph_text(report_title, bold=True), st["title"]),
        Paragraph(s._pdf_paragraph_text(org_name), st["subtitle"]),
        Paragraph(s._pdf_paragraph_text(scope_line, bold=True), st["subtitle"]),
        Paragraph(s._pdf_paragraph_text(term_line), st["subtitle"]),
        Paragraph(
            s._pdf_paragraph_text(f"{s._tr('Generated on', lang)} {generated_on}"),
            st["subtitle"],
        ),
    ]
    header_cells.append(title_block)
    header_row = Table(
        [[header_cells[0], header_cells[1]]],
        colWidths=[60, PDF_CONTENT_WIDTH - 60],
        hAlign="LEFT",
    )
    header_row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(header_row)
    elements.append(Spacer(1, 8))
    elements.append(pdf_meta_grid(meta_rows, lang))
    elements.append(Spacer(1, 12))
    return elements


def pdf_meta_grid(meta_rows: List[Tuple[str, str]], lang: str) -> Table:
    s = _srv()
    st = pdf_paragraph_styles(lang)
    cells: List[Paragraph] = []
    for key, value in meta_rows[:4]:
        key_esc = s._pdf_paragraph_text(key, bold=True)
        val_esc = s._pdf_paragraph_text(value if value not in (None, "") else "-")
        cells.append(
            Paragraph(
                f'<font color="{PDF_MUTED}">{key_esc}</font><br/>{val_esc}',
                st["body"],
            )
        )
    while len(cells) < 4:
        cells.append(Paragraph("-", st["body"]))
    tbl = Table([cells[:2], cells[2:4]], colWidths=[265, 265], hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(PDF_BORDER)),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(PDF_BORDER)),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(PDF_BG_SOFT)),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return tbl


def pdf_kpi_cards(cards: List[Tuple[str, str]], lang: str) -> Table:
    s = _srv()
    st = pdf_paragraph_styles(lang)
    padded = list(cards) + [("", "—")] * 3
    col_w = PDF_CONTENT_WIDTH / 3
    cells: List[Paragraph] = []
    for label, value in padded[:3]:
        label_esc = s._pdf_paragraph_text(label)
        value_esc = s._pdf_paragraph_text(str(value if value not in (None, "") else "—"), bold=True)
        cells.append(
            Paragraph(
                f'<font color="{PDF_MUTED}">{label_esc}</font><br/>'
                f'<font color="{PDF_PURPLE}"><b>{value_esc}</b></font>',
                st["kpi_label"],
            )
        )
    tbl = Table([cells], colWidths=[col_w, col_w, col_w], hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor(PDF_BORDER)),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor(PDF_BORDER)),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("LINEABOVE", (0, 0), (-1, 0), 3, colors.HexColor(PDF_PURPLE)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return tbl


def pdf_kpi_section(cards: List[Tuple[str, str]], lang: str) -> List[Any]:
    """Render KPI cards in rows of three."""
    out: List[Any] = []
    for idx in range(0, len(cards), 3):
        out.append(pdf_kpi_cards(cards[idx : idx + 3], lang))
        if idx + 3 < len(cards):
            out.append(Spacer(1, 6))
    return out


def pdf_insight_cards(items: List[Tuple[str, str]], lang: str) -> Table:
    """Short insight blocks (title + body)."""
    s = _srv()
    st = pdf_paragraph_styles(lang)
    col_w = PDF_CONTENT_WIDTH / 3
    cells: List[Paragraph] = []
    for title, body in (list(items) + [("", "—")] * 3)[:3]:
        title_esc = s._pdf_paragraph_text(title, bold=True)
        body_esc = s._pdf_paragraph_text(s._pdf_clamp_text(body or "-", 200))
        cells.append(
            Paragraph(
                f'<font color="{PDF_CYAN}"><b>{title_esc}</b></font><br/>{body_esc}',
                st["insight_body"],
            )
        )
    tbl = Table([cells], colWidths=[col_w, col_w, col_w], hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#C4B5FD")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor(PDF_BORDER)),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAF5FF")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return tbl


def pdf_executive_summary(elements: List[Any], insights: Optional[Dict[str, str]], lang: str) -> None:
    s = _srv()
    st = pdf_paragraph_styles(lang)
    insights = insights or {}
    blocks: List[str] = []
    for key, label_key in [
        ("analysis_strengths", "Strengths"),
        ("analysis_performance", "Student Performance"),
        ("analysis_weaknesses", "Weaknesses"),
        ("analysis_standout_data", "Standout Data"),
    ]:
        text = s._pdf_clamp_text((insights.get(key) or "").strip(), max_chars=380)
        if text:
            blocks.append(
                f'<b>{s._pdf_paragraph_text(s._tr(label_key, lang), bold=True)}</b><br/>'
                f'{s._pdf_paragraph_text(text)}'
            )
    if not blocks:
        return
    elements.append(
        Paragraph(s._pdf_paragraph_text(s._tr("Executive Summary", lang), bold=True), st["section"])
    )
    elements.append(Paragraph("<br/><br/>".join(blocks), st["body"]))
    elements.append(Spacer(1, 12))


def pdf_recommendations_block(elements: List[Any], insights: Optional[Dict[str, str]], lang: str) -> None:
    s = _srv()
    st = pdf_paragraph_styles(lang)
    actions = (insights or {}).get("analysis_actions") or (insights or {}).get("analysis_recommendations") or ""
    actions = s._pdf_clamp_text(str(actions).strip(), max_chars=500)
    if not actions or actions == "-":
        return
    elements.append(
        Paragraph(s._pdf_paragraph_text(s._tr("Recommended Actions", lang), bold=True), st["section"])
    )
    # Split into bullet-like lines
    lines = [ln.strip() for ln in re.split(r"[\n.;]+", actions) if ln.strip()]
    if not lines:
        lines = [actions]
    bullet_html = "<br/>".join(
        f"• {s._pdf_paragraph_text(ln)}" for ln in lines[:6]
    )
    card = Table([[Paragraph(bullet_html, st["body"])]], colWidths=[PDF_CONTENT_WIDTH])
    card.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(PDF_WARNING)),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFBEB")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(card)
    elements.append(Spacer(1, 12))


def pdf_section_heading(title: str, lang: str, subtitle: str = "") -> Table:
    """Compact branded section heading shared by every report family."""
    s = _srv()
    st = pdf_paragraph_styles(lang)
    title_text = s._pdf_paragraph_text(title, bold=True)
    subtitle_text = s._pdf_paragraph_text(subtitle) if subtitle else ""
    content = f'<font color="{PDF_TEXT}"><b>{title_text}</b></font>'
    if subtitle_text:
        content += f'<br/><font color="{PDF_MUTED}" size="8">{subtitle_text}</font>'
    cell = Paragraph(content, st["body"])
    accent = colors.HexColor(PDF_CYAN)
    table = Table([[cell]], colWidths=[PDF_CONTENT_WIDTH], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(PDF_BG_SOFT)),
        ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(PDF_BORDER)),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return table


def pdf_empty_state(message: str, lang: str) -> Table:
    """Professional compact substitute for empty charts and empty detail tables."""
    s = _srv()
    st = pdf_paragraph_styles(lang)
    text = Paragraph(
        f'<font color="{PDF_MUTED}">{s._pdf_paragraph_text(message)}</font>',
        st["body"],
    )
    table = Table([[text]], colWidths=[PDF_CONTENT_WIDTH], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.7, colors.HexColor(PDF_BORDER)),
        ("LINEBEFORE", (0, 0), (0, -1), 3, colors.HexColor(PDF_CYAN)),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return table


def pdf_status_badge(label: str, status: str, lang: str) -> Table:
    """Small semantic status badge usable inside summary/detail layouts."""
    s = _srv()
    st = pdf_paragraph_styles(lang)
    palette = {
        "success": ("#ECFDF5", PDF_SUCCESS),
        "warning": ("#FFFBEB", PDF_WARNING),
        "danger": ("#FEF2F2", PDF_DANGER),
        "neutral": (PDF_BG_SOFT, PDF_MUTED),
    }
    background, foreground = palette.get(status, palette["neutral"])
    table = Table(
        [[Paragraph(s._pdf_paragraph_text(label, bold=True), st["table_body"])]],
        hAlign="RIGHT" if lang == "ar" else "LEFT",
    )
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(background)),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor(foreground)),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(foreground)),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table


def pdf_styled_table(
    data: List[List[Any]],
    lang: str,
    col_widths: Optional[List[int]] = None,
    repeat_header: bool = True,
) -> Table:
    s = _srv()
    st = pdf_paragraph_styles(lang)
    header_font = pdf_font_name(True)
    wrapped: List[List[Any]] = []
    for row_idx, row in enumerate(data):
        out_row = []
        for cell in row:
            if isinstance(cell, Paragraph):
                out_row.append(cell)
                continue
            is_header = row_idx == 0
            text = s._pdf_paragraph_text(cell, bold=is_header)
            style = st["table_header"] if is_header else st["table_body"]
            out_row.append(Paragraph(text, style))
        wrapped.append(out_row)
    tbl = Table(
        wrapped,
        colWidths=col_widths,
        repeatRows=1 if repeat_header else 0,
        hAlign="RIGHT" if lang == "ar" else "LEFT",
    )
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(PDF_NAVY)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), header_font),
                ("FONTSIZE", (0, 0), (-1, 0), 9),
                ("FONTSIZE", (0, 1), (-1, -1), 8.5),
                ("ALIGN", (0, 0), (-1, -1), "RIGHT" if lang == "ar" else "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor(PDF_BORDER)),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(PDF_BG_SOFT)]),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return tbl


def pdf_footer_draw(lang: str, report_label: str = "Analytics Report"):
    """ReportLab canvas callback with Arabic-capable footer."""

    def _draw(canvas, doc) -> None:
        s = _srv()
        s._ensure_pdf_arabic_fonts()
        canvas.saveState()
        width, _ = A4
        page = canvas.getPageNumber()
        ts = datetime.now(s.REPORT_TIMEZONE).strftime("%Y-%m-%d %H:%M")
        font = pdf_font_name(False)
        canvas.setFont(font, 8)
        canvas.setFillColor(colors.HexColor(PDF_MUTED))
        left = s._shape_arabic(f"{s._tr('Report', lang)} · {report_label}") if lang == "ar" else f"{report_label}"
        center = PDF_REPORT_ORG_NAME
        right = ts
        canvas.drawString(28, 20, f"Page {page}")
        canvas.drawCentredString(width / 2, 20, center)
        canvas.drawRightString(width - 28, 20, right)
        if lang == "ar":
            canvas.drawRightString(width - 28, 32, left)
        else:
            canvas.drawString(28, 32, left)
        canvas.restoreState()

    return _draw


def resolve_logo_path() -> Optional[Path]:
    s = _srv()
    candidates = [
        s.ROOT_DIR / "assets" / "logo-al-anjal.png",
        s.ROOT_DIR.parent / "frontend" / "public" / "logo-al-anjal.png",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None
