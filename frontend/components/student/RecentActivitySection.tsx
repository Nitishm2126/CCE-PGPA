"use client";

import React from "react";
import { AchievementResponse } from "@/types/achievement";

interface RecentActivitySectionProps {
  achievements: AchievementResponse[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onSubmitClick: () => void;
  onViewAll?: () => void;
  onSubmitForReview?: (achievementId: string) => Promise<void>;
  isSubmittingId?: string | null;
  maxDisplay?: number;
  showAll?: boolean;
}

export const RecentActivitySection: React.FC<RecentActivitySectionProps> = ({
  achievements,
  isLoading,
  error,
  onRetry,
  onSubmitClick,
  onViewAll,
  onSubmitForReview,
  isSubmittingId,
  maxDisplay = 4,
  showAll = false,
}) => {
  const displayedAchievements = showAll
    ? achievements
    : achievements.slice(0, maxDisplay);

  // Date formatting helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Recent";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Status badge styling helper (Restrained institutional colors)
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/80 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Submitted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50/80 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200/80">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Action Required
          </span>
        );
      case "draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Recent Activity
            </h2>
            {!isLoading && achievements.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/80">
                {achievements.length} Records
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-normal">
            Submitted achievements and activity records
          </p>
        </div>

        {onViewAll && achievements.length > maxDisplay && !showAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View all</span>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Content States */}
      <div className="mt-5">
        {/* Loading State Skeleton */}
        {isLoading && (
          <div className="space-y-3 py-1">
            {[1, 2, 3].map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 animate-pulse"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                  <div className="h-4 w-56 bg-slate-200 rounded" />
                  <div className="h-3 w-36 bg-slate-200 rounded" />
                </div>
                <div className="h-6 w-20 bg-slate-200 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-5 text-center">
            <svg
              className="mx-auto h-6 w-6 text-rose-500 mb-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm font-semibold text-rose-800">
              Failed to load activity records
            </p>
            <p className="text-xs text-rose-600 mt-0.5">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && achievements.length === 0 && (
          <div className="py-10 text-center px-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 mb-3">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              No activity records submitted yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Every verified activity earns PGPA credits. Submit your certifications, coding challenges, or internships to build your academic score.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={onSubmitClick}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Submit Your First Achievement</span>
              </button>
            </div>
          </div>
        )}

        {/* List of Real Activities */}
        {!isLoading && !error && displayedAchievements.length > 0 && (
          <div className="space-y-3">
            {displayedAchievements.map((item) => {
              const latestLog = item.verification_logs?.[item.verification_logs.length - 1];

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-4.5 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Component Tag & Date */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200/80">
                          {item.component_name || "PGPA Component"}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {formatDate(item.event_date || item.created_at)}
                        </span>
                        {item.activity_type && (
                          <span className="text-xs text-slate-400">
                            &bull; {item.activity_type}
                          </span>
                        )}
                      </div>

                      {/* Achievement Title */}
                      <p
                        className="mt-1.5 text-sm sm:text-[15px] font-semibold text-slate-900 truncate"
                        title={item.title}
                      >
                        {item.title}
                      </p>

                      {/* Supporting Details */}
                      {(item.organizer || item.outcome) && (
                        <p className="mt-0.5 text-xs text-slate-500 truncate">
                          {item.organizer}
                          {item.organizer && item.outcome ? " — " : ""}
                          {item.outcome && (
                            <span className="font-medium text-slate-700">
                              {item.outcome}
                            </span>
                          )}
                        </p>
                      )}

                      {/* Attached Evidence Files */}
                      {item.files && item.files.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {item.files.map((f) => (
                            <span
                              key={f.id}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                            >
                              <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-rose-600 text-[8px] font-bold text-white shrink-0">
                                PDF
                              </span>
                              <span className="truncate max-w-[200px]" title={f.original_filename}>
                                {f.original_filename}
                              </span>
                              <span className="text-slate-400 shrink-0 text-[10px]">
                                ({(f.size_bytes / 1024).toFixed(0)} KB)
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>


                    {/* Status Badge & Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {renderStatusBadge(item.status)}

                      {/* If Draft, allow immediate 1-click submit */}
                      {item.status === "draft" && onSubmitForReview && (
                        <button
                          type="button"
                          onClick={() => onSubmitForReview(item.id)}
                          disabled={isSubmittingId === item.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-1 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {isSubmittingId === item.id ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          )}
                          <span>Submit Activity</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mentor Remarks note if reviewed or rejected */}
                  {latestLog?.remarks && (
                    <div className="mt-1 text-xs rounded-lg bg-slate-50 p-3 text-slate-700 border border-slate-200/70">
                      <span className="font-semibold text-slate-900">
                        Mentor Feedback:
                      </span>{" "}
                      {latestLog.remarks}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
