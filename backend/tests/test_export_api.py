"""Tests for Export API router and Revision Sheet generation (ReportLab).

Validates:
1. Successful generation of single-page A4 PDF revision sheets.
2. Exact page count guarantee (must be exactly 1 page).
3. A4 dimensions (595.28 x 841.89 points).
4. Content presence (title, priority badges, 3-level notes).
5. Strict workspace isolation.
6. Error handling for missing or unready documents.
7. Query parameter workspace authentication for browser downloads.
"""

import io
import uuid
import pytest
import pymupdf  # PyMuPDF / fitz
from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal, init_db
from app.models import File, Note, Topic, Workspace


client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    """Ensure database schema is initialized and clean up test workspaces."""
    init_db()
    db = SessionLocal()
    # Clean up test workspaces if they exist from prior runs
    for ws_id in ["ws-export-test", "ws-processing-test"]:
        db.query(Note).filter(Note.file_id.like(f"%{ws_id}%")).delete(synchronize_session=False)
        db.query(Topic).filter(Topic.workspace_id == ws_id).delete(synchronize_session=False)
        db.query(File).filter(File.workspace_id == ws_id).delete(synchronize_session=False)
        db.query(Workspace).filter(Workspace.id == ws_id).delete(synchronize_session=False)
    db.commit()
    db.close()


@pytest.fixture
def export_test_data():
    """Seed test workspace, file, notes, and topics for export testing."""
    db = SessionLocal()
    ws_id = f"ws-exp-{uuid.uuid4().hex[:8]}"
    ws = Workspace(id=ws_id)
    db.add(ws)

    # Ready document
    file_id = f"file-{uuid.uuid4().hex[:8]}"
    file_record = File(
        id=file_id,
        workspace_id=ws_id,
        name="Operating_Systems_Syllabus.pdf",
        type="pdf",
        file_size=10240,
        page_count=4,
        status="ready",
        role="syllabus",
    )
    db.add(file_record)

    # 3-level notes
    note1 = Note(
        id=f"note-{uuid.uuid4().hex[:8]}",
        file_id=file_id,
        section_title="Process Synchronization & Deadlocks",
        level1_keywords=["Mutual Exclusion", "Semaphores", "Dining Philosophers", "Deadlock"],
        level2_meaning="Techniques to prevent concurrent access to shared resources causing inconsistent state.",
        level3_explanation="Dijkstra semaphores provide wait() and signal() operations. Deadlock conditions require mutual exclusion, hold-and-wait, no preemption, and circular wait.",
        source_pages=[1, 2],
        translations={},
    )
    note2 = Note(
        id=f"note-{uuid.uuid4().hex[:8]}",
        file_id=file_id,
        section_title="Virtual Memory Management",
        level1_keywords=["Paging", "Segmentation", "Page Replacement", "Thrashing"],
        level2_meaning="Hardware and software memory virtualization allowing execution of processes not completely in physical memory.",
        level3_explanation="Demand paging uses page tables with valid-invalid bits. LRU and FIFO algorithms minimize page fault rate. Thrashing occurs when page fault servicing dominates CPU execution.",
        source_pages=[3, 4],
        translations={},
    )
    db.add(note1)
    db.add(note2)

    # Topics for color-coded badges
    topic1 = Topic(
        id=f"top-{uuid.uuid4().hex[:8]}",
        workspace_id=ws_id,
        name="Process Synchronization",
        priority_score=75.0,
        past_paper_frequency=4,
        mastery=0.2,
    )
    topic2 = Topic(
        id=f"top-{uuid.uuid4().hex[:8]}",
        workspace_id=ws_id,
        name="Virtual Memory",
        priority_score=45.0,
        past_paper_frequency=2,
        mastery=0.5,
    )
    db.add(topic1)
    db.add(topic2)

    db.commit()
    db.close()
    return {"workspace_id": ws_id, "file_id": file_id}


