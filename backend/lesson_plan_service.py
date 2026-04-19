import io
import json
import os
import re
from html import escape
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table as DocxTable, _Cell
from docx.text.paragraph import Paragraph
from openai import OpenAI
from pypdf import PdfReader


DEFAULT_PROVIDER = os.environ.get("LESSON_PLAN_AI_PROVIDER", "openai").strip().lower() or "openai"
DEFAULT_MODEL = os.environ.get("LESSON_PLAN_AI_MODEL", "gpt-5.4").strip() or "gpt-5.4"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "").strip() or None
LESSON_PLAN_OUTPUT_DIR = Path(__file__).parent / "generated" / "lesson-plans"

MAX_PDF_TEXT_CHARS = 24000
MAX_TEMPLATE_BLOCKS = 120
MAX_TEMPLATE_TEXT_CHARS = 24000


def sanitize_filename(filename: str, fallback: str) -> str:
    raw = (filename or "").strip()
    if not raw:
        raw = fallback
    raw = raw.replace("\\", "/").split("/")[-1]
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", raw).strip("-.")
    return safe or fallback


def ensure_docx_file(filename: str) -> str:
    safe = sanitize_filename(filename, "lesson-plan-template.docx")
    if not safe.lower().endswith(".docx"):
        raise ValueError("Please upload a .docx Word document.")
    return safe


def ensure_pdf_file(filename: str) -> str:
    safe = sanitize_filename(filename, "lesson-plan-source.pdf")
    if not safe.lower().endswith(".pdf"):
        raise ValueError("Please upload a PDF file.")
    return safe


def _normalize_text(value: Any) -> str:
    text = str(value or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit].rstrip()}\n\n[truncated]"


def _iter_block_items(parent: DocxDocument | _Cell) -> Iterable[Paragraph | DocxTable]:
    if isinstance(parent, DocxDocument):
        parent_elm = parent.element.body
    elif isinstance(parent, _Cell):
        parent_elm = parent._tc
    else:
        raise TypeError("Unsupported parent for DOCX traversal")

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield DocxTable(child, parent)


def _build_word_preview_html(document: DocxDocument, max_tables: int = 8) -> str:
    html_parts: List[str] = []
    table_count = 0
    for block in _iter_block_items(document):
        if isinstance(block, Paragraph):
            text = _normalize_text(block.text)
            if text:
                html_parts.append(f"<p>{escape(text)}</p>")
            continue

        if table_count >= max_tables:
            continue
        table_count += 1
        rows_html: List[str] = []
        for row in block.rows:
            cells_html: List[str] = []
            for cell in row.cells:
                cell_text = "<br/>".join(
                    escape(_normalize_text(paragraph.text))
                    for paragraph in cell.paragraphs
                    if _normalize_text(paragraph.text)
                )
                cells_html.append(f"<td>{cell_text or '&nbsp;'}</td>")
            rows_html.append(f"<tr>{''.join(cells_html)}</tr>")
        html_parts.append(
            "<table class=\"lesson-plan-preview-table\"><tbody>"
            f"{''.join(rows_html)}"
            "</tbody></table>"
        )
    return "".join(html_parts) or "<p>No readable content found in this Word file.</p>"


def extract_docx_template(docx_bytes: bytes) -> Dict[str, Any]:
    document = Document(io.BytesIO(docx_bytes))
    editable_blocks: List[Dict[str, Any]] = []
    table_previews: List[Dict[str, Any]] = []
    paragraph_count = 0
    table_count = 0

    for block in _iter_block_items(document):
        if isinstance(block, Paragraph):
            block_id = f"p-{paragraph_count}"
            text = _normalize_text(block.text)
            editable_blocks.append(
                {
                    "block_id": block_id,
                    "kind": "paragraph",
                    "text": text,
                    "style": (block.style.name if block.style is not None else "") or "",
                }
            )
            paragraph_count += 1
            continue

        table_id = table_count
        table_count += 1
        rows_preview: List[List[str]] = []
        for row_index, row in enumerate(block.rows):
            row_preview: List[str] = []
            for cell_index, cell in enumerate(row.cells):
                cell_texts: List[str] = []
                for para_index, paragraph in enumerate(cell.paragraphs):
                    block_id = f"t-{table_id}-r-{row_index}-c-{cell_index}-p-{para_index}"
                    text = _normalize_text(paragraph.text)
                    editable_blocks.append(
                        {
                            "block_id": block_id,
                            "kind": "table_cell",
                            "text": text,
                            "style": (paragraph.style.name if paragraph.style is not None else "") or "",
                        }
                    )
                    if text:
                        cell_texts.append(text)
                row_preview.append("\n".join(cell_texts).strip())
            rows_preview.append(row_preview)
        table_previews.append({"table_id": f"t-{table_id}", "rows": rows_preview})

    non_empty_blocks = [block for block in editable_blocks if block["text"]]
    preview_text = "\n\n".join(block["text"] for block in non_empty_blocks[:20])
    return {
        "document": document,
        "editable_blocks": editable_blocks,
        "non_empty_blocks": non_empty_blocks,
        "paragraph_count": paragraph_count,
        "table_count": table_count,
        "preview_text": _truncate(preview_text, 4000),
        "preview_html": _build_word_preview_html(document),
        "table_previews": table_previews[:8],
    }


