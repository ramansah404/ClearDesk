"""Automated unit tests for Action Board & Conflict Detection API.

Verifies:
1. Empty workspace returns 0 items and 0 conflicts
2. Action item extraction, schema grounding, and kind categorization
3. dateparser date validation and datetime conversion
4. Cross-document conflict detection and explanation banner generation
5. RFC 5545 .ics calendar export endpoint
6. Workspace isolation
7. Force rescan endpoint
"""

import uuid
import tempfile
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db import SessionLocal, init_db
from app.models import Workspace, File, Chunk, ActionItem, Conflict
from app.services.actions import parse_due_date, RawExtractedItem


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
        db.query(Conflict).delete()
        db.query(ActionItem).delete()
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


def test_parse_due_date():
    """Test dateparser extraction and edge cases."""
    # Standard format with time
    dt1 = parse_due_date("November 28, 2026 at 11:59 PM EST")
    assert dt1 is not None
    assert dt1.month == 11
    assert dt1.day == 28

    # Short date format
    dt2 = parse_due_date("25 Oct 2026")
    assert dt2 is not None
    assert dt2.month == 10
    assert dt2.day == 25

    # None and empty strings
    assert parse_due_date(None) is None
    assert parse_due_date("") is None
    assert parse_due_date("not a date string at all") is None


def test_actions_empty_workspace(isolated_env):
    """Empty workspace returns empty lists and 0 counts."""
    with TestClient(app) as client:
        res = client.get("/actions", headers={"X-Workspace-Id": "ws-empty-actions"})
        assert res.status_code == 200
        data = res.json()
        assert data["workspace_id"] == "ws-empty-actions"
        assert data["items"] == []
        assert data["conflicts"] == []
        assert data["summary"]["total_items"] == 0
        assert data["summary"]["conflicts_count"] == 0


def test_actions_extraction_grounding_and_kinds(isolated_env):
    """Test extracting action items across all 3 kinds with mock Gemini."""
    db = SessionLocal()
    ws_id = "ws-actions-test"
    db.add(Workspace(id=ws_id))

    file_id = str(uuid.uuid4())
    f = File(
        id=file_id,
        workspace_id=ws_id,
        name="Project_Spec.pdf",
        type="pdf",
        page_count=3,
        file_size=2000,
        status="ready",
    )
    db.add(f)
    db.add(
        Chunk(
            id=str(uuid.uuid4()),
            file_id=file_id,
            page_or_slide=2,
            chunk_index=0,
            text="Project submission deadline is November 28, 2026 at 11:59 PM EST. Deliverable is an 8-page PDF report. Note: budget approval sheet is missing.",
        )
    )
    db.commit()

    mock_raw_items = [
        RawExtractedItem(
            kind="deadline",
            label="Project Submission Deadline",
            value="Submit final code and report by November 28, 2026 at 11:59 PM EST",
            date_text="November 28, 2026 at 11:59 PM EST",
            owner="Students",
            page_or_slide=2,
            quote="Project submission deadline is November 28, 2026 at 11:59 PM EST.",
        ),
        RawExtractedItem(
            kind="deliverable",
            label="Final Project Report",
            value="8-page PDF report accompanying code repository",
            date_text=None,
            owner=None,
            page_or_slide=2,
            quote="Deliverable is an 8-page PDF report.",
        ),
        RawExtractedItem(
            kind="missing_info",
            label="Budget Approval Sheet",
            value="Budget approval sheet mentioned but omitted from attachments",
            date_text=None,
            owner=None,
            page_or_slide=2,
            quote="Note: budget approval sheet is missing.",
        ),
    ]

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = mock_raw_items
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client), patch("app.config.settings.gemini_api_key", "test-key"):
        with TestClient(app) as client:
            res = client.get("/actions", headers={"X-Workspace-Id": ws_id})
            assert res.status_code == 200
            data = res.json()

            assert data["summary"]["total_items"] == 3
            assert data["summary"]["deadlines_count"] == 1
            assert data["summary"]["deliverables_count"] == 1
            assert data["summary"]["missing_info_count"] == 1

            # Check deadline item
            deadline_item = next(it for it in data["items"] if it["kind"] == "deadline")
            assert deadline_item["label"] == "Project Submission Deadline"
            assert deadline_item["due_date"] is not None
            assert deadline_item["page_or_slide"] == 2
            assert deadline_item["file_name"] == "Project_Spec.pdf"

            # Check deliverable item
            deliverable_item = next(it for it in data["items"] if it["kind"] == "deliverable")
            assert deliverable_item["label"] == "Final Project Report"
            assert deliverable_item["due_date"] is None

            # Check missing info item
            missing_item = next(it for it in data["items"] if it["kind"] == "missing_info")
            assert missing_item["label"] == "Budget Approval Sheet"


