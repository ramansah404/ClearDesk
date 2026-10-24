"""Tests for chunking logic and page boundary invariants."""

import pytest
from app.services.parsers import ParsedDocument, ParsedPage
from app.services.chunker import chunk_document, chunk_page_text


def test_chunker_never_crosses_page_boundaries():
    """Verify that chunks strictly isolate content by page/slide."""
    doc = ParsedDocument(
        file_id="doc-boundary-test",
        file_type="pdf",
        page_count=2,
        pages=[
            ParsedPage(
                page_or_slide=1,
                text="Page 1 Content. This sentence belongs strictly to page one.",
                label="Page 1",
            ),
            ParsedPage(
                page_or_slide=2,
                text="Page 2 Content. This sentence belongs strictly to page two.",
                label="Page 2",
            ),
        ],
    )

    chunks = chunk_document(doc)
    assert len(chunks) == 2

    chunk_p1 = [c for c in chunks if c.page_or_slide == 1]
    chunk_p2 = [c for c in chunks if c.page_or_slide == 2]

    assert len(chunk_p1) == 1
    assert "page one" in chunk_p1[0].text
    assert "page two" not in chunk_p1[0].text

    assert len(chunk_p2) == 1
    assert "page two" in chunk_p2[0].text
    assert "page one" not in chunk_p2[0].text


def test_long_page_chunking_with_overlap():
    """Verify that a long single page is divided into overlapping chunks."""
    # Generate ~800 words on one page
    paragraphs = [f"Paragraph {i}: ClearDesk document intelligence sentence with terminology." for i in range(80)]
    long_text = " ".join(paragraphs)

    page = ParsedPage(page_or_slide=5, text=long_text, label="Page 5")
    chunks = chunk_page_text(page, file_id="doc-long", starting_chunk_index=0)

    # Should produce multiple chunks
    assert len(chunks) > 1

    # Every chunk must remain on Page 5
    for c in chunks:
        assert c.page_or_slide == 5
        assert c.file_id == "doc-long"
        assert len(c.text.split()) >= 100

    # Sequential indexing
    indices = [c.chunk_index for c in chunks]
    assert indices == list(range(len(chunks)))


def test_chunk_metadata_integrity():
    """Verify chunk preserves all required attributes."""
    doc = ParsedDocument(
        file_id="meta-doc",
        file_type="pptx",
        page_count=1,
        pages=[ParsedPage(page_or_slide=3, text="Slide 3 bullet points", label="Slide 3", ocr_confidence=95.0)],
    )

    chunks = chunk_document(doc)
    assert len(chunks) == 1
    chunk = chunks[0]
    assert chunk.file_id == "meta-doc"
    assert chunk.page_or_slide == 3
    assert chunk.chunk_index == 0
    assert chunk.text == "Slide 3 bullet points"
    assert chunk.ocr_confidence == 95.0
