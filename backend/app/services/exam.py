"""Exam Radar service: syllabus topic extraction, past paper grounded frequency analysis,
priority scoring, and day-wise study schedule generation.

Implements Section 9.5 and Section 8 of PROJECT_SPEC.md:
- Extract syllabus topics from documents (role='syllabus' or ready docs).
- Analyze past papers (role='past_paper') for question frequency and marks grounded strictly in evidence.
- Priority score formula: priority_score = 0.5 * norm_freq + 0.3 * norm_marks + 0.2 * syllabus_weight, adjusted by (1 - mastery).
- Never invent past-paper trends or claim a topic is important without supporting evidence.
- Day-wise schedule backward from exam date with actionable daily tasks.
"""

import os
import uuid
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session
from sqlalchemy import delete

from app.config import settings
from app.models import Workspace, File, Chunk, Topic, PlanDay
from app.schemas import (
    TopicResponse,
    PlanTask,
    PlanDayResponse,
    ExamPlanResponse,
)


class RawSyllabusTopic(BaseModel):
    """Raw extracted syllabus topic from Gemini."""
    name: str = Field(..., description="Topic or module name")
    syllabus_weight: float = Field(default=1.0, description="Relative weight or estimated importance (0.5 to 5.0)")
    description: str = Field(default="", description="Brief overview of concepts covered")
    source_page: int = Field(default=1, description="Source page number where topic is found")


class RawPastPaperQuestion(BaseModel):
    """Raw extracted past exam question mapped to a topic."""
    question_snippet: str = Field(..., description="Short excerpt of the exam question")
    marks: float = Field(default=5.0, description="Mark allocation stated in text")
    matched_topic_name: Optional[str] = Field(None, description="Exact matching topic name from syllabus topics")
    evidence_quote: str = Field(default="", description="Verbatim quote from text showing question and marks")


def load_prompt_template(filename: str) -> str:
    """Load prompt template from prompts directory."""
    prompt_file = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "prompts", filename
    )
    if os.path.exists(prompt_file):
        with open(prompt_file, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def extract_syllabus_topics(workspace_id: str, db: Session) -> List[RawSyllabusTopic]:
    """Extract syllabus topics using Gemini with 1 retry on invalid output."""
    # Find files tagged as syllabus, or fallback to any ready file
    syllabus_files = (
        db.query(File)
        .filter(File.workspace_id == workspace_id, File.status == "ready", File.role == "syllabus")
        .all()
    )
    if not syllabus_files:
        syllabus_files = (
            db.query(File)
            .filter(File.workspace_id == workspace_id, File.status == "ready")
            .all()
        )

    if not syllabus_files:
        return []

    # Collect chunks from syllabus files
    file_ids = [f.id for f in syllabus_files]
    chunks = (
        db.query(Chunk)
        .filter(Chunk.file_id.in_(file_ids))
        .order_by(Chunk.page_or_slide.asc(), Chunk.chunk_index.asc())
        .limit(30)
        .all()
    )
    if not chunks:
        return []

    chunk_snippets = [f"[Page {c.page_or_slide}]: {c.text}" for c in chunks]
    chunks_text = "\n\n".join(chunk_snippets)

    template = load_prompt_template("exam_topics.txt")
    if not template:
        template = "Extract academic topics from syllabus: {chunks_text}"

    prompt = template.format(
        file_name=syllabus_files[0].name,
        chunks_text=chunks_text,
    )

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not configured.")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    model_name = settings.llm_model.strip() or "gemini-3.5-flash-lite"

    # Attempt with 1 retry on validation/JSON error
    for attempt in range(2):
        try:
            resp = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=list[RawSyllabusTopic],
                    temperature=0.1 if attempt == 0 else 0.0,
                ),
            )
            topics = resp.parsed or []
            if topics:
                return topics
        except Exception as exc:
            if attempt == 1:
                raise RuntimeError(f"Failed to extract syllabus topics after retry: {exc}") from exc

    return []


