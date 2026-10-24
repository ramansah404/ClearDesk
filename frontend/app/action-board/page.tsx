"use client";

import React from "react";
import {
  Calendar,
  AlertTriangle,
  FileDown,
  CheckCircle2,
  Clock,
  User,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export default function ActionBoardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Action Board & Conflict Detection
          </h2>
          <p className="text-sm text-slate-500">
            Auto-extracted deadlines, deliverables, missing requirements, and flagged contradictions.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
        >
          <FileDown className="h-4 w-4 text-slate-500" />
          <span>Export All (.ics Calendar)</span>
        </button>
      </div>

      {/* Amber Conflict Alert Banner */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-2xs">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs md:text-sm font-bold text-amber-900 uppercase tracking-wide">
                Conflict Alert: Disagreeing Deadlines Detected
              </h3>
              <span className="rounded-md bg-amber-200/70 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                2 Sources
              </span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Project Brief.pdf (Page 3)</strong> specifies deadline as{" "}
              <span className="font-semibold underline">25 Oct 2026</span>, while{" "}
              <strong>Client_Update_Email.docx (Page 1)</strong> specifies{" "}
              <span className="font-semibold underline">28 Oct 2026</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Kanban Board Columns: Deadlines, Deliverables, Missing Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Deadlines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-rose-200 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-rose-600" />
              <h4 className="text-sm font-bold text-slate-900">Deadlines</h4>
            </div>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
              1
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-rose-300 transition">
            <div className="flex items-center justify-between text-xs font-medium text-rose-600">
              <span>Final Report Submission</span>
              <span className="rounded bg-rose-50 px-1.5 py-0.5 font-bold">25 Oct</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Submit consolidated project deliverables and budget approval sign-off.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              <span>Brief.pdf · P.3</span>
              <span className="font-medium text-blue-600 cursor-pointer hover:underline">
                + Add to Calendar
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: Deliverables */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-blue-200 pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <h4 className="text-sm font-bold text-slate-900">Deliverables</h4>
            </div>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
              1
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-blue-300 transition">
            <div className="flex items-center justify-between text-xs font-medium text-blue-700">
              <span>Executive Slide Deck</span>
              <span className="flex items-center gap-1 text-slate-400">
                <User className="h-3 w-3" /> Team Origin
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              10-slide presentation deck covering architecture, RAG grounding, and metrics.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              <span>Deck_Spec.docx · P.2</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 font-medium">
                Deliverable
              </span>
            </div>
          </div>
        </div>

        {/* Column 3: Missing Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200 pb-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-amber-600" />
              <h4 className="text-sm font-bold text-slate-900">Missing Information</h4>
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
              1
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-amber-300 transition">
            <div className="flex items-center justify-between text-xs font-medium text-amber-700">
              <span>Budget Approval Sheet</span>
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 font-bold">
                Unattached
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Document states: &quot;submit report with signed budget sheet&quot; but no budget spreadsheet has been uploaded.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              <span>Brief.pdf · P.4</span>
              <span className="text-amber-700 font-medium">Flagged</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 0 Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
        <span className="font-semibold text-slate-800">Phase 0 Status: </span>
        ActionItem and Conflict database models are registered. Automated LLM extraction (`extract_actions.txt`), `dateparser` validation, and `.ics` generation activate in <strong>Phase 4: Action Board & Conflicts</strong>.
      </div>
    </div>
  );
}
