"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  FileText,
  BookOpen,
  StickyNote,
  CheckSquare,
  Target,
  HelpCircle,
  Plus,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenDeleteModal?: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("cleardesk_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("cleardesk_sidebar_collapsed", String(next));
      return next;
    });
  };

  const navSections = [
    {
      title: "Collect",
      items: [
        {
          name: "Sources",
          href: "/upload",
          icon: FileText,
        },
      ],
    },
    {
      title: "Process",
      items: [
        {
          name: "Research & Ask",
          href: "/ask",
          icon: BookOpen,
        },
        {
          name: "3-Level Notes",
          href: "/notes",
          icon: StickyNote,
        },
      ],
    },
    {
      title: "Action & Planning",
      items: [
        {
          name: "Action Board",
          href: "/action-board",
          icon: CheckSquare,
        },
        {
          name: "Exam Radar",
          href: "/exam-radar",
          icon: Target,
        },
        {
          name: "Quiz Drills",
          href: "/quiz",
          icon: HelpCircle,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#D8E1EE] bg-[#EAF0F8] text-[#17243B] transition-all duration-200 ease-out md:static ${
          isCollapsed ? "w-16" : "w-64"
        } ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Header with Prominent ClearDesk brand */}
        <div
          className={`flex h-[76px] items-center border-b border-[#D8E1EE] px-3.5 ${
            isCollapsed && !mobileOpen ? "justify-center px-2" : "justify-between"
          }`}
        >
          {isCollapsed && !mobileOpen ? (
            <div className="relative flex items-center justify-center w-full group">
              <Link
                href="/"
                className="relative h-11 w-11 shrink-0 transition-opacity group-hover:opacity-0"
                title="ClearDesk Home"
              >
                <Image
                  src="/branding/cleardesk-icon.png"
                  alt="ClearDesk"
                  width={44}
                  height={44}
                  priority
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </Link>
              <button
                onClick={toggleCollapse}
                className="absolute rounded-md p-1.5 text-[#17243B] hover:bg-[#DDE7F5] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/"
                onClick={onCloseMobile}
                className="flex items-center gap-3.5 transition-opacity hover:opacity-90"
                title="ClearDesk Home"
              >
                <div className="relative h-[46px] w-[46px] shrink-0">
                  <Image
                    src="/branding/cleardesk-icon.png"
                    alt="ClearDesk icon"
                    width={46}
                    height={46}
                    priority
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="relative h-[46px] w-[138px] shrink-0">
                  <Image
                    src="/branding/cleardesk-wordmark.png"
                    alt="ClearDesk"
                    width={138}
                    height={46}
                    priority
                    unoptimized
                    className="h-full w-full object-contain object-left"
                  />
                </div>
              </Link>
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleCollapse}
                  className="hidden md:flex rounded-md p-1.5 text-[#5B6880] hover:bg-[#DDE7F5] hover:text-[#17243B] transition cursor-pointer"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={onCloseMobile}
                  className="flex md:hidden rounded-md p-1.5 text-[#5B6880] hover:bg-[#DDE7F5]"
                  aria-label="Close sidebar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Primary Action Button: + Add Document (Solid Blue #2457D6) */}
        <div className={`p-3 border-b border-[#D8E1EE] ${isCollapsed && !mobileOpen ? "px-2" : "px-3"}`}>
          <Link
            href="/upload"
            onClick={onCloseMobile}
            title="Add Documents"
            className={`flex items-center justify-center gap-2 rounded-[6px] bg-[#2457D6] hover:bg-[#1947B8] text-white font-semibold text-[13.5px] py-2.5 shadow-xs transition-colors cursor-pointer ${
              isCollapsed && !mobileOpen ? "px-0 w-full" : "w-full px-3"
            }`}
          >
            <Plus className="h-4 w-4 shrink-0 stroke-[2.5]" />
            {(!isCollapsed || mobileOpen) && <span>Add Document</span>}
          </Link>
        </div>

        {/* Navigation Sections */}
        <nav className={`flex-1 space-y-4 overflow-y-auto py-3.5 pb-6 ${isCollapsed && !mobileOpen ? "px-2" : "px-3"}`}>
          {navSections.map((section, idx) => (
            <div key={section.title} className="space-y-1">
              {idx > 0 && <div className="my-2.5 border-t border-[#D8E1EE]/70" />}
              {(!isCollapsed || mobileOpen) && (
                <div className="px-2.5 pt-1.5 pb-1 text-[11.5px] font-bold uppercase tracking-wider text-[#53627A]">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={item.name}
                    className={`relative flex items-center gap-3 rounded-[6px] py-2 text-[14px] leading-normal font-medium transition ${
                      isCollapsed && !mobileOpen ? "justify-center px-0" : "px-3 justify-start"
                    } ${
                      isActive
                        ? "bg-[#E8F0FF] font-semibold text-[#2457D6] border border-[#D4E4FC] shadow-2xs before:absolute before:-left-1.5 before:top-[6px] before:bottom-[6px] before:w-[3px] before:rounded-r before:bg-[#2457D6]"
                        : "text-[#17243B] hover:bg-[#DDE7F5] hover:text-[#0F172A]"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-[#2457D6]" : "text-[#5B6880]"}`} />
                    {(!isCollapsed || mobileOpen) && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
