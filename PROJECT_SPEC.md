# ClearDesk – Build Spec for Antigravity

**Team Origin · Ideathon 2.0 · Prepared 24 Oct 2026**

This is the single source of truth for building ClearDesk. Paste it into the project root as `PROJECT_SPEC.md`, and put the rules in section 2 into `GEMINI.md` (or add them as an Antigravity Rule) so the agent follows them every time.

---

## 1. Project Snapshot

* **One line**: ClearDesk is a web app where a user uploads mixed files (PDF, PPT, Word, Excel/CSV, photos of notes) and gets keyword-first notes, cited answers that refuse to guess, an auto-filled Action Board of deadlines, and an exam-aware revision plan.

### Three Layers
1. **Understand**: 3-level notes (L1 keywords, L2 one-line meaning, L3 full explanation), mother-tongue mode (English, Hindi, Telugu; technical terms stay in English), one-page revision sheet (PDF).
2. **Trust**: Every answer carries clickable citations to the exact page or slide; if the files do not contain the answer, reply "Not found in your files"; Conflict Alert flags disagreements across files (for example two different deadlines).
3. **Act**: Action Board (deadlines, deliverables, owners, missing info) with `.ics` export; Exam Radar (syllabus + past papers, ranked topics, day-wise plan backward from exam date); quizzes that re-prioritise weak topics.

* **Target Users**: Students (especially weaker students and those who struggle with English-medium technical language) and office workers or project teams.

### Non-negotiables (judges' criteria):
1. Every answer has citations, or an explicit refusal.
2. Citations open the exact page or slide in a viewer.
3. Conflict Alert works on at least deadlines.
4. Action Board fills automatically after upload.
5. Exam Radar produces a day-wise plan.

---

## 2. Rules for the Antigravity Agent (Copy into GEMINI.md)

* You are building ClearDesk. Read `PROJECT_SPEC.md` before every task.
* Follow the stack and folder structure in `PROJECT_SPEC.md` exactly. Do not swap libraries.
* Work in small steps: one feature per task. Make a plan first, wait for approval on big changes.
* After each step, run the app or tests and show that it works before moving on.
* Never hardcode API keys. Read everything from `.env`. Keep `.env.example` updated.
* **Backend**: Python 3.11+, FastAPI, Pydantic models for every request/response, type hints.
* **Frontend**: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. No other UI libraries.
* All LLM outputs that feed code must be JSON validated with Pydantic. Retry once on invalid JSON.
* LLM answers must use ONLY retrieved chunks. If evidence is missing, return `"not_found"`.
* Every chunk keeps: `file_id`, `file_name`, `page_or_slide`, `chunk_index`, `text`.
* Keep model names in env vars (`LLM_MODEL`, `EMBED_MODEL`), never inline.
* Do not add features outside the current phase. Ask before adding dependencies.
* Write short comments and a README section for each module you create.

---

## 3. Scope: MVP versus Later