def extract_pdf_text(pdf_bytes: bytes) -> Dict[str, Any]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages: List[str] = []
    for page in reader.pages:
        pages.append(_normalize_text(page.extract_text() or ""))
    joined = "\n\n".join(page for page in pages if page)
    return {
        "page_count": len(reader.pages),
        "text": joined,
        "preview_text": _truncate(joined, 5000),
    }


def _make_openai_client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not configured on the backend.")
    kwargs: Dict[str, Any] = {"api_key": OPENAI_API_KEY}
    if OPENAI_BASE_URL:
        kwargs["base_url"] = OPENAI_BASE_URL
    return OpenAI(**kwargs)


def _strip_json_wrappers(content: str) -> str:
    text = (content or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _prepare_ai_payload(pdf_text: str, template_blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    trimmed_pdf = _truncate(pdf_text, MAX_PDF_TEXT_CHARS)
    selected_blocks: List[Dict[str, Any]] = []
    char_count = 0
    for block in template_blocks[:MAX_TEMPLATE_BLOCKS]:
        text = block.get("text") or ""
        char_count += len(text)
        if char_count > MAX_TEMPLATE_TEXT_CHARS:
            break
        selected_blocks.append(
            {
                "block_id": block["block_id"],
                "kind": block["kind"],
                "style": block.get("style") or "",
                "text": text,
            }
        )
    return {"pdf_text": trimmed_pdf, "template_blocks": selected_blocks}


def generate_lesson_plan_replacements(
    pdf_text: str,
    template_blocks: List[Dict[str, Any]],
    *,
    provider: str | None = None,
    model: str | None = None,
) -> Dict[str, Any]:
    resolved_provider = (provider or DEFAULT_PROVIDER).strip().lower() or DEFAULT_PROVIDER
    resolved_model = (model or DEFAULT_MODEL).strip() or DEFAULT_MODEL

    if resolved_provider != "openai":
        raise RuntimeError(f"Unsupported lesson-plan AI provider: {resolved_provider}")

    client = _make_openai_client()
    payload = _prepare_ai_payload(pdf_text, template_blocks)
    system_prompt = (
        "You rewrite lesson-plan content inside an existing Word template. "
        "Keep the template layout unchanged. Do not invent a new structure. "
        "Return strict JSON with keys 'summary' and 'replacements'. "
        "Each replacement must include block_id and text. "
        "Only replace text content. Preserve labels, ordering, tables, and the overall meaning of the template. "
        "Use the PDF content as the source of truth. "
        "If a block should stay the same, either omit it or return its original text unchanged. "
        "Do not return markdown."
    )
    user_prompt = json.dumps(payload, ensure_ascii=False)
    response = client.chat.completions.create(
        model=resolved_model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    raw = response.choices[0].message.content if response.choices else "{}"
    parsed = json.loads(_strip_json_wrappers(raw or "{}"))
    replacements = parsed.get("replacements") or []
    if not isinstance(replacements, list):
        raise RuntimeError("The AI response did not include a valid replacements list.")
    normalized_replacements: List[Dict[str, str]] = []
    for item in replacements:
        block_id = str((item or {}).get("block_id") or "").strip()
        text = _normalize_text((item or {}).get("text") or "")
        if block_id:
            normalized_replacements.append({"block_id": block_id, "text": text})
    return {
        "provider": resolved_provider,
        "model": resolved_model,
        "summary": _normalize_text(parsed.get("summary") or ""),
        "replacements": normalized_replacements,
    }


def _replace_paragraph_text(paragraph: Paragraph, text: str) -> None:
    runs = paragraph.runs
    if not runs:
        paragraph.add_run(text)
        return
    runs[0].text = text
    for run in runs[1:]:
        run.text = ""


def apply_replacements_to_document(docx_bytes: bytes, replacements: List[Dict[str, str]]) -> Tuple[bytes, int]:
    template_data = extract_docx_template(docx_bytes)
    document: DocxDocument = template_data["document"]
    block_lookup: Dict[str, Paragraph] = {}

    paragraph_count = 0
    table_count = 0
    for block in _iter_block_items(document):
        if isinstance(block, Paragraph):
            block_lookup[f"p-{paragraph_count}"] = block
            paragraph_count += 1
            continue

        table_id = table_count
        table_count += 1
        for row_index, row in enumerate(block.rows):
            for cell_index, cell in enumerate(row.cells):
                for para_index, paragraph in enumerate(cell.paragraphs):
                    block_lookup[f"t-{table_id}-r-{row_index}-c-{cell_index}-p-{para_index}"] = paragraph

    updated = 0
    for replacement in replacements:
        block_id = replacement.get("block_id") or ""
        paragraph = block_lookup.get(block_id)
        if paragraph is None:
            continue
        _replace_paragraph_text(paragraph, replacement.get("text") or "")
        updated += 1

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue(), updated


def save_generated_docx(user_id: str, filename: str, docx_bytes: bytes) -> Dict[str, str]:
    LESSON_PLAN_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    document_id = sanitize_filename(user_id, "user").replace(".", "-") + "-" + sanitize_filename(os.urandom(6).hex(), "doc")
    safe_name = sanitize_filename(filename, "generated-lesson-plan.docx")
    output_path = LESSON_PLAN_OUTPUT_DIR / f"{document_id}.docx"
    output_path.write_bytes(docx_bytes)
    metadata_path = LESSON_PLAN_OUTPUT_DIR / f"{document_id}.json"
    metadata_path.write_text(json.dumps({"filename": safe_name}, ensure_ascii=False), encoding="utf-8")
    return {"document_id": document_id, "filename": safe_name, "path": str(output_path)}

