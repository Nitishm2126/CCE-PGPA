"use client";

import React, { useState } from "react";
import { EventItem, EventFormVersion, EventSubmissionItem, EventSubmissionRequest } from "@/types/events";
import { eventsApi } from "@/lib/events-api";
import { useAuth } from "@/lib/auth-context";

interface DynamicStudentFormRendererProps {
  event: EventItem;
  form: EventFormVersion;
  existingSubmission?: EventSubmissionItem | null;
  onSubmitted?: (submission: EventSubmissionItem) => void;
  onCancel?: () => void;
  onViewMySubmission?: () => void;
}

export const DynamicStudentFormRenderer: React.FC<DynamicStudentFormRendererProps> = ({
  event,
  form,
  existingSubmission,
  onSubmitted,
  onCancel,
  onViewMySubmission,
}) => {
  const { user } = useAuth();

  // Populate initial values from existing submission if available
  const [formValues, setFormValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    if (existingSubmission && existingSubmission.values) {
      Object.entries(existingSubmission.values).forEach(([key, valObj]) => {
        initial[key] = valObj?.value !== undefined ? valObj.value : valObj;
      });
    }
    return initial;
  });

  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{
      field_key: string;
      storage_reference: string;
      original_filename: string;
      mime_type: string;
      file_size: number;
    }>
  >(() => {
    if (existingSubmission && existingSubmission.files) {
      return existingSubmission.files.map((f) => ({
        field_key: f.field_key,
        storage_reference: f.storage_reference,
        original_filename: f.original_filename,
        mime_type: f.mime_type,
        file_size: f.file_size,
      }));
    }
    return [];
  });

  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<EventSubmissionItem | null>(null);

  // Field change handler
  const handleFieldChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  // Checkbox toggle handler (array of values)
  const handleCheckboxToggle = (key: string, optionValue: string) => {
    const currentList: string[] = Array.isArray(formValues[key]) ? formValues[key] : [];
    if (currentList.includes(optionValue)) {
      handleFieldChange(
        key,
        currentList.filter((v) => v !== optionValue)
      );
    } else {
      handleFieldChange(key, [...currentList, optionValue]);
    }
  };

  // File upload handler
  const handleFileUpload = async (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFieldKey(key);
    setErrorMessage(null);

    try {
      const res = await eventsApi.uploadEventFile(file);
      const newFileEntry = {
        field_key: key,
        storage_reference: res.storage_reference,
        original_filename: res.original_filename,
        mime_type: res.mime_type,
        file_size: res.file_size,
      };

      setUploadedFiles((prev) => [
        ...prev.filter((f) => f.field_key !== key),
        newFileEntry,
      ]);
      handleFieldChange(key, res.original_filename);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload file. Please try again.");
    } finally {
      setUploadingFieldKey(null);
    }
  };

  // Submit response
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Frontend validation
    for (const f of form.fields) {
      if (!f.enabled || f.field_type === "heading" || f.field_type === "info") continue;

      const val = formValues[f.field_key];
      const isFileField = f.field_type === "file";
      const hasUploaded = uploadedFiles.some((uf) => uf.field_key === f.field_key);

      if (f.required) {
        if (isFileField && !hasUploaded && !val) {
          setErrorMessage(`'${f.label}' is required. Please upload the requested file.`);
          return;
        }
        if (!isFileField) {
          const empty =
            val === undefined ||
            val === null ||
            (typeof val === "string" && !val.trim()) ||
            (Array.isArray(val) && val.length === 0);
          if (empty) {
            setErrorMessage(`'${f.label}' is a mandatory field.`);
            return;
          }
        }
      }

      // Format validations
      if (val) {
        if (f.field_type === "email" && typeof val === "string") {
          if (!val.includes("@") || !val.includes(".")) {
            setErrorMessage(`Please enter a valid email address for '${f.label}'.`);
            return;
          }
        }
        if (f.field_type === "number" && typeof val !== "number") {
          const num = parseFloat(val);
          if (isNaN(num)) {
            setErrorMessage(`Please enter a valid number for '${f.label}'.`);
            return;
          }
        }
      }
    }

    const payload: EventSubmissionRequest = {
      form_version_id: form.id,
      values: formValues,
      uploaded_files: uploadedFiles,
    };

    setIsSubmitting(true);
    try {
      const res = await eventsApi.submitStudentEvent(event.id, payload);
      setSubmittedData(res.submission);
      if (onSubmitted) onSubmitted(res.submission);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit response. Please verify inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS CONFIRMATION SCREEN
  if (submittedData) {
    return (
      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 sm:p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Registration Completed
          </span>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F5F5] mt-1">
            {event.title}
          </h3>
          <p className="text-xs text-slate-600 dark:text-[#A3A3A3] mt-1">
            Your response has been securely recorded. Submission timestamp:{" "}
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {new Date(submittedData.submitted_at).toLocaleString()}
            </span>
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {onViewMySubmission && (
            <button
              type="button"
              onClick={onViewMySubmission}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 text-white dark:text-black font-semibold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[38px]"
            >
              View My Submitted Details
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#181818] text-slate-700 dark:text-[#D4D4D4] font-semibold text-xs hover:bg-slate-50 cursor-pointer min-h-[38px]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Student Identity Card */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Authenticated Student Account
          </span>
          <p className="text-xs font-bold text-blue-950 dark:text-blue-100 mt-0.5">
            {user?.full_name || "Student"} &bull; {user?.email}
          </p>
          <p className="text-[11px] text-blue-700 dark:text-blue-300">
            Department of Computer and Communication Engineering (CCE)
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-blue-200/80 dark:bg-blue-900/80 text-blue-900 dark:text-blue-200 font-bold text-[10px]">
          Verified
        </span>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold">×</button>
        </div>
      )}

      {/* Dynamic Fields List */}
      <div className="space-y-4">
        {form.fields.map((field) => {
          if (!field.enabled) return null;

          // Section Heading
          if (field.field_type === "heading") {
            return (
              <div key={field.id} className="pt-4 border-t border-slate-200 dark:border-[#292929]">
                <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">{field.label}</h4>
                {field.description && (
                  <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">{field.description}</p>
                )}
              </div>
            );
          }

          // Information Text Callout
          if (field.field_type === "info") {
            return (
              <div
                key={field.id}
                className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/80 dark:bg-[#202020] p-3 text-xs text-slate-700 dark:text-[#D4D4D4] leading-relaxed"
              >
                {field.label}
              </div>
            );
          }

          const value = formValues[field.field_key] ?? "";
          const hasUploadedFile = uploadedFiles.find((uf) => uf.field_key === field.field_key);

          return (
            <div key={field.id} className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-800 dark:text-[#E5E5E5]">
                {field.label} {field.required && <span className="text-rose-500 font-bold">*</span>}
              </label>

              {field.description && (
                <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">{field.description}</p>
              )}

              {/* Field Type Specific Controls */}
              {field.field_type === "textarea" ? (
                <textarea
                  rows={3}
                  required={field.required}
                  value={value}
                  onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                  placeholder={field.placeholder || "Enter details..."}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : field.field_type === "dropdown" ? (
                <select
                  required={field.required}
                  value={value}
                  onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{field.placeholder || "-- Select an Option --"}</option>
                  {field.options_config?.map((opt, i) => (
                    <option key={i} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.field_type === "radio" ? (
                <div className="space-y-2 pt-1">
                  {field.options_config?.map((opt, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                        value === opt.value
                          ? "border-blue-500 dark:border-[#5DD62C] bg-blue-50/50 dark:bg-[#5DD62C]/10 text-blue-900 dark:text-[#5DD62C] font-semibold"
                          : "border-slate-200 dark:border-[#292929] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-[#D4D4D4]"
                      }`}
                    >
                      <input
                        type="radio"
                        required={field.required && !value}
                        name={field.field_key}
                        value={opt.value}
                        checked={value === opt.value}
                        onChange={() => handleFieldChange(field.field_key, opt.value)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              ) : field.field_type === "checkbox" ? (
                <div className="space-y-2 pt-1">
                  {field.options_config?.map((opt, i) => {
                    const isChecked = Array.isArray(value) && value.includes(opt.value);
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "border-blue-500 dark:border-[#5DD62C] bg-blue-50/50 dark:bg-[#5DD62C]/10 text-blue-900 dark:text-[#5DD62C] font-semibold"
                            : "border-slate-200 dark:border-[#292929] hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-[#D4D4D4]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCheckboxToggle(field.field_key, opt.value)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : field.field_type === "file" ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#383838] bg-slate-50/50 dark:bg-[#181818] p-4 text-center">
                  {hasUploadedFile ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2 truncate">
                        <span>📎</span>
                        <span className="font-semibold truncate">{hasUploadedFile.original_filename}</span>
                        <span className="text-[10px] text-slate-400">
                          ({(hasUploadedFile.file_size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600">Uploaded ✓</span>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="file"
                        id={`file_input_${field.id}`}
                        onChange={(e) => handleFileUpload(field.field_key, e)}
                        accept={field.validation_config?.allowed_types?.join(",") || ".pdf,.png,.jpg,.jpeg"}
                        disabled={uploadingFieldKey === field.field_key}
                        className="hidden"
                      />
                      <label
                        htmlFor={`file_input_${field.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#202020] border border-slate-300 dark:border-[#333] hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-[#F5F5F5] cursor-pointer shadow-2xs active:scale-95 transition-all"
                      >
                        {uploadingFieldKey === field.field_key ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Uploading Document...
                          </>
                        ) : (
                          <>
                            <span>📁</span> Choose Document / Image
                          </>
                        )}
                      </label>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Allowed: {field.validation_config?.allowed_types?.join(", ") || ".pdf, .png, .jpg"} &bull; Max{" "}
                        {field.validation_config?.max_size_mb || 5}MB
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type={
                    field.field_type === "number"
                      ? "number"
                      : field.field_type === "date"
                      ? "date"
                      : field.field_type === "time"
                      ? "time"
                      : field.field_type === "email"
                      ? "email"
                      : field.field_type === "phone"
                      ? "tel"
                      : "text"
                  }
                  required={field.required}
                  value={value}
                  onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                  placeholder={field.placeholder || ""}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Controls */}
      <div className="pt-4 border-t border-slate-100 dark:border-[#292929] flex items-center justify-between gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-700 dark:text-[#D4D4D4] hover:bg-slate-50 cursor-pointer min-h-[38px]"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !!uploadingFieldKey}
          className="ml-auto rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-6 py-2.5 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[38px] flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Submitting Response...
            </>
          ) : existingSubmission ? (
            "Update Response"
          ) : (
            "Submit Registration"
          )}
        </button>
      </div>
    </form>
  );
};
