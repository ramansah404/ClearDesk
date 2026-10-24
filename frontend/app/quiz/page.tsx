"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Award,
} from "lucide-react";

export default function QuizPage() {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Sample grounded quiz question representation
  const sampleQuestion = {
    topic: "Optimization",
    question: "What is the primary role of the learning rate parameter in the gradient descent algorithm?",
    options: [
      "To initialize the model weights to non-zero values",
      "To scale the step size taken towards the loss function minimum",
      "To compute the exact inverse of the Hessian matrix",
      "To normalize the input feature vectors between 0 and 1",
    ],
    answerIndex: 1,
    explanation:
      "According to Page 7 of Lecture_04_Optimization.pdf, the learning rate (alpha) acts as a step-size multiplier that controls how far weights update along the negative gradient vector.",
    citation: "Lecture_04_Optimization.pdf · Page 7",
  };

  const handleSelect = (idx: number) => {
    if (!submitted) setSelectedAnswer(idx);
  };

  const handleSubmit = () => {
    if (selectedAnswer !== null) setSubmitted(true);
  };

  const handleReset = () => {
    setSelectedAnswer(null);
    setSubmitted(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Revision Quiz Mode
          </h2>
          <p className="text-sm text-slate-500">
            Grounded multiple-choice questions synthesized from your own uploaded lecture notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 border border-emerald-200/80 flex items-center gap-1.5">
            <Award className="h-4 w-4 text-emerald-600" />
            <span>Topic Mastery: 75%</span>
          </span>
        </div>
      </div>

      {/* Interactive MCQ Card */}
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-xs text-slate-500">
          <span className="font-semibold text-blue-600 uppercase tracking-wider">
            Topic: {sampleQuestion.topic}
          </span>
          <span>Question 1 of 5</span>
        </div>

        {/* Question Text */}
        <h3 className="text-base md:text-lg font-semibold text-slate-900 leading-snug">
          {sampleQuestion.question}
        </h3>

        {/* 4 MCQ Choices */}
        <div className="space-y-3">
          {sampleQuestion.options.map((option, idx) => {
            const isSelected = selectedAnswer === idx;
            const isCorrect = idx === sampleQuestion.answerIndex;
            let btnClass = "border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-800";

            if (isSelected && !submitted) {
              btnClass = "border-blue-600 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500";
            } else if (submitted) {
              if (isCorrect) {
                btnClass = "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold ring-1 ring-emerald-500";
              } else if (isSelected && !isCorrect) {
                btnClass = "border-rose-400 bg-rose-50 text-rose-900 font-medium";
              } else {
                btnClass = "border-slate-100 bg-slate-50/40 text-slate-400";
              }
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                disabled={submitted}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left text-xs md:text-sm transition ${btnClass}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-xs text-slate-700">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span>{option}</span>
                </div>

                {submitted && isCorrect && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                )}
                {submitted && isSelected && !isCorrect && (
                  <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Answer Explanation & Source Citation */}
        {submitted && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              <span>Grounded Explanation</span>
            </div>
            <p className="text-slate-700 leading-relaxed">{sampleQuestion.explanation}</p>
            <div className="pt-2 flex items-center gap-1.5 text-blue-700 font-semibold">
              <FileText className="h-3.5 w-3.5" />
              <span>Source: {sampleQuestion.citation}</span>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Question</span>
          </button>

          {!submitted ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs md:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-40"
            >
              <span>Submit Answer</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs md:text-sm font-semibold text-white hover:bg-slate-800 transition"
            >
              <span>Next Question</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Phase 0 Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
        <span className="font-semibold text-slate-800">Phase 0 Status: </span>
        The `QuizQuestion` and `QuizAttempt` models are configured. MCQ generation prompt (`quiz_generate.txt`) and adaptive mastery recalculation will be implemented in <strong>Phase 5: Exam Radar & Quiz</strong>.
      </div>
    </div>
  );
}
