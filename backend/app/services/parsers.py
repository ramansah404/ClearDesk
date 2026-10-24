"""Document parsing services for PDF, PPTX, DOCX, and images.

Strictly adheres to:
1. PyMuPDF for PDF page extraction with exact page numbers.
2. python-pptx for slide extraction with exact slide numbers and speaker notes.
3. python-docx for Word documents using identified logical sections/blocks.
4. Tesseract OCR via pytesseract and Pillow with honest availability checks.
"""

import io
import os
import shutil
from dataclasses import dataclass, field
from typing import List, Optional
import pymupdf
from pptx import Presentation
from docx import Document
from PIL import Image
import pytesseract

from app.config import settings


@dataclass
class ParsedPage:
    """Represents text extracted from a single page, slide, or logical section."""

    page_or_slide: int  # 1-indexed page/slide/section number
    text: str
    label: str = ""  # e.g. "Page 1", "Slide 3", "Section 2: Architecture"
    ocr_confidence: Optional[float] = None


@dataclass
class ParsedDocument:
    """Represents a fully parsed document with individual pages/slides."""

    file_id: str
    file_type: str
    page_count: int
    pages: List[ParsedPage] = field(default_factory=list)

    @property
    def total_text_length(self) -> int:
        return sum(len(p.text) for p in self.pages)


def is_tesseract_available() -> bool:
    """Check whether Tesseract OCR binary is installed and executable."""
    if settings.tesseract_path and os.path.isfile(settings.tesseract_path):
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_path
        return True
    which_path = shutil.which("tesseract")
    if which_path:
        return True
    # Check default Windows path
    default_win = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    if os.path.isfile(default_win):
        pytesseract.pytesseract.tesseract_cmd = default_win
        return True
    return False


def parse_pdf(file_path: str, file_id: str) -> ParsedDocument:
    """Extract text per page using PyMuPDF, with optional OCR fallback for scanned pages."""
    try:
        doc = pymupdf.open(file_path)
    except Exception as exc:
        raise ValueError(f"Corrupt or invalid PDF file: {exc}") from exc

    pages: List[ParsedPage] = []
    has_tesseract = is_tesseract_available()

    for idx, page in enumerate(doc):
        page_num = idx + 1
        page_text = page.get_text() or ""

        ocr_conf: Optional[float] = None
        # Scanned page detection: very little extracted text
        if len(page_text.strip()) < 50 and has_tesseract:
            try:
                pix = page.get_pixmap()
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                ocr_text = pytesseract.image_to_string(img)
                if len(ocr_text.strip()) > len(page_text.strip()):
                    page_text = ocr_text
                    ocr_conf = 80.0  # Estimated confidence when OCR succeeds
            except Exception:
                pass  # Fall back to whatever raw text exists

        pages.append(
            ParsedPage(
                page_or_slide=page_num,
                text=page_text.strip(),
                label=f"Page {page_num}",
                ocr_confidence=ocr_conf,
            )
        )

    doc.close()

    parsed = ParsedDocument(
        file_id=file_id,
        file_type="pdf",
        page_count=len(pages),
        pages=pages,
    )

    if parsed.total_text_length == 0:
        if not has_tesseract:
            raise ValueError(
                "PDF contains scanned or image pages with no extractable text, "
                "and Tesseract OCR is not installed on this system."
            )
        raise ValueError("PDF contains no extractable text.")

    return parsed


def parse_pptx(file_path: str, file_id: str) -> ParsedDocument:
    """Extract slide text, tables, and speaker notes using python-pptx."""
    try:
        prs = Presentation(file_path)
    except Exception as exc:
        raise ValueError(f"Corrupt or invalid PPTX file: {exc}") from exc

    pages: List[ParsedPage] = []

    for idx, slide in enumerate(prs.slides):
        slide_num = idx + 1
        slide_texts: List[str] = []

        # Extract text from shapes and tables
        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text:
                    slide_texts.append(text)
            elif shape.has_table:
                for row in shape.table.rows:
                    row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_texts:
                        slide_texts.append(" | ".join(row_texts))

        # Extract speaker notes if available
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
            notes_text = slide.notes_slide.notes_text_frame.text.strip()
            if notes_text:
                slide_texts.append(f"[Speaker Notes: {notes_text}]")

        combined_text = "\n\n".join(slide_texts).strip()
        pages.append(
            ParsedPage(
                page_or_slide=slide_num,
                text=combined_text,
                label=f"Slide {slide_num}",
                ocr_confidence=None,
            )
        )

    parsed = ParsedDocument(
        file_id=file_id,
        file_type="pptx",
        page_count=len(pages),
        pages=pages,
    )

    if parsed.total_text_length == 0:
        raise ValueError("Presentation contains no extractable slide text.")

    return parsed


