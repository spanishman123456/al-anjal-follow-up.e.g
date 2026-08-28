"""Paginated vector PDF of an authoritative baseline analytics snapshot.

No scoring or narrative generation happens here. Arabic is wrapped logically
before shaping each line; mixed score ratios are protected from bidi reversal.
"""
import io
import re

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import Flowable, PageBreak, SimpleDocTemplate, Spacer

from pdf_report_engine import (PDF_NAVY, PDF_PURPLE, PDF_CYAN, PDF_TEXT,
                               PDF_MUTED, PDF_BORDER, pdf_font_name, pdf_kpi_section)

WIDTH = 530
PALETTE = {"high": PDF_PURPLE, "medium": "#D97706", "support": "#E11D48", "missing": PDF_MUTED}
RESHAPER = arabic_reshaper.ArabicReshaper(configuration={"delete_harakat": True, "support_ligatures": False})


def shaped(text):
    text = str(text)
    if not re.search(r"[\u0600-\u06ff]", text):
        return text
    text = re.sub(r"\d+(?:\.\d+)?\s*/\s*\d+(?:\.\d+)?|\d{4}-\d{4}", lambda m: "\u202a" + m[0] + "\u202c", text)
    return get_display(RESHAPER.reshape(text), base_dir="R")


def num(value):
    return "-" if value is None else f"{value:g}"


def lines(text, width, font, size):
    output = []
    for paragraph in str(text).splitlines() or [""]:
        current = ""
        for word in paragraph.split():
            candidate = (current + " " + word).strip()
            if current and pdfmetrics.stringWidth(shaped(candidate), font, size) > width:
                output.append(current)
                current = ""
            # Long unbroken imported names must also fit the frame.
            if pdfmetrics.stringWidth(shaped(word), font, size) > width:
                for char in word:
                    if current and pdfmetrics.stringWidth(shaped(current + char), font, size) > width:
                        output.append(current)
                        current = ""
                    current += char
            else:
                current = (current + " " + word).strip()
        output.append(current)
    return output


class Text(Flowable):
    def __init__(self, text, lang, size=11, bold=False, color=PDF_TEXT, width=WIDTH, keep=False):
        super().__init__()
        self.font = pdf_font_name(bold)
        self.size, self.color, self.lang, self.width = size, color, lang, width
        self.content = lines(text, width, self.font, size)
        self.leading = size * 1.6
        self.height = len(self.content) * self.leading + 5
        self.keepWithNext = keep

    def draw(self):
        c = self.canv
        c.setFont(self.font, self.size)
        c.setFillColor(colors.HexColor(self.color))
        for i, line in enumerate(self.content):
            draw = c.drawRightString if self.lang == "ar" else c.drawString
            draw(self.width if self.lang == "ar" else 0, self.height - (i + 1) * self.leading + 3, shaped(line))


class Bar(Flowable):
    def __init__(self, label, value, display, lang, color=PDF_CYAN):
        super().__init__()
        self.label, self.value, self.display, self.lang, self.color = label, value, display, lang, color
        self.font = pdf_font_name()
        self.content = lines(label, WIDTH - 130, self.font, 10)
        self.width, self.height = WIDTH, max(1, len(self.content)) * 15 + 23

    def draw(self):
        c = self.canv
        c.setFont(self.font, 10)
        c.setFillColor(colors.HexColor(PDF_TEXT))
        for i, line in enumerate(self.content):
            if self.lang == "ar":
                c.drawRightString(WIDTH, self.height - 12 - i * 15, shaped(line))
            else:
                c.drawString(0, self.height - 12 - i * 15, shaped(line))
        c.setFillColor(colors.HexColor(self.color))
        if self.lang == "ar":
            c.drawString(0, self.height - 12, shaped(self.display))
        else:
            c.drawRightString(WIDTH, self.height - 12, shaped(self.display))
        c.setFillColor(colors.HexColor("#E8EDF4"))
        c.roundRect(0, 5, WIDTH, 9, 4, fill=1, stroke=0)
        if self.value is not None and self.value > 0:
            width = WIDTH * self.value / 100
            c.setFillColor(colors.HexColor(self.color))
            c.roundRect(WIDTH - width if self.lang == "ar" else 0, 5, width, 9, min(4, width / 2), fill=1, stroke=0)


