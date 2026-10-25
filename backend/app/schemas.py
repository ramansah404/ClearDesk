"""Pydantic schemas for request/response serialization and validation."""

from datetime import datetime, timezone
from typing import Any, List, Optional, Dict
from pydantic import BaseModel, Field, ConfigDict


class HealthResponse(BaseModel):
    """Health check response schema."""

    status: str = Field(default="ok", description="Overall service status")
    database: str = Field(default="connected", description="Database connection status")
    version: str = Field(..., description="API Version")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Current UTC timestamp"
    )

    model_config = ConfigDict(from_attributes=True)



class ErrorResponse(BaseModel):
    """Standardized error envelope returned on all HTTP failures."""

    error: bool = Field(default=True, description="Indicates an error occurred")
    message: str = Field(..., description="Human-readable error description")
    detail: Optional[Any] = Field(default=None, description="Detailed error trace or validation errors")

    model_config = ConfigDict(from_attributes=True)


class WorkspaceCreate(BaseModel):
    """Workspace initialization payload."""

    workspace_id: Optional[str] = None


class WorkspaceResponse(BaseModel):
    """Workspace metadata response."""

    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FileResponse(BaseModel):
    """File item response schema."""

    id: str
    workspace_id: str
    name: str
    type: str
    role: str
    page_count: int
    file_size: int = 0
    status: str
    error_message: Optional[str] = None
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CitationItem(BaseModel):
    """Source citation pointing to an exact document and page/slide."""

    chunk_id: str = Field(..., description="Unique chunk ID corresponding to vector and SQLite store")
    file_id: str = Field(..., description="Uploaded document file ID")
    file_name: str = Field(..., description="Document filename")
    page_or_slide: int = Field(..., description="Page or slide number (1-indexed)")
    snippet: str = Field(..., description="Quoted text snippet supporting the answer")

    model_config = ConfigDict(from_attributes=True)


class AskRequest(BaseModel):
    """Payload for grounded document question answering."""

    question: str = Field(..., min_length=1, max_length=1000, description="User question")
    language: Optional[str] = Field(
        default="en",
        description="Target answer language: 'en' (English), 'hi' (Hindi), or 'te' (Telugu)",
    )


class AskResponse(BaseModel):
    """Grounded question answering response with citations."""

    answer: str = Field(..., description="Grounded answer text or 'Not found in your files'")
    citations: List[CitationItem] = Field(
        default_factory=list,
        description="Source citations verifying each claim in the answer",
    )
    status: str = Field(..., description="'answered' or 'not_found'")

    model_config = ConfigDict(from_attributes=True)


class NoteSection(BaseModel):
    """3-level keyword note section."""

    id: str = Field(..., description="Unique note section ID")
    file_id: str = Field(..., description="Source document file ID")
    section_title: str = Field(..., description="Section or concept title")
    level1_keywords: List[str] = Field(..., description="5-10 essential keywords/key terms")
    level2_meaning: str = Field(..., description="One-line conceptual meaning")
    level3_explanation: str = Field(..., description="Full simple explanation")
    source_pages: List[int] = Field(default_factory=list, description="Pages from which section was derived")
    language: str = Field(default="en", description="Language code of current representation (en, hi, te)")

    model_config = ConfigDict(from_attributes=True)


class NotesResponse(BaseModel):
    """Complete 3-level notes response for a document."""

    file_id: str = Field(..., description="Source document file ID")
    file_name: str = Field(..., description="Source document file name")
    language: str = Field(default="en", description="Notes display language")
    sections: List[NoteSection] = Field(default_factory=list, description="List of 3-level note sections")
    cached: bool = Field(default=False, description="Whether notes were served from database cache")

    model_config = ConfigDict(from_attributes=True)



class ActionItemResponse(BaseModel):
    """Action item response model."""

    id: str = Field(..., description="Unique action item ID")
    workspace_id: str = Field(..., description="Workspace ID")
    file_id: Optional[str] = Field(None, description="Source file ID")
    file_name: Optional[str] = Field(None, description="Source file name")
    kind: str = Field(..., description="Action kind: 'deadline', 'deliverable', or 'missing_info'")
    label: str = Field(..., description="Item category or title")
    value: str = Field(..., description="Description, value, or requirement detail")
    due_date: Optional[datetime] = Field(None, description="Parsed due date/time if applicable")
    owner: Optional[str] = Field(None, description="Responsible person or team if specified")
    page_or_slide: Optional[int] = Field(None, description="Page or slide number reference")
    quote: Optional[str] = Field(None, description="Verbatim source quote from document")

    model_config = ConfigDict(from_attributes=True)


