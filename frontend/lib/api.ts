/**
 * API client configuration and health check utilities for ClearDesk.
 */

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

export interface HealthCheckResponse {
  status: string;
  database: string;
  version: string;
  timestamp: string;
}

export interface ApiError {
  error: boolean;
  message: string;
  detail?: unknown;
}

/**
 * Fetch health status from the backend API.
 */
export async function checkBackendHealth(): Promise<{
  ok: boolean;
  data?: HealthCheckResponse;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Short timeout so UI doesn't hang if backend is down
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const data: HealthCheckResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unable to reach backend server";
    return { ok: false, error: message };
  }
}

export interface FileItem {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  role: string;
  page_count: number;
  file_size: number;
  status: "processing" | "ready" | "failed";
  error_message?: string | null;
  uploaded_at: string;
}

/**
 * Fetch files for the given workspace.
 */
export async function fetchFiles(workspaceId: string): Promise<{
  ok: boolean;
  data?: FileItem[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/files`, {
      method: "GET",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to load files`,
      };
    }

    const data: FileItem[] = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error loading files";
    return { ok: false, error: message };
  }
}

/**
 * Upload one or more files with a specified role.
 */
export async function uploadFiles(
  files: File[],
  role: string,
  workspaceId: string
): Promise<{
  ok: boolean;
  data?: FileItem[];
  error?: string;
}> {
  try {
    const formData = new FormData();
    for (const f of files) {
      formData.append("files", f);
    }
    formData.append("role", role);

    const res = await fetch(`${API_BASE_URL}/files`, {
      method: "POST",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: File upload failed`,
      };
    }

    const data: FileItem[] = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error uploading files";
    return { ok: false, error: message };
  }
}

/**
 * Delete a file by ID in the current workspace.
 */
export async function deleteFile(
  fileId: string,
  workspaceId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/files/${fileId}`, {
      method: "DELETE",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to delete file`,
      };
    }

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error deleting file";
    return { ok: false, error: message };
  }
}

export interface CitationItem {
  chunk_id: string;
  file_id: string;
  file_name: string;
  page_or_slide: number;
  snippet: string;
}

export interface AskResponse {
  answer: string;
  citations: CitationItem[];
  status: "answered" | "not_found";
}

/**
 * Ask a question grounded strictly in uploaded workspace documents.
 */
export async function askQuestion(
  question: string,
  workspaceId: string,
  language: string = "en"
): Promise<{
  ok: boolean;
  data?: AskResponse;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        question,
        language,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to process question`,
      };
    }

    const data: AskResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error contacting QA engine";
    return { ok: false, error: message };
  }
}


export interface NoteSection {
  id: string;
  file_id: string;
  section_title: string;
  level1_keywords: string[];
  level2_meaning: string;
  level3_explanation: string;
  source_pages: number[];
  language: string;
}

export interface NotesResponse {
  file_id: string;
  file_name: string;
  language: string;
  sections: NoteSection[];
}

/**
 * Fetch 3-level structured notes for a file in the requested language.
 */
export async function fetchNotes(
  fileId: string,
  workspaceId: string,
  language: string = "en"
): Promise<{
  ok: boolean;
  data?: NotesResponse;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/notes/${fileId}?lang=${encodeURIComponent(language)}`, {
      method: "GET",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to load notes`,
      };
    }

    const data: NotesResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error loading notes";
    return { ok: false, error: message };
  }
}

/**
 * Force regenerate 3-level notes for a document.
 */
export async function regenerateNotes(
  fileId: string,
  workspaceId: string,
  language: string = "en"
): Promise<{
  ok: boolean;
  data?: NotesResponse;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/notes/${fileId}/regenerate?lang=${encodeURIComponent(language)}`, {
      method: "POST",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to regenerate notes`,
      };
    }

    const data: NotesResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error regenerating notes";
    return { ok: false, error: message };
  }
}

export { API_BASE_URL };

export interface ActionItem {
  id: string;
  workspace_id: string;
  file_id?: string | null;
  file_name?: string | null;
  kind: "deadline" | "deliverable" | "missing_info";
  label: string;
  value: string;
  due_date?: string | null;
  owner?: string | null;
  page_or_slide?: number | null;
  quote?: string | null;
}

export interface ConflictItem {
  id: string;
  workspace_id: string;
  label: string;
  item_a_id: string;
  item_b_id: string;
  file_a_name?: string | null;
  file_b_name?: string | null;
  value_a?: string | null;
  value_b?: string | null;
  explanation: string;
}

export interface ActionsSummary {
  total_items: number;
  deadlines_count: number;
  deliverables_count: number;
  missing_info_count: number;
  conflicts_count: number;
}

export interface ActionsBoardResponse {
  workspace_id: string;
  items: ActionItem[];
  conflicts: ConflictItem[];
  summary: ActionsSummary;
}

/**
 * Fetch action board items and conflicts for a workspace.
 */
export async function fetchActionBoard(workspaceId: string): Promise<{
  ok: boolean;
  data?: ActionsBoardResponse;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/actions?workspace_id=${encodeURIComponent(workspaceId)}`, {
      method: "GET",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to fetch action board`,
      };
    }

    const data: ActionsBoardResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error loading action board";
    return { ok: false, error: message };
  }
}

/**
 * Force re-scan of ready documents for action items and conflict detection.
 */