def analyze_past_papers(
    workspace_id: str, topic_names: List[str], db: Session
) -> Dict[str, Dict[str, float]]:
    """Analyze past exam papers for question frequencies and marks strictly from document evidence."""
    past_paper_files = (
        db.query(File)
        .filter(
            File.workspace_id == workspace_id,
            File.status == "ready",
            (File.role == "past_paper") | (File.name.ilike("%past%")) | (File.name.ilike("%exam%")) | (File.name.ilike("%paper%")),
        )
        .all()
    )

    # Grounded rule: Never invent trends if no past papers exist
    stats: Dict[str, Dict[str, float]] = {
        name: {"frequency": 0, "avg_marks": 0.0, "total_marks": 0.0}
        for name in topic_names
    }

    if not past_paper_files:
        return stats

    file_ids = [f.id for f in past_paper_files]
    chunks = (
        db.query(Chunk)
        .filter(Chunk.file_id.in_(file_ids))
        .order_by(Chunk.page_or_slide.asc(), Chunk.chunk_index.asc())
        .limit(30)
        .all()
    )
    if not chunks:
        return stats

    chunk_snippets = [f"[Page {c.page_or_slide}]: {c.text}" for c in chunks]
    chunks_text = "\n\n".join(chunk_snippets)

    template = load_prompt_template("past_paper_questions.txt")
    if not template:
        template = "Analyze past papers for questions: {chunks_text}"

    prompt = template.format(
        topics_list=", ".join(topic_names),
        file_name=past_paper_files[0].name,
        chunks_text=chunks_text,
    )

    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return stats

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    model_name = settings.llm_model.strip() or "gemini-3.5-flash-lite"

    try:
        resp = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[RawPastPaperQuestion],
                temperature=0.1,
            ),
        )
        questions: List[RawPastPaperQuestion] = resp.parsed or []

        for q in questions:
            tname = q.matched_topic_name
            if tname and tname in stats:
                stats[tname]["frequency"] += 1
                stats[tname]["total_marks"] += float(q.marks)

        for name, data in stats.items():
            if data["frequency"] > 0:
                data["avg_marks"] = round(data["total_marks"] / data["frequency"], 1)

    except Exception:
        # If past paper analysis fails, fallback gracefully without hallucinated stats
        pass

    return stats


def compute_priority_score(
    syllabus_weight: float,
    frequency: int,
    avg_marks: float,
    max_freq: int,
    max_marks: float,
    mastery: float = 0.0,
) -> float:
    """Compute priority score per Section 9.5:

    priority_score = (0.5 * norm_freq + 0.3 * norm_marks + 0.2 * syllabus_weight) * (1 - mastery)
    """
    norm_freq = (frequency / max_freq) if max_freq > 0 else 0.0
    norm_marks = (avg_marks / max_marks) if max_marks > 0 else 0.0
    # Normalize syllabus weight (assumed 0.5 to 5.0)
    norm_weight = min(max(syllabus_weight / 5.0, 0.1), 1.0)

    if max_freq > 0 or max_marks > 0:
        base_score = 0.5 * norm_freq + 0.3 * norm_marks + 0.2 * norm_weight
    else:
        # Fallback to syllabus weight when no past papers exist
        base_score = norm_weight

    score = base_score * (1.0 - mastery)
    return round(score * 100.0, 1)


def build_exam_plan(
    workspace_id: str, exam_date_str: str, hours_per_day: float, db: Session
) -> ExamPlanResponse:
    """Build or regenerate topics, priorities, and day-wise study plan."""
    # 1. Extract syllabus topics
    raw_topics = extract_syllabus_topics(workspace_id, db)
    if not raw_topics:
        return ExamPlanResponse(
            workspace_id=workspace_id,
            exam_date=exam_date_str,
            hours_per_day=hours_per_day,
            total_topics=0,
            topics=[],
            days=[],
            status="empty",
        )

    topic_names = [t.name for t in raw_topics]

    # 2. Analyze past papers grounded in evidence
    past_stats = analyze_past_papers(workspace_id, topic_names, db)

    max_freq = max([s["frequency"] for s in past_stats.values()], default=0)
    max_marks = max([s["avg_marks"] for s in past_stats.values()], default=0.0)

    # 3. Clear existing topics and plan days for this workspace
    db.query(PlanDay).filter(PlanDay.workspace_id == workspace_id).delete()
    db.query(Topic).filter(Topic.workspace_id == workspace_id).delete()
    db.commit()

    # 4. Save topics to database with priority scores
    saved_topics: List[Topic] = []
    for rt in raw_topics:
        stat = past_stats.get(rt.name, {"frequency": 0, "avg_marks": 0.0})
        freq = int(stat["frequency"])
        avg_m = float(stat["avg_marks"])

        score = compute_priority_score(
            syllabus_weight=rt.syllabus_weight,
            frequency=freq,
            avg_marks=avg_m,
            max_freq=max_freq,
            max_marks=max_marks,
            mastery=0.0,
        )

        t_obj = Topic(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            name=rt.name,
            syllabus_weight=rt.syllabus_weight,
            past_paper_frequency=freq,
            avg_marks=avg_m,
            priority_score=score,
            mastery=0.0,
        )
        db.add(t_obj)
        saved_topics.append(t_obj)

    db.commit()

    # Sort topics by priority score descending
    saved_topics.sort(key=lambda t: t.priority_score, reverse=True)

    # 5. Generate Day-wise Study Schedule
    days_response: List[PlanDayResponse] = []
    try:
        target_exam_dt = datetime.strptime(exam_date_str, "%Y-%m-%d").date()
    except Exception:
        target_exam_dt = date.today() + timedelta(days=14)

    today = date.today()
    days_count = (target_exam_dt - today).days
    if days_count <= 0:
        days_count = 7
    # Cap plan days between 3 and 30 days
    days_count = min(max(days_count, 3), 30)

    daily_minutes = int(hours_per_day * 60)
    topics_count = len(saved_topics)

    for day_idx in range(days_count):
        curr_day = today + timedelta(days=day_idx)
        curr_date_str = curr_day.strftime("%Y-%m-%d")

        # Assign 1 or 2 focus topics for the day cyclically prioritized by score
        t1 = saved_topics[day_idx % topics_count]
        day_topic_ids = [t1.id]
        assigned_topics = [t1]

        if topics_count > 1 and daily_minutes >= 60:
            t2 = saved_topics[(day_idx + 1) % topics_count]
            if t2.id != t1.id:
                day_topic_ids.append(t2.id)
                assigned_topics.append(t2)

        mins_per_topic = daily_minutes // len(assigned_topics)

        tasks = []
        for at in assigned_topics:
            if day_idx < days_count - 2:
                task_desc = f"Master fundamental principles, definitions, and equations of {at.name}"
            else:
                task_desc = f"Final revision, rapid-fire formula recall, and practice questions for {at.name}"

            tasks.append(
                PlanTask(
                    topic_id=at.id,
                    topic_name=at.name,
                    task_description=task_desc,
                    minutes=mins_per_topic,
                )
            )

        plan_day_obj = PlanDay(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            date=curr_date_str,
            topic_ids=day_topic_ids,
            minutes=daily_minutes,
        )
        db.add(plan_day_obj)

        days_response.append(
            PlanDayResponse(
                id=plan_day_obj.id,
                workspace_id=workspace_id,
                date=curr_date_str,
                topic_ids=day_topic_ids,
                minutes=daily_minutes,
                tasks=tasks,
            )
        )

    db.commit()

    # Format TopicResponse list
    topics_res = []
    for t in saved_topics:
        level = "high" if t.priority_score >= 60 else ("medium" if t.priority_score >= 35 else "low")
        topics_res.append(
            TopicResponse(
                id=t.id,
                workspace_id=t.workspace_id,
                name=t.name,
                syllabus_weight=t.syllabus_weight,
                past_paper_frequency=t.past_paper_frequency,
                avg_marks=t.avg_marks,
                priority_score=t.priority_score,
                mastery=t.mastery,
                priority_level=level,
            )
        )

    return ExamPlanResponse(
        workspace_id=workspace_id,
        exam_date=exam_date_str,
        hours_per_day=hours_per_day,
        total_topics=len(topics_res),
        topics=topics_res,
        days=days_response,
        status="ready",
    )


