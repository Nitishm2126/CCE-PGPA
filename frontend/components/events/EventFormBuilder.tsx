"use client";

import React, { useState, useMemo } from "react";
import {
  EventFormField,
  FormFieldType,
  FormFieldOption,
  EventItem,
  FormSection,
  ConditionalRule,
  RatingConfig,
  RepeatableConfig,
  FormLayoutMode,
  EventTemplate,
} from "@/types/events";
import { eventsApi } from "@/lib/events-api";
import { EventTemplatesLibraryModal } from "@/components/events/EventTemplatesLibraryModal";
import { DynamicStudentFormRenderer } from "@/components/events/DynamicStudentFormRenderer";

interface EventFormBuilderProps {
  event: EventItem;
  initialFields?: EventFormField[];
  initialSections?: FormSection[];
  onSaved?: () => void;
  onBack?: () => void;
}

// -----------------------------------------------------------------------------
// Field Palette Definitions Categorized
// -----------------------------------------------------------------------------
interface PaletteItem {
  type: FormFieldType;
  label: string;
  category: "basic" | "datetime" | "choice" | "rating" | "upload" | "layout" | "advanced";
  icon: string;
  defaultLabel: string;
  description: string;
}

const FIELD_PALETTE: PaletteItem[] = [
  // Basic Fields
  { type: "text", label: "Short Text", category: "basic", icon: "Aa", defaultLabel: "Full Name", description: "Single-line text input" },
  { type: "textarea", label: "Paragraph / Long Text", category: "basic", icon: "¶", defaultLabel: "Statement of Purpose", description: "Multi-line text area" },
  { type: "number", label: "Number", category: "basic", icon: "#", defaultLabel: "Experience in Years", description: "Numeric value with optional bounds" },
  { type: "email", label: "Email Address", category: "basic", icon: "@", defaultLabel: "College Email", description: "Validates email format" },
  { type: "phone", label: "Phone Number", category: "basic", icon: "📞", defaultLabel: "WhatsApp / Contact Number", description: "10-digit telephone format" },
  { type: "url", label: "Website / URL", category: "basic", icon: "🔗", defaultLabel: "Portfolio or GitHub URL", description: "Validates web URL" },
  { type: "rich_text", label: "Rich Text Input", category: "basic", icon: "📝", defaultLabel: "Project Description", description: "Formatted text with bold/bullets" },

  // Date & Time
  { type: "date", label: "Date Picker", category: "datetime", icon: "📅", defaultLabel: "Date of Birth", description: "Calendar date selector" },
  { type: "time", label: "Time Picker", category: "datetime", icon: "⏰", defaultLabel: "Preferred Time Slot", description: "Time of day selector" },
  { type: "datetime", label: "Date & Time", category: "datetime", icon: "🗓", defaultLabel: "Appointment Slot", description: "Combined date and time" },
  { type: "date_range", label: "Date Range", category: "datetime", icon: "↔", defaultLabel: "Internship Duration", description: "Start and end date pair" },

  // Selection
  { type: "dropdown", label: "Dropdown Select", category: "choice", icon: "▼", defaultLabel: "Select Your Track", description: "Single choice from dropdown list" },
  { type: "radio", label: "Radio Buttons", category: "choice", icon: "◉", defaultLabel: "T-Shirt Size", description: "Single choice from radio buttons" },
  { type: "checkbox", label: "Checkbox Group", category: "choice", icon: "☑", defaultLabel: "Areas of Interest", description: "Multiple choices from checkboxes" },
  { type: "yes_no", label: "Yes / No Buttons", category: "choice", icon: "⚖", defaultLabel: "Will you bring your own laptop?", description: "Fast boolean toggle buttons" },
  { type: "multi_select", label: "Multi-Select Tags", category: "choice", icon: "🏷", defaultLabel: "Preferred Technologies", description: "Multiple tag selection" },

  // Feedback & Rating
  { type: "star_rating", label: "1–5 Star Rating", category: "rating", icon: "★", defaultLabel: "Overall Content Quality", description: "Interactive star evaluation" },
  { type: "numeric_rating", label: "Numeric Scale (1–10)", category: "rating", icon: "🔟", defaultLabel: "Likelihood to Recommend (NPS)", description: "0-10 or 1-10 numerical scale" },
  { type: "satisfaction_rating", label: "Satisfaction Scale", category: "rating", icon: "😊", defaultLabel: "Overall Satisfaction", description: "Poor to Excellent scale" },
  { type: "difficulty_rating", label: "Difficulty Rating", category: "rating", icon: "⚡", defaultLabel: "Session Difficulty Level", description: "Beginner, Intermediate, Advanced" },
  { type: "custom_scale", label: "Custom Scale", category: "rating", icon: "📊", defaultLabel: "Pacing of the Workshop", description: "Configurable discrete scale" },

  // Uploads
  { type: "file", label: "Document Upload (PDF/Word)", category: "upload", icon: "📄", defaultLabel: "Upload Resume / ID Card", description: "Document file attachment" },
  { type: "document_upload", label: "Word / Docs Upload", category: "upload", icon: "📃", defaultLabel: "Upload Report (DOCX/PDF)", description: "Strict PDF, DOC, DOCX upload" },
  { type: "image_upload", label: "Image / Screenshot", category: "upload", icon: "🖼", defaultLabel: "Payment Receipt / ID Photo", description: "PNG, JPG, or WebP image" },
  { type: "gallery_upload", label: "Multi-Image Gallery", category: "upload", icon: "🗂", defaultLabel: "Upload Multiple Photos / Screens", description: "Upload multiple PNG or JPG images" },
  { type: "pdf_upload", label: "PDF Document Only", category: "upload", icon: "📕", defaultLabel: "Upload Signed NOC (PDF)", description: "Strict PDF document upload" },
  { type: "camera_capture", label: "Live Camera Snapshot", category: "upload", icon: "📷", defaultLabel: "Take Live Photo", description: "Direct camera photo capture" },

  // Geo-tagged Photo
  { type: "geo_photo", label: "Geo-tagged Photo", category: "advanced", icon: "📍", defaultLabel: "Venue Check-in Photo with GPS", description: "Photo with optional verified coordinates" },

  // Repeatable Sections
  { type: "repeatable_group", label: "Repeatable Group", category: "advanced", icon: "👥", defaultLabel: "Team Members List", description: "Dynamic add/remove member rows" },

  // Layout Blocks
  { type: "heading", label: "Section Heading", category: "layout", icon: "H", defaultLabel: "Participant Information", description: "Visual bold title separator" },
  { type: "subheading", label: "Subheading", category: "layout", icon: "h2", defaultLabel: "Academic & Contact Details", description: "Secondary section subtitle" },
  { type: "description", label: "Description Block", category: "layout", icon: "📝", defaultLabel: "Read all eligibility instructions carefully before registering.", description: "Formatted instructional text block" },
  { type: "divider", label: "Horizontal Divider", category: "layout", icon: "—", defaultLabel: "Divider", description: "Visual separation line" },
  { type: "info_card", label: "Information Notice", category: "layout", icon: "ℹ", defaultLabel: "Please ensure all details match college records.", description: "Blue informative callout card" },
  { type: "notice", label: "Warning / Important Notice", category: "layout", icon: "⚠️", defaultLabel: "Late registrations will not be entertained.", description: "Amber warning highlight box" },
];

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export const EventFormBuilder: React.FC<EventFormBuilderProps> = ({
  event,
  initialFields = [],
  initialSections = [],
  onSaved,
  onBack,
}) => {
  // Sections state
  const [sections, setSections] = useState<FormSection[]>(() => {
    if (initialSections && initialSections.length > 0) {
      return [...initialSections];
    }
    return [{ id: "sec_default", title: "General Information", description: "Default section for event registration", order: 0 }];
  });

  // Fields state
  const [fields, setFields] = useState<EventFormField[]>(() => {
    if (initialFields && initialFields.length > 0) {
      return initialFields.map((f, idx) => ({
        ...f,
        section_id: f.section_id || (initialSections[0]?.id || "sec_default"),
        display_order: f.display_order ?? idx,
      }));
    }
    // Default 3 starter fields
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
        section_id: "sec_default",
      },
      {
        id: "field_email_default",
        field_key: "contact_email",
        field_type: "email",
        label: "College Email",
        description: "Registration confirmation will be sent here",
        placeholder: "e.g. student@sairamtap.edu.in",
        required: true,
        display_order: 1,
        enabled: true,
        section_id: "sec_default",
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
        section_id: "sec_default",
      },
    ];
  });

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || "sec_default");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id || null);
  const [layoutMode, setLayoutMode] = useState<FormLayoutMode>(event.form_layout_mode || "single_page");

  // Filter / Search for palette
  const [paletteSearch, setPaletteSearch] = useState<string>("");
  const [paletteCategory, setPaletteCategory] = useState<string>("all");

  // Mode: builder vs live student preview
  const [viewMode, setViewMode] = useState<"builder" | "preview">("builder");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Template dropdown & custom template saving state
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);
  const [tplName, setTplName] = useState<string>("");
  const [tplCategory, setTplCategory] = useState<string>(event.category || "Workshop");
  const [tplPurpose, setTplPurpose] = useState<string>("");
  const [tplDescription, setTplDescription] = useState<string>("");
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);

  // Status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Currently selected field
  const selectedField = useMemo(() => fields.find((f) => f.id === selectedFieldId), [fields, selectedFieldId]);

  // Filtered palette items
  const filteredPalette = useMemo(() => {
    return FIELD_PALETTE.filter((item) => {
      const matchesSearch =
        item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(paletteSearch.toLowerCase());
      const matchesCat = paletteCategory === "all" || item.category === paletteCategory;
      return matchesSearch && matchesCat;
    });
  }, [paletteSearch, paletteCategory]);

  // Add field to active section
  const handleAddField = (type: FormFieldType) => {
    const def = FIELD_PALETTE.find((d) => d.type === type);
    const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newKey = `f_${type}_${fields.length + 1}`;

    const defaultOptions: FormFieldOption[] =
      type === "dropdown" || type === "radio" || type === "checkbox" || type === "multi_select"
        ? [
            { label: "Option 1", value: "option_1" },
            { label: "Option 2", value: "option_2" },
            { label: "Option 3", value: "option_3" },
          ]
        : [];

    let defaultRatingConfig: RatingConfig | undefined;
    if (type === "star_rating") {
      defaultRatingConfig = { max_rating: 5, min_label: "Poor", max_label: "Excellent", scale_type: "stars" };
    } else if (type === "numeric_rating") {
      defaultRatingConfig = { max_rating: 10, min_label: "0 - Not Likely", max_label: "10 - Highly Likely", scale_type: "numbers" };
    } else if (type === "satisfaction_rating") {
      defaultRatingConfig = { options: ["Poor", "Fair", "Good", "Very Good", "Excellent"], scale_type: "labels" };
    } else if (type === "difficulty_rating") {
      defaultRatingConfig = { options: ["Beginner", "Intermediate", "Advanced"], scale_type: "labels" };
    } else if (type === "custom_scale") {
      defaultRatingConfig = { min_rating: 1, max_rating: 5, min_label: "Low", max_label: "High", scale_type: "numbers" };
    }

    let defaultRepeatable: RepeatableConfig | undefined;
    if (type === "repeatable_group") {
      defaultRepeatable = {
        entity_name: "Team Member",
        min_items: 1,
        max_items: 4,
        add_button_text: "+ Add Member",
        fields: [
          { id: `rep_sub_1_${Date.now()}`, field_key: "name", field_type: "text", label: "Full Name", required: true, display_order: 0, enabled: true },
          { id: `rep_sub_2_${Date.now()}`, field_key: "role", field_type: "text", label: "Role / Contribution", required: true, display_order: 1, enabled: true },
        ],
      };
    }

    const newField: EventFormField = {
      id: newId,
      field_key: newKey,
      field_type: type,
      label: def?.defaultLabel || "New Field",
      description: "",
      placeholder: "",
      required: !["heading", "subheading", "description", "rich_text_block", "divider", "info", "info_card", "notice"].includes(type),
      display_order: fields.length,
      enabled: true,
      section_id: activeSectionId,
      options_config: defaultOptions,
      rating_config: defaultRatingConfig,
      repeatable_config: defaultRepeatable,
      validation_config:
        ["file", "pdf_upload", "document_upload", "image_upload", "gallery_upload"].includes(type)
          ? { allowed_types: type === "pdf_upload" ? ["pdf"] : type.includes("image") || type === "gallery_upload" ? ["jpg", "jpeg", "png", "webp"] : ["pdf", "doc", "docx", "png", "jpg"], max_size_mb: 10 }
          : {},
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newId);
  };

  // Duplicate an existing field
  const handleDuplicateField = (fieldToDuplicate: EventFormField) => {
    const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newKey = `${fieldToDuplicate.field_key}_copy_${Math.floor(Math.random() * 900 + 100)}`;
    const duplicate: EventFormField = {
      ...JSON.parse(JSON.stringify(fieldToDuplicate)),
      id: newId,
      field_key: newKey,
      label: `${fieldToDuplicate.label} (Copy)`,
      display_order: fields.length,
    };
    setFields((prev) => [...prev, duplicate]);
    setSelectedFieldId(newId);
  };

  // Remove field
  const handleRemoveField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (selectedFieldId === id) {
        setSelectedFieldId(next[0]?.id || null);
      }
      return next;
    });
  };

  // Move field order
  const handleMoveField = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;

    setFields((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      copy.forEach((f, idx) => {
        f.display_order = idx;
      });
      return copy;
    });
  };

  // Update selected field property
  const handleUpdateSelectedField = (patch: Partial<EventFormField>) => {
    if (!selectedFieldId) return;
    setFields((prev) =>
      prev.map((f) => {
        if (f.id === selectedFieldId) {
          return { ...f, ...patch };
        }
        return f;
      })
    );
  };

  // Section Management
  const handleAddSection = () => {
    const newSecId = `sec_${Date.now()}`;
    const nextOrder = sections.length;
    const newSec: FormSection = {
      id: newSecId,
      title: `Section ${nextOrder + 1}`,
      description: "Optional section description",
      order: nextOrder,
    };
    setSections((prev) => [...prev, newSec]);
    setActiveSectionId(newSecId);
  };

  const handleUpdateSection = (secId: string, patch: Partial<FormSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, ...patch } : s))
    );
  };

  const handleRemoveSection = (secId: string) => {
    if (sections.length <= 1) {
      alert("A form must have at least one section.");
      return;
    }
    // Re-assign fields belonging to this section to the first available section
    const remaining = sections.filter((s) => s.id !== secId);
    const fallbackSecId = remaining[0].id;
    setSections(remaining);
    setFields((prev) =>
      prev.map((f) => (f.section_id === secId ? { ...f, section_id: fallbackSecId } : f))
    );
    if (activeSectionId === secId) {
      setActiveSectionId(fallbackSecId);
    }
  };

  // Drag-and-drop field reordering
  const handleDropField = (targetFieldId: string, targetSectionId: string) => {
    if (!draggedFieldId || draggedFieldId === targetFieldId) return;
    setFields((prev) => {
      const copy = [...prev];
      const fromIdx = copy.findIndex((f) => f.id === draggedFieldId);
      const toIdx = copy.findIndex((f) => f.id === targetFieldId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = copy.splice(fromIdx, 1);
      moved.section_id = targetSectionId;
      copy.splice(toIdx, 0, moved);
      return copy.map((f, idx) => ({ ...f, display_order: idx }));
    });
    setDraggedFieldId(null);
  };

  const handleDropToSectionEnd = (targetSectionId: string) => {
    if (!draggedFieldId) return;
    setFields((prev) => {
      const copy = [...prev];
      const fromIdx = copy.findIndex((f) => f.id === draggedFieldId);
      if (fromIdx === -1) return prev;
      const [moved] = copy.splice(fromIdx, 1);
      moved.section_id = targetSectionId;
      copy.push(moved);
      return copy.map((f, idx) => ({ ...f, display_order: idx }));
    });
    setActiveSectionId(targetSectionId);
    setDraggedFieldId(null);
  };

  const handleDuplicateSection = (secId: string) => {
    const srcSec = sections.find((s) => s.id === secId);
    if (!srcSec) return;
    const newSecId = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const newSec: FormSection = {
      ...srcSec,
      id: newSecId,
      title: `${srcSec.title} (Copy)`,
      order: sections.length,
    };
    const secFields = fields.filter((f) => f.section_id === secId);
    const clonedFields = secFields.map((f, i) => ({
      ...JSON.parse(JSON.stringify(f)),
      id: `field_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      field_key: `${f.field_key}_copy_${Math.floor(Math.random() * 900 + 100)}`,
      section_id: newSecId,
      display_order: fields.length + i,
    }));
    setSections((prev) => [...prev, newSec]);
    setFields((prev) => [...prev, ...clonedFields]);
    setActiveSectionId(newSecId);
  };

  // Load a canonical starter or custom template
  const handleLoadTemplate = (tpl: EventTemplate) => {
    if (fields.length > 0 && !confirm(`Loading the "${tpl.name}" template will replace your current form layout. Continue?`)) {
      return;
    }
    const nextSections =
      tpl.sections_config && tpl.sections_config.length > 0
        ? tpl.sections_config
        : [{ id: "sec_default", title: "General Information", order: 0 }];
    const fallbackSecId = nextSections[0].id;
    const nextFields = (tpl.fields_config || []).map((f, idx) => ({
      ...f,
      id: f.id || `tpl_f_${Date.now()}_${idx}`,
      section_id: f.section_id || fallbackSecId,
      display_order: f.display_order ?? idx,
      enabled: f.enabled !== false,
    }));
    setSections(nextSections);
    setFields(nextFields);
    setLayoutMode(tpl.form_layout_mode || "multi_step");
    setActiveSectionId(fallbackSecId);
    setSelectedFieldId(nextFields[0]?.id || null);
    setShowTemplatesModal(false);
    setSaveSuccess(`Loaded "${tpl.name}" template!`);
  };

  // Save current form structure as a reusable custom template
  const handleSaveAsCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;
    setSavingTemplate(true);
    setErrorMessage(null);
    try {
      await eventsApi.saveCustomTemplate({
        name: tplName.trim(),
        category: tplCategory || "Workshop",
        purpose: tplPurpose.trim() || `Reusable template derived from ${event.title}`,
        description: tplDescription.trim() || `${sections.length} sections and ${fields.length} configured fields.`,
        form_layout_mode: layoutMode,
        sections_config: sections,
        fields_config: fields,
      });
      setShowSaveTemplateModal(false);
      setTplName("");
      setTplPurpose("");
      setTplDescription("");
      setSaveSuccess(`Saved custom template "${tplName.trim()}" to the Templates Library!`);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save custom template.");
    } finally {
      setSavingTemplate(false);
    }
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
      // Also update event layout mode if changed
      if (layoutMode !== event.form_layout_mode) {
        await eventsApi.updateEvent(event.id, { form_layout_mode: layoutMode });
      }

      const res = await eventsApi.saveEventForm(event.id, fields, sections);
      setSaveSuccess("Form layout and fields saved successfully!");
      if (onSaved) onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save form fields. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* TOP TOOLBAR: Actions, Template Picker, Preview Toggle, Save Draft     */}
      {/* ===================================================================== */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                title="Back to Event Details"
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
            {sections.length} Section{sections.length > 1 ? "s" : ""} • {fields.length} Field{fields.length > 1 ? "s" : ""} • Layout:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {layoutMode === "multi_step" ? "Multi-Step Wizard" : "Single-Page Form"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Templates Picker & Save Custom Template Triggers */}
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#383838] bg-slate-50 dark:bg-[#202020] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252525] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>📚 Templates Library</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTplName(`${event.title} Template`);
              setTplCategory(event.category || "Workshop");
              setShowSaveTemplateModal(true);
            }}
            disabled={fields.length === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#383838] bg-slate-50 dark:bg-[#202020] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252525] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <span>💾 Save as Template</span>
          </button>

          {/* Single-Page vs Multi-Step Mode Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#202020] p-1 border border-slate-200 dark:border-[#292929]">
            <button
              type="button"
              onClick={() => setLayoutMode("single_page")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                layoutMode === "single_page"
                  ? "bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
              title="All sections rendered on a single scrolling page"
            >
              📄 Single Page
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("multi_step")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                layoutMode === "multi_step"
                  ? "bg-white dark:bg-[#181818] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
              title="Render as step-by-step wizard with Next / Back navigation"
            >
              ➡️ Wizard Steps
            </button>
          </div>

          {/* Builder vs Preview Toggle */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#202020] p-1 border border-slate-200 dark:border-[#292929]">
            <button
              type="button"
              onClick={() => setViewMode("builder")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "builder"
                  ? "bg-white dark:bg-[#181818] text-slate-900 dark:text-[#F5F5F5] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
            >
              🛠 Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === "preview"
                  ? "bg-white dark:bg-[#181818] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
                  : "text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
            >
              👁 Preview
            </button>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveForm}
            disabled={isSaving}
            className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-4 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[36px] flex items-center gap-1.5"
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

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
          <span>✓ {saveSuccess}</span>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">×</button>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 cursor-pointer">×</button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CANONICAL TEMPLATES LIBRARY MODAL & SAVE CUSTOM TEMPLATE MODAL        */}
      {/* ===================================================================== */}
      <EventTemplatesLibraryModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelectTemplate={handleLoadTemplate}
      />

      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveAsCustomTemplate}
            className="w-full max-w-md bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-[#2d2d2d] shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#292929]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">Save Form as Reusable Template</h3>
              <button type="button" onClick={() => setShowSaveTemplateModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Category</label>
                <select
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                >
                  <option value="Workshop">Workshop</option>
                  <option value="Competition">Competition</option>
                  <option value="Exam">Exam</option>
                  <option value="Internship">Internship</option>
                  <option value="Feedback">Feedback</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Purpose / Summary</label>
                <input
                  type="text"
                  value={tplPurpose}
                  onChange={(e) => setTplPurpose(e.target.value)}
                  placeholder="When should coordinators choose this template?"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={tplDescription}
                  onChange={(e) => setTplDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-[#292929] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#333] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTemplate}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black cursor-pointer disabled:opacity-50"
              >
                {savingTemplate ? "Saving..." : "Save Template"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW: LIVE INTERACTIVE STUDENT PREVIEW MODE                           */}
      {/* ===================================================================== */}
      {viewMode === "preview" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-100 dark:bg-[#202020] p-2 rounded-xl">
            <span className="text-xs font-semibold text-slate-600 dark:text-[#A3A3A3] px-2">
              Interactive Student Preview (test conditions, ratings &amp; validation):
            </span>
            <div className="flex items-center gap-1 bg-white dark:bg-[#181818] p-1 rounded-lg border border-slate-200 dark:border-[#292929]">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  previewDevice === "desktop" ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black" : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                🖥 Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                  previewDevice === "mobile" ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black" : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                📱 Mobile
              </button>
            </div>
          </div>

          <div className={`mx-auto transition-all ${previewDevice === "mobile" ? "max-w-sm border-4 border-slate-800 rounded-3xl p-2 shadow-2xl" : "max-w-3xl"}`}>
            <DynamicStudentFormRenderer
              event={{ ...event, form_layout_mode: layoutMode }}
              form={{
                id: "preview_version",
                event_id: event.id,
                version_number: 1,
                status: "draft",
                sections_config: sections,
                fields,
                created_by: event.created_by,
                created_at: event.created_at,
              }}
              isPreviewMode={true}
            />
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* VIEW: 3-PANEL VISUAL BUILDER WORKSPACE                                */
        /* ===================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ------------------------------------------------------------------- */}
          {/* PANEL 1 (LEFT): PALETTE OF AVAILABLE FIELD TYPES                   */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-3 shadow-2xs space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                Field Palette
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                Click any field to add to the active section.
              </p>
            </div>

            {/* Search Box */}
            <input
              type="text"
              placeholder="Filter fields..."
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#121212] text-slate-800 dark:text-[#F5F5F5] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "All" },
                { id: "basic", label: "Basic" },
                { id: "choice", label: "Choice" },
                { id: "rating", label: "Rating" },
                { id: "upload", label: "Upload" },
                { id: "advanced", label: "Adv" },
                { id: "layout", label: "Layout" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPaletteCategory(c.id)}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                    paletteCategory === c.id
                      ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black"
                      : "bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Field Types List */}
            <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
              {filteredPalette.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddField(item.type)}
                  className="w-full text-left p-2 rounded-xl border border-slate-100 dark:border-[#242424] hover:border-blue-400 dark:hover:border-[#5DD62C] bg-slate-50/70 dark:bg-[#1f1f1f] hover:bg-white dark:hover:bg-[#252525] transition-all cursor-pointer flex items-center gap-2.5 group"
                >
                  <span className="w-6 h-6 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2d2d2d] flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-[#5DD62C]">
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-[#F5F5F5] truncate group-hover:text-blue-600 dark:group-hover:text-[#5DD62C]">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-[#777] truncate">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-slate-300 dark:text-[#555] group-hover:text-blue-500 dark:group-hover:text-[#5DD62C] text-xs font-bold">
                    +
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* PANEL 2 (CENTER): MULTI-SECTION FORM CANVAS                        */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                  Form Canvas & Sections
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                  Organize questions into sections and reorder.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddSection}
                className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#252525] hover:bg-slate-200 dark:hover:bg-[#303030] text-slate-800 dark:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>+ Add Section</span>
              </button>
            </div>

            {/* Sections Accordions */}
            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
              {sections.map((sec, secIdx) => {
                const secFields = fields.filter((f) => f.section_id === sec.id);
                const isActive = activeSectionId === sec.id;

                return (
                  <div
                    key={sec.id}
                    className={`rounded-2xl border transition-all ${
                      isActive
                        ? "border-blue-400 dark:border-[#5DD62C] bg-blue-50/20 dark:bg-[#5DD62C]/5"
                        : "border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#1c1c1c]"
                    } p-3.5 space-y-3`}
                  >
                    {/* Section Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => setActiveSectionId(sec.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-[#2d2d2d] text-slate-700 dark:text-slate-300">
                            #{secIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={sec.title}
                            onChange={(e) => handleUpdateSection(sec.id, { title: e.target.value })}
                            className="font-bold text-xs text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Optional section description..."
                          value={sec.description || ""}
                          onChange={(e) => handleUpdateSection(sec.id, { description: e.target.value })}
                          className="text-[11px] text-slate-400 dark:text-[#888] bg-transparent w-full mt-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-[#777] px-1.5 py-0.5 bg-white dark:bg-[#141414] rounded-md border border-slate-200 dark:border-[#2d2d2d]">
                          {secFields.length} fields
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSection(sec.id)}
                          className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer text-xs"
                          title="Duplicate section and its fields"
                        >
                          📑
                        </button>
                        {sections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(sec.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Delete section"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fields Inside This Section (Dropzone enabled) */}
                    <div
                      className="space-y-2 pt-1"
                      onDragOver={(e) => {
                        if (draggedFieldId) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (draggedFieldId) {
                          e.preventDefault();
                          handleDropToSectionEnd(sec.id);
                        }
                      }}
                    >
                      {secFields.length === 0 ? (
                        <div
                          onClick={() => setActiveSectionId(sec.id)}
                          className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-[#2d2d2d] text-center cursor-pointer hover:bg-slate-100/50 dark:hover:bg-[#202020]"
                        >
                          <p className="text-xs text-slate-400">Section is empty.</p>
                          <p className="text-[11px] text-blue-600 dark:text-[#5DD62C] font-semibold mt-0.5">
                            Click palette items on left or drag fields here
                          </p>
                        </div>
                      ) : (
                        secFields.map((f, fIdx) => {
                          const isSelected = selectedFieldId === f.id;
                          const hasConditions = f.conditions && (Array.isArray(f.conditions) ? f.conditions.length > 0 : Boolean(f.conditions.rules?.length));

                          return (
                            <div
                              key={f.id}
                              draggable
                              onDragStart={(e) => {
                                setDraggedFieldId(f.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onDragEnd={() => setDraggedFieldId(null)}
                              onDragOver={(e) => {
                                if (draggedFieldId && draggedFieldId !== f.id) e.preventDefault();
                              }}
                              onDrop={(e) => {
                                if (draggedFieldId && draggedFieldId !== f.id) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDropField(f.id, sec.id);
                                }
                              }}
                              onClick={() => {
                                setSelectedFieldId(f.id);
                                setActiveSectionId(sec.id);
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                draggedFieldId === f.id ? "opacity-40" : ""
                              } ${
                                f.enabled === false ? "opacity-60 border-dashed" : ""
                              } ${
                                isSelected
                                  ? "border-blue-500 dark:border-[#5DD62C] bg-white dark:bg-[#222] shadow-xs"
                                  : "border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#161616] hover:border-slate-300 dark:hover:border-[#383838]"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-300 dark:text-slate-600 cursor-grab select-none text-xs" title="Drag to reorder">⋮⋮</span>
                                  <span className="text-xs font-semibold text-slate-800 dark:text-[#F5F5F5] truncate">
                                    {f.label}
                                  </span>
                                  {f.required && (
                                    <span className="text-rose-500 text-xs font-bold" title="Required field">*</span>
                                  )}
                                  {f.enabled === false && (
                                    <span className="text-[9px] font-bold px-1 rounded bg-slate-200 dark:bg-[#2d2d2d] text-slate-500">DISABLED</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-[#202020] px-1 rounded">
                                    {f.field_key}
                                  </span>
                                  <span className="text-[10px] text-blue-600 dark:text-[#5DD62C] font-semibold">
                                    {f.field_type}
                                  </span>
                                  {hasConditions && (
                                    <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 px-1 rounded font-semibold">
                                      ⚡ Logic
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Card Action Buttons */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(fields.indexOf(f), "up")}
                                  disabled={fields.indexOf(f) === 0}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer text-xs"
                                  title="Move Up"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveField(fields.indexOf(f), "down")}
                                  disabled={fields.indexOf(f) === fields.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer text-xs"
                                  title="Move Down"
                                >
                                  ▼
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateField(f)}
                                  className="p-1 text-slate-400 hover:text-blue-500 cursor-pointer text-xs"
                                  title="Duplicate field"
                                >
                                  📑
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveField(f.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer text-xs"
                                  title="Delete field"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* PANEL 3 (RIGHT): FIELD SETTINGS & PROPERTIES INSPECTOR              */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                Field Properties
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                {selectedField ? `Editing "${selectedField.label}"` : "Select a field to configure settings."}
              </p>
            </div>

            {selectedField ? (
              <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                {/* Field Label */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Field Label / Question
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => handleUpdateSelectedField({ label: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                {/* Field Key & Section Assignment */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Data Key
                    </label>
                    <input
                      type="text"
                      value={selectedField.field_key}
                      onChange={(e) => handleUpdateSelectedField({ field_key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                      className="w-full text-xs font-mono px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Section
                    </label>
                    <select
                      value={selectedField.section_id || sections[0]?.id}
                      onChange={(e) => handleUpdateSelectedField({ section_id: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Placeholder & Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Placeholder Text
                  </label>
                  <input
                    type="text"
                    value={selectedField.placeholder || ""}
                    onChange={(e) => handleUpdateSelectedField({ placeholder: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Help Text / Description
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.description || ""}
                    onChange={(e) => handleUpdateSelectedField({ description: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                {/* Enabled, Required & Default Value */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b]">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-[#F5F5F5]">Required</p>
                      <p className="text-[9px] text-slate-400">Mandatory answer</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedField.required)}
                      onChange={(e) => handleUpdateSelectedField({ required: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b]">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-[#F5F5F5]">Enabled</p>
                      <p className="text-[9px] text-slate-400">Show on form</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedField.enabled !== false}
                      onChange={(e) => handleUpdateSelectedField({ enabled: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                    />
                  </div>
                </div>

                {!["file", "pdf_upload", "document_upload", "image_upload", "gallery_upload", "camera_capture", "geo_photo", "repeatable_group", "divider"].includes(selectedField.field_type) && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Default Value (Optional)
                    </label>
                    <input
                      type="text"
                      value={typeof selectedField.default_value === "string" || typeof selectedField.default_value === "number" ? String(selectedField.default_value) : ""}
                      placeholder="Pre-filled student answer or asset URL..."
                      onChange={(e) => handleUpdateSelectedField({ default_value: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                )}

                {/* VALIDATION BOUNDS (TEXT, NUMBER, UPLOADS) */}
                {["text", "textarea", "rich_text"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Character Length Rules</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">Min Length</label>
                        <input
                          type="number"
                          min={0}
                          value={selectedField.validation_config?.min_len ?? ""}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                min_len: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Max Length</label>
                        <input
                          type="number"
                          min={1}
                          value={selectedField.validation_config?.max_len ?? ""}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                max_len: e.target.value ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedField.field_type === "number" && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Numeric Value Bounds</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">Minimum Value</label>
                        <input
                          type="number"
                          step="any"
                          value={selectedField.validation_config?.min_val ?? ""}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                min_val: e.target.value !== "" ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Maximum Value</label>
                        <input
                          type="number"
                          step="any"
                          value={selectedField.validation_config?.max_val ?? ""}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                max_val: e.target.value !== "" ? Number(e.target.value) : undefined,
                              },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {["file", "pdf_upload", "document_upload", "image_upload", "gallery_upload", "camera_capture", "geo_photo"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Upload File Rules (Drive Ready)</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">Max Size (MB, ≤15)</label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={selectedField.validation_config?.max_size_mb ?? 10}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                max_size_mb: e.target.value ? Math.min(15, Number(e.target.value)) : 10,
                              },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Allowed Extensions</label>
                        <input
                          type="text"
                          value={(selectedField.validation_config?.allowed_types || []).join(", ")}
                          placeholder="pdf, jpg, png"
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                allowed_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                              },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* OPTIONS MANAGER (FOR DROPDOWN, RADIO, CHECKBOX, MULTI_SELECT) */}
                {["dropdown", "radio", "checkbox", "multi_select"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Options Choices</span>
                      <button
                        type="button"
                        onClick={() => {
                          const cur = selectedField.options_config || [];
                          const n = cur.length + 1;
                          handleUpdateSelectedField({
                            options_config: [...cur, { label: `Option ${n}`, value: `option_${n}` }],
                          });
                        }}
                        className="text-[11px] text-blue-600 dark:text-[#5DD62C] font-semibold cursor-pointer"
                      >
                        + Add Choice
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {(selectedField.options_config || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const updated = [...(selectedField.options_config || [])];
                              updated[oIdx] = { ...updated[oIdx], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") };
                              handleUpdateSelectedField({ options_config: updated });
                            }}
                            className="flex-1 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (selectedField.options_config || []).filter((_, i) => i !== oIdx);
                              handleUpdateSelectedField({ options_config: updated });
                            }}
                            className="text-slate-400 hover:text-rose-500 text-xs px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* RATING CONFIGURATIONS */}
                {["star_rating", "numeric_rating", "satisfaction_rating", "difficulty_rating", "custom_scale"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Rating Configuration</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500">Min Value</label>
                        <input
                          type="number"
                          value={selectedField.rating_config?.min_rating ?? (selectedField.field_type === "numeric_rating" ? 0 : 1)}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              rating_config: { ...selectedField.rating_config, min_rating: Number(e.target.value) },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500">Max Value / Stars</label>
                        <input
                          type="number"
                          min={2}
                          max={10}
                          value={selectedField.rating_config?.max_rating ?? (selectedField.field_type === "numeric_rating" ? 10 : 5)}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              rating_config: { ...selectedField.rating_config, max_rating: Number(e.target.value) },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500">Min Label</label>
                        <input
                          type="text"
                          value={selectedField.rating_config?.min_label || ""}
                          placeholder="e.g. Poor"
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              rating_config: { ...selectedField.rating_config, min_label: e.target.value },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500">Max Label</label>
                        <input
                          type="text"
                          value={selectedField.rating_config?.max_label || ""}
                          placeholder="e.g. Excellent"
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              rating_config: { ...selectedField.rating_config, max_label: e.target.value },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* REPEATABLE GROUP SUBFIELDS INSPECTOR */}
                {selectedField.field_type === "repeatable_group" && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Repeatable Group Settings</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500">Entity Name</label>
                        <input
                          type="text"
                          value={selectedField.repeatable_config?.entity_name || "Teammate"}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              repeatable_config: { ...(selectedField.repeatable_config || { fields: [] }), entity_name: e.target.value },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Add Button Text</label>
                        <input
                          type="text"
                          value={selectedField.repeatable_config?.add_button_text || "+ Add Entry"}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              repeatable_config: { ...(selectedField.repeatable_config || { fields: [] }), add_button_text: e.target.value },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Min Entries</label>
                        <input
                          type="number"
                          min={0}
                          value={selectedField.repeatable_config?.min_items ?? 1}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              repeatable_config: { ...(selectedField.repeatable_config || { fields: [] }), min_items: Number(e.target.value) },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500">Max Entries</label>
                        <input
                          type="number"
                          min={1}
                          value={selectedField.repeatable_config?.max_items ?? 5}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              repeatable_config: { ...(selectedField.repeatable_config || { fields: [] }), max_items: Number(e.target.value) },
                            })
                          }
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
                    </div>

                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Subfields per Entry</span>
                        <button
                          type="button"
                          onClick={() => {
                            const curRep = selectedField.repeatable_config || { entity_name: "Entry", fields: [] };
                            const nextIdx = (curRep.fields?.length || 0) + 1;
                            handleUpdateSelectedField({
                              repeatable_config: {
                                ...curRep,
                                fields: [
                                  ...(curRep.fields || []),
                                  {
                                    id: `rep_${Date.now()}_${nextIdx}`,
                                    field_key: `sub_${nextIdx}`,
                                    field_type: "text",
                                    label: `Field ${nextIdx}`,
                                    required: true,
                                    display_order: nextIdx,
                                    enabled: true,
                                  },
                                ],
                              },
                            });
                          }}
                          className="text-[11px] text-blue-600 dark:text-[#5DD62C] font-semibold cursor-pointer"
                        >
                          + Add Subfield
                        </button>
                      </div>
                      {(selectedField.repeatable_config?.fields || []).map((sf, sIdx) => (
                        <div key={sf.id || sIdx} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={sf.label}
                            onChange={(e) => {
                              const curRep = selectedField.repeatable_config || { entity_name: "Entry", fields: [] };
                              const nextFields = [...(curRep.fields || [])];
                              nextFields[sIdx] = {
                                ...sf,
                                label: e.target.value,
                                field_key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_") || sf.field_key,
                              };
                              handleUpdateSelectedField({ repeatable_config: { ...curRep, fields: nextFields } });
                            }}
                            className="flex-1 text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                          <select
                            value={sf.field_type}
                            onChange={(e) => {
                              const curRep = selectedField.repeatable_config || { entity_name: "Entry", fields: [] };
                              const nextFields = [...(curRep.fields || [])];
                              nextFields[sIdx] = { ...sf, field_type: e.target.value as any };
                              handleUpdateSelectedField({ repeatable_config: { ...curRep, fields: nextFields } });
                            }}
                            className="text-[10px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          >
                            <option value="text">text</option>
                            <option value="email">email</option>
                            <option value="number">number</option>
                            <option value="phone">phone</option>
                            <option value="dropdown">dropdown</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const curRep = selectedField.repeatable_config || { entity_name: "Entry", fields: [] };
                              const nextFields = (curRep.fields || []).filter((_, i) => i !== sIdx);
                              handleUpdateSelectedField({ repeatable_config: { ...curRep, fields: nextFields } });
                            }}
                            className="text-slate-400 hover:text-rose-500 text-xs px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CONDITIONAL LOGIC BUILDER */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Conditional Visibility</p>
                      <p className="text-[10px] text-slate-400">Show or hide based on answers</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Array.isArray(selectedField.conditions)
                          ? selectedField.conditions
                          : selectedField.conditions?.rules || [];
                        const otherFields = fields.filter((f) => f.id !== selectedField.id);
                        if (otherFields.length === 0) {
                          alert("Add other fields to form before creating conditional rules.");
                          return;
                        }
                        const newRule: ConditionalRule = {
                          field: otherFields[0].field_key,
                          operator: "equals",
                          value: "yes",
                          action: "show",
                        };
                        handleUpdateSelectedField({ conditions: [...cur, newRule] });
                      }}
                      className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold cursor-pointer"
                    >
                      + Add Rule
                    </button>
                  </div>

                  {/* Rules list */}
                  {(() => {
                    const rules: ConditionalRule[] = Array.isArray(selectedField.conditions)
                      ? selectedField.conditions
                      : selectedField.conditions?.rules || [];

                    if (rules.length === 0) {
                      return <p className="text-[11px] text-slate-400 italic">No conditional rules. Always visible.</p>;
                    }

                    return (
                      <div className="space-y-2">
                        {rules.map((rule, rIdx) => (
                          <div key={rIdx} className="p-2 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2d2d2d] text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300">Rule #{rIdx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = rules.filter((_, i) => i !== rIdx);
                                  handleUpdateSelectedField({ conditions: updated });
                                }}
                                className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Source Field Dropdown */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <div>
                                <label className="block text-[10px] text-slate-400">If Field:</label>
                                <select
                                  value={rule.field}
                                  onChange={(e) => {
                                    const updated = [...rules];
                                    updated[rIdx] = { ...updated[rIdx], field: e.target.value };
                                    handleUpdateSelectedField({ conditions: updated });
                                  }}
                                  className="w-full text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                >
                                  {fields
                                    .filter((f) => f.id !== selectedField.id)
                                    .map((f) => (
                                      <option key={f.field_key} value={f.field_key}>
                                        {f.label} ({f.field_key})
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* Operator Dropdown */}
                              <div>
                                <label className="block text-[10px] text-slate-400">Operator:</label>
                                <select
                                  value={rule.operator}
                                  onChange={(e) => {
                                    const updated = [...rules];
                                    updated[rIdx] = { ...updated[rIdx], operator: e.target.value as any };
                                    handleUpdateSelectedField({ conditions: updated });
                                  }}
                                  className="w-full text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                >
                                  <option value="equals">equals</option>
                                  <option value="not_equals">not equals</option>
                                  <option value="contains">contains</option>
                                  <option value="greater_than">greater than</option>
                                  <option value="less_than">less than</option>
                                  <option value="is_empty">is empty</option>
                                  <option value="is_not_empty">is not empty</option>
                                </select>
                              </div>
                            </div>

                            {/* Target value */}
                            {!["is_empty", "is_not_empty"].includes(rule.operator) && (
                              <div>
                                <label className="block text-[10px] text-slate-400">Value:</label>
                                <input
                                  type="text"
                                  value={rule.value || ""}
                                  placeholder="e.g. yes or option_1"
                                  onChange={(e) => {
                                    const updated = [...rules];
                                    updated[rIdx] = { ...updated[rIdx], value: e.target.value };
                                    handleUpdateSelectedField({ conditions: updated });
                                  }}
                                  className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Select a field from the center canvas to customize its parameters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
