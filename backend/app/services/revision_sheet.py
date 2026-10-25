"""ClearDesk Revision Sheet Generator (ReportLab).

Generates a clean, single-page A4 revision PDF containing:
1. Document title and source metadata
2. Color-coded topic priorities (High/Medium/Low from Exam Radar)
3. Condensed 3-level notes (L1 keywords, L2 one-line meaning, L3 principles/formulas)
4. Strict 1-page A4 guarantee.
"""

import io
import re
import datetime
from typing import List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models import File, Note, Topic
from app.services.notes import get_or_generate_notes


def clean_text_for_pdf(text: str) -> str:
    """Clean markdown or non-latin characters that standard PDF fonts cannot render."""
    if not text:
        return ""
    # Strip markdown bold/italic
    cleaned = re.sub(r"\*\*([^\*]+)\*\*", r"\1", text)
    cleaned = re.sub(r"\*([^\*]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    # Replace common unicode chars
    cleaned = cleaned.replace("\u2013", "-").replace("\u2014", "-").replace("\u2022", "*")
    cleaned = cleaned.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    return cleaned.strip()


def generate_revision_sheet_pdf(
    file_id: str, workspace_id: str, db: Session
) -> bytes:
    """Generate a guaranteed 1-page A4 revision sheet PDF for a document."""
    # 1. Fetch File
    file_record = (
        db.query(File)
        .filter(File.id == file_id, File.workspace_id == workspace_id)
        .first()
    )
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found in current workspace.",
        )

    if file_record.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File '{file_record.name}' is still processing or failed.",
        )

    # 2. Fetch or Generate Notes
    notes = db.query(Note).filter(Note.file_id == file_id).order_by(Note.id.asc()).all()
    if not notes:
        # Generate on demand
        notes_res = get_or_generate_notes(
            file_id=file_id,
            workspace_id=workspace_id,
            language="en",
            force_regenerate=False,
            db=db,
        )
        notes = db.query(Note).filter(Note.file_id == file_id).order_by(Note.id.asc()).all()

    # 3. Fetch Workspace Topics for Priority Badges
    topics = (
        db.query(Topic)
        .filter(Topic.workspace_id == workspace_id)
        .order_by(Topic.priority_score.desc())
        .all()
    )

    # 4. Draw PDF Canvas on exact A4 dimensions
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4  # 595.28 x 841.89 points
    margin = 32
    content_w = w - (margin * 2)

    # --- Header Banner ---
    c.setFillColor(colors.HexColor("#0f172a"))
    c.roundRect(margin, h - 85, content_w, 55, 6, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 13)
    doc_title = clean_text_for_pdf(file_record.name)
    if len(doc_title) > 42:
        doc_title = doc_title[:39] + "..."
    c.drawString(margin + 16, h - 52, f"ClearDesk Revision Sheet: {doc_title}")

    c.setFont("Helvetica", 8.5)
    c.setFillColor(colors.HexColor("#94a3b8"))
    meta_line = f"Condensed 3-Level Notes & Exam Radar Focus | Format: {file_record.type.upper()} | Pages: {file_record.page_count} | Session: {workspace_id[:8]}"
    c.drawString(margin + 16, h - 68, meta_line)

    # --- Topic Priority Bar ---
    c.setFillColor(colors.HexColor("#f8fafc"))
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.roundRect(margin, h - 130, content_w, 38, 4, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#475569"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin + 12, h - 105, "TOPIC PRIORITIES:")

    if topics:
        badge_x = margin + 110
        # Render up to 3 highest priority topics
        for idx, t in enumerate(topics[:3]):
            t_name = clean_text_for_pdf(t.name)
            if len(t_name) > 18:
                t_name = t_name[:16] + "..."

            if t.priority_score >= 60:
                bg_col = colors.HexColor("#fee2e2")
                text_col = colors.HexColor("#991b1b")
                lbl = f"HIGH: {t_name}"
            elif t.priority_score >= 35:
                bg_col = colors.HexColor("#fef3c7")
                text_col = colors.HexColor("#92400e")
                lbl = f"MED: {t_name}"
            else:
                bg_col = colors.HexColor("#e0e7ff")
                text_col = colors.HexColor("#3730a3")
                lbl = f"CORE: {t_name}"

            badge_w = c.stringWidth(lbl, "Helvetica-Bold", 7.5) + 14
            if badge_x + badge_w > margin + content_w - 10:
                break

            c.setFillColor(bg_col)
            c.roundRect(badge_x, h - 120, badge_w, 20, 4, fill=1, stroke=0)
            c.setFillColor(text_col)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(badge_x + 7, h - 107, lbl)

            badge_x += badge_w + 6
    else:
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#64748b"))
        c.drawString(margin + 110, h - 107, "Equal Priority Focus. (Upload syllabus in Exam Radar for weighted rankings)")

    # --- Main 3-Level Notes Content Area ---
    # We fit up to 3 sections comfortably on A4
    display_notes = notes[:3] if notes else []
    num_sections = len(display_notes)

    # Budget vertical height per section
    available_height = (h - 145) - 55  # ~640 pt
    if num_sections > 0:
        box_h = min(int((available_height - (num_sections * 10)) / num_sections), 200)
    else:
        box_h = 180

    curr_y = h - 145

    if not display_notes:
        c.setFillColor(colors.HexColor("#ffffff"))
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.roundRect(margin, curr_y - 120, content_w, 120, 5, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont("Helvetica", 10)
        c.drawCentredString(w / 2, curr_y - 65, "No notes available for this document.")
    else:
        for s_idx, n in enumerate(display_notes):
            c.setFillColor(colors.HexColor("#ffffff"))
            c.setStrokeColor(colors.HexColor("#cbd5e1"))
            c.roundRect(margin, curr_y - box_h, content_w, box_h, 5, fill=1, stroke=1)

            # Section Header Bar
            c.setFillColor(colors.HexColor("#f1f5f9"))
            c.rect(margin, curr_y - 24, content_w, 24, fill=1, stroke=0)

            title = clean_text_for_pdf(n.section_title)
            if len(title) > 65:
                title = title[:62] + "..."
            c.setFillColor(colors.HexColor("#0f172a"))
            c.setFont("Helvetica-Bold", 9)
            c.drawString(margin + 10, curr_y - 16, f"Section {s_idx + 1}: {title}")

            # Page badges
            pages = n.source_pages if hasattr(n, "source_pages") and n.source_pages else []
            if pages:
                p_text = f"P. {', '.join(str(p) for p in pages[:4])}"
                c.setFont("Helvetica", 7.5)
                c.setFillColor(colors.HexColor("#475569"))
                c.drawRightString(margin + content_w - 12, curr_y - 16, p_text)

            # --- Level 1: Key Terms ---
            c.setFont("Helvetica-Bold", 7.5)
            c.setFillColor(colors.HexColor("#2563eb"))
            c.drawString(margin + 10, curr_y - 42, "LEVEL 1: KEY TERMS")

            keywords = n.level1_keywords or []
            kw_x = margin + 115
            for kw in keywords[:6]:
                kw_str = clean_text_for_pdf(kw)
                kw_w = c.stringWidth(kw_str, "Helvetica", 7) + 10
                if kw_x + kw_w > margin + content_w - 10:
                    break
                c.setFillColor(colors.HexColor("#eff6ff"))
                c.setStrokeColor(colors.HexColor("#bfdbfe"))
                c.roundRect(kw_x, curr_y - 48, kw_w, 14, 3, fill=1, stroke=1)
                c.setFillColor(colors.HexColor("#1d4ed8"))
                c.setFont("Helvetica", 7)
                c.drawString(kw_x + 5, curr_y - 39, kw_str)
                kw_x += kw_w + 5

            # --- Level 2: Core Meaning ---
            c.setFont("Helvetica-Bold", 7.5)
            c.setFillColor(colors.HexColor("#475569"))
            c.drawString(margin + 10, curr_y - 65, "LEVEL 2: MEANING")

            meaning = clean_text_for_pdf(n.level2_meaning or "")
            if len(meaning) > 135:
                meaning = meaning[:132] + "..."
            c.setFont("Helvetica", 7.5)
            c.setFillColor(colors.HexColor("#1e293b"))
            c.drawString(margin + 115, curr_y - 65, meaning)

            # --- Level 3: Principles / Formulas ---
            c.setFont("Helvetica-Bold", 7.5)
            c.setFillColor(colors.HexColor("#475569"))
            c.drawString(margin + 10, curr_y - 88, "LEVEL 3: PRINCIPLES")

            explanation = clean_text_for_pdf(n.level3_explanation or "")
            sentences = [s.strip() for s in re.split(r"\.\s+|\n+", explanation) if len(s.strip()) > 8]
            bullet_y = curr_y - 88
            c.setFont("Helvetica", 7.5)
            c.setFillColor(colors.HexColor("#334155"))

            max_bullets = max(2, (box_h - 100) // 14)
            for b in sentences[:max_bullets]:
                if bullet_y < curr_y - box_h + 12:
                    break
                b_line = b if len(b) <= 90 else b[:87] + "..."
                c.drawString(margin + 115, bullet_y, f"* {b_line}")
                bullet_y -= 13

            curr_y -= (box_h + 8)

    # --- Footer ---
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.75)
    c.line(margin, 42, w - margin, 42)

    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#64748b"))
    c.drawString(
        margin,
        30,
        "ClearDesk Grounded Document Intelligence | Single-Page Revision Sheet | Strict Evidence Bound",
    )
    c.drawRightString(w - margin, 30, "Page 1 of 1")

    c.save()
    buf.seek(0)
    return buf.read()
