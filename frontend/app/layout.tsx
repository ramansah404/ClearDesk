import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "ClearDesk — AI Document Intelligence Workspace",
  description:
    "AI-powered document intelligence workspace for students and office workers with cited answers, keyword notes, action boards, and exam radar.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/branding/cleardesk-icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/branding/cleardesk-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
