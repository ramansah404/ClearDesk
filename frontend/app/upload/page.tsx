"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

import {
  FileItem,
  fetchFiles,
  uploadFiles,
  deleteFile,
} from "@/lib/api";
import { getOrCreateWorkspaceId } from "@/lib/workspace";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(type: string) {
  switch (type.toLowerCase()) {
    case "pdf":
      return <FileText className="h-5 w-5 text-rose-500" />;
    case "pptx":
    case "ppt":
      return <FileText className="h-5 w-5 text-amber-500" />;
    case "docx":
    case "doc":
      return <FileText className="h-5 w-5 text-blue-500" />;
    case "image":
    case "png":
    case "jpg":
    case "jpeg":
      return <ImageIcon className="h-5 w-5 text-emerald-500" />;
    default:
      return <FileText className="h-5 w-5 text-slate-400" />;
  }
}

export default function UploadPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedRole, setSelectedRole] = useState("material");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const wsId = getOrCreateWorkspaceId();
    setWorkspaceId(wsId);
  }, []);

  const loadFiles = useCallback(async (wsId: string) => {
    if (!wsId) return;
    const res = await fetchFiles(wsId);
    if (res.ok && res.data) {
      setFiles(res.data);
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    loadFiles(workspaceId);
  }, [workspaceId, loadFiles]);

  // Polling: refresh every 3 seconds if any file is still processing
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
      setSuccessMessage(`Successfully uploaded ${result.data.length} file(s). Processing pipeline started.`);
      loadFiles(workspaceId);
    } else {
      setErrorMessage(result.error || "File upload failed.");
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
    } else {
      setErrorMessage(res.error || "Failed to delete file.");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Document Ingestion & Indexing
          </h2>
          <p className="text-sm text-slate-500">
            Upload PDF, PPTX, DOCX, and images to parse text, chunk by page boundaries, and index vectors.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadFiles(workspaceId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition self-start sm:self-auto"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs md:text-sm text-rose-800 flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Error: </span>
            {errorMessage}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs md:text-sm text-emerald-800 flex items-start gap-3 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Success: </span>
            {successMessage}
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative rounded-2xl border-2 border-dashed p-8 md:p-12 text-center transition-all ${
          isDragging
            ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
            : "border-slate-300 bg-white hover:border-blue-400"
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

        <div className="mx-auto flex max-w-md flex-col items-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs">
            <UploadCloud className={`h-8 w-8 ${isUploading ? "animate-bounce" : ""}`} />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Drag & drop lecture files or documents here
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Supported formats: PDF, PPTX, DOCX, and images (PNG, JPG) up to 50 MB
            </p>
          </div>

          {/* Role Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-xs font-medium text-slate-600">Assign Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={isUploading}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="material">General Material (Lecture / Notes / Brief)</option>
              <option value="syllabus">Syllabus (For Exam Radar)</option>
              <option value="past_paper">Past Question Paper (For Exam Radar)</option>
              <option value="other">Other Reference Document</option>
            </select>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs md:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" />
            <span>{isUploading ? "Uploading Files..." : "Browse Files"}</span>
          </button>
        </div>
      </div>

      {/* Uploaded Files Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Workspace Files ({files.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Isolated to session: <code className="font-mono">{workspaceId.slice(0, 8)}</code>
          </span>
        </div>

        {files.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <UploadCloud className="mx-auto h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium">No documents uploaded yet</p>
            <p className="text-xs text-slate-400">
              Upload a lecture slide deck, syllabus, or notes to begin indexing.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Document</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Pages / Sections</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.type)}
                        <div>
                          <p className="font-medium text-slate-900">{file.name}</p>
                          <p className="text-[11px] text-slate-400 uppercase font-mono">{file.type}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 capitalize">
                        {file.role.replace("_", " ")}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                      {formatBytes(file.file_size)}
                    </td>

                    <td className="px-4 py-3.5 text-xs font-mono text-slate-600">
                      {file.page_count > 0 ? `${file.page_count} ${file.type === "pptx" ? "slides" : file.type === "docx" ? "sections" : "pages"}` : "—"}
                    </td>

                    <td className="px-4 py-3.5">
                      {file.status === "ready" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Ready
                        </span>
                      ) : file.status === "processing" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/80 animate-pulse">
                          <Clock className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/80">
                            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                            Failed
                          </span>
                          {file.error_message && (
                            <p className="text-[10px] text-rose-600 max-w-xs truncate" title={file.error_message}>
                              {file.error_message}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(file.id, file.name)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Delete file"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Honest Limitation Notice for OCR & LibreOffice */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>System Environment Status & Notes</span>
        </div>
        <p className="text-slate-500 leading-relaxed">
          • <strong>PDF, PPTX, & DOCX Parsing:</strong> Full native text extraction and 300–500 token chunking active. Page & slide boundaries are preserved.<br />
          • <strong>ChromaDB Vector Store:</strong> Persistent local collection initialized under <code className="font-mono bg-slate-100 px-1 rounded">./chroma_data</code>.<br />
          • <strong>Gemini Embeddings:</strong> Model configured via <code className="font-mono bg-slate-100 px-1 rounded">EMBED_MODEL</code> in <code className="font-mono bg-slate-100 px-1 rounded">.env</code>. If <code className="font-mono bg-slate-100 px-1 rounded">GEMINI_API_KEY</code> is unset, files report indexing failure rather than using fake embeddings.
        </p>
      </div>
    </div>
  );
}
