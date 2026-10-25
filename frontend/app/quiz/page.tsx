"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Award,
  AlertCircle,
  ExternalLink,
  RotateCw,
} from "lucide-react";
import {
  generateQuiz,
  submitQuizAnswer,
  fetchQuizProgress,
  fetchExamPlan,
  QuizQuestionItem,
  QuizProgressResponse,
  TopicItem,
  API_BASE_URL,
} from "@/lib/api";
import { getOrCreateWorkspaceId } from "@/lib/workspace";

function QuizContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const wsParam = searchParams.get("ws");
  const topicParam = searchParams.get("topic_id");

  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topicParam || "");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [questionType, setQuestionType] = useState<string>("mcq");

  const [questions, setQuestions] = useState<QuizQuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answering, setAnswering] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientEvidence, setInsufficientEvidence] = useState<string | null>(null);

  const [progress, setProgress] = useState<QuizProgressResponse | null>(null);

  useEffect(() => {
    const ws = getOrCreateWorkspaceId(wsParam);
    setWorkspaceId(ws);
    loadInitialData(ws);
  }, [wsParam]);

  useEffect(() => {
    if (topicParam) {
      setSelectedTopicId(topicParam);
    }
  }, [topicParam]);

  async function loadInitialData(ws: string) {
    const planRes = await fetchExamPlan(ws);
    if (planRes.ok && planRes.data) {
      setTopics(planRes.data.topics || []);
    }
    const progRes = await fetchQuizProgress(ws);
    if (progRes.ok && progRes.data) {
      setProgress(progRes.data);
    }
  }

  async function handleGenerateQuiz() {
    if (!workspaceId) return;

    setGenerating(true);
    setError(null);
    setInsufficientEvidence(null);
    setSelectedOption(null);
    setCurrentIndex(0);

    const res = await generateQuiz(
      workspaceId,
      selectedTopicId || null,
      questionCount,
      questionType
    );

    if (res.ok && res.data) {
      if (res.data.status === "insufficient_evidence" || res.data.questions.length === 0) {
        setInsufficientEvidence(
          res.data.message ||
            "Not found in your files. The uploaded documents lack sufficient factual evidence for this quiz topic. Upload course material or past papers to generate grounded questions."
        );
        setQuestions([]);
        showToast("Insufficient grounded document evidence for this topic.", "warning");
      } else {
        setQuestions(res.data.questions);
        showToast(`Generated ${res.data.questions.length} grounded quiz questions.`, "success");
      }
    } else {
      const errMsg = res.error || "Failed to generate quiz questions.";
      setError(errMsg);
      showToast(errMsg, "error");
    }

    setGenerating(false);
  }

  async function handleSubmitAnswer() {
    const currentQ = questions[currentIndex];
    if (!currentQ || selectedOption === null || currentQ.answered || !workspaceId) return;

    setAnswering(true);
    const res = await submitQuizAnswer(workspaceId, currentQ.id, selectedOption);

    if (res.ok && res.data) {
      const updated = [...questions];
      updated[currentIndex] = {
        ...currentQ,
        answered: true,
        user_answer: selectedOption,
        is_correct: res.data.correct,
        explanation: res.data.explanation || currentQ.explanation,
      };
      setQuestions(updated);

      if (res.data.correct) {
        showToast("Correct! Answer verified against course material.", "success");
      } else {
        showToast("Incorrect. Review the grounded evidence below.", "warning");
      }

      const progRes = await fetchQuizProgress(workspaceId);
      if (progRes.ok && progRes.data) {
        setProgress(progRes.data);
      }
    } else {
      const errMsg = res.error || "Failed to submit answer.";
      setError(errMsg);
      showToast(errMsg, "error");
    }
    setAnswering(false);
  }

  const currentQ = questions[currentIndex];
  const optionLetters = ["A", "B", "C", "D"];

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 py-6 max-w-5xl w-full mx-auto space-y-6">
      {/* Page Header */}
      <div className="border-b border-[#D8E1EE] pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#2457D6]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#17243B]">
              Quiz Drills & Assessment
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#5B6880]">
            Self-assessment drills strictly grounded in your course materials with verbatim citations and mastery updates.
          </p>
        </div>

        {/* Progress pill */}
        {progress && progress.total_attempts > 0 && (
          <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-[6px] border border-[#D8E1EE] shadow-xs text-xs font-semibold text-[#17243B]">
            <div className="flex items-center gap-1.5 text-[#2457D6]">
              <Award className="w-4 h-4" />
              <span>Accuracy: {progress.accuracy}%</span>
            </div>
            <div className="h-3 w-px bg-[#D8E1EE]" />
            <span className="text-[#5B6880] font-mono text-[11px]">
              {progress.correct_attempts} / {progress.total_attempts} correct
            </span>
          </div>
        )}
      </div>

      {/* Generator Controls Card */}
      <div className="p-4 sm:p-5 bg-white rounded-[6px] border border-[#D8E1EE] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E1EE] pb-3">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#78869B]">
            Quiz Parameters
          </span>
          <span className="text-xs text-[#5B6880]">
            Grounded against indexed workspace documents
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Topic selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#17243B]">Topic Filter</label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D8E1EE] rounded-[4px] text-xs font-medium text-[#17243B] focus:outline-none focus:border-[#2457D6] cursor-pointer"
            >
              <option value="">All Topics (Comprehensive)</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.priority_level} priority)
                </option>
              ))}
            </select>
          </div>

          {/* Question count */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#17243B]">Question Count</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D8E1EE] rounded-[4px] text-xs font-medium text-[#17243B] focus:outline-none focus:border-[#2457D6] cursor-pointer"
            >
              <option value="3">3 Questions (Quick check)</option>
              <option value="5">5 Questions (Standard drill)</option>
              <option value="10">10 Questions (Deep review)</option>
            </select>
          </div>

          {/* Question format */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#17243B]">Question Format</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value)}
              className="w-full px-3 py-2 bg-[#F7F9FD] border border-[#D8E1EE] rounded-[4px] text-xs font-medium text-[#17243B] focus:outline-none focus:border-[#2457D6] cursor-pointer"
            >
              <option value="mcq">Multiple Choice (MCQ)</option>
              <option value="short_answer">Short Answer / Conceptual</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={handleGenerateQuiz}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2457D6] hover:bg-[#1947B8] text-white text-xs font-semibold rounded-[6px] shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{generating ? "Generating Grounded Questions..." : "Generate Quiz"}</span>
          </button>
        </div>
      </div>

      {/* Insufficient Evidence Warning Banner */}
      {insufficientEvidence && (
        <div className="p-4 bg-[#FEF8E7] border border-[#B7791F]/30 rounded-[6px] flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <h3 className="text-xs font-bold text-[#17243B]">Insufficient Grounded Evidence</h3>
            <p className="text-xs text-[#5B6880] leading-relaxed">{insufficientEvidence}</p>
            <div className="pt-1.5">
              <Link
                href="/upload"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2457D6] hover:underline"
              >
                Go to Document Sources &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-[#FDF2F2] border border-[#C43D4B]/30 rounded-[6px] text-xs text-[#C43D4B] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#C43D4B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-xs">Quiz Generation Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Active Question Display */}
      {questions.length > 0 && currentQ && (
        <div className="space-y-4">
          {/* Question Stepper Header */}
          <div className="flex items-center justify-between text-xs font-medium text-[#5B6880]">
            <span>
              Question <span className="font-semibold text-[#17243B]">{currentIndex + 1}</span> of{" "}
              <span className="font-semibold text-[#17243B]">{questions.length}</span>
            </span>
            {currentQ.topic_name && (
              <span className="bg-[#E8F0FF] border border-[#D4E4FC] text-[#2457D6] px-2.5 py-0.5 rounded-[4px] text-[11px] font-semibold">
                {currentQ.topic_name}
              </span>
            )}
          </div>

          {/* Question Card */}
          <div className="p-5 sm:p-6 bg-white rounded-[6px] border border-[#D8E1EE] shadow-sm space-y-5">
            {/* Question Statement */}
            <h2 className="text-sm sm:text-base font-semibold text-[#17243B] leading-relaxed">
              {currentQ.question}
            </h2>

            {/* Options list */}
            <div className="space-y-2">
              {currentQ.options.map((opt, oIdx) => {
                const isSelected = selectedOption === oIdx || currentQ.user_answer === oIdx;
                const isCorrectAnswer = currentQ.answer_index === oIdx;

                let stateClasses = "border-[#D8E1EE] hover:border-[#C4D0E0] hover:bg-[#F7F9FD] bg-white text-[#17243B]";
                let badgeClasses = "bg-[#F7F9FD] text-[#5B6880] border-[#D8E1EE]";

                if (currentQ.answered) {
                  if (isCorrectAnswer) {
                    stateClasses = "border-[#16805D] bg-[#EAF6F1] text-[#17243B]";
                    badgeClasses = "bg-[#16805D] text-white border-[#16805D]";
                  } else if (isSelected && !isCorrectAnswer) {
                    stateClasses = "border-[#C43D4B] bg-[#FDF2F2] text-[#17243B]";
                    badgeClasses = "bg-[#C43D4B] text-white border-[#C43D4B]";
                  }
                } else if (isSelected) {
                  stateClasses = "border-[#2457D6] bg-[#E8F0FF] text-[#2457D6] ring-1 ring-[#2457D6]/30";
                  badgeClasses = "bg-[#2457D6] text-white border-[#2457D6]";
                }

                return (
                  <button
                    key={oIdx}
                    onClick={() => {
                      if (!currentQ.answered) setSelectedOption(oIdx);
                    }}
                    disabled={currentQ.answered}
                    className={`w-full text-left p-3 sm:p-3.5 rounded-[6px] border text-xs sm:text-sm flex items-start gap-3 transition-all cursor-pointer ${stateClasses}`}
                  >
                    <span
                      className={`w-5 h-5 rounded-[4px] text-[11px] font-mono font-semibold border flex items-center justify-center shrink-0 mt-0.5 ${badgeClasses}`}
                    >
                      {optionLetters[oIdx]}
                    </span>
                    <span className="flex-1 font-normal leading-relaxed">{opt}</span>
                    {currentQ.answered && isCorrectAnswer && (
                      <CheckCircle2 className="w-4 h-4 text-[#16805D] shrink-0 mt-0.5" />
                    )}
                    {currentQ.answered && isSelected && !isCorrectAnswer && (
                      <XCircle className="w-4 h-4 text-[#C43D4B] shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Answer Explanation & Grounded Source Citation */}
            {currentQ.answered && (
              <div className="pt-4 border-t border-[#D8E1EE] space-y-3">
                <div
                  className={`p-3.5 rounded-[6px] border text-xs leading-relaxed space-y-1 ${
                    currentQ.is_correct
                      ? "bg-[#EAF6F1] border-[#16805D]/30 text-[#17243B]"
                      : "bg-[#FDF2F2] border-[#C43D4B]/30 text-[#17243B]"
                  }`}
                >
                  <p className="font-semibold flex items-center gap-1.5 text-xs">
                    {currentQ.is_correct ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#16805D]" />
                        <span className="text-[#16805D] font-semibold">Correct answer verified</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-[#C43D4B]" />
                        <span className="text-[#C43D4B] font-semibold">Incorrect response</span>
                      </>
                    )}
                  </p>
                  <p className="font-normal text-[#5B6880]">{currentQ.explanation}</p>
                </div>

                {/* Grounded Citation Chip */}
                {currentQ.file_name && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="text-xs font-medium text-[#5B6880]">Document Evidence:</span>
                    {currentQ.file_id ? (
                      <a
                        href={`${API_BASE_URL}/files/${currentQ.file_id}/pdf?workspace_id=${workspaceId}#page=${currentQ.page_or_slide || 1}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F9FD] border border-[#D8E1EE] text-[#17243B] rounded-[4px] text-xs hover:bg-[#E8F0FF] hover:border-[#D4E4FC] transition shadow-xs"
                        title="Open cited document page in viewer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#2457D6]" />
                        <span className="font-medium text-[#17243B]">{currentQ.file_name}</span>
                        <span className="text-[#C4D0E0]">•</span>
                        <span className="text-[#5B6880]">Page {currentQ.page_or_slide || 1}</span>
                        <ExternalLink className="w-3 h-3 text-[#5B6880] ml-0.5" />
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F7F9FD] border border-[#D8E1EE] text-[#17243B] rounded-[4px] text-xs">
                        <FileText className="w-3.5 h-3.5 text-[#2457D6]" />
                        <span className="font-medium text-[#17243B]">{currentQ.file_name}</span>
                        <span className="text-[#C4D0E0]">•</span>
                        <span className="text-[#5B6880]">Page {currentQ.page_or_slide || 1}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-4 border-t border-[#D8E1EE]">
              <button
                onClick={() => {
                  if (currentIndex > 0) {
                    setCurrentIndex(currentIndex - 1);
                    setSelectedOption(null);
                  }
                }}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#5B6880] hover:text-[#17243B] disabled:opacity-30 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {!currentQ.answered ? (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={selectedOption === null || answering}
                  className="px-4 py-2 bg-[#2457D6] hover:bg-[#1947B8] text-white text-xs font-semibold rounded-[6px] shadow-sm transition cursor-pointer disabled:opacity-40"
                >
                  {answering ? "Verifying..." : "Submit Answer"}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (currentIndex < questions.length - 1) {
                      setCurrentIndex(currentIndex + 1);
                      setSelectedOption(null);
                    } else {
                      showToast("Quiz completed! Mastery score updated in Exam Radar.", "success");
                    }
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-[#2457D6] hover:bg-[#1947B8] text-white text-xs font-semibold rounded-[6px] shadow-sm transition cursor-pointer"
                >
                  <span>
                    {currentIndex < questions.length - 1 ? "Next Question" : "Finish Drill"}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Initial Empty State when no quiz generated yet */}
      {questions.length === 0 && !insufficientEvidence && (
        <div className="border border-dashed border-[#D8E1EE] bg-white rounded-[6px] p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-[#E8F0FF] text-[#2457D6] rounded-full flex items-center justify-center mx-auto shadow-xs">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#17243B]">Ready for Document Self-Assessment?</h3>
            <p className="text-xs text-[#5B6880] mt-1 max-w-md mx-auto leading-relaxed">
              Select your target topic and question count above, then click <strong>Generate Quiz</strong> to practice drill questions generated strictly from your uploaded course materials.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleGenerateQuiz}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2457D6] hover:bg-[#1947B8] text-white text-xs font-semibold rounded-[6px] shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
              <span>Generate Quiz Questions</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-xs font-medium text-[#5B6880]">
        Loading Quiz Mode...
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