def test_cross_document_conflict_detection(isolated_env):
    """Test detecting conflicting deadlines across two different documents."""
    db = SessionLocal()
    ws_id = "ws-conflicts-test"
    db.add(Workspace(id=ws_id))

    file1 = File(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        name="Course_Syllabus.pdf",
        type="pdf",
        status="ready",
    )
    file2 = File(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        name="Project_Addendum.docx",
        type="docx",
        status="ready",
    )
    db.add_all([file1, file2])

    # Item A in Syllabus: Nov 28
    item_a = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file1.id,
        kind="deadline",
        label="Final Project Submission Deadline",
        value="Submission deadline November 28, 2026",
        due_date=datetime(2026, 11, 28, 23, 59),
        page_or_slide=2,
        quote="Submission deadline November 28, 2026 at 11:59 PM",
    )

    # Item B in Addendum: Dec 2
    item_b = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file2.id,
        kind="deadline",
        label="Final Project Submission Deadline",
        value="Deadline extended to December 2, 2026",
        due_date=datetime(2026, 12, 2, 23, 59),
        page_or_slide=1,
        quote="Deadline extended to December 2, 2026",
    )
    db.add_all([item_a, item_b])
    db.commit()

    with TestClient(app) as client:
        res = client.get("/actions", headers={"X-Workspace-Id": ws_id})
        assert res.status_code == 200
        data = res.json()

        assert data["summary"]["conflicts_count"] == 1
        conflict = data["conflicts"][0]
        assert "Course_Syllabus.pdf" in conflict["explanation"]
        assert "Project_Addendum.docx" in conflict["explanation"]
        assert conflict["file_a_name"] in ["Course_Syllabus.pdf", "Project_Addendum.docx"]
        assert conflict["file_b_name"] in ["Course_Syllabus.pdf", "Project_Addendum.docx"]


