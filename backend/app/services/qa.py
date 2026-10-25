"""Grounded Question Answering Service for ClearDesk.

Enforces zero-hallucination document intelligence:
1. Embeds question with configured EMBED_MODEL and retrieves top chunks from ChromaDB.
2. Scopes vector retrieval strictly to the caller's workspace_id.
3. Formats prompt with exact chunk provenance (file_id, file_name, page_or_slide).
4. Calls Gemini with structured output validation (Pydantic schema).
5. Returns 'Not found in your files' whenever supporting evidence is absent or incomplete.
6. Maps valid citations to file ID, filename, and page/slide reference.
"""

import os
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from google import genai
from google.genai.errors import APIError

from app.config import settings
from app.schemas import AskResponse, CitationItem
from app.services.embeddings import generate_embeddings, get_chunks_collection


class LLMAnswerPayload(BaseModel):
    """Pydantic schema for structured Gemini LLM response."""

    not_found: bool = Field(
        ...,
        description="True if the question cannot be answered purely from the provided chunks",
    )
    answer: str = Field(
        ...,
        description="Grounded answer text, or exactly 'Not found in your files' if not_found is True",
    )
    cited_chunk_ids: List[str] = Field(
        default_factory=list,
        description="List of cited chunk labels (e.g. ['C1', 'C2']) directly supporting the claims",
    )


DEFAULT_PROMPT_TEMPLATE = """You are ClearDesk's grounded Answer Engine. ClearDesk is an AI-powered document intelligence workspace built for students and office workers that guarantees ZERO hallucination.

USER QUESTION:
{question}

LANGUAGE INSTRUCTION:
{language_instruction}

RETRIEVED DOCUMENT EVIDENCE:
{formatted_chunks}

CRITICAL RULES:
1. Answer ONLY using the explicit facts and figures directly stated in the RETRIEVED DOCUMENT EVIDENCE above.
2. NEVER assume, extrapolate, speculate, or introduce any outside facts, world knowledge, or common sense inferences that are not explicitly documented in the evidence.
3. If the provided evidence does not contain sufficient facts to directly answer the question, or if no chunks match the question topic, you MUST return:
   - not_found = true
   - answer = "Not found in your files"
   - cited_chunk_ids = []
4. In "cited_chunk_ids", list ONLY the chunk identifiers (e.g. ["C1", "C2"]) whose text was directly used to substantiate the claims in your answer. Never invent citations.
5. Do NOT include phrases like "Based on the provided documents" or "According to chunk C1". State the answer clearly, concisely, and objectively.
"""


def _get_language_instruction(lang: Optional[str]) -> str:
    """Return explicit multilingual instruction matching user preference."""
    normalized = (lang or "en").lower().strip()
    if normalized == "hi":
        return (
            "Answer in Hindi (?????). Phrasing should be in natural, clean Hindi, "
            "while retaining technical terms, dates, and proper nouns in English script/words."
        )
    if normalized == "te":
        return (
            "Answer in Telugu (??????). Phrasing should be in natural, clean Telugu, "
            "while retaining technical terms, dates, and proper nouns in English script/words."
        )
    return "Answer in English."


