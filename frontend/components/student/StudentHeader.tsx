"use client";

import React from "react";
import { StudentDetailResponse } from "@/types/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FineWorksBrand } from "@/components/shared/FineWorksBrand";

interface StudentHeaderProps {
  studentData: StudentDetailResponse | null;
  fallbackName?: string;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSubmitClick: () => void;
  onLogout?: () => void;
  onOpenMessages?: () => void;
  unreadMessagesCount?: number;
}

export const StudentHeader: React.FC<StudentHeaderProps> = ({
  studentData,
  fallbackName = "Student",
  onOpenMenu,
  onOpenProfile,
  onSubmitClick,
  onLogout,
  onOpenMessages,
  unreadMessagesCount = 0,
}) => {
  const fullName = studentData?.full_name || fallbackName;
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "ST";

  return (
    <header className="w-full bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 shadow-2xs transition-colors sticky top-0 z-30">
      <div className="mx-auto flex h-14 sm:h-16 max-w-6xl items-center justify-between px-3.5 sm:px-6">
        {/* Left: Mobile Drawer Trigger & FineWorks Brand */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open student navigation menu"
            className="md:hidden flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <FineWorksBrand role="student" size="md" />
        </div>

        {/* Right: Student Identity, Actions, Theme Toggle & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Student Info: Desktop only */}
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {fullName}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal leading-tight mt-0.5">
              {studentData?.profile?.register_number || studentData?.email || "Student"}
            </span>
          </div>

          {/* Theme Toggle Button */}
          <ThemeToggle size="sm" />

          {/* Messages & Remarks Quick Action */}
          {onOpenMessages && (
            <button
              type="button"
              onClick={onOpenMessages}
              aria-label="View messages and remarks"
              title="Messages & Remarks"
              className="relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            >
              <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white shadow-xs">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
          )}

          {/* Quick Submit Activity Button */}
          <button
            type="button"
            id="student-header-submit-btn"
            onClick={onSubmitClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Submit Activity</span>
            <span className="sm:hidden">Submit</span>
          </button>

          {/* Sign Out Action */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              id="student-header-signout"
              className="hidden md:inline-flex items-center text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          )}

          {/* Student Profile Avatar Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={`View profile for ${fullName}`}
            className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs active:scale-95 transition-all cursor-pointer"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
};
