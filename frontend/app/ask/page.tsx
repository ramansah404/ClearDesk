"use client";

import React, { useState } from "react";
import {
  MessageSquareQuote,
  Send,
  ExternalLink,
  ShieldCheck,
  FileText,
  AlertCircle,
  HelpCircle,
  BookOpen,
} from "lucide-react";

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [selectedCitation, setSelectedCitation] = useState<{
    file: string;
    page: number;
    quote: string;
  } | null>({
    file: "Lecture_04_Optimization.pdf",
    page: 7,
    quote: "The learning rate alpha determines the step size taken towards the minimum of the loss function.",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Cited Document Q&A (Ask)
        </h2>
        <p className="text-sm text-slate-500">
          Answers backed strictly by source documents with clickable page citations and refusal to guess.
        </p>
      </div>

      {/* Main Split Layout: Chat on Left, Source Viewer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Chat Conversation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 min-h-[420px] flex flex-col justify-between">
            {/* Messages Stream */}
            <div className="space-y-4">
              {/* Sample User Question */}
              <div className="flex justify-end">
                <div className="max-w-md rounded-2xl bg-blue-600 px-4 py-2.5 text-xs md:text-sm text-white shadow-xs">
                  What determines the step size in gradient descent?
                </div>
              </div>

              {/* Sample Cited Answer */}
              <div className="space-y-2">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 text-xs md:text-sm text-slate-800 space-y-3 leading-relaxed">
                  <p>
                    The step size in gradient descent is determined by the{" "}
                    <strong>learning rate (α)</strong>, which scales the magnitude of parameter updates at each iteration.
                  </p>

                  {/* Clickable Citation Chips */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/60">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Citations:
                    </span>
                    <button
                      onClick={() =>
                        setSelectedCitation({
                          file: "Lecture_04_Optimization.pdf",
                          page: 7,
                          quote:
                            "The learning rate alpha determines the step size taken towards the minimum of the loss function.",
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100/80 hover:bg-blue-200/80 px-2.5 py-1 text-xs font-semibold text-blue-800 transition"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Lecture_04_Optimization.pdf · Page 7</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Example Refusal Demonstration */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Anti-Hallucination Guardrail: </span>
                  If an answer cannot be grounded in your uploaded documents, ClearDesk explicitly returns{" "}
                  <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-semibold">
                    &quot;Not found in your files&quot;
                  </code>{" "}
                  rather than generating speculative claims.
                </div>
              </div>
            </div>

            {/* Input Bar */}
            <div className="pt-2">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about your uploaded documents..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-12 text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  className="absolute right-2 rounded-lg bg-blue-600 p-2 text-white hover:bg-blue-700 transition"
                  aria-label="Send question"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Source Viewer Placeholder */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Source Page Viewer
                  </h3>
                </div>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600">
                  react-pdf
                </span>
              </div>

              {selectedCitation ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                      <span>{selectedCitation.file}</span>
                      <span className="rounded bg-blue-200/70 px-1.5 py-0.5">
                        Page {selectedCitation.page}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-700 font-mono bg-white p-3 rounded-lg border border-blue-100 leading-relaxed">
                      &quot;{selectedCitation.quote}&quot;
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    In Phase 2, clicking any citation chip jumps the embedded PDF viewer directly to this page with the citation phrase highlighted.
                  </p>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  Click a citation chip to view source page
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
              <span>Interactive QA Engine</span>
              <span className="font-medium text-blue-600">Scheduled for Phase 2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
