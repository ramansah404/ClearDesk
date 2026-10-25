"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckSquare,
  AlertTriangle,
  Calendar,
  Clock,
  FileDown,
  RefreshCw,
  FileText,
  Quote,
  CheckCircle2,
  HelpCircle,
  Loader2,
  CalendarPlus,
  ShieldAlert,
  ArrowRight,
  User,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

import {
  fetchActionBoard,
  rescanActionBoard,
  getCalendarIcsUrl,
  ActionItem,
  ConflictItem,
  ActionsBoardResponse,
  API_BASE_URL,
} from "@/lib/api";
import { getOrCreateWorkspaceId } from "@/lib/workspace";

function ActionBoardContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [boardData, setBoardData] = useState<ActionsBoardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const wsParam = searchParams.get("ws");
    const ws = getOrCreateWorkspaceId(wsParam);
    setWorkspaceId(ws);
    loadData(ws);
  }, [searchParams]);

  const loadData = async (ws: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    const res = await fetchActionBoard(ws);
    if (res.ok && res.data) {
      setBoardData(res.data);
    } else {
      setErrorMessage(res.error || "Failed to load action items.");
    }
    setIsLoading(false);
  };

  const handleRescan = async () => {
    if (!workspaceId) return;
    setIsRescanning(true);
    setErrorMessage(null);
    const res = await rescanActionBoard(workspaceId);
    if (res.ok && res.data) {
      setBoardData(res.data);
      showToast(`Rescan complete. Found ${res.data.items.length} action item(s).`, "success");
    } else {
      const errMsg = res.error || "Failed to rescan action items.";
      setErrorMessage(errMsg);
      showToast(errMsg, "error");
    }
    setIsRescanning(false);
  };

  const toggleQuote = (id: string) => {
    setExpandedQuotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDueDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const deadlines = boardData?.items.filter((it) => it.kind === "deadline") || [];
  const deliverables = boardData?.items.filter((it) => it.kind === "deliverable") || [];
  const missingInfo = boardData?.items.filter((it) => it.kind === "missing_info") || [];
  const conflicts = boardData?.conflicts || [];

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 py-6 max-w-6xl w-full mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#D8E1EE] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#C43D4B]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#17243B]">
              Action Board & Deadlines
            </h1>
            {boardData && (
              <span className="rounded-[4px] bg-[#E8F0FF] px-2 py-0.5 text-xs font-semibold text-[#2457D6] border border-[#D4E4FC]">
                {boardData.summary.total_items} items
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-[#5B6880]">
            Auto-extracted deadlines, deliverables, missing requirements, and cross-document contradiction alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRescan}
            disabled={isRescanning || isLoading}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D8E1EE] bg-white px-3 py-1.5 text-xs font-medium text-[#17243B] hover:bg-[#F7F9FD] disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#5B6880] ${isRescanning ? "animate-spin text-[#2457D6]" : ""}`} />
            <span>{isRescanning ? "Scanning..." : "Rescan Documents"}</span>
          </button>

          {workspaceId && (
            <a
              href={getCalendarIcsUrl(workspaceId)}
              download="cleardesk-actions.ics"
              onClick={() => showToast("Downloading .ics calendar schedule...", "info")}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#2457D6] hover:bg-[#1947B8] text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition cursor-pointer"
              title="Download RFC 5545 calendar file for Google Calendar, Apple Calendar, or Outlook"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Export All (.ics)</span>
            </a>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="rounded-[6px] border border-[#C43D4B]/30 bg-[#FDF2F2] p-3 text-xs text-[#C43D4B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => loadData(workspaceId)}
            className="text-xs font-semibold underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !boardData && (
        <div className="py-20 text-center space-y-2.5 rounded-[6px] border border-[#D8E1EE] bg-white shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-[#2457D6] mx-auto" />
          <p className="text-xs font-medium text-[#5B6880]">
            Analyzing uploaded documents for deadlines and actionable requirements...
          </p>
        </div>
      )}

      {/* Conflict Alert Banner */}
      {conflicts.length > 0 && (
        <div className="rounded-[6px] border border-[#C43D4B]/30 bg-[#FDF2F2] p-4 shadow-xs space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-[#C43D4B]/20 pb-2.5">
            <div className="flex items-center gap-2">
              <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#C43D4B]" />
              <div>
                <h2 className="text-xs font-bold text-[#17243B] uppercase tracking-wide">
                  Cross-Document Conflict Alert ({conflicts.length})
                </h2>
                <p className="text-[11px] text-[#5B6880]">
                  Contradictory deadlines or mutually exclusive deliverables flagged between files.
                </p>
              </div>
            </div>
            <span className="rounded-[4px] border border-[#C43D4B]/30 bg-[#C43D4B] text-white px-2 py-0.5 text-[10px] font-bold uppercase">
              Action Required
            </span>
          </div>

          <div className="space-y-2.5">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="rounded-[6px] border border-[#D8E1EE] bg-white p-3.5 text-xs shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#17243B]">{c.label}</span>
                  <span className="rounded-[4px] border border-[#C43D4B]/30 bg-[#FDF2F2] text-[#C43D4B] px-1.5 py-0.5 text-[10px] font-medium">
                    Discrepancy
                  </span>
                </div>
                <p className="text-xs text-[#5B6880] leading-relaxed font-sans">
                  {c.explanation}
                </p>
                <div className="pt-2 border-t border-[#D8E1EE] grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-[4px] bg-[#F7F9FD] p-2 border border-[#D8E1EE]">
                    <span className="font-medium text-[#17243B] block truncate">
                      {c.file_a_name || "Source Document A"}:
                    </span>
                    <span className="text-[#5B6880] font-mono text-[10.5px] block mt-0.5">{c.value_a || "N/A"}</span>
                  </div>
                  <div className="rounded-[4px] bg-[#F7F9FD] p-2 border border-[#D8E1EE]">
                    <span className="font-medium text-[#17243B] block truncate">
                      {c.file_b_name || "Source Document B"}:
                    </span>
                    <span className="text-[#5B6880] font-mono text-[10.5px] block mt-0.5">{c.value_b || "N/A"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Board Columns: Deadlines, Deliverables, Missing Info */}
      {boardData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Column 1: Deadlines */}
          <div className="rounded-[6px] border border-[#D8E1EE] bg-[#F7F9FD] p-3 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#D8E1EE] pb-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#C43D4B]" />
                <h2 className="text-xs font-semibold text-[#17243B] uppercase tracking-wider">
                  Deadlines
                </h2>
              </div>
              <span className="rounded-[4px] bg-[#FDF2F2] border border-[#C43D4B]/30 px-2 py-0.5 text-[11px] font-semibold text-[#C43D4B]">
                {deadlines.length}
              </span>
            </div>

            {deadlines.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[#D8E1EE] p-8 text-center text-xs text-[#5B6880] bg-white">
                No explicit deadlines extracted.
              </div>
            ) : (
              <div className="space-y-2.5">
                {deadlines.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[6px] border border-[#D8E1EE] bg-white p-3.5 shadow-xs space-y-2 hover:border-[#C4D0E0] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#17243B] leading-snug">
                        {item.label}
                      </span>
                      {item.due_date && (
                        <span className="rounded-[4px] bg-[#FDF2F2] border border-[#C43D4B]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#C43D4B] font-mono shrink-0">
                          {formatDueDate(item.due_date)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#5B6880] leading-relaxed font-sans">
                      {item.value}
                    </p>

                    {item.quote && (
                      <div className="text-[11px]">
                        <button
                          onClick={() => toggleQuote(item.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5B6880] hover:text-[#17243B] transition cursor-pointer"
                        >
                          <Quote className="h-3 w-3 text-[#2457D6]" />
                          <span>{expandedQuotes[item.id] ? "Hide Quote" : "View Quote"}</span>
                        </button>
                        {expandedQuotes[item.id] && (
                          <div className="mt-1 rounded-[4px] bg-[#F7F9FD] p-2 border border-[#D8E1EE] text-[#17243B] italic text-[11px]">
                            &ldquo;{item.quote}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#D8E1EE] text-[11px] text-[#5B6880]">
                      {item.file_id ? (
                        <a
                          href={`${API_BASE_URL}/files/${item.file_id}/pdf?workspace_id=${workspaceId}#page=${item.page_or_slide || 1}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate max-w-[170px] text-[#5B6880] hover:text-[#2457D6] transition"
                          title={`Open ${item.file_name || "source"} at page ${item.page_or_slide || 1}`}
                        >
                          <FileText className="h-3 w-3 text-[#5B6880] shrink-0" />
                          <span className="truncate">{item.file_name || "Document"}</span>
                          {item.page_or_slide && (
                            <span className="rounded-[2px] bg-[#F7F9FD] border border-[#D8E1EE] px-1 text-[10px] font-mono text-[#5B6880] shrink-0">
                              p.{item.page_or_slide}
                            </span>
                          )}
                        </a>
                      ) : (
                        <span className="truncate max-w-[170px] text-[#5B6880]">{item.file_name || "Document"}</span>
                      )}
                      <span className="rounded-[4px] bg-[#FDF2F2] text-[#C43D4B] font-medium px-1.5 py-0.5 text-[10px]">
                        Deadline
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Deliverables */}
          <div className="rounded-[6px] border border-[#D8E1EE] bg-[#F7F9FD] p-3 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#D8E1EE] pb-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#2457D6]" />
                <h2 className="text-xs font-semibold text-[#17243B] uppercase tracking-wider">
                  Deliverables
                </h2>
              </div>
              <span className="rounded-[4px] bg-[#E8F0FF] border border-[#D4E4FC] px-2 py-0.5 text-[11px] font-semibold text-[#2457D6]">
                {deliverables.length}
              </span>
            </div>

            {deliverables.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[#D8E1EE] p-8 text-center text-xs text-[#5B6880] bg-white">
                No deliverables detected.
              </div>
            ) : (
              <div className="space-y-2.5">
                {deliverables.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[6px] border border-[#D8E1EE] bg-white p-3.5 shadow-xs space-y-2 hover:border-[#C4D0E0] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#17243B] leading-snug">
                        {item.label}
                      </span>
                      {item.due_date && (
                        <span className="rounded-[4px] bg-[#E8F0FF] border border-[#D4E4FC] px-1.5 py-0.5 text-[10px] font-bold text-[#2457D6] font-mono shrink-0">
                          {formatDueDate(item.due_date)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-[#5B6880] leading-relaxed font-sans">
                      {item.value}
                    </p>

                    {item.quote && (
                      <div className="text-[11px]">
                        <button
                          onClick={() => toggleQuote(item.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5B6880] hover:text-[#17243B] transition cursor-pointer"
                        >
                          <Quote className="h-3 w-3 text-[#2457D6]" />
                          <span>{expandedQuotes[item.id] ? "Hide Quote" : "View Quote"}</span>
                        </button>
                        {expandedQuotes[item.id] && (
                          <div className="mt-1 rounded-[4px] bg-[#F7F9FD] p-2 border border-[#D8E1EE] text-[#17243B] italic text-[11px]">
                            &ldquo;{item.quote}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#D8E1EE] text-[11px] text-[#5B6880]">
                      {item.file_id ? (
                        <a
                          href={`${API_BASE_URL}/files/${item.file_id}/pdf?workspace_id=${workspaceId}#page=${item.page_or_slide || 1}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate max-w-[190px] text-[#5B6880] hover:text-[#2457D6] transition"
                          title={`Open ${item.file_name || "source"} at page ${item.page_or_slide || 1}`}
                        >
                          <FileText className="h-3 w-3 text-[#5B6880] shrink-0" />
                          <span className="truncate">{item.file_name || "Document"}</span>
                          {item.page_or_slide && (
                            <span className="rounded-[2px] bg-[#F7F9FD] border border-[#D8E1EE] px-1 text-[10px] font-mono text-[#5B6880] shrink-0">
                              p.{item.page_or_slide}
                            </span>
                          )}
                        </a>
                      ) : (
                        <span className="truncate max-w-[190px] text-[#5B6880]">{item.file_name || "Document"}</span>
                      )}
                      <span className="rounded-[4px] bg-[#E8F0FF] text-[#2457D6] font-medium px-1.5 py-0.5 text-[10px]">
                        Required
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 3: Missing Information */}
          <div className="rounded-[6px] border border-[#D8E1EE] bg-[#F7F9FD] p-3 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#D8E1EE] pb-2">
              <div className="flex items-center gap-1.5">
                <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#B7791F]" />
                <h2 className="text-xs font-semibold text-[#17243B] uppercase tracking-wider">
                  Missing Info
                </h2>
              </div>
              <span className="rounded-[4px] bg-[#FEF8E7] border border-[#B7791F]/30 px-2 py-0.5 text-[11px] font-semibold text-[#B7791F]">
                {missingInfo.length}
              </span>
            </div>

            {missingInfo.length === 0 ? (
              <div className="rounded-[6px] border border-dashed border-[#D8E1EE] p-8 text-center text-xs text-[#5B6880] bg-white">
                No missing requirements detected.
              </div>
            ) : (
              <div className="space-y-2.5">
                {missingInfo.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[6px] border border-[#D8E1EE] bg-white p-3.5 shadow-xs space-y-2 hover:border-[#C4D0E0] transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-[#17243B] leading-snug">
                        {item.label}
                      </span>
                      <span className="rounded-[4px] bg-[#FEF8E7] border border-[#B7791F]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[#B7791F] shrink-0">
                        Pending
                      </span>
                    </div>

                    <p className="text-xs text-[#5B6880] leading-relaxed font-sans">
                      {item.value}
                    </p>

                    {item.quote && (
                      <div className="text-[11px]">
                        <button
                          onClick={() => toggleQuote(item.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5B6880] hover:text-[#17243B] transition cursor-pointer"
                        >
                          <Quote className="h-3 w-3 text-[#2457D6]" />
                          <span>{expandedQuotes[item.id] ? "Hide Quote" : "View Quote"}</span>
                        </button>
                        {expandedQuotes[item.id] && (
                          <div className="mt-1 rounded-[4px] bg-[#F7F9FD] p-2 border border-[#D8E1EE] text-[#17243B] italic text-[11px]">
                            &ldquo;{item.quote}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#D8E1EE] text-[11px] text-[#5B6880]">
                      {item.file_id ? (
                        <a
                          href={`${API_BASE_URL}/files/${item.file_id}/pdf?workspace_id=${workspaceId}#page=${item.page_or_slide || 1}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 truncate max-w-[210px] text-[#5B6880] hover:text-[#2457D6] transition"
                          title={`Open ${item.file_name || "source"} at page ${item.page_or_slide || 1}`}
                        >
                          <FileText className="h-3 w-3 text-[#5B6880] shrink-0" />
                          <span className="truncate">{item.file_name || "Document"}</span>
                          {item.page_or_slide && (
                            <span className="rounded-[2px] bg-[#F7F9FD] border border-[#D8E1EE] px-1 text-[10px] font-mono text-[#5B6880] shrink-0">
                              p.{item.page_or_slide}
                            </span>
                          )}
                        </a>
                      ) : (
                        <span className="truncate max-w-[210px] text-[#5B6880]">{item.file_name || "Document"}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty Board State */}
      {!isLoading && (!boardData || boardData.items.length === 0) && (
        <div className="rounded-[6px] border border-[#D8E1EE] bg-white p-12 text-center space-y-2.5 shadow-sm">
          <CheckSquare className="h-8 w-8 text-[#5B6880]/40 mx-auto" />
          <h3 className="text-xs font-semibold text-[#17243B]">
            No action items extracted yet
          </h3>
          <p className="text-[11px] text-[#5B6880] max-w-sm mx-auto">
            Upload project updates, assignment briefs, or syllabi, then click Rescan Documents above to extract actionable items.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ActionBoardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#2457D6] mx-auto" />
          <p className="text-xs text-[#5B6880]">Loading action board...</p>
        </div>
      }
    >
      <ActionBoardContent />
    </Suspense>
  );
}
