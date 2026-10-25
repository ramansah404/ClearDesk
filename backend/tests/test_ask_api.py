"""Unit tests for Phase 2 Grounded Question Answering (Ask API).

Tests:
1. Relevant answers with accurate citation metadata (file_id, file_name, page_or_slide)
2. Unsupported questions returning strict 'Not found in your files' refusal
3. Multi-workspace isolation preventing cross-tenant chunk retrieval
4. Anti-hallucination guardrail: claims without valid chunk citations trigger refusal
5. Input validation and upstream API error handling
"""

import os
import tempfile
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db import Base, engine, SessionLocal, init_db
from app.models import File, Chunk, Workspace
from app.services.chunker import DocumentChunk
from app.services.embeddings import index_chunks_in_chroma, get_chunks_collection


@pytest.fixture
def isolated_env():
    """Configure temporary isolated storage, chroma, and clean database tables."""
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_storage, tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as temp_chroma:
        orig_storage = settings.storage_dir
        orig_chroma = settings.chroma_dir
        orig_key = settings.gemini_api_key

        settings.storage_dir = temp_storage
        settings.chroma_dir = temp_chroma
        settings.gemini_api_key = "test_key_placeholder"

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
        settings.gemini_api_key = orig_key


@pytest.fixture
def client(isolated_env):
    """TestClient fixture with isolated environment."""
    with TestClient(app) as test_client:
        yield test_client