def test_export_revision_sheet_success_single_page_a4(export_test_data):
    """Test generating revision sheet PDF returns valid single-page A4 document."""
    ws_id = export_test_data["workspace_id"]
    file_id = export_test_data["file_id"]

    response = client.get(
        f"/export/revision-sheet.pdf?file_id={file_id}",
        headers={"X-Workspace-Id": ws_id},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert f"revision_sheet_{file_id[:8]}.pdf" in response.headers["content-disposition"]

    # Verify PDF structure using PyMuPDF
    pdf_doc = pymupdf.open(stream=response.content, filetype="pdf")

    # CRITICAL: Must be EXACTLY 1 page
    assert len(pdf_doc) == 1, f"Expected exactly 1 page, got {len(pdf_doc)}"

    page = pdf_doc[0]
    rect = page.rect
    # Standard A4 is 595.28 x 841.89 points
    assert abs(rect.width - 595.28) < 1.0, f"Expected A4 width ~595pt, got {rect.width}"
    assert abs(rect.height - 841.89) < 1.0, f"Expected A4 height ~842pt, got {rect.height}"

    page_text = page.get_text()

    # Content checks:
    # 1. Title and header metadata
    assert "ClearDesk Revision Sheet" in page_text
    assert "Operating_Systems_Syllabus" in page_text
    assert "FORMAT: PDF" in page_text.upper()
    assert "PAGES: 4" in page_text.upper()

    # 2. Topic priorities
    assert "TOPIC PRIORITIES:" in page_text
    assert "HIGH: Process Sync" in page_text or "Process Synchronization" in page_text

    # 3. 3-Level notes
    assert "LEVEL 1: KEY TERMS" in page_text
    assert "Mutual Exclusion" in page_text
    assert "LEVEL 2: MEANING" in page_text
    assert "Techniques to prevent concurrent access" in page_text
    assert "LEVEL 3: PRINCIPLES" in page_text

    # 4. Footer
    assert "Page 1 of 1" in page_text
    assert "Strict Evidence Bound" in page_text


def test_export_revision_sheet_browser_query_param_auth(export_test_data):
    """Test downloading revision sheet using workspace_id query parameter (for direct <a> links)."""
    ws_id = export_test_data["workspace_id"]
    file_id = export_test_data["file_id"]

    # Simulates direct browser anchor click without X-Workspace-Id header
    response = client.get(
        f"/export/revision-sheet.pdf?file_id={file_id}&workspace_id={ws_id}"
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

    pdf_doc = pymupdf.open(stream=response.content, filetype="pdf")
    assert len(pdf_doc) == 1


def test_export_revision_sheet_workspace_isolation(export_test_data):
    """Test workspace isolation: an unauthorized workspace cannot export another's files."""
    file_id = export_test_data["file_id"]

    # Attempt export from completely different workspace
    response = client.get(
        f"/export/revision-sheet.pdf?file_id={file_id}",
        headers={"X-Workspace-Id": "ws-intruder-999"},
    )

    assert response.status_code == 404
    err = response.json()
    msg = err.get("message") or err.get("detail") or ""
    assert "not found in current workspace" in msg.lower()


def test_export_revision_sheet_missing_file():
    """Test exporting a non-existent file returns 404."""
    response = client.get(
        "/export/revision-sheet.pdf?file_id=non-existent-file-id",
        headers={"X-Workspace-Id": "ws-some-ws"},
    )
    assert response.status_code == 404


def test_export_revision_sheet_unready_file():
    """Test exporting a file that is still processing returns 400 Bad Request."""
    db = SessionLocal()
    ws_id = f"ws-unready-{uuid.uuid4().hex[:8]}"
    file_id = f"file-unready-{uuid.uuid4().hex[:8]}"
    ws = Workspace(id=ws_id)
    db.add(ws)

    unready_file = File(
        id=file_id,
        workspace_id=ws_id,
        name="Still_Processing.pdf",
        type="pdf",
        file_size=5000,
        page_count=2,
        status="processing",
    )
    db.add(unready_file)
    db.commit()
    db.close()

    response = client.get(
        f"/export/revision-sheet.pdf?file_id={file_id}",
        headers={"X-Workspace-Id": ws_id},
    )
    assert response.status_code == 400
    err = response.json()
    msg = err.get("message") or err.get("detail") or ""
    assert "still processing or failed" in msg.lower()
