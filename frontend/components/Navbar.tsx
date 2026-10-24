"use client";

import React, { useState } from "react";
import { usePathname } from "next/navigation";
import {
  Globe,
  Trash2,
  Menu,
  Check,
  ChevronDown,
} from "lucide-react";
import { LANGUAGES, LanguageCode, saveLanguage } from "@/lib/workspace";

interface NavbarProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onOpenDeleteModal: () => void;
  onToggleMobileSidebar: () => void;
  workspaceId: string;
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Workspace Overview", subtitle: "ClearDesk AI Workspace" },
  "/upload": { title: "Upload Documents", subtitle: "Mixed file ingestion & processing" },
  "/notes": { title: "3-Level Notes", subtitle: "Keyword-first notes & translation" },
  "/ask": { title: "Cited Q&A", subtitle: "Grounded answers with page citations" },
  "/action-board": { title: "Action Board", subtitle: "Deadlines, deliverables & conflicts" },
  "/exam-radar": { title: "Exam Radar", subtitle: "Syllabus rank & day-wise revision plan" },
  "/quiz": { title: "Revision Quiz", subtitle: "MCQs from your own material" },
};

export function Navbar({
  currentLanguage,
  onLanguageChange,
  onOpenDeleteModal,
  onToggleMobileSidebar,
  workspaceId,
}: NavbarProps) {
  const pathname = usePathname();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const pageInfo = PAGE_TITLES[pathname] || {
    title: "ClearDesk",
    subtitle: "AI Workspace",
  };

  const selectedLang = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];

  const handleSelectLanguage = (code: LanguageCode) => {
    saveLanguage(code);
    onLanguageChange(code);
    setLangMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-4 md:px-8 backdrop-blur-md">
      {/* Left: Mobile hamburger & Page Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-semibold text-slate-900 tracking-tight">
              {pageInfo.title}
            </h1>
            <span className="hidden sm:inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              Session: {workspaceId ? workspaceId.slice(0, 8) : "Active"}
            </span>
          </div>
          <p className="hidden md:block text-xs text-slate-500">{pageInfo.subtitle}</p>
        </div>
      </div>

      {/* Right: Language Selector & Delete Data */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs md:text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition"
            aria-label="Select application language"
          >
            <Globe className="h-4 w-4 text-slate-500" />
            <span className="hidden sm:inline">{selectedLang.native}</span>
            <span className="sm:hidden uppercase">{selectedLang.code}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {langMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100 z-50">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Language / भाषा / భాష
              </div>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    currentLanguage === lang.code
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span>{lang.native}</span>
                    <span className="text-[10px] text-slate-400">{lang.label}</span>
                  </div>
                  {currentLanguage === lang.code && (
                    <Check className="h-3.5 w-3.5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete My Data Button */}
        <button
          onClick={onOpenDeleteModal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-1.5 text-xs md:text-sm font-medium text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition"
          title="Permanently erase all your workspace data"
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
          <span className="hidden sm:inline">Delete My Data</span>
          <span className="sm:hidden">Reset</span>
        </button>
      </div>
    </header>
  );
}
