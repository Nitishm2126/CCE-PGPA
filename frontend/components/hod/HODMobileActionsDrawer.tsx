"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useBodyLock } from "@/lib/use-body-lock";
import { ThemeToggle } from "@/components/ThemeToggle";

interface HODMobileActionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  hodName: string;
  hodEmail: string;
  department: string;
  studentCount: number;
  onSelectTab: (tab: "submissions" | "students" | "overview" | "messages" | "excel-import" | "pgpa-grades") => void;
  onSwitchToMentor: () => void;
  onExportClick: () => void;
  onRefreshClick: () => void;
  onLogout: () => void;
}

export const HODMobileActionsDrawer: React.FC<HODMobileActionsDrawerProps> = ({
  isOpen,
  onClose,
  hodName,
  hodEmail,
  department,
  studentCount,
  onSelectTab,
  onSwitchToMentor,
  onExportClick,
  onRefreshClick,
  onLogout,
}) => {
  useBodyLock(isOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs transition-opacity animate-apple-sheet-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="HOD Actions & Tools"
        className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-[#171e28] rounded-t-3xl border-t border-slate-200/90 dark:border-white/10 shadow-2xl p-5 safe-pb flex flex-col overflow-y-auto animate-apple-sheet-up transition-colors"
      >
        {/* Apple Drag Handle */}
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

        {/* Identity Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 dark:border-[#2b3543]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-700 text-white font-bold text-base shadow-sm">
            {hodName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("") || "HOD"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-[#e8edf4] text-base leading-snug truncate">
              {hodName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#a0acbc] truncate font-mono">
              {hodEmail}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-900">
                Head of Department &bull; {department} ({studentCount} Students)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-[#232d3b] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action & Tools List */}
        <div className="py-3 space-y-2">
          {/* Dual Portal Switch: Go to Mentor Portal */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSwitchToMentor();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-900 dark:text-blue-200 transition-all font-semibold text-xs active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-bold text-blue-900 dark:text-blue-100 text-xs">Go to Mentor Portal</p>
                <p className="text-[10px] text-blue-700 dark:text-blue-300">Evaluate your 11 assigned mentees</p>
              </div>
            </div>
            <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* PGPA Grades Matrix */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectTab("pgpa-grades");
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#2b3543] bg-slate-50/60 dark:bg-[#1c2531] hover:bg-slate-100 dark:hover:bg-[#232d3b] text-slate-800 dark:text-[#e8edf4] transition-all font-semibold text-xs active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-700 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#e8edf4] text-xs">PGPA Grades Matrix</p>
                <p className="text-[10px] text-slate-500 dark:text-[#a0acbc]">5-Component calculation &amp; credits breakdown</p>
              </div>
            </div>
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Excel Batch Import */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectTab("excel-import");
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#2b3543] bg-slate-50/60 dark:bg-[#1c2531] hover:bg-slate-100 dark:hover:bg-[#232d3b] text-slate-800 dark:text-[#e8edf4] transition-all font-semibold text-xs active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#e8edf4] text-xs">Excel Batch Import</p>
                <p className="text-[10px] text-slate-500 dark:text-[#a0acbc]">Batch upload semester credits &amp; grades</p>
              </div>
            </div>
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Export Department Report */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onExportClick();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#2b3543] bg-slate-50/60 dark:bg-[#1c2531] hover:bg-slate-100 dark:hover:bg-[#232d3b] text-slate-800 dark:text-[#e8edf4] transition-all font-semibold text-xs active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#e8edf4] text-xs">Export Department PGPA Report</p>
                <p className="text-[10px] text-slate-500 dark:text-[#a0acbc]">Official CCE Excel &amp; PDF Department Reports</p>
              </div>
            </div>
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Refresh Data */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onRefreshClick();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#2b3543] bg-slate-50/60 dark:bg-[#1c2531] hover:bg-slate-100 dark:hover:bg-[#232d3b] text-slate-800 dark:text-[#e8edf4] transition-all font-semibold text-xs active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#e8edf4] text-xs">Refresh Department Data</p>
                <p className="text-[10px] text-slate-500 dark:text-[#a0acbc]">Sync all 61 students &amp; submissions</p>
              </div>
            </div>
          </button>

          {/* Change Password */}
          <Link
            href="/change-password"
            onClick={onClose}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#2b3543] bg-slate-50/60 dark:bg-[#1c2531] hover:bg-slate-100 dark:hover:bg-[#232d3b] text-slate-800 dark:text-[#e8edf4] transition-all font-semibold text-xs active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#e8edf4] text-xs">Security &amp; Password</p>
                <p className="text-[10px] text-slate-500 dark:text-[#a0acbc]">Update credentials</p>
              </div>
            </div>
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#2b3543] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-[#a0acbc] font-medium">Appearance:</span>
            <ThemeToggle />
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-semibold text-xs active:scale-95 transition-all cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

