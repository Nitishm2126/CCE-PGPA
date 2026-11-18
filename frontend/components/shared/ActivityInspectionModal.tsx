"use client";

import React, { useState, useEffect } from "react";
import { AchievementResponse, AchievementFileResponse } from "@/types/achievement";
import { formatSemester } from "@/lib/format-semester";
import { getFileContentUrl } from "@/lib/api-client";

interface ActivityInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: AchievementResponse | null;
  userRole?: "student" | "mentor" | "hod" | "admin";
  canReview?: boolean;
  onReviewDecision?: (action: "approved" | "under_review" | "rejected", remarks: string) => Promise<void>;
  isSubmittingReview?: boolean;
  onRevert?: (remarks: string) => Promise<void>;
  onOpenMessages?: (achievement: AchievementResponse) => void;
  token: string | null;
}

export const ActivityInspectionModal: React.FC<ActivityInspectionModalProps> = ({
  isOpen,
  onClose,
  achievement,
  userRole = "student",
  canReview = false,
  onReviewDecision,
  isSubmittingReview = false,
  onRevert,
  onOpenMessages,
  token,
}) => {
  const [activePreviewFileId, setActivePreviewFileId] = useState<string | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState<string>("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showRevertPrompt, setShowRevertPrompt] = useState<boolean>(false);
  const [revertRemarks, setRevertRemarks] = useState<string>("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Reset state when achievement changes
  useEffect(() => {
    setActivePreviewFileId(null);
    setReviewRemarks("");
    setReviewError(null);
    setShowRevertPrompt(false);
    setRevertRemarks("");
  }, [achievement?.id]);

  if (!isOpen || !achievement) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 dark:bg-purple-950/50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
            Pending Review
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Under Review
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Action Required
          </span>
        );
      case "draft":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#1E293B] px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-[#A3A3A3] border border-slate-200 dark:border-slate-800">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  const handleOpenInNewTab = (file: AchievementFileResponse) => {
    const url = getFileContentUrl(file.id, token, false);
    window.open(url, "_blank");
  };

  const handleDownloadFile = (file: AchievementFileResponse) => {
    const url = getFileContentUrl(file.id, token, true);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.original_filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleReview = async (action: "approved" | "under_review" | "rejected") => {
    if (!onReviewDecision) return;
    if (action === "rejected" && !reviewRemarks.trim()) {
      setReviewError("Please provide constructive feedback remarks explaining the reason for rejection.");
      return;
    }
    setReviewError(null);
    try {
      await onReviewDecision(action, reviewRemarks.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record review decision";
      setReviewError(msg);
    }
  };

  const handleRevertConfirm = async () => {
    if (!onRevert) return;
    try {
      await onRevert(revertRemarks.trim() || "Reverted to pending");
      setShowRevertPrompt(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revert submission";
      setReviewError(msg);
    }
  };

  const files = achievement.files || [];
  const logs = achievement.verification_logs || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-apple-fade"
      />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl transform rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#111111] p-5 sm:p-7 shadow-2xl transition-all my-8 max-h-[92vh] overflow-y-auto animate-apple-slide-up"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-[#292929] pb-4">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  {achievement.component_name || "PGPA Component"}
                </span>
                {(achievement.semester_number || achievement.semester_name || achievement.semester) && (
                  <span className="rounded-md bg-cyan-50 dark:bg-cyan-950/60 px-2.5 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    {formatSemester(achievement.semester_id, achievement.semester?.display_name || achievement.semester_name)}
                  </span>
                )}
                {renderStatusBadge(achievement.status)}
              </div>
              <h2 id="modal-headline" className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F5F5F5] break-words">
                {achievement.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close Inspection"
              className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#181818] transition-colors cursor-pointer shrink-0"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-5 space-y-6">
            {/* Student Details (Mentor, HOD, Admin View) */}
            {(userRole !== "student" || achievement.student_name) && (
              <div className="rounded-xl border border-slate-200/90 dark:border-[#292929] bg-slate-50/60 dark:bg-[#161616] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {achievement.student_name ? achievement.student_name.charAt(0).toUpperCase() : "S"}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">
                      {achievement.student_name || "Student"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">
                      Register No: <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">{achievement.student_register_number || "—"}</span>
                    </p>
                  </div>
                </div>
                {onOpenMessages && (
                  <button
                    type="button"
                    onClick={() => onOpenMessages(achievement)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-[#181818] text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] transition cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-.974-.974 5.96 5.96 0 01.996-3.036A7.48 7.48 0 013 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                    <span>Message Student</span>
                  </button>
                )}
              </div>
            )}

            {/* Submission Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-white dark:bg-[#141414] p-3">
                <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Activity Type</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F5F5] mt-0.5 block truncate">
                  {achievement.activity_type || "Standard"}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-white dark:bg-[#141414] p-3">
                <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Organizer / Host</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F5F5] mt-0.5 block truncate" title={achievement.organizer || "—"}>
                  {achievement.organizer || "—"}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-white dark:bg-[#141414] p-3">
                <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Event Date</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F5F5] mt-0.5 block">
                  {formatDate(achievement.event_date)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-white dark:bg-[#141414] p-3">
                <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-[#A3A3A3]">Outcome / Score</span>
                <span className="font-semibold text-slate-800 dark:text-[#F5F5F5] mt-0.5 block truncate">
                  {achievement.outcome || "Completed"}
                </span>
              </div>
            </div>

            {/* Description & Remarks */}
            {achievement.description && (
              <div>
                <span className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-[#A3A3A3] mb-1">
                  Activity Description
                </span>
                <div className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-slate-50/50 dark:bg-[#141414] p-3 text-xs text-slate-700 dark:text-[#E5E5E5] leading-relaxed break-words whitespace-pre-wrap">
                  {achievement.description}
                </div>
              </div>
            )}

            {achievement.remarks && (
              <div>
                <span className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-[#A3A3A3] mb-1">
                  Student Remarks / Note
                </span>
                <div className="rounded-xl border border-purple-200/60 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 p-3 text-xs text-purple-900 dark:text-purple-200 leading-relaxed break-words whitespace-pre-wrap">
                  {achievement.remarks}
                </div>
              </div>
            )}

            {/* Component Metadata Details (if present) */}
            {achievement.component_metadata && Object.keys(achievement.component_metadata).length > 0 && (
              <div>
                <span className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-[#A3A3A3] mb-1.5">
                  Component Specific Attributes
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(achievement.component_metadata).map(([key, val]) => {
                    if (val === null || val === undefined || val === "") return null;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#161616] px-2.5 py-1 text-slate-700 dark:text-[#E5E5E5]"
                      >
                        <span className="font-medium capitalize text-slate-400 dark:text-[#A3A3A3]">
                          {key.replace(/_/g, " ")}:
                        </span>
                        <span className="font-semibold">{String(val)}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Supporting Evidence Files (Google Drive Storage) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-[#A3A3A3]">
                  Supporting Evidence Files ({files.length})
                </span>
                {achievement.certificate_status && (
                  <span className="text-[11px] text-slate-400 dark:text-[#A3A3A3]">
                    Status: <span className="font-semibold text-slate-700 dark:text-[#E5E5E5] capitalize">{achievement.certificate_status.replace(/_/g, " ")}</span>
                  </span>
                )}
              </div>

              {files.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#292929] p-6 text-center text-xs text-slate-500 dark:text-[#A3A3A3]">
                  No supporting certificate or PDF documents were uploaded for this submission.
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((file) => {
                    const isPreviewActive = activePreviewFileId === file.id;
                    const isPdf = file.mime_type.includes("pdf") || file.original_filename.toLowerCase().endsWith(".pdf");
                    const isImage = file.mime_type.startsWith("image/");
                    const fileUrl = getFileContentUrl(file.id, token, false);

                    return (
                      <div
                        key={file.id}
                        className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/60 dark:bg-[#161616] overflow-hidden"
                      >
                        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-[10px] font-bold text-white shrink-0 shadow-2xs">
                              {isPdf ? "PDF" : isImage ? "IMG" : "DOC"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-[#F5F5F5] truncate" title={file.original_filename}>
                                {file.original_filename}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3] mt-0.5">
                                {formatFileSize(file.size_bytes)} &bull; Uploaded {formatDate(file.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {(isPdf || isImage) && (
                              <button
                                type="button"
                                onClick={() => setActivePreviewFileId(isPreviewActive ? null : file.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                  isPreviewActive
                                    ? "bg-purple-600 text-white"
                                    : "border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#111111] text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#181818]"
                                }`}
                              >
                                <span>{isPreviewActive ? "Hide Preview" : "Preview"}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenInNewTab(file)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-[#181818] text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] transition cursor-pointer"
                              title="Open document in new browser tab"
                            >
                              <svg className="h-3.5 w-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadFile(file)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs font-semibold transition cursor-pointer shadow-2xs"
                              title="Download document to device"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              <span>Download</span>
                            </button>
                          </div>
                        </div>

                        {/* Inline Preview Pane */}
                        {isPreviewActive && (
                          <div className="border-t border-slate-200 dark:border-[#292929] bg-slate-100 dark:bg-[#111111] p-3">
                            {isPdf ? (
                              <iframe
                                src={fileUrl}
                                title={file.original_filename}
                                className="w-full h-96 rounded-lg border border-slate-200 dark:border-[#292929] bg-white"
                              />
                            ) : isImage ? (
                              <div className="flex justify-center p-2">
                                <img
                                  src={fileUrl}
                                  alt={file.original_filename}
                                  className="max-h-96 rounded-lg object-contain shadow-xs"
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Evaluated Results & Automatic Points */}
            <div className="rounded-xl border border-slate-200/90 dark:border-[#292929] bg-slate-50/50 dark:bg-[#161616] p-4">
              <span className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-[#A3A3A3] mb-2">
                Official PGPA Evaluation & Points
              </span>

              {achievement.status === "approved" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Grade: {achievement.evaluated_grade || "A+"}
                  </span>
                  {achievement.evaluated_grade_points !== null && achievement.evaluated_grade_points !== undefined && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Grade Points: {achievement.evaluated_grade_points}
                    </span>
                  )}
                  {achievement.evaluated_points !== null && achievement.evaluated_points !== undefined && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      Points: {achievement.evaluated_points}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500 dark:text-[#A3A3A3] italic">
                    (Calculated automatically by server-side CCE PGPA Grading Engine)
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">
                  {achievement.status === "under_review"
                    ? "Submission is currently under faculty review. Approved points remain 0 until verification."
                    : achievement.status === "rejected"
                    ? "Submission required action or revision. 0 approved points."
                    : "Submission is pending mentor verification. Points will be automatically calculated upon approval."}
                </p>
              )}
            </div>

            {/* Verification Logs / History */}
            {logs.length > 0 && (
              <div>
                <span className="block text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-[#A3A3A3] mb-2">
                  Verification & Review History ({logs.length})
                </span>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200/80 dark:border-[#292929] bg-white dark:bg-[#141414] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-slate-800 dark:text-[#F5F5F5]">
                          {log.reviewer_name || "Faculty Reviewer"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold capitalize text-purple-600 dark:text-purple-400">
                            {log.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-slate-400 dark:text-[#A3A3A3] text-[10px]">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      </div>
                      {log.remarks && (
                        <p className="text-slate-600 dark:text-[#D4D4D4] leading-relaxed break-words">
                          {log.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review Decision Console (Mentor & HOD Access) */}
            {canReview && onReviewDecision && (
              <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-900 bg-purple-50/20 dark:bg-purple-950/20 p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-purple-600" />
                    Record Verification Decision
                  </h4>
                  <span className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                    Points calculate automatically
                  </span>
                </div>

                {reviewError && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-xs text-rose-700 dark:text-rose-300">
                    {reviewError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#E5E5E5] mb-1.5">
                    Faculty Remarks / Feedback{" "}
                    <span className="text-rose-500 font-bold">* Mandatory if rejecting</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    disabled={isSubmittingReview}
                    placeholder="Enter verification remarks, suggestions for student, or reason for decision..."
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#111111] p-3 text-xs text-slate-900 dark:text-[#F5F5F5] placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Single-Click Action Buttons: NO manual points required */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleReview("approved")}
                      disabled={isSubmittingReview}
                      id="btn-inspect-approve"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 min-h-[40px]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span>Approve Submission</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview("under_review")}
                      disabled={isSubmittingReview}
                      id="btn-inspect-under-review"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 min-h-[40px]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Mark Under Review</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview("rejected")}
                      disabled={isSubmittingReview}
                      id="btn-inspect-reject"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 min-h-[40px]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Action Required (Reject)</span>
                    </button>
                  </div>

                  {onRevert && achievement.status !== "pending" && (
                    <button
                      type="button"
                      onClick={() => setShowRevertPrompt(true)}
                      disabled={isSubmittingReview}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium underline cursor-pointer"
                    >
                      Revert to Pending
                    </button>
                  )}
                </div>

                {showRevertPrompt && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2 mt-2">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Are you sure you want to revert this submission back to Pending review?
                    </p>
                    <input
                      type="text"
                      value={revertRemarks}
                      onChange={(e) => setRevertRemarks(e.target.value)}
                      placeholder="Optional reason for reverting..."
                      className="w-full rounded-lg border border-amber-300 dark:border-amber-800 bg-white dark:bg-[#111111] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRevertConfirm}
                        className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                      >
                        Confirm Revert
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRevertPrompt(false)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-end pt-4 border-t border-slate-100 dark:border-[#292929]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] hover:bg-slate-50 dark:hover:bg-[#222222] transition cursor-pointer"
            >
              Close Inspection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
