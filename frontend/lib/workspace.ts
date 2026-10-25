"use client";

/**
 * Workspace and session management for ClearDesk.
 * Stores a persistent workspace_id and language setting in localStorage.
 */

export type LanguageCode = "en" | "hi" | "te";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  native: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "\u0939\u093F\u0928\u094D\u0926\u0940" },
  { code: "te", label: "Telugu", native: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41" },
];

const WORKSPACE_KEY = "cleardesk_workspace_id";
const LANGUAGE_KEY = "cleardesk_language";

export function getOrCreateWorkspaceId(overrideWs?: string | null): string {
  if (overrideWs && overrideWs.trim()) {
    const clean = overrideWs.trim();
    if (typeof window !== "undefined") {
      localStorage.setItem(WORKSPACE_KEY, clean);
    }
    return clean;
  }
  if (typeof window === "undefined") {
    return "default-workspace";
  }

  // Support URL parameter override (e.g. ?workspace_id=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramWs = urlParams.get("workspace_id");
    if (paramWs && paramWs.trim()) {
      const clean = paramWs.trim();
      localStorage.setItem(WORKSPACE_KEY, clean);
      return clean;
    }
  } catch {
    // Ignore in non-browser environments
  }

  let wsId = localStorage.getItem(WORKSPACE_KEY);
  if (!wsId) {
    wsId = crypto.randomUUID();
    localStorage.setItem(WORKSPACE_KEY, wsId);
  }
  return wsId;
}

export function resetWorkspaceData(): string {
  if (typeof window === "undefined") return "default-workspace";
  const newId = crypto.randomUUID();
  localStorage.setItem(WORKSPACE_KEY, newId);
  return newId;
}

export function getSavedLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(LANGUAGE_KEY) as LanguageCode | null;
  if (saved && (saved === "en" || saved === "hi" || saved === "te")) {
    return saved;
  }
  return "en";
}

export function saveLanguage(lang: LanguageCode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANGUAGE_KEY, lang);
}
