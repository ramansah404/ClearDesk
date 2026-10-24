"use client";

import React, { useState } from "react";
import {
  Target,
  Calendar,
  Clock,
  Sparkles,
  BarChart3,
  BookOpen,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export default function ExamRadarPage() {
  const [examDate, setExamDate] = useState("2026-11-15");
  const [dailyHours, setDailyHours] = useState("3");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Exam Radar & Revision Planner
        </h2>
        <p className="text-sm text-slate-500">
          Combines syllabus weight and past-paper frequency to rank high-yield topics and construct a backward day-wise plan.
        </p>
      </div>

      {/* Plan Configuration Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Exam Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Study Hours Per Day
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition"
            >
              <Sparkles className="h-4 w-4" />
              <span>Generate Revision Plan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ranked Topics & Day-wise Plan Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Ranked High-Yield Topics */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Ranked High-Yield Topics
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Formula: 0.5·Freq + 0.3·Marks + 0.2·Weight
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  name: "Gradient Descent & Backpropagation",
                  freq: "4x past papers",
                  priority: 92,
                  color: "bg-rose-500",
                  tag: "High Yield",
                },
                {
                  name: "Convolutional Neural Networks (CNNs)",
                  freq: "3x past papers",
                  priority: 78,
                  color: "bg-amber-500",
                  tag: "Medium Yield",
                },
                {
                  name: "Activation Functions & Regularization",
                  freq: "2x past papers",
                  priority: 64,
                  color: "bg-blue-500",
                  tag: "Moderate",
                },
              ].map((topic, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 space-y-2 hover:bg-white hover:border-slate-200 transition"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{topic.name}</span>
                    <span className="rounded bg-white px-2 py-0.5 font-bold text-slate-700 border border-slate-200 text-[10px]">
                      Score: {topic.priority}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${topic.color}`}
                      style={{ width: `${topic.priority}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>{topic.freq}</span>
                    <a
                      href="/quiz"
                      className="font-medium text-purple-600 hover:text-purple-700 inline-flex items-center gap-1"
                    >
                      Take Quiz <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Backward Day-Wise Schedule */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-600" />
                <h3 className="font-semibold text-slate-900 text-sm">
                  Day-Wise Countdown Plan
                </h3>
              </div>
              <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                Backward Schedule
              </span>
            </div>

            <div className="space-y-2.5">
              {[
                { day: "Day 1 (13 Nov)", focus: "Gradient Descent & Backprop", hrs: "3h" },
                { day: "Day 2 (14 Nov)", focus: "CNN Architectures & Pooling", hrs: "3h" },
                { day: "Day 3 (15 Nov - Exam Eve)", focus: "Full Revision Sheet & Mock Quiz", hrs: "2h" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200/60 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">{item.day}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">{item.focus}</p>
                  </div>
                  <span className="rounded-md bg-white px-2 py-1 font-mono font-bold text-slate-700 border border-slate-200">
                    {item.hrs}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 text-[11px] text-slate-400">
              * Quizzes taken automatically update mastery and dynamically recalibrate the daily allocation.
            </div>
          </div>
        </div>
      </div>

      {/* Phase 0 Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
        <span className="font-semibold text-slate-800">Phase 0 Status: </span>
        The `Topic` and `PlanDay` ORM models are registered. Syllabus and past paper question matching algorithms will be built in <strong>Phase 5: Exam Radar & Quiz</strong>.
      </div>
    </div>
  );
}
