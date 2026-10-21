"use client";

import React, { useState } from "react";
import { AchievementResponse } from "@/types/achievement";

interface DeleteAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: AchievementResponse | null;
  onConfirmDelete: (achievementId: string) => Promise<void>;
}

export const DeleteAchievementModal: React.FC<DeleteAchievementModalProps> = ({
  isOpen,
  onClose,
  achievement,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !achievement) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await onConfirmDelete(achievement.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete achievement.";
      setError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#171E28] border border-slate-200 dark:border-[#2B3543] shadow-2xl overflow-hidden">
        {/* Header with warning icon */}
        <div className="p-6">
          <div className="flex items-center gap-3.5 mb-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-transparent dark:border-rose-900/40">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#E8EDF4]">
                Delete Achievement Record?
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#A0ACBC] mt-0.5">
                This action is permanent and will remove the record and attached evidence files.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Record Details Summary */}
          <div className="rounded-xl bg-slate-50 dark:bg-[#1C2531] border border-slate-200/70 dark:border-[#2B3543] p-3.5 space-y-1.5 text-xs">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-[#7E8B9C]">
              Record to be deleted
            </span>
            <p className="font-semibold text-slate-900 dark:text-[#E8EDF4] line-clamp-2">
              {achievement.title}
            </p>
            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-[#A0ACBC]">
              <span>{achievement.component_name || "PGPA Component"}</span>
              <span>&bull;</span>
              <span className="capitalize">{achievement.status}</span>
              {achievement.files && achievement.files.length > 0 && (
                <>
                  <span>&bull;</span>
                  <span>{achievement.files.length} attached file(s)</span>
                </>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-[#A0ACBC] leading-relaxed">
            Note: Draft and submitted records can be safely deleted if created by mistake or requiring replacement. Approved records are preserved in the institutional archive and cannot be deleted.
          </p>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="min-h-[38px] px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#2B3543] text-slate-700 dark:text-[#A0ACBC] hover:bg-slate-50 dark:hover:bg-[#1C2531] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isDeleting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>Delete Permanently</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
