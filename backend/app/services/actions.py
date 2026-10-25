"""Action item extraction, date validation, conflict detection, and calendar export.

Implements Section 9.4 and Section 8 of PROJECT_SPEC.md:
- Extract items: kind (deadline | deliverable | missing_info), label, value, date_text, owner, page_or_slide, quote.
- Validate dates using dateparser.
- Detect missing info mentioned in docs.
- Conflict check: group by normalized label across different files.
- .ics export: RFC 5545 VEVENT per dated item.
"""

import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict
from pydantic import BaseModel, Field

import dateparser
from sqlalchemy.orm import Session
from sqlalchemy import delete

from app.config import settings
from app.models import ActionItem, Conflict, File, Chunk
from app.schemas import (
    ActionItemResponse,
    ConflictResponse,
    ActionsBoardResponse,
    ActionsSummary,
)


class RawExtractedItem(BaseModel):
    """Raw action item schema for Gemini structured output."""

    kind: Literal["deadline", "deliverable", "missing_info"] = Field(
        ..., description="Action item kind: deadline, deliverable, or missing_info"
    )
    label: str = Field(..., description="Short category/title, e.g. 'Final Project Submission'")
    value: str = Field(..., description="Detailed description of requirement, deadline, or missing information")
    date_text: Optional[str] = Field(None, description="Raw date/time string from text if applicable")
    owner: Optional[str] = Field(None, description="Assigned person or team if specified")
    page_or_slide: int = Field(default=1, description="Page or slide number where this item appears")
    quote: str = Field(..., description="Exact supporting quote from document chunk")


def load_extract_prompt_template() -> str:
    """Load prompt template from prompts directory."""
    prompt_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "prompts", "extract_actions.txt"
    )
    if os.path.exists(prompt_file):
        with open(prompt_file, "r", encoding="utf-8") as f:
            return f.read()

    return """Analyze the document text and extract action items:
Categories: "deadline", "deliverable", "missing_info".
DOCUMENT: {file_name}
DOCUMENT CHUNKS:
{chunks_text}
Return JSON array of items."""


def parse_due_date(date_text: Optional[str]) -> Optional[datetime]:
    """Parse raw date string using dateparser into datetime."""
    if not date_text or not date_text.strip():
        return None

    cleaned = date_text.strip()
    try:
        parsed = dateparser.parse(
            cleaned,
            settings={
                "PREFER_DATES_FROM": "future",
                "RETURN_AS_TIMEZONE_AWARE": False,
                "RELATIVE_BASE": datetime.now(),
            },
        )
        if parsed:
            return parsed
        # Fallback to search_dates if date string is embedded in descriptive text
        from dateparser.search import search_dates
        matches = search_dates(
            cleaned,
            settings={
                "PREFER_DATES_FROM": "future",
                "RETURN_AS_TIMEZONE_AWARE": False,
                "RELATIVE_BASE": datetime.now(),
            },
        )
        if matches:
            return matches[0][1]
        return None
    except Exception:
        return None


