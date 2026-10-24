"use client";

import React, { useEffect, useState } from "react";
import Link from "next/navigation";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  BookOpen,
  MessageSquareQuote,
  CheckSquare,
  Target,
  HelpCircle,
  Sparkles,
  Server,
  X,
} from "lucide-react";
import { checkBackendHealth, HealthCheckResponse } from "@/lib/api";

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS = [
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Upload",
    href: "/upload",
    icon: UploadCloud,
    badge: "Phase 1",
  },
  {
    name: "Notes",
    href: "/notes",
    icon: BookOpen,
    badge: "Phase 3",
  },
  {
    name: "Ask",
    href: "/ask",
    icon: MessageSquareQuote,
    badge: "Phase 2",
  },
  {
    name: "Action Board",
    href: "/action-board",
    icon: CheckSquare,
    badge: "Phase 4",
  },
  {
    name: "Exam Radar",
    href: "/exam-radar",
    icon: Target,
    badge: "Phase 5",
  },
  {
    name: "Quiz",
    href: "/quiz",
    icon: HelpCircle,
    badge: "Phase 5",
  },
];

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [healthStatus, setHealthStatus] = useState<"checking" | "ok" | "offline">("checking");

  useEffect(() => {
    let mounted = true;
    async function ping() {
      const result = await checkBackendHealth();
      if (!mounted) return;
      if (result.ok && result.data) {
        setHealth(result.data);
        setHealthStatus("ok");
      } else {
        setHealthStatus("offline");
      }
    }
    ping();
    const timer = setInterval(ping, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white shadow-xs transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                ClearDesk
              </span>
              <span className="ml-1.5 rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">
                v0.1
              </span>
            </div>
          </a>
          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Workspace Modules
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-50/80 text-blue-700 shadow-xs border border-blue-100 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4.5 w-4.5 transition ${
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        {/* Backend Connectivity Status Footer */}
        <div className="border-t border-slate-100 p-3 bg-slate-50/60">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-slate-400" />
              <div className="text-xs">
                <p className="font-medium text-slate-700">FastAPI Backend</p>
                <p className="text-[10px] text-slate-400">
                  {healthStatus === "ok"
                    ? `v${health?.version || "0.1.0"} · DB Active`
                    : healthStatus === "checking"
                    ? "Connecting..."
                    : "Offline (Port 8000)"}
                </p>
              </div>
            </div>
            <span
              className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                healthStatus === "ok"
                  ? "bg-emerald-500 animate-pulse"
                  : healthStatus === "checking"
                  ? "bg-amber-400"
                  : "bg-rose-400"
              }`}
              title={
                healthStatus === "ok"
                  ? "Backend connected"
                  : healthStatus === "checking"
                  ? "Checking health"
                  : "Backend disconnected"
              }
            />
          </div>
        </div>
      </aside>
    </>
  );
}