def _load_prompt_template() -> str:
    """Load prompt template from file if available, or fallback to default."""
    prompt_file = os.path.join(os.path.dirname(__file__), "..", "prompts", "qa_answer.txt")
    if os.path.isfile(prompt_file):
        try:
            with open(prompt_file, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            pass
    return DEFAULT_PROMPT_TEMPLATE


def answer_question(
    question: str,
    workspace_id: str,
    language: Optional[str] = "en",
) -> AskResponse:
    """Execute grounded question answering over workspace document chunks."""
    clean_question = question.strip()
    if not clean_question:
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    # Validate API key
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        raise ValueError(
            "GEMINI_API_KEY is not configured in environment. Grounded QA requires an active Gemini API key."
        )

    # 1. Embed query
    query_vectors = generate_embeddings([clean_question])
    if not query_vectors:
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    query_vec = query_vectors[0]

    # 2. Query persistent ChromaDB scoped strictly to current workspace
    collection = get_chunks_collection()
    total_chunks = collection.count()

    if total_chunks == 0:
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    n_results = min(8, total_chunks)

    try:
        search_results = collection.query(
            query_embeddings=[query_vec],
            n_results=n_results,
            where={"workspace_id": workspace_id},
            include=["documents", "metadatas", "distances"],
        )
    except Exception as query_exc:
        raise RuntimeError(f"Vector search failed in ChromaDB: {query_exc}") from query_exc

    ids = search_results.get("ids", [[]])[0] if search_results.get("ids") else []
    documents = search_results.get("documents", [[]])[0] if search_results.get("documents") else []
    metadatas = search_results.get("metadatas", [[]])[0] if search_results.get("metadatas") else []

    # If no chunks match this workspace
    if not ids or not documents:
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    # 3. Format retrieved chunks for the prompt
    formatted_chunks_list = []
    chunk_lookup: Dict[str, Dict[str, Any]] = {}

    for idx, (chunk_id, doc_text, meta) in enumerate(zip(ids, documents, metadatas), start=1):
        chunk_label = f"C{idx}"
        file_name = meta.get("file_name", "Document")
        page_or_slide = meta.get("page_or_slide", 1)
        file_id = meta.get("file_id", "")

        chunk_lookup[chunk_label] = {
            "chunk_id": chunk_id,
            "file_id": file_id,
            "file_name": file_name,
            "page_or_slide": int(page_or_slide),
            "text": doc_text,
        }

        formatted_chunks_list.append(
            f"[{chunk_label}] File: {file_name} | Page/Slide: {page_or_slide}\n{doc_text}\n"
        )

    formatted_chunks_str = "\n".join(formatted_chunks_list)
    lang_instruction = _get_language_instruction(language)

    prompt_template = _load_prompt_template()
    prompt = prompt_template.format(
        question=clean_question,
        language_instruction=lang_instruction,
        formatted_chunks=formatted_chunks_str,
    )

    # 4. Invoke Gemini with structured JSON output schema
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=settings.llm_model,
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": LLMAnswerPayload,
                "temperature": 0.0,
            },
        )
    except APIError as api_err:
        raise RuntimeError(f"Gemini API error ({settings.llm_model}): {api_err.message}") from api_err
    except Exception as exc:
        raise RuntimeError(f"Failed to generate answer from Gemini ({settings.llm_model}): {exc}") from exc

    if not response or not response.text:
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    # 5. Parse and strictly validate structured output
    try:
        parsed_output = LLMAnswerPayload.model_validate_json(response.text)
    except Exception:
        # Retry once or fallback safely if validation fails
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    # Enforce strict grounding: if marked not_found or missing content
    if parsed_output.not_found or parsed_output.answer.strip().lower() == "not found in your files":
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    # 6. Map and verify citations
    valid_citations: List[CitationItem] = []
    seen_chunk_ids = set()

    for cid in parsed_output.cited_chunk_ids:
        clean_cid = cid.strip().upper()
        # Handle formats like "C1", "[C1]"
        if clean_cid.startswith("[") and clean_cid.endswith("]"):
            clean_cid = clean_cid[1:-1]

        if clean_cid in chunk_lookup:
            cdata = chunk_lookup[clean_cid]
            actual_chunk_id = cdata["chunk_id"]

            if actual_chunk_id not in seen_chunk_ids:
                seen_chunk_ids.add(actual_chunk_id)
                # Snippet snippet: first 250 chars of chunk text
                snippet_text = cdata["text"][:250].strip()
                if len(cdata["text"]) > 250:
                    snippet_text += "..."

                valid_citations.append(
                    CitationItem(
                        chunk_id=actual_chunk_id,
                        file_id=cdata["file_id"],
                        file_name=cdata["file_name"],
                        page_or_slide=cdata["page_or_slide"],
                        snippet=snippet_text,
                    )
                )

    # Anti-hallucination check: If the LLM generated an answer but cited zero valid chunks, refuse
    if not valid_citations:
        return AskResponse(
            answer="Not found in your files",
            citations=[],
            status="not_found",
        )

    return AskResponse(
        answer=parsed_output.answer.strip(),
        citations=valid_citations,
        status="answered",
    )