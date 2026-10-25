"""Automated unit tests for Exam Radar API.

Verifies:
1. Empty workspace returns empty plan with 0 topics
2. Building exam plan with syllabus topics and day-wise schedule
3. Grounded past paper analysis (no hallucinated frequency when past papers absent)
4. Plan regeneration when exam date or hours change
5. Workspace isolation
"""

import uuid
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db import SessionLocal, init_db
from app.models import Workspace, File, Chunk, Topic, PlanDay
from app.services.exam import RawSyllabusTopic, RawPastPaperQuestion


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
        db.query(PlanDay).delete()
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


def test_exam_empty_workspace(isolated_env):
    """Empty workspace returns status empty with 0 topics and 0 days."""
    with TestClient(app) as client:
        res = client.get("/exam/plan", headers={"X-Workspace-Id": "ws-empty-exam"})
        assert res.status_code == 200
        data = res.json()
        assert data["workspace_id"] == "ws-empty-exam"
        assert data["status"] == "empty"
        assert data["total_topics"] == 0
        assert data["topics"] == []
        assert data["days"] == []


def test_exam_build_plan_with_syllabus_and_past_paper(isolated_env):
    """Test building study plan with topics, past-paper frequency, and daily tasks."""
    db = SessionLocal()
    ws_id = "ws-exam-build"
    db.add(Workspace(id=ws_id))

    # Add syllabus file
    s_file = File(id=str(uuid.uuid4()), workspace_id=ws_id, name="CS101_Syllabus.pdf", type="pdf", role="syllabus", status="ready")
    p_file = File(id=str(uuid.uuid4()), workspace_id=ws_id, name="Midterm_2025_Past_Paper.pdf", type="pdf", role="past_paper", status="ready")
    db.add_all([s_file, p_file])

    db.add(Chunk(id=str(uuid.uuid4()), file_id=s_file.id, page_or_slide=1, chunk_index=0, text="Topic 1: Neural Networks. Topic 2: Decision Trees."))
    db.add(Chunk(id=str(uuid.uuid4()), file_id=p_file.id, page_or_slide=1, chunk_index=0, text="Q1: Explain Neural Networks backpropagation (10 marks)"))
    db.commit()

    mock_topics = [
        RawSyllabusTopic(name="Neural Networks", syllabus_weight=3.0, description="Deep learning foundations", source_page=1),
        RawSyllabusTopic(name="Decision Trees", syllabus_weight=1.5, description="Tree splits and pruning", source_page=1),
    ]

    mock_past_questions = [
        RawPastPaperQuestion(question_snippet="Explain Neural Networks backpropagation", marks=10.0, matched_topic_name="Neural Networks", evidence_quote="Explain Neural Networks backpropagation (10 marks)"),
    ]

    mock_client = MagicMock()
    mock_resp_topics = MagicMock()
    mock_resp_topics.parsed = mock_topics

    mock_resp_past = MagicMock()
    mock_resp_past.parsed = mock_past_questions

    mock_client.models.generate_content.side_effect = [mock_resp_topics, mock_resp_past]

    with patch("google.genai.Client", return_value=mock_client), patch("app.config.settings.gemini_api_key", "test-key"):
        with TestClient(app) as client:
            res = client.post(
                "/exam/build",
                headers={"X-Workspace-Id": ws_id},
                json={"exam_date": "2026-11-20", "hours_per_day": 2.5},
            )
            assert res.status_code == 200
            data = res.json()

            assert data["status"] == "ready"
            assert data["total_topics"] == 2
            assert len(data["topics"]) == 2
            assert len(data["days"]) > 0

            # Neural Networks should have higher priority due to past paper frequency and marks
            nn_topic = next(t for t in data["topics"] if t["name"] == "Neural Networks")
            dt_topic = next(t for t in data["topics"] if t["name"] == "Decision Trees")

            assert nn_topic["past_paper_frequency"] == 1
            assert nn_topic["avg_marks"] == 10.0
            assert nn_topic["priority_score"] > dt_topic["priority_score"]

            # Day schedule verification
            day1 = data["days"][0]
            assert day1["minutes"] == 150  # 2.5 hours * 60 min
            assert len(day1["tasks"]) > 0


