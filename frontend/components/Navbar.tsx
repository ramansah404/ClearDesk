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

const PAGE_TITLES: Record<string, { title: string; category: string }> = {
  "/": { title: "Overview", category: "Workspace" },
  "/upload": { title: "Sources", category: "Collect" },
  "/ask": { title: "Research & Ask", category: "Process" },
  "/notes": { title: "3-Level Notes", category: "Process" },
  "/action-board": { title: "Action Board", category: "Action & Planning" },
  "/exam-radar": { title: "Exam Radar", category: "Action & Planning" },
  "/quiz": { title: "Quiz Drills", category: "Action & Planning" },
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
    category: "Workspace",
  };

  const selectedLang = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];

  const handleSelectLanguage = (code: LanguageCode) => {
    saveLanguage(code);
    onLanguageChange(code);
    setLangMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-[#D8E1EE] bg-white px-4 md:px-6">
      {/* Left: Mobile hamburger & Breadcrumb Trail */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleMobileSidebar}
          className="rounded-[6px] p-1.5 text-[#5B6880] hover:bg-[#F7F9FD] md:hidden cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-xs md:text-[13px]">
          <span className="text-[#5B6880] font-medium">{pageInfo.category}</span>
          <span className="text-[#C4D0E0]">/</span>
          <span className="font-semibold text-[#17243B]">{pageInfo.title}</span>
          <span className="hidden sm:inline-flex items-center rounded-[4px] border border-[#D8E1EE] bg-[#F7F9FD] px-2 py-0.5 text-[10.5px] font-mono text-[#5B6880] ml-1.5">
            {workspaceId ? workspaceId.slice(0, 8) : "Active"}
          </span>
        </div>
      </div>

      {/* Right: Language Selector & Workspace Reset */}
      <div className="flex items-center gap-2">
        {/* Language Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setLangMenuOpen(!langMenuOpen)}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D8E1EE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#17243B] hover:bg-[#F7F9FD] transition cursor-pointer"
            aria-label="Select application language"
          >
            <Globe className="h-3.5 w-3.5 text-[#5B6880]" />
            <span className="hidden sm:inline">{selectedLang.native}</span>
            <span className="sm:hidden uppercase">{selectedLang.code}</span>
            <ChevronDown className="h-3 w-3 text-[#5B6880]" />
          </button>

          {langMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setLangMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1.5 w-44 rounded-[6px] border border-[#D8E1EE] bg-white p-1 shadow-[0_8px_24px_rgba(23,36,59,0.12)] z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] font-bold text-[#78869B] uppercase tracking-wider">
                  Select Language
                </div>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`flex w-full items-center justify-between rounded-[4px] px-2 py-1.5 text-xs transition cursor-pointer ${
                      currentLanguage === lang.code
                        ? "bg-[#E8F0FF] font-semibold text-[#2457D6]"
                        : "text-[#17243B] hover:bg-[#F7F9FD]"
                    }`}
                  >
                    <div className="flex flex-col text-left">
                      <span>{lang.native}</span>
                      <span className="text-[10px] text-[#5B6880]">{lang.label}</span>
                    </div>
                    {currentLanguage === lang.code && (
                      <Check className="h-3.5 w-3.5 text-[#2457D6]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Reset Workspace Button */}
        <button
          onClick={onOpenDeleteModal}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D8E1EE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#5B6880] hover:bg-[#FDF2F2] hover:text-[#C43D4B] hover:border-[#C43D4B]/30 transition cursor-pointer"
          title="Reset Workspace and clear documents"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset Workspace</span>
          <span className="sm:hidden">Reset</span>
        </button>
      </div>
    </header>
  );
}
