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
  onEditAchievement?: (achievement: AchievementResponse) => void;
  onDeleteAchievement?: (achievement: AchievementResponse) => void;
  onOpenMessages?: (achievement: AchievementResponse) => void;
  unreadCountsByAchievement?: Record<string, number>;
  onShowLockDetails?: (achievement: AchievementResponse) => void;
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
  onEditAchievement,
  onDeleteAchievement,
  onOpenMessages,
  unreadCountsByAchievement,
  onShowLockDetails: _onShowLockDetails,
  isSubmittingId,
  maxDisplay = 4,
  showAll = false,
}) => {
  const [selectedSemester, setSelectedSemester] = React.useState<string>("all");

  const filteredAchievements = React.useMemo(() => {
    if (selectedSemester === "all") return achievements;
    if (selectedSemester === "legacy") return achievements.filter((a) => !a.semester_id && !a.semester);
    return achievements.filter(
      (a) => a.semester?.semester_number?.toString() === selectedSemester
    );
  }, [achievements, selectedSemester]);

  const displayedAchievements = showAll
    ? filteredAchievements
    : filteredAchievements.slice(0, maxDisplay);

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

  // Status badge styling helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-[#122422] px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-[#5EEAD4] border border-emerald-200 dark:border-emerald-800/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-[#132338] px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-[#93C5FD] border border-blue-200 dark:border-blue-800/70">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Submitted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-[#251417] px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-[#FDA4AF] border border-rose-200 dark:border-rose-900/60">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Action Required
          </span>
        );
      case "draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#1C2531] px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-[#A0ACBC] border border-slate-200 dark:border-[#2B3543]">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] p-5 sm:p-7 shadow-2xs transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200 dark:border-[#2B3543]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#E8EDF4]">
              Recent Activity
            </h2>
            {!isLoading && achievements.length > 0 && (
              <span className="rounded-full bg-slate-100 dark:bg-[#1C2531] px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] border border-slate-200 dark:border-[#2B3543]">
                {achievements.length} Records
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#7E8B9C] font-normal">
            Submitted achievements and activity records
          </p>
        </div>

        <div className="flex items-center gap-2">
          {achievements.length > 0 && (
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              aria-label="Filter activities by semester"
              className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50 dark:bg-[#1C2531] text-slate-700 dark:text-[#E8EDF4] outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Semesters</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
              <option value="7">Semester 7</option>
              <option value="8">Semester 8</option>
              <option value="legacy">Legacy / Unassigned</option>
            </select>
          )}

          {onViewAll && achievements.length > maxDisplay && !showAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-blue-600 dark:text-[#4C83E6] hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer min-h-[36px]"
            >
              <span>View all</span>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content States */}
      <div className="mt-5">
        {/* Loading State Skeleton */}
        {isLoading && (
          <div className="space-y-3 py-1">
            {[1, 2, 3].map((key) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-slate-50/50 dark:bg-[#1C2531]/40 animate-pulse"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-28 bg-slate-200 dark:bg-[#2B3543] rounded" />
                  <div className="h-4 w-56 bg-slate-200 dark:bg-[#2B3543] rounded" />
                  <div className="h-3 w-36 bg-slate-200 dark:bg-[#2B3543] rounded" />
                </div>
                <div className="h-6 w-20 bg-slate-200 dark:bg-[#2B3543] rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 p-5 text-center">
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
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
              Failed to load activity records
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-300 mt-0.5">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95 transition-all shadow-2xs cursor-pointer min-h-[44px]"
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
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 dark:bg-[#1C2531] border border-slate-200 dark:border-[#2B3543] text-slate-500 dark:text-[#7E8B9C] mb-3">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#E8EDF4]">
              No activity records submitted yet
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#7E8B9C] max-w-sm mx-auto leading-relaxed">
              Every verified activity earns PGPA credits. Submit your certifications, coding challenges, or internships to build your academic score.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={onSubmitClick}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer min-h-[44px]"
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
              // Submitted, Draft, and Rejected records are fully editable and deletable by their student owner
              const isEditable = item.status === "draft" || item.status === "rejected" || item.status === "pending";
              const isDeletable = item.status === "draft" || item.status === "rejected" || item.status === "pending";
              const isRevisable = item.status === "approved";
              const unreadMsgCount = unreadCountsByAchievement?.[item.id] || 0;

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#1C2531] hover:border-slate-300 dark:hover:border-[#3B4758] hover:shadow-2xs transition-all flex flex-col gap-3"
                >
                  {/* Top Row: Meta info & Status Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      {/* Component Tag, Semester & Date */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-[#171E28] px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-[#A0ACBC] border border-slate-200 dark:border-[#2B3543]">
                          {item.component_name || "PGPA Component"}
                        </span>
                        {item.semester ? (
                          <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            {item.semester.display_name}
                          </span>
                        ) : item.semester_id ? (
                          <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            Semester {item.semester_id}
                          </span>
                        ) : null}
                        <span className="text-xs text-slate-400 dark:text-[#7E8B9C] font-medium">
                          {formatDate(item.event_date || item.created_at)}
                        </span>
                        {item.activity_type && (
                          <span className="text-xs text-slate-400 dark:text-[#7E8B9C]">
                            &bull; {item.activity_type}
                          </span>
                        )}
                      </div>

                      {/* Achievement Title */}
                      <p
                        className="mt-1.5 text-sm sm:text-[15px] font-semibold text-slate-900 dark:text-[#E8EDF4] break-words"
                        title={item.title}
                      >
                        {item.title}
                      </p>

                      {/* Supporting Details */}
                      {(item.organizer || item.outcome) && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-[#7E8B9C] break-words">
                          {item.organizer}
                          {item.organizer && item.outcome ? " — " : ""}
                          {item.outcome && (
                            <span className="font-medium text-slate-700 dark:text-[#A0ACBC]">
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
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-[#2B3543] bg-slate-50 dark:bg-[#171E28] px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-[#A0ACBC]"
                            >
                              <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-rose-600 text-[8px] font-bold text-white shrink-0">
                                PDF
                              </span>
                              <span className="truncate max-w-[200px]" title={f.original_filename}>
                                {f.original_filename}
                              </span>
                              <span className="text-slate-400 dark:text-[#7E8B9C] shrink-0 text-[10px]">
                                ({(f.size_bytes / 1024).toFixed(0)} KB)
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="self-start shrink-0">
                      {renderStatusBadge(item.status)}
                    </div>
                  </div>

                  {/* Actions Bar: Full row on mobile for comfortable tap targets */}
                  <div className="pt-2 border-t border-slate-100 dark:border-[#2B3543]/60 flex items-center gap-2 flex-wrap justify-end">
                    {/* Messages & Remarks Button */}
                    {onOpenMessages && (
                      <button
                        type="button"
                        onClick={() => onOpenMessages(item)}
                        title="View remarks, congratulations, and messages for this achievement"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] hover:bg-slate-50 dark:hover:bg-[#232E3E] px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#E8EDF4] transition-colors cursor-pointer min-h-[36px]"
                      >
                        <svg className="h-3.5 w-3.5 text-blue-600 dark:text-[#4C83E6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                        <span>Remarks</span>
                        {unreadMsgCount > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                            {unreadMsgCount}
                          </span>
                        )}
                      </button>
                    )}

                    {/* Edit Button for Draft, Rejected, or Pending (Submitted) */}
                    {isEditable && onEditAchievement && (
                      <button
                        type="button"
                        onClick={() => onEditAchievement(item)}
                        title={item.status === "pending" ? "Edit submitted achievement details or update evidence" : "Edit activity details"}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] hover:bg-slate-50 dark:hover:bg-[#232E3E] px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#E8EDF4] transition-colors cursor-pointer min-h-[36px]"
                      >
                        <svg className="h-3 w-3 text-slate-500 dark:text-[#7E8B9C]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Controlled Revision for Approved Records */}
                    {isRevisable && onEditAchievement && (
                      <button
                        type="button"
                        onClick={() => onEditAchievement(item)}
                        title="Initiate controlled revision workflow for this approved record"
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-[#2A2012] hover:bg-amber-100 dark:hover:bg-[#382B18] px-2.5 py-1.5 text-xs font-semibold text-amber-800 dark:text-[#FCD34D] transition-colors cursor-pointer min-h-[36px]"
                      >
                        <svg className="h-3 w-3 text-amber-600 dark:text-[#FCD34D]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        <span>Revise</span>
                      </button>
                    )}

                    {/* Delete Button for Draft, Rejected, or Submitted (Pending) */}
                    {isDeletable && onDeleteAchievement && (
                      <button
                        type="button"
                        onClick={() => onDeleteAchievement(item)}
                        title="Delete this achievement record"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-[#2B3543] bg-white dark:bg-[#171E28] hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900 px-2 py-1.5 text-xs font-semibold text-slate-600 dark:text-[#A0ACBC] transition-colors cursor-pointer min-h-[36px]"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    )}

                    {/* Submit Button for Draft */}
                    {item.status === "draft" && onSubmitForReview && (
                      <button
                        type="button"
                        onClick={() => onSubmitForReview(item.id)}
                        disabled={isSubmittingId === item.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer min-h-[36px]"
                      >
                        {isSubmittingId === item.id ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                        <span>Submit</span>
                      </button>
                    )}
                  </div>

                  {/* Mentor Remarks note if reviewed or rejected */}
                  {latestLog?.remarks && (
                    <div className="mt-1 text-xs rounded-lg bg-slate-50 dark:bg-[#131922] p-3 text-slate-700 dark:text-[#A0ACBC] border border-slate-200 dark:border-[#2B3543]">
                      <span className="font-semibold text-slate-900 dark:text-[#E8EDF4]">
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
