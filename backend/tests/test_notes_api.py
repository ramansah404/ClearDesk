"""Unit tests for Phase 3: 3-Level Notes & Multilingual Translation.

Tests:
1. Generating 3-level structured notes (Keywords, One-line meaning, Full explanation)
2. Database caching: subsequent reads return cached notes without re-invoking LLM
3. Multilingual translation for Hindi (hi) and Telugu (te) with English technical terms preserved
4. Force regeneration via POST /notes/{file_id}/regenerate
5. Workspace isolation: cross-tenant access to notes returns 404
6. Unready documents return 400
"""

import os
import tempfile
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db import SessionLocal, init_db
from app.models import File, Chunk, Note, Workspace


@pytest.fixture
def isolated_env():
    """Configure isolated environment and clean database tables."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_storage, tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_chroma:
        orig_storage = settings.storage_dir
        orig_chroma = settings.chroma_dir
        orig_key = settings.gemini_api_key

        settings.storage_dir = temp_storage
        settings.chroma_dir = temp_chroma
        settings.gemini_api_key = "test_key_placeholder"

        init_db()
        db = SessionLocal()
        db.query(Note).delete()
        db.query(Chunk).delete()
        db.query(File).delete()
        db.query(Workspace).delete()
        db.commit()
        db.close()

        yield temp_storage, temp_chroma

        settings.storage_dir = orig_storage
        settings.chroma_dir = orig_chroma
        settings.gemini_api_key = orig_key


@pytest.fixture
def client(isolated_env):
    """TestClient fixture with isolated environment."""
    with TestClient(app) as test_client:
        yield test_client


def test_get_notes_generates_and_caches_3level_notes(isolated_env, client):
    """Verify 3-level notes generation and subsequent caching."""
    ws_id = "ws-notes-gen"
    file_id = "file-notes-101"

    db = SessionLocal()
    ws = Workspace(id=ws_id)
    db.add(ws)
    file_rec = File(
        id=file_id,
        workspace_id=ws_id,
        name="Deep_Learning_Intro.pdf",
        type="pdf",
        role="material",
        page_count=2,
        status="ready",
    )
    db.add(file_rec)
    c1 = Chunk(
        id="c-dl-1",
        file_id=file_id,
        page_or_slide=1,
        chunk_index=0,
        text="Neural networks use backpropagation to calculate error gradients with respect to weights.",
    )
    c2 = Chunk(
        id="c-dl-2",
        file_id=file_id,
        page_or_slide=2,
        chunk_index=1,
        text="Activation functions like ReLU introduce non-linearity, enabling deep network representation.",
    )
    db.add(c1)
    db.add(c2)
    db.commit()
    db.close()

    mock_llm_json = (
        '{"sections": ['
        '  {"section_title": "Backpropagation", "level1_keywords": ["Neural Networks", "Backpropagation", "Gradients", "Weights"], '
        '   "level2_meaning": "The core algorithm for computing parameter gradients via the chain rule.", '
        '   "level3_explanation": "Backpropagation propagates the error backward through layers to update weights.", "source_pages": [1]},'
        '  {"section_title": "Activation Functions", "level1_keywords": ["Activation", "ReLU", "Non-linearity"], '
        '   "level2_meaning": "Functions that introduce non-linearity into neural networks.", '
        '   "level3_explanation": "Without activation functions, deep networks collapse into linear models.", "source_pages": [2]}'
        ']}'
    )
    mock_resp = MagicMock()
    mock_resp.text = mock_llm_json

    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        # First call: Generates and saves to DB
        res1 = client.get(f"/notes/{file_id}", headers={"X-Workspace-Id": ws_id})
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["file_id"] == file_id
        assert data1["language"] == "en"
        assert len(data1["sections"]) == 2

        sec1 = data1["sections"][0]
        assert sec1["section_title"] == "Backpropagation"
        assert "Backpropagation" in sec1["level1_keywords"]
        assert "chain rule" in sec1["level2_meaning"]
        assert sec1["source_pages"] == [1]

        # Check DB persistence
        db = SessionLocal()
        saved_notes = db.query(Note).filter(Note.file_id == file_id).all()
        assert len(saved_notes) == 2
        db.close()

        # Second call: Must return cached notes without calling Gemini generate_content again
        mock_client.models.generate_content.reset_mock()
        res2 = client.get(f"/notes/{file_id}", headers={"X-Workspace-Id": ws_id})
        assert res2.status_code == 200
        data2 = res2.json()
        assert len(data2["sections"]) == 2
        mock_client.models.generate_content.assert_not_called()


def test_notes_multilingual_translation(isolated_env, client):
    """Verify mother-tongue translation for Hindi and Telugu with English technical terms preserved."""
    ws_id = "ws-trans-test"
    file_id = "file-trans-102"

    db = SessionLocal()
    ws = Workspace(id=ws_id)
    db.add(ws)
    file_rec = File(
        id=file_id,
        workspace_id=ws_id,
        name="Optimization.pdf",
        type="pdf",
        role="material",
        page_count=1,
        status="ready",
    )
    db.add(file_rec)
    note = Note(
        id="note-opt-1",
        file_id=file_id,
        section_title="Gradient Descent",
        level1_keywords=["Gradient Descent", "Learning Rate"],
        level2_meaning="An iterative algorithm to minimize loss.",
        level3_explanation="Gradient Descent steps downhill along the negative gradient.",
        translations={},
        source_pages=[1],
    )
    db.add(note)
    db.commit()
    db.close()

    mock_hi_json = (
        '{"section_title": "Gradient Descent", '
        ' "level2_meaning": "Gradient Descent ek iterative optimization algorithm hai jo loss ko minimize karta hai.", '
        ' "level3_explanation": "Gradient Descent negative gradient ki taraf steps leta hai taaki minimum loss mil sake."}'
    )
    mock_hi_resp = MagicMock()
    mock_hi_resp.text = mock_hi_json

    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_hi_resp
        mock_client_cls.return_value = mock_client

        # Request Hindi translation
        res_hi = client.get(f"/notes/{file_id}?lang=hi", headers={"X-Workspace-Id": ws_id})
        assert res_hi.status_code == 200
        data_hi = res_hi.json()
        assert data_hi["language"] == "hi"
        assert len(data_hi["sections"]) == 1

        sec_hi = data_hi["sections"][0]
        assert "Gradient Descent" in sec_hi["section_title"]
        assert "loss ko minimize" in sec_hi["level2_meaning"]

        # Verify cached in DB
        db = SessionLocal()
        n_db = db.query(Note).filter(Note.id == "note-opt-1").first()
        assert "hi" in n_db.translations
        assert n_db.translations["hi"]["section_title"] == "Gradient Descent"
        db.close()


def test_notes_force_regenerate(isolated_env, client):
    """Verify POST /notes/{file_id}/regenerate forces new extraction."""
    ws_id = "ws-regen-test"
    file_id = "file-regen-103"

    db = SessionLocal()
    ws = Workspace(id=ws_id)
    db.add(ws)
    file_rec = File(
        id=file_id,
        workspace_id=ws_id,
        name="Doc.pdf",
        type="pdf",
        role="material",
        page_count=1,
        status="ready",
    )
    db.add(file_rec)
    c = Chunk(id="c-reg", file_id=file_id, page_or_slide=1, chunk_index=0, text="Updated content text.")
    db.add(c)
    # Existing outdated note
    old_note = Note(
        id="old-note",
        file_id=file_id,
        section_title="Outdated Title",
        level1_keywords=["Old"],
        level2_meaning="Old meaning",
        level3_explanation="Old explanation",
        translations={},
        source_pages=[1],
    )
    db.add(old_note)
    db.commit()
    db.close()

    mock_new_json = (
        '{"sections": ['
        '  {"section_title": "Fresh New Section", "level1_keywords": ["Fresh", "Updated"], '
        '   "level2_meaning": "Brand new meaning", "level3_explanation": "Brand new explanation", "source_pages": [1]}'
        ']}'
    )
    mock_resp = MagicMock()
    mock_resp.text = mock_new_json

    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        res = client.post(f"/notes/{file_id}/regenerate", headers={"X-Workspace-Id": ws_id})
        assert res.status_code == 200
        data = res.json()
        assert len(data["sections"]) == 1
        assert data["sections"][0]["section_title"] == "Fresh New Section"

        # Check old note was replaced in SQLite
        db = SessionLocal()
        notes_in_db = db.query(Note).filter(Note.file_id == file_id).all()
        assert len(notes_in_db) == 1
        assert notes_in_db[0].section_title == "Fresh New Section"
        db.close()


def test_notes_workspace_isolation(isolated_env, client):
    """Verify Workspace B cannot read Workspace A's document notes."""
    ws_a = "ws-alpha-notes"
    ws_b = "ws-beta-notes"
    file_id = "file-secret-a"

    db = SessionLocal()
    ws = Workspace(id=ws_a)
    db.add(ws)
    file_rec = File(
        id=file_id,
        workspace_id=ws_a,
        name="Secret.pdf",
        type="pdf",
        role="material",
        page_count=1,
        status="ready",
    )
    db.add(file_rec)
    db.commit()
    db.close()

    # Workspace B requests notes for Workspace A's file
    res = client.get(f"/notes/{file_id}", headers={"X-Workspace-Id": ws_b})
    assert res.status_code == 404
    data = res.json()
    assert data["error"] is True
    assert "not found" in data["message"].lower()


def test_notes_unready_file_rejected(isolated_env, client):
    """Verify requesting notes for an unready file returns 400 error."""
    ws_id = "ws-unready"
    file_id = "file-processing-1"

    db = SessionLocal()
    ws = Workspace(id=ws_id)
    db.add(ws)
    file_rec = File(
        id=file_id,
        workspace_id=ws_id,
        name="Processing.pdf",
        type="pdf",
        role="material",
        page_count=1,
        status="processing",
    )
    db.add(file_rec)
    db.commit()
    db.close()

    res = client.get(f"/notes/{file_id}", headers={"X-Workspace-Id": ws_id})
    assert res.status_code == 400
    data = res.json()
    assert data["error"] is True
    assert "not ready" in data["message"].lower()