export async function rescanActionBoard(workspaceId: string): Promise<{
  ok: boolean;
  data?: ActionsBoardResponse;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/actions/rescan?workspace_id=${encodeURIComponent(workspaceId)}`, {
      method: "POST",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to rescan actions`,
      };
    }

    const data: ActionsBoardResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error rescanning actions";
    return { ok: false, error: message };
  }
}

/**
 * Get direct download URL for the RFC 5545 calendar .ics file.
 */
export function getCalendarIcsUrl(workspaceId: string): string {
  return `${API_BASE_URL}/actions/calendar.ics?workspace_id=${encodeURIComponent(workspaceId)}`;
}

// --- Phase 5: Exam Radar & Quiz Mode API ---

export interface TopicItem {
  id: string;
  workspace_id: string;
  name: string;
  syllabus_weight: number;
  past_paper_frequency: number;
  avg_marks: number;
  priority_score: number;
  mastery: number;
  priority_level: "high" | "medium" | "low";
}

export interface PlanTask {
  topic_id: string;
  topic_name: string;
  task_description: string;
  minutes: number;
}

export interface PlanDay {
  id: string;
  workspace_id: string;
  date: string;
  topic_ids: string[];
  minutes: number;
  tasks: PlanTask[];
}

export interface ExamPlanResponse {
  workspace_id: string;
  exam_date?: string | null;
  hours_per_day?: number | null;
  total_topics: number;
  topics: TopicItem[];
  days: PlanDay[];
  status: "ready" | "empty";
}

export interface QuizQuestionItem {
  id: string;
  workspace_id: string;
  topic_id?: string | null;
  topic_name?: string | null;
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  source_chunk_id?: string | null;
  file_id?: string | null;
  file_name?: string | null;
  page_or_slide?: number | null;
  quote?: string | null;
  answered?: boolean;
  user_answer?: number | null;
  is_correct?: boolean | null;
}

export interface QuizGenerateResponse {
  workspace_id: string;
  topic_id?: string | null;
  count: number;
  questions: QuizQuestionItem[];
  status: "success" | "insufficient_evidence";
  message?: string | null;
}

export interface QuizAnswerResponse {
  question_id: string;
  correct: boolean;
  selected_index: number;
  correct_index: number;
  explanation: string;
  topic_id?: string | null;
  topic_mastery: number;
  priority_score: number;
  citation?: {
    file_name: string;
    page_or_slide: number;
    snippet: string;
  } | null;
}

export interface QuizProgressResponse {
  workspace_id: string;
  total_questions: number;
  total_attempts: number;
  correct_attempts: number;
  accuracy: number;
  topic_mastery: Record<string, number>;
}

export async function buildExamPlan(
  workspaceId: string,
  examDate: string,
  hoursPerDay: number = 2.0
): Promise<{ ok: boolean; data?: ExamPlanResponse; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/exam/build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        exam_date: examDate,
        hours_per_day: hoursPerDay,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to build study plan`,
      };
    }

    const data: ExamPlanResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error building exam plan";
    return { ok: false, error: message };
  }
}

export async function fetchExamPlan(
  workspaceId: string
): Promise<{ ok: boolean; data?: ExamPlanResponse; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/exam/plan`, {
      method: "GET",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to fetch exam plan`,
      };
    }

    const data: ExamPlanResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error fetching exam plan";
    return { ok: false, error: message };
  }
}

export async function generateQuiz(
  workspaceId: string,
  topicId?: string | null,
  count: number = 5,
  questionType: string = "mcq"
): Promise<{ ok: boolean; data?: QuizGenerateResponse; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/quiz/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        topic_id: topicId || null,
        count,
        question_type: questionType,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to generate quiz`,
      };
    }

    const data: QuizGenerateResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error generating quiz";
    return { ok: false, error: message };
  }
}

export async function submitQuizAnswer(
  workspaceId: string,
  questionId: string,
  selectedIndex: number
): Promise<{ ok: boolean; data?: QuizAnswerResponse; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/quiz/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-Id": workspaceId,
      },
      body: JSON.stringify({
        question_id: questionId,
        selected_index: selectedIndex,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to submit answer`,
      };
    }

    const data: QuizAnswerResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error submitting answer";
    return { ok: false, error: message };
  }
}

export async function fetchQuizProgress(
  workspaceId: string
): Promise<{ ok: boolean; data?: QuizProgressResponse; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/quiz/progress`, {
      method: "GET",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to load progress`,
      };
    }

    const data: QuizProgressResponse = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error loading quiz progress";
    return { ok: false, error: message };
  }
}

/**
 * Permanently delete entire workspace and all its data.
 */
export async function deleteWorkspace(
  workspaceId: string
): Promise<{ ok: boolean; data?: { message: string }; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/workspace`, {
      method: "DELETE",
      headers: {
        "X-Workspace-Id": workspaceId,
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      return {
        ok: false,
        error: errData?.message || `HTTP ${res.status}: Failed to delete workspace`,
      };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network error deleting workspace";
    return { ok: false, error: message };
  }
}


/**
 * Get direct download URL for the guaranteed 1-page A4 revision sheet PDF.
 */
export function getRevisionSheetUrl(fileId: string, workspaceId: string): string {
  return `${API_BASE_URL}/export/revision-sheet.pdf?file_id=${encodeURIComponent(
    fileId
  )}&workspace_id=${encodeURIComponent(workspaceId)}`;
}

