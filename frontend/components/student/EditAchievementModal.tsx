"use client";

import React, { useState, useEffect } from "react";
import { AchievementResponse, AchievementCreate, AchievementFileResponse } from "@/types/achievement";
import { api } from "@/lib/api-client";

interface EditAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  achievement: AchievementResponse | null;
  onSave: (achievementId: string, updatedFields: Partial<AchievementCreate>) => Promise<void>;
  onRefreshed?: () => Promise<void>;
}

export const EditAchievementModal: React.FC<EditAchievementModalProps> = ({
  isOpen,
  onClose,
  achievement,
  onSave,
  onRefreshed,
}) => {
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("Certification");
  const [organizer, setOrganizer] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [outcome, setOutcome] = useState("");
  const [description, setDescription] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AchievementFileResponse[]>([]);
  const [newEvidenceFile, setNewEvidenceFile] = useState<File | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (achievement) {
      setTitle(achievement.title || "");
      setActivityType(achievement.activity_type || "Certification");
      setOrganizer(achievement.organizer || "");
      setEventDate(
        achievement.event_date
          ? achievement.event_date.split("T")[0]
          : new Date().toISOString().split("T")[0]
      );
      setOutcome(achievement.outcome || "");
      setDescription(achievement.description || "");
      setAttachedFiles(achievement.files || []);
      setNewEvidenceFile(null);
      setError(null);
    }
  }, [achievement, isOpen]);

  if (!isOpen || !achievement) return null;

  const isApproved = achievement.status === "approved";
  const isPending = achievement.status === "pending";

  const handleDeleteEvidence = async (fileId: string) => {
    try {
      setDeletingFileId(fileId);
      setError(null);
      await api.deleteEvidenceFile(achievement.id, fileId);
      setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (onRefreshed) await onRefreshed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove evidence file.";
      setError(msg);
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide an achievement title.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // 1. If student attached a replacement or additional evidence file, upload it
      if (newEvidenceFile) {
        await api.uploadEvidenceFile(achievement.id, newEvidenceFile);
      }

      // 2. Save achievement metadata (triggers controlled revision if approved, or keeps in review if pending)
      await onSave(achievement.id, {
        title: title.trim(),
        activity_type: activityType,
        organizer: organizer.trim() || undefined,
        event_date: eventDate || undefined,
        outcome: outcome.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (onRefreshed) {
        await onRefreshed();
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update achievement.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isApproved ? "Revise Approved Achievement" : "Edit Achievement Details"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Update activity title, organizer, outcome, or replace evidence file
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 p-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Controlled Revision Workflow Banner */}
          {isApproved && (
            <div className="rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="font-bold">Controlled Revision Workflow</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  This achievement was previously approved. Saving changes will initiate an official revision workflow, resetting its status to &quot;Submitted for Review&quot; for your mentor to re-audit while preserving your prior verification history.
                </p>
              </div>
            </div>
          )}

          {/* Pending Submission Notice */}
          {isPending && (
            <div className="rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/80 p-3 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
              <svg className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <p className="text-[11px] leading-relaxed">
                This record is currently in the mentor review queue. You can update any fields or replace evidence files freely.
              </p>
            </div>
          )}

          {/* Component Banner */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/70 dark:border-slate-700/70 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              PGPA Component
            </span>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
              {achievement.component_name || "PGPA Component"}
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Activity Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. NPTEL Elite Gold Cloud Computing"
            />
          </div>

          {/* Activity Type & Event Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Activity Type
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Certification">Online Certification</option>
                <option value="Hackathon">Hackathon / Contest</option>
                <option value="Workshop">Technical Workshop</option>
                <option value="Internship">Industry Internship</option>
                <option value="Publication">Research Publication</option>
                <option value="Community Service">Social / Community</option>
                <option value="Club Activity">Student Club Activity</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Event / Completion Date
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Organizer */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Organizing Body / Platform
            </label>
            <input
              type="text"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. NPTEL / IIT Madras, Coursera, LeetCode"
            />
          </div>

          {/* Outcome / Score */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Outcome / Score / Grade
            </label>
            <input
              type="text"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 92% (Top 1%), First Place, Grade A+"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Brief Description / Highlights
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Provide context or key learning outcomes..."
            />
          </div>

          {/* Attached Evidence Files & Replacement */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Supporting Evidence Files (PDF)
              </label>
              <span className="text-[11px] text-slate-400">
                {attachedFiles.length} file(s) attached
              </span>
            </div>

            {attachedFiles.length > 0 && (
              <div className="space-y-2">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-rose-600 text-[9px] font-bold text-white shrink-0">
                        PDF
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white truncate" title={file.original_filename}>
                        {file.original_filename}
                      </span>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        ({(file.size_bytes / 1024).toFixed(0)} KB)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteEvidence(file.id)}
                      disabled={deletingFileId === file.id}
                      title="Remove this evidence file"
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deletingFileId === file.id ? (
                        <span className="h-3 w-3 animate-spin rounded-full border border-rose-600 border-t-transparent" />
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      <span>Remove</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Replacement / Additional PDF */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                {attachedFiles.length > 0 ? "Replace or Add Evidence File (PDF)" : "Upload PDF Evidence"}
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setNewEvidenceFile(f);
                }}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-800 dark:file:text-slate-300 cursor-pointer"
              />
              {newEvidenceFile && (
                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Selected: {newEvidenceFile.name} ({(newEvidenceFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>{isApproved ? "Confirm Revision" : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
