"""3-Level Keyword Notes & Multilingual Translation Service for ClearDesk.

Implements Phase 3 requirements:
1. Generates 3-level structured notes (Keywords, One-line meaning, Full explanation)
   grounded strictly in uploaded document chunks.
2. Supports Mother-Tongue mode (Hindi & Telugu) with technical terms preserved in English script.
3. Automatically caches generated notes and translations in SQLite for instantaneous retrieval.
4. Strictly respects workspace isolation.
"""

import os
import uuid
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from google import genai
from google.genai.errors import APIError

from app.config import settings
from app.models import File, Chunk, Note
from app.schemas import NoteSection, NotesResponse


class ExtractedSection(BaseModel):
    """Pydantic schema for an extracted note section."""

    section_title: str = Field(..., description="Concept or section title")
    level1_keywords: List[str] = Field(..., description="5-10 essential keywords from text")
    level2_meaning: str = Field(..., description="One-line summary sentence")
    level3_explanation: str = Field(..., description="Full simple explanation")
    source_pages: List[int] = Field(default_factory=list, description="Source page numbers")


class NotesPayload(BaseModel):
    """Pydantic schema for Gemini structured notes generation output."""

    sections: List[ExtractedSection] = Field(default_factory=list)


class TranslationPayload(BaseModel):
    """Pydantic schema for Gemini multilingual translation output."""

    section_title: str = Field(..., description="Translated title with English technical terms")
    level2_meaning: str = Field(..., description="Translated one-line meaning with English technical terms")
    level3_explanation: str = Field(..., description="Translated full explanation with English technical terms")


LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
}


def _load_prompt(filename: str, default_text: str) -> str:
    """Load prompt template from backend/app/prompts/ directory."""
    path = os.path.join(os.path.dirname(__file__), "..", "prompts", filename)
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            pass
    return default_text


def translate_section(
    section_title: str,
    level2_meaning: str,
    level3_explanation: str,
    target_lang: str,
) -> Dict[str, str]:
    """Translate note section into target language while preserving technical terms in English."""
    normalized_lang = target_lang.lower().strip()
    if normalized_lang not in ("hi", "te"):
        return {
            "section_title": section_title,
            "level2_meaning": level2_meaning,
            "level3_explanation": level3_explanation,
        }

    lang_name = LANGUAGE_NAMES.get(normalized_lang, "Hindi")
    prompt_template = _load_prompt(
        "translate_notes.txt",
        "Translate academic notes to {target_language_name} ({language_code}), keeping technical terms in English.",
    )

    prompt = prompt_template.format(
        target_language_name=lang_name,
        language_code=normalized_lang,
        section_title=section_title,
        level2_meaning=level2_meaning,
        level3_explanation=level3_explanation,
    )

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing from environment.")

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": TranslationPayload,
                "temperature": 0.1,
            },
        )
        parsed = TranslationPayload.model_validate_json(response.text)
        return {
            "section_title": parsed.section_title.strip(),
            "level2_meaning": parsed.level2_meaning.strip(),
            "level3_explanation": parsed.level3_explanation.strip(),
        }
    except Exception as exc:
        # Fallback gracefully to original English if translation call fails
        return {
            "section_title": section_title,
            "level2_meaning": level2_meaning,
            "level3_explanation": level3_explanation,
        }


