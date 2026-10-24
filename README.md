# ClearDesk — AI Document Intelligence Workspace

> **Team Origin · Ideathon 2.0 · Single Source of Truth: [PROJECT_SPEC.md](PROJECT_SPEC.md)**

ClearDesk is an AI-powered document intelligence workspace built for students and office workers. Upload mixed lecture slides, PDFs, notes, or project briefs, and turn them into trusted, cited knowledge with zero hallucination.

---

## The Three Layers & Five Non-Negotiables

1. **Understand**: 3-level notes (L1 keywords, L2 one-line meaning, L3 full explanation), mother-tongue mode (English, Hindi, Telugu; technical terms stay in English), one-page revision sheet (PDF).
2. **Trust**: Every answer carries clickable citations to the exact page or slide; if the files do not contain the answer, reply "Not found in your files"; Conflict Alert flags disagreements across files.
3. **Act**: Action Board (deadlines, deliverables, owners, missing info) with `.ics` export; Exam Radar (syllabus + past papers, ranked topics, day-wise plan); quizzes that re-prioritize weak topics.

---

## Project Structure

```text
Clear Desk/
├── PROJECT_SPEC.md          # Full architectural build specification (Source of Truth)
├── GEMINI.md                # Development rules and anti-hallucination constraints
├── README.md                # Setup guide and instructions
├── .gitignore               # Ignored artifacts, virtualenvs, and data
├── .env.example             # Environment variable template
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI application, CORS, and structured error handlers
│   │   ├── config.py        # Pydantic Settings configuration loader
│   │   ├── db.py            # SQLite engine, session maker, and Base definition
│   │   ├── models.py        # SQLAlchemy ORM models (Workspace, File, Chunk, Notes, etc.)
│   │   ├── schemas.py       # Pydantic v2 validation & response schemas
│   │   └── routers/         # Endpoint modules
│   ├── tests/
│   │   └── test_health.py   # Automated pytest suite for /health and DB connectivity
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Backend environment variables
└── frontend/
    ├── app/                 # Next.js App Router pages (/, /upload, /notes, /ask, /action-board, /exam-radar, /quiz)
    ├── components/          # Sidebar, Navbar, DeleteDataModal, AppShell
    ├── lib/                 # API client (api.ts) and Workspace Session (workspace.ts)
    └── package.json         # Node dependencies (Next.js, TypeScript, Tailwind, Lucide)
```

---

## Getting Started (Quick Run Guide)

### 1. Backend Setup & Run

1. Open a terminal in `backend/`:
   ```bash
   cd backend
   ```
2. Create and activate a Python 3.11+ virtual environment (optional if using system Python):
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy environment configuration:
   ```bash
   copy .env.example .env
   ```
5. Run automated tests:
   ```bash
   pytest tests/
   ```
6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   * Access API docs at: `http://localhost:8000/docs`
   * Health endpoint: `http://localhost:8000/health`

---

### 2. Frontend Setup & Run

1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Status

* **GET /health**: Validates service uptime and live SQLite database connectivity.
* **Structured Error Envelope**: Standardized across all endpoints:
  ```json
  {
    "error": true,
    "message": "Human-readable description",
    "detail": null
  }
  ```
* **Privacy by Design**: Session-scoped via browser `workspace_id`, with a working "Delete My Data" confirmation workflow.