def test_calendar_ics_export(isolated_env):
    """Test generating RFC 5545 .ics file with timezones, durations, and duplicate handling."""
    db = SessionLocal()
    ws_id = "ws-ics-test"
    db.add(Workspace(id=ws_id))

    file1 = File(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        name="Schedule.pdf",
        type="pdf",
        status="ready",
    )
    db.add(file1)

    # Item 1: Floating local time (no timezone specified in source)
    item_floating = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file1.id,
        kind="deadline",
        label="Midterm Exam",
        value="In-class midterm exam in Turing Hall",
        due_date=datetime(2026, 10, 20, 14, 0),
        page_or_slide=1,
        quote="Midterm Exam on October 20 at 2:00 PM.",
    )

    # Item 2: Explicit EST timezone specified in source
    item_est = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file1.id,
        kind="deadline",
        label="Final Project Deadline",
        value="Submit final code by November 28, 2026 at 11:59 PM EST",
        due_date=datetime(2026, 11, 28, 23, 59),
        page_or_slide=2,
        quote="Submission Deadline: November 28, 2026 at 11:59 PM EST.",
    )

    # Item 3: Duplicate deliverable with same date and matching label
    item_dup = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file1.id,
        kind="deliverable",
        label="Final Project Deadline",
        value="ZIP archive and report submitted by Nov 28 at 11:59 PM EST",
        due_date=datetime(2026, 11, 28, 23, 59),
        page_or_slide=2,
        quote="Submission Deadline: November 28, 2026 at 11:59 PM EST.",
    )

    db.add_all([item_floating, item_est, item_dup])
    db.commit()

    with TestClient(app) as client:
        res = client.get("/actions/calendar.ics", headers={"X-Workspace-Id": ws_id})
        assert res.status_code == 200
        assert "text/calendar" in res.headers.get("content-type", "")
        assert "cleardesk-actions.ics" in res.headers.get("content-disposition", "")

        ics_content = res.text
        assert "BEGIN:VCALENDAR" in ics_content
        assert "VERSION:2.0" in ics_content

        # 1. Timezone preservation: America/New_York VTIMEZONE and TZID parameter
        assert "BEGIN:VTIMEZONE" in ics_content
        assert "TZID:America/New_York" in ics_content
        assert "DTSTART;TZID=America/New_York:20261128T235900" in ics_content
        # 1-hour duration check
        assert "DTEND;TZID=America/New_York:20261129T005900" in ics_content

        # 2. Floating time preservation (no silent assumption of timezone when omitted)
        assert "DTSTART:20261020T140000" in ics_content
        assert "DTEND:20261020T150000" in ics_content

        # 3. Deduplication check: only 2 VEVENT blocks generated (item_dup eliminated)
        vevent_count = ics_content.count("BEGIN:VEVENT")
        assert vevent_count == 2

        assert "END:VCALENDAR" in ics_content


def test_deliverable_contradiction_vs_complementary(isolated_env):
    """Confirm complementary deliverables (ZIP and GitHub) are not flagged, while genuine contradictions are."""
    db = SessionLocal()
    ws_id = "ws-deliverable-contra-test"
    db.add(Workspace(id=ws_id))

    file1 = File(id=str(uuid.uuid4()), workspace_id=ws_id, name="Syllabus.pdf", type="pdf", status="ready")
    file2 = File(id=str(uuid.uuid4()), workspace_id=ws_id, name="Update.pdf", type="pdf", status="ready")
    db.add_all([file1, file2])

    # Case 1: Complementary requirements (ZIP archive on portal + GitHub repository link)
    item_zip = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file1.id,
        kind="deliverable",
        label="Final Project Deliverable",
        value="ZIP archive submitted via student portal containing source code and an 8-page PDF report",
        page_or_slide=2,
    )
    item_git = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file2.id,
        kind="deliverable",
        label="Final Project Deliverable",
        value="All project teams must submit a public GitHub repository link alongside the 8-page PDF report",
        page_or_slide=1,
    )
    db.add_all([item_zip, item_git])
    db.commit()

    with TestClient(app) as client:
        res = client.get("/actions", headers={"X-Workspace-Id": ws_id})
        assert res.status_code == 200
        # Complementary requirements must NOT be flagged as conflicting!
        assert len(res.json()["conflicts"]) == 0

    # Case 2: Genuine deliverable contradiction (explicit prohibition of ZIP archives)
    db.query(ActionItem).delete()
    db.commit()

    item_zip_req = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file1.id,
        kind="deliverable",
        label="Final Project Submission",
        value="ZIP archive submitted via student portal containing source code",
        page_or_slide=2,
    )
    item_zip_prohibited = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file2.id,
        kind="deliverable",
        label="Final Project Submission",
        value="Only GitHub repository links accepted; ZIP submissions are strictly prohibited",
        page_or_slide=1,
    )
    db.add_all([item_zip_req, item_zip_prohibited])
    db.commit()

    with TestClient(app) as client:
        res = client.get("/actions", headers={"X-Workspace-Id": ws_id})
        assert res.status_code == 200
        conflicts = res.json()["conflicts"]
        assert len(conflicts) == 1
        assert "prohibits" in conflicts[0]["explanation"].lower() or "zip" in conflicts[0]["explanation"].lower()

    # Case 3: Genuine deadline contradiction for the same deliverable
    db.query(ActionItem).delete()
    db.commit()

    item_deadline_a = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file1.id,
        kind="deadline",
        label="Final Project Submission Deadline",
        value="Final project must be submitted by November 28, 2026 at 11:59 PM EST",
        due_date=datetime(2026, 11, 28, 23, 59),
        page_or_slide=2,
    )
    item_deadline_b = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_id,
        file_id=file2.id,
        kind="deadline",
        label="Final Project Submission Deadline",
        value="Final project deadline officially extended to December 2, 2026 at 11:59 PM EST",
        due_date=datetime(2026, 12, 2, 23, 59),
        page_or_slide=1,
    )
    db.add_all([item_deadline_a, item_deadline_b])
    db.commit()

    with TestClient(app) as client:
        res = client.get("/actions", headers={"X-Workspace-Id": ws_id})
        assert res.status_code == 200
        conflicts = res.json()["conflicts"]
        assert len(conflicts) == 1
        assert "28 Nov 2026" in conflicts[0]["explanation"]
        assert "02 Dec 2026" in conflicts[0]["explanation"]



