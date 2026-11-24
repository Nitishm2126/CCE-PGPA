"use client";

import React, { useState } from "react";
import { EventFormField, FormFieldType, FormFieldOption, EventItem } from "@/types/events";
import { eventsApi } from "@/lib/events-api";

interface EventFormBuilderProps {
  event: EventItem;
  initialFields?: EventFormField[];
  onSaved?: () => void;
  onBack?: () => void;
}

const FIELD_TYPE_DEFINITIONS: Array<{
  type: FormFieldType;
  label: string;
  category: "input" | "choice" | "datetime" | "content";
  icon: string;
  defaultLabel: string;
}> = [
  { type: "text", label: "Short Text", category: "input", icon: "Aa", defaultLabel: "Full Name" },
  { type: "textarea", label: "Long Text", category: "input", icon: "¶", defaultLabel: "Statement of Purpose" },
  { type: "number", label: "Number", category: "input", icon: "#", defaultLabel: "Experience in Years" },
  { type: "email", label: "Email Address", category: "input", icon: "@", defaultLabel: "Contact Email" },
  { type: "phone", label: "Phone Number", category: "input", icon: "📞", defaultLabel: "Mobile Number" },
  { type: "dropdown", label: "Dropdown Select", category: "choice", icon: "▼", defaultLabel: "Select Your Track" },
  { type: "radio", label: "Radio Group", category: "choice", icon: "◉", defaultLabel: "T-Shirt Size" },
  { type: "checkbox", label: "Checkbox Group", category: "choice", icon: "☑", defaultLabel: "Areas of Interest" },
  { type: "date", label: "Date Input", category: "datetime", icon: "📅", defaultLabel: "Date of Birth" },
  { type: "time", label: "Time Input", category: "datetime", icon: "⏰", defaultLabel: "Preferred Time Slot" },
  { type: "file", label: "File Upload", category: "content", icon: "📎", defaultLabel: "Upload Resume / ID Card (PDF)" },
  { type: "heading", label: "Section Heading", category: "content", icon: "H", defaultLabel: "Participant Details" },
  { type: "info", label: "Information Text", category: "content", icon: "ℹ", defaultLabel: "Please ensure all details are accurate." },
];

