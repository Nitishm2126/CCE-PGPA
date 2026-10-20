"use client";

import React from "react";
import { AchievementResponse } from "@/types/achievement";

interface WorkflowLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: AchievementResponse | null;
}

export const WorkflowLockModal: React.FC<WorkflowLockModalProps> = ({
  isOpen,
  onClose,
  achievement,
}) => {
  if (!isOpen || !achievement) return null;

  const isApproved = achievement.status === "approved";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Academic Workflow Locked
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Record is protected under institutional audit guidelines
            </p>
          </div>
        </div>

        {/* Record Overview */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 p-3.5 space-y-1 text-xs mb-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Record Title
          </span>
          <p className="font-semibold text-slate-900 dark:text-white line-clamp-2">
            {achievement.title}
          </p>
          <div className="flex items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
              Status: {isApproved ? "Approved & Audited" : "Submitted for Review"}
            </span>
          </div>
        </div>

        {/* Clear Institutional Workflow Explanation */}
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 p-3.5 rounded-xl">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Why cannot this record be edited or deleted?
          </p>
          <p>
            {isApproved
              ? "This achievement has been officially verified by your faculty mentor and its points have been computed into your academic PGPA audit. Once approved, institutional records cannot be altered or deleted."
              : "This achievement has been submitted to your assigned faculty mentor for audit. While in 'Submitted' status, the record is locked to maintain audit integrity."}
          </p>
          <p className="text-[11px] text-amber-800/90 dark:text-amber-300">
            If an incorrect file was submitted or details need revision, please request your faculty mentor to mark the submission as <strong>Action Required</strong>.
          </p>
        </div>

        {/* Close button */}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
