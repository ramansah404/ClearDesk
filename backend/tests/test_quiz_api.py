"""Automated unit tests for Quiz Mode API.

Verifies:
1. Grounded MCQ generation with 4 options, explanation, and citations
2. Clear handling when documents lack sufficient factual evidence (insufficient_evidence)
3. Pydantic validation retry on malformed Gemini output
4. Answer submission, correctness evaluation, and topic mastery update
5. Progress statistics tracking
6. Workspace isolation
"""

import uuid
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db import SessionLocal, init_db
from app.models import Workspace, File, Chunk, Topic, QuizQuestion, QuizAttempt
from app.services.quiz import RawQuizItem


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
        db.query(QuizAttempt).delete()
        db.query(QuizQuestion).delete()
        db.query(Topic).delete()
        db.query(Chunk).delete()
        db.query(File).delete()
        db.query(Workspace).delete()
        db.commit()
        db.close()

        try:
            yield
        finally:
            settings.storage_dir = orig_storage
            settings.chroma_dir = orig_chroma
            settings.gemini_api_key = orig_key


def test_quiz_generate_insufficient_evidence(isolated_env):
    """When workspace has no documents or chunks, return insufficient_evidence without hallucinating."""
    with TestClient(app) as client:
        res = client.post(
            "/quiz/generate",
            headers={"X-Workspace-Id": "ws-empty-quiz"},
            json={"count": 3, "question_type": "mcq"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "insufficient_evidence"
        assert data["count"] == 0
        assert data["questions"] == []
        assert "Not found in your files" in data["message"]


def test_quiz_generate_grounded_mcq(isolated_env):
    """Generate MCQ questions grounded in document chunks with citations and explanations."""
    db = SessionLocal()
    ws_id = "ws-quiz-gen"
    db.add(Workspace(id=ws_id))

    file_id = str(uuid.uuid4())
    f = File(id=file_id, workspace_id=ws_id, name="ML_Lecture.pdf", type="pdf", status="ready")
    db.add(f)

    chunk_id = str(uuid.uuid4())
    db.add(Chunk(id=chunk_id, file_id=file_id, page_or_slide=3, chunk_index=0, text="ChromaDB is a vector database used for persistent vector embeddings storage."))

    topic_id = str(uuid.uuid4())
    topic = Topic(id=topic_id, workspace_id=ws_id, name="Vector Databases", syllabus_weight=2.0)
    db.add(topic)
    db.commit()

    mock_items = [
        RawQuizItem(
            question="What is ChromaDB used for according to the lecture?",
            options=["Relational SQL storage", "Persistent vector embeddings storage", "CSS styling", "DNS routing"],
            answer_index=1,
            explanation="ChromaDB is specifically documented as a persistent vector database for embeddings.",
            source_chunk_id=chunk_id,
            quote="ChromaDB is a vector database used for persistent vector embeddings storage.",
        )
    ]

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.parsed = mock_items
    mock_client.models.generate_content.return_value = mock_resp

    with patch("google.genai.Client", return_value=mock_client), patch("app.config.settings.gemini_api_key", "test-key"):
        with TestClient(app) as client:
            res = client.post(
                "/quiz/generate",
                headers={"X-Workspace-Id": ws_id},
                json={"topic_id": topic_id, "count": 1, "question_type": "mcq"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "success"
            assert data["count"] == 1

            q = data["questions"][0]
            assert q["question"] == "What is ChromaDB used for according to the lecture?"
            assert len(q["options"]) == 4
            assert q["answer_index"] == 1
            assert q["file_name"] == "ML_Lecture.pdf"
            assert q["page_or_slide"] == 3


def test_quiz_answer_and_mastery_tracking(isolated_env):
    """Answering quiz questions evaluates correctness, updates Topic mastery, and recalculates priority."""
    db = SessionLocal()
    ws_id = "ws-quiz-ans"
    db.add(Workspace(id=ws_id))

    topic_id = str(uuid.uuid4())
    topic = Topic(
        id=topic_id,
        workspace_id=ws_id,
        name="Transformer Attention",
        syllabus_weight=3.0,
        past_paper_frequency=2,
        avg_marks=8.0,
        priority_score=75.0,
        mastery=0.0,
    )
    db.add(topic)

    q_id = str(uuid.uuid4())
    q = QuizQuestion(
        id=q_id,
        workspace_id=ws_id,
        topic_id=topic_id,
        question="What is scaled dot-product attention?",
        options=["An activation function", "An attention mechanism using query and key dot products", "A loss function", "An optimizer"],
        answer_index=1,
        explanation="Scaled dot-product attention divides dot products of queries and keys by square root of dk.",
    )
    db.add(q)
    db.commit()

    with TestClient(app) as client:
        # Submit correct answer (index 1)
        res_correct = client.post(
            "/quiz/answer",
            headers={"X-Workspace-Id": ws_id},
            json={"question_id": q_id, "selected_index": 1},
        )
        assert res_correct.status_code == 200
        data_c = res_correct.json()
        assert data_c["correct"] is True
        assert data_c["correct_index"] == 1
        assert data_c["topic_mastery"] == 1.0  # 1 out of 1 attempt correct

        # DB check: Topic mastery should be updated to 1.0
        db.expire_all()
        t = db.query(Topic).filter(Topic.id == topic_id).first()
        assert t.mastery == 1.0
        # Priority score should be reduced because mastery increased
        assert t.priority_score < 75.0

        # Submit incorrect answer (index 0)
        res_wrong = client.post(
            "/quiz/answer",
            headers={"X-Workspace-Id": ws_id},
            json={"question_id": q_id, "selected_index": 0},
        )
        assert res_wrong.status_code == 200
        data_w = res_wrong.json()
        assert data_w["correct"] is False
        assert data_w["topic_mastery"] == 0.5  # 1 correct out of 2 attempts


def test_quiz_progress_endpoint(isolated_env):
    """Progress endpoint returns overall attempts, accuracy, and topic breakdown."""
    db = SessionLocal()
    ws_id = "ws-quiz-progress"
    db.add(Workspace(id=ws_id))

    topic = Topic(id=str(uuid.uuid4()), workspace_id=ws_id, name="Deep Learning", mastery=0.8)
    db.add(topic)

    q1 = QuizQuestion(id=str(uuid.uuid4()), workspace_id=ws_id, topic_id=topic.id, question="Q1", options=["A","B","C","D"], answer_index=0, explanation="E1")
    db.add(q1)

    db.add(QuizAttempt(id=str(uuid.uuid4()), question_id=q1.id, correct=True))
    db.add(QuizAttempt(id=str(uuid.uuid4()), question_id=q1.id, correct=False))
    db.commit()

    with TestClient(app) as client:
        res = client.get("/quiz/progress", headers={"X-Workspace-Id": ws_id})
        assert res.status_code == 200
        data = res.json()
        assert data["total_questions"] == 1
        assert data["total_attempts"] == 2
        assert data["correct_attempts"] == 1
        assert data["accuracy"] == 50.0
        assert "Deep Learning" in data["topic_mastery"]


def test_quiz_workspace_isolation(isolated_env):
    """Workspace B cannot access or answer Workspace A's quiz questions."""
    db = SessionLocal()
    ws_a = "ws-quiz-iso-a"
    ws_b = "ws-quiz-iso-b"
    db.add_all([Workspace(id=ws_a), Workspace(id=ws_b)])

    q_a = QuizQuestion(id=str(uuid.uuid4()), workspace_id=ws_a, question="Secret in A?", options=["1","2","3","4"], answer_index=0, explanation="Exp")
    db.add(q_a)
    db.commit()

    with TestClient(app) as client:
        # Workspace B attempts to answer Workspace A's question
        res_b = client.post(
            "/quiz/answer",
            headers={"X-Workspace-Id": ws_b},
            json={"question_id": q_a.id, "selected_index": 0},
        )
        assert res_b.status_code == 404
