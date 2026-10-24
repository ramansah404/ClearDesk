"""SQLAlchemy ORM Data Models for ClearDesk.

Implements all entities defined in Section 7 of PROJECT_SPEC.md:
- Workspace
- File
- Chunk
- Note
- ActionItem
- Conflict
- Topic
- PlanDay
- QuizQuestion
- QuizAttempt
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from app.db import Base


def generate_uuid() -> str:
    """Generate a UUID4 hex string."""
    return str(uuid.uuid4())


def utc_now() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)


class Workspace(Base):
    """Browser session workspace grouping all user documents and extracted data."""

    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    created_at = Column(DateTime, default=utc_now, nullable=False)


    # Relationships
    files = relationship("File", back_populates="workspace", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="workspace", cascade="all, delete-orphan")
    conflicts = relationship("Conflict", back_populates="workspace", cascade="all, delete-orphan")
    topics = relationship("Topic", back_populates="workspace", cascade="all, delete-orphan")
    plan_days = relationship("PlanDay", back_populates="workspace", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="workspace", cascade="all, delete-orphan")


class File(Base):
    """Uploaded user file record and processing status."""

    __tablename__ = "files"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(32), nullable=False)  # pdf, pptx, docx, image, xlsx
    role = Column(String(32), default="material", nullable=False)  # material, syllabus, past_paper, other
    pdf_path = Column(String(512), nullable=True)  # Path to converted/original PDF for viewer
    page_count = Column(Integer, default=0, nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    status = Column(String(32), default="processing", nullable=False)  # processing, ready, failed
    error_message = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=utc_now, nullable=False)



    # Relationships
    workspace = relationship("Workspace", back_populates="files")
    chunks = relationship("Chunk", back_populates="file", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="file", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="file", cascade="all, delete-orphan")


class Chunk(Base):
    """Extracted text chunk linked to exact page/slide with vector ID correspondence."""

    __tablename__ = "chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    page_or_slide = Column(Integer, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    ocr_confidence = Column(Float, nullable=True)  # Per-word / chunk average confidence for OCR

    # Relationships
    file = relationship("File", back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_file_page", "file_id", "page_or_slide"),
    )


class Note(Base):
    """3-level keyword notes per file section with multilingual translations."""

    __tablename__ = "notes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    section_title = Column(String(255), nullable=False)
    level1_keywords = Column(JSON, default=list, nullable=False)  # List[str]
    level2_meaning = Column(Text, nullable=False)  # One-line meaning
    level3_explanation = Column(Text, nullable=False)  # Full explanation
    translations = Column(JSON, default=dict, nullable=False)  # {"hi": {...}, "te": {...}}
    source_pages = Column(JSON, default=list, nullable=False)  # List[int]

    # Relationships
    file = relationship("File", back_populates="notes")


class ActionItem(Base):
    """Action item extracted from documents (deadline, deliverable, missing_info)."""

    __tablename__ = "action_items"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    file_id = Column(String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    kind = Column(String(32), nullable=False)  # deadline, deliverable, missing_info
    label = Column(String(255), nullable=False)
    value = Column(String(255), nullable=False)
    due_date = Column(DateTime, nullable=True)
    owner = Column(String(255), nullable=True)
    page_or_slide = Column(Integer, nullable=True)
    quote = Column(Text, nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="action_items")
    file = relationship("File", back_populates="action_items")


class Conflict(Base):
    """Flagged contradiction between documents (e.g. conflicting deadlines or numbers)."""

    __tablename__ = "conflicts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    label = Column(String(255), nullable=False)
    item_a_id = Column(String(36), nullable=False)
    item_b_id = Column(String(36), nullable=False)
    explanation = Column(Text, nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="conflicts")


class Topic(Base):
    """Syllabus topic analyzed against past papers with priority score and mastery."""

    __tablename__ = "topics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    syllabus_weight = Column(Float, default=1.0, nullable=False)
    past_paper_frequency = Column(Integer, default=0, nullable=False)
    avg_marks = Column(Float, default=0.0, nullable=False)
    priority_score = Column(Float, default=0.0, nullable=False)
    mastery = Column(Float, default=0.0, nullable=False)  # 0.0 to 1.0

    # Relationships
    workspace = relationship("Workspace", back_populates="topics")
    quiz_questions = relationship("QuizQuestion", back_populates="topic", cascade="all, delete-orphan")


class PlanDay(Base):
    """Day-wise revision plan schedule generated backward from exam date."""

    __tablename__ = "plan_days"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(String(32), nullable=False)  # YYYY-MM-DD
    topic_ids = Column(JSON, default=list, nullable=False)  # List[str]
    minutes = Column(Integer, default=60, nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="plan_days")


class QuizQuestion(Base):
    """Generated MCQ question grounded in document chunks."""

    __tablename__ = "quiz_questions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id = Column(String(36), ForeignKey("topics.id", ondelete="SET NULL"), nullable=True)
    question = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)  # List[str]
    answer_index = Column(Integer, nullable=False)  # 0-3
    explanation = Column(Text, nullable=False)
    source_chunk_id = Column(String(36), nullable=True)

    # Relationships
    workspace = relationship("Workspace", back_populates="quiz_questions")
    topic = relationship("Topic", back_populates="quiz_questions")
    attempts = relationship("QuizAttempt", back_populates="question", cascade="all, delete-orphan")


class QuizAttempt(Base):
    """Record of a user's answer attempt for mastery tracking."""

    __tablename__ = "quiz_attempts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    question_id = Column(String(36), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False, index=True)
    correct = Column(Boolean, nullable=False)
    answered_at = Column(DateTime, default=utc_now, nullable=False)


    # Relationships
    question = relationship("QuizQuestion", back_populates="attempts")