def extract_actions_for_file(
    file_id: str, workspace_id: str, db: Session
) -> List[ActionItem]:
    """Extract action items from a ready document using Gemini."""
    file_record = (
        db.query(File)
        .filter(File.id == file_id, File.workspace_id == workspace_id)
        .first()
    )
    if not file_record:
        raise ValueError(f"File '{file_id}' not found in current workspace.")

    if file_record.status != "ready":
        raise ValueError(f"File '{file_record.name}' is not ready (status: {file_record.status}).")

    # Load chunks
    chunks = (
        db.query(Chunk)
        .filter(Chunk.file_id == file_id)
        .order_by(Chunk.page_or_slide.asc(), Chunk.chunk_index.asc())
        .all()
    )
    if not chunks:
        return []

    # Format chunks text
    chunk_snippets: List[str] = []
    for c in chunks:
        chunk_snippets.append(f"[Page/Slide {c.page_or_slide}]: {c.text}")
    chunks_text = "\n\n".join(chunk_snippets)

    # Prepare Gemini call
    template = load_extract_prompt_template()
    prompt = template.format(
        file_name=file_record.name,
        chunks_text=chunks_text,
    )

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        model_name = settings.llm_model.strip() or "gemini-3.5-flash-lite"

        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[RawExtractedItem],
                temperature=0.1,
            ),
        )

        extracted_raw: List[RawExtractedItem] = response.parsed or []
    except Exception as exc:
        raise RuntimeError(f"Gemini action extraction failed: {exc}") from exc

    # Remove existing items for this file to prevent duplicate accumulation
    db.query(ActionItem).filter(ActionItem.file_id == file_id).delete()
    db.commit()

    saved_items: List[ActionItem] = []
    for raw in extracted_raw:
        due_dt = parse_due_date(raw.date_text)
        action_obj = ActionItem(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            file_id=file_id,
            kind=raw.kind,
            label=raw.label.strip(),
            value=raw.value.strip(),
            due_date=due_dt,
            owner=raw.owner.strip() if raw.owner else None,
            page_or_slide=raw.page_or_slide,
            quote=raw.quote.strip() if raw.quote else None,
        )
        db.add(action_obj)
        saved_items.append(action_obj)

    db.commit()
    return saved_items


def normalize_label(label: str) -> str:
    """Normalize label for conflict grouping."""
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", label.lower())
    words = [w for w in cleaned.split() if w not in {"the", "a", "an", "for", "to", "of", "and", "in", "is"}]
    return " ".join(words)


def labels_match(label_a: str, label_b: str) -> bool:
    """Check if two action item labels refer to the same requirement."""
    norm_a = normalize_label(label_a)
    norm_b = normalize_label(label_b)

    if norm_a == norm_b:
        return True

    # Check key overlap
    words_a = set(norm_a.split())
    words_b = set(norm_b.split())
    if not words_a or not words_b:
        return False

    intersection = words_a.intersection(words_b)
    # If key nouns/verbs overlap strongly
    if len(intersection) >= 2 or (len(words_a) <= 2 and len(intersection) >= 1):
        return True

    return False


def are_deliverables_contradictory(val_a: str, val_b: str) -> tuple[bool, str]:
    """Check if two deliverable specifications genuinely contradict each other.

    Complementary requirements (such as submitting an 8-page PDF report AND
    a ZIP archive, or providing both a portal ZIP archive and a GitHub link)
    must NOT be flagged as conflicting unless the documents explicitly establish
    mutually exclusive requirements (e.g., explicit prohibitions or restrictive 'only' rules).
    """
    va = val_a.lower()
    vb = val_b.lower()

    # 1. Mutually exclusive prohibitions on submission format
    zip_prohibited_a = any(p in va for p in ["no zip", "do not submit zip", "zip prohibited", "zip not accepted", "github only", "only github"])
    zip_prohibited_b = any(p in vb for p in ["no zip", "do not submit zip", "zip prohibited", "zip not accepted", "github only", "only github"])
    git_prohibited_a = any(p in va for p in ["no github", "github not accepted", "zip only", "only zip", "no external links"])
    git_prohibited_b = any(p in vb for p in ["no github", "github not accepted", "zip only", "only zip", "no external links"])

    is_zip_a = "zip" in va or "archive" in va
    is_zip_b = "zip" in vb or "archive" in vb
    is_git_a = "github" in va or "repository" in va
    is_git_b = "github" in vb or "repository" in vb

    if (is_zip_a and zip_prohibited_b) or (is_zip_b and zip_prohibited_a):
        return True, "Conflicting submission format: one document requires a ZIP archive, whereas the other explicitly prohibits ZIP submissions."
    if (is_git_a and git_prohibited_b) or (is_git_b and git_prohibited_a):
        return True, "Conflicting submission format: one document requires a GitHub repository, whereas the other prohibits external repository links."

    # 2. Mutually exclusive document file format requirements
    docx_prohibited_a = "pdf only" in va or "no word" in va or "no docx" in va
    docx_prohibited_b = "pdf only" in vb or "no word" in vb or "no docx" in vb
    pdf_prohibited_a = "word only" in va or "docx only" in va or "no pdf" in va
    pdf_prohibited_b = "word only" in vb or "docx only" in vb or "no pdf" in vb

    is_pdf_a = "pdf" in va
    is_pdf_b = "pdf" in vb
    is_docx_a = "docx" in va or "word" in va
    is_docx_b = "docx" in vb or "word" in vb

    if (is_docx_a and docx_prohibited_b) or (is_docx_b and docx_prohibited_a):
        return True, "Conflicting document format rules: one document mandates PDF only, while the other specifies Word/DOCX."
    if (is_pdf_a and pdf_prohibited_b) or (is_pdf_b and pdf_prohibited_a):
        return True, "Conflicting document format rules: one document mandates Word/DOCX only, while the other specifies PDF."

    # 3. Solo vs Team contradiction
    is_individual_strict_a = any(p in va for p in ["individual only", "solo only", "strictly individual", "no team", "no group"])
    is_individual_strict_b = any(p in vb for p in ["individual only", "solo only", "strictly individual", "no team", "no group"])
    is_team_strict_a = any(p in va for p in ["team only", "group only", "teams of", "strictly in teams"])
    is_team_strict_b = any(p in vb for p in ["team only", "group only", "teams of", "strictly in teams"])

    if (is_individual_strict_a and is_team_strict_b) or (is_individual_strict_b and is_team_strict_a):
        return True, "Conflicting collaboration policies: one document specifies individual-only submission while the other mandates team submission."

    # 4. Grading weight contradiction
    weights_a = re.findall(r"(\d+)%", va)
    weights_b = re.findall(r"(\d+)%", vb)
    if weights_a and weights_b and set(weights_a) != set(weights_b):
        return True, f"Conflicting grading weights: one document specifies {weights_a[0]}% while the other specifies {weights_b[0]}%."

    return False, ""


