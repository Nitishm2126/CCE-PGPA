"use client";

import React from "react";
import Image from "next/image";
import { StudentDetailResponse } from "@/types/auth";
import { RoleBadge } from "@/components/RoleBadge";

interface StudentHeaderProps {
  studentData: StudentDetailResponse | null;
  fallbackName?: string;
  onOpenMenu: () => void;
  onOpenProfile: () => void;
  onSubmitClick: () => void;
  onLogout?: () => void;
}

export const StudentHeader: React.FC<StudentHeaderProps> = ({
  studentData,
  fallbackName = "Student",
  onOpenMenu,
  onOpenProfile,
  onSubmitClick,
  onLogout,
}) => {
  const fullName = studentData?.full_name || fallbackName;
  const studentEmail = studentData?.email || "";
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "ST";

  return (
    <header className="w-full bg-white border-b border-slate-200/90 shadow-2xs">
      {/* 1. Official Sairam Logos Header Banner */}
      <div className="w-full border-b border-slate-100 bg-white py-2 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Image
            src="/images/sairam-logos.png"
            alt="Sri Sairam Engineering College - Autonomous Institution - Affiliated to Anna University"
            width={1600}
            height={130}
            priority
            className="w-full max-h-10 sm:max-h-12 object-contain mx-auto"
          />
        </div>
      </div>

      {/* 2. Institutional Navigation Bar */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Left: Mobile Drawer Trigger & Institutional Application Identity */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open student navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white font-bold shadow-xs">
              <span className="text-xs sm:text-sm tracking-wider">CCE</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 text-sm sm:text-base leading-tight tracking-tight">
                CCE-PGPA
              </span>
              <span className="text-[11px] font-semibold text-[#0284c7] leading-tight">
                Department of CCE &bull; Student Portal
              </span>
            </div>
          </div>
        </div>

        {/* Right: Student Identity, Actions & Profile */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Student Info: Name & Email */}
          <div className="hidden md:flex flex-col items-end text-right">
            <span className="text-sm font-semibold text-slate-900 leading-tight">
              {fullName}
            </span>
            {studentEmail && (
              <span className="text-xs text-slate-500 font-normal leading-tight">
                {studentEmail}
              </span>
            )}
          </div>

          <div className="hidden sm:block">
            <RoleBadge role="student" size="sm" />
          </div>

          {/* Quick Submit Activity Button */}
          <button
            type="button"
            onClick={onSubmitClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 shadow-xs transition-colors cursor-pointer"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden xs:inline">Submit Activity</span>
            <span className="xs:hidden">Submit</span>
          </button>

          {/* Sign Out Action */}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="hidden lg:inline-flex items-center text-xs font-semibold text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          )}

          {/* Student Profile Avatar Button */}
          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={`View profile for ${fullName}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            {initials}
          </button>
        </div>
      </div>
    </header>
  );
};
