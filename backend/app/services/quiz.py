"""Quiz service: grounded MCQ & short answer generation, evaluation, scoring,
source citation mapping, and mastery tracking.

Implements Section 9.6 and Section 8 of PROJECT_SPEC.md:
- Grounded strictly in uploaded document chunks.
- Multiple-choice and short-answer questions.
- Answer submission, scoring, and mastery tracking.
- Clear handling when documents lack sufficient evidence.
- Pydantic validation with 1 retry on invalid output.
"""

import os
import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

from sqlalchemy.orm import Session

from app.config import settings
from app.models import File, Chunk, Topic, QuizQuestion, QuizAttempt
from app.services.embeddings import generate_embeddings, get_chunks_collection
from app.schemas import (
    QuizQuestionResponse,
    QuizGenerateResponse,
    QuizAnswerResponse,
    QuizProgressResponse,
)


class RawQuizItem(BaseModel):
    """Raw quiz question schema for Gemini structured output."""
    question: str = Field(..., description="Challenging, grounded question statement")
    options: List[str] = Field(..., description="Array of exactly 4 answer options")
    answer_index: int = Field(..., ge=0, le=3, description="0-indexed integer indicating correct option")
    explanation: str = Field(..., description="Detailed explanation grounded in the text")
    source_chunk_id: Optional[str] = Field(None, description="Referenced chunk identifier")
    quote: Optional[str] = Field(None, description="Exact supporting quote from document chunk")

    @field_validator("options")
    @classmethod
    def validate_options_count(cls, v: List[str]) -> List[str]:
        if len(v) != 4:
            raise ValueError(f"Expected exactly 4 options, got {len(v)}")
        return [opt.strip() for opt in v]