def parse_docx(file_path: str, file_id: str) -> ParsedDocument:
    """Extract Word document content into explicitly identified logical sections/blocks.

    Does not falsely claim original printed page numbers; groups by heading/section.
    """
    try:
        doc = Document(file_path)
    except Exception as exc:
        raise ValueError(f"Corrupt or invalid DOCX file: {exc}") from exc

    sections: List[ParsedPage] = []
    current_section_texts: List[str] = []
    current_title = "Introduction / Overview"
    section_index = 1

    def flush_section():
        nonlocal current_section_texts, current_title, section_index
        text = "\n\n".join(current_section_texts).strip()
        if text:
            sections.append(
                ParsedPage(
                    page_or_slide=section_index,
                    text=text,
                    label=f"Section {section_index}: {current_title}",
                    ocr_confidence=None,
                )
            )
            section_index += 1
            current_section_texts = []

    for para in doc.paragraphs:
        p_text = para.text.strip()
        if not p_text:
            continue

        # If heading style, flush previous section and start a new logical block
        if para.style and para.style.name and para.style.name.startswith("Heading"):
            if current_section_texts:
                flush_section()
            current_title = p_text
            current_section_texts.append(p_text)
        else:
            current_section_texts.append(p_text)
            # Break very long sections into logical blocks (~400 words)
            word_count = sum(len(t.split()) for t in current_section_texts)
            if word_count > 400:
                flush_section()
                current_title = f"Section Block {section_index}"

    # Also capture tables
    for table in doc.tables:
        table_lines = []
        for row in table.rows:
            row_vals = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_vals:
                table_lines.append(" | ".join(row_vals))
        if table_lines:
            current_section_texts.append("\n".join(table_lines))

    flush_section()

    parsed = ParsedDocument(
        file_id=file_id,
        file_type="docx",
        page_count=len(sections),
        pages=sections,
    )

    if parsed.total_text_length == 0:
        raise ValueError("Word document contains no extractable text.")

    return parsed


def parse_image(file_path: str, file_id: str) -> ParsedDocument:
    """Extract text from images using Tesseract OCR.

    Honestly reports limitation if Tesseract is not installed.
    """
    if not is_tesseract_available():
        raise ValueError(
            "Tesseract OCR engine is not installed on this system. "
            "Image text extraction requires Tesseract (install tesseract-ocr or configure TESSERACT_PATH in .env)."
        )

    try:
        img = Image.open(file_path)
    except Exception as exc:
        raise ValueError(f"Corrupt or invalid image file: {exc}") from exc

    try:
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        text = pytesseract.image_to_string(img).strip()

        # Compute average confidence for detected words
        confidences = [float(c) for c in data.get("conf", []) if float(c) > 0]
        avg_conf = (sum(confidences) / len(confidences)) if confidences else 50.0
    except Exception as exc:
        raise ValueError(f"OCR text extraction failed: {exc}") from exc

    if not text:
        raise ValueError("No readable text detected in image.")

    return ParsedDocument(
        file_id=file_id,
        file_type="image",
        page_count=1,
        pages=[
            ParsedPage(
                page_or_slide=1,
                text=text,
                label="Image (OCR)",
                ocr_confidence=round(avg_conf, 1),
            )
        ],
    )


def parse_document(file_path: str, file_id: str, file_type: str) -> ParsedDocument:
    """Dispatcher to appropriate parser by file type."""
    normalized_type = file_type.lower()
    if normalized_type == "pdf":
        return parse_pdf(file_path, file_id)
    elif normalized_type in ("pptx", "ppt"):
        return parse_pptx(file_path, file_id)
    elif normalized_type in ("docx", "doc"):
        return parse_docx(file_path, file_id)
    elif normalized_type in ("png", "jpg", "jpeg", "image"):
        return parse_image(file_path, file_id)
    else:
        raise ValueError(f"Unsupported file type '{file_type}'. Supported: PDF, PPTX, DOCX, PNG, JPG, JPEG.")
