"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useBodyLock } from "@/lib/use-body-lock";
import { ThemeToggle } from "@/components/ThemeToggle";

interface MentorMobileActionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mentorName: string;
  mentorEmail: string;
  department: string;
  menteeCount: number;
  canSwitchToHOD: boolean;
  onSwitchToHOD: () => void;
  onExportClick: () => void;
  onRefreshClick: () => void;
  onManualPointsClick?: () => void;
  onLogout: () => void;
}

export const MentorMobileActionsDrawer: React.FC<MentorMobileActionsDrawerProps> = ({
  isOpen,
  onClose,
  mentorName,
  mentorEmail,
  department,
  menteeCount,
  canSwitchToHOD,
  onSwitchToHOD,
  onExportClick,
  onRefreshClick,
  onManualPointsClick,
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
        aria-label="Mentor Actions"
        className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-[#111111] rounded-t-3xl border-t border-slate-200/90 dark:border-white/10 shadow-2xl p-5 safe-pb flex flex-col overflow-y-auto animate-apple-sheet-up transition-colors"
      >
        {/* Apple Drag Handle */}
        <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />

        {/* Identity Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 dark:border-[#292929]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-green-700 dark:from-[#337418] dark:to-[#5DD62C] text-white font-bold text-base shadow-sm">
            {mentorName
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("") || "FM"}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-[#F5F5F5] text-base leading-snug truncate">
              {mentorName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A3A3A3] truncate font-mono">
              {mentorEmail}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-[#337418]/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-[#5DD62C] border border-emerald-200/80 dark:border-[#337418]">
                {department} &bull; {menteeCount} Mentees
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-[#222222] text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Controls List */}
        <div className="py-3 space-y-2">
          {/* Dual Portal Switch: Go to HOD Dashboard */}
          {canSwitchToHOD && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToHOD();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-900 dark:text-purple-200 transition-all font-semibold text-xs active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-700 text-white shadow-2xs">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-bold text-purple-900 dark:text-purple-100 text-xs">Go to HOD Dashboard</p>
                  <p className="text-[10px] text-purple-700 dark:text-purple-300">Department Administration &amp; Approvals</p>
                </div>
              </div>
              <svg className="h-4 w-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Award Manual Points Action */}
          {onManualPointsClick && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onManualPointsClick();
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#2e2e2e] bg-slate-50/60 dark:bg-[#202020] hover:bg-slate-100 dark:hover:bg-[#282828] text-slate-800 dark:text-[#F8F8F8] transition-all font-semibold text-xs active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 dark:bg-[#337418] text-white">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900 dark:text-[#F8F8F8] text-xs">Award Manual Points</p>
                  <p className="text-[10px] text-slate-500 dark:text-[#B0B0B0]">Semester-wise points for 14 PGPA components</p>
                </div>
              </div>
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Export Report Action */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onExportClick();
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#292929] bg-slate-50/60 dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-800 dark:text-[#F5F5F5] transition-all font-semibold text-xs active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#F5F5F5] text-xs">Export Mentee PGPA Data</p>
                <p className="text-[10px] text-slate-500 dark:text-[#A3A3A3]">Official Excel &amp; PDF Department Reports</p>
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
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#292929] bg-slate-50/60 dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-800 dark:text-[#F5F5F5] transition-all font-semibold text-xs active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#F5F5F5] text-xs">Refresh Submissions</p>
                <p className="text-[10px] text-slate-500 dark:text-[#A3A3A3]">Sync authoritative records from database</p>
              </div>
            </div>
          </button>

          {/* Change Password */}
          <Link
            href="/change-password"
            onClick={onClose}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200/90 dark:border-[#292929] bg-slate-50/60 dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222222] text-slate-800 dark:text-[#F5F5F5] transition-all font-semibold text-xs active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-white">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-900 dark:text-[#F5F5F5] text-xs">Security &amp; Password</p>
                <p className="text-[10px] text-slate-500 dark:text-[#A3A3A3]">Update login credentials</p>
              </div>
            </div>
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Footer: Theme toggle & Sign out */}
        <div className="pt-3 border-t border-slate-100 dark:border-[#292929] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-[#A3A3A3] font-medium">Appearance:</span>
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