def load_prompt_template(filename: str) -> str:
    """Load prompt template from prompts directory."""
    prompt_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "prompts", filename
    )
    if os.path.exists(prompt_file):
        with open(prompt_file, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def retrieve_chunks_for_quiz(
    workspace_id: str, topic_id: Optional[str], db: Session
) -> tuple[List[Chunk], Optional[Topic]]:
    """Retrieve relevant chunks for quiz generation using ChromaDB or SQLite."""
    topic = None
    target_topic_name = "Course Concepts"

    if topic_id:
        topic = (
            db.query(Topic)
            .filter(Topic.id == topic_id, Topic.workspace_id == workspace_id)
            .first()
        )
        if topic:
            target_topic_name = topic.name

    # Check ready files
    ready_files = (
        db.query(File)
        .filter(File.workspace_id == workspace_id, File.status == "ready")
        .all()
    )
    if not ready_files:
        return [], topic

    file_ids = [f.id for f in ready_files]

    # Try Chroma vector search first for high relevance
    retrieved_chunks = []
    try:
        query_text = f"Key definitions, principles, and concepts of {target_topic_name}"
        query_vectors = generate_embeddings([query_text])

        if query_vectors:
            collection = get_chunks_collection()
            if collection.count() > 0:
                results = collection.query(
                    query_embeddings=[query_vectors[0]],
                    n_results=min(10, collection.count()),
                    where={"workspace_id": workspace_id},
                )
                chunk_ids = results.get("ids", [[]])[0]
                if chunk_ids:
                    retrieved_chunks = (
                        db.query(Chunk)
                        .filter(Chunk.id.in_(chunk_ids), Chunk.file_id.in_(file_ids))
                        .all()
                    )
    except Exception:
        retrieved_chunks = []

    # Fallback to direct DB chunks if Chroma returns nothing
    if not retrieved_chunks:
        retrieved_chunks = (
            db.query(Chunk)
            .filter(Chunk.file_id.in_(file_ids))
            .order_by(Chunk.page_or_slide.asc())
            .limit(10)
            .all()
        )

    return retrieved_chunks, topic


def generate_quiz_questions(
    workspace_id: str,
    topic_id: Optional[str],
    count: int,
    question_type: str,
    db: Session,
) -> QuizGenerateResponse:
    """Generate grounded questions using Gemini with 1 retry on malformed output."""
    chunks, topic = retrieve_chunks_for_quiz(workspace_id, topic_id, db)

    # Insufficient evidence check: Do not hallucinate if no document evidence exists
    if not chunks:
        return QuizGenerateResponse(
            workspace_id=workspace_id,
            topic_id=topic_id,
            count=0,
            questions=[],
            status="insufficient_evidence",
            message="Not found in your files. Upload course material or past papers to generate grounded quiz questions.",
        )

    chunk_snippets = [f"[{c.id}] (Page {c.page_or_slide}): {c.text}" for c in chunks]
    chunks_text = "\n\n".join(chunk_snippets)

    topic_name = topic.name if topic else "General Course Review"
    template = load_prompt_template("quiz_generate.txt")
    if not template:
        template = "Generate quiz questions grounded strictly in: {chunks_text}"

    prompt = template.format(
        topic_name=topic_name,
        chunks_text=chunks_text,
        count=count,
        question_type=question_type,
    )

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    model_name = settings.llm_model.strip() or "gemini-3.5-flash-lite"

    raw_questions: List[RawQuizItem] = []
    # 1 retry for Pydantic validation / invalid output
    for attempt in range(2):
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[RawQuizItem],
                    temperature=0.1 if attempt == 0 else 0.0,
                ),
            )
            raw_questions = resp.parsed or []
            if raw_questions:
                break
        except Exception as exc:
            if attempt == 1:
                return QuizGenerateResponse(
                    workspace_id=workspace_id,
                    topic_id=topic_id,
                    count=0,
                    questions=[],
                    status="insufficient_evidence",
                    message=f"Failed to generate structured quiz after retry: {exc}",
                )

    if not raw_questions:
        return QuizGenerateResponse(
            workspace_id=workspace_id,
            topic_id=topic_id,
            count=0,
            questions=[],
            status="insufficient_evidence",
            message="Not found in your files. The uploaded documents lack sufficient factual evidence for this quiz topic.",
        )

    # Map chunk metadata for source citations
    chunk_map = {c.id: c for c in chunks}
    files = db.query(File).filter(File.workspace_id == workspace_id).all()
    file_map = {f.id: f.name for f in files}

    saved_questions_res: List[QuizQuestionResponse] = []
    for rq in raw_questions:
        matched_chunk = chunk_map.get(rq.source_chunk_id)
        if not matched_chunk and chunks:
            matched_chunk = chunks[0]

        source_chunk_id = matched_chunk.id if matched_chunk else None
        file_id = matched_chunk.file_id if matched_chunk else None
        file_name = file_map.get(matched_chunk.file_id) if matched_chunk else None
        page_or_slide = matched_chunk.page_or_slide if matched_chunk else 1

        q_obj = QuizQuestion(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            topic_id=topic.id if topic else None,
            question=rq.question.strip(),
            options=rq.options,
            answer_index=rq.answer_index,
            explanation=rq.explanation.strip(),
            source_chunk_id=source_chunk_id,
        )
        db.add(q_obj)

        saved_questions_res.append(
            QuizQuestionResponse(
                id=q_obj.id,
                workspace_id=workspace_id,
                topic_id=topic.id if topic else None,
                topic_name=topic.name if topic else None,
                question=q_obj.question,
                options=q_obj.options,
                answer_index=q_obj.answer_index,
                explanation=q_obj.explanation,
                source_chunk_id=source_chunk_id,
                file_id=file_id,
                file_name=file_name,
                page_or_slide=page_or_slide,
                quote=rq.quote,
                answered=False,
                user_answer=None,
                is_correct=None,
            )
        )

    db.commit()

    return QuizGenerateResponse(
        workspace_id=workspace_id,
        topic_id=topic_id,
        count=len(saved_questions_res),
        questions=saved_questions_res,
        status="success",
    )


