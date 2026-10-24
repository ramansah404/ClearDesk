"use client";

import React, { useState } from "react";
import {
  BookOpen,
  FileDown,
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
  Clock,
  Sparkles,
  Info,
} from "lucide-react";

export default function NotesPage() {
  const [activeLang, setActiveLang] = useState<"en" | "hi" | "te">("en");
  const [expandedSection, setExpandedSection] = useState<number | null>(1);

  return (
    <div className="space-y-6">
      {/* Header with Language & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            3-Level Keyword Notes
          </h2>
          <p className="text-sm text-slate-500">
            Keyword-first structured summaries with mother-tongue mode and technical terms in English.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            {(["en", "hi", "te"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  activeLang === lang
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {lang === "en" ? "English" : lang === "hi" ? "हिन्दी" : "తెలుగు"}
              </button>
            ))}
          </div>

          {/* Export Revision Sheet Placeholder */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
          >
            <FileDown className="h-4 w-4 text-slate-500" />
            <span>Export 1-Page PDF</span>
          </button>
        </div>
      </div>

      {/* Interactive 3-Level Notes Preview Card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Layers className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Lecture Section 1: Introduction to Gradient Descent & Optimization
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Pages 1–4</span>
        </div>

        <div className="p-6 space-y-5">
          {/* Level 1: Keywords */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[10px]">
                  1
                </span>
                Level 1: Key Terms (Keywords)
              </span>
              <span className="text-[11px] text-slate-400">Ranked by importance</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                "Gradient Descent",
                "Learning Rate (α)",
                "Loss Function",
                "Local Minima",
                "Convex Optimization",
                "Backpropagation",
              ].map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 border border-blue-200/60"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          {/* Level 2: One-Line Meaning */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px]">
                2
              </span>
              Level 2: One-Line Meaning
            </span>
            <p className="text-sm font-medium text-slate-800 leading-relaxed">
              {activeLang === "hi"
                ? "Gradient Descent एक iterative optimization algorithm है जो Loss Function को minimize करने के लिए parameters को adjust करता है।"
                : activeLang === "te"
                ? "Gradient Descent అనేది Loss Function ను తగ్గించడానికి parameters ను దశలవారీగా సర్దుబాటు చేసే optimization algorithm."
                : "An iterative optimization algorithm that updates model parameters in the direction of steepest descent to minimize the loss function."}
            </p>
          </div>

          {/* Level 3: Full Explanation (Expandable) */}
          <div className="rounded-xl border border-slate-200">
            <button
              onClick={() => setExpandedSection(expandedSection === 1 ? null : 1)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50 transition rounded-xl"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px]">
                  3
                </span>
                Level 3: Full Simple Explanation
              </span>
              {expandedSection === 1 ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {expandedSection === 1 && (
              <div className="px-4 pb-4 text-xs md:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                {activeLang === "hi"
                  ? "कल्पना कीजिए कि आप कोहरे में एक पहाड़ी से नीचे उतर रहे हैं। आप हर कदम पर सबसे ढलान वाली दिशा में आगे बढ़ते हैं। Gradient Descent भी ठीक इसी तरह काम करता है: यह current error का derivative (ढलान) निकालता है और parameters को optimal solution की ओर ले जाता है। Technical terms को अंग्रेजी में ही रखा जाता है ताकि परीक्षा की तैयारी में कोई भ्रम न रहे।"
                  : activeLang === "te"
                  ? "మంచుతో కప్పబడిన కొండపై నుండి లోయలోకి దిగడం ఊహించుకోండి. మీరు ప్రతి అడుగులో అత్యంత వాలుగా ఉన్న దిశలో కదులుతారు. Gradient Descent కూడా అలాగే పనిచేస్తుంది: ఇది current error యొక్క gradient ను లెక్కిస్తుంది మరియు మోడల్‌ను సరైన దిశలో నడిపిస్తుంది."
                  : "Imagine hiking down a foggy mountain toward a valley. At each step, you feel the slope and move in the steepest downward direction. Gradient Descent computes the partial derivative (slope) of the loss function with respect to weights and takes steps proportional to the learning rate until converging at a minimum."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Phase 0 Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600 flex items-start gap-3">
        <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-slate-900">Phase 0 Status: </span>
          The `Note` ORM model and SQLite tables are ready. Dynamic 3-level summarization and multilingual translation prompts (`notes_section.txt`, `translate_notes.txt`) will be wired up in <strong>Phase 3: Notes & Languages</strong>.
        </div>
      </div>
    </div>
  );
}
