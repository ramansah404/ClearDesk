"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import {
  MessageSquare,
  FileText,
  StickyNote,
  Send,
  Loader2,
  ExternalLink,
  Bot,
  User,
  Plus,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Sparkles,
  Maximize2,
  Search,
  BookOpen,
} from "lucide-react";
import {
  askQuestion,
  fetchFiles,
  FileItem,
  CitationItem,
  API_BASE_URL,
} from "@/lib/api";
import {
  getOrCreateWorkspaceId,
  getSavedLanguage,
  LANGUAGES,
} from "@/lib/workspace";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  citations?: CitationItem[];
  timestamp: string;
}

export default function AskPage() {
  const { showToast } = useToast();
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);

  const [question, setQuestion] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Open Notebook 3-column collapse states
  const [sourcesCollapsed, setSourcesCollapsed] = useState<boolean>(false);
  const [notesCollapsed, setNotesCollapsed] = useState<boolean>(false);

  // Selected evidence excerpt in the notes column
  const [selectedCitation, setSelectedCitation] = useState<CitationItem | null>(null);

  // Mobile active column tab ("sources" | "notes" | "chat")
  const [mobileActiveTab, setMobileActiveTab] = useState<"sources" | "notes" | "chat">("chat");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadWorkspaceFiles = useCallback(async (ws: string, showLoading = true) => {
    if (!ws) return;
    if (showLoading) setLoadingFiles(true);
    const res = await fetchFiles(ws);
    if (res.ok && res.data) {
      setFiles(res.data);
    }
    if (showLoading) setLoadingFiles(false);
  }, []);

  useEffect(() => {
    const ws = getOrCreateWorkspaceId();
    setWorkspaceId(ws);
    loadWorkspaceFiles(ws, true);
  }, [loadWorkspaceFiles]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  // Background polling for files in processing state
  useEffect(() => {
    if (!workspaceId) return;
    const hasProcessing = files.some((f) => f.status === "processing");
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      loadWorkspaceFiles(workspaceId, false);
    }, 3000);

    return () => clearInterval(timer);
  }, [workspaceId, files, loadWorkspaceFiles]);

  const handleCopyAnswer = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Answer copied to clipboard.", "info");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e?: React.FormEvent, directQuery?: string) => {
    if (e) e.preventDefault();
    const query = directQuery || question;
    if (!query.trim() || isAsking) return;

    setErrorMessage(null);
    const userMsg: Message = {
      id: "u-" + Date.now(),
      role: "user",
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!directQuery) setQuestion("");
    setIsAsking(true);

    try {
      const lang = getSavedLanguage();
      const res = await askQuestion(query.trim(), workspaceId, lang);

      if (res.ok && res.data) {
        const botMsg: Message = {
          id: "b-" + Date.now(),
          role: "assistant",
          content: res.data.answer,
          status: res.data.status,
          citations: res.data.citations || [],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, botMsg]);

        // Auto-select first citation in evidence column if available
        if (res.data.citations && res.data.citations.length > 0) {
          setSelectedCitation(res.data.citations[0]);
          setNotesCollapsed(false);
        }
      } else {
        const errMsg = res.error || "Failed to generate answer from course documents.";
        setErrorMessage(errMsg);
        showToast(errMsg, "error");
      }
    } catch {
      const errMsg = "Network connection failed. Ensure backend server is running.";
      setErrorMessage(errMsg);
      showToast(errMsg, "error");
    } finally {
      setIsAsking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCitationClick = (citation: CitationItem) => {
    setSelectedCitation(citation);
    setNotesCollapsed(false);
    setMobileActiveTab("notes");
  };

  const readyFiles = files.filter((f) => f.status === "ready");
  const currentLangLabel =
    LANGUAGES.find((l) => l.code === getSavedLanguage())?.label || "English";

  const starterQueries = [
    "What are the major deliverables and submission requirements?",
    "Summarize the key concepts and theoretical principles.",
    "Are there any conflicting deadlines or date discrepancies?",
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#F3F6FB] text-[#17243B]">
      {/* Top Header / Bar */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[#D8E1EE] bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-[3px]" aria-hidden="true">
            <span className="size-[8px] rounded-[2px] bg-[#2457D6]" />
            <span className="size-[8px] rounded-[2px] bg-[#B7791F]" />
            <span className="size-[8px] rounded-[2px] bg-[#16805D]" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#17243B]">
            Research Notebook
          </span>
          <span className="rounded-[4px] border border-[#D8E1EE] bg-[#F7F9FD] px-2 py-0.5 text-[10.5px] font-mono text-[#5B6880] hidden sm:inline-block">
            {readyFiles.length} ready
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] border border-[#16805D]/20 bg-[#EAF6F1] text-[11px] font-medium text-[#16805D]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#16805D]" />
            <span>Strict Anti-Hallucination Active</span>
          </span>
          <span className="text-[11px] font-mono text-[#5B6880] rounded-[4px] border border-[#D8E1EE] bg-white px-2 py-0.5 shadow-xs">
            {currentLangLabel}
          </span>
        </div>
      </div>

      {/* Mobile Tabs Switcher */}
      <div className="lg:hidden px-4 pt-3 pb-1 flex-shrink-0">
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#EAF0F8] border border-[#D8E1EE] rounded-[6px] text-xs font-medium">
          <button
            onClick={() => setMobileActiveTab("sources")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] transition cursor-pointer ${
              mobileActiveTab === "sources" ? "bg-white text-[#2457D6] font-semibold shadow-xs" : "text-[#5B6880]"
            }`}
          >
            <FileText className="h-3.5 w-3.5 text-[#2457D6]" />
            <span>Sources</span>
          </button>
          <button
            onClick={() => setMobileActiveTab("notes")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] transition cursor-pointer ${
              mobileActiveTab === "notes" ? "bg-white text-[#2457D6] font-semibold shadow-xs" : "text-[#5B6880]"
            }`}
          >
            <StickyNote className="h-3.5 w-3.5 text-[#B7791F]" />
            <span>Evidence</span>
          </button>
          <button
            onClick={() => setMobileActiveTab("chat")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] transition cursor-pointer ${
              mobileActiveTab === "chat" ? "bg-white text-[#2457D6] font-semibold shadow-xs" : "text-[#5B6880]"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#2457D6]" />
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Main 3-Collapsible-Column Layout */}
      <div className="flex-1 p-4 lg:p-6 overflow-hidden flex flex-col min-h-0">
        <div className="flex h-full min-h-0 gap-4 lg:gap-6 flex-row transition-all duration-150">
          {/* COLUMN 1: Sources Column */}
          <div
            className={`transition-all duration-150 flex flex-col min-h-0 ${
              sourcesCollapsed
                ? "w-12 flex-shrink-0 hidden lg:flex"
                : "flex-none basis-full lg:basis-1/3 xl:basis-1/4"
            } ${mobileActiveTab === "sources" ? "flex" : "hidden lg:flex"}`}
          >
            <div className="rounded-[6px] border border-[#D8E1EE] bg-white flex flex-col h-full overflow-hidden shadow-sm">
              {/* Header */}
              <div className="p-3.5 border-b border-[#D8E1EE] flex items-center justify-between shrink-0 bg-[#F7F9FD]">
                {sourcesCollapsed ? (
                  <div className="flex items-center justify-center w-full">
                    <button
                      onClick={() => setSourcesCollapsed(false)}
                      className="rounded-[4px] p-1.5 text-[#5B6880] hover:bg-white hover:text-[#17243B] transition cursor-pointer"
                      title="Expand Sources"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#2457D6]" />
                      <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#5B6880]">
                        Sources ({readyFiles.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href="/upload"
                        className="inline-flex items-center gap-1 rounded-[4px] border border-[#D8E1EE] bg-white hover:bg-[#F7F9FD] px-2 py-1 text-[11px] font-medium text-[#17243B] transition shadow-xs"
                        title="Upload Documents"
                      >
                        <Plus className="h-3.5 w-3.5 text-[#2457D6]" />
                        <span>Add</span>
                      </Link>
                      <button
                        onClick={() => setSourcesCollapsed(true)}
                        className="hidden lg:flex rounded-[4px] p-1 text-[#5B6880] hover:bg-white hover:text-[#17243B] transition cursor-pointer"
                        title="Collapse Sources"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Body */}
              {!sourcesCollapsed && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loadingFiles ? (
                    <div className="py-12 text-center space-y-2">
                      <Loader2 className="h-5 w-5 text-[#2457D6] animate-spin mx-auto" />
                      <p className="text-xs text-[#5B6880]">Loading sources...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="py-12 text-center px-4 space-y-3">
                      <FileText className="h-8 w-8 text-[#5B6880]/40 mx-auto" />
                      <p className="text-xs font-medium text-[#17243B]">No sources indexed</p>
                      <p className="text-[11px] text-[#5B6880] leading-relaxed">
                        Upload course materials or assignments to ground answers in verified pages.
                      </p>
                      <Link
                        href="/upload"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] bg-[#2457D6] text-white text-xs font-medium hover:bg-[#1947B8] transition shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Upload First File</span>
                      </Link>
                    </div>
                  ) : (
                    files.map((file) => {
                      const isReady = file.status === "ready";
                      return (
                        <div
                          key={file.id}
                          className="p-2.5 rounded-[6px] border border-[#D8E1EE] bg-white hover:bg-[#F7F9FD] transition space-y-1.5 group relative shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                aria-hidden
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  isReady ? "bg-[#2457D6]" : "bg-[#D8E1EE] animate-pulse"
                                }`}
                              />
                              <span
                                className="text-xs font-medium text-[#17243B] truncate"
                                title={file.name}
                              >
                                {file.name}
                              </span>
                            </div>
                            <span
                              className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-medium ${
                                isReady
                                  ? "bg-[#EAF6F1] text-[#16805D] border border-[#16805D]/20"
                                  : "bg-[#F7F9FD] text-[#5B6880] border border-[#D8E1EE]"
                              }`}
                            >
                              {file.status}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10.5px] text-[#5B6880] pl-4">
                            <span className="uppercase font-mono text-[9.5px]">
                              {file.role || "general"}
                            </span>
                            <span>{file.page_count || 1} pgs</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Footer */}
              {!sourcesCollapsed && (
                <div className="p-2.5 border-t border-[#D8E1EE] bg-[#F7F9FD] text-[11px] text-[#5B6880] flex items-center justify-between shrink-0">
                  <span>{readyFiles.length} of {files.length} ready</span>
                  <button
                    onClick={() => loadWorkspaceFiles(workspaceId)}
                    className="text-[#5B6880] hover:text-[#17243B] transition cursor-pointer"
                    title="Refresh sources"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: Evidence & Notes Column */}
          <div
            className={`transition-all duration-150 flex flex-col min-h-0 ${
              notesCollapsed
                ? "w-12 flex-shrink-0 hidden lg:flex"
                : "flex-none basis-full lg:basis-1/3 xl:basis-1/4"
            } ${mobileActiveTab === "notes" ? "flex" : "hidden lg:flex"}`}
          >
            <div className="rounded-[6px] border border-[#D8E1EE] bg-white flex flex-col h-full overflow-hidden shadow-sm">
              {/* Header */}
              <div className="p-3.5 border-b border-[#D8E1EE] flex items-center justify-between shrink-0 bg-[#F7F9FD]">
                {notesCollapsed ? (
                  <div className="flex items-center justify-center w-full">
                    <button
                      onClick={() => setNotesCollapsed(false)}
                      className="rounded-[4px] p-1.5 text-[#5B6880] hover:bg-white hover:text-[#17243B] transition cursor-pointer"
                      title="Expand Evidence & Notes"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#B7791F]" />
                      <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#5B6880]">
                        Evidence & Notes
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link
                        href="/notes"
                        className="inline-flex items-center gap-1 rounded-[4px] border border-[#D8E1EE] bg-white hover:bg-[#F7F9FD] px-2 py-1 text-[11px] font-medium text-[#17243B] transition shadow-xs"
                        title="Open 3-Level Notes"
                      >
                        <StickyNote className="h-3.5 w-3.5 text-[#B7791F]" />
                        <span>3-Level Notes</span>
                      </Link>
                      <button
                        onClick={() => setNotesCollapsed(true)}
                        className="hidden lg:flex rounded-[4px] p-1 text-[#5B6880] hover:bg-white hover:text-[#17243B] transition cursor-pointer"
                        title="Collapse Evidence"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Body */}
              {!notesCollapsed && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {selectedCitation ? (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      {/* Citation header card */}
                      <div className="p-3 rounded-[6px] border border-[#D8E1EE] bg-[#F7F9FD] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#17243B] truncate max-w-[170px]">
                            {selectedCitation.file_name}
                          </span>
                          <span className="rounded-[4px] border border-[#B7791F]/30 bg-[#FEF8E7] text-[#B7791F] px-2 py-0.5 text-[10px] font-mono font-bold shrink-0">
                            p. {selectedCitation.page_or_slide}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#5B6880] font-mono truncate">
                          Chunk: {selectedCitation.chunk_id || "rag-chunk"}
                        </div>
                      </div>

                      {/* Verbatim quote box */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#78869B]">
                          Verbatim Document Evidence
                        </span>
                        <div className="p-3.5 rounded-[6px] border-l-4 border-l-[#2457D6] border-y border-r border-[#D8E1EE] bg-[#F7F9FD] text-xs text-[#17243B] leading-relaxed italic shadow-xs">
                          &ldquo;{selectedCitation.snippet}&rdquo;
                        </div>
                      </div>

                      {/* Document Viewer CTA */}
                      <a
                        href={`${API_BASE_URL}/files/${selectedCitation.file_id}/pdf?workspace_id=${workspaceId}#page=${selectedCitation.page_or_slide}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex w-full items-center justify-center gap-2 rounded-[6px] border border-[#D8E1EE] bg-white hover:bg-[#F7F9FD] text-[#17243B] py-2 text-xs font-medium transition cursor-pointer shadow-xs"
                      >
                        <span>Inspect in Document Viewer</span>
                        <ExternalLink className="h-3.5 w-3.5 text-[#5B6880]" />
                      </a>
                    </div>
                  ) : (
                    <div className="py-20 text-center px-4 space-y-2 text-[#5B6880]">
                      <BookOpen className="h-8 w-8 text-[#5B6880]/40 mx-auto" />
                      <p className="text-xs font-medium text-[#17243B]">No evidence selected</p>
                      <p className="text-[11px] text-[#5B6880] leading-relaxed">
                        Ask a question and click any numbered evidence chip to inspect its verbatim text excerpt and source page here.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              {!notesCollapsed && (
                <div className="p-2.5 border-t border-[#D8E1EE] bg-[#F7F9FD] text-[10.5px] text-[#5B6880] leading-tight shrink-0">
                  Evidence retrieved via local ChromaDB vector store.
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 3: Chat / Conversation Thread */}
          <div
            className={`transition-all duration-150 flex-1 min-w-0 flex flex-col h-full rounded-[6px] border border-[#D8E1EE] bg-white overflow-hidden shadow-sm ${
              mobileActiveTab === "chat" ? "flex" : "hidden lg:flex"
            }`}
          >
            {/* Header */}
            <div className="p-3.5 border-b border-[#D8E1EE] flex items-center justify-between shrink-0 bg-[#F7F9FD]">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#2457D6]" />
                <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#5B6880]">
                  Chat with Documents
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#5B6880]">
                <span className="hidden sm:inline">Model: Grounded Gemini 2.5 Flash</span>
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 bg-[#F7F9FD]/50">
              {messages.length === 0 && (
                <div className="max-w-2xl mx-auto py-10 space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-[#E8F0FF] flex items-center justify-center mx-auto text-[#2457D6] mb-3 shadow-xs">
                      <Bot className="h-6 w-6" />
                    </div>
                    <h2 className="text-base font-semibold text-[#17243B] tracking-tight">
                      Grounded Document Intelligence
                    </h2>
                    <p className="text-xs text-[#5B6880] max-w-md mx-auto leading-relaxed">
                      Ask questions across your syllabus, course slides, or readings. Every answer is grounded in retrieved chunks with exact page citations.
                    </p>
                  </div>

                  {readyFiles.length === 0 && !loadingFiles && (
                    <div className="p-3.5 rounded-[6px] border border-[#B7791F]/30 bg-[#FEF8E7] text-xs text-[#17243B] flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 text-[#B7791F] shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-[#17243B]">No indexed documents in active workspace</p>
                        <p className="text-[#5B6880] leading-relaxed">
                          Upload course materials to test grounded answers with real citations.
                        </p>
                        <Link
                          href="/upload"
                          className="inline-flex items-center gap-1 font-semibold text-[#2457D6] hover:underline pt-0.5"
                        >
                          Go to Document Upload &rarr;
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Starter queries */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#78869B]">
                      Suggested Prompts
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {starterQueries.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSubmit(undefined, q)}
                          className="text-left p-3 rounded-[6px] border border-[#D8E1EE] bg-white hover:bg-[#F7F9FD] text-xs font-medium text-[#17243B] transition flex items-center justify-between cursor-pointer shadow-xs hover:border-[#C4D0E0]"
                        >
                          <span>{q}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-[#5B6880]" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Message Rows */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-[#E8F0FF] flex items-center justify-center text-[#2457D6] shadow-xs">
                        <Bot className="h-4 w-4" />
                      </div>
                    </div>
                  )}

                  <div className={`flex flex-col gap-1.5 ${msg.role === "user" ? "max-w-[80%] items-end" : "max-w-[85%] items-start"}`}>
                    <span className="text-[10px] text-[#5B6880] font-mono px-1">
                      {msg.role === "user" ? "You" : "ClearDesk AI"} • {msg.timestamp}
                    </span>

                    <div
                      className={`rounded-[8px] p-4 text-xs sm:text-sm leading-relaxed space-y-3 ${
                        msg.role === "user"
                          ? "bg-[#2457D6] text-white shadow-xs"
                          : msg.status === "not_found"
                          ? "bg-[#FDF2F2] border border-[#C43D4B]/30 text-[#17243B]"
                          : "bg-white border border-[#D8E1EE] text-[#17243B] shadow-xs"
                      }`}
                    >
                      {/* Anti-Hallucination Refusal Banner */}
                      {msg.status === "not_found" && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#C43D4B] border-b border-[#C43D4B]/20 pb-2">
                          <ShieldCheck className="h-4 w-4 shrink-0" />
                          <span>Evidence Refusal • Not found in your documents</span>
                        </div>
                      )}

                      {/* Content */}
                      <div className={`whitespace-pre-wrap font-sans leading-relaxed ${msg.role === "user" ? "text-white" : "text-[#17243B]"}`}>
                        {msg.content}
                      </div>

                      {/* Grounded Citations Bar */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-2.5 border-t border-[#D8E1EE] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#5B6880] flex items-center gap-1.5">
                              <FileText className="h-3 w-3 text-[#2457D6]" />
                              <span>Citations ({msg.citations.length})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyAnswer(msg.id, msg.content)}
                              className="inline-flex items-center gap-1 text-[11px] text-[#5B6880] hover:text-[#17243B] transition cursor-pointer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="h-3 w-3 text-[#16805D]" />
                                  <span className="text-[#16805D] font-medium">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {msg.citations.map((c, i) => {
                              const isSelected = selectedCitation?.chunk_id === c.chunk_id;
                              return (
                                <button
                                  key={c.chunk_id || i}
                                  onClick={() => handleCitationClick(c)}
                                  className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-xs font-medium transition cursor-pointer ${
                                    isSelected
                                      ? "bg-[#E8F0FF] border-[#2457D6] text-[#2457D6] font-semibold ring-1 ring-[#2457D6]/30"
                                      : "bg-[#F7F9FD] border-[#D8E1EE] text-[#17243B] hover:bg-[#E8F0FF] hover:border-[#D4E4FC]"
                                  }`}
                                  title={`Inspect page ${c.page_or_slide} in ${c.file_name}`}
                                >
                                  <span className="size-4 rounded-[2px] bg-[#E8F0FF] text-[10px] font-mono font-bold flex items-center justify-center text-[#2457D6]">
                                    {i + 1}
                                  </span>
                                  <span className="truncate max-w-[130px]">{c.file_name}</span>
                                  <span className="rounded-[2px] bg-[#E8F0FF] px-1 text-[9.5px] font-mono text-[#2457D6]">
                                    p. {c.page_or_slide}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Waiting Indicator */}
              {isAsking && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-[#E8F0FF] flex items-center justify-center text-[#2457D6]">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="rounded-[6px] px-4 py-2.5 bg-white border border-[#D8E1EE] flex items-center gap-2 text-xs text-[#5B6880] shadow-xs">
                    <Loader2 className="h-3.5 w-3.5 text-[#2457D6] animate-spin" />
                    <span>Searching vectors & verifying citations...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mx-4 mb-2 p-2.5 rounded-[6px] border border-[#C43D4B]/30 bg-[#FDF2F2] text-xs text-[#C43D4B] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="font-semibold hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Chat Composer */}
            <div className="flex-shrink-0 p-4 border-t border-[#D8E1EE] bg-white space-y-2">
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    readyFiles.length > 0
                      ? "Ask questions grounded in your course materials... (Ctrl+Enter to send)"
                      : "Upload documents or type a question to test refusal..."
                  }
                  disabled={isAsking}
                  rows={2}
                  className="flex-1 min-h-[44px] max-h-[120px] resize-none rounded-[6px] border border-[#D8E1EE] bg-white px-3 py-2 text-xs sm:text-sm text-[#17243B] placeholder:text-[#78869B] focus:outline-none focus:border-[#2457D6] transition shadow-xs"
                />
                <button
                  type="submit"
                  disabled={isAsking || !question.trim()}
                  className="h-[44px] w-[44px] flex-shrink-0 rounded-[6px] bg-[#2457D6] text-white hover:bg-[#1947B8] flex items-center justify-center transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  aria-label="Send message"
                >
                  {isAsking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between text-[10.5px] text-[#5B6880] px-1">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-[#2457D6]" />
                  <span>Zero Speculation • ChromaDB Cosine RAG</span>
                </span>
                <span className="font-mono">Ctrl+Enter to send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

