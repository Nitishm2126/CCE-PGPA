"use client";

import React, { useState, useMemo } from "react";
import { PGPAComponentResponse, AchievementResponse, SemesterResponse } from "@/types/achievement";

interface PGPAComponentsSectionProps {
  components: PGPAComponentResponse[];
  achievements: AchievementResponse[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectComponentForSubmit: (component: PGPAComponentResponse) => void;
  studentSemester?: string | null;
  semesters?: SemesterResponse[];
  selectedSemesterId?: string;
  onSemesterChange?: (semesterId: string) => void;
}

// Category-appropriate Lucide-style SVG icons based on actual category meaning
function getCategoryIcon(slug?: string) {
  const s = slug?.toLowerCase() || "";

  if (s.includes("skillrack")) {
    // Code / Terminal for coding practice
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  if (s.includes("academics") || s.includes("gpa")) {
    // Graduation Cap for academic GPA
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path d="M21.42 10.922a1 1 0 0 0-.019-.838L12.83 2.18a2 2 0 0 0-1.66 0L2.6 10.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
        <path d="M22 10v6" />
        <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
      </svg>
    );
  }
  if (s.includes("amcat")) {
    // Trending Up / Analytics for AMCAT employability assessment
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    );
  }
  if (s.includes("club") || s.includes("cell")) {
    // Users for clubs and committee activities
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (s.includes("innovation") || s.includes("eco-system")) {
    // Lightbulb for Innovation Eco-System / Hackathons
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    );
  }
  if (s.includes("nptel")) {
    // Book Open for NPTEL Courses
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    );
  }
  if (s.includes("sail") || s.includes("ai")) {
    // CPU / Chip for Sairam Artificial Intelligence Learning
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 9h6v6H9z" />
        <path d="M15 2v1M15 21v1M9 2v1M9 21v1M2 15h1M21 15h1M2 9h1M21 9h1" />
      </svg>
    );
  }
  if (s.includes("online-certifications") || s.includes("certif")) {
    // Award Badge for MOOCs / Industry certifications
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <circle cx="12" cy="8" r="6" />
        <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    );
  }
  if (s.includes("fit-india")) {
    // HeartPulse / Activity for Fit India
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    );
  }
  if (s.includes("internship")) {
    // Briefcase for Industrial Internships
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <rect width="20" height="14" x="2" y="7" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    );
  }
  if (s.includes("sdg-action") || s.includes("action-programme")) {
    // Globe for SDG community action
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" x2="22" y1="12" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    );
  }
  if (s.includes("sport") || s.includes("game")) {
    // Trophy for Sports & Games
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    );
  }
  if (s.includes("scout")) {
    // Compass for Scouts for SDGs
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    );
  }

  // Default clean bookmark/layers icon
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

