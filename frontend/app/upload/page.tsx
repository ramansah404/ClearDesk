"use client";

import React, { useState } from "react";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";

export default function UploadPage() {
  const [selectedRole, setSelectedRole] = useState("material");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Document Ingestion & Classification
          </h2>
          <p className="text-sm text-slate-500">
            Upload PDF, PPTX, DOCX, and images (with OCR) to build your grounded workspace.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 border border-sky-200">
          <Clock className="h-4 w-4" />
          <span>Scheduled for Phase 1</span>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="relative rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 md:p-12 text-center hover:border-blue-400 transition">
        <div className="mx-auto flex max-w-md flex-col items-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs">
            <UploadCloud className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Drag & drop lecture files or documents here
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Supports PDF, PPTX, DOCX, and photos of notes (PNG, JPG)
            </p>
          </div>

          {/* Role Selector Preview */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs font-medium text-slate-600">Assign File Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
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
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs md:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Select Files to Upload</span>
          </button>
        </div>
      </div>

      {/* Honest Empty State / Phase 0 Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-900">
              Phase 0 Foundation Active
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              The database schema (`File`, `Chunk`) and storage directories are initialized. File upload, PyMuPDF text extraction, PPTX parsing, Tesseract OCR, and ChromaDB vector chunking will be implemented in <strong>Phase 1: Ingestion</strong>.
            </p>
          </div>
        </div>

        {/* Spec Pipeline Preview */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
            <span className="font-semibold text-slate-700">1. PyMuPDF</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Page-accurate text extraction</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
            <span className="font-semibold text-slate-700">2. python-pptx</span>
            <p className="text-[11px] text-slate-500 mt-0.5">Slides & speaker notes</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
            <span className="font-semibold text-slate-700">3. Tesseract OCR</span>
            <p className="text-[11px] text-slate-500 mt-0.5">English, Hindi & Telugu</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/60">
            <span className="font-semibold text-slate-700">4. ChromaDB</span>
            <p className="text-[11px] text-slate-500 mt-0.5">300-500 token chunk vectors</p>
          </div>
        </div>
      </div>
    </div>
  );
}