def detect_conflicts(workspace_id: str, db: Session) -> List[Conflict]:
    """Detect cross-document contradictions in dates or values."""
    items = (
        db.query(ActionItem)
        .filter(ActionItem.workspace_id == workspace_id)
        .all()
    )

    # Delete existing conflicts for this workspace
    db.query(Conflict).filter(Conflict.workspace_id == workspace_id).delete()
    db.commit()

    if len(items) < 2:
        return []

    # Map file_id to file_name
    files = db.query(File).filter(File.workspace_id == workspace_id).all()
    file_map = {f.id: f.name for f in files}

    conflicts: List[Conflict] = []
    seen_pairs = set()

    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            item_a = items[i]
            item_b = items[j]

            # Only compare items from DIFFERENT files
            if not item_a.file_id or not item_b.file_id or item_a.file_id == item_b.file_id:
                continue

            # Must have matching kind and matching topic/label
            if item_a.kind != item_b.kind:
                continue

            if not labels_match(item_a.label, item_b.label):
                continue

            pair_key = tuple(sorted([item_a.id, item_b.id]))
            if pair_key in seen_pairs:
                continue

            # Check for conflict in dates or values
            has_conflict = False
            explanation = ""

            file_a_name = file_map.get(item_a.file_id, "Document A")
            file_b_name = file_map.get(item_b.file_id, "Document B")

            if item_a.due_date and item_b.due_date:
                # If due dates differ by more than 1 hour
                diff_hours = abs((item_a.due_date - item_b.due_date).total_seconds()) / 3600.0
                if diff_hours > 1.0:
                    has_conflict = True
                    dt_a_str = item_a.due_date.strftime("%d %b %Y, %H:%M")
                    dt_b_str = item_b.due_date.strftime("%d %b %Y, %H:%M")
                    explanation = (
                        f"'{file_a_name}' (Page {item_a.page_or_slide or 1}) specifies deadline as {dt_a_str}, "
                        f"while '{file_b_name}' (Page {item_b.page_or_slide or 1}) specifies {dt_b_str}."
                    )
            elif item_a.kind == "deliverable":
                is_contra, contra_reason = are_deliverables_contradictory(item_a.value, item_b.value)
                if is_contra:
                    has_conflict = True
                    explanation = (
                        f"{contra_reason} '{file_a_name}' (Page {item_a.page_or_slide or 1}) specifies '{item_a.value}', "
                        f"while '{file_b_name}' (Page {item_b.page_or_slide or 1}) specifies '{item_b.value}'."
                    )
            elif item_a.value.strip().lower() != item_b.value.strip().lower():
                # Values differ for other non-deliverable items
                has_conflict = True
                explanation = (
                    f"'{file_a_name}' (Page {item_a.page_or_slide or 1}) specifies '{item_a.value}', "
                    f"while '{file_b_name}' (Page {item_b.page_or_slide or 1}) specifies '{item_b.value}'."
                )

            if has_conflict:
                seen_pairs.add(pair_key)
                conflict_obj = Conflict(
                    id=str(uuid.uuid4()),
                    workspace_id=workspace_id,
                    label=item_a.label,
                    item_a_id=item_a.id,
                    item_b_id=item_b.id,
                    explanation=explanation,
                )
                db.add(conflict_obj)
                conflicts.append(conflict_obj)

    db.commit()
    return conflicts