export const PGPAComponentsSection: React.FC<PGPAComponentsSectionProps> = ({
  components,
  achievements,
  isLoading,
  error,
  onRetry,
  onSelectComponentForSubmit,
  studentSemester = "III SEM",
  semesters = [],
  selectedSemesterId,
  onSemesterChange,
}) => {
  const [selectedSemesterTab, setSelectedSemesterTab] = useState<string>("all");

  const currentSemesterObj = useMemo(() => {
    return semesters.find((s) => s.id === selectedSemesterId);
  }, [semesters, selectedSemesterId]);

  const activeSemesterLabel = currentSemesterObj?.display_name || studentSemester || "Active Semester";

  // Map component ID to student's submission count stats
  const componentStats = useMemo(() => {
    const stats: Record<string, { total: number; approved: number; pending: number; draft: number }> = {};
    achievements.forEach((a) => {
      if (!stats[a.component_id]) {
        stats[a.component_id] = { total: 0, approved: 0, pending: 0, draft: 0 };
      }
      stats[a.component_id].total += 1;
      if (a.status === "approved") stats[a.component_id].approved += 1;
      if (a.status === "pending") stats[a.component_id].pending += 1;
      if (a.status === "draft") stats[a.component_id].draft += 1;
    });
    return stats;
  }, [achievements]);

  // Semester tabs for filtering
  const semesterTabs = [
    { id: "all", label: "All Categories" },
    { id: "current", label: `Current (${activeSemesterLabel})` },
    { id: "core", label: "Technical Core" },
    { id: "holistic", label: "Holistic & SDGs" },
  ];

  // Category tags or filter classification based on component slug
  const filteredComponents = useMemo(() => {
    if (selectedSemesterTab === "all" || selectedSemesterTab === "current") {
      return components;
    }
    if (selectedSemesterTab === "core") {
      const coreSlugs = ["skillrack", "academics-gpa", "amcat", "nptel", "sail", "online-certifications", "internship"];
      return components.filter((c) => coreSlugs.some((s) => c.slug?.toLowerCase().includes(s)));
    }
    if (selectedSemesterTab === "holistic") {
      const holisticSlugs = ["clubs", "innovation", "fit-india", "sdg", "sports", "scouts"];
      return components.filter((c) => holisticSlugs.some((s) => c.slug?.toLowerCase().includes(s)));
    }
    return components;
  }, [components, selectedSemesterTab]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] p-5 sm:p-7 shadow-2xs transition-colors">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-6 border-b border-slate-200 dark:border-[#2B3543] lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E8EDF4]">
              PGPA Components Catalogue
            </h2>
            <span className="rounded-full bg-slate-100 dark:bg-[#1C2531] px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] border border-slate-200 dark:border-[#2B3543]">
              {components.length} Categories
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#7E8B9C] font-normal">
            Component availability and submission rules configured via official PGPA Semester Matrix.
          </p>
        </div>

        {/* Filters and Semester Selector Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Semester Selector */}
          {semesters.length > 0 && onSemesterChange && (
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-[#1C2531] border border-slate-200 dark:border-[#2B3543] rounded-xl px-2.5 py-1">
              <svg className="h-3.5 w-3.5 text-blue-600 dark:text-[#4C83E6] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
              <label htmlFor="comp-sem-select" className="text-[11px] font-semibold text-slate-500 dark:text-[#7E8B9C] uppercase tracking-wider shrink-0">
                Semester:
              </label>
              <select
                id="comp-sem-select"
                value={selectedSemesterId || ""}
                onChange={(e) => onSemesterChange(e.target.value)}
                disabled={isLoading}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-[#E8EDF4] border-none focus:outline-none cursor-pointer py-1"
              >
                {semesters.map((s) => (
                  <option key={s.id} value={s.id} className="bg-white dark:bg-[#171E28] text-slate-900 dark:text-[#E8EDF4]">
                    {s.display_name} (Sem {s.semester_number})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refined Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none shrink-0">
            {semesterTabs.map((tab) => {
              const isSelected = selectedSemesterTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedSemesterTab(tab.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-all cursor-pointer min-h-[34px] ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-900/70 font-semibold shadow-2xs"
                      : "bg-white dark:bg-[#1C2531] border border-slate-200 dark:border-[#2B3543] text-slate-600 dark:text-[#A0ACBC] hover:text-slate-900 dark:hover:text-[#E8EDF4] hover:bg-slate-50 dark:hover:bg-[#232E3E] hover:border-slate-300 dark:hover:border-[#3B4758] font-medium"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content States */}
      <div className="mt-6">
        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 sm:gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="p-5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 animate-pulse space-y-3.5"
              >
                <div className="flex justify-between items-center">
                  <div className="h-8 w-8 bg-slate-200 dark:bg-[#2B3543] rounded-lg" />
                  <div className="h-5 w-20 bg-slate-200 dark:bg-[#2B3543] rounded-full" />
                </div>
                <div className="h-5 w-3/4 bg-slate-200 dark:bg-[#2B3543] rounded" />
                <div className="h-4 w-full bg-slate-200 dark:bg-[#2B3543] rounded" />
                <div className="pt-3.5 flex justify-between items-center border-t border-slate-200/60 dark:border-[#2B3543]/60">
                  <div className="h-4 w-14 bg-slate-200 dark:bg-[#2B3543] rounded" />
                  <div className="h-7 w-20 bg-slate-200 dark:bg-[#2B3543] rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 p-6 text-center">
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
              Unable to load PGPA components
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95 transition-all shadow-2xs cursor-pointer min-h-[44px]"
            >
              <span>Retry Catalogue</span>
            </button>
          </div>
        )}

        {/* Components Grid (3-column desktop, 2-column tablet, 1-column mobile) */}
        {!isLoading && !error && filteredComponents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 sm:gap-5">
            {filteredComponents.map((component) => {
              const stats = componentStats[component.id] || { total: 0, approved: 0, pending: 0, draft: 0 };
              const orderLabel = String(component.display_order).padStart(2, "0");
              const isLocked = component.is_enabled_for_semester === false || component.submission_mode === "hod_excel_import";
              const isHodOnly = component.submission_mode === "hod_excel_import";
              const lockMessage = component.lock_reason || (isHodOnly
                ? `${component.name} is configured for HOD Excel import only and cannot be submitted by students.`
                : `This component is currently unavailable for ${activeSemesterLabel}.`);

              return (
                <div
                  key={component.id}
                  className={`group relative flex flex-col justify-between rounded-xl border p-5 shadow-2xs transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-600 ${
                    isLocked
                      ? "border-slate-200 dark:border-[#2B3543]/80 bg-slate-50/70 dark:bg-[#161D26]/80"
                      : "border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] hover:border-slate-300 dark:hover:border-[#3B4758] hover:shadow-xs"
                  }`}
                >
                  <div>
                    {/* Header Row: Category Icon + Number + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        {/* Refined restrained icon surface */}
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                          isLocked
                            ? "bg-slate-100 dark:bg-[#1A222E] border-slate-200 dark:border-[#2B3543] text-slate-400 dark:text-[#64748B]"
                            : "bg-slate-50 dark:bg-[#171E28] border border-slate-200 dark:border-[#2B3543] text-slate-600 dark:text-[#A0ACBC] group-hover:text-blue-600 dark:group-hover:text-[#4C83E6] group-hover:bg-blue-50/50 dark:group-hover:bg-blue-950/30 group-hover:border-blue-200/60 dark:group-hover:border-blue-800/60"
                        }`}>
                          {getCategoryIcon(component.slug)}
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-400 dark:text-[#7E8B9C]">
                          #{orderLabel}
                        </span>
                      </div>

                      {/* Status / Lock Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-300/40 dark:border-amber-600/30">
                            <svg className="h-3 w-3 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            {isHodOnly ? "HOD Import Only" : "Locked"}
                          </span>
                        ) : null}

                        {stats.approved > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 dark:bg-[#122422] px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-[#5EEAD4] border border-emerald-200/80 dark:border-emerald-800/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {stats.approved} verified
                          </span>
                        ) : stats.pending > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/80 dark:bg-[#132338] px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-[#93C5FD] border border-blue-200/80 dark:border-blue-800/70">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            {stats.pending} submitted
                          </span>
                        ) : stats.draft > 0 ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#171E28] px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-[#A0ACBC] border border-slate-200 dark:border-[#2B3543]">
                            {stats.draft} draft
                          </span>
                        ) : !isLocked ? (
                          <span className="text-[11px] text-slate-400 dark:text-[#7E8B9C] font-medium">
                            0 submitted
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Component Title */}
                    <h3 className={`mt-3.5 text-[15px] font-semibold transition-colors leading-snug ${
                      isLocked
                        ? "text-slate-600 dark:text-slate-400"
                        : "text-slate-900 dark:text-[#E8EDF4] group-hover:text-blue-600 dark:group-hover:text-[#4C83E6]"
                    }`}>
                      {component.name}
                    </h3>

                    {/* Component Description */}
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-[#8E9CAE] line-clamp-2 leading-relaxed">
                      {component.description || "Earn PGPA points for recognized participation and certification."}
                    </p>

                    {/* Lock Warning Notice Box */}
                    {isLocked && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                        <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span className="leading-snug">{lockMessage}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Semester Label & Submit Action */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-[#2B3543]/60 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-[#7E8B9C] uppercase tracking-wider">
                      {component.semester_label || "All Sem"}
                    </span>

                    {isLocked ? (
                      <button
                        type="button"
                        disabled
                        title={lockMessage}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#2B3543] bg-slate-100 dark:bg-[#151D26] text-slate-400 dark:text-[#5A687A] text-xs font-semibold px-3 py-1.5 cursor-not-allowed opacity-75 min-h-[36px]"
                      >
                        <svg className="h-3.5 w-3.5 text-slate-400 dark:text-[#5A687A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>Locked</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectComponentForSubmit(component)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] hover:bg-blue-50 dark:hover:bg-[#232E3E] hover:border-blue-300 dark:hover:border-blue-800 hover:text-blue-700 dark:hover:text-[#4C83E6] text-slate-700 dark:text-[#E8EDF4] text-xs font-semibold px-3 py-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer min-h-[36px]"
                      >
                        <svg className="h-3.5 w-3.5 text-blue-600 dark:text-[#4C83E6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Submit</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
