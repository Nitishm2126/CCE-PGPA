"use client";

import React, { useState, useEffect, useRef } from "react";
import { PGPAComponentResponse, AchievementCreate } from "@/types/achievement";

interface SubmitAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  components: PGPAComponentResponse[];
  initialComponentId?: string | null;
  onSubmit: (
    data: AchievementCreate,
    evidenceFile: File,
    submitImmediately: boolean
  ) => Promise<void>;
}

interface FormContentProps {
  components: PGPAComponentResponse[];
  initialComponentId?: string | null;
  onSubmit: (
    data: AchievementCreate,
    evidenceFile: File,
    submitImmediately: boolean
  ) => Promise<void>;
  onClose: () => void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MiB

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const SubmitAchievementFormContent: React.FC<FormContentProps> = ({
  components,
  initialComponentId,
  onSubmit,
  onClose,
}) => {
  const [componentId, setComponentId] = useState<string>(
    () => initialComponentId || components[0]?.id || ""
  );
  const [title, setTitle] = useState<string>("");
  const [activityType, setActivityType] = useState<string>("Certification");
  const [organizer, setOrganizer] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>(
    () => new Date().toISOString().split("T")[0]
  );
  const [outcome, setOutcome] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Evidence PDF file state
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStep, setSubmissionStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Validate and set chosen file
  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setEvidenceFile(null);
      setFileError(null);
      return;
    }

    const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
    const isPdfMime = file.type === "application/pdf" || file.type === "";

    if (!hasPdfExtension && !isPdfMime) {
      setEvidenceFile(null);
      setFileError("Only PDF documents (.pdf) are accepted. Please select a valid PDF file.");
      return;
    }

    if (file.size === 0) {
      setEvidenceFile(null);
      setFileError("The selected PDF file is empty (0 bytes). Please select a valid evidence document.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setEvidenceFile(null);
      setFileError(
        `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 5 MB.`
      );
      return;
    }

    setEvidenceFile(file);
    setFileError(null);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (submitImmediately: boolean) => {
    if (!componentId) {
      setError("Please select a PGPA component.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a title for your achievement.");
      return;
    }
    if (!evidenceFile) {
      setError("Evidence PDF is required. Please attach a valid PDF document before submitting.");
      setFileError("Evidence PDF is required.");
      if (fileInputRef.current) {
        fileInputRef.current.focus();
      }
      return;
    }
    if (fileError) {
      setError(fileError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSubmissionStep(
        submitImmediately
          ? "Uploading evidence to Google Drive and submitting..."
          : "Uploading evidence to Google Drive and saving draft..."
      );

      await onSubmit(
        {
          component_id: componentId,
          title: title.trim(),
          activity_type: activityType.trim() || undefined,
          organizer: organizer.trim() || undefined,
          event_date: eventDate || undefined,
          outcome: outcome.trim() || undefined,
          description: description.trim() || undefined,
        },
        evidenceFile,
        submitImmediately
      );
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record achievement and upload evidence.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
      setSubmissionStep("");
    }
  };

  const activityTypeOptions = [
    "Certification",
    "Coding Challenge",
    "Hackathon",
    "Workshop / Seminar",
    "Internship",
    "Course Completion",
    "Sports & Athletics",
    "Club / Cell Activity",
    "SDG Community Action",
    "Paper Presentation",
    "Other Curricular",
  ];

  return (
    <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 text-left shadow-2xl transition-all border border-slate-200/90 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            Submit PGPA Achievement
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record activity details and attach required PDF evidence for faculty view
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(true);
        }}
        className="mt-4 space-y-4"
      >
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700 flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {/* Component Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            PGPA Component *
          </label>
          <select
            value={componentId}
            onChange={(e) => setComponentId(e.target.value)}
            disabled={isSubmitting}
            required
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
          >
            {components.map((c) => (
              <option key={c.id} value={c.id}>
                #{String(c.display_order).padStart(2, "0")} — {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Achievement Title */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Achievement Title *
          </label>
          <input
            type="text"
            required
            disabled={isSubmitting}
            placeholder="e.g. Solved 150 Coding Problems on Skillrack"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        {/* Activity Type & Date Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Activity Type
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
            >
              {activityTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Event / Completion Date
            </label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        {/* Organizer & Outcome Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Organizer / Host
            </label>
            <input
              type="text"
              placeholder="e.g. Skillrack / IIT Madras"
              value={organizer}
              onChange={(e) => setOrganizer(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Outcome / Score
            </label>
            <input
              type="text"
              placeholder="e.g. Elite Gold (85%) / First Prize"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        {/* Evidence PDF (Required) Upload Field */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Evidence PDF (Required) *
            </label>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
              Max 5 MB • PDF Only
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-1.5">
            Attach official certificate, event participation receipt, or score card.
          </p>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            disabled={isSubmitting}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
            id="evidence-pdf-input"
          />

          {!evidenceFile ? (
            /* Dropzone / Picker State */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => {
                if (!isSubmitting) fileInputRef.current?.click();
              }}
              className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-blue-500 bg-blue-50/60"
                  : fileError
                  ? "border-rose-300 bg-rose-50/30 hover:border-rose-400"
                  : "border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-2xs border border-slate-200 text-blue-600 group-hover:scale-105 transition-transform">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-800">
                <span className="text-blue-600 group-hover:underline">Click to browse</span> or drag & drop PDF
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Official certificate or document (PDF only, up to 5 MB)
              </p>
            </div>
          ) : (
            /* Selected File Card State */
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                {/* PDF Icon Badge */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white font-bold text-[10px] shadow-xs tracking-wider">
                  PDF
                </div>
                <div className="min-w-0">
                  <p
                    className="text-xs font-semibold text-slate-900 truncate"
                    title={evidenceFile.name}
                  >
                    {evidenceFile.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {formatFileSize(evidenceFile.size)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                      <svg className="h-3 w-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Verified PDF
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Replace
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleFileSelect(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Remove file"
                  aria-label="Remove evidence file"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {fileError && (
            <p className="mt-1 text-[11px] text-rose-600 font-medium flex items-center gap-1">
              <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {fileError}
            </p>
          )}
        </div>

        {/* Description / Summary */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Summary / Evidence Details (Optional)
          </label>
          <textarea
            rows={2}
            disabled={isSubmitting}
            placeholder="Briefly describe your achievement, hours, or certificate details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-2xs resize-none disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        {/* Submission Progress Indicator */}
        {isSubmitting && submissionStep && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-2.5 text-xs text-blue-800 flex items-center gap-2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent shrink-0" />
            <span className="font-medium">{submissionStep}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3.5 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2.5 justify-end">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
          >
            Save as Draft
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            <span>{isSubmitting ? "Uploading..." : "Submit Activity"}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export const SubmitAchievementModal: React.FC<SubmitAchievementModalProps> = ({
  isOpen,
  onClose,
  components,
  initialComponentId,
  onSubmit,
}) => {
  // Handle ESC key to close modal
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        <SubmitAchievementFormContent
          key={`${initialComponentId || "none"}-${isOpen}`}
          components={components}
          initialComponentId={initialComponentId}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
