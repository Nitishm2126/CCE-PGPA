"use client";

import React, { useState, useMemo } from "react";
import {
  EventItem,
  EventFormVersion,
  EventSubmissionItem,
  EventSubmissionRequest,
  EventFormField,
  FormFieldOption,
  FormSection,
  ConditionalRule,
  GeoLocationData,
} from "@/types/events";
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const LAYOUT_FIELD_TYPES = [
  "heading",
  "subheading",
  "description",
  "rich_text_block",
  "divider",
  "info",
  "info_card",
  "image_block",
  "pdf_link",
  "notice",
];

const FILE_UPLOAD_TYPES = [
  "file",
  "pdf_upload",
  "image_upload",
  "document_upload",
  "camera_capture",
  "gallery_upload",
  "geo_photo",
];

function getFieldOptions(f: EventFormField): FormFieldOption[] {
  const raw =
    f.options_config && f.options_config.length > 0
      ? f.options_config
      : (f as any).options || (f.validation_config as any)?.options || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((opt: any) =>
    typeof opt === "object" && opt !== null
      ? { label: String(opt.label ?? opt.value ?? ""), value: String(opt.value ?? opt.label ?? "") }
      : { label: String(opt), value: String(opt) }
  );
}

interface DynamicStudentFormRendererProps {
  event: EventItem;
  form: EventFormVersion;
  existingSubmission?: EventSubmissionItem | null;
  onSubmitted?: (submission: EventSubmissionItem) => void;
  onCancel?: () => void;
  onViewMySubmission?: () => void;
  isPreviewMode?: boolean;
}

