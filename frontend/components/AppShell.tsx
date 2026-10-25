"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { DeleteDataModal } from "@/components/DeleteDataModal";
import { ToastProvider } from "@/components/Toast";
import {
  getOrCreateWorkspaceId,
  getSavedLanguage,
  LanguageCode,
} from "@/lib/workspace";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
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
  };

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-[#F3F6FB] text-[#17243B]">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onOpenDeleteModal={() => setDeleteModalOpen(true)}
        />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#F3F6FB]">
          <Navbar
            currentLanguage={language}
            onLanguageChange={setLanguage}
            onOpenDeleteModal={() => setDeleteModalOpen(true)}
            onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            workspaceId={workspaceId}
          />
          <main className="flex-1 min-h-0 overflow-y-auto flex flex-col bg-[#F3F6FB]">
            {children}
          </main>
        </div>
      </div>

      <DeleteDataModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        workspaceId={workspaceId}
        onDeleted={handleDeleted}
      />
    </ToastProvider>
  );
}