def get_exam_plan(workspace_id: str, db: Session) -> ExamPlanResponse:
    """Retrieve existing exam plan and topics for workspace."""
    topics = (
        db.query(Topic)
        .filter(Topic.workspace_id == workspace_id)
        .order_by(Topic.priority_score.desc())
        .all()
    )

    plan_days = (
        db.query(PlanDay)
        .filter(PlanDay.workspace_id == workspace_id)
        .order_by(PlanDay.date.asc())
        .all()
    )

    if not topics:
        return ExamPlanResponse(
            workspace_id=workspace_id,
            exam_date=None,
            hours_per_day=None,
            total_topics=0,
            topics=[],
            days=[],
            status="empty",
        )

    topic_map = {t.id: t for t in topics}

    topics_res = []
    for t in topics:
        level = "high" if t.priority_score >= 60 else ("medium" if t.priority_score >= 35 else "low")
        topics_res.append(
            TopicResponse(
                id=t.id,
                workspace_id=t.workspace_id,
                name=t.name,
                syllabus_weight=t.syllabus_weight,
                past_paper_frequency=t.past_paper_frequency,
                avg_marks=t.avg_marks,
                priority_score=t.priority_score,
                mastery=t.mastery,
                priority_level=level,
            )
        )

    days_res = []
    for pd in plan_days:
        assigned_topics = [topic_map[tid] for tid in pd.topic_ids if tid in topic_map]
        mins_per_topic = (pd.minutes // len(assigned_topics)) if assigned_topics else pd.minutes
        tasks = [
            PlanTask(
                topic_id=at.id,
                topic_name=at.name,
                task_description=f"Focused study and practice problem solving for {at.name}",
                minutes=mins_per_topic,
            )
            for at in assigned_topics
        ]
        days_res.append(
            PlanDayResponse(
                id=pd.id,
                workspace_id=pd.workspace_id,
                date=pd.date,
                topic_ids=pd.topic_ids,
                minutes=pd.minutes,
                tasks=tasks,
            )
        )

    first_date = plan_days[0].date if plan_days else None
    last_date = plan_days[-1].date if plan_days else None
    daily_hours = round(plan_days[0].minutes / 60.0, 1) if plan_days else 2.0

    return ExamPlanResponse(
        workspace_id=workspace_id,
        exam_date=last_date,
        hours_per_day=daily_hours,
        total_topics=len(topics_res),
        topics=topics_res,
        days=days_res,
        status="ready",
    )
