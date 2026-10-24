"use client";

import React from "react";
import {
  UploadCloud,
  BookOpen,
  MessageSquareQuote,
  CheckSquare,
  Target,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Sparkles,
} from "lucide-react";

const MODULES = [
  {
    title: "1. Upload Documents",
    description: "Ingest mixed files (PDF, PPTX, DOCX, images) with OCR and automatic role classification.",
    href: "/upload",
    icon: UploadCloud,
    phase: "Phase 1: Ingestion",
    accent: "border-sky-200 hover:border-sky-400 bg-gradient-to-b from-sky-50/40 to-white",
    iconBg: "bg-sky-100 text-sky-700",
  },
  {
    title: "2. Cited Q&A (Ask)",
    description: "Ask questions and receive grounded answers with exact page/slide citations and zero guessing.",
    href: "/ask",
    icon: MessageSquareQuote,
    phase: "Phase 2: Trust Layer",
    accent: "border-indigo-200 hover:border-indigo-400 bg-gradient-to-b from-indigo-50/40 to-white",
    iconBg: "bg-indigo-100 text-indigo-700",
  },
  {
    title: "3. 3-Level Notes",
    description: "Keyword-first notes (Keywords, Meaning, Explanation) with English, Hindi, and Telugu support.",
    href: "/notes",
    icon: BookOpen,
    phase: "Phase 3: Notes & Lang",
    accent: "border-emerald-200 hover:border-emerald-400 bg-gradient-to-b from-emerald-50/40 to-white",
    iconBg: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "4. Action Board",
    description: "Auto-extracted deadlines, deliverables, and Conflict Alerts for disagreeing dates across documents.",
    href: "/action-board",
    icon: CheckSquare,
    phase: "Phase 4: Action Board",
    accent: "border-amber-200 hover:border-amber-400 bg-gradient-to-b from-amber-50/40 to-white",
    iconBg: "bg-amber-100 text-amber-700",
  },
  {
    title: "5. Exam Radar",
    description: "Syllabus and past paper analysis, ranked high-yield topics, and backward day-wise revision plans.",
    href: "/exam-radar",
    icon: Target,
    phase: "Phase 5: Exam Radar",
    accent: "border-purple-200 hover:border-purple-400 bg-gradient-to-b from-purple-50/40 to-white",
    iconBg: "bg-purple-100 text-purple-700",
  },
  {
    title: "6. Revision Quiz",
    description: "Interactive MCQs generated strictly from your own materials, with instant explanations and citations.",
    href: "/quiz",
    icon: HelpCircle,
    phase: "Phase 5: Quiz Mode",
    accent: "border-rose-200 hover:border-rose-400 bg-gradient-to-b from-rose-50/40 to-white",
    iconBg: "bg-rose-100 text-rose-700",
  },
];

const NON_NEGOTIABLES = [
  "Every answer has clickable citations, or an explicit 'Not found in your files' refusal.",
  "Citations open the exact page or slide in the built-in document viewer.",
  "Conflict Alert flags disagreements across different files (e.g. conflicting deadlines).",
  "Action Board fills automatically upon file upload with .ics calendar export.",
  "Exam Radar produces an actionable, day-wise revision plan backward from exam date.",
];

export default function HomePage() {
  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white p-6 md:p-8 shadow-xs">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200/60">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ideathon 2.0 · Team Origin · Phase 0 Setup Complete</span>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Welcome to ClearDesk
          </h2>

          <p className="text-sm md:text-base text-slate-600 leading-relaxed">
            The AI-powered document intelligence workspace built for students and office workers. Upload mixed lecture slides, PDFs, notes, or project briefs, and turn them into trusted, cited knowledge with zero hallucination.
          </p>
        </div>

        {/* Phase 0 Status Pill */}
        <div className="mt-6 flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Phase 0 Setup: Foundation Active</span>
          </div>
          <span className="text-slate-300">•</span>
          <span>FastAPI Backend + SQLite & Chroma Ready</span>
          <span className="text-slate-300">•</span>
          <span>Strict Anti-Hallucination Guardrails Configured</span>
        </div>
      </section>

      {/* 6 Workspace Modules Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Workspace Modules</h3>
            <p className="text-xs text-slate-500">
              Each module follows the spec-defined implementation roadmap.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <a
                key={module.href}
                href={module.href}
                className={`group flex flex-col justify-between rounded-xl border p-5 shadow-2xs transition-all hover:shadow-md hover:-translate-y-0.5 ${module.accent}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${module.iconBg}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                      {module.phase}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-slate-900 text-base group-hover:text-blue-600 transition">
                      {module.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {module.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100 text-xs font-medium text-slate-500 group-hover:text-blue-600">
                  <span>View Module Interface</span>
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {/* Non-Negotiables & Trust Architecture */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* The 5 Non-Negotiables */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-base">
              The 5 ClearDesk Non-Negotiables
            </h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            These are the architectural principles judged for full evaluation:
          </p>

          <ul className="space-y-2.5">
            {NON_NEGOTIABLES.map((item, index) => (
              <li key={index} className="flex items-start gap-3 text-xs md:text-sm text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-600 mt-0.5">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Anti-Hallucination & Privacy Card */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <FileCheck2 className="h-5 w-5 text-emerald-600" />
              <span>Grounded Trust Layer</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              ClearDesk uses strict retrieval verification. If supporting evidence is missing or below the similarity threshold, the AI explicitly returns:
            </p>
            <div className="rounded-lg bg-white p-3 border border-emerald-200 text-center font-mono text-xs font-semibold text-emerald-900 shadow-2xs">
              &quot;Not found in your files&quot;
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              No guesswork. Every claim links to exact page numbers and quotes from your uploaded files.
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-emerald-200/60 text-[11px] text-emerald-800 font-medium">
            🔒 Local SQLite & Chroma Isolation
          </div>
        </div>
      </section>
    </div>
  );
}
