"""Document chunking service with strict page/slide boundary preservation.

Adheres strictly to PROJECT_SPEC.md Section 9.1:
- 300 to 500 tokens (~220 to 380 words) per chunk with ~50 token overlap.
- Never combine content from different pages or slides into one chunk.
- Every chunk preserves file_id, page_or_slide, chunk_index, and text.
"""

import re
import uuid
from dataclasses import dataclass
from typing import List, Optional

from app.services.parsers import ParsedDocument, ParsedPage


@dataclass
class DocumentChunk:
    """Searchable chunk indexed in both SQLite and ChromaDB."""

    id: str
    file_id: str
    page_or_slide: int
    chunk_index: int
    text: str
    ocr_confidence: Optional[float] = None


def split_text_into_sentences(text: str) -> List[str]:
    """Split text into sentences while preserving sentence punctuation."""
    # Split on periods, exclamation marks, or question marks followed by space or newline
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return [s.strip() for s in sentences if s.strip()]


def chunk_page_text(
    page: ParsedPage,
    file_id: str,
    starting_chunk_index: int,
    target_words: int = 250,  # ~330 tokens
    max_words: int = 380,     # ~500 tokens
    overlap_words: int = 40,  # ~50 tokens
) -> List[DocumentChunk]:
    """Chunk a single page into overlapping segments.

    Never crosses the page boundary.
    """
    text = page.text.strip()
    if not text:
        return []

    words = text.split()
    # If the entire page is short enough, return as a single chunk
    if len(words) <= max_words:
        return [
            DocumentChunk(
                id=str(uuid.uuid4()),
                file_id=file_id,
                page_or_slide=page.page_or_slide,
                chunk_index=starting_chunk_index,
                text=text,
                ocr_confidence=page.ocr_confidence,
            )
        ]

    # Multiple chunks needed within this single page
    sentences = split_text_into_sentences(text)
    chunks: List[DocumentChunk] = []
    current_sentences: List[str] = []
    current_word_count = 0
    chunk_idx = starting_chunk_index

    for sentence in sentences:
        s_words = len(sentence.split())
        if current_word_count + s_words > max_words and current_sentences:
            # Emit current chunk
            chunk_content = " ".join(current_sentences).strip()
            chunks.append(
                DocumentChunk(
                    id=str(uuid.uuid4()),
                    file_id=file_id,
                    page_or_slide=page.page_or_slide,
                    chunk_index=chunk_idx,
                    text=chunk_content,
                    ocr_confidence=page.ocr_confidence,
                )
            )
            chunk_idx += 1

            # Prepare overlap for next chunk from the end of current sentences
            overlap_sentences: List[str] = []
            overlap_count = 0
            for prev_s in reversed(current_sentences):
                prev_len = len(prev_s.split())
                if overlap_count + prev_len <= overlap_words:
                    overlap_sentences.insert(0, prev_s)
                    overlap_count += prev_len
                else:
                    break

            current_sentences = overlap_sentences + [sentence]
            current_word_count = overlap_count + s_words
        else:
            current_sentences.append(sentence)
            current_word_count += s_words

    if current_sentences:
        chunk_content = " ".join(current_sentences).strip()
        chunks.append(
            DocumentChunk(
                id=str(uuid.uuid4()),
                file_id=file_id,
                page_or_slide=page.page_or_slide,
                chunk_index=chunk_idx,
                text=chunk_content,
                ocr_confidence=page.ocr_confidence,
            )
        )

    return chunks


def chunk_document(parsed_doc: ParsedDocument) -> List[DocumentChunk]:
    """Chunk all pages of a parsed document.

    Strict boundary: Content from distinct pages/slides is never mixed.
    """
    all_chunks: List[DocumentChunk] = []
    current_index = 0

    for page in parsed_doc.pages:
        page_chunks = chunk_page_text(
            page=page,
            file_id=parsed_doc.file_id,
            starting_chunk_index=current_index,
        )
        all_chunks.extend(page_chunks)
        current_index += len(page_chunks)

    return all_chunks
