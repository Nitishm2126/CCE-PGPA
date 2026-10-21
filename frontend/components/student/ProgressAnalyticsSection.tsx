"use client";

import React, { useMemo } from "react";
import { PGPAComponentResponse, AchievementResponse } from "@/types/achievement";

interface ProgressAnalyticsSectionProps {
  components: PGPAComponentResponse[];
  achievements: AchievementResponse[];
  onSubmitClick: () => void;
}

export const ProgressAnalyticsSection: React.FC<ProgressAnalyticsSectionProps> = ({
  components,
  achievements,
  onSubmitClick,
}) => {
  const stats = useMemo(() => {
    const approved = achievements.filter((a) => a.status === "approved").length;
    const pending = achievements.filter((a) => a.status === "pending").length;
    const draft = achievements.filter((a) => a.status === "draft").length;
    const total = achievements.length;

    // Set of component IDs with at least 1 approved or pending submission
    const engagedComponentIds = new Set(
      achievements
        .filter((a) => a.status === "approved" || a.status === "pending")
        .map((a) => a.component_id)
    );

    const activeCount = engagedComponentIds.size;
    const totalComponents = components.length || 13;
    const engagementPercent = Math.round((activeCount / totalComponents) * 100);

    return {
      total,
      approved,
      pending,
      draft,
      activeCount,
      totalComponents,
      engagementPercent,
      engagedComponentIds,
    };
  }, [achievements, components]);

  return (
    <section className="space-y-5">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Components Active */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] shadow-2xs transition-colors">
          <p className="text-xs font-semibold text-slate-500 dark:text-[#7E8B9C] uppercase tracking-wider">
            Active Components
          </p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#E8EDF4]">
              {stats.activeCount}
            </span>
            <span className="text-xs text-slate-400 dark:text-[#7E8B9C] font-semibold">
              / {stats.totalComponents}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-[#171E28] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 dark:bg-[#4C83E6] rounded-full transition-all duration-500"
              style={{ width: `${stats.engagementPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-[#7E8B9C] font-medium">
            {stats.engagementPercent}% category coverage
          </p>
        </div>

        {/* Verified Submissions */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] shadow-2xs transition-colors">
          <p className="text-xs font-semibold text-emerald-700 dark:text-[#5EEAD4] uppercase tracking-wider">
            Verified Submissions
          </p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#E8EDF4]">
              {stats.approved}
            </span>
            <span className="text-xs text-emerald-600 dark:text-[#5EEAD4] font-semibold">records</span>
          </div>
          <p className="mt-2.5 text-xs text-slate-500 dark:text-[#7E8B9C] font-medium">
            Approved by faculty mentor
          </p>
        </div>

        {/* Active Submissions */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] shadow-2xs transition-colors">
          <p className="text-xs font-semibold text-blue-700 dark:text-[#93C5FD] uppercase tracking-wider">
            Active Submissions
          </p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#E8EDF4]">
              {stats.pending}
            </span>
            <span className="text-xs text-blue-600 dark:text-[#93C5FD] font-semibold">recorded</span>
          </div>
          <p className="mt-2.5 text-xs text-slate-500 dark:text-[#7E8B9C] font-medium">
            Recorded for faculty view
          </p>
        </div>

        {/* Draft Records */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] shadow-2xs transition-colors">
          <p className="text-xs font-semibold text-slate-500 dark:text-[#7E8B9C] uppercase tracking-wider">
            Draft Records
          </p>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#E8EDF4]">
              {stats.draft}
            </span>
            <span className="text-xs text-slate-400 dark:text-[#7E8B9C] font-semibold">saved</span>
          </div>
          <p className="mt-2.5 text-xs text-slate-500 dark:text-[#7E8B9C] font-medium">
            Unsubmitted student drafts
          </p>
        </div>
      </div>

      {/* Component Audit Matrix */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] p-5 sm:p-6 shadow-2xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-[#2B3543] gap-3">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-[#E8EDF4]">
              PGPA Category Audit Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#7E8B9C] font-medium mt-1">
              Progress status across all 13 Anna University / CCE PGPA areas
            </p>
          </div>

          <button
            type="button"
            onClick={onSubmitClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors self-start sm:self-auto cursor-pointer min-h-[36px]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Submit Record</span>
          </button>
        </div>

        <div className="mt-3 divide-y divide-slate-100 dark:divide-[#2B3543]/60">
          {components.map((comp) => {
            const compAchievements = achievements.filter((a) => a.component_id === comp.id);
            const approved = compAchievements.filter((a) => a.status === "approved").length;
            const pending = compAchievements.filter((a) => a.status === "pending").length;

            return (
              <div
                key={comp.id}
                className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-[#1C2531] px-2.5 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-slate-500 dark:text-[#7E8B9C] bg-slate-100 dark:bg-[#1C2531] border border-slate-200 dark:border-[#2B3543] px-1.5 py-0.5 rounded">
                    #{String(comp.display_order).padStart(2, "0")}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-[#E8EDF4] truncate">
                    {comp.name}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {approved > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-[#122422] px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-[#5EEAD4] border border-emerald-200 dark:border-emerald-800/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {approved} verified
                    </span>
                  ) : pending > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-[#2A2012] px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-[#FCD34D] border border-amber-200 dark:border-amber-800/70">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      {pending} pending
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-[#7E8B9C] font-medium">
                      Not yet submitted
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