TIMEZONE_MAP = {
    "est": "America/New_York",
    "edt": "America/New_York",
    "eastern": "America/New_York",
    "cst": "America/Chicago",
    "cdt": "America/Chicago",
    "central": "America/Chicago",
    "mst": "America/Denver",
    "mdt": "America/Denver",
    "mountain": "America/Denver",
    "pst": "America/Los_Angeles",
    "pdt": "America/Los_Angeles",
    "pacific": "America/Los_Angeles",
    "utc": "UTC",
    "gmt": "UTC",
    "ist": "Asia/Kolkata",
    "bst": "Europe/London",
    "cet": "Europe/Paris",
    "cest": "Europe/Paris",
}


def detect_timezone(text: Optional[str]) -> Optional[str]:
    """Detect explicit time zone mentioned in text, returning IANA time zone identifier."""
    if not text:
        return None
    tokens = re.findall(r"\b[A-Za-z]{3,7}\b", text)
    for token in tokens:
        low = token.lower()
        if low in TIMEZONE_MAP:
            return TIMEZONE_MAP[low]
    return None


VTIMEZONE_AMERICA_NEW_YORK = """BEGIN:VTIMEZONE
TZID:America/New_York
X-LIC-LOCATION:America/New_York
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
END:VTIMEZONE"""


