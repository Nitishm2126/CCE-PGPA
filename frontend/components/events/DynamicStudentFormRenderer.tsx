"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  EventItem,
  EventFormVersion,
  EventSubmissionItem,
  EventSubmissionRequest,
  EventFormField,
  FormSection,
  ConditionalRule,
  GeoLocationData,
} from "@/types/events";
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

  // Sections setup
  const sections: FormSection[] = useMemo(() => {
    if (form.sections_config && form.sections_config.length > 0) {
      return [...form.sections_config].sort((a, b) => a.order - b.order);
    }
    return [{ id: "default", title: "Registration Details", order: 0 }];
  }, [form.sections_config]);

  // Wizard state (for multi-step layout mode)
  const isMultiStep = event.form_layout_mode === "multi_step" && sections.length > 1;
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  // Status
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);
  const [capturingGeoKey, setCapturingGeoKey] = useState<string | null>(null);
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
  const handleFileUpload = async (key: string, file: File) => {
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

  // Geotag capture handler
  const handleCaptureGeoPhoto = (key: string, file: File) => {
    setCapturingGeoKey(key);
    setErrorMessage(null);

    if (!navigator.geolocation) {
      handleFileUpload(key, file);
      setCapturingGeoKey(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await eventsApi.uploadEventFile(file);
          const geoData: GeoLocationData = {
            has_geo: true,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: new Date(pos.timestamp).toISOString(),
            storage_reference: res.storage_reference,
            original_filename: res.original_filename,
          };

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
          handleFieldChange(key, geoData);
        } catch (err: any) {
          setErrorMessage(err.message || "Failed to upload photo with location.");
        } finally {
          setCapturingGeoKey(null);
        }
      },
      async (err) => {
        console.warn("Geolocation prompt was denied or unavailable:", err.message);
        try {
          const res = await eventsApi.uploadEventFile(file);
          const geoData: GeoLocationData = {
            has_geo: false,
            timestamp: new Date().toISOString(),
            storage_reference: res.storage_reference,
            original_filename: res.original_filename,
          };
          setUploadedFiles((prev) => [
            ...prev.filter((f) => f.field_key !== key),
            {
              field_key: key,
              storage_reference: res.storage_reference,
              original_filename: res.original_filename,
              mime_type: res.mime_type,
              file_size: res.file_size,
            },
          ]);
          handleFieldChange(key, geoData);
        } catch (uploadErr: any) {
          setErrorMessage(uploadErr.message || "Failed to upload photo.");
        } finally {
          setCapturingGeoKey(null);
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Evaluate conditional visibility for a field
  const isFieldVisible = (f: EventFormField): boolean => {
    if (!f.conditions) return true;

    let rules: ConditionalRule[] = [];
    let logic = "and";

    if (Array.isArray(f.conditions)) {
      rules = f.conditions;
    } else if (typeof f.conditions === "object" && f.conditions !== null) {
      rules = f.conditions.rules || [];
      logic = (f.conditions.logic || "and").toLowerCase();
    }

    if (!rules || rules.length === 0) return true;

    const matches: boolean[] = [];

    for (const r of rules) {
      const srcKey = r.field;
      const op = (r.operator || "equals").toLowerCase();
      const targetVal = r.value !== undefined ? r.value : r.target_value;
      const action = (r.action || "show").toLowerCase();

      const srcVal = formValues[srcKey];
      let ruleMatched = false;

      if (op === "equals") {
        ruleMatched = String(srcVal ?? "").trim().toLowerCase() === String(targetVal ?? "").trim().toLowerCase();
      } else if (op === "not_equals") {
        ruleMatched = String(srcVal ?? "").trim().toLowerCase() !== String(targetVal ?? "").trim().toLowerCase();
      } else if (op === "contains") {
        ruleMatched = String(srcVal ?? "").toLowerCase().includes(String(targetVal ?? "").toLowerCase());
      } else if (op === "greater_than") {
        ruleMatched = Number(srcVal) > Number(targetVal);
      } else if (op === "less_than") {
        ruleMatched = Number(srcVal) < Number(targetVal);
      } else if (op === "in") {
        const list = Array.isArray(targetVal) ? targetVal : String(targetVal).split(",").map((s) => s.trim());
        if (Array.isArray(srcVal)) {
          ruleMatched = srcVal.some((s) => list.includes(String(s)));
        } else {
          ruleMatched = list.includes(String(srcVal));
        }
      } else if (op === "is_empty") {
        ruleMatched = srcVal === undefined || srcVal === null || srcVal === "" || (Array.isArray(srcVal) && srcVal.length === 0);
      } else if (op === "is_not_empty") {
        ruleMatched = srcVal !== undefined && srcVal !== null && srcVal !== "" && (!Array.isArray(srcVal) || srcVal.length > 0);
      } else {
        ruleMatched = true;
      }

      if (action === "hide") {
        matches.push(!ruleMatched);
      } else {
        matches.push(ruleMatched);
      }
    }

    if (logic === "or") {
      return matches.some(Boolean);
    }
    return matches.every(Boolean);
  };

  // Validate step fields before wizard advance
  const validateStep = (stepIndex: number): boolean => {
    const targetSection = sections[stepIndex];
    if (!targetSection) return true;

    const stepFields = form.fields.filter((f) => (f.section_id || "default") === targetSection.id);

    for (const f of stepFields) {
      if (!f.enabled || !isFieldVisible(f)) continue;

      const val = formValues[f.field_key];
      const isFileField = ["file", "pdf_upload", "image_upload", "camera_capture", "geo_photo"].includes(f.field_type);
      const hasUploaded = uploadedFiles.some((uf) => uf.field_key === f.field_key);

      if (f.required) {
        if (isFileField && !hasUploaded && !val) {
          setErrorMessage(`'${f.label}' is required. Please attach the requested photo or document.`);
          return false;
        }
        if (!isFileField) {
          const empty =
            val === undefined ||
            val === null ||
            (typeof val === "string" && !val.trim()) ||
            (Array.isArray(val) && val.length === 0);
          if (empty) {
            setErrorMessage(`'${f.label}' is required.`);
            return false;
          }
        }
      }
    }
    return true;
  };

  // Submit response to Backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate all visible fields
    for (const f of form.fields) {
      if (!f.enabled || !isFieldVisible(f)) continue;

      // Skip layout blocks
      if (["heading", "subheading", "divider", "info_card", "notice"].includes(f.field_type)) continue;

      const val = formValues[f.field_key];
      const isFileField = ["file", "pdf_upload", "image_upload", "camera_capture", "geo_photo"].includes(f.field_type);
      const hasUploaded = uploadedFiles.some((uf) => uf.field_key === f.field_key);

      if (f.required) {
        if (isFileField && !hasUploaded && !val) {
          setErrorMessage(`'${f.label}' is required. Please provide the requested photo or document.`);
          return;
        }
        if (f.field_type === "repeatable_group") {
          const entries = Array.isArray(val) ? val : [];
          const min = f.repeatable_config?.min_items || 1;
          if (entries.length < min) {
            setErrorMessage(`'${f.label}' requires at least ${min} entries.`);
            return;
          }
        } else if (!isFileField) {
          const empty =
            val === undefined ||
            val === null ||
            (typeof val === "string" && !val.trim()) ||
            (Array.isArray(val) && val.length === 0);
          if (empty) {
            setErrorMessage(`'${f.label}' is a required field.`);
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
      if (onSubmitted) {
        onSubmitted(res.submission);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit response. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Confirmation Screen
  if (submittedData) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-6 sm:p-8 text-center space-y-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-[#5DD62C] flex items-center justify-center text-3xl mx-auto shadow-inner">
          ✓
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-[#F5F5F5]">
            Registration Submitted Successfully!
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-1">
            Your response has been confirmed and saved for <span className="font-semibold text-slate-700 dark:text-slate-300">{event.title}</span>.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#292929] max-w-md mx-auto text-left text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Student:</span>
            <span className="font-semibold text-slate-800 dark:text-[#F5F5F5]">{user?.full_name || "Student"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Submission ID:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{submittedData.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Form Version:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">v{form.version_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Submitted At:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(submittedData.submitted_at).toLocaleString()}</span>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          {onViewMySubmission && (
            <button
              type="button"
              onClick={onViewMySubmission}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#252525] hover:bg-slate-200 dark:hover:bg-[#303030] text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Review My Submission
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black cursor-pointer"
            >
              Back to Events
            </button>
          )}
        </div>
      </div>
    );
  }

  const visibleSections = isMultiStep ? [sections[currentStepIndex]] : sections;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-5 sm:p-7 shadow-xs space-y-6">
      {/* Event Header Card */}
      <div className="border-b border-slate-100 dark:border-[#282828] pb-5">
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              title="Back"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-600 dark:text-[#5DD62C] uppercase tracking-wider">
            {event.category}
          </span>
          {event.mode && (
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              • {event.mode} Mode
            </span>
          )}
        </div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F5F5] mt-1">
          {event.title}
        </h2>
        {event.subtitle && (
          <p className="text-xs font-medium text-blue-600 dark:text-[#5DD62C] mt-0.5">{event.subtitle}</p>
        )}
        {event.short_description && (
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-2 leading-relaxed">
            {event.short_description}
          </p>
        )}
      </div>

      {/* Multi-Step Wizard Indicator */}
      {isMultiStep && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Step {currentStepIndex + 1} of {sections.length}: {sections[currentStepIndex]?.title}
            </span>
            <span className="font-mono text-[11px]">{Math.round(((currentStepIndex + 1) / sections.length) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#252525] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 dark:bg-[#5DD62C] h-full transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / sections.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-500 cursor-pointer">×</button>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {visibleSections.map((sec) => {
          const secFields = form.fields.filter(
            (f) => (f.section_id || "default") === sec.id && isFieldVisible(f)
          );

          return (
            <div key={sec.id} className="space-y-4 pt-2">
              {!isMultiStep && sections.length > 1 && (
                <div className="pb-1 border-b border-slate-100 dark:border-[#282828]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {sec.title}
                  </h3>
                  {sec.description && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sec.description}</p>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {secFields.map((f) => {
                  const val = formValues[f.field_key];

                  // 1. Layout Blocks
                  if (["heading", "subheading", "divider", "info_card", "notice"].includes(f.field_type)) {
                    if (f.field_type === "heading") {
                      return <h3 key={f.id} className="text-sm font-bold text-slate-900 dark:text-white pt-2">{f.label}</h3>;
                    }
                    if (f.field_type === "subheading") {
                      return <h4 key={f.id} className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1">{f.label}</h4>;
                    }
                    if (f.field_type === "divider") {
                      return <hr key={f.id} className="border-slate-200 dark:border-[#292929] my-3" />;
                    }
                    if (f.field_type === "notice") {
                      return (
                        <div key={f.id} className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                          ⚠️ {f.label}
                        </div>
                      );
                    }
                    return (
                      <div key={f.id} className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
                        ℹ {f.label}
                      </div>
                    );
                  }

                  // 2. Standard Input Questions
                  return (
                    <div key={f.id} className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-800 dark:text-[#EAEAEA]">
                        {f.label}
                        {f.required && <span className="text-rose-500 ml-1">*</span>}
                      </label>
                      {f.description && (
                        <p className="text-[11px] text-slate-400 dark:text-[#888]">{f.description}</p>
                      )}

                      {/* Dropdown */}
                      {f.field_type === "dropdown" && (
                        <select
                          value={val || ""}
                          onChange={(e) => handleFieldChange(f.field_key, e.target.value)}
                          className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">{f.placeholder || "-- Select an option --"}</option>
                          {(f.options_config || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Radio */}
                      {f.field_type === "radio" && (
                        <div className="space-y-1.5 pt-1">
                          {(f.options_config || []).map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#202020]">
                              <input
                                type="radio"
                                name={f.field_key}
                                value={opt.value}
                                checked={val === opt.value}
                                onChange={() => handleFieldChange(f.field_key, opt.value)}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* Checkbox Group */}
                      {f.field_type === "checkbox" && (
                        <div className="space-y-1.5 pt-1">
                          {(f.options_config || []).map((opt) => {
                            const isChecked = Array.isArray(val) && val.includes(opt.value);
                            return (
                              <label key={opt.value} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#202020]">
                                <input
                                  type="checkbox"
                                  value={opt.value}
                                  checked={isChecked}
                                  onChange={() => handleCheckboxToggle(f.field_key, opt.value)}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Yes / No Toggle */}
                      {f.field_type === "yes_no" && (
                        <div className="flex gap-2 pt-1">
                          {["yes", "no"].map((choice) => (
                            <button
                              key={choice}
                              type="button"
                              onClick={() => handleFieldChange(f.field_key, choice)}
                              className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                                val === choice
                                  ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-600 dark:text-[#5DD62C]"
                                  : "border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {choice === "yes" ? "✓ Yes" : "✕ No"}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Star Rating */}
                      {f.field_type === "star_rating" && (
                        <div className="flex items-center gap-1.5 pt-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleFieldChange(f.field_key, star)}
                              className={`text-2xl transition-transform active:scale-125 cursor-pointer ${
                                (Number(val) || 0) >= star ? "text-amber-400" : "text-slate-200 dark:text-[#333]"
                              }`}
                            >
                              ★
                            </button>
                          ))}
                          <span className="text-xs font-semibold text-slate-500 ml-2">
                            {val ? `${val} / 5 Stars` : "Tap to rate"}
                          </span>
                        </div>
                      )}

                      {/* Satisfaction Scale */}
                      {f.field_type === "satisfaction_rating" && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(f.rating_config?.options || ["Poor", "Fair", "Good", "Very Good", "Excellent"]).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleFieldChange(f.field_key, opt)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                                val === opt
                                  ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-600 dark:text-[#5DD62C]"
                                  : "border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Numeric Scale */}
                      {f.field_type === "numeric_rating" && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {Array.from({ length: 11 }, (_, i) => i).map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => handleFieldChange(f.field_key, num)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                val === num
                                  ? "border-blue-600 dark:border-[#5DD62C] bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black shadow-xs"
                                  : "border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Geo-tagged Photo */}
                      {f.field_type === "geo_photo" && (
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/50 dark:bg-[#161616] space-y-2">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCaptureGeoPhoto(f.field_key, file);
                            }}
                            disabled={capturingGeoKey === f.field_key}
                            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#252525] dark:file:text-[#5DD62C] cursor-pointer"
                          />
                          {capturingGeoKey === f.field_key && (
                            <p className="text-[11px] text-blue-500 animate-pulse">
                              Capturing photo and requesting verified GPS coordinates...
                            </p>
                          )}
                          {val && typeof val === "object" && (
                            <div className="p-2.5 rounded-lg bg-white dark:bg-[#1d1d1d] border border-slate-200 dark:border-[#2d2d2d] text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                              {val.has_geo ? (
                                <p className="text-emerald-600 dark:text-[#5DD62C] font-semibold flex items-center gap-1">
                                  <span>✓ Verified Location:</span> {val.latitude}°, {val.longitude}° (±{val.accuracy}m)
                                </p>
                              ) : (
                                <p className="text-amber-500 font-semibold">
                                  ⚠️ Location coordinates unavailable (photo recorded)
                                </p>
                              )}
                              <p className="text-slate-400">Captured: {new Date(val.timestamp).toLocaleTimeString()}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Repeatable Group (e.g. Team Members) */}
                      {f.field_type === "repeatable_group" && (
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/40 dark:bg-[#161616] space-y-3">
                          {(() => {
                            const entries: any[] = Array.isArray(val) ? val : [{}];
                            const repCfg = f.repeatable_config || { entity_name: "Entry", fields: [] };
                            const maxItems = repCfg.max_items || 10;

                            return (
                              <div className="space-y-3">
                                {entries.map((entry, eIdx) => (
                                  <div key={eIdx} className="p-3 rounded-xl bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#2d2d2d] space-y-2.5 shadow-2xs">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-[#282828]">
                                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        {repCfg.entity_name || "Entry"} #{eIdx + 1}
                                      </span>
                                      {entries.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = entries.filter((_, i) => i !== eIdx);
                                            handleFieldChange(f.field_key, updated);
                                          }}
                                          className="text-xs text-rose-500 hover:text-rose-700 cursor-pointer"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {repCfg.fields.map((subF) => (
                                        <div key={subF.field_key}>
                                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                            {subF.label} {subF.required && <span className="text-rose-500">*</span>}
                                          </label>
                                          <input
                                            type="text"
                                            value={entry[subF.field_key] || ""}
                                            onChange={(e) => {
                                              const updatedEntries = [...entries];
                                              updatedEntries[eIdx] = {
                                                ...updatedEntries[eIdx],
                                                [subF.field_key]: e.target.value,
                                              };
                                              handleFieldChange(f.field_key, updatedEntries);
                                            }}
                                            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414]"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}

                                {entries.length < maxItems && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleFieldChange(f.field_key, [...entries, {}]);
                                    }}
                                    className="w-full py-2 text-xs font-semibold rounded-xl border border-dashed border-slate-300 dark:border-[#333] text-blue-600 dark:text-[#5DD62C] hover:bg-slate-50 dark:hover:bg-[#202020] transition-all cursor-pointer"
                                  >
                                    {repCfg.add_button_text || `+ Add ${repCfg.entity_name || "Entry"}`}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* File / Document Upload */}
                      {["file", "pdf_upload", "image_upload", "camera_capture"].includes(f.field_type) && (
                        <div className="space-y-1">
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(f.field_key, file);
                            }}
                            disabled={uploadingFieldKey === f.field_key}
                            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#252525] dark:file:text-[#5DD62C] cursor-pointer"
                          />
                          {uploadingFieldKey === f.field_key && (
                            <p className="text-[11px] text-blue-500 animate-pulse">Uploading file to cloud storage...</p>
                          )}
                          {val && (
                            <p className="text-[11px] text-emerald-600 dark:text-[#5DD62C] font-semibold">
                              ✓ Uploaded: {typeof val === "string" ? val : "File attached"}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Long Textarea */}
                      {f.field_type === "textarea" && (
                        <textarea
                          rows={3}
                          value={val || ""}
                          placeholder={f.placeholder || "Enter your response..."}
                          onChange={(e) => handleFieldChange(f.field_key, e.target.value)}
                          className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      )}

                      {/* Standard text, number, email, phone, date, etc. */}
                      {!["dropdown", "radio", "checkbox", "yes_no", "star_rating", "satisfaction_rating", "numeric_rating", "geo_photo", "repeatable_group", "file", "pdf_upload", "image_upload", "camera_capture", "textarea"].includes(f.field_type) && (
                        <input
                          type={f.field_type === "number" ? "number" : f.field_type === "email" ? "email" : f.field_type === "date" ? "date" : f.field_type === "time" ? "time" : "text"}
                          value={val || ""}
                          placeholder={f.placeholder || "Enter value..."}
                          onChange={(e) => handleFieldChange(f.field_key, e.target.value)}
                          className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Wizard Navigation / Form Submit Buttons */}
        <div className="pt-4 border-t border-slate-100 dark:border-[#282828] flex items-center justify-between">
          <div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isMultiStep && currentStepIndex > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#333] bg-white dark:bg-[#202020] text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                ← Back
              </button>
            )}

            {isMultiStep && currentStepIndex < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (validateStep(currentStepIndex)) {
                    setCurrentStepIndex((prev) => prev + 1);
                  }
                }}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black cursor-pointer shadow-xs"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-6 py-2.5 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[38px] flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Submitting...
                  </>
                ) : existingSubmission ? (
                  "Update My Submission"
                ) : (
                  "Submit Registration"
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
