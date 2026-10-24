"""API integration tests for document upload, listing, isolation, and failure handling."""

import io
import os
import tempfile
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
import pymupdf
from pptx import Presentation
from docx import Document
from PIL import Image

from app.main import app
from app.config import settings
from app.db import Base, engine, SessionLocal
from app.models import File, Chunk, Workspace
from app.services.pipeline import process_file_pipeline


@pytest.fixture
def isolated_env():
    """Configure temporary isolated storage, chroma, and clean database tables."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_storage, tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_chroma:

        orig_storage = settings.storage_dir
        orig_chroma = settings.chroma_dir

        settings.storage_dir = temp_storage
        settings.chroma_dir = temp_chroma

        # Clean tables
        from app.db import init_db
        init_db()
        db = SessionLocal()
        db.query(Chunk).delete()
        db.query(File).delete()
        db.query(Workspace).delete()
        db.commit()
        db.close()


        yield temp_storage, temp_chroma

        settings.storage_dir = orig_storage
        settings.chroma_dir = orig_chroma


@pytest.fixture
def client(isolated_env):
    """TestClient fixture with isolated environment."""
    with TestClient(app) as test_client:
        yield test_client


def make_sample_pdf_bytes():
    """Generate in-memory PDF with 2 pages."""
    doc = pymupdf.open()
    p1 = doc.new_page()
    p1.insert_text((50, 50), "PDF Slide/Page 1 Content")
    p2 = doc.new_page()
    p2.insert_text((50, 50), "PDF Slide/Page 2 Content")
    stream = doc.tobytes()
    doc.close()
    return stream


def make_sample_pptx_bytes():
    """Generate in-memory PPTX with 1 slide."""
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    txBox = slide.shapes.add_textbox(0, 0, 100, 100)
    txBox.text_frame.text = "PPTX Slide 1 Content"
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def make_sample_docx_bytes():
    """Generate in-memory DOCX with sections."""
    doc = Document()
    doc.add_heading("Section 1", level=1)
    doc.add_paragraph("DOCX Section 1 text.")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def make_sample_image_bytes():
    """Generate in-memory PNG image."""
    img = Image.new("RGB", (100, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_upload_supported_formats(client):
    """Verify uploading PDF, PPTX, and DOCX returns 200 with processing status."""
    pdf_bytes = make_sample_pdf_bytes()
    pptx_bytes = make_sample_pptx_bytes()
    docx_bytes = make_sample_docx_bytes()

    files = [
        ("files", ("lecture.pdf", pdf_bytes, "application/pdf")),
        ("files", ("slides.pptx", pptx_bytes, "application/vnd.openxmlformats-officedocument.presentationml.presentation")),
        ("files", ("notes.docx", docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    ]

    response = client.post(
        "/files",
        files=files,
        data={"role": "material"},
        headers={"X-Workspace-Id": "ws-upload-test"},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    for f in data:
        assert f["status"] == "processing"
        assert f["workspace_id"] == "ws-upload-test"
        assert f["file_size"] > 0


def test_upload_unsupported_format_rejected(client):
    """Verify uploading unsupported file type returns 400 error."""
    response = client.post(
        "/files",
        files=[("files", ("script.exe", b"binary_content", "application/octet-stream"))],
        headers={"X-Workspace-Id": "ws-test"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"] is True
    assert "Unsupported file format" in data["message"]


def test_workspace_isolation(client):
    """Verify documents uploaded in Workspace A cannot be viewed or listed by Workspace B."""
    pdf_bytes = make_sample_pdf_bytes()

    # Upload in Workspace A
    res_a = client.post(
        "/files",
        files=[("files", ("secret_a.pdf", pdf_bytes, "application/pdf"))],
        headers={"X-Workspace-Id": "ws-alpha"},
    )
    assert res_a.status_code == 200
    file_a_id = res_a.json()[0]["id"]

    # Workspace A lists files
    list_a = client.get("/files", headers={"X-Workspace-Id": "ws-alpha"})
    assert list_a.status_code == 200
    assert len(list_a.json()) == 1
    assert list_a.json()[0]["id"] == file_a_id

    # Workspace B lists files -> must be isolated and empty
    list_b = client.get("/files", headers={"X-Workspace-Id": "ws-beta"})
    assert list_b.status_code == 200
    assert len(list_b.json()) == 0

    # Workspace B attempts to access Workspace A's file PDF -> must return 404
    pdf_b = client.get(f"/files/{file_a_id}/pdf", headers={"X-Workspace-Id": "ws-beta"})
    assert pdf_b.status_code == 404


def test_pipeline_success_with_mocked_embeddings(isolated_env):
    """Verify pipeline parses, chunks, embeds, and updates status to ready."""
    temp_storage, _ = isolated_env
    pdf_bytes = make_sample_pdf_bytes()
    file_id = "test-success-id"
    ws_id = "test-ws-pipeline"

    ws_dir = os.path.join(temp_storage, ws_id)
    os.makedirs(ws_dir, exist_ok=True)
    file_path = os.path.join(ws_dir, f"{file_id}_sample.pdf")
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    db = SessionLocal()
    ws = Workspace(id=ws_id)
    db.add(ws)
    file_rec = File(
        id=file_id,
        workspace_id=ws_id,
        name="sample.pdf",
        type="pdf",
        role="material",
        status="processing",
    )
    db.add(file_rec)
    db.commit()
    db.close()

    # Mock embeddings to avoid requiring live Gemini API key in unit tests
    dummy_vector = [0.1] * 768
    with patch("app.services.embeddings.generate_embeddings", return_value=[dummy_vector, dummy_vector]):
        process_file_pipeline(
            file_id=file_id,
            file_path=file_path,
            file_type="pdf",
            workspace_id=ws_id,
        )

    # Verify database state
    db = SessionLocal()
    file_after = db.query(File).filter_by(id=file_id).first()
    assert file_after.status == "ready"
    assert file_after.page_count == 2
    assert file_after.error_message is None

    chunks = db.query(Chunk).filter_by(file_id=file_id).order_by(Chunk.chunk_index).all()
    assert len(chunks) == 2
    assert chunks[0].page_or_slide == 1
    assert chunks[1].page_or_slide == 2
    db.close()


def test_pipeline_failure_when_gemini_key_missing(isolated_env):
    """Verify that when Gemini API key is missing, file is NOT marked ready and error is recorded."""
    temp_storage, _ = isolated_env
    pdf_bytes = make_sample_pdf_bytes()
    file_id = "test-fail-id"
    ws_id = "test-ws-fail"

    ws_dir = os.path.join(temp_storage, ws_id)
    os.makedirs(ws_dir, exist_ok=True)
    file_path = os.path.join(ws_dir, f"{file_id}_sample.pdf")
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    db = SessionLocal()
    db.add(Workspace(id=ws_id))
    db.add(File(id=file_id, workspace_id=ws_id, name="sample.pdf", type="pdf", role="material", status="processing"))
    db.commit()
    db.close()

    # Explicitly empty Gemini API key
    orig_key = settings.gemini_api_key
    settings.gemini_api_key = ""
    try:
        process_file_pipeline(
            file_id=file_id,
            file_path=file_path,
            file_type="pdf",
            workspace_id=ws_id,
        )
    finally:
        settings.gemini_api_key = orig_key

    db = SessionLocal()
    file_after = db.query(File).filter_by(id=file_id).first()
    assert file_after.status == "failed"
    assert "GEMINI_API_KEY is missing" in file_after.error_message
    chunks = db.query(Chunk).filter_by(file_id=file_id).all()
    assert len(chunks) == 0  # No partial chunks left behind
    db.close()


def test_delete_file_and_workspace(client):
    """Verify deleting file and deleting workspace cleans up SQLite and files."""
    pdf_bytes = make_sample_pdf_bytes()
    res = client.post(
        "/files",
        files=[("files", ("to_delete.pdf", pdf_bytes, "application/pdf"))],
        headers={"X-Workspace-Id": "ws-del"},
    )
    assert res.status_code == 200
    file_id = res.json()[0]["id"]

    # Delete single file
    del_res = client.delete(f"/files/{file_id}", headers={"X-Workspace-Id": "ws-del"})
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # Check list is empty
    list_res = client.get("/files", headers={"X-Workspace-Id": "ws-del"})
    assert len(list_res.json()) == 0

    # Delete workspace
    del_ws = client.delete("/workspace", headers={"X-Workspace-Id": "ws-del"})
    assert del_ws.status_code == 200
    assert del_ws.json()["success"] is True