class Donut(Flowable):
    def __init__(self, student, snapshot):
        super().__init__()
        self.student, self.snapshot = student, snapshot
        self.width, self.height = WIDTH, 185

    def draw(self):
        c, row, snapshot = self.canv, self.student, self.snapshot
        c.setFillColor(colors.HexColor(PDF_NAVY))
        c.roundRect(0, 0, WIDTH, self.height, 15, fill=1, stroke=0)
        rtl = snapshot["lang"] == "ar"
        cx = WIDTH - 91 if rtl else 91
        cy, radius = 95, 60
        c.setLineWidth(14)
        c.setStrokeColor(colors.HexColor("#34415B"))
        c.circle(cx, cy, radius, stroke=1, fill=0)
        if row["percentage"] is not None and row["percentage"] > 0:
            c.setStrokeColor(colors.HexColor(PDF_CYAN))
            c.arc(cx-radius, cy-radius, cx+radius, cy+radius, startAng=90, extent=-3.6 * row["percentage"])
        c.setFillColor(colors.white)
        c.setFont(pdf_font_name(True), 23)
        c.drawCentredString(cx, cy + 2, num(row["percentage"]) + ("%" if row["percentage"] is not None else ""))
        c.setFont(pdf_font_name(), 10)
        c.drawCentredString(cx, cy-22, shaped(snapshot["labels"]["percent"]))
        c.setLineWidth(1)
        texts = [row["full_name"], row["class_name"] + " · " + snapshot["labels"]["subject"],
                 snapshot["labels"]["score"] + ": " + row["score_label"], row["level_label"]]
        y = 152
        for text in texts:
            content = lines(text, 315, pdf_font_name(), 12)
            for line in content:
                c.setFont(pdf_font_name(), 12)
                (c.drawRightString if rtl else c.drawString)(WIDTH-183 if rtl else 183, y, shaped(line))
                y -= 20


def render_baseline_pdf(snapshot, student_id=None):
    lang, labels, record = snapshot["lang"], snapshot["labels"], snapshot["record"]
    stream = io.BytesIO()
    doc = SimpleDocTemplate(stream, pagesize=A4, leftMargin=26, rightMargin=26, topMargin=35, bottomMargin=38,
                            title=snapshot["title"], author="Al Anjal School Follow-up Record")
    elements = []

    def heading(title):
        elements.extend([Spacer(1, 8), Text(title, lang, 14, True, PDF_PURPLE, keep=True)])

    def insights(items):
        for item in items:
            heading(item["title"])
            elements.append(Text(item["body"], lang))

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor(PDF_BORDER))
        canvas.line(32, 31, 563, 31)
        canvas.setFillColor(colors.HexColor(PDF_MUTED))
        canvas.setFont(pdf_font_name(), 8)
        canvas.drawString(32, 17, "Al Anjal | " + record["academic_year"] + " | " + snapshot["snapshot_id"][:12])
        canvas.drawRightString(563, 17, str(_doc.page))
        canvas.restoreState()

    elements.append(Text(snapshot["title"], lang, 23, True, PDF_NAVY))
    elements.append(Text(record["title"] + " · " + record["teacher_name"], lang, 13))
    display_q = record["quarter"] + (2 if record["semester"] == 2 else 0)
    scope = " · ".join([record["academic_year"], f"Q{display_q}", record["test_date"], labels["subject"]])
    elements.append(Text(scope, lang, 10, color=PDF_MUTED))
    elements.append(Spacer(1, 8))
    stats = snapshot["stats"]
    elements.extend(pdf_kpi_section([(labels["total"], str(stats["total"])), (labels["graded"], str(stats["graded"])),
        (labels["missing"], str(stats["missing"])), (labels["mean"], num(stats["mean"]) + ("%" if stats["mean"] is not None else "")),
        (labels["completion"], num(stats["completion"]) + "%"), (labels["score"], "/ " + num(record["max_score"]))], lang))
    heading(labels["class_means"])
    for cls in snapshot["classes"]:
        elements.append(Bar(cls["name"], cls["mean"], num(cls["mean"]) + ("%" if cls["mean"] is not None else ""), lang))
    heading(labels["distribution"])
    for item in snapshot["distribution"]:
        elements.append(Bar(item["label"], item["percentage"], f"{item['count']} · {num(item['percentage'])}%", lang, PALETTE[item["key"]]))
    elements.append(Spacer(1, 8))
    elements.append(Text(labels["rules"], lang, 9, color=PDF_MUTED))
    elements.append(PageBreak())
    heading(labels["students"])
    if not snapshot["students"]:
        elements.append(Text(labels["empty"], lang))
    for row in snapshot["students"]:
        label = f"{row['full_name']} · {row['class_name']} · {row['score_label']}"
        display = (num(row["percentage"]) + "% · " if row["percentage"] is not None else "") + row["level_label"]
        elements.append(Bar(label, row["percentage"], display, lang, PALETTE[row["level"]]))
    insights(snapshot["insights"])
    if student_id:
        row = next(r for r in snapshot["students"] if r["id"] == student_id)
        elements.append(PageBreak())
        heading(labels["individual"])
        elements.extend([Donut(row, snapshot), Spacer(1, 12)])
        heading(labels["comparison"])
        elements.append(Bar(labels["student"], row["percentage"], num(row["percentage"]) + ("%" if row["percentage"] is not None else ""), lang))
        elements.append(Bar(labels["mean"], row["class_mean"], num(row["class_mean"]) + ("%" if row["class_mean"] is not None else ""), lang, PDF_PURPLE))
        insights(row["insights"])
    elements.append(Spacer(1, 12))
    elements.append(Text(labels["scope_note"], lang, 9, color=PDF_MUTED))
    doc.build(elements, onFirstPage=footer, onLaterPages=footer)
    return stream.getvalue()