export const DynamicStudentFormRenderer: React.FC<DynamicStudentFormRendererProps> = ({
  event,
  form,
  existingSubmission,
  onSubmitted,
  onCancel,
  onViewMySubmission,
  isPreviewMode = false,
}) => {
  const { user } = useAuth();
  const authToken = getStoredToken();

  // Populate initial values from existing submission or field default_value
  const [formValues, setFormValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    (form.fields || []).forEach((f) => {
      if (f.default_value !== undefined && f.default_value !== null && f.default_value !== "") {
        initial[f.field_key] = f.default_value;
      }
    });
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
      file_url?: string;
    }>
  >(() => {
    if (existingSubmission && existingSubmission.files) {
      return existingSubmission.files.map((f) => ({
        field_key: f.field_key,
        storage_reference: f.storage_reference,
        original_filename: f.original_filename,
        mime_type: f.mime_type,
        file_size: f.file_size,
        file_url: f.file_url,
      }));
    }
    return [];
  });

  const formSettings = form.form_settings || {};

  // Track "Other" free-text inputs for choice fields when allow_other is enabled
  const [otherSelected, setOtherSelected] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {};
    if (existingSubmission?.values) {
      Object.entries(existingSubmission.values).forEach(([k, valObj]) => {
        const v = valObj?.value !== undefined ? valObj.value : valObj;
        if (typeof v === "string" && v.startsWith("Other:")) {
          out[k] = true;
        } else if (Array.isArray(v) && v.some((x) => typeof x === "string" && x.startsWith("Other:"))) {
          out[k] = true;
        }
      });
    }
    return out;
  });

  const [otherTexts, setOtherTexts] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (existingSubmission?.values) {
      Object.entries(existingSubmission.values).forEach(([k, valObj]) => {
        const v = valObj?.value !== undefined ? valObj.value : valObj;
        if (typeof v === "string" && v.startsWith("Other:")) {
          out[k] = v.slice(6).trim();
        } else if (Array.isArray(v)) {
          const hit = v.find((x) => typeof x === "string" && x.startsWith("Other:"));
          if (typeof hit === "string") out[k] = hit.slice(6).trim();
        }
      });
    }
    return out;
  });

  // Shared conditional rules evaluator for both fields and sections
  const evaluateConditions = (conditions: any, values: Record<string, any>): boolean => {
    if (!conditions) return true;

    let rules: ConditionalRule[] = [];
    let logic = "and";

    if (Array.isArray(conditions)) {
      rules = conditions;
    } else if (typeof conditions === "object" && conditions !== null) {
      rules = conditions.rules || [];
      logic = (conditions.logic || "and").toLowerCase();
    }

    if (!rules || rules.length === 0) return true;

    const matches: boolean[] = [];

    for (const r of rules) {
      const srcKey = r.field || (r as any).field_key;
      const op = (r.operator || "equals").toLowerCase();
      const targetVal = r.value !== undefined ? r.value : r.target_value;
      const action = (r.action || "show").toLowerCase();

      const srcVal = values[srcKey];
      const targetLower = String(targetVal ?? "").trim().toLowerCase();
      let ruleMatched = false;

      if (op === "equals") {
        if (Array.isArray(srcVal)) {
          ruleMatched = srcVal.some((item) => String(item ?? "").trim().toLowerCase() === targetLower);
        } else {
          ruleMatched = String(srcVal ?? "").trim().toLowerCase() === targetLower;
        }
      } else if (op === "not_equals") {
        if (Array.isArray(srcVal)) {
          ruleMatched = srcVal.every((item) => String(item ?? "").trim().toLowerCase() !== targetLower);
        } else {
          ruleMatched = String(srcVal ?? "").trim().toLowerCase() !== targetLower;
        }
      } else if (op === "contains") {
        if (Array.isArray(srcVal)) {
          ruleMatched = srcVal.some((item) => String(item ?? "").toLowerCase().includes(targetLower));
        } else {
          ruleMatched = String(srcVal ?? "").toLowerCase().includes(targetLower);
        }
      } else if (op === "not_contains") {
        if (Array.isArray(srcVal)) {
          ruleMatched = srcVal.every((item) => !String(item ?? "").toLowerCase().includes(targetLower));
        } else {
          ruleMatched = !String(srcVal ?? "").toLowerCase().includes(targetLower);
        }
      } else if (op === "greater_than") {
        ruleMatched = Number(srcVal) > Number(targetVal);
      } else if (op === "less_than") {
        ruleMatched = Number(srcVal) < Number(targetVal);
      } else if (op === "in") {
        const list = (Array.isArray(targetVal) ? targetVal : String(targetVal ?? "").split(",")).map((s) =>
          String(s).trim().toLowerCase()
        );
        if (Array.isArray(srcVal)) {
          ruleMatched = srcVal.some((s) => list.includes(String(s).trim().toLowerCase()));
        } else {
          ruleMatched = list.includes(String(srcVal ?? "").trim().toLowerCase());
        }
      } else if (op === "is_empty") {
        ruleMatched = srcVal === undefined || srcVal === null || srcVal === "" || (Array.isArray(srcVal) && srcVal.length === 0);
      } else if (op === "is_not_empty") {
        ruleMatched = srcVal !== undefined && srcVal !== null && srcVal !== "" && (!Array.isArray(srcVal) || srcVal.length > 0);
      } else {
        ruleMatched = true;
      }

      if (action === "hide" || action === "skip") {
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

  // Sections setup (with dynamic conditional section visibility / skip filtering)
  const rawSections: FormSection[] = useMemo(() => {
    if (form.sections_config && form.sections_config.length > 0) {
      return [...form.sections_config].sort((a, b) => a.order - b.order);
    }
    return [{ id: "default", title: "Registration Details", order: 0 }];
  }, [form.sections_config]);

  const sections: FormSection[] = useMemo(() => {
    const filtered = rawSections.filter((s) => evaluateConditions(s.conditions, formValues));
    return filtered.length > 0 ? filtered : rawSections;
  }, [rawSections, formValues]);

  // Wizard state (for multi-step layout mode)
  const isMultiStep = event.form_layout_mode === "multi_step" && sections.length > 1;
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const activeStepIndex = Math.min(currentStepIndex, Math.max(0, sections.length - 1));

  // Status
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);
  const [capturingGeoKey, setCapturingGeoKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewSuccess, setPreviewSuccess] = useState<string | null>(null);
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

  // Client-side file validation against configured bounds/allowed types
  const validateFileBeforeUpload = (field: EventFormField | undefined, file: File): string | null => {
    const maxMb = Math.min(Number(field?.validation_config?.max_size_mb || 15), 15);
    if (file.size > maxMb * 1024 * 1024) {
      return `'${field?.label || "File"}' exceeds maximum allowed size (${maxMb} MB).`;
    }
    const allowed = field?.validation_config?.allowed_types;
    if (Array.isArray(allowed) && allowed.length > 0) {
      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() || "" : "";
      const normAllowed = allowed.map((t) => String(t).trim().toLowerCase().replace(/^\./, ""));
      const mime = (file.type || "").toLowerCase();
      const matched = normAllowed.some(
        (a) => a === ext || a === mime || (a.endsWith("/*") && mime.startsWith(a.replace("/*", "/")))
      );
      if (!matched) {
        return `File type '.${ext || mime}' is not allowed for '${field?.label || "File"}'. Allowed: ${allowed.join(", ")}`;
      }
    }
    return null;
  };

  // Upload or create temporary preview descriptor without polluting Drive/DB when in Preview mode
  const performFieldFileUpload = async (fieldKey: string, file: File) => {
    if (isPreviewMode) {
      const localUrl = typeof URL !== "undefined" ? URL.createObjectURL(file) : "";
      return {
        storage_reference: `preview_${Date.now()}_${file.name}`,
        original_filename: file.name,
        mime_type: file.type || "application/octet-stream",
        file_size: file.size,
        file_url: localUrl,
      };
    }
    return eventsApi.uploadEventFile(file, {
      eventId: event.id,
      fieldKey,
      uploadScope: "student_submission",
    });
  };

  // Single File upload handler
  const handleFileUpload = async (field: EventFormField, file: File) => {
    const key = field.field_key;
    const preErr = validateFileBeforeUpload(field, file);
    if (preErr) {
      setErrorMessage(preErr);
      return;
    }

    setUploadingFieldKey(key);
    setErrorMessage(null);

    try {
      const res = await performFieldFileUpload(key, file);
      const newFileEntry = {
        field_key: key,
        storage_reference: res.storage_reference,
        original_filename: res.original_filename,
        mime_type: res.mime_type,
        file_size: res.file_size,
        file_url: res.file_url,
      };

      setUploadedFiles((prev) => [
        ...prev.filter((f) => f.field_key !== key),
        newFileEntry,
      ]);
      handleFieldChange(key, {
        storage_reference: res.storage_reference,
        original_filename: res.original_filename,
        file_url: res.file_url,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload file. Please try again.");
    } finally {
      setUploadingFieldKey(null);
    }
  };

  // Multi-file Gallery / Multiple Upload handler
  const handleGalleryFieldUpload = async (field: EventFormField, fileList: FileList) => {
    const key = field.field_key;
    const existingList: any[] = Array.isArray(formValues[key]) ? [...formValues[key]] : [];
    const maxFiles = field.validation_config?.max_files;
    if (maxFiles && existingList.length + fileList.length > maxFiles) {
      setErrorMessage(`'${field.label}' allows at most ${maxFiles} file(s).`);
      return;
    }

    setUploadingFieldKey(key);
    setErrorMessage(null);

    try {
      const addedFileEntries: typeof uploadedFiles = [];

      for (const file of Array.from(fileList)) {
        const preErr = validateFileBeforeUpload(field, file);
        if (preErr) {
          setErrorMessage(preErr);
          continue;
        }
        const res = await performFieldFileUpload(key, file);
        addedFileEntries.push({
          field_key: key,
          storage_reference: res.storage_reference,
          original_filename: res.original_filename,
          mime_type: res.mime_type,
          file_size: res.file_size,
          file_url: res.file_url,
        });
        existingList.push({
          storage_reference: res.storage_reference,
          original_filename: res.original_filename,
          file_url: res.file_url,
        });
      }

      if (addedFileEntries.length > 0) {
        setUploadedFiles((prev) => [...prev, ...addedFileEntries]);
        handleFieldChange(key, existingList);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload files.");
    } finally {
      setUploadingFieldKey(null);
    }
  };

  // Geotag capture handler
  const handleCaptureGeoPhoto = (field: EventFormField, file: File) => {
    const key = field.field_key;
    const preErr = validateFileBeforeUpload(field, file);
    if (preErr) {
      setErrorMessage(preErr);
      return;
    }

    setCapturingGeoKey(key);
    setErrorMessage(null);

    const uploadGeo = async (pos?: GeolocationPosition) => {
      try {
        const res = await performFieldFileUpload(key, file);
        const geoData: GeoLocationData & { file_url?: string } = pos
          ? {
              has_geo: true,
              latitude: Number(pos.coords.latitude.toFixed(6)),
              longitude: Number(pos.coords.longitude.toFixed(6)),
              accuracy: Math.round(pos.coords.accuracy),
              timestamp: new Date(pos.timestamp).toISOString(),
              storage_reference: res.storage_reference,
              original_filename: res.original_filename,
              file_url: res.file_url,
            }
          : {
              has_geo: false,
              timestamp: new Date().toISOString(),
              storage_reference: res.storage_reference,
              original_filename: res.original_filename,
              file_url: res.file_url,
            };

        setUploadedFiles((prev) => [
          ...prev.filter((f) => f.field_key !== key),
          {
            field_key: key,
            storage_reference: res.storage_reference,
            original_filename: res.original_filename,
            mime_type: res.mime_type,
            file_size: res.file_size,
            file_url: res.file_url,
          },
        ]);
        handleFieldChange(key, geoData);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to upload photo.");
      } finally {
        setCapturingGeoKey(null);
      }
    };

    if (!navigator.geolocation) {
      uploadGeo();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => uploadGeo(pos),
      (err) => {
        console.warn("Geolocation prompt was denied or unavailable:", err.message);
        uploadGeo();
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Evaluate conditional visibility for a field
  const isFieldVisible = (f: EventFormField): boolean => evaluateConditions(f.conditions, formValues);

  // Shared field validator used for both step navigation and final submission
  const validateFields = (targetFields: EventFormField[]): string | null => {
    const visibleSectionIds = new Set(sections.map((s) => s.id));
    const fallbackSecId = rawSections[0]?.id || "default";

    for (const f of targetFields) {
      const fSecId = f.section_id || fallbackSecId;
      if (rawSections.some((s) => s.id === fSecId) && !visibleSectionIds.has(fSecId)) continue;
      if (f.enabled === false || !isFieldVisible(f)) continue;
      if (LAYOUT_FIELD_TYPES.includes(f.field_type)) continue;

      const vCfg = f.validation_config || {};
      const customErr = vCfg.custom_error || undefined;
      const val = formValues[f.field_key];
      const isFileField = FILE_UPLOAD_TYPES.includes(f.field_type);
      const hasUploaded = uploadedFiles.some((uf) => uf.field_key === f.field_key);

      if (otherSelected[f.field_key] && !String(otherTexts[f.field_key] || "").trim()) {
        return `Please specify your "Other" answer for '${f.label}'.`;
      }

      if (f.required) {
        if (isFileField && !hasUploaded && (!val || (Array.isArray(val) && val.length === 0))) {
          return customErr || `'${f.label}' is required. Please upload the requested photo or document.`;
        }
        if (f.field_type === "repeatable_group") {
          const entries = Array.isArray(val) ? val : [];
          const min = f.repeatable_config?.min_items || 1;
          if (entries.length < min) {
            return customErr || `'${f.label}' requires at least ${min} entr${min === 1 ? "y" : "ies"}.`;
          }
          for (let i = 0; i < entries.length; i++) {
            for (const subF of f.repeatable_config?.fields || []) {
              if (subF.required && !String(entries[i]?.[subF.field_key] ?? "").trim()) {
                return `Please fill '${subF.label}' for ${f.repeatable_config?.entity_name || "Entry"} #${i + 1}.`;
              }
            }
          }
        } else if (f.field_type === "checkbox" && getFieldOptions(f).length === 0 && !vCfg.allow_other) {
          if (val !== true) {
            return customErr || `'${f.label}' must be checked before continuing.`;
          }
        } else if (f.field_type === "date_range") {
          if (!val?.start || !val?.end) {
            return customErr || `'${f.label}' requires both start and end dates.`;
          }
        } else if (!isFileField) {
          const empty =
            val === undefined ||
            val === null ||
            (typeof val === "string" && !val.trim()) ||
            (Array.isArray(val) && val.length === 0);
          if (empty) {
            return customErr || `'${f.label}' is a required field.`;
          }
        }
      }

      // Bounds & format validation on populated values
      if (val !== undefined && val !== null && val !== "" && (!Array.isArray(val) || val.length > 0)) {
        if (f.field_type === "date_range" && val.start && val.end && val.end < val.start) {
          return customErr || `'${f.label}': End date cannot be earlier than start date.`;
        }
        if (f.field_type === "number" || f.field_type === "numeric_rating" || f.field_type === "custom_scale") {
          const numVal = Number(val);
          if (Number.isNaN(numVal)) {
            return customErr || `'${f.label}' must be a valid number.`;
          }
          if (f.field_type === "number" && vCfg.number_mode === "integer" && !Number.isInteger(numVal)) {
            return customErr || `'${f.label}' must be a whole integer.`;
          }
          if (vCfg.min_val !== undefined && vCfg.min_val !== null && numVal < Number(vCfg.min_val)) {
            return customErr || `'${f.label}' must be at least ${vCfg.min_val}.`;
          }
          if (vCfg.max_val !== undefined && vCfg.max_val !== null && numVal > Number(vCfg.max_val)) {
            return customErr || `'${f.label}' cannot exceed ${vCfg.max_val}.`;
          }
        }
        if (["text", "textarea", "rich_text"].includes(f.field_type)) {
          const sTrim = String(val).trim();
          const sLen = sTrim.length;
          if (vCfg.min_len && sLen > 0 && sLen < Number(vCfg.min_len)) {
            return customErr || `'${f.label}' must be at least ${vCfg.min_len} characters.`;
          }
          if (vCfg.max_len && sLen > Number(vCfg.max_len)) {
            return customErr || `'${f.label}' cannot exceed ${vCfg.max_len} characters.`;
          }
          if (vCfg.regex_pattern && sLen > 0) {
            try {
              const rx = new RegExp(vCfg.regex_pattern);
              if (!rx.test(sTrim)) {
                return customErr || `'${f.label}' does not match the required pattern.`;
              }
            } catch {
              // Ignore invalid regex syntax configured by mistake
            }
          }
        }
        if (f.field_type === "email" && typeof val === "string" && val.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
          return customErr || `'${f.label}' must be a valid email address.`;
        }
        if (f.field_type === "phone" && typeof val === "string" && val.trim()) {
          const digits = val.replace(/\D/g, "");
          if (digits.length < 7 || digits.length > 15) {
            return customErr || `'${f.label}' must be a valid phone number.`;
          }
        }
        if (f.field_type === "url" && typeof val === "string" && val.trim() && !/^https?:\/\/[^\s]+/i.test(val.trim())) {
          return customErr || `'${f.label}' must start with http:// or https://.`;
        }
        if (["checkbox", "multi_select"].includes(f.field_type) && Array.isArray(val)) {
          if (vCfg.min_selections !== undefined && vCfg.min_selections !== null && val.length < Number(vCfg.min_selections)) {
            return customErr || `'${f.label}' requires at least ${vCfg.min_selections} selection(s).`;
          }
          if (vCfg.max_selections !== undefined && vCfg.max_selections !== null && val.length > Number(vCfg.max_selections)) {
            return customErr || `'${f.label}' allows at most ${vCfg.max_selections} selection(s).`;
          }
        }
        if (["date", "datetime"].includes(f.field_type) && typeof val === "string") {
          const valCmp = val.slice(0, 10);
          if (vCfg.min_date && valCmp < vCfg.min_date) {
            return customErr || `'${f.label}' must be on or after ${vCfg.min_date}.`;
          }
          if (vCfg.max_date && valCmp > vCfg.max_date) {
            return customErr || `'${f.label}' must be on or before ${vCfg.max_date}.`;
          }
        }
        if (f.field_type === "time" && typeof val === "string") {
          const valTime = val.slice(0, 5);
          if (vCfg.min_time && valTime < vCfg.min_time) {
            return customErr || `'${f.label}' must be at or after ${vCfg.min_time}.`;
          }
          if (vCfg.max_time && valTime > vCfg.max_time) {
            return customErr || `'${f.label}' must be at or before ${vCfg.max_time}.`;
          }
        }
      }
    }
    return null;
  };

  // Validate step fields before wizard advance
  const validateStep = (stepIndex: number): boolean => {
    setErrorMessage(null);
    const targetSection = sections[stepIndex];
    if (!targetSection) return true;

    const fallbackSecId = rawSections[0]?.id || "default";
    const stepFields = form.fields.filter((f) => (f.section_id || fallbackSecId) === targetSection.id);
    const err = validateFields(stepFields);
    if (err) {
      setErrorMessage(err);
      return false;
    }
    return true;
  };

  // Submit response to Backend (or simulate validation in preview mode)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setPreviewSuccess(null);

    const err = validateFields(form.fields || []);
    if (err) {
      setErrorMessage(err);
      return;
    }

    if (isPreviewMode) {
      setPreviewSuccess(
        formSettings.success_message ||
          "Preview validation passed! Required checks, min/max bounds, and conditional rules are working correctly."
      );
      return;
    }

    const payload: EventSubmissionRequest = {
      form_version_id: form.id,
      values: formValues,
      uploaded_files: uploadedFiles.map(({ file_url: _u, ...rest }) => rest),
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
            {formSettings.success_message || (
              <>
                Your response has been confirmed and saved for{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">{formSettings.form_title || event.title}</span>.
              </>
            )}
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

  // Active section fields for wizard
  const visibleSections = isMultiStep ? [sections[activeStepIndex]].filter(Boolean) : sections;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-5 sm:p-7 shadow-xs space-y-6">
      {/* Event / Form Header Card */}
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
          {formSettings.form_title || event.title}
        </h2>
        {event.subtitle && (
          <p className="text-xs font-medium text-blue-600 dark:text-[#5DD62C] mt-0.5">{event.subtitle}</p>
        )}
        {(formSettings.form_description || event.short_description) && (
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-2 leading-relaxed">
            {formSettings.form_description || event.short_description}
          </p>
        )}
        {formSettings.custom_instructions && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 leading-relaxed whitespace-pre-line">
            <span className="font-bold">Instructions: </span>
            {formSettings.custom_instructions}
          </div>
        )}
      </div>

      {/* Multi-Step Wizard Progress & Section Navigation Pills */}
      {isMultiStep && (formSettings.show_progress_indicator !== false || formSettings.show_section_navigation !== false) && (
        <div className="space-y-2.5">
          {formSettings.show_progress_indicator !== false && (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Step {activeStepIndex + 1} of {sections.length}: {sections[activeStepIndex]?.title}
                </span>
                <span className="font-mono text-[11px]">{Math.round(((activeStepIndex + 1) / sections.length) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#252525] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 dark:bg-[#5DD62C] h-full transition-all duration-300"
                  style={{ width: `${((activeStepIndex + 1) / sections.length) * 100}%` }}
                />
              </div>
            </>
          )}
          {formSettings.show_section_navigation !== false && (
            <div className="flex flex-wrap gap-1.5">
              {sections.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (idx <= activeStepIndex || validateStep(activeStepIndex)) {
                      setCurrentStepIndex(idx);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    idx === activeStepIndex
                      ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black"
                      : idx < activeStepIndex
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-100 dark:bg-[#202020] text-slate-500"
                  }`}
                >
                  {idx + 1}. {s.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error / Preview Banners */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-500 cursor-pointer">×</button>
        </div>
      )}
      {previewSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
          <span>✓ {previewSuccess}</span>
          <button type="button" onClick={() => setPreviewSuccess(null)} className="text-emerald-600 cursor-pointer">×</button>
        </div>
      )}

      {/* Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {visibleSections.map((sec) => {
          const fallbackSecId = sections[0]?.id || "default";
          const secFields = form.fields
            .filter((f) => (f.section_id || fallbackSecId) === sec.id && f.enabled !== false && isFieldVisible(f))
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

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
                  const fieldOpts = getFieldOptions(f);

                  // 1. Layout Blocks
                  if (LAYOUT_FIELD_TYPES.includes(f.field_type)) {
                    if (f.field_type === "heading") {
                      return <h3 key={f.id} className="text-sm font-bold text-slate-900 dark:text-white pt-2">{f.label}</h3>;
                    }
                    if (f.field_type === "subheading") {
                      return <h4 key={f.id} className="text-xs font-semibold text-slate-700 dark:text-slate-300 pt-1">{f.label}</h4>;
                    }
                    if (f.field_type === "description" || f.field_type === "rich_text_block") {
                      return (
                        <div key={f.id} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{f.label}</p>
                          {f.description && <p className="mt-0.5 text-slate-500 dark:text-slate-400">{f.description}</p>}
                        </div>
                      );
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
                    if (f.field_type === "image_block" && (f.placeholder || f.default_value)) {
                      return (
                        <div key={f.id} className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#292929]">
                          <img src={resolveEventAssetUrl(f.default_value || f.placeholder, authToken)} alt={f.label} className="w-full max-h-64 object-cover" />
                          {f.label && <p className="px-3 py-1.5 text-[11px] text-slate-500 bg-slate-50 dark:bg-[#202020]">{f.label}</p>}
                        </div>
                      );
                    }
                    if (f.field_type === "pdf_link" && (f.placeholder || f.default_value)) {
                      return (
                        <a
                          key={f.id}
                          href={resolveEventAssetUrl(f.default_value || f.placeholder, authToken, true)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#2d2d2d] text-xs font-semibold text-blue-600 dark:text-[#5DD62C] hover:underline"
                        >
                          <span>📄 {f.label}</span>
                          <span>Download PDF ↗</span>
                        </a>
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
                          {fieldOpts.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      )}

                      {/* Radio (Multiple Choice + optional Other) */}
                      {f.field_type === "radio" && (
                        <div className="space-y-1.5 pt-1">
                          {fieldOpts.map((opt) => (
                            <label key={opt.value} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#202020]">
                              <input
                                type="radio"
                                name={f.field_key}
                                value={opt.value}
                                checked={!otherSelected[f.field_key] && val === opt.value}
                                onChange={() => {
                                  setOtherSelected((prev) => ({ ...prev, [f.field_key]: false }));
                                  handleFieldChange(f.field_key, opt.value);
                                }}
                                className="text-blue-600 focus:ring-blue-500"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                          {f.validation_config?.allow_other && (
                            <div className="space-y-1.5 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#202020]">
                              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                <input
                                  type="radio"
                                  name={f.field_key}
                                  checked={Boolean(otherSelected[f.field_key])}
                                  onChange={() => {
                                    setOtherSelected((prev) => ({ ...prev, [f.field_key]: true }));
                                    const txt = otherTexts[f.field_key] || "";
                                    handleFieldChange(f.field_key, txt ? `Other: ${txt}` : "__other__");
                                  }}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span>{f.validation_config?.other_label || "Other"}</span>
                              </label>
                              {otherSelected[f.field_key] && (
                                <input
                                  type="text"
                                  value={otherTexts[f.field_key] || ""}
                                  placeholder="Please specify..."
                                  onChange={(e) => {
                                    const txt = e.target.value;
                                    setOtherTexts((prev) => ({ ...prev, [f.field_key]: txt }));
                                    handleFieldChange(f.field_key, txt.trim() ? `Other: ${txt}` : "__other__");
                                  }}
                                  className="ml-6 w-[calc(100%-1.5rem)] text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Checkbox (Multi-option group + optional Other, OR single confirmation checkbox) */}
                      {f.field_type === "checkbox" && (
                        fieldOpts.length > 0 || f.validation_config?.allow_other ? (
                          <div className="space-y-1.5 pt-1">
                            {fieldOpts.map((opt) => {
                              const isChecked = Array.isArray(val) && val.includes(opt.value);
                              return (
                                <label key={opt.value} className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#202020]">
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
                            {f.validation_config?.allow_other && (
                              <div className="space-y-1.5 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#202020]">
                                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(otherSelected[f.field_key])}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setOtherSelected((prev) => ({ ...prev, [f.field_key]: checked }));
                                      const baseList = (Array.isArray(val) ? val : []).filter(
                                        (x: any) => !(typeof x === "string" && (x === "__other__" || x.startsWith("Other:")))
                                      );
                                      if (checked) {
                                        const txt = otherTexts[f.field_key] || "";
                                        handleFieldChange(f.field_key, [...baseList, txt.trim() ? `Other: ${txt}` : "__other__"]);
                                      } else {
                                        handleFieldChange(f.field_key, baseList);
                                      }
                                    }}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>{f.validation_config?.other_label || "Other"}</span>
                                </label>
                                {otherSelected[f.field_key] && (
                                  <input
                                    type="text"
                                    value={otherTexts[f.field_key] || ""}
                                    placeholder="Please specify..."
                                    onChange={(e) => {
                                      const txt = e.target.value;
                                      setOtherTexts((prev) => ({ ...prev, [f.field_key]: txt }));
                                      const baseList = (Array.isArray(val) ? val : []).filter(
                                        (x: any) => !(typeof x === "string" && (x === "__other__" || x.startsWith("Other:")))
                                      );
                                      handleFieldChange(f.field_key, [...baseList, txt.trim() ? `Other: ${txt}` : "__other__"]);
                                    }}
                                    className="ml-6 w-[calc(100%-1.5rem)] text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/60 dark:bg-[#161616]">
                            <input
                              type="checkbox"
                              checked={val === true}
                              onChange={(e) => handleFieldChange(f.field_key, e.target.checked)}
                              className="mt-0.5 rounded text-blue-600 dark:text-[#5DD62C] focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="leading-relaxed">I confirm and agree to this requirement</span>
                          </label>
                        )
                      )}

                      {/* Multi-Select Pills */}
                      {f.field_type === "multi_select" && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {fieldOpts.map((opt) => {
                            const selected = Array.isArray(val) && val.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleCheckboxToggle(f.field_key, opt.value)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                  selected
                                    ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50 dark:bg-[#5DD62C]/15 text-blue-700 dark:text-[#5DD62C]"
                                    : "border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {selected ? "✓ " : ""}{opt.label}
                              </button>
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
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {Array.from({ length: f.rating_config?.max_rating || 5 }, (_, i) => i + 1).map((star) => (
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
                            {val ? `${val} / ${f.rating_config?.max_rating || 5} Stars` : "Tap to rate"}
                          </span>
                        </div>
                      )}

                      {/* Satisfaction / Difficulty Scale */}
                      {(f.field_type === "satisfaction_rating" || f.field_type === "difficulty_rating") && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(f.rating_config?.options ||
                            (f.field_type === "difficulty_rating"
                              ? ["Beginner", "Intermediate", "Advanced"]
                              : ["Poor", "Fair", "Good", "Very Good", "Excellent"])
                          ).map((opt) => (
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

                      {/* Numeric Scale / Custom Scale */}
                      {(f.field_type === "numeric_rating" || f.field_type === "custom_scale") && (
                        <div className="space-y-1.5 pt-1">
                          {f.rating_config?.options && f.rating_config.options.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {f.rating_config.options.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => handleFieldChange(f.field_key, opt)}
                                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                                    val === opt
                                      ? "border-blue-600 dark:border-[#5DD62C] bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black"
                                      : "border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {(() => {
                                const minR = f.rating_config?.min_rating ?? (f.field_type === "custom_scale" ? 1 : 0);
                                const maxR = f.rating_config?.max_rating ?? (f.field_type === "custom_scale" ? 5 : 10);
                                return Array.from({ length: Math.max(2, maxR - minR + 1) }, (_, i) => minR + i).map((num) => (
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
                                ));
                              })()}
                            </div>
                          )}
                          {(f.rating_config?.min_label || f.rating_config?.max_label) && (
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>{f.rating_config?.min_label}</span>
                              <span>{f.rating_config?.max_label}</span>
                            </div>
                          )}
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
                              if (file) handleCaptureGeoPhoto(f, file);
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
                            <div className="p-2.5 rounded-lg bg-white dark:bg-[#1d1d1d] border border-slate-200 dark:border-[#2d2d2d] text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                              {val.has_geo ? (
                                <p className="text-emerald-600 dark:text-[#5DD62C] font-semibold flex items-center gap-1">
                                  <span>✓ Verified Location:</span> {val.latitude}°, {val.longitude}° (±{val.accuracy}m)
                                </p>
                              ) : (
                                <p className="text-amber-500 font-semibold">
                                  ⚠️ Location coordinates unavailable (photo recorded)
                                </p>
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-400">
                                  {val.original_filename || "Geo photo"} • {val.timestamp ? new Date(val.timestamp).toLocaleTimeString() : ""}
                                </span>
                                {(val.file_url || val.storage_reference) && (
                                  <a
                                    href={resolveEventAssetUrl(val.file_url || val.storage_reference, authToken, false)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-[#5DD62C] underline font-semibold"
                                  >
                                    View Photo ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Repeatable Group (e.g. Team Members) */}
                      {f.field_type === "repeatable_group" && (
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/40 dark:bg-[#161616] space-y-3">
                          {(() => {
                            const entries: any[] = Array.isArray(val) && val.length > 0 ? val : [{}];
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
                                      {entries.length > (repCfg.min_items || 1) && (
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
                                      {(repCfg.fields || []).map((subF) => {
                                        const subOpts = getFieldOptions(subF);
                                        return (
                                          <div key={subF.field_key}>
                                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                              {subF.label} {subF.required && <span className="text-rose-500">*</span>}
                                            </label>
                                            {subF.field_type === "dropdown" && subOpts.length > 0 ? (
                                              <select
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
                                              >
                                                <option value="">-- Select --</option>
                                                {subOpts.map((o) => (
                                                  <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                              </select>
                                            ) : (
                                              <input
                                                type={subF.field_type === "email" ? "email" : subF.field_type === "number" ? "number" : "text"}
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
                                            )}
                                          </div>
                                        );
                                      })}
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

                      {/* Multi-Image Gallery OR Multi-File Upload */}
                      {(f.field_type === "gallery_upload" ||
                        (["file", "pdf_upload", "image_upload", "document_upload"].includes(f.field_type) &&
                          (f.validation_config?.allow_multiple_files || (f.validation_config?.max_files || 1) > 1))) && (
                        <div className="space-y-2">
                          <input
                            type="file"
                            multiple
                            accept={
                              f.field_type === "pdf_upload"
                                ? ".pdf,application/pdf"
                                : f.field_type === "image_upload" || f.field_type === "gallery_upload"
                                ? "image/*"
                                : f.field_type === "document_upload"
                                ? ".pdf,.doc,.docx,.txt"
                                : undefined
                            }
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleGalleryFieldUpload(f, e.target.files);
                              }
                            }}
                            disabled={uploadingFieldKey === f.field_key}
                            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#252525] dark:file:text-[#5DD62C] cursor-pointer"
                          />
                          {uploadingFieldKey === f.field_key && (
                            <p className="text-[11px] text-blue-500 animate-pulse">
                              {isPreviewMode ? "Staging preview files..." : "Uploading files to Google Drive..."}
                            </p>
                          )}
                          {Array.isArray(val) && val.length > 0 && (
                            <div className="space-y-1.5">
                              {val.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#2d2d2d] text-[11px]">
                                  <span className="truncate font-semibold text-emerald-600 dark:text-[#5DD62C]">
                                    ✓ {item.original_filename || `File #${idx + 1}`}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {(item.file_url || item.storage_reference) && !String(item.storage_reference || "").startsWith("preview_") && (
                                      <a
                                        href={resolveEventAssetUrl(item.file_url || item.storage_reference, authToken, false)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-[#5DD62C] underline font-semibold"
                                      >
                                        View
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleFieldChange(f.field_key, val.filter((_: any, i: number) => i !== idx))}
                                      className="text-rose-500 hover:underline cursor-pointer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Single File / PDF / Document / Image / Camera Upload */}
                      {["file", "pdf_upload", "image_upload", "document_upload", "camera_capture"].includes(f.field_type) &&
                        !f.validation_config?.allow_multiple_files &&
                        (f.validation_config?.max_files || 1) <= 1 && (
                        <div className="space-y-1.5">
                          <input
                            type="file"
                            accept={
                              f.field_type === "pdf_upload"
                                ? ".pdf,application/pdf"
                                : f.field_type === "image_upload" || f.field_type === "camera_capture"
                                ? "image/*"
                                : f.field_type === "document_upload"
                                ? ".pdf,.doc,.docx,.txt"
                                : undefined
                            }
                            capture={f.field_type === "camera_capture" ? "environment" : undefined}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(f, file);
                            }}
                            disabled={uploadingFieldKey === f.field_key}
                            className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#252525] dark:file:text-[#5DD62C] cursor-pointer"
                          />
                          {uploadingFieldKey === f.field_key && (
                            <p className="text-[11px] text-blue-500 animate-pulse">
                              {isPreviewMode ? "Staging preview file..." : "Uploading file securely to Google Drive..."}
                            </p>
                          )}
                          {val && !Array.isArray(val) && (
                            <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-[#5DD62C] font-semibold">
                              <span>
                                ✓ {isPreviewMode ? "Preview attached" : "Uploaded"}: {typeof val === "object" ? val.original_filename : String(val)}
                              </span>
                              {(val.file_url || val.storage_reference) && !String(val.storage_reference || "").startsWith("preview_") && (
                                <a
                                  href={resolveEventAssetUrl(typeof val === "object" ? (val.file_url || val.storage_reference) : val, authToken, true)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-[#5DD62C] underline"
                                >
                                  View / Download ↗
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Date Range */}
                      {f.field_type === "date_range" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">From Date</label>
                            <input
                              type="date"
                              value={val?.start || ""}
                              onChange={(e) => handleFieldChange(f.field_key, { ...(val || {}), start: e.target.value })}
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 mb-0.5">To Date</label>
                            <input
                              type="date"
                              value={val?.end || ""}
                              onChange={(e) => handleFieldChange(f.field_key, { ...(val || {}), end: e.target.value })}
                              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Long Textarea / Rich Text */}
                      {(f.field_type === "textarea" || f.field_type === "rich_text") && (
                        <textarea
                          rows={f.field_type === "rich_text" ? 5 : 3}
                          value={val || ""}
                          placeholder={f.placeholder || "Enter your detailed response..."}
                          onChange={(e) => handleFieldChange(f.field_key, e.target.value)}
                          className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      )}

                      {/* Standard text, number, email, phone, url, date, time, datetime */}
                      {![
                        "dropdown", "radio", "checkbox", "multi_select", "yes_no",
                        "star_rating", "satisfaction_rating", "difficulty_rating", "numeric_rating", "custom_scale",
                        "geo_photo", "repeatable_group", "gallery_upload", "file", "pdf_upload",
                        "image_upload", "document_upload", "camera_capture", "date_range", "textarea", "rich_text",
                      ].includes(f.field_type) && (
                        <input
                          type={
                            f.field_type === "number"
                              ? "number"
                              : f.field_type === "email"
                              ? "email"
                              : f.field_type === "url"
                              ? "url"
                              : f.field_type === "phone"
                              ? "tel"
                              : f.field_type === "date"
                              ? "date"
                              : f.field_type === "time"
                              ? "time"
                              : f.field_type === "datetime"
                              ? "datetime-local"
                              : "text"
                          }
                          step={
                            f.field_type === "number"
                              ? f.validation_config?.number_mode === "integer"
                                ? "1"
                                : "any"
                              : undefined
                          }
                          min={
                            f.field_type === "date" || f.field_type === "datetime"
                              ? f.validation_config?.min_date
                              : f.field_type === "time"
                              ? f.validation_config?.min_time
                              : f.field_type === "number"
                              ? f.validation_config?.min_val
                              : undefined
                          }
                          max={
                            f.field_type === "date" || f.field_type === "datetime"
                              ? f.validation_config?.max_date
                              : f.field_type === "time"
                              ? f.validation_config?.max_time
                              : f.field_type === "number"
                              ? f.validation_config?.max_val
                              : undefined
                          }
                          value={val ?? ""}
                          placeholder={f.placeholder || "Enter value..."}
                          onChange={(e) => handleFieldChange(f.field_key, e.target.value)}
                          className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      )}

                      {(f.help_text || f.validation_config?.help_text) && (
                        <p className="text-[10px] text-slate-400 dark:text-[#777] pt-0.5">
                          💡 {f.help_text || f.validation_config?.help_text}
                        </p>
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
            {isMultiStep && formSettings.show_section_navigation !== false && activeStepIndex > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStepIndex(Math.max(0, activeStepIndex - 1))}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#333] bg-white dark:bg-[#202020] text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                ← Back
              </button>
            )}

            {isMultiStep && formSettings.show_section_navigation !== false && activeStepIndex < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (validateStep(activeStepIndex)) {
                    setCurrentStepIndex(Math.min(sections.length - 1, activeStepIndex + 1));
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
                ) : isPreviewMode ? (
                  "Test Form Validation (Preview)"
                ) : existingSubmission ? (
                  "Update My Submission"
                ) : (
                  formSettings.submit_button_label || "Submit Registration"
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