class ConflictResponse(BaseModel):
    """Contradiction or conflicting items detected across documents."""

    id: str = Field(..., description="Unique conflict ID")
    workspace_id: str = Field(..., description="Workspace ID")
    label: str = Field(..., description="Normalized label or subject of conflict")
    item_a_id: str = Field(..., description="First conflicting item ID")
    item_b_id: str = Field(..., description="Second conflicting item ID")
    file_a_name: Optional[str] = Field(None, description="Source filename for item A")
    file_b_name: Optional[str] = Field(None, description="Source filename for item B")
    value_a: Optional[str] = Field(None, description="Value or date from source A")
    value_b: Optional[str] = Field(None, description="Value or date from source B")
    explanation: str = Field(..., description="Clear explanation of the contradiction")

    model_config = ConfigDict(from_attributes=True)


class ActionsSummary(BaseModel):
    """Count summary for action board."""

    total_items: int = 0
    deadlines_count: int = 0
    deliverables_count: int = 0
    missing_info_count: int = 0
    conflicts_count: int = 0


class ActionsBoardResponse(BaseModel):
    """Aggregated action items and conflicts for a workspace."""

    workspace_id: str = Field(..., description="Workspace ID")
    items: List[ActionItemResponse] = Field(default_factory=list, description="All extracted action items")
    conflicts: List[ConflictResponse] = Field(default_factory=list, description="Detected cross-document conflicts")
    summary: ActionsSummary = Field(default_factory=ActionsSummary, description="Item and conflict counts")

    model_config = ConfigDict(from_attributes=True)


# --- Phase 5: Exam Radar & Quiz Mode Schemas ---

class TopicResponse(BaseModel):
    """Syllabus topic with priority ranking, past paper frequency, and mastery."""

    id: str = Field(..., description="Unique topic ID")
    workspace_id: str = Field(..., description="Workspace ID")
    name: str = Field(..., description="Topic title/name")
    syllabus_weight: float = Field(default=1.0, description="Estimated syllabus weight / credit hours")
    past_paper_frequency: int = Field(default=0, description="Occurrences in analyzed past exam papers")
    avg_marks: float = Field(default=0.0, description="Average marks allocated in past papers")
    priority_score: float = Field(default=0.0, description="Computed priority score: 0.5*norm_freq + 0.3*norm_marks + 0.2*weight")
    mastery: float = Field(default=0.0, description="Current student mastery level: 0.0 to 1.0")
    priority_level: str = Field(default="medium", description="Priority tier: 'high', 'medium', or 'low'")

    model_config = ConfigDict(from_attributes=True)


class PlanTask(BaseModel):
    """Actionable daily study task for a topic."""

    topic_id: str = Field(..., description="Target topic ID")
    topic_name: str = Field(..., description="Target topic name")
    task_description: str = Field(..., description="Specific study objective or revision activity")
    minutes: int = Field(default=30, description="Allocated study duration in minutes")


class PlanDayResponse(BaseModel):
    """Day-wise study schedule."""

    id: str = Field(..., description="Plan day ID")
    workspace_id: str = Field(..., description="Workspace ID")
    date: str = Field(..., description="Date string YYYY-MM-DD")
    topic_ids: List[str] = Field(default_factory=list, description="Assigned topic IDs for this day")
    minutes: int = Field(default=60, description="Total planned study minutes for this day")
    tasks: List[PlanTask] = Field(default_factory=list, description="Detailed daily tasks")

    model_config = ConfigDict(from_attributes=True)


class ExamBuildRequest(BaseModel):
    """Request payload to build or regenerate an exam study plan."""

    exam_date: str = Field(..., description="Target exam date in YYYY-MM-DD format")
    hours_per_day: float = Field(default=2.0, ge=0.5, le=12.0, description="Daily available study time in hours")