def generate_notes_from_chunks(
    file_id: str,
    file_name: str,
    chunks: List[Chunk],
    db: Session,
) -> List[Note]:
    """Generate 3-level structured notes from document chunks and save in SQLite."""
    if not chunks:
        return []

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY is missing from environment.")

    # Format chunks with page numbers
    pages_set = set()
    formatted_content_parts = []
    for c in chunks:
        pages_set.add(c.page_or_slide)
        formatted_content_parts.append(
            f"[Page/Slide {c.page_or_slide}]\n" + c.text + "\n"
        )

    full_content = "\n".join(formatted_content_parts)
    pages_list = sorted(list(pages_set))
    pages_str = ", ".join(str(p) for p in pages_list)

    prompt_template = _load_prompt(
        "notes_section.txt",
        "Extract 3-level structured notes from {file_name} on pages {page_numbers}:\n{content}",
    )

    prompt = prompt_template.format(
        file_name=file_name,
        page_numbers=pages_str,
        content=full_content,
    )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": NotesPayload,
                "temperature": 0.1,
            },
        )
    except APIError as api_err:
        raise RuntimeError(f"Gemini API error ({settings.llm_model}): {api_err.message}") from api_err
    except Exception as exc:
        raise RuntimeError(f"Failed to generate notes ({settings.llm_model}): {exc}") from exc

    if not response or not response.text:
        return []

    try:
        payload = NotesPayload.model_validate_json(response.text)
    except Exception:
        return []

    # Clean previous notes for this file
    db.query(Note).filter(Note.file_id == file_id).delete()

    saved_notes = []
    for sec in payload.sections:
        # Fallback source pages if empty
        spages = sec.source_pages if sec.source_pages else pages_list[:1]

        # Ensure level1_keywords has valid items
        clean_keywords = [k.strip() for k in sec.level1_keywords if k.strip()]
        if not clean_keywords:
            clean_keywords = ["Key Concept"]

        note_record = Note(
            id=str(uuid.uuid4()),
            file_id=file_id,
            section_title=sec.section_title.strip() or "Core Concept",
            level1_keywords=clean_keywords,
            level2_meaning=sec.level2_meaning.strip(),
            level3_explanation=sec.level3_explanation.strip(),
            translations={},
            source_pages=spages,
        )
        db.add(note_record)
        saved_notes.append(note_record)

    db.commit()
    for n in saved_notes:
        db.refresh(n)

    return saved_notes


def get_or_generate_notes(
    file_id: str,
    workspace_id: str,
    language: str = "en",
    force_regenerate: bool = False,
    db: Session = None,
) -> NotesResponse:
    """Retrieve existing notes or generate fresh notes with optional translation."""
    if not db:
        raise ValueError("Database session is required.")

    # 1. Enforce strict workspace isolation
    file_record = (
        db.query(File)
        .filter(File.id == file_id, File.workspace_id == workspace_id)
        .first()
    )
    if not file_record:
        raise ValueError(f"File '{file_id}' not found in current workspace.")

    if file_record.status != "ready":
        raise ValueError(f"File '{file_record.name}' is not ready (status: {file_record.status}).")

    normalized_lang = (language or "en").lower().strip()
    if normalized_lang not in ("en", "hi", "te"):
        raise ValueError(f"Unsupported language '{language}'. Supported languages: 'en', 'hi', 'te'.")

    # 2. Check for existing cached notes
    existing_notes = (
        db.query(Note)
        .filter(Note.file_id == file_id)
        .all()
    )

    is_cached = True

    if not existing_notes or force_regenerate:
        is_cached = False
        chunks = (
            db.query(Chunk)
            .filter(Chunk.file_id == file_id)
            .order_by(Chunk.page_or_slide.asc(), Chunk.chunk_index.asc())
            .all()
        )
        existing_notes = generate_notes_from_chunks(
            file_id=file_id,
            file_name=file_record.name,
            chunks=chunks,
            db=db,
        )

    # 3. Format sections and apply translation if requested
    sections_out: List[NoteSection] = []

    for n in existing_notes:
        sec_title = n.section_title
        sec_meaning = n.level2_meaning
        sec_explanation = n.level3_explanation

        if normalized_lang in ("hi", "te"):
            curr_trans = n.translations or {}
            if normalized_lang in curr_trans:
                # Use cached translation
                t = curr_trans[normalized_lang]
                sec_title = t.get("section_title", sec_title)
                sec_meaning = t.get("level2_meaning", sec_meaning)
                sec_explanation = t.get("level3_explanation", sec_explanation)
            else:
                # Generate and cache translation
                is_cached = False
                t = translate_section(
                    section_title=n.section_title,
                    level2_meaning=n.level2_meaning,
                    level3_explanation=n.level3_explanation,
                    target_lang=normalized_lang,
                )
                curr_trans = dict(n.translations) if n.translations else {}
                curr_trans[normalized_lang] = t
                n.translations = curr_trans
                flag_modified(n, "translations")
                db.add(n)
                db.commit()

                sec_title = t["section_title"]
                sec_meaning = t["level2_meaning"]
                sec_explanation = t["level3_explanation"]

        sections_out.append(
            NoteSection(
                id=n.id,
                file_id=n.file_id,
                section_title=sec_title,
                level1_keywords=n.level1_keywords,
                level2_meaning=sec_meaning,
                level3_explanation=sec_explanation,
                source_pages=n.source_pages,
                language=normalized_lang,
            )
        )

    return NotesResponse(
        file_id=file_id,
        file_name=file_record.name,
        language=normalized_lang,
        sections=sections_out,
        cached=is_cached,
    )