def submit_quiz_answer(
    workspace_id: str,
    question_id: str,
    selected_index: int,
    db: Session,
) -> QuizAnswerResponse:
    """Submit an answer to a question, update attempts and recalculate topic mastery."""
    question = (
        db.query(QuizQuestion)
        .filter(QuizQuestion.id == question_id, QuizQuestion.workspace_id == workspace_id)
        .first()
    )
    if not question:
        raise ValueError(f"Question '{question_id}' not found in workspace.")

    is_correct = bool(selected_index == question.answer_index)

    # Save attempt
    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        question_id=question.id,
        correct=is_correct,
    )
    db.add(attempt)
    db.commit()

    # Recalculate mastery and priority score for this topic
    updated_mastery = 0.0
    updated_priority = 0.0
    topic = None

    if question.topic_id:
        topic = db.query(Topic).filter(Topic.id == question.topic_id).first()
        if topic:
            # Query all attempts for questions belonging to this topic
            topic_question_ids = [
                q.id
                for q in db.query(QuizQuestion.id)
                .filter(QuizQuestion.topic_id == topic.id)
                .all()
            ]

            attempts = (
                db.query(QuizAttempt)
                .filter(QuizAttempt.question_id.in_(topic_question_ids))
                .all()
            )

            if attempts:
                correct_count = sum(1 for a in attempts if a.correct)
                updated_mastery = round(correct_count / len(attempts), 2)
                topic.mastery = updated_mastery

                # Adjust priority_score by (1 - mastery)
                from app.services.exam import compute_priority_score
                topic.priority_score = compute_priority_score(
                    syllabus_weight=topic.syllabus_weight,
                    frequency=topic.past_paper_frequency,
                    avg_marks=topic.avg_marks,
                    max_freq=topic.past_paper_frequency,
                    max_marks=topic.avg_marks,
                    mastery=updated_mastery,
                )
                updated_priority = topic.priority_score
                db.commit()

    # Citation mapping
    citation = None
    if question.source_chunk_id:
        chunk = db.query(Chunk).filter(Chunk.id == question.source_chunk_id).first()
        if chunk:
            file_rec = db.query(File).filter(File.id == chunk.file_id).first()
            citation = {
                "file_name": file_rec.name if file_rec else "Document",
                "page_or_slide": chunk.page_or_slide,
                "snippet": chunk.text[:200],
            }

    return QuizAnswerResponse(
        question_id=question.id,
        correct=is_correct,
        selected_index=selected_index,
        correct_index=question.answer_index,
        explanation=question.explanation,
        topic_id=question.topic_id,
        topic_mastery=updated_mastery,
        priority_score=updated_priority,
        citation=citation,
    )


def get_quiz_progress(workspace_id: str, db: Session) -> QuizProgressResponse:
    """Retrieve overall quiz stats and topic mastery for workspace."""
    questions = (
        db.query(QuizQuestion)
        .filter(QuizQuestion.workspace_id == workspace_id)
        .all()
    )
    if not questions:
        return QuizProgressResponse(workspace_id=workspace_id)

    q_ids = [q.id for q in questions]
    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.question_id.in_(q_ids))
        .all()
    )

    total_attempts = len(attempts)
    correct_attempts = sum(1 for a in attempts if a.correct)
    accuracy = round((correct_attempts / total_attempts) * 100.0, 1) if total_attempts > 0 else 0.0

    topics = db.query(Topic).filter(Topic.workspace_id == workspace_id).all()
    topic_mastery = {t.name: round(t.mastery * 100.0, 1) for t in topics}

    return QuizProgressResponse(
        workspace_id=workspace_id,
        total_questions=len(questions),
        total_attempts=total_attempts,
        correct_attempts=correct_attempts,
        accuracy=accuracy,
        topic_mastery=topic_mastery,
    )
