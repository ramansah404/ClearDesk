"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  StickyNote,
  FileDown,
  Layers,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  FileText,
  RotateCcw,
  AlertCircle,
  Sparkles,
  Info,
  Check,
  ArrowRight,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

import {
  fetchFiles,
  FileItem,
  fetchNotes,
  regenerateNotes,
  getRevisionSheetUrl,
  NotesResponse,
  NoteSection,
  API_BASE_URL,
} from "@/lib/api";
import {
  getOrCreateWorkspaceId,
  getSavedLanguage,
  saveLanguage,
  LanguageCode,
  LANGUAGES,
} from "@/lib/workspace";

export default function NotesPage() {
  const { showToast } = useToast();
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [activeLang, setActiveLang] = useState<LanguageCode>("en");

  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);

  const [notesData, setNotesData] = useState<NotesResponse | null>(null);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Map of sectionId -> expanded (for Level 3 explanations)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const [hasProcessingFiles, setHasProcessingFiles] = useState<boolean>(false);

  const loadReadyFiles = useCallback(async (ws: string, showLoading = true) => {
    if (!ws) return [];
    if (showLoading) setLoadingFiles(true);
    const res = await fetchFiles(ws);
    let allFiles: FileItem[] = [];
    if (res.ok && res.data) {
      allFiles = res.data;
      const ready = allFiles.filter((f) => f.status === "ready");
      setFiles(ready);
      setSelectedFileId((prev) => {
        if (prev && ready.some((f) => f.id === prev)) return prev;
        return ready.length > 0 ? ready[0].id : "";
      });
    }
    if (showLoading) setLoadingFiles(false);
    return allFiles;
  }, []);

  useEffect(() => {
    const ws = getOrCreateWorkspaceId();
    setWorkspaceId(ws);
    const savedLang = getSavedLanguage();
    setActiveLang(savedLang);
    loadReadyFiles(ws, true).then((all) => {
      setHasProcessingFiles(all.some((f) => f.status === "processing"));
    });
  }, [loadReadyFiles]);

  // Background polling for files in processing state
  useEffect(() => {
    if (!workspaceId || !hasProcessingFiles) return;

    const timer = setInterval(() => {
      loadReadyFiles(workspaceId, false).then((all) => {
        setHasProcessingFiles(all.some((f) => f.status === "processing"));
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [workspaceId, hasProcessingFiles, loadReadyFiles]);

  const loadNotesForFile = useCallback(
    async (fileId: string, ws: string, lang: LanguageCode) => {
      if (!fileId || !ws) return;
      setLoadingNotes(true);
      setErrorMessage(null);

      const res = await fetchNotes(fileId, ws, lang);
      if (res.ok && res.data) {
        setNotesData(res.data);
        const exp: Record<string, boolean> = {};
        res.data.sections.forEach((s) => {
          exp[s.id] = true;
        });
        setExpandedSections(exp);
      } else {
        setErrorMessage(res.error || "Failed to load notes for this document.");
        setNotesData(null);
      }
      setLoadingNotes(false);
    },
    []
  );

  useEffect(() => {
    if (selectedFileId && workspaceId) {
      loadNotesForFile(selectedFileId, workspaceId, activeLang);
    }
  }, [selectedFileId, workspaceId, activeLang, loadNotesForFile]);

  // Handle language switch
  const handleLanguageChange = (lang: LanguageCode) => {
    setActiveLang(lang);
    saveLanguage(lang);
    const langName = LANGUAGES.find((l) => l.code === lang)?.label || lang;
    showToast(`Switched notes language to ${langName}.`, "info");
  };

  // Handle manual regenerate
  const handleRegenerate = async () => {
    if (!selectedFileId || regenerating || loadingNotes) return;
    setRegenerating(true);
    setErrorMessage(null);

    const res = await regenerateNotes(selectedFileId, workspaceId, activeLang);
    if (res.ok && res.data) {
      setNotesData(res.data);
      const exp: Record<string, boolean> = {};
      res.data.sections.forEach((s) => {
        exp[s.id] = true;
      });
      setExpandedSections(exp);
      showToast("Notes regenerated successfully!", "success");
    } else {
      const errMsg = res.error || "Failed to regenerate notes.";
      setErrorMessage(errMsg);
      showToast(errMsg, "error");
    }
    setRegenerating(false);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const toggleAll = (expand: boolean) => {
    if (!notesData) return;
    const next: Record<string, boolean> = {};
    notesData.sections.forEach((s) => {
      next[s.id] = expand;
    });
    setExpandedSections(next);
  };

  const readyFiles = files.filter((f) => f.status === "ready");
  const selectedFile = readyFiles.find((f) => f.id === selectedFileId);

  return (
    <div className="flex flex-col flex-1 min-h-0 px-4 md:px-6 py-6 max-w-5xl w-full mx-auto space-y-6">
      {/* Header with Title and Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#D8E1EE] pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden className="h-3.5 w-[3px] rounded-full bg-[#B7791F]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#17243B]">
              3-Level Structured Notes
            </h1>
          </div>
          <p className="text-xs md:text-sm text-[#5B6880]">
            Progressive cognitive hierarchy: Level 1 Keywords, Level 2 Core Meaning, and Level 3 Deep Principles. Technical terms remain in English across all translations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language Switcher Segment Control */}
          <div className="inline-flex rounded-[6px] border border-[#D8E1EE] bg-white p-0.5 shadow-xs">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  activeLang === lang.code
                    ? "bg-[#2457D6] text-white font-semibold"
                    : "text-[#5B6880] hover:text-[#17243B] hover:bg-[#F7F9FD]"
                }`}
              >
                <span>{lang.native}</span>
                {activeLang === lang.code && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>

          {/* Regenerate Button */}
          {selectedFileId && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating || loadingNotes}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D8E1EE] bg-white px-2.5 py-1.5 text-xs font-medium text-[#17243B] shadow-xs hover:bg-[#F7F9FD] transition cursor-pointer disabled:opacity-50"
              title="Re-extract and regenerate 3-level notes"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 text-[#5B6880] ${
                  regenerating ? "animate-spin text-[#2457D6]" : ""
                }`}
              />
              <span>{regenerating ? "Regenerating..." : "Regenerate"}</span>
            </button>
          )}

          {/* Export 1-Page PDF */}
          {selectedFileId ? (
            <a
              href={getRevisionSheetUrl(selectedFileId, workspaceId)}
              download={`revision_sheet_${selectedFileId.slice(0, 8)}.pdf`}
              onClick={() => {
                showToast("Downloading single-page revision sheet...", "info");
              }}
              className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#2457D6] hover:bg-[#1947B8] text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm transition cursor-pointer"
              title="Download guaranteed 1-page A4 PDF revision sheet"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Export 1-Page PDF</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D8E1EE] bg-white px-3 py-1.5 text-xs font-medium text-[#78869B] opacity-60 cursor-not-allowed"
            >
              <FileDown className="h-3.5 w-3.5 text-[#78869B]" />
              <span>Export 1-Page PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Document Selector Bar */}
      {readyFiles.length > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[6px] border border-[#D8E1EE] bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#5B6880]">
              Reading Source:
            </span>
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="rounded-[6px] border border-[#D8E1EE] bg-white py-1 pl-2.5 pr-8 text-xs font-medium text-[#17243B] focus:border-[#2457D6] focus:outline-none cursor-pointer"
            >
              {readyFiles.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.page_count} {f.page_count === 1 ? "page" : "pages"})
                </option>
              ))}
            </select>
          </div>

          {notesData && notesData.sections.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => toggleAll(true)}
                className="text-[#5B6880] hover:text-[#17243B] font-medium transition cursor-pointer"
              >
                Expand all
              </button>
              <span className="text-[#C4D0E0]">•</span>
              <button
                type="button"
                onClick={() => toggleAll(false)}
                className="text-[#5B6880] hover:text-[#17243B] font-medium transition cursor-pointer"
              >
                Collapse all
              </button>
            </div>
          )}
        </div>
      ) : (
        !loadingFiles && (
          <div className="rounded-[6px] border border-[#B7791F]/30 bg-[#FEF8E7] p-4 flex items-start gap-3 text-xs text-[#17243B]">
            <AlertCircle className="h-4 w-4 text-[#B7791F] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#17243B]">
                No indexed documents in this workspace yet
              </p>
              <p className="text-[#5B6880]">
                Upload lecture slides, syllabus, or course notes first to automatically generate 3-level keyword notes.
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1 font-semibold text-[#2457D6] hover:underline pt-1"
              >
                <span>Go to Document Sources</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )
      )}

      {/* Mother-Tongue Mode Indicator */}
      {activeLang !== "en" && (
        <div className="rounded-[6px] border border-[#2457D6]/20 bg-[#E8F0FF] p-3 flex items-start gap-2.5 text-xs text-[#17243B]">
          <Globe className="h-4 w-4 text-[#2457D6] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-[#2457D6]">Mother-Tongue Reading Mode Active: </span>
            Explanations are translated into {LANGUAGES.find((l) => l.code === activeLang)?.label || activeLang}. All technical terms, formulas, code snippets, and proper nouns are strictly preserved in English to prevent academic ambiguity.
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="rounded-[6px] border border-[#C43D4B]/30 bg-[#FDF2F2] p-3 text-xs text-[#C43D4B] flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-[#C43D4B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Error loading notes: </span>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loadingNotes ? (
        <div className="py-20 text-center space-y-3 rounded-[6px] border border-[#D8E1EE] bg-white shadow-sm">
          <Loader2 className="h-8 w-8 text-[#2457D6] animate-spin mx-auto" />
          <p className="text-xs font-medium text-[#17243B]">
            Extracting 3-level cognitive hierarchy...
          </p>
          <p className="text-[11px] text-[#5B6880]">
            Preserving exact technical terms while distilling Level 1 keywords and Level 2 definitions.
          </p>
        </div>
      ) : notesData && notesData.sections.length > 0 ? (
        /* Notes Section List */
        <div className="space-y-4">
          {notesData.sections.map((section: NoteSection, idx: number) => {
            const isExpanded = expandedSections[section.id] ?? true;
            const pagesText = section.source_pages && section.source_pages.length > 0
              ? section.source_pages.join(", ")
              : String(idx + 1);

            return (
              <div
                key={section.id || idx}
                className="rounded-[6px] border border-[#D8E1EE] bg-white p-4.5 space-y-3.5 shadow-sm hover:border-[#C4D0E0] transition"
              >
                {/* Section Header */}
                <div className="flex items-start justify-between gap-3 border-b border-[#D8E1EE] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded-[4px] border border-[#B7791F]/30 bg-[#FEF8E7] text-[#B7791F] px-2 py-0.5 text-[10px] font-mono font-bold">
                      p. {pagesText}
                    </span>
                    <h3 className="text-sm font-semibold text-[#17243B] tracking-tight">
                      {section.section_title || `Section ${idx + 1}`}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="text-[#5B6880] hover:text-[#17243B] p-1 rounded-[4px] transition cursor-pointer"
                    title={isExpanded ? "Collapse Level 3" : "Expand Level 3"}
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Level 1: Keywords */}
                {section.level1_keywords && section.level1_keywords.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#78869B]">
                      Level 1 • Key Terms & Anchors
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {section.level1_keywords.map((kw: string, i: number) => (
                        <span
                          key={i}
                          className="rounded-[4px] border border-[#D4E4FC] bg-[#E8F0FF] px-2 py-0.5 text-[11px] font-mono text-[#2457D6] font-medium shadow-xs"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Level 2: Core Meaning */}
                {section.level2_meaning && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#78869B]">
                      Level 2 • Core Meaning & Definitions
                    </span>
                    <div className="rounded-[6px] border border-[#D8E1EE] bg-[#F7F9FD] p-3 text-xs text-[#17243B] font-medium leading-relaxed">
                      {section.level2_meaning}
                    </div>
                  </div>
                )}

                {/* Level 3: Deep Principle (Collapsible) */}
                {isExpanded && section.level3_explanation && (
                  <div className="space-y-1.5 pt-2 border-t border-[#D8E1EE]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#78869B]">
                      Level 3 • Deep Mechanism & Context
                    </span>
                    <div className="text-xs text-[#5B6880] leading-relaxed whitespace-pre-wrap">
                      {section.level3_explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