export const EventFormBuilder: React.FC<EventFormBuilderProps> = ({
  event,
  initialFields = [],
  onSaved,
  onBack,
}) => {
  const [fields, setFields] = useState<EventFormField[]>(() => {
    if (initialFields && initialFields.length > 0) {
      return [...initialFields];
    }
    // Default initial template fields
    return [
      {
        id: "field_name_default",
        field_key: "full_name",
        field_type: "text",
        label: "Participant Name",
        description: "Official name as registered in college records",
        placeholder: "e.g. John Doe",
        required: true,
        display_order: 0,
        enabled: true,
      },
      {
        id: "field_email_default",
        field_key: "contact_email",
        field_type: "email",
        label: "College / Personal Email",
        description: "Registration confirmation will be sent here",
        placeholder: "e.g. student@sairamtap.edu.in",
        required: true,
        display_order: 1,
        enabled: true,
      },
      {
        id: "field_phone_default",
        field_key: "phone_number",
        field_type: "phone",
        label: "WhatsApp / Contact Number",
        placeholder: "10-digit mobile number",
        required: true,
        display_order: 2,
        enabled: true,
      },
    ];
  });

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id || null);
  const [mode, setMode] = useState<"builder" | "preview">("builder");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  // Add a new field
  const handleAddField = (type: FormFieldType) => {
    const def = FIELD_TYPE_DEFINITIONS.find((d) => d.type === type);
    const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newKey = `f_${type}_${fields.length + 1}`;

    const defaultOptions: FormFieldOption[] =
      type === "dropdown" || type === "radio" || type === "checkbox"
        ? [
            { label: "Option 1", value: "option_1" },
            { label: "Option 2", value: "option_2" },
            { label: "Option 3", value: "option_3" },
          ]
        : [];

    const newField: EventFormField = {
      id: newId,
      field_key: newKey,
      field_type: type,
      label: def?.defaultLabel || "New Field",
      description: "",
      placeholder: "",
      required: type !== "heading" && type !== "info",
      display_order: fields.length,
      enabled: true,
      options_config: defaultOptions,
      validation_config: type === "file" ? { allowed_types: [".pdf", ".png", ".jpg"], max_size_mb: 5 } : {},
    };

    setFields([...fields, newField]);
    setSelectedFieldId(newId);
  };

  // Remove field
  const handleRemoveField = (id: string) => {
    const updated = fields.filter((f) => f.id !== id);
    setFields(updated);
    if (selectedFieldId === id) {
      setSelectedFieldId(updated[0]?.id || null);
    }
  };

  // Reorder field Up/Down
  const handleMoveField = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    const newFields = [...fields];
    const temp = newFields[index];
    newFields[index] = newFields[targetIndex];
    newFields[targetIndex] = temp;

    // re-assign display_order
    newFields.forEach((f, idx) => {
      f.display_order = idx;
    });

    setFields(newFields);
  };

  // Update selected field property
  const handleUpdateSelectedField = (patch: Partial<EventFormField>) => {
    if (!selectedFieldId) return;
    setFields(
      fields.map((f) => {
        if (f.id === selectedFieldId) {
          return { ...f, ...patch };
        }
        return f;
      })
    );
  };

  // Options editor for dropdown/radio/checkbox
  const handleAddOption = () => {
    if (!selectedField) return;
    const currentOptions = selectedField.options_config || [];
    const nextNum = currentOptions.length + 1;
    const newOptions: FormFieldOption[] = [
      ...currentOptions,
      { label: `Option ${nextNum}`, value: `option_${nextNum}` },
    ];
    handleUpdateSelectedField({ options_config: newOptions });
  };

  const handleUpdateOption = (optIdx: number, patch: Partial<FormFieldOption>) => {
    if (!selectedField || !selectedField.options_config) return;
    const newOptions = selectedField.options_config.map((opt, idx) => {
      if (idx === optIdx) {
        return { ...opt, ...patch };
      }
      return opt;
    });
    handleUpdateSelectedField({ options_config: newOptions });
  };

  const handleRemoveOption = (optIdx: number) => {
    if (!selectedField || !selectedField.options_config) return;
    const newOptions = selectedField.options_config.filter((_, idx) => idx !== optIdx);
    handleUpdateSelectedField({ options_config: newOptions });
  };

  // Save to Backend
  const handleSaveForm = async () => {
    if (fields.length === 0) {
      setErrorMessage("Please add at least one form field before saving.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);

    try {
      await eventsApi.saveEventForm(event.id, fields);
      setSaveSuccess("Dynamic form structure saved successfully!");
      if (onSaved) onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save form fields. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header / Mode Switcher */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                title="Back to Event"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
              Form Builder: <span className="text-blue-600 dark:text-[#5DD62C]">{event.title}</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
            Design custom registration fields. Changes are versioned automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Builder vs Preview Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#202020] p-1 border border-slate-200 dark:border-[#292929]">
            <button
              type="button"
              onClick={() => setMode("builder")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "builder"
                  ? "bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
              }`}
            >
              🛠 Form Builder
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "preview"
                  ? "bg-white dark:bg-[#181818] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-[#F5F5F5]"
              }`}
            >
              👁 Live Student Preview
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveForm}
            disabled={isSaving}
            className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-4 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[38px] flex items-center gap-1.5"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : (
              "Save Form Changes"
            )}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
          <span>✓ {saveSuccess}</span>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-600 hover:text-emerald-800">×</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">×</button>
        </div>
      )}

      {/* Mode 1: LIVE STUDENT PREVIEW */}
      {mode === "preview" ? (
        <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-[#292929] pb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
              Registration Form Preview
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#F5F5F5] mt-1">{event.title}</h3>
            {event.short_description && (
              <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-1">{event.short_description}</p>
            )}
          </div>

          {/* Render Sample Student Context Card */}
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 p-3.5 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-blue-900 dark:text-blue-300">Authenticated Student Identity (Auto-Filled)</p>
              <p className="text-blue-700 dark:text-blue-400 text-[11px]">
                SEC25CO031 &bull; Nitish M &bull; 2nd Year &bull; Section A
              </p>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold text-[10px]">
              Verified
            </span>
          </div>

          {/* Form Fields Simulation */}
          <div className="space-y-4">
            {fields.map((field) => {
              if (field.field_type === "heading") {
                return (
                  <div key={field.id} className="pt-3 border-t border-slate-100 dark:border-[#292929]">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">{field.label}</h4>
                    {field.description && (
                      <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">{field.description}</p>
                    )}
                  </div>
                );
              }

              if (field.field_type === "info") {
                return (
                  <div key={field.id} className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50 dark:bg-[#202020] p-3 text-xs text-slate-700 dark:text-[#A3A3A3]">
                    {field.label}
                  </div>
                );
              }

              return (
                <div key={field.id} className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-[#E5E5E5]">
                    {field.label} {field.required && <span className="text-rose-500">*</span>}
                  </label>
                  {field.description && (
                    <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">{field.description}</p>
                  )}

                  {field.field_type === "textarea" ? (
                    <textarea
                      rows={3}
                      disabled
                      placeholder={field.placeholder || "Enter details..."}
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-slate-50 dark:bg-[#202020] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                  ) : field.field_type === "dropdown" ? (
                    <select
                      disabled
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-slate-50 dark:bg-[#202020] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    >
                      <option value="">{field.placeholder || "-- Select an option --"}</option>
                      {field.options_config?.map((opt, i) => (
                        <option key={i} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.field_type === "radio" ? (
                    <div className="space-y-1.5 pt-1">
                      {field.options_config?.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#D4D4D4] cursor-pointer">
                          <input type="radio" disabled name={field.field_key} />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.field_type === "checkbox" ? (
                    <div className="space-y-1.5 pt-1">
                      {field.options_config?.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#D4D4D4] cursor-pointer">
                          <input type="checkbox" disabled />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.field_type === "file" ? (
                    <div className="rounded-xl border border-dashed border-slate-300 dark:border-[#383838] bg-slate-50/50 dark:bg-[#202020] p-4 text-center">
                      <span className="text-xl">📁</span>
                      <p className="text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mt-1">Upload File</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Allowed: {field.validation_config?.allowed_types?.join(", ") || ".pdf, .png, .jpg"} &bull; Max {field.validation_config?.max_size_mb || 5}MB
                      </p>
                    </div>
                  ) : (
                    <input
                      type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : field.field_type === "time" ? "time" : "text"}
                      disabled
                      placeholder={field.placeholder || ""}
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-slate-50 dark:bg-[#202020] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-[#292929]">
            <button
              type="button"
              disabled
              className="w-full rounded-xl bg-blue-600 dark:bg-[#5DD62C] opacity-70 text-white dark:text-black font-semibold text-xs py-2.5"
            >
              Submit Registration Response (Preview Mode)
            </button>
          </div>
        </div>
      ) : (
        /* Mode 2: 3-PANEL BUILDER (Desktop) / STACKED (Mobile) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT PANEL: Field Palette (col-span-3) */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-3.5 shadow-2xs space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] block">
              + Add Field Types
            </span>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {FIELD_TYPE_DEFINITIONS.map((def) => (
                <button
                  key={def.type}
                  type="button"
                  onClick={() => handleAddField(def.type)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-[#292929] hover:border-blue-400 dark:hover:border-[#5DD62C] bg-slate-50/50 dark:bg-[#202020]/60 hover:bg-blue-50/50 dark:hover:bg-[#5DD62C]/10 text-xs font-semibold text-slate-800 dark:text-[#E5E5E5] transition-all cursor-pointer flex items-center justify-between group active:scale-98"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#333] flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {def.icon}
                    </span>
                    <span>{def.label}</span>
                  </div>
                  <span className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-[#5DD62C] text-sm">+</span>
                </button>
              ))}
            </div>
          </div>

          {/* CENTER PANEL: Form Canvas (col-span-5) */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#292929]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">
                Form Canvas ({fields.length} Fields)
              </span>
              <span className="text-[10px] text-slate-400">Click field to edit properties</span>
            </div>

            {fields.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-[#292929] rounded-xl text-slate-400 text-xs">
                No fields added yet. Click any field type on the left to start building your form.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {fields.map((f, idx) => {
                  const isSelected = f.id === selectedFieldId;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFieldId(f.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "border-blue-500 dark:border-[#5DD62C] bg-blue-50/40 dark:bg-[#5DD62C]/10 shadow-2xs"
                          : "border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                            {f.field_type}
                          </span>
                          <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] truncate">
                            {f.label}
                          </p>
                          {f.required && <span className="text-rose-500 font-bold">*</span>}
                        </div>

                        {/* Order & Action Controls */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveField(idx, "up")}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === fields.length - 1}
                            onClick={() => handleMoveField(idx, "down")}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(f.id)}
                            className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer ml-1"
                            title="Delete Field"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {f.description && (
                        <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3] mt-1 truncate">
                          {f.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Field Property Inspector (col-span-4) */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#292929]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">
                Field Settings
              </span>
              {selectedField && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 uppercase">
                  {selectedField.field_type}
                </span>
              )}
            </div>

            {selectedField ? (
              <div className="space-y-3 text-xs max-h-[600px] overflow-y-auto pr-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Field Label *
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => handleUpdateSelectedField({ label: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Help Text / Description
                  </label>
                  <input
                    type="text"
                    value={selectedField.description || ""}
                    onChange={(e) => handleUpdateSelectedField({ description: e.target.value })}
                    placeholder="Instructions shown below the input"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                {selectedField.field_type !== "heading" && selectedField.field_type !== "info" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={selectedField.placeholder || ""}
                      onChange={(e) => handleUpdateSelectedField({ placeholder: e.target.value })}
                      placeholder="e.g. Enter full name"
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                )}

                {/* Required Toggle */}
                {selectedField.field_type !== "heading" && selectedField.field_type !== "info" && (
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedField.required}
                        onChange={(e) => handleUpdateSelectedField({ required: e.target.checked })}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800 dark:text-[#E5E5E5]">
                        Required Field (Must be filled by student)
                      </span>
                    </label>
                  </div>
                )}

                {/* Options Configuration for Dropdown, Radio, Checkbox */}
                {(selectedField.field_type === "dropdown" ||
                  selectedField.field_type === "radio" ||
                  selectedField.field_type === "checkbox") && (
                  <div className="pt-2 border-t border-slate-100 dark:border-[#292929] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-[#D4D4D4]">
                        Options List
                      </span>
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="text-[11px] font-bold text-blue-600 dark:text-[#5DD62C] hover:underline cursor-pointer"
                      >
                        + Add Option
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {selectedField.options_config?.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) =>
                              handleUpdateOption(idx, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                            }
                            className="flex-1 rounded-lg border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-2.5 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-rose-500 hover:text-rose-700 text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Upload Config */}
                {selectedField.field_type === "file" && (
                  <div className="pt-2 border-t border-slate-100 dark:border-[#292929] space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-[#D4D4D4] block">
                      File Validation Settings
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500">Max Size (MB)</label>
                        <input
                          type="number"
                          value={selectedField.validation_config?.max_size_mb || 5}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...selectedField.validation_config,
                                max_size_mb: parseInt(e.target.value, 10) || 5,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Formats</label>
                        <input
                          type="text"
                          value={selectedField.validation_config?.allowed_types?.join(", ") || ".pdf, .png, .jpg"}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...selectedField.validation_config,
                                allowed_types: e.target.value.split(",").map((s) => s.trim()),
                              },
                            })
                          }
                          placeholder=".pdf, .png"
                          className="w-full rounded-lg border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Number validation */}
                {selectedField.field_type === "number" && (
                  <div className="pt-2 border-t border-slate-100 dark:border-[#292929] space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-[#D4D4D4] block">
                      Number Range Constraints
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500">Min Value</label>
                        <input
                          type="number"
                          value={selectedField.validation_config?.min_val ?? ""}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...selectedField.validation_config,
                                min_val: e.target.value !== "" ? parseFloat(e.target.value) : undefined,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Max Value</label>
                        <input
                          type="number"
                          value={selectedField.validation_config?.max_val ?? ""}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...selectedField.validation_config,
                                max_val: e.target.value !== "" ? parseFloat(e.target.value) : undefined,
                              },
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 p-4 text-center">
                Select a field from the canvas to edit its properties.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
