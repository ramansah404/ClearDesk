"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  ExternalLink,
  BookOpen,
  Image as ImageIcon,
  Sparkles,
  X,
  FileSpreadsheet,
  File,
  Layers,
  ShieldCheck,
  Check,
  Plus,
} from "lucide-react";

import {
  FileItem,
  fetchFiles,
  uploadFiles,
  deleteFile,
  API_BASE_URL,
} from "@/lib/api";
import { getOrCreateWorkspaceId } from "@/lib/workspace";
import { useToast } from "@/components/Toast";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

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

export default function UploadPage() {
  const { showToast } = useToast();
  const [workspaceId, setWorkspaceId] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedRole, setSelectedRole] = useState("material");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const ws = getOrCreateWorkspaceId();
    setWorkspaceId(ws);
    loadFiles(ws);
  }, []);

  const loadFiles = useCallback(async (ws: string) => {
    if (!ws) return;
    const result = await fetchFiles(ws);
    if (result.ok && result.data) {
      setFiles(result.data);
    } else {
      setErrorMessage(result.error || "Failed to load files.");
    }
  }, []);

  // Poll for file status changes if any file is still processing
  useEffect(() => {
    if (!workspaceId) return;
    const hasProcessing = files.some((f) => f.status === "processing");
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      loadFiles(workspaceId);
    }, 3000);

    return () => clearInterval(timer);
  }, [workspaceId, files, loadFiles]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !workspaceId) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsUploading(true);

    const filesToUpload = Array.from(fileList);
    const result = await uploadFiles(filesToUpload, selectedRole, workspaceId);

    setIsUploading(false);
    if (result.ok && result.data) {
      setSuccessMessage(`Uploaded ${result.data.length} file(s). Ingestion pipeline active.`);
      showToast(`Uploaded ${result.data.length} file(s) successfully! Processing started.`, "success");
      loadFiles(workspaceId);
    } else {
      const errMsg = result.error || "File upload failed.";
      setErrorMessage(errMsg);
      showToast(errMsg, "error");
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete '${fileName}'?`)) return;

    const res = await deleteFile(fileId, workspaceId);
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      showToast(`Deleted '${fileName}' successfully.`, "info");
    } else {
      const errMsg = res.error || "Failed to delete file.";
      setErrorMessage(errMsg);
      showToast(errMsg, "error");
    }
  };

  const readyFiles = files.filter((f) => f.status === "ready");

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 py-6 max-w-6xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#D8E1EE] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#2457D6]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#17243B]">
              Document Sources
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#5B6880]">
            Manage course materials, syllabi, past examination papers, and lecture slides indexed in this workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadFiles(workspaceId)}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D8E1EE] bg-white px-3 py-1.5 text-xs font-medium text-[#17243B] hover:bg-[#F7F9FD] transition cursor-pointer shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#5B6880]" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#2457D6] text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[#1947B8] transition cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Source</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="rounded-[6px] border border-[#C43D4B]/30 bg-[#FDF2F2] p-3 text-xs text-[#C43D4B] flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Error: </span>
            {errorMessage}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[#C43D4B]/70 hover:text-[#C43D4B] p-0.5 rounded cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-[6px] border border-[#16805D]/30 bg-[#EAF6F1] p-3 text-xs text-[#16805D] flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-[#16805D] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Success: </span>
            {successMessage}
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-[#16805D]/70 hover:text-[#16805D] p-0.5 rounded cursor-pointer"
            aria-label="Dismiss success"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Dropzone & Role Assignment Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`rounded-[6px] border-2 border-dashed p-6 sm:p-8 text-center transition-all bg-white shadow-sm ${
          isDragging
            ? "border-[#2457D6] bg-[#E8F0FF]/30"
            : "border-[#D8E1EE] hover:border-[#2457D6] hover:bg-[#F7F9FD]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg"
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
          id="file-upload-input"
        />

        <div className="mx-auto flex max-w-lg flex-col items-center space-y-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0FF] text-[#2457D6] shadow-xs">
            <UploadCloud className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#17243B]">
              Drag & drop course documents or browse from computer
            </p>
            <p className="text-xs text-[#5B6880]">
              Supported formats: PDF, PPTX (slides & notes), DOCX, and images (PNG, JPG)
            </p>
          </div>

          {/* Role selector dropdown */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
            <span className="font-medium text-[#5B6880]">Assign Document Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="rounded-[6px] border border-[#D8E1EE] bg-white px-3 py-1.5 text-xs font-medium text-[#17243B] shadow-xs focus:border-[#2457D6] focus:outline-none"
            >
              <option value="material">General Course Material / Slides</option>
              <option value="syllabus">Syllabus & Course Outline</option>
              <option value="past_paper">Past Examination Paper</option>
              <option value="assignment">Assignment / Project Brief</option>
              <option value="notes">Personal Notes / Handwriting</option>
              <option value="other">Other Reference Document</option>
            </select>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#2457D6] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#1947B8] transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <UploadCloud className="h-4 w-4" />
            <span>{isUploading ? "Uploading & Indexing..." : "Select Files to Upload"}</span>
          </button>
        </div>
      </div>

      {/* Document Library Table */}
      <div className="rounded-[6px] border border-[#D8E1EE] bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between border-b border-[#D8E1EE] bg-[#F7F9FD] px-4 py-3">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-[3px] rounded-full bg-[#2457D6]" />
            <h2 className="font-semibold text-[#17243B] text-xs uppercase tracking-[0.13em]">
              Indexed Documents ({files.length})
            </h2>
          </div>
          <span className="text-[11px] text-[#5B6880] font-mono">
            {readyFiles.length} ready • Workspace {workspaceId.slice(0, 8)}
          </span>
        </div>

        {files.length === 0 ? (
          <div className="py-16 text-center text-[#5B6880] space-y-2">
            <FileText className="mx-auto h-8 w-8 text-[#5B6880]/40" />
            <p className="text-xs font-semibold text-[#17243B]">No documents in active workspace</p>
            <p className="text-[11px] text-[#5B6880] max-w-sm mx-auto">
              Upload course syllabus, lecture slide decks, or assignments above to begin automatic chunking and vector indexing.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#F7F9FD] text-[11px] font-semibold uppercase tracking-wider text-[#5B6880] border-b border-[#D8E1EE]">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Size</th>
                  <th className="px-3 py-3">Pages / Slides</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E1EE] text-[#17243B]">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-[#F7F9FD] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`h-2 w-2 shrink-0 rounded-full ${getSourceTypeDotClass(file.type)}`}
                        />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5B6880]">
                          {file.type}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-[#17243B] truncate max-w-md" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[10px] text-[#78869B] font-mono">
                          ID: {file.id.slice(0, 10)}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <span className="rounded-[4px] bg-[#F7F9FD] px-2 py-0.5 text-[10.5px] font-medium text-[#5B6880] capitalize border border-[#D8E1EE]">
                        {file.role.replace("_", " ")}
                      </span>
                    </td>

                    <td className="px-3 py-3 font-mono text-[11px] text-[#5B6880]">
                      {formatBytes(file.file_size)}
                    </td>

                    <td className="px-3 py-3 text-[11px] font-mono text-[#5B6880]">
                      {file.page_count > 0
                        ? `${file.page_count} ${file.type === "pptx" ? "slides" : file.type === "docx" ? "sections" : "pages"}`
                        : "—"}
                    </td>

                    <td className="px-3 py-3">
                      {file.status === "ready" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#EAF6F1] px-2 py-0.5 text-[11px] font-medium text-[#16805D] border border-[#16805D]/20">
                          <CheckCircle2 className="h-3 w-3 text-[#16805D]" />
                          Ready
                        </span>
                      ) : file.status === "processing" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#FEF8E7] px-2 py-0.5 text-[11px] font-medium text-[#B7791F] border border-[#B7791F]/20 animate-pulse">
                          <Clock className="h-3 w-3 text-[#B7791F] animate-spin" />
                          Indexing...
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#FDF2F2] px-2 py-0.5 text-[11px] font-medium text-[#C43D4B] border border-[#C43D4B]/30">
                            <AlertCircle className="h-3 w-3 text-[#C43D4B]" />
                            Failed
                          </span>
                          {file.error_message && (
                            <p className="text-[10px] text-[#C43D4B] max-w-xs truncate" title={file.error_message}>
                              {file.error_message}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2.5">
                        <Link
                          href={`/notes?file_id=${file.id}`}
                          className="text-[11px] font-medium text-[#2457D6] hover:underline transition"
                        >
                          Notes
                        </Link>
                        <a
                          href={`${API_BASE_URL}/files/${file.id}/pdf?workspace_id=${workspaceId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-[#5B6880] hover:text-[#17243B] transition inline-flex items-center gap-1"
                        >
                          <span>PDF</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        <button
                          onClick={() => handleDelete(file.id, file.name)}
                          className="rounded-[4px] p-1 text-[#5B6880] hover:bg-[#FDF2F2] hover:text-[#C43D4B] transition cursor-pointer"
                          title="Delete file from workspace"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ingestion Engine Specifications */}
      <div className="rounded-[6px] border border-[#D8E1EE] bg-white p-4 space-y-2 text-xs text-[#5B6880] shadow-xs">
        <div className="flex items-center gap-2 font-semibold text-[#17243B] text-xs uppercase tracking-wider">
          <Layers className="h-3.5 w-3.5 text-[#2457D6]" />
          <span>Ingestion Engine Specifications</span>
        </div>
        <p className="leading-relaxed text-[11.5px] text-[#5B6880]">
          • <strong>Page & Slide Boundaries:</strong> Document chunking strictly respects document pages and slides (300–500 tokens with 50-token overlap). Chunks never bleed across slide or page boundaries.<br />
          • <strong>Local Vector Store:</strong> Embeddings generated via Google Gemini (<code className="font-mono bg-[#F7F9FD] border border-[#D8E1EE] px-1 py-0.5 rounded text-[#17243B]">text-embedding-004</code>) and stored in local ChromaDB collections isolated to session <code className="font-mono bg-[#F7F9FD] border border-[#D8E1EE] px-1 py-0.5 rounded text-[#17243B]">{workspaceId.slice(0, 8)}</code>.<br />
          • <strong>Integrity & Validation:</strong> Zero mock fallbacks. If API credentials or parsing fails, files report explicit error state to protect grounded truth.
        </p>
      </div>
    </div>
  );
}
