"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  UploadCloud,
  BookOpen,
  MessageSquare,
  CheckSquare,
  Target,
  ArrowRight,
  ShieldCheck,
  FileText,
  FileCheck2,
  Lock,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Layers,
  Clock,
  AlertCircle,
  RotateCw,
  Plus,
  HelpCircle,
  Award,
} from "lucide-react";
import { fetchFiles, FileItem, API_BASE_URL } from "@/lib/api";
import { getOrCreateWorkspaceId } from "@/lib/workspace";

function getSourceTypeDotClass(type: string) {
  switch (type.toLowerCase()) {
    case "pdf":
      return "bg-[#2457D6]";
    case "pptx":
    case "ppt":
      return "bg-[#B7791F]";
    case "docx":
    case "doc":
      return "bg-[#5D4991]";
    default:
      return "bg-[#16805D]";
  }
}

export default function HomePage() {
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const ws = getOrCreateWorkspaceId();
    setWorkspaceId(ws);
    loadFiles(ws);
  }, []);

  const loadFiles = async (ws: string) => {
    setLoading(true);
    const res = await fetchFiles(ws);
    if (res.ok && res.data) {
      setFiles(res.data);
    }
    setLoading(false);
  };

  const readyFiles = files.filter((f) => f.status === "ready");
  const totalPages = readyFiles.reduce((acc, f) => acc + (f.page_count || 1), 0);

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 py-6 max-w-6xl w-full mx-auto space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#D8E1EE] pb-5 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-[3px]" aria-hidden="true">
              <span className="size-[8px] rounded-[2px] bg-[#2457D6]" />
              <span className="size-[8px] rounded-[2px] bg-[#B7791F]" />
              <span className="size-[8px] rounded-[2px] bg-[#16805D]" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[#17243B]">
              Document Workspace
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#E8F0FF] border border-[#D4E4FC] px-2 py-0.5 text-xs font-mono text-[#2457D6] ml-1">
              <span className={`w-1.5 h-1.5 rounded-full ${readyFiles.length > 0 ? "bg-[#16805D]" : "bg-[#B7791F]"}`} />
              <span>ws:{workspaceId ? workspaceId.slice(0, 8) : "active"}</span>
            </span>
          </div>
          <p className="text-xs md:text-sm text-[#5B6880] max-w-2xl leading-relaxed">
            Multi-document research and academic intelligence workspace. Ingest course files to generate cited answers, structured notes, conflict-aware action boards, and study plans.
          </p>
        </div>

        {/* Quick Top Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#2457D6] hover:bg-[#1947B8] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Document</span>
          </Link>

          <Link
            href="/ask"
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D8E1EE] bg-white px-3.5 py-2 text-xs font-medium text-[#17243B] hover:bg-[#F7F9FD] shadow-xs transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#2457D6]" />
            <span>Research Notebook</span>
          </Link>
        </div>
      </div>

      {/* Workspace Status & Active Documents Hub */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-[3px] rounded-full bg-[#2457D6]" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.13em] text-[#5B6880]">
              Active Documents
            </h2>
            <span className="text-xs text-[#78869B]">
              ({readyFiles.length} indexed, {totalPages} total pages)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadFiles(workspaceId)}
              className="inline-flex items-center gap-1 text-[11px] text-[#5B6880] hover:text-[#17243B] transition cursor-pointer"
              title="Refresh workspace files"
            >
              <RotateCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
            <Link
              href="/upload"
              className="text-xs font-medium text-[#2457D6] hover:underline transition ml-2"
            >
              Manage all &rarr;
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="p-8 border border-[#D8E1EE] bg-white rounded-[6px] text-center space-y-2 shadow-xs">
            <div className="w-6 h-6 border-2 border-[#2457D6] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#5B6880]">Scanning workspace documents...</p>
          </div>
        ) : files.length === 0 ? (
          /* Empty Workspace Onboarding */
          <div className="p-8 sm:p-10 border border-dashed border-[#D8E1EE] bg-white rounded-[6px] text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#E8F0FF] text-[#2457D6] flex items-center justify-center mx-auto shadow-xs">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-sm font-semibold text-[#17243B]">
                Your workspace is empty
              </h3>
              <p className="text-xs text-[#5B6880] leading-relaxed">
                Upload your course syllabus, lecture slides, assignments, or past exam papers. ClearDesk will parse them with strict page boundaries and generate grounded insights.
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[6px] bg-[#2457D6] hover:bg-[#1947B8] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload First Document</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Real Document Table */
          <div className="overflow-hidden rounded-[6px] border border-[#D8E1EE] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F7F9FD] border-b border-[#D8E1EE] text-[11px] font-semibold uppercase tracking-wider text-[#5B6880]">
                  <tr>
                    <th className="py-2.5 px-4">Document</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4">Size & Pages</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E1EE]">
                  {files.map((file) => {
                    const isReady = file.status === "ready";
                    return (
                      <tr key={file.id} className="hover:bg-[#F7F9FD] transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 max-w-xs sm:max-w-md truncate">
                            <span
                              aria-hidden
                              className={`h-2 w-2 shrink-0 rounded-full ${getSourceTypeDotClass(file.type)}`}
                            />
                            <span className="font-medium text-[#17243B] truncate" title={file.name}>
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-medium uppercase tracking-wider bg-[#F7F9FD] text-[#5B6880] border border-[#D8E1EE]">
                            {file.role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-[#5B6880]">
                          {formatFileSize(file.file_size)} • {file.page_count} pgs
                        </td>
                        <td className="py-3 px-4">
                          {isReady ? (
                            <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#EAF6F1] px-2 py-0.5 text-[10.5px] font-medium text-[#16805D] border border-[#16805D]/20">
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#FEF8E7] px-2 py-0.5 text-[10.5px] font-medium text-[#B7791F] border border-[#B7791F]/20">
                              <span className="w-1 h-1 rounded-full bg-[#B7791F] animate-ping" />
                              {file.status}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/notes?file_id=${file.id}`}
                              className="text-[11px] font-medium text-[#2457D6] hover:underline"
                            >
                              Notes
                            </Link>
                            <Link
                              href="/ask"
                              className="text-[11px] font-medium text-[#2457D6] hover:underline"
                            >
                              Query
                            </Link>
                            <a
                              href={`${API_BASE_URL}/files/${file.id}/content`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#5B6880] hover:text-[#17243B] transition"
                            >
                              View
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Intelligence Workflows Hub */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-[3px] rounded-full bg-[#2457D6]" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.13em] text-[#5B6880]">
              Workspace Intelligence Tools
            </h2>
          </div>
          <span className="text-xs text-[#78869B]">Grounded in your files</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ask AI */}
          <Link
            href="/ask"
            className="group p-4 bg-white rounded-[6px] border border-[#D8E1EE] hover:border-[#C4D0E0] hover:shadow-[0_4px_12px_rgba(23,36,59,0.08)] shadow-xs transition flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FF] flex items-center justify-center text-[#2457D6]">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#17243B] group-hover:text-[#2457D6] transition">
                  Cited Research Q&A
                </h3>
                <p className="text-[11px] text-[#5B6880] mt-1 leading-relaxed">
                  Ask questions across all indexed files. Every response has verbatim citations and page jumps.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#D8E1EE] flex items-center justify-between text-[11px] font-medium text-[#2457D6]">
              <span>Open Research</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* 3-Level Notes */}
          <Link
            href="/notes"
            className="group p-4 bg-white rounded-[6px] border border-[#D8E1EE] hover:border-[#C4D0E0] hover:shadow-[0_4px_12px_rgba(23,36,59,0.08)] shadow-xs transition flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FF] flex items-center justify-center text-[#2457D6]">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#17243B] group-hover:text-[#2457D6] transition">
                  3-Level AI Notes
                </h3>
                <p className="text-[11px] text-[#5B6880] mt-1 leading-relaxed">
                  Keywords, one-line summaries, and deep principles with Hindi/Telugu translation and 1-Page PDF export.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#D8E1EE] flex items-center justify-between text-[11px] font-medium text-[#2457D6]">
              <span>Read Notes</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Action Board */}
          <Link
            href="/action-board"
            className="group p-4 bg-white rounded-[6px] border border-[#D8E1EE] hover:border-[#C4D0E0] hover:shadow-[0_4px_12px_rgba(23,36,59,0.08)] shadow-xs transition flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FF] flex items-center justify-center text-[#2457D6]">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#17243B] group-hover:text-[#2457D6] transition">
                  Action & Conflicts
                </h3>
                <p className="text-[11px] text-[#5B6880] mt-1 leading-relaxed">
                  Automated deadline extraction with cross-document conflict alerts and .ics calendar sync.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#D8E1EE] flex items-center justify-between text-[11px] font-medium text-[#2457D6]">
              <span>View Deadlines</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>

          {/* Exam Radar */}
          <Link
            href="/exam-radar"
            className="group p-4 bg-white rounded-[6px] border border-[#D8E1EE] hover:border-[#C4D0E0] hover:shadow-[0_4px_12px_rgba(23,36,59,0.08)] shadow-xs transition flex flex-col justify-between"
          >
            <div className="space-y-2.5">
              <div className="w-8 h-8 rounded-full bg-[#E8F0FF] flex items-center justify-center text-[#2457D6]">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#17243B] group-hover:text-[#2457D6] transition">
                  Exam Radar Planner
                </h3>
                <p className="text-[11px] text-[#5B6880] mt-1 leading-relaxed">
                  Synthesize syllabus topic weights and past exam questions to build an actionable daily revision plan.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#D8E1EE] flex items-center justify-between text-[11px] font-medium text-[#2457D6]">
              <span>Build Schedule</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* Trust & Architecture Principles */}
      <section className="pt-2">
        <div className="rounded-[6px] border border-[#D8E1EE] bg-white p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[#EAF6F1] flex items-center justify-center text-[#16805D] shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[#17243B]">Zero Hallucination Refusal</h4>
              <p className="text-[11px] text-[#5B6880] mt-0.5 leading-relaxed">
                If facts cannot be proven with high confidence from retrieved chunks, ClearDesk explicitly returns &quot;Not found in your files&quot;.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[#E8F0FF] flex items-center justify-center text-[#2457D6] shrink-0 mt-0.5">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[#17243B]">Verbatim Page Evidence</h4>
              <p className="text-[11px] text-[#5B6880] mt-0.5 leading-relaxed">
                Every answer, note section, and quiz question preserves exact document page references with inspectable source excerpts.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[#F7F9FD] border border-[#D8E1EE] flex items-center justify-center text-[#5B6880] shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-[#17243B]">Isolated Session Privacy</h4>
              <p className="text-[11px] text-[#5B6880] mt-0.5 leading-relaxed">
                Files, SQLite records, and ChromaDB embeddings remain isolated to your session. Resetting workspace permanently clears all records.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