class ExamPlanResponse(BaseModel):
    """Complete Exam Radar study plan response."""

    workspace_id: str = Field(..., description="Workspace ID")
    exam_date: Optional[str] = Field(None, description="Exam date")
    hours_per_day: Optional[float] = Field(None, description="Hours per day")
    total_topics: int = Field(default=0, description="Total number of topics")
    topics: List[TopicResponse] = Field(default_factory=list, description="Prioritized topics")
    days: List[PlanDayResponse] = Field(default_factory=list, description="Day-wise study schedule")
    status: str = Field(default="ready", description="Status: 'ready' or 'empty'")

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionResponse(BaseModel):
    """Grounded quiz question with options, citations, and attempt state."""

    id: str = Field(..., description="Unique question ID")
    workspace_id: str = Field(..., description="Workspace ID")
    topic_id: Optional[str] = Field(None, description="Linked syllabus topic ID if any")
    topic_name: Optional[str] = Field(None, description="Linked syllabus topic name")
    question: str = Field(..., description="Question statement")
    options: List[str] = Field(default_factory=list, description="4 answer options")
    answer_index: int = Field(..., description="0-indexed correct option")
    explanation: str = Field(..., description="Detailed pedagogical explanation grounded in text")
    source_chunk_id: Optional[str] = Field(None, description="Cited chunk ID")
    file_id: Optional[str] = Field(None, description="Source file ID")
    file_name: Optional[str] = Field(None, description="Source document name")
    page_or_slide: Optional[int] = Field(None, description="Source page or slide number")
    quote: Optional[str] = Field(None, description="Supporting verbatim quote")
    answered: bool = Field(default=False, description="Whether user has attempted this question")
    user_answer: Optional[int] = Field(None, description="Option index selected by user")
    is_correct: Optional[bool] = Field(None, description="Whether user's answer was correct")

    model_config = ConfigDict(from_attributes=True)


class QuizGenerateRequest(BaseModel):
    """Request to generate quiz questions."""

    topic_id: Optional[str] = Field(None, description="Optional topic ID filter")
    count: int = Field(default=5, ge=1, le=20, description="Number of questions to generate")
    question_type: str = Field(default="mcq", description="Question format: 'mcq' or 'short_answer'")


class QuizGenerateResponse(BaseModel):
    """Response containing generated questions and evidence status."""

    workspace_id: str = Field(..., description="Workspace ID")
    topic_id: Optional[str] = Field(None, description="Topic ID if filtered")
    count: int = Field(default=0, description="Count of questions returned")
    questions: List[QuizQuestionResponse] = Field(default_factory=list, description="Generated questions")
    status: str = Field(default="success", description="Status: 'success' or 'insufficient_evidence'")
    message: Optional[str] = Field(None, description="Status explanation or refusal message")

    model_config = ConfigDict(from_attributes=True)


class QuizAnswerRequest(BaseModel):
    """User answer submission."""

    question_id: str = Field(..., description="Question ID being answered")
    selected_index: int = Field(..., ge=0, le=3, description="Selected option index (0 to 3)")


class QuizAnswerResponse(BaseModel):
    """Evaluation result for submitted quiz answer."""

    question_id: str = Field(..., description="Question ID")
    correct: bool = Field(..., description="Whether answer was correct")
    selected_index: int = Field(..., description="Selected option index")
    correct_index: int = Field(..., description="Correct option index")
    explanation: str = Field(..., description="Full explanation of correct answer")
    topic_id: Optional[str] = Field(None, description="Topic ID")
    topic_mastery: float = Field(default=0.0, description="Updated mastery score for this topic (0.0 to 1.0)")
    priority_score: float = Field(default=0.0, description="Recalculated priority score for this topic")
    citation: Optional[Dict[str, Any]] = Field(None, description="Source citation reference")

    model_config = ConfigDict(from_attributes=True)


class QuizProgressResponse(BaseModel):
    """Overall quiz and mastery progress for a workspace."""

    workspace_id: str = Field(..., description="Workspace ID")
    total_questions: int = 0
    total_attempts: int = 0
    correct_attempts: int = 0
    accuracy: float = 0.0
    topic_mastery: Dict[str, float] = Field(default_factory=dict, description="Mastery per topic ID")

    model_config = ConfigDict(from_attributes=True)