### MVP (Must Ship):
* Upload PDF, PPTX, DOCX, and images (OCR with English; Hindi and Telugu packs if time allows).
* Index into chunks with metadata, embeddings, vector search.
* Ask view: cited answers, refusal, citation click opens source viewer.
* Notes view: 3-level keyword notes per file, language toggle (English, Hindi, Telugu).
* Action Board: extracted deadlines and deliverables with `.ics` export.
* Conflict Alert for same-label values (deadline, amount) across files.
* Exam Radar: upload syllabus + past papers, ranked topics, day-wise plan.
* Revision sheet PDF export.
* Quiz mode (MCQ from user's own material).

### Later (Only if time allows):
* Excel/CSV parsing.
* Concept map (React Flow).
* Google Calendar and Classroom integration.
* Handwriting OCR improvements.
* Multi-user accounts.

---

## 4. Tech Stack (Final Decisions)

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui | Fast to scaffold, clean component ergonomics |
| **PDF Viewer for Citations** | react-pdf (pdf.js) | Jump to page number, highlight snippets |
| **Slide Viewer** | Convert PPTX to PDF on backend, render with same PDF viewer | One viewer for everything |
| **Revision Sheet Export** | Server-side PDF with reportlab (or weasyprint) | Reliable formatting |
| **Backend** | Python 3.11+ + FastAPI + Uvicorn | Best library support for parsers and AI |
| **Metadata DB** | SQLite via SQLAlchemy | Zero setup, sufficient for MVP |
| **Vector Store** | ChromaDB (persistent local folder) | Simple, embedded local vector store |
| **LLM** | Google Gemini API (Flash-class model, name in `LLM_MODEL`) | Free tier, long context, strong multilingual support |
| **Embeddings** | Gemini embedding model (name in `EMBED_MODEL`) | Same API key |
| **Orchestration** | Plain Python with Google GenAI SDK (no LangChain/LlamaIndex) | Fewer abstractions, easier to debug and control |
| **PDF Parsing** | PyMuPDF (`pymupdf`) | Fast text extraction with exact page numbers |
| **PPTX Parsing** | `python-pptx` | Slide text and speaker notes |
| **DOCX Parsing** | `python-docx` | Paragraphs and headings |
| **OCR** | Tesseract via `pytesseract` + `Pillow` (eng+hin+tel) | Local OCR pipeline |
| **Dates** | `dateparser` | Validates LLM-extracted dates |
| **Calendar** | `ics` library | `.ics` export |
| **PPTX/DOCX to PDF** | LibreOffice headless (`soffice --headless --convert-to pdf`) | Source viewer alignment |
| **Deployment** | Vercel (frontend), Render with Docker (backend) | Standard hosting |
| **Version Control** | GitHub | Git tracking |

---

## 5. Architecture & Session Model

```text
[Next.js UI] --HTTP/JSON--> [FastAPI]
                              |-- parsers (pymupdf / pptx / docx / OCR)
                              |-- chunker + embedder --> [ChromaDB]
                              |-- LLM service (Gemini) --> notes / QA / extraction / quiz / plan
                              |-- SQLite (files, chunks meta, notes, tasks, topics, quizzes)
                              '-- storage/ (uploaded files + PDF conversions)
```

**Session Model for the MVP**: Each browser gets a `workspace_id` (UUID stored in `localStorage`). All data is scoped by it via the `X-Workspace-Id` HTTP header, and a "Delete my data" button wipes it (privacy promise).

---

## 6. Repository Structure

```text
cleardesk/
  PROJECT_SPEC.md
  GEMINI.md
  README.md
  docker-compose.yml
  backend/
    app/
      main.py
      config.py              # env vars
      db.py                  # SQLAlchemy engine/session
      models.py              # ORM tables
      schemas.py             # Pydantic request/response + LLM JSON schemas
      routers/
        files.py
        ask.py
        notes.py
        actions.py
        exam.py
        quiz.py
        export.py
      services/
        parsers.py           # pdf, pptx, docx, image(OCR), xlsx
        chunker.py
        embeddings.py        # Gemini embeddings + Chroma
        llm.py               # single wrapper around Gemini calls + JSON retry
        qa.py                # retrieve + answer + verify
        notes.py             # 3-level notes + translation
        extract.py           # deadlines/tasks/missing info
        conflicts.py
        exam_radar.py
        quiz.py
        revision_sheet.py
        convert.py           # pptx/docx -> pdf
      prompts/               # one .txt per prompt
    tests/
    requirements.txt
    Dockerfile
    .env.example
  frontend/
    app/                     # routes: / (upload), /notes, /ask, /actions, /exam, /quiz
    components/              # UploadZone, SourceViewer, CitationChip, NoteCard, ...
    lib/api.ts
    package.json
  eval/
    docs/                    # 20-30 test documents
    questions.json           # ~50 Q&A with source pages
    run_eval.py
```

---

## 7. Data Model (SQLite)

* `workspace`: `id` (str), `created_at` (datetime)
* `file`: `id` (str), `workspace_id` (str), `name` (str), `type` (pdf/pptx/docx/image/xlsx), `role` (material | syllabus | past_paper | other), `pdf_path` (str, for viewer), `page_count` (int), `status` (processing | ready | failed), `uploaded_at` (datetime)
* `chunk`: `id` (str), `file_id` (str), `page_or_slide` (int), `chunk_index` (int), `text` (str), `ocr_confidence` (float, nullable). Vectors live in Chroma with the same id.
* `note`: `id` (str), `file_id` (str), `section_title` (str), `level1_keywords` (JSON list), `level2_meaning` (text), `level3_explanation` (text), `translations` (JSON: `{hi: {...}, te: {...}}`), `source_pages` (JSON list)
* `action_item`: `id` (str), `workspace_id` (str), `kind` (deadline | deliverable | missing_info), `label` (str), `value` (str), `due_date` (datetime, nullable), `owner` (str, nullable), `file_id` (str), `page_or_slide` (int), `quote` (text)
* `conflict`: `id` (str), `workspace_id` (str), `label` (str), `item_a_id` (str), `item_b_id` (str), `explanation` (text)
* `topic`: `id` (str), `workspace_id` (str), `name` (str), `syllabus_weight` (float), `past_paper_frequency` (int), `avg_marks` (float), `priority_score` (float), `mastery` (float: 0.0 to 1.0)
* `plan_day`: `id` (str), `workspace_id` (str), `date` (date/str), `topic_ids` (JSON list), `minutes` (int)
* `quiz_question`: `id` (str), `workspace_id` (str), `topic_id` (str), `question` (text), `options` (JSON list), `answer_index` (int), `explanation` (text), `source_chunk_id` (str)
* `quiz_attempt`: `id` (str), `question_id` (str), `correct` (bool), `answered_at` (datetime)

---

## 8. API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health check endpoint returning status and DB connection |
| `POST` | `/files` | Upload one or more files (multipart) with optional role. Starts background ingestion |
| `GET` | `/files` | List files with status |
| `GET` | `/files/{id}/pdf` | Serve the PDF version for the viewer |
| `DELETE` | `/workspace` | Delete all user data |
| `POST` | `/ask` | `{question, language}` returns `{answer, citations[], status}` (`answered` or `not_found`) |
| `GET` | `/notes/{file_id}?lang=en\|hi\|te` | 3-level notes |
| `POST` | `/notes/{file_id}/regenerate` | Rebuild notes |
| `GET` | `/actions` | Action items and conflicts |
| `GET` | `/actions/calendar.ics` | Calendar file download |
| `POST` | `/exam/build` | `{exam_date, hours_per_day}` builds topics and day-wise plan |
| `GET` | `/exam/plan` | Topics, priorities, day-wise plan |
| `POST` | `/quiz/generate` | `{topic_id?, count}` generate quiz questions |
| `POST` | `/quiz/answer` | Record answer and update mastery and plan |
| `GET` | `/export/revision-sheet.pdf?file_id=` | Generate and download one-page revision sheet |

*All workspace-scoped requests send an `X-Workspace-Id` header.*

---

## 9. Core Pipelines

### 9.1 Ingestion
1. Save file, create file row with status `processing`.
2. Parse by type: PDF page text with PyMuPDF; PPTX text per slide; DOCX paragraphs grouped into pseudo-pages; images through Tesseract (`eng+hin+tel`).
3. If a PDF page has almost no text (scanned), render to image and OCR it.
4. Convert PPTX/DOCX to PDF with LibreOffice for the viewer so slide 7 matches page 7.
5. Chunk: ~300 to 500 tokens, 50 overlap, never cross page/slide boundaries. Retain `file_id`, `page_or_slide`, `chunk_index`.
6. Embed in batches and store in Chroma with metadata.
7. Mark file `ready`, then trigger background notes generation, action extraction, conflict check.

### 9.2 Cited Question Answering (Trust Layer)
1. Embed question, retrieve top 6 to 8 chunks.
2. If similarity < threshold (~0.35), return `not_found` immediately.
3. Prompt LLM with numbered chunks `[C1]..[Cn]`. Answer only from them, citing chunk IDs. Return JSON: `{"not_found": bool, "claims": [{"text": str, "chunk_ids": [str]}]}`.
4. Verification pass: check each claim against cited chunks. Drop unsupported claims. If nothing remains, return `not_found`.
5. Map chunk IDs to `{file_name, page_or_slide, snippet}` for clickable UI citation chips.

### 9.3 Notes (3 Levels + Multilingual)
1. Group file into sections (by heading or page batches).
2. For each section output JSON: `level1_keywords` (5-10 terms), `level2_meaning` (one line), `level3_explanation` (full simple explanation), `source_pages`.
3. Translation: for `hi` and `te`, explain in target language but retain technical terms in English.
4. Cache notes in DB.

### 9.4 Action Extraction & Conflict Alert
1. Extract items: `{kind, label, value, date_text, owner, page_or_slide, quote}`.
2. Validate dates using `dateparser`.
3. Detect missing info mentioned in docs.
4. Conflict check: group by normalized label. When values differ across files, create a conflict explanation banner.
5. `.ics` export: one VEVENT per dated item.

### 9.5 Exam Radar
1. Syllabus + past papers tagging.
2. Extract syllabus topics and past paper questions.
3. Match questions to topics.
4. Compute `priority_score = 0.5 * norm_freq + 0.3 * norm_marks + 0.2 * syllabus_weight`, adjusted by `(1 - mastery)`.
5. Planner generates day-wise schedule backward from exam date.

### 9.6 Quiz & Revision Sheet
* MCQ generation strictly from retrieved chunks with explanations and source citations.
* One-page A4 revision sheet export color-coded by topic priority (red, amber, green).

---

## 10. Key LLM Prompts (Stored in `backend/app/prompts/`)

* `qa_answer.txt`: Strict retrieval answer prompt with chunk references.
* `qa_verify.txt`: Claim verification pass against cited chunks.
* `notes_section.txt`: 3-level keyword and explanation extractor.
* `translate_notes.txt`: Multilingual translator retaining English technical terms.
* `extract_actions.txt`: Deadline, deliverable, and missing info extractor.
* `exam_topics.txt`, `past_paper_questions.txt`, `quiz_generate.txt`.

---

## 11. UI Screens & Design Direction

* **Visual Style**: Clean, modern AI SaaS workspace. Calm light theme, crisp borders, generous whitespace, large readable text, clear visual hierarchy.
* **Layout**:
  * Left Sidebar: Upload, Notes, Ask, Action Board, Exam Radar, Quiz.
  * Top Navigation Bar: Breadcrumb/title, language selector (English, हिन्दी, తెలుగు), and "Delete my data" button.
* **Initial Pages**:
  1. **Upload**: Drag-and-drop zone, file list with status chips, role dropdown.
  2. **Notes**: File selector, section cards with 3 expandable levels, language switcher, revision sheet export.
  3. **Ask**: Chat interface, answer with citation chips, side-by-side source viewer, refusal state.
  4. **Action Board**: Kanban columns (Deadlines, Deliverables, Missing Info), conflict alerts.
  5. **Exam Radar**: Exam date & hours input, priority ranked topics, day-wise plan.
  6. **Quiz**: Interactive MCQs with instant source citations and mastery feedback.

---

## 12. Build Phases

* **Phase 0: Project Setup** *(Current)*: Project structure, docs, FastAPI `/health`, SQLite ORM models, Pydantic schemas, Next.js dashboard with sidebar and navigation pages.
* **Phase 1: Ingestion**: Parsers (PDF, PPTX, DOCX, image OCR), chunking, Chroma embeddings, Upload UI.
* **Phase 2: Ask with Citations**: QA pipeline, verification pass, PDF viewer integration.
* **Phase 3: Notes & Languages**: 3-level notes, Hindi and Telugu translation, Notes UI.
* **Phase 4: Action Board & Conflicts**: Extraction, date parsing, conflict detection, `.ics` export.
* **Phase 5: Exam Radar & Quiz**: Syllabus & past paper analysis, priority calculation, day-wise plan, quiz mode.
* **Phase 6: Revision Sheet & Polish**: One-page PDF generator, empty states, toasts, full UI responsiveness.
* **Phase 7: Evaluation & Deploy**: `run_eval.py`, Docker configuration, production deploy.
