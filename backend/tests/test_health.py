"""Unit and integration tests for /health and core API behavior."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from app.main import app
from app.db import engine


@pytest.fixture
def client():
    """Test client fixture."""
    with TestClient(app) as test_client:
        yield test_client


def test_root_endpoint(client):
    """Verify root info endpoint responds with 200 and basic metadata."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert "version" in data
    assert data["name"] == "ClearDesk API"


def test_health_endpoint(client):
    """Verify /health returns 200, status=ok, and database=connected."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert "version" in data
    assert "timestamp" in data


def test_structured_error_on_404(client):
    """Verify unhandled paths return structured error response."""
    response = client.get("/non-existent-path-for-testing")
    assert response.status_code == 404
    data = response.json()
    assert data["error"] is True
    assert "message" in data
    assert "Not Found" in data["message"]


def test_database_tables_exist(client):
    """Verify that SQLite tables defined in Section 7 exist in the database."""
    # Ensure health was hit so lifespan initialized tables
    client.get("/health")
    inspector = inspect(engine)
    table_names = inspector.get_table_names()

    expected_tables = [
        "workspaces",
        "files",
        "chunks",
        "notes",
        "action_items",
        "conflicts",
        "topics",
        "plan_days",
        "quiz_questions",
        "quiz_attempts",
    ]

    for table in expected_tables:
        assert table in table_names, f"Table '{table}' should be created in SQLite database"