def test_exam_grounded_past_paper_absence(isolated_env):
    """When no past papers exist, frequencies and avg_marks must be 0 without hallucination."""
    db = SessionLocal()
    ws_id = "ws-exam-no-past"
    db.add(Workspace(id=ws_id))

    s_file = File(id=str(uuid.uuid4()), workspace_id=ws_id, name="CS101_Syllabus.pdf", type="pdf", role="syllabus", status="ready")
    db.add(s_file)
    db.add(Chunk(id=str(uuid.uuid4()), file_id=s_file.id, page_or_slide=1, chunk_index=0, text="Module 1: Relational Databases"))
    db.commit()

    mock_topics = [
        RawSyllabusTopic(name="Relational Databases", syllabus_weight=2.0, description="SQL and Normalization", source_page=1),
    ]

    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.parsed = mock_topics
    mock_client.models.generate_content.return_value = mock_resp

    with patch("google.genai.Client", return_value=mock_client), patch("app.config.settings.gemini_api_key", "test-key"):
        with TestClient(app) as client:
            res = client.post(
                "/exam/build",
                headers={"X-Workspace-Id": ws_id},
                json={"exam_date": "2026-11-20", "hours_per_day": 1.0},
            )
            assert res.status_code == 200
            data = res.json()

            topic = data["topics"][0]
            assert topic["past_paper_frequency"] == 0
            assert topic["avg_marks"] == 0.0
            assert topic["priority_score"] > 0.0  # Derived from syllabus weight


def test_exam_plan_regeneration(isolated_env):
    """Regenerating plan updates days and allocations without accumulating duplicate rows."""
    db = SessionLocal()
    ws_id = "ws-exam-regen"
    db.add(Workspace(id=ws_id))

    s_file = File(id=str(uuid.uuid4()), workspace_id=ws_id, name="Syllabus.pdf", type="pdf", role="syllabus", status="ready")
    db.add(s_file)
    db.add(Chunk(id=str(uuid.uuid4()), file_id=s_file.id, page_or_slide=1, chunk_index=0, text="Module 1: Algorithms"))
    db.commit()

    mock_topics = [RawSyllabusTopic(name="Algorithms", syllabus_weight=2.0, description="Sorting", source_page=1)]
    mock_client = MagicMock()
    mock_resp = MagicMock()
    mock_resp.parsed = mock_topics
    mock_client.models.generate_content.return_value = mock_resp

    with patch("google.genai.Client", return_value=mock_client), patch("app.config.settings.gemini_api_key", "test-key"):
        with TestClient(app) as client:
            # Build 1: 1 hour per day
            res1 = client.post("/exam/build", headers={"X-Workspace-Id": ws_id}, json={"exam_date": "2026-11-10", "hours_per_day": 1.0})
            assert res1.status_code == 200
            days_count1 = len(res1.json()["days"])

            # Build 2: 3 hours per day
            res2 = client.post("/exam/build", headers={"X-Workspace-Id": ws_id}, json={"exam_date": "2026-11-15", "hours_per_day": 3.0})
            assert res2.status_code == 200
            days_count2 = len(res2.json()["days"])

            # DB check: PlanDay table must only contain days from the latest build
            db_days = db.query(PlanDay).filter(PlanDay.workspace_id == ws_id).count()
            assert db_days == days_count2
            assert res2.json()["days"][0]["minutes"] == 180


def test_exam_workspace_isolation(isolated_env):
    """Workspace A study plan cannot be read by Workspace B."""
    db = SessionLocal()
    ws_a = "ws-exam-a"
    ws_b = "ws-exam-b"
    db.add_all([Workspace(id=ws_a), Workspace(id=ws_b)])

    topic_a = Topic(id=str(uuid.uuid4()), workspace_id=ws_a, name="Topic In A", syllabus_weight=2.0, priority_score=80.0)
    db.add(topic_a)
    db.commit()

    with TestClient(app) as client:
        res_b = client.get("/exam/plan", headers={"X-Workspace-Id": ws_b})
        assert res_b.status_code == 200
        assert res_b.json()["total_topics"] == 0
        assert res_b.json()["topics"] == []
