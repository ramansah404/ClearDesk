"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import {
  Target,
  Calendar,
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Flame,
  Award,
  Layers,
  ChevronRight,
  RotateCw,
  Loader2,
} from "lucide-react";
import {
  buildExamPlan,
  fetchExamPlan,
  ExamPlanResponse,
} from "@/lib/api";
import { getOrCreateWorkspaceId } from "@/lib/workspace";

function ExamRadarContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const wsParam = searchParams.get("ws");
  const [workspaceId, setWorkspaceId] = useState<string>("");

  const [examDate, setExamDate] = useState<string>("2026-11-20");
  const [hoursPerDay, setHoursPerDay] = useState<number>(2.5);

  const [loading, setLoading] = useState<boolean>(true);
  const [building, setBuilding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<ExamPlanResponse | null>(null);

  useEffect(() => {
    const ws = getOrCreateWorkspaceId(wsParam);
    setWorkspaceId(ws);
    loadPlan(ws);
  }, [wsParam]);

  async function loadPlan(ws: string) {
    setLoading(true);
    setError(null);
    const res = await fetchExamPlan(ws);
    if (res.ok && res.data) {
      setPlan(res.data);
      if (res.data.exam_date) setExamDate(res.data.exam_date);
      if (res.data.hours_per_day) setHoursPerDay(res.data.hours_per_day);
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  }

  async function handleBuildPlan(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!workspaceId) return;

    setBuilding(true);
    setError(null);
    const res = await buildExamPlan(workspaceId, examDate, hoursPerDay);
    if (res.ok && res.data) {
      setPlan(res.data);
      showToast(`Study plan generated: ${res.data.total_topics} topics over ${res.data.days.length} days!`, "success");
    } else {
      const errMsg = res.error || "Failed to build study plan.";
      setError(errMsg);
      showToast(errMsg, "error");
    }
    setBuilding(false);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 py-6 max-w-6xl w-full mx-auto space-y-6">
      {/* Page Header */}
      <div className="border-b border-[#D8E1EE] pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#2457D6]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#17243B]">
              Exam Radar & Study Planner
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#5B6880]">
            Topic prioritization and backward study calendar synthesized from syllabus weights and past exam papers.
          </p>
        </div>

        {/* Input Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-[6px] border border-[#D8E1EE] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium text-[#17243B] pl-1">
            <Calendar className="w-3.5 h-3.5 text-[#5B6880]" />
            <span className="text-[#5B6880]">Exam:</span>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="px-2 py-1 bg-[#F7F9FD] border border-[#D8E1EE] rounded-[4px] text-xs font-medium text-[#17243B] focus:outline-none focus:border-[#2457D6]"
            />
          </div>

          <div className="h-4 w-px bg-[#D8E1EE] hidden sm:block" />

          <div className="flex items-center gap-2 text-xs font-medium text-[#17243B]">
            <Clock className="w-3.5 h-3.5 text-[#5B6880]" />
            <span className="text-[#5B6880]">Daily:</span>
            <select
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(parseFloat(e.target.value))}
              className="px-2 py-1 bg-[#F7F9FD] border border-[#D8E1EE] rounded-[4px] text-xs font-medium text-[#17243B] focus:outline-none focus:border-[#2457D6] cursor-pointer"
            >
              <option value="1">1.0 hr/day</option>
              <option value="1.5">1.5 hrs/day</option>
              <option value="2">2.0 hrs/day</option>
              <option value="2.5">2.5 hrs/day</option>
              <option value="3">3.0 hrs/day</option>
              <option value="4">4.0 hrs/day</option>
              <option value="5">5.0 hrs/day</option>
            </select>
          </div>

          <button
            onClick={() => handleBuildPlan()}
            disabled={building}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2457D6] hover:bg-[#1947B8] text-white text-xs font-semibold rounded-[6px] shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {building ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{plan && plan.total_topics > 0 ? "Regenerate Plan" : "Build Study Plan"}</span>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-[#FDF2F2] border border-[#C43D4B]/30 rounded-[6px] text-xs text-[#C43D4B] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#C43D4B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to load or calculate exam plan</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => loadPlan(workspaceId)}
            className="px-2.5 py-0.5 text-xs font-medium bg-white border border-[#D8E1EE] rounded text-[#17243B] hover:bg-[#F7F9FD] cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2 rounded-[6px] border border-[#D8E1EE] bg-white shadow-sm">
          <Loader2 className="h-6 w-6 text-[#2457D6] animate-spin mx-auto" />
          <p className="text-xs font-medium text-[#5B6880]">Synthesizing topic frequencies and exam weights...</p>
        </div>
      ) : !plan || plan.total_topics === 0 ? (
        /* Empty state */
        <div className="border border-dashed border-[#D8E1EE] bg-white rounded-[6px] p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-[#E8F0FF] text-[#2457D6] rounded-full flex items-center justify-center mx-auto shadow-xs">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#17243B]">No Study Plan Generated Yet</h3>
            <p className="text-xs text-[#5B6880] mt-1 max-w-md mx-auto leading-relaxed">
              Upload your course syllabus and past examination papers in Document Sources, then click <strong>Build Study Plan</strong> to calculate topic priority rankings and an actionable daily study calendar.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-2">
            <Link
              href="/upload"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-[#F7F9FD] text-[#17243B] text-xs font-medium rounded-[6px] border border-[#D8E1EE] transition shadow-xs"
            >
              Upload Documents
            </Link>
            <button
              onClick={() => handleBuildPlan()}
              disabled={building}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2457D6] hover:bg-[#1947B8] text-white text-xs font-semibold rounded-[6px] shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${building ? "animate-spin" : ""}`} />
              Extract & Build Plan
            </button>
          </div>
        </div>
      ) : (
        /* Active Plan View */
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-[6px] border border-[#D8E1EE] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-[#5B6880] font-medium">
                <span>Total Topics</span>
                <Layers className="w-4 h-4 text-[#2457D6]" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-[#17243B]">{plan.total_topics}</p>
              <p className="text-[11px] text-[#5B6880]">Extracted from syllabus</p>
            </div>

            <div className="p-4 bg-white rounded-[6px] border border-[#D8E1EE] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-[#5B6880] font-medium">
                <span>High Yield Topics</span>
                <Flame className="w-4 h-4 text-[#C43D4B]" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-[#C43D4B]">
                {plan.topics.filter((t) => t.priority_level === "high").length}
              </p>
              <p className="text-[11px] text-[#5B6880]">Priority score &ge; 60%</p>
            </div>

            <div className="p-4 bg-white rounded-[6px] border border-[#D8E1EE] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-[#5B6880] font-medium">
                <span>Study Days</span>
                <Calendar className="w-4 h-4 text-[#16805D]" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-[#16805D]">{plan.days.length}</p>
              <p className="text-[11px] text-[#5B6880]">Target exam: {plan.exam_date}</p>
            </div>

            <div className="p-4 bg-white rounded-[6px] border border-[#D8E1EE] shadow-xs space-y-1">
              <div className="flex items-center justify-between text-xs text-[#5B6880] font-medium">
                <span>Daily Commitment</span>
                <Clock className="w-4 h-4 text-[#B7791F]" />
              </div>
              <p className="text-2xl font-bold tracking-tight text-[#B7791F]">
                {plan.hours_per_day} <span className="text-xs font-normal text-[#5B6880]">hrs/day</span>
              </p>
              <p className="text-[11px] text-[#5B6880]">{Math.round((plan.hours_per_day || 2) * 60)} mins structured study</p>
            </div>
          </div>

          {/* Section 1: Prioritized Topics Ranking */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-[6px] border border-[#D8E1EE] shadow-xs">
              <div>
                <h2 className="text-sm font-semibold text-[#17243B] flex items-center gap-2">
                  <span aria-hidden className="h-3 w-[3px] rounded-full bg-[#2457D6]" />
                  Exam Topic Priorities
                </h2>
                <p className="text-xs text-[#5B6880] mt-0.5">
                  Ranked by frequency in past papers and syllabus coverage.
                </p>
              </div>

              <Link
                href="/quiz"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F9FD] hover:bg-[#E8F0FF] text-[#2457D6] text-xs font-medium rounded-[6px] border border-[#D8E1EE] transition shadow-xs"
              >
                <Award className="w-3.5 h-3.5 text-[#2457D6]" />
                <span>Practice All Topics</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plan.topics.map((t, idx) => {
                const badgeColor =
                  t.priority_level === "high"
                    ? "bg-[#FDF2F2] text-[#C43D4B] border-[#C43D4B]/30"
                    : t.priority_level === "medium"
                    ? "bg-[#FEF8E7] text-[#B7791F] border-[#B7791F]/30"
                    : "bg-[#F7F9FD] text-[#5B6880] border-[#D8E1EE]";

                return (
                  <div
                    key={t.id || idx}
                    className="p-4 bg-white rounded-[6px] border border-[#D8E1EE] shadow-xs flex flex-col justify-between hover:border-[#C4D0E0] transition group"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-mono font-medium text-[#5B6880]">#{idx + 1}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border uppercase tracking-wider ${badgeColor}`}>
                          {t.priority_level} Priority
                        </span>
                      </div>

                      <h3 className="text-xs font-semibold text-[#17243B] line-clamp-2 leading-snug">
                        {t.name}
                      </h3>

                      {/* Evidence indicators */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2 text-center border-t border-[#D8E1EE] text-xs">
                        <div className="p-1.5 bg-[#F7F9FD] rounded-[4px] border border-[#D8E1EE]">
                          <span className="block text-[9px] text-[#5B6880] font-semibold tracking-wider">FREQ</span>
                          <span className="font-semibold text-[#17243B] text-xs">{t.past_paper_frequency}&times;</span>
                        </div>
                        <div className="p-1.5 bg-[#F7F9FD] rounded-[4px] border border-[#D8E1EE]">
                          <span className="block text-[9px] text-[#5B6880] font-semibold tracking-wider">MARKS</span>
                          <span className="font-semibold text-[#17243B] text-xs">{t.avg_marks || 0}</span>
                        </div>
                        <div className="p-1.5 bg-[#F7F9FD] rounded-[4px] border border-[#D8E1EE]">
                          <span className="block text-[9px] text-[#5B6880] font-semibold tracking-wider">SCORE</span>
                          <span className="font-semibold text-[#2457D6] text-xs">{Math.round(t.priority_score)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mastery progress */}
                    <div className="pt-3 mt-3 border-t border-[#D8E1EE] space-y-1.5">
                      <div className="flex justify-between text-[11px] font-medium text-[#5B6880]">
                        <span>Mastery</span>
                        <span className="font-semibold text-[#17243B]">{Math.round((t.mastery || 0) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E8F0FF] rounded-[2px] overflow-hidden">
                        <div
                          className="h-full bg-[#2457D6] rounded-[2px] transition-all duration-300"
                          style={{ width: `${Math.round((t.mastery || 0) * 100)}%` }}
                        />
                      </div>
                      <div className="pt-1 text-right">
                        <Link
                          href={`/quiz?topic_id=${encodeURIComponent(t.id)}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2457D6] hover:underline"
                        >
                          <span>Quiz topic</span>
                          <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Day-Wise Study Timeline */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#17243B] flex items-center gap-2">
                  <span aria-hidden className="h-3 w-[3px] rounded-full bg-[#16805D]" />
                  Day-Wise Study Timeline
                </h2>
                <p className="text-xs text-[#5B6880] mt-0.5">
                  Structured revision sequence targeting exam date ({plan.exam_date}).
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {plan.days.map((day, idx) => (
                <div
                  key={day.id || idx}
                  className="p-3.5 sm:p-4 bg-white rounded-[6px] border border-[#D8E1EE] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-[#C4D0E0] transition"
                >
                  <div className="flex items-start md:items-center gap-3">
                    <div className="w-10 h-10 rounded-[6px] bg-[#EAF6F1] border border-[#16805D]/20 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-[#16805D] uppercase">Day</span>
                      <span className="text-xs font-bold text-[#16805D]">{idx + 1}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#17243B]">{day.date}</span>
                        <span className="text-[10px] font-medium text-[#5B6880] bg-[#F7F9FD] px-2 py-0.5 rounded-[3px] border border-[#D8E1EE]">
                          {day.minutes} mins
                        </span>
                      </div>

                      {/* Daily Tasks */}
                      <div className="mt-1.5 space-y-1">
                        {day.tasks.map((task, tidx) => (
                          <div key={tidx} className="flex items-center gap-2 text-xs text-[#17243B]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16805D] shrink-0" />
                            <span className="font-semibold text-[#17243B]">[{task.topic_name}]:</span>
                            <span className="text-[#5B6880]">{task.task_description} ({task.minutes}m)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <Link
                      href="/quiz"
                      className="px-3 py-1.5 bg-[#F7F9FD] hover:bg-[#E8F0FF] text-[#17243B] hover:text-[#2457D6] text-xs font-medium rounded-[6px] border border-[#D8E1EE] transition shadow-xs"
                    >
                      Quiz Self-Check
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamRadarPage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-xs font-medium text-[#5B6880]">
        Loading Exam Radar...
      </div>
    }>
      <ExamRadarContent />
    </Suspense>
  );
}