def test_actions_workspace_isolation(isolated_env):
    """Verify actions and calendar cannot leak across workspace boundaries."""
    db = SessionLocal()
    ws_a = "ws-iso-a"
    ws_b = "ws-iso-b"
    db.add_all([Workspace(id=ws_a), Workspace(id=ws_b)])

    file_a = File(id=str(uuid.uuid4()), workspace_id=ws_a, name="Secret_A.pdf", type="pdf", status="ready")
    db.add(file_a)
    item_a = ActionItem(
        id=str(uuid.uuid4()),
        workspace_id=ws_a,
        file_id=file_a.id,
        kind="deadline",
        label="Confidential Milestone",
        value="Deliver project files",
        due_date=datetime(2026, 11, 1),
        page_or_slide=1,
    )
    db.add(item_a)
    db.commit()

    with TestClient(app) as client:
        # Workspace B queries /actions
        res_b = client.get("/actions", headers={"X-Workspace-Id": ws_b})
        assert res_b.status_code == 200
        assert res_b.json()["summary"]["total_items"] == 0

        # Workspace B queries /actions/calendar.ics
        res_ics_b = client.get("/actions/calendar.ics", headers={"X-Workspace-Id": ws_b})
        assert res_ics_b.status_code == 200
        assert "Confidential Milestone" not in res_ics_b.text


def test_rescan_actions_endpoint(isolated_env):
    """Verify POST /actions/rescan clears and re-evaluates actions."""
    db = SessionLocal()
    ws_id = "ws-rescan-test"
    db.add(Workspace(id=ws_id))

    file_id = str(uuid.uuid4())
    f = File(
        id=file_id,
        workspace_id=ws_id,
        name="Project_Spec.pdf",
        type="pdf",
        status="ready",
    )
    db.add(f)
    db.add(
        Chunk(
            id=str(uuid.uuid4()),
            file_id=file_id,
            page_or_slide=1,
            chunk_index=0,
            text="Initial chunk text",
        )
    )
    db.commit()

    mock_raw_items = [
        RawExtractedItem(
            kind="deadline",
            label="Rescan Deadline",
            value="Due next Friday",
            date_text="2026-11-20",
            owner=None,
            page_or_slide=1,
            quote="Initial chunk text",
        ),
    ]

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = mock_raw_items
    mock_client.models.generate_content.return_value = mock_response

    with patch("google.genai.Client", return_value=mock_client), patch("app.config.settings.gemini_api_key", "test-key"):
        with TestClient(app) as client:
            res = client.post("/actions/rescan", headers={"X-Workspace-Id": ws_id})
            assert res.status_code == 200
            data = res.json()
            assert data["summary"]["total_items"] == 1
            assert data["items"][0]["label"] == "Rescan Deadline"
