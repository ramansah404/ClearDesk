# Rules for ClearDesk Development (GEMINI.md)

You are building ClearDesk, an AI-powered document intelligence workspace for students and office workers.

Follow these rules for every task and interaction:

1. **Read `PROJECT_SPEC.md` Before Every Task**: Treat `PROJECT_SPEC.md` as the single source of truth for architectural choices, data models, endpoints, and requirements.
2. **Follow the Agreed Tech Stack**:
   - **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Lucide icons, shadcn/ui patterns.
   - **Backend**: Python 3.11+, FastAPI, Uvicorn, Pydantic v2.
   - **Data**: SQLite with SQLAlchemy 2.0; ChromaDB for vector storage.
   - **AI**: Google Gemini API via official Python SDK; no LangChain or LlamaIndex.
3. **Implement One Feature at a Time**:
   - Work in small, verifiable steps.
   - Always prepare a plan and get approval before executing multi-phase changes.
   - Do not add features outside the current phase without approval.
4. **Never Hardcode Secrets**:
   - Read all API keys, model names, and configurations from environment variables (`.env`).
   - Keep `.env.example` up to date.
   - Keep model names in env vars (`LLM_MODEL`, `EMBED_MODEL`), never hardcode inline.
5. **Grounded RAG & Anti-Hallucination**:
   - Never answer questions using information not found in retrieved document chunks.
   - If supporting evidence is missing or below similarity threshold, return `"Not found in your files"`.
   - Every chunk must preserve metadata: `file_id`, `file_name`, `page_or_slide`, `chunk_index`, `text`.
6. **Strict Output Validation**:
   - All AI-generated JSON outputs must be parsed and validated with Pydantic schemas.
   - Retry once on invalid JSON response.
7. **Structured Error Handling**:
   - All backend errors must return clear, structured JSON error envelopes:
     ```json
     {
       "error": true,
       "message": "Human-readable description",
       "detail": null
     }
     ```
8. **Verify and Test After Every Phase**:
   - Run relevant tests and verify live endpoints after every phase.
   - Check both backend and frontend builds for errors.
   - Document verification steps and commands clearly.
