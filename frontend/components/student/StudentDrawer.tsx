"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { StudentDetailResponse } from "@/types/auth";
import { DesignationBadge } from "@/components/DesignationBadge";

interface StudentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studentData: StudentDetailResponse | null;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSubmitClick: () => void;
  onLogout: () => void;
  unreadMessagesCount?: number;
}

export const StudentDrawer: React.FC<StudentDrawerProps> = ({
  isOpen,
  onClose,
  studentData,
  activeTab,
  onSelectTab,
  onSubmitClick,
  onLogout,
  unreadMessagesCount = 0,
}) => {
  const profile = studentData?.profile;
  const mentor = studentData?.assigned_mentor;

  // Handle ESC key to close drawer
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

  const navItems = [
    {
      id: "dashboard",
      label: "Dashboard Overview",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      id: "components",
      label: "PGPA Components",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
    {
      id: "activity",
      label: "My Submissions & Activity",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      id: "messages",
      label: "Messages & Remarks",
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
      ),
    },
    {
      id: "progress",
      label: "PGPA Progress Analytics",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      id: "profile",
      label: "Student Academic Profile",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Dimmed Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex">
        <div className="w-screen max-w-xs sm:max-w-sm bg-white dark:bg-slate-900 shadow-xl flex flex-col justify-between overflow-y-auto border-r border-slate-200/90 dark:border-slate-800 transition-colors">
          {/* Header */}
          <div>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white font-bold text-xs shadow-xs">
                  CCE
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    CCE-PGPA
                  </h2>
                  <p className="text-[11px] text-[#0284c7] dark:text-sky-400 font-semibold">Student Portal</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Student ID Card snippet */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                      {studentData?.full_name || "Student"}
                    </p>
                    <DesignationBadge designation="Change Maker" size="sm" />
                  </div>
                  <p className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                    {profile?.register_number || "SEC25CO031"}
                  </p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 shrink-0">
                  {profile?.batch || "2025-2029"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="block text-[9px] text-slate-500 dark:text-slate-400 font-medium uppercase">Year</span>
                  <span className="font-bold text-slate-900 dark:text-white">{profile?.year || 2}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="block text-[9px] text-slate-500 dark:text-slate-400 font-medium uppercase">Sec</span>
                  <span className="font-bold text-slate-900 dark:text-white">{profile?.section || "A"}</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200/80 dark:border-slate-800 text-center">
                  <span className="block text-[9px] text-slate-500 dark:text-slate-400 font-medium uppercase">Sem</span>
                  <span className="font-bold text-slate-900 dark:text-white">{profile?.semester || "III"}</span>
                </div>
              </div>
            </div>

            {/* Assigned Mentor Card */}
            <div className="p-3 mx-3 my-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Assigned Faculty Mentor
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {mentor?.full_name || profile?.original_mentor_name || "LURDHUMARY J"}
                </p>
                <DesignationBadge designation="Torch Bearer" size="sm" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Department of Computer and Communication Engineering
              </p>
            </div>

            {/* Submit Action */}
            <div className="px-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSubmitClick();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>+ Submit New Achievement</span>
              </button>
            </div>

            {/* Navigation Menu List */}
            <nav className="mt-4 px-3 space-y-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-2xs"
                        : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"}>
                        {item.icon}
                      </div>
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Footer & Sign Out */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 space-y-2">
            <Link
              href="/change-password"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-200 transition-colors"
            >
              <span>🔑</span>
              <span>Change Account Password</span>
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-400 hover:border-rose-200 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out of Portal</span>
            </button>
            <p className="mt-3 text-[10px] text-center text-slate-400">
              Department of CCE &bull; Sri Sairam Engineering College
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