def generate_calendar_ics(items: List[ActionItem], db: Session) -> str:
    """Generate RFC 5545 iCalendar content for dated action items with explicit timezone support and deduplication."""
    now_utc = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    file_ids = {it.file_id for it in items if it.file_id}
    files = db.query(File).filter(File.id.in_(file_ids)).all() if file_ids else []
    file_map = {f.id: f.name for f in files}

    events_to_include = []
    used_timezones = set()
    seen_event_keys = set()

    for item in items:
        if not item.due_date:
            continue

        dt_start_str = item.due_date.strftime("%Y%m%dT%H%M%S")
        norm_lbl = normalize_label(item.label)

        # Deduplicate events sharing exact same start time and normalized label
        dedup_key = (dt_start_str, norm_lbl)
        if dedup_key in seen_event_keys:
            continue
        seen_event_keys.add(dedup_key)

        # Detect source timezone from value, quote, or label
        combined_text = f"{item.label} {item.value} {item.quote or ''}"
        tzid = detect_timezone(combined_text)
        if tzid:
            used_timezones.add(tzid)

        events_to_include.append((item, tzid))

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ClearDesk//Action Board Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:ClearDesk Deadlines & Milestones",
    ]

    # Include VTIMEZONE definitions for recognized time zones
    if "America/New_York" in used_timezones:
        lines.append(VTIMEZONE_AMERICA_NEW_YORK)

    for item, tzid in events_to_include:
        dt_start = item.due_date.strftime("%Y%m%dT%H%M%S")
        dt_end = (item.due_date + timedelta(hours=1)).strftime("%Y%m%dT%H%M%S")

        src_file = file_map.get(item.file_id, "Document")
        desc = f"{item.value}\n\nSource: {src_file} (Page {item.page_or_slide or 1})"
        if item.quote:
            desc += f'\nQuote: "{item.quote}"'

        # If timezone was explicitly detected in source, use TZID. Otherwise use floating local time.
        if tzid:
            dtstart_line = f"DTSTART;TZID={tzid}:{dt_start}"
            dtend_line = f"DTEND;TZID={tzid}:{dt_end}"
        else:
            dtstart_line = f"DTSTART:{dt_start}"
            dtend_line = f"DTEND:{dt_end}"

        lines.extend([
            "BEGIN:VEVENT",
            f"UID:{item.id}@cleardesk.ai",
            f"DTSTAMP:{now_utc}",
            dtstart_line,
            dtend_line,
            f"SUMMARY:{item.label}",
            f"DESCRIPTION:{desc}",
            "LOCATION:ClearDesk Workspace",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ])

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def get_action_board(
    workspace_id: str, db: Session, force_rescan: bool = False
) -> ActionsBoardResponse:
    """Get or extract action board items and conflicts for a workspace."""
    # Ensure workspace files are scanned
    ready_files = (
        db.query(File)
        .filter(File.workspace_id == workspace_id, File.status == "ready")
        .all()
    )

    if force_rescan:
        db.query(ActionItem).filter(ActionItem.workspace_id == workspace_id).delete()
        db.query(Conflict).filter(Conflict.workspace_id == workspace_id).delete()
        db.commit()

        for rf in ready_files:
            extract_actions_for_file(rf.id, workspace_id, db)
    else:
        # Scan any ready files that do not yet have extracted items
        for rf in ready_files:
            existing_count = (
                db.query(ActionItem)
                .filter(ActionItem.file_id == rf.id)
                .count()
            )
            if existing_count == 0:
                extract_actions_for_file(rf.id, workspace_id, db)

    # Detect conflicts
    conflicts_list = detect_conflicts(workspace_id, db)

    # Fetch all items
    items = (
        db.query(ActionItem)
        .filter(ActionItem.workspace_id == workspace_id)
        .order_by(ActionItem.due_date.asc().nullslast(), ActionItem.kind.asc())
        .all()
    )

    file_map = {f.id: f.name for f in ready_files}
    item_map = {it.id: it for it in items}

    items_res: List[ActionItemResponse] = []
    deadlines = 0
    deliverables = 0
    missing_info = 0

    for it in items:
        if it.kind == "deadline":
            deadlines += 1
        elif it.kind == "deliverable":
            deliverables += 1
        elif it.kind == "missing_info":
            missing_info += 1

        items_res.append(
            ActionItemResponse(
                id=it.id,
                workspace_id=it.workspace_id,
                file_id=it.file_id,
                file_name=file_map.get(it.file_id),
                kind=it.kind,
                label=it.label,
                value=it.value,
                due_date=it.due_date,
                owner=it.owner,
                page_or_slide=it.page_or_slide,
                quote=it.quote,
            )
        )

    conflicts_res: List[ConflictResponse] = []
    for c in conflicts_list:
        it_a = item_map.get(c.item_a_id)
        it_b = item_map.get(c.item_b_id)
        conflicts_res.append(
            ConflictResponse(
                id=c.id,
                workspace_id=c.workspace_id,
                label=c.label,
                item_a_id=c.item_a_id,
                item_b_id=c.item_b_id,
                file_a_name=file_map.get(it_a.file_id) if it_a else None,
                file_b_name=file_map.get(it_b.file_id) if it_b else None,
                value_a=it_a.value if it_a else None,
                value_b=it_b.value if it_b else None,
                explanation=c.explanation,
            )
        )

    summary = ActionsSummary(
        total_items=len(items_res),
        deadlines_count=deadlines,
        deliverables_count=deliverables,
        missing_info_count=missing_info,
        conflicts_count=len(conflicts_res),
    )

    return ActionsBoardResponse(
        workspace_id=workspace_id,
        items=items_res,
        conflicts=conflicts_res,
        summary=summary,
    )
