"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { DeleteDataModal } from "@/components/DeleteDataModal";
import {
  getOrCreateWorkspaceId,
  getSavedLanguage,
  LanguageCode,
} from "@/lib/workspace";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [language, setLanguage] = useState<LanguageCode>("en");

  useEffect(() => {
    setWorkspaceId(getOrCreateWorkspaceId());
    setLanguage(getSavedLanguage());
  }, []);

  const handleDeleted = (newWorkspaceId: string) => {
    setWorkspaceId(newWorkspaceId);
    // Optionally trigger a page reload or state reset
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Left Sidebar */}
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <Navbar
          currentLanguage={language}
          onLanguageChange={setLanguage}
          onOpenDeleteModal={() => setDeleteModalOpen(true)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          workspaceId={workspaceId}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Privacy / Delete Modal */}
      <DeleteDataModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