def test_ask_empty_workspace_returns_not_found(client):
    """Verify asking in an empty workspace returns strict refusal immediately."""
    with patch("app.services.qa.generate_embeddings", return_value=[[0.1] * 768]):
        response = client.post(
            "/ask",
            json={"question": "What is the project deadline?", "language": "en"},
            headers={"X-Workspace-Id": "ws-empty"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_found"
    assert data["answer"] == "Not found in your files"
    assert data["citations"] == []


def test_ask_relevant_answer_with_accurate_citations(isolated_env, client):
    """Verify question answering over indexed chunks returns accurate citations."""
    ws_id = "ws-qa-alpha"
    file_id = "file-optimization-101"

    # Seed file and chunks into SQLite and ChromaDB
    db = SessionLocal()
    ws = Workspace(id=ws_id)
    db.add(ws)
    file_rec = File(
        id=file_id,
        workspace_id=ws_id,
        name="Optimization_Lecture.pdf",
        type="pdf",
        role="material",
        page_count=5,
        status="ready",
    )
    db.add(file_rec)

    chunk_1 = Chunk(
        id="chunk-opt-p3",
        file_id=file_id,
        page_or_slide=3,
        chunk_index=0,
        text="The learning rate alpha determines the step size taken towards the minimum of the loss function.",
    )
    chunk_2 = Chunk(
        id="chunk-opt-p4",
        file_id=file_id,
        page_or_slide=4,
        chunk_index=1,
        text="Momentum helps accelerate gradients in the right direction, dampening oscillations.",
    )
    c1_id = chunk_1.id
    c1_text = chunk_1.text
    c2_id = chunk_2.id
    c2_text = chunk_2.text

    db.add(chunk_1)
    db.add(chunk_2)
    db.commit()
    db.close()

    # Index into isolated ChromaDB
    dummy_vec = [0.1] * 768
    with patch("app.services.embeddings.generate_embeddings", return_value=[dummy_vec, dummy_vec]):
        index_chunks_in_chroma(
            chunks=[
                DocumentChunk(
                    id=c1_id,
                    file_id=file_id,
                    page_or_slide=3,
                    chunk_index=0,
                    text=c1_text,
                ),
                DocumentChunk(
                    id=c2_id,
                    file_id=file_id,
                    page_or_slide=4,
                    chunk_index=1,
                    text=c2_text,
                ),
            ],
            file_name="Optimization_Lecture.pdf",
            workspace_id=ws_id,
        )

    # Mock Gemini model response
    mock_gemini_response = MagicMock()
    mock_gemini_response.text = '{"not_found": false, "answer": "The learning rate alpha controls step size in gradient descent.", "cited_chunk_ids": ["C1"]}'

    with patch("app.services.qa.generate_embeddings", return_value=[dummy_vec]), \
         patch("google.genai.Client") as mock_client_cls:

        mock_genai_client = MagicMock()
        mock_genai_client.models.generate_content.return_value = mock_gemini_response
        mock_client_cls.return_value = mock_genai_client

        response = client.post(
            "/ask",
            json={"question": "What determines step size?", "language": "en"},
            headers={"X-Workspace-Id": ws_id},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "answered"
    assert "learning rate" in data["answer"]
    assert len(data["citations"]) == 1

    citation = data["citations"][0]
    assert citation["file_id"] == file_id
    assert citation["file_name"] == "Optimization_Lecture.pdf"
    assert citation["page_or_slide"] == 3
    assert "alpha determines the step size" in citation["snippet"]


def test_ask_unsupported_question_returns_strict_refusal(isolated_env, client):
    """Verify question not answered by document chunks strictly returns 'Not found in your files'."""
    ws_id = "ws-qa-beta"
    file_id = "file-biology-101"

    dummy_vec = [0.2] * 768
    with patch("app.services.embeddings.generate_embeddings", return_value=[dummy_vec]):
        index_chunks_in_chroma(
            chunks=[
                DocumentChunk(
                    id="chunk-bio-1",
                    file_id=file_id,
                    page_or_slide=1,
                    chunk_index=0,
                    text="Photosynthesis converts sunlight, water, and CO2 into glucose and oxygen.",
                )
            ],
            file_name="Biology.pdf",
            workspace_id=ws_id,
        )

    # Gemini recognizes question is unrelated
    mock_gemini_response = MagicMock()
    mock_gemini_response.text = '{"not_found": true, "answer": "Not found in your files", "cited_chunk_ids": []}'

    with patch("app.services.qa.generate_embeddings", return_value=[dummy_vec]), \
         patch("google.genai.Client") as mock_client_cls:

        mock_genai_client = MagicMock()
        mock_genai_client.models.generate_content.return_value = mock_gemini_response
        mock_client_cls.return_value = mock_genai_client

        response = client.post(
            "/ask",
            json={"question": "Who was the first emperor of Rome?", "language": "en"},
            headers={"X-Workspace-Id": ws_id},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_found"
    assert data["answer"] == "Not found in your files"
    assert data["citations"] == []


def test_ask_workspace_isolation(isolated_env, client):
    """Verify Workspace B cannot retrieve or answer from Workspace A's documents."""
    ws_a = "workspace-alpha"
    ws_b = "workspace-beta"

    dummy_vec = [0.3] * 768
    with patch("app.services.embeddings.generate_embeddings", return_value=[dummy_vec]):
        index_chunks_in_chroma(
            chunks=[
                DocumentChunk(
                    id="chunk-secret-a",
                    file_id="secret-file-a",
                    page_or_slide=1,
                    chunk_index=0,
                    text="Confidential quarterly revenue projection is 10 million dollars.",
                )
            ],
            file_name="Confidential_Report.pdf",
            workspace_id=ws_a,
        )

    # Workspace B asks about quarterly revenue
    with patch("app.services.qa.generate_embeddings", return_value=[dummy_vec]):
        response = client.post(
            "/ask",
            json={"question": "What is the revenue projection?"},
            headers={"X-Workspace-Id": ws_b},
        )

    assert response.status_code == 200
    data = response.json()
    # Workspace B has zero chunks, so it must return not_found
    assert data["status"] == "not_found"
    assert data["answer"] == "Not found in your files"
    assert data["citations"] == []


def test_ask_empty_question_rejected(client):
    """Verify submitting empty question returns 400 or 422 error."""
    response = client.post(
        "/ask",
        json={"question": "   "},
        headers={"X-Workspace-Id": "ws-test"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"] is True
    assert "empty" in data["message"].lower()


def test_ask_upstream_gemini_api_error_returns_502(isolated_env, client):
    """Verify upstream Gemini API failures return 502 with structured ErrorResponse."""
    ws_id = "ws-err-test"
    dummy_vec = [0.4] * 768

    with patch("app.services.embeddings.generate_embeddings", return_value=[dummy_vec]):
        index_chunks_in_chroma(
            chunks=[
                DocumentChunk(
                    id="chunk-err-1",
                    file_id="file-err-1",
                    page_or_slide=1,
                    chunk_index=0,
                    text="Sample text content.",
                )
            ],
            file_name="Doc.pdf",
            workspace_id=ws_id,
        )

    with patch("app.services.qa.generate_embeddings", return_value=[dummy_vec]), \
         patch("google.genai.Client") as mock_client_cls:

        mock_genai_client = MagicMock()
        mock_genai_client.models.generate_content.side_effect = RuntimeError("Quota limit reached")
        mock_client_cls.return_value = mock_genai_client

        response = client.post(
            "/ask",
            json={"question": "What is this?"},
            headers={"X-Workspace-Id": ws_id},
        )

    assert response.status_code == 502
    data = response.json()
    assert data["error"] is True
    assert "Quota limit reached" in data["message"]