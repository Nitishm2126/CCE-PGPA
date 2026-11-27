"use client";

import React, { useState, useMemo } from "react";
import {
  EventFormField,
  FormFieldType,
  FormFieldOption,
  EventItem,
  FormSection,
  FormSettings,
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
  initialFormSettings?: FormSettings | null;
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
  { type: "text", label: "Short Answer", category: "basic", icon: "Aa", defaultLabel: "Full Name", description: "Single-line text input" },
  { type: "textarea", label: "Paragraph", category: "basic", icon: "¶", defaultLabel: "Statement of Purpose", description: "Multi-line paragraph text" },
  { type: "number", label: "Number", category: "basic", icon: "#", defaultLabel: "Experience in Years", description: "Integer or decimal numeric input" },
  { type: "email", label: "Email", category: "basic", icon: "@", defaultLabel: "College Email", description: "Validates email address format" },
  { type: "phone", label: "Phone Number", category: "basic", icon: "📞", defaultLabel: "WhatsApp / Contact Number", description: "Telephone format validation" },
  { type: "url", label: "Website / URL", category: "basic", icon: "🔗", defaultLabel: "Portfolio or GitHub URL", description: "Validates https:// web link" },
  { type: "rich_text", label: "Rich Text Input", category: "basic", icon: "📝", defaultLabel: "Project Description", description: "Formatted detailed response" },

  // Date & Time
  { type: "date", label: "Date", category: "datetime", icon: "📅", defaultLabel: "Date of Birth", description: "Calendar date selector" },
  { type: "time", label: "Time", category: "datetime", icon: "⏰", defaultLabel: "Preferred Time Slot", description: "Time of day selector" },
  { type: "datetime", label: "Date and Time", category: "datetime", icon: "🗓", defaultLabel: "Appointment Slot", description: "Combined date and time picker" },
  { type: "date_range", label: "Date Range", category: "datetime", icon: "↔", defaultLabel: "Internship Duration", description: "Start and end date pair" },

  // Selection & Polls
  { type: "radio", label: "Multiple Choice", category: "choice", icon: "◉", defaultLabel: "Choose One Option", description: "Single choice with optional answer branching" },
  { type: "checkbox", label: "Checkboxes", category: "choice", icon: "☑", defaultLabel: "Areas of Interest", description: "Multiple choices + Other & bounds" },
  { type: "dropdown", label: "Dropdown", category: "choice", icon: "▼", defaultLabel: "Select Your Track", description: "Dropdown list with optional section jump" },
  { type: "poll", label: "Poll", category: "choice", icon: "📊", defaultLabel: "Quick Student Poll", description: "Poll question with configurable live results" },
  { type: "yes_no", label: "Yes / No", category: "choice", icon: "⚖", defaultLabel: "Did you attend?", description: "Fast Yes / No branching toggle buttons" },
  { type: "multi_select", label: "Multi-Select Tags", category: "choice", icon: "🏷", defaultLabel: "Preferred Technologies", description: "Tag pills with multi-select" },

  // Feedback & Rating
  { type: "numeric_rating", label: "Linear Scale", category: "rating", icon: "🔟", defaultLabel: "Linear Scale (1–5 / 0–10)", description: "Configurable numeric linear scale" },
  { type: "star_rating", label: "Rating", category: "rating", icon: "★", defaultLabel: "Overall Rating", description: "Interactive star evaluation" },
  { type: "satisfaction_rating", label: "Satisfaction Scale", category: "rating", icon: "😊", defaultLabel: "Overall Satisfaction", description: "Poor to Excellent scale" },
  { type: "difficulty_rating", label: "Difficulty Rating", category: "rating", icon: "⚡", defaultLabel: "Session Difficulty Level", description: "Beginner, Intermediate, Advanced" },
  { type: "custom_scale", label: "Custom Scale", category: "rating", icon: "📊", defaultLabel: "Pacing of the Workshop", description: "Custom labeled or numeric scale" },

  // Uploads
  { type: "file", label: "File Upload", category: "upload", icon: "📎", defaultLabel: "Upload File", description: "Single or multiple document files" },
  { type: "image_upload", label: "Single Image Upload", category: "upload", icon: "🖼", defaultLabel: "Upload Image / Receipt", description: "PNG, JPG, or WebP image" },
  { type: "gallery_upload", label: "Multiple Image Upload", category: "upload", icon: "🗂", defaultLabel: "Upload Multiple Images", description: "Upload multiple PNG or JPG images" },
  { type: "pdf_upload", label: "PDF Upload", category: "upload", icon: "📕", defaultLabel: "Upload Signed NOC (PDF)", description: "Strict PDF document upload" },
  { type: "document_upload", label: "Document Upload", category: "upload", icon: "📃", defaultLabel: "Upload Document (DOCX/PDF)", description: "PDF, DOC, DOCX document upload" },
  { type: "camera_capture", label: "Live Camera Snapshot", category: "upload", icon: "📷", defaultLabel: "Take Live Photo", description: "Direct camera photo capture" },

  // Geo-tagged Photo
  { type: "geo_photo", label: "Geo-tagged Photo", category: "advanced", icon: "📍", defaultLabel: "Venue Check-in Photo with GPS", description: "Photo with verified GPS coordinates" },

  // Repeatable Sections
  { type: "repeatable_group", label: "Repeatable Group", category: "advanced", icon: "👥", defaultLabel: "Team Members List", description: "Dynamic add/remove entry group" },

  // Layout Blocks & Page Break
  { type: "heading", label: "Section Heading", category: "layout", icon: "H", defaultLabel: "Participant Information", description: "Visual bold title separator" },
  { type: "description", label: "Description / Text", category: "layout", icon: "📝", defaultLabel: "Read all eligibility instructions carefully before registering.", description: "Formatted instructional text block" },
  { type: "page_break", label: "Page Break (New Section)", category: "layout", icon: "⤓", defaultLabel: "Page Break — Next Section", description: "Splits questions into a new navigable section" },
  { type: "subheading", label: "Subheading", category: "layout", icon: "h2", defaultLabel: "Academic & Contact Details", description: "Secondary section subtitle" },
  { type: "divider", label: "Horizontal Divider", category: "layout", icon: "—", defaultLabel: "Divider", description: "Visual separation line" },
  { type: "info_card", label: "Information Notice", category: "layout", icon: "ℹ", defaultLabel: "Please ensure all details match college records.", description: "Blue informative callout card" },
  { type: "notice", label: "Warning / Important Notice", category: "layout", icon: "⚠️", defaultLabel: "Late registrations will not be entertained.", description: "Amber warning highlight box" },
];

const LAYOUT_TYPES = ["heading", "subheading", "description", "rich_text_block", "divider", "page_break", "info", "info_card", "notice"];
const CHOICE_TYPES = ["dropdown", "radio", "checkbox", "multi_select", "poll"];
const BRANCHING_QUESTION_TYPES = ["radio", "yes_no", "dropdown", "poll"];
const UPLOAD_TYPES = ["file", "pdf_upload", "document_upload", "image_upload", "gallery_upload", "camera_capture", "geo_photo"];

function buildDefaultField(type: FormFieldType, sectionId: string, orderIndex: number, totalCount: number): EventFormField {
  const def = FIELD_PALETTE.find((d) => d.type === type);
  const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newKey = `f_${type}_${totalCount + 1}_${Math.random().toString(36).substring(2, 4)}`;

  const defaultOptions: FormFieldOption[] = CHOICE_TYPES.includes(type)
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
    defaultRatingConfig = { min_rating: 1, max_rating: 5, min_label: "Low", max_label: "High", scale_type: "numbers" };
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

  return {
    id: newId,
    field_key: newKey,
    field_type: type,
    label: def?.defaultLabel || "New Question",
    description: "",
    help_text: "",
    placeholder: "",
    required: !LAYOUT_TYPES.includes(type),
    display_order: orderIndex,
    enabled: true,
    section_id: sectionId,
    options_config: defaultOptions,
    rating_config: defaultRatingConfig,
    repeatable_config: defaultRepeatable,
    validation_config: UPLOAD_TYPES.includes(type)
      ? {
          allowed_types:
            type === "pdf_upload"
              ? ["pdf"]
              : type === "image_upload" || type === "gallery_upload" || type === "camera_capture" || type === "geo_photo"
              ? ["jpg", "jpeg", "png", "webp"]
              : ["pdf", "doc", "docx", "png", "jpg"],
          max_size_mb: 10,
          allow_multiple_files: type === "gallery_upload",
          max_files: type === "gallery_upload" ? 5 : 1,
        }
      : type === "number"
      ? { number_mode: "decimal" }
      : {},
  };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export const EventFormBuilder: React.FC<EventFormBuilderProps> = ({
  event,
  initialFields = [],
  initialSections = [],
  initialFormSettings = null,
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

  // Separate Form Settings state
  const [formSettings, setFormSettings] = useState<FormSettings>(() => ({
    form_title: initialFormSettings?.form_title ?? "",
    form_description: initialFormSettings?.form_description ?? "",
    custom_instructions: initialFormSettings?.custom_instructions ?? "",
    submit_button_label: initialFormSettings?.submit_button_label ?? "Submit Registration",
    success_message: initialFormSettings?.success_message ?? "",
    allow_multiple_responses: initialFormSettings?.allow_multiple_responses ?? Boolean(event.allow_multiple_responses),
    allow_edit_submission: initialFormSettings?.allow_edit_submission ?? Boolean(event.allow_edit_submission),
    allow_resubmission: initialFormSettings?.allow_resubmission ?? Boolean(event.allow_edit_submission),
    registration_capacity: initialFormSettings?.registration_capacity ?? event.registration_capacity ?? null,
    submission_deadline: initialFormSettings?.submission_deadline ?? "",
    show_progress_indicator: initialFormSettings?.show_progress_indicator !== false,
    show_section_navigation: initialFormSettings?.show_section_navigation !== false,
  }));

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || "sec_default");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id || null);
  const [layoutMode, setLayoutMode] = useState<FormLayoutMode>(event.form_layout_mode || "single_page");
  const [rightTab, setRightTab] = useState<"question" | "settings">("question");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [insertMenuFieldId, setInsertMenuFieldId] = useState<string | null>(null);
  const [editingSectionLogicId, setEditingSectionLogicId] = useState<string | null>(null);
  const [confirmScratch, setConfirmScratch] = useState<boolean>(false);

  // Filter / Search for palette
  const [paletteSearch, setPaletteSearch] = useState<string>("");
  const [paletteCategory, setPaletteCategory] = useState<string>("all");

  // Mode: builder vs live student preview
  const [viewMode, setViewMode] = useState<"builder" | "preview">("builder");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Template dropdown & custom template saving state
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<EventTemplate | null>(null);
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
      const q = paletteSearch.toLowerCase();
      const matchesSearch =
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q);
      const matchesCat = paletteCategory === "all" || item.category === paletteCategory;
      return matchesSearch && matchesCat;
    });
  }, [paletteSearch, paletteCategory]);

  // Add field to active section OR immediately after a target field ID
  // Selecting "page_break" inserts a new Page/Section cleanly (splitting after a chosen card if inserted inline!)
  const handleAddField = (type: FormFieldType, afterFieldId?: string, explicitSectionId?: string) => {
    const targetSecId = explicitSectionId || activeSectionId || sections[0]?.id || "sec_default";
    if (type === "page_break") {
      const targetIdx = sections.findIndex((s) => s.id === targetSecId);
      const insertAt = targetIdx !== -1 ? targetIdx + 1 : sections.length;
      const newSecId = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
      const newSec: FormSection = {
        id: newSecId,
        title: `Section ${sections.length + 1}`,
        description: "New page section",
        order: insertAt,
        after_section_action: "__next__",
      };
      setSections((prev) => {
        const next = [...prev];
        next.splice(insertAt, 0, newSec);
        return next.map((s, idx) => ({ ...s, order: idx }));
      });
      if (afterFieldId) {
        setFields((prev) => {
          const splitIdx = prev.findIndex((f) => f.id === afterFieldId);
          if (splitIdx === -1) return prev;
          return prev.map((f, idx) =>
            idx > splitIdx && (f.section_id || sections[0]?.id) === targetSecId
              ? { ...f, section_id: newSecId }
              : f
          );
        });
      }
      setActiveSectionId(newSecId);
      setInsertMenuFieldId(null);
      setLayoutMode("multi_step");
      setSaveSuccess("Added new page break / section and switched preview layout to section navigation.");
      return;
    }

    const newField = buildDefaultField(type, targetSecId, fields.length, fields.length);

    setFields((prev) => {
      const next = [...prev];
      if (afterFieldId) {
        const idx = next.findIndex((f) => f.id === afterFieldId);
        if (idx !== -1) {
          newField.section_id = next[idx].section_id || targetSecId;
          next.splice(idx + 1, 0, newField);
          return next.map((f, i) => ({ ...f, display_order: i }));
        }
      }
      // Insert after last field in targetSecId so section order remains contiguous
      let lastIdxInSec = -1;
      for (let i = next.length - 1; i >= 0; i--) {
        if ((next[i].section_id || sections[0]?.id) === targetSecId) {
          lastIdxInSec = i;
          break;
        }
      }
      if (lastIdxInSec !== -1) {
        next.splice(lastIdxInSec + 1, 0, newField);
      } else {
        next.push(newField);
      }
      return next.map((f, i) => ({ ...f, display_order: i }));
    });
    setSelectedFieldId(newField.id);
    setRightTab("question");
    setInsertMenuFieldId(null);
    setCollapsedSections((prev) => ({ ...prev, [targetSecId]: false }));
  };

  // Duplicate an existing field right after the original
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
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === fieldToDuplicate.id);
      const next = [...prev];
      if (idx !== -1) {
        next.splice(idx + 1, 0, duplicate);
      } else {
        next.push(duplicate);
      }
      return next.map((f, i) => ({ ...f, display_order: i }));
    });
    setSelectedFieldId(newId);
    setRightTab("question");
  };

  // Remove field
  const handleRemoveField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, display_order: i }));
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
      return copy.map((f, idx) => ({ ...f, display_order: idx }));
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

  // Change selected field type cleanly while preserving label/required/order
  const handleChangeSelectedFieldType = (nextType: FormFieldType) => {
    if (!selectedField) return;
    const blueprint = buildDefaultField(nextType, selectedField.section_id || activeSectionId, selectedField.display_order, fields.length);
    const patch: Partial<EventFormField> = {
      field_type: nextType,
    };
    if (CHOICE_TYPES.includes(nextType) && (!selectedField.options_config || selectedField.options_config.length === 0)) {
      patch.options_config = blueprint.options_config;
    }
    if (["star_rating", "numeric_rating", "satisfaction_rating", "difficulty_rating", "custom_scale"].includes(nextType)) {
      patch.rating_config = blueprint.rating_config;
    }
    if (nextType === "repeatable_group" && !selectedField.repeatable_config) {
      patch.repeatable_config = blueprint.repeatable_config;
    }
    if (UPLOAD_TYPES.includes(nextType)) {
      patch.validation_config = {
        ...(selectedField.validation_config || {}),
        ...(blueprint.validation_config || {}),
      };
    }
    if (LAYOUT_TYPES.includes(nextType)) {
      patch.required = false;
    }
    handleUpdateSelectedField(patch);
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

  const handleMoveSection = (secId: string, direction: "up" | "down") => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === secId);
      if (idx === -1) return prev;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy.map((s, i) => ({ ...s, order: i }));
    });
  };

  // Detect invalid destination IDs or circular navigation loops across sections & answer branches
  const navigationWarnings = useMemo(() => {
    const warnings: string[] = [];
    const validIds = new Set(sections.map((s) => s.id));
    const edges = new Map<string, Set<string>>();
    sections.forEach((s) => edges.set(s.id, new Set()));

    sections.forEach((sec, idx) => {
      const addEdge = (target: string | undefined, label: string) => {
        if (!target || target === "__submit__") return;
        if (target === "__next__") {
          if (idx + 1 < sections.length) edges.get(sec.id)?.add(sections[idx + 1].id);
          return;
        }
        if (!validIds.has(target)) {
          warnings.push(`"${sec.title}" (${label}) points to a deleted section.`);
          return;
        }
        if (target === sec.id) {
          warnings.push(`"${sec.title}" (${label}) loops back to itself.`);
          return;
        }
        edges.get(sec.id)?.add(target);
      };

      addEdge(sec.after_section_action, "After section");
      fields
        .filter((f) => (f.section_id || sections[0]?.id) === sec.id && f.validation_config?.go_to_section_on_answer)
        .forEach((f) => {
          const routes = f.validation_config?.option_routes || {};
          Object.entries(routes).forEach(([optVal, target]) => {
            addEdge(target, `"${f.label}" = ${optVal}`);
          });
        });
    });

    // DFS cycle check across branching section graph
    const state = new Map<string, number>(); // 0 unvisited, 1 visiting, 2 visited
    const hasCycle = (node: string): boolean => {
      state.set(node, 1);
      for (const nxt of edges.get(node) || []) {
        if (state.get(nxt) === 1) return true;
        if (!state.get(nxt) && hasCycle(nxt)) return true;
      }
      state.set(node, 2);
      return false;
    };
    for (const s of sections) {
      if (!state.get(s.id) && hasCycle(s.id)) {
        warnings.push("Circular navigation detected between sections. Please ensure branches move forward cleanly or end with 'Submit form'.");
        break;
      }
    }
    return warnings;
  }, [sections, fields]);

  const handleRemoveSection = (secId: string) => {
    if (sections.length <= 1) {
      setErrorMessage("A form must have at least one section.");
      return;
    }
    // Re-assign fields belonging to this section to the first available section
    const remaining = sections.filter((s) => s.id !== secId).map((s, idx) => ({ ...s, order: idx }));
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
      ...JSON.parse(JSON.stringify(srcSec)),
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

  // Apply template immediately or ask via inline confirmation when form already has questions
  const applyTemplateNow = (tpl: EventTemplate) => {
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
    setPendingTemplate(null);
    setSaveSuccess(`Loaded "${tpl.name}" template. Review and click Save Form Changes when ready.`);
  };

  const handleLoadTemplate = (tpl: EventTemplate) => {
    if (fields.length > 0) {
      setShowTemplatesModal(false);
      setPendingTemplate(tpl);
      return;
    }
    applyTemplateNow(tpl);
  };

  const handleResetScratch = () => {
    const blankSecId = `sec_${Date.now()}`;
    const firstQ = buildDefaultField("text", blankSecId, 0, 0);
    firstQ.label = "Untitled Question";
    firstQ.field_key = "untitled_question_1";
    setSections([{ id: blankSecId, title: "Section 1", description: "", order: 0 }]);
    setFields([firstQ]);
    setActiveSectionId(blankSecId);
    setSelectedFieldId(firstQ.id);
    setRightTab("question");
    setConfirmScratch(false);
    setSaveSuccess("Started a fresh blank form from scratch.");
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
    if (navigationWarnings.length > 0) {
      setErrorMessage(navigationWarnings[0]);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);

    try {
      // Automatically use multi_step when branching or multiple sections are configured
      const hasBranching =
        sections.some((s) => Boolean(s.after_section_action && s.after_section_action !== "__next__") || Boolean(s.navigation_rules?.length)) ||
        fields.some((f) => Boolean(f.validation_config?.go_to_section_on_answer));
      const effectiveLayout: FormLayoutMode = hasBranching && sections.length > 1 ? "multi_step" : layoutMode;

      // Also update event layout mode if changed
      if (effectiveLayout !== event.form_layout_mode) {
        await eventsApi.updateEvent(event.id, { form_layout_mode: effectiveLayout });
        setLayoutMode(effectiveLayout);
      }

      const normalizedFields = fields.map((f, idx) => ({
        ...f,
        display_order: idx,
        validation_config: {
          ...(f.validation_config || {}),
          ...(f.help_text !== undefined ? { help_text: f.help_text } : {}),
        },
      }));

      await eventsApi.saveEventForm(event.id, normalizedFields, sections, formSettings);
      setSaveSuccess("Form fields, sections, branching rules, and settings saved successfully!");
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
            {sections.length} Section{sections.length > 1 ? "s" : ""} • {fields.length} Question{fields.length !== 1 ? "s" : ""} • Layout:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {layoutMode === "multi_step" ? "Multi-Step Wizard" : "Single-Page Form"}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Templates Picker, Scratch Reset & Save Custom Template Triggers */}
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#383838] bg-slate-50 dark:bg-[#202020] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252525] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>📚 Templates</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmScratch(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#383838] bg-slate-50 dark:bg-[#202020] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252525] transition-all flex items-center gap-1.5 cursor-pointer"
            title="Clear current canvas and start from a blank form"
          >
            <span>✨ Blank / Scratch</span>
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
            <span>💾 Save Template</span>
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

      {/* Inline Confirmations & Status Banners */}
      {pendingTemplate && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            Replace current questions with the <strong>&ldquo;{pendingTemplate.name}&rdquo;</strong> template? (Nothing is published until you save.)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingTemplate(null)}
              className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#1a1a1a] text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => applyTemplateNow(pendingTemplate)}
              className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer"
            >
              Load Template
            </button>
          </div>
        </div>
      )}

      {confirmScratch && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            Start a blank form from scratch? Your current unsaved questions in the editor will be cleared.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmScratch(false)}
              className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#1a1a1a] text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResetScratch}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
            >
              Reset to Blank
            </button>
          </div>
        </div>
      )}

      {navigationWarnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-bold">⚠️ Branching Navigation Warning</p>
          {navigationWarnings.map((w, idx) => (
            <p key={idx}>• {w}</p>
          ))}
        </div>
      )}

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
                form_settings: formSettings,
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
        /* VIEW: 3-PANEL GOOGLE FORMS-STYLE VISUAL BUILDER WORKSPACE             */
        /* ===================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ------------------------------------------------------------------- */}
          {/* PANEL 1 (LEFT): QUESTION LIBRARY                                   */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-3 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-3 shadow-2xs space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                Question Library
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                Click any question or block to add to active section.
              </p>
            </div>

            {/* Search Box */}
            <input
              type="text"
              placeholder="Search questions..."
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
                { id: "datetime", label: "Date/Time" },
                { id: "rating", label: "Scale" },
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
          {/* PANEL 2 (CENTER): GOOGLE FORMS-STYLE FORM CANVAS & SECTIONS         */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5] uppercase tracking-wider">
                  Form Canvas & Sections
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-[#888] mt-0.5">
                  Edit inline, insert questions, or configure section branching.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddField("page_break")}
                  className="px-2.5 py-1 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#202020] hover:bg-slate-100 dark:hover:bg-[#2a2a2a] text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                  title="Insert a Page Break / New Section"
                >
                  ⤓ + Page Break
                </button>
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-2.5 py-1 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#252525] hover:bg-slate-200 dark:hover:bg-[#303030] text-slate-800 dark:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Add Section</span>
                </button>
              </div>
            </div>

            {/* Google Forms-Style Editable Form Title & Description Header Card */}
            <div className="rounded-2xl border-t-4 border-t-blue-600 dark:border-t-[#5DD62C] border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/60 dark:bg-[#141414] p-3.5 space-y-1.5">
              <input
                type="text"
                value={formSettings.form_title ?? ""}
                placeholder={event.title}
                onChange={(e) => setFormSettings((s) => ({ ...s, form_title: e.target.value }))}
                className="w-full text-sm font-bold text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 dark:focus:border-[#5DD62C] focus:outline-hidden pb-0.5"
              />
              <input
                type="text"
                value={formSettings.form_description ?? ""}
                placeholder={event.short_description || "Form description shown to students..."}
                onChange={(e) => setFormSettings((s) => ({ ...s, form_description: e.target.value }))}
                className="w-full text-xs text-slate-500 dark:text-[#A3A3A3] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 dark:focus:border-[#5DD62C] focus:outline-hidden pb-0.5"
              />
            </div>

            {/* Sections Accordions */}
            <div className="space-y-4 max-h-[680px] overflow-y-auto pr-1">
              {sections.map((sec, secIdx) => {
                const secFields = fields.filter((f) => f.section_id === sec.id);
                const isActive = activeSectionId === sec.id;
                const isCollapsed = Boolean(collapsedSections[sec.id]);
                const secRules: ConditionalRule[] = Array.isArray(sec.conditions)
                  ? sec.conditions
                  : sec.conditions?.rules || [];
                const secLogic: "and" | "or" = !Array.isArray(sec.conditions) && sec.conditions?.logic === "or" ? "or" : "and";

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
                        className="flex-1 cursor-pointer min-w-0"
                        onClick={() => setActiveSectionId(sec.id)}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollapsedSections((prev) => ({ ...prev, [sec.id]: !isCollapsed }));
                            }}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-[#2d2d2d] text-slate-500 text-xs cursor-pointer"
                            title={isCollapsed ? "Expand section" : "Collapse section"}
                          >
                            {isCollapsed ? "▸" : "▾"}
                          </button>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-[#2d2d2d] text-slate-700 dark:text-slate-300 shrink-0">
                            Section {secIdx + 1} of {sections.length}
                          </span>
                          <input
                            type="text"
                            value={sec.title}
                            onChange={(e) => handleUpdateSection(sec.id, { title: e.target.value })}
                            className="flex-1 min-w-0 font-bold text-xs text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>
                        {!isCollapsed && (
                          <input
                            type="text"
                            placeholder="Optional section description..."
                            value={sec.description || ""}
                            onChange={(e) => handleUpdateSection(sec.id, { description: e.target.value })}
                            className="text-[11px] text-slate-400 dark:text-[#888] bg-transparent w-full mt-1 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden"
                          />
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-[#777] px-1.5 py-0.5 bg-white dark:bg-[#141414] rounded-md border border-slate-200 dark:border-[#2d2d2d] mr-0.5">
                          {secFields.length}
                        </span>
                        <button
                          type="button"
                          disabled={secIdx === 0}
                          onClick={() => handleMoveSection(sec.id, "up")}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer text-xs"
                          title="Move section up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={secIdx === sections.length - 1}
                          onClick={() => handleMoveSection(sec.id, "down")}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 cursor-pointer text-xs"
                          title="Move section down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSectionLogicId(editingSectionLogicId === sec.id ? null : sec.id)}
                          className={`p-1 rounded text-xs cursor-pointer ${
                            secRules.length > 0
                              ? "text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/50"
                              : "text-slate-400 hover:text-purple-500"
                          }`}
                          title="Section Conditional Skip / Visibility Logic"
                        >
                          ⚡
                        </button>
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

                    {/* Inline Section Conditional Logic Panel */}
                    {editingSectionLogicId === sec.id && (
                      <div className="p-2.5 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-purple-800 dark:text-purple-200">
                            Section Skip / Visibility Rules
                          </span>
                          <div className="flex items-center gap-2">
                            {secRules.length > 1 && (
                              <select
                                value={secLogic}
                                onChange={(e) =>
                                  handleUpdateSection(sec.id, {
                                    conditions: { logic: e.target.value as "and" | "or", rules: secRules },
                                  })
                                }
                                className="text-[10px] px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800 bg-white dark:bg-[#141414]"
                              >
                                <option value="and">Match ALL (AND)</option>
                                <option value="or">Match ANY (OR)</option>
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const candidates = fields.filter((f) => f.section_id !== sec.id);
                                const source = candidates[0] || fields[0];
                                if (!source) {
                                  setErrorMessage("Add at least one question before configuring section logic.");
                                  return;
                                }
                                const nextRule: ConditionalRule = {
                                  field: source.field_key,
                                  operator: "equals",
                                  value: "yes",
                                  action: "show",
                                };
                                handleUpdateSection(sec.id, {
                                  conditions: { logic: secLogic, rules: [...secRules, nextRule] },
                                });
                              }}
                              className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 cursor-pointer"
                            >
                              + Add Rule
                            </button>
                          </div>
                        </div>

                        {secRules.length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic">No rules set. This section is always shown.</p>
                        ) : (
                          secRules.map((rule, rIdx) => (
                            <div key={rIdx} className="p-2 rounded-lg bg-white dark:bg-[#141414] border border-purple-200/70 dark:border-[#2d2d2d] space-y-1.5">
                              <div className="grid grid-cols-3 gap-1.5">
                                <select
                                  value={rule.action || "show"}
                                  onChange={(e) => {
                                    const updated = [...secRules];
                                    updated[rIdx] = { ...updated[rIdx], action: e.target.value as any };
                                    handleUpdateSection(sec.id, { conditions: { logic: secLogic, rules: updated } });
                                  }}
                                  className="text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                >
                                  <option value="show">Show Section If</option>
                                  <option value="skip">Skip Section If</option>
                                </select>
                                <select
                                  value={rule.field}
                                  onChange={(e) => {
                                    const updated = [...secRules];
                                    updated[rIdx] = { ...updated[rIdx], field: e.target.value };
                                    handleUpdateSection(sec.id, { conditions: { logic: secLogic, rules: updated } });
                                  }}
                                  className="text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                >
                                  {fields.map((f) => (
                                    <option key={f.field_key} value={f.field_key}>{f.label}</option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-1">
                                  <select
                                    value={rule.operator}
                                    onChange={(e) => {
                                      const updated = [...secRules];
                                      updated[rIdx] = { ...updated[rIdx], operator: e.target.value as any };
                                      handleUpdateSection(sec.id, { conditions: { logic: secLogic, rules: updated } });
                                    }}
                                    className="flex-1 text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                  >
                                    <option value="equals">equals</option>
                                    <option value="not_equals">not equals</option>
                                    <option value="contains">contains</option>
                                    <option value="is_empty">is empty</option>
                                    <option value="is_not_empty">not empty</option>
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = secRules.filter((_, i) => i !== rIdx);
                                      handleUpdateSection(sec.id, {
                                        conditions: updated.length ? { logic: secLogic, rules: updated } : undefined,
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-500 px-1 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                              {!["is_empty", "is_not_empty"].includes(rule.operator) && (
                                <input
                                  type="text"
                                  value={rule.value || ""}
                                  placeholder="Target answer value (e.g. yes, no, online)"
                                  onChange={(e) => {
                                    const updated = [...secRules];
                                    updated[rIdx] = { ...updated[rIdx], value: e.target.value };
                                    handleUpdateSection(sec.id, { conditions: { logic: secLogic, rules: updated } });
                                  }}
                                  className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Fields Inside This Section (Dropzone enabled) */}
                    {!isCollapsed && (
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
                              Click questions on the left or drag fields here
                            </p>
                          </div>
                        ) : (
                          secFields.map((f) => {
                            const isSelected = selectedFieldId === f.id;
                            const hasConditions = f.conditions && (Array.isArray(f.conditions) ? f.conditions.length > 0 : Boolean(f.conditions.rules?.length));

                            return (
                              <div key={f.id} className="space-y-1.5">
                                <div
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
                                    setRightTab("question");
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
                                        <span className="text-[9px] font-bold px-1 rounded bg-slate-200 dark:bg-[#2d2d2d] text-slate-500">HIDDEN</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-[#202020] px-1 rounded">
                                        {f.field_key}
                                      </span>
                                      <span className="text-[10px] text-blue-600 dark:text-[#5DD62C] font-semibold">
                                        {FIELD_PALETTE.find((p) => p.type === f.field_type)?.label || f.field_type}
                                      </span>
                                      {hasConditions && (
                                        <span className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 px-1 rounded font-semibold">
                                          ⚡ Logic
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Card Action Buttons */}
                                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      onClick={() => setInsertMenuFieldId(insertMenuFieldId === f.id ? null : f.id)}
                                      className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-[#5DD62C] cursor-pointer text-xs font-bold"
                                      title="Insert question right below this"
                                    >
                                      ＋
                                    </button>
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

                                {/* Quick Insert Bar Between Questions */}
                                {insertMenuFieldId === f.id && (
                                  <div className="p-2 rounded-xl border border-dashed border-blue-300 dark:border-[#5DD62C]/60 bg-blue-50/40 dark:bg-[#5DD62C]/5 flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 mr-1">Insert below:</span>
                                    {[
                                      { type: "text" as FormFieldType, label: "+ Short Answer" },
                                      { type: "textarea" as FormFieldType, label: "+ Paragraph" },
                                      { type: "radio" as FormFieldType, label: "+ Multiple Choice" },
                                      { type: "checkbox" as FormFieldType, label: "+ Checkboxes" },
                                      { type: "dropdown" as FormFieldType, label: "+ Dropdown" },
                                      { type: "poll" as FormFieldType, label: "+ Poll" },
                                      { type: "yes_no" as FormFieldType, label: "+ Yes/No" },
                                      { type: "file" as FormFieldType, label: "+ File Upload" },
                                      { type: "page_break" as FormFieldType, label: "⤓ + Page Break" },
                                    ].map((q) => (
                                      <button
                                        key={q.type}
                                        type="button"
                                        onClick={() => handleAddField(q.type, f.id, sec.id)}
                                        className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#333] hover:border-blue-500 text-[10px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                                      >
                                        {q.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {/* Google Forms Section Footer Navigation Rule */}
                        {sections.length > 1 && (
                          <div className="pt-2 mt-2 border-t border-slate-200/70 dark:border-[#2d2d2d] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">
                              After section {secIdx + 1}:
                            </span>
                            <select
                              value={sec.after_section_action || "__next__"}
                              onChange={(e) => handleUpdateSection(sec.id, { after_section_action: e.target.value })}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#141414] text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              <option value="__next__">Continue to next section</option>
                              {sections.map((targetSec, tIdx) => (
                                <option key={targetSec.id} value={targetSec.id} disabled={targetSec.id === sec.id}>
                                  Go to Section {tIdx + 1} ({targetSec.title})
                                </option>
                              ))}
                              <option value="__submit__">Submit form</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* PANEL 3 (RIGHT): QUESTION SETTINGS & FORM SETTINGS INSPECTOR        */}
          {/* ------------------------------------------------------------------- */}
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 shadow-2xs space-y-4">
            {/* Inspector Tab Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#202020] border border-slate-200 dark:border-[#292929]">
              <button
                type="button"
                onClick={() => setRightTab("question")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  rightTab === "question"
                    ? "bg-white dark:bg-[#181818] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
                    : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                Question Settings
              </button>
              <button
                type="button"
                onClick={() => setRightTab("settings")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  rightTab === "settings"
                    ? "bg-white dark:bg-[#181818] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
                    : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                ⚙ Form Settings
              </button>
            </div>

            {rightTab === "settings" ? (
              <div className="space-y-3.5 max-h-[670px] overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Form Title Override (Optional)
                  </label>
                  <input
                    type="text"
                    value={formSettings.form_title || ""}
                    placeholder={event.title}
                    onChange={(e) => setFormSettings((s) => ({ ...s, form_title: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Form Description
                  </label>
                  <textarea
                    rows={2}
                    value={formSettings.form_description || ""}
                    placeholder="Brief overview shown at the top of the student registration form..."
                    onChange={(e) => setFormSettings((s) => ({ ...s, form_description: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Custom Form Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={formSettings.custom_instructions || ""}
                    placeholder="Special instructions or guidelines shown above form fields..."
                    onChange={(e) => setFormSettings((s) => ({ ...s, custom_instructions: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Submit Button Label
                    </label>
                    <input
                      type="text"
                      value={formSettings.submit_button_label || ""}
                      placeholder="Submit Registration"
                      onChange={(e) => setFormSettings((s) => ({ ...s, submit_button_label: e.target.value }))}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Registration Capacity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formSettings.registration_capacity ?? ""}
                      placeholder="Unlimited"
                      onChange={(e) =>
                        setFormSettings((s) => ({
                          ...s,
                          registration_capacity: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Custom Submission Success Message
                  </label>
                  <textarea
                    rows={2}
                    value={formSettings.success_message || ""}
                    placeholder="Thank you! Your registration has been recorded successfully."
                    onChange={(e) => setFormSettings((s) => ({ ...s, success_message: e.target.value }))}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Form Submission Deadline Override
                  </label>
                  <input
                    type="datetime-local"
                    value={formSettings.submission_deadline ? String(formSettings.submission_deadline).slice(0, 16) : ""}
                    onChange={(e) =>
                      setFormSettings((s) => ({
                        ...s,
                        submission_deadline: e.target.value ? new Date(e.target.value).toISOString() : null,
                      }))
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Response &amp; Navigation Rules</p>
                  {[
                    {
                      key: "allow_multiple_responses" as const,
                      title: "Allow Multiple Responses",
                      desc: "If off, students submit once unless editing is allowed",
                      checked: Boolean(formSettings.allow_multiple_responses),
                    },
                    {
                      key: "allow_edit_submission" as const,
                      title: "Allow Editing After Submission",
                      desc: "Students can update their submitted form answers",
                      checked: Boolean(formSettings.allow_edit_submission),
                    },
                    {
                      key: "allow_resubmission" as const,
                      title: "Allow Resubmission",
                      desc: "Allow students to submit a revised response",
                      checked: Boolean(formSettings.allow_resubmission),
                    },
                    {
                      key: "show_progress_indicator" as const,
                      title: "Show Progress Indicator",
                      desc: "Display step progress bar on multi-step forms",
                      checked: formSettings.show_progress_indicator !== false,
                    },
                    {
                      key: "show_section_navigation" as const,
                      title: "Show Section Navigation",
                      desc: "Display clickable section step pills & Back/Next buttons",
                      checked: formSettings.show_section_navigation !== false,
                    },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between gap-2 cursor-pointer">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-800 dark:text-[#F5F5F5]">{item.title}</p>
                        <p className="text-[10px] text-slate-400">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => setFormSettings((s) => ({ ...s, [item.key]: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : selectedField ? (
              <div className="space-y-4 max-h-[670px] overflow-y-auto pr-1">
                {/* Question Type & Section */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Question Type
                    </label>
                    <select
                      value={selectedField.field_type}
                      onChange={(e) => handleChangeSelectedFieldType(e.target.value as FormFieldType)}
                      className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    >
                      {FIELD_PALETTE.map((p) => (
                        <option key={p.type} value={p.type}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Section
                    </label>
                    <select
                      value={selectedField.section_id || sections[0]?.id}
                      onChange={(e) => handleUpdateSelectedField({ section_id: e.target.value })}
                      className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Question Title & Data Key */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Question Title
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => handleUpdateSelectedField({ label: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Data Key (Submission Identifier)
                  </label>
                  <input
                    type="text"
                    value={selectedField.field_key}
                    onChange={(e) => handleUpdateSelectedField({ field_key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                    className="w-full text-xs font-mono px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                {/* Description, Help Text & Placeholder */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Question Description
                  </label>
                  <textarea
                    rows={2}
                    value={selectedField.description || ""}
                    placeholder="Additional context shown below the question title..."
                    onChange={(e) => handleUpdateSelectedField({ description: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Help Text Hint
                    </label>
                    <input
                      type="text"
                      value={selectedField.help_text ?? selectedField.validation_config?.help_text ?? ""}
                      placeholder="Short tip below input"
                      onChange={(e) =>
                        handleUpdateSelectedField({
                          help_text: e.target.value,
                          validation_config: {
                            ...(selectedField.validation_config || {}),
                            help_text: e.target.value,
                          },
                        })
                      }
                      className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Placeholder
                    </label>
                    <input
                      type="text"
                      value={selectedField.placeholder || ""}
                      onChange={(e) => handleUpdateSelectedField({ placeholder: e.target.value })}
                      className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                    />
                  </div>
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
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-[#F5F5F5]">Visible</p>
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

                {!UPLOAD_TYPES.includes(selectedField.field_type) && !LAYOUT_TYPES.includes(selectedField.field_type) && selectedField.field_type !== "repeatable_group" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Default Value / Pre-selected Option
                    </label>
                    {["dropdown", "radio"].includes(selectedField.field_type) ? (
                      <select
                        value={typeof selectedField.default_value === "string" ? selectedField.default_value : ""}
                        onChange={(e) => handleUpdateSelectedField({ default_value: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                      >
                        <option value="">-- None --</option>
                        {(selectedField.options_config || []).map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={typeof selectedField.default_value === "string" || typeof selectedField.default_value === "number" ? String(selectedField.default_value) : ""}
                        placeholder="Optional default answer..."
                        onChange={(e) => handleUpdateSelectedField({ default_value: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-900 dark:text-[#F5F5F5]"
                      />
                    )}
                  </div>
                )}

                {/* TEXT / PARAGRAPH VALIDATION RULES */}
                {["text", "textarea", "rich_text"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Text &amp; Regex Validation</span>
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
                    <div>
                      <label className="block text-[10px] text-slate-500">Regex Pattern (Optional)</label>
                      <input
                        type="text"
                        value={selectedField.validation_config?.regex_pattern || ""}
                        placeholder="e.g. ^[A-Z]{2}[0-9]{4}$"
                        onChange={(e) =>
                          handleUpdateSelectedField({
                            validation_config: {
                              ...(selectedField.validation_config || {}),
                              regex_pattern: e.target.value || undefined,
                            },
                          })
                        }
                        className="w-full text-xs font-mono px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Custom Error Message</label>
                      <input
                        type="text"
                        value={selectedField.validation_config?.custom_error || ""}
                        placeholder="Shown if answer fails validation"
                        onChange={(e) =>
                          handleUpdateSelectedField({
                            validation_config: {
                              ...(selectedField.validation_config || {}),
                              custom_error: e.target.value || undefined,
                            },
                          })
                        }
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                      />
                    </div>
                  </div>
                )}

                {/* EMAIL / PHONE / URL CUSTOM VALIDATION */}
                {["email", "phone", "url"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Format Validation</span>
                    <p className="text-[10px] text-slate-500">
                      Automatic {selectedField.field_type.toUpperCase()} format check is active.
                    </p>
                    <div>
                      <label className="block text-[10px] text-slate-500">Custom Error Message (Optional)</label>
                      <input
                        type="text"
                        value={selectedField.validation_config?.custom_error || ""}
                        placeholder={`Please enter a valid ${selectedField.field_type}`}
                        onChange={(e) =>
                          handleUpdateSelectedField({
                            validation_config: {
                              ...(selectedField.validation_config || {}),
                              custom_error: e.target.value || undefined,
                            },
                          })
                        }
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                      />
                    </div>
                  </div>
                )}

                {/* NUMBER VALIDATION */}
                {selectedField.field_type === "number" && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Numeric Rules</span>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Number Format</label>
                      <select
                        value={selectedField.validation_config?.number_mode || "decimal"}
                        onChange={(e) =>
                          handleUpdateSelectedField({
                            validation_config: {
                              ...(selectedField.validation_config || {}),
                              number_mode: e.target.value as "integer" | "decimal",
                            },
                          })
                        }
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                      >
                        <option value="decimal">Decimal or Integer</option>
                        <option value="integer">Integer Only (Whole Numbers)</option>
                      </select>
                    </div>
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
                    <div>
                      <label className="block text-[10px] text-slate-500">Custom Error Message</label>
                      <input
                        type="text"
                        value={selectedField.validation_config?.custom_error || ""}
                        placeholder="Optional custom numeric error message"
                        onChange={(e) =>
                          handleUpdateSelectedField({
                            validation_config: {
                              ...(selectedField.validation_config || {}),
                              custom_error: e.target.value || undefined,
                            },
                          })
                        }
                        className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                      />
                    </div>
                  </div>
                )}

                {/* DATE & TIME RULES */}
                {["date", "datetime", "time"].includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Date / Time Bounds</span>
                    {selectedField.field_type !== "time" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500">Min Date</label>
                          <input
                            type="date"
                            value={selectedField.validation_config?.min_date || ""}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  min_date: e.target.value || undefined,
                                },
                              })
                            }
                            className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500">Max Date</label>
                          <input
                            type="date"
                            value={selectedField.validation_config?.max_date || ""}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  max_date: e.target.value || undefined,
                                },
                              })
                            }
                            className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-500">Earliest Time</label>
                          <input
                            type="time"
                            value={selectedField.validation_config?.min_time || ""}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  min_time: e.target.value || undefined,
                                },
                              })
                            }
                            className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500">Latest Time</label>
                          <input
                            type="time"
                            value={selectedField.validation_config?.max_time || ""}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  max_time: e.target.value || undefined,
                                },
                              })
                            }
                            className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* FILE UPLOAD RULES */}
                {UPLOAD_TYPES.includes(selectedField.field_type) && (
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
                        <label className="block text-[10px] text-slate-500">Max Files</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={selectedField.validation_config?.max_files ?? (selectedField.field_type === "gallery_upload" ? 5 : 1)}
                          onChange={(e) => {
                            const maxF = e.target.value ? Math.max(1, Math.min(10, Number(e.target.value))) : 1;
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                max_files: maxF,
                                allow_multiple_files: maxF > 1 || Boolean(selectedField.validation_config?.allow_multiple_files),
                              },
                            });
                          }}
                          className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                        />
                      </div>
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
                    {selectedField.field_type !== "geo_photo" && selectedField.field_type !== "camera_capture" && (
                      <label className="flex items-center justify-between pt-1 cursor-pointer">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Allow Multiple Files</span>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedField.validation_config?.allow_multiple_files) || selectedField.field_type === "gallery_upload"}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                allow_multiple_files: e.target.checked,
                                max_files: e.target.checked ? Math.max(2, selectedField.validation_config?.max_files || 5) : 1,
                              },
                            })
                          }
                          className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* OPTIONS MANAGER (DROPDOWN, RADIO, CHECKBOX, MULTI_SELECT) */}
                {CHOICE_TYPES.includes(selectedField.field_type) && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1b1b1b] space-y-2.5">
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

                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {(selectedField.options_config || []).map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={oIdx === 0}
                            onClick={() => {
                              const cur = [...(selectedField.options_config || [])];
                              [cur[oIdx - 1], cur[oIdx]] = [cur[oIdx], cur[oIdx - 1]];
                              handleUpdateSelectedField({ options_config: cur });
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-25 px-1 cursor-pointer"
                            title="Move option up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={oIdx === (selectedField.options_config || []).length - 1}
                            onClick={() => {
                              const cur = [...(selectedField.options_config || [])];
                              [cur[oIdx + 1], cur[oIdx]] = [cur[oIdx], cur[oIdx + 1]];
                              handleUpdateSelectedField({ options_config: cur });
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-25 px-1 cursor-pointer"
                            title="Move option down"
                          >
                            ↓
                          </button>
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

                    {["radio", "checkbox", "multi_select", "poll"].includes(selectedField.field_type) && (
                      <label className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-[#2d2d2d] cursor-pointer">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Add &ldquo;Other&rdquo; option (custom text)</span>
                        <input
                          type="checkbox"
                          checked={Boolean(selectedField.validation_config?.allow_other)}
                          onChange={(e) =>
                            handleUpdateSelectedField({
                              validation_config: {
                                ...(selectedField.validation_config || {}),
                                allow_other: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                        />
                      </label>
                    )}

                    {selectedField.field_type === "poll" && (
                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#2d2d2d]">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-[#F5F5F5] block">Poll Settings</span>
                        <label className="flex items-center justify-between gap-2 cursor-pointer">
                          <span className="text-[11px] text-slate-700 dark:text-slate-300">Allow students to view anonymized poll results</span>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedField.validation_config?.show_poll_results)}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  show_poll_results: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-2 cursor-pointer">
                          <span className="text-[11px] text-slate-700 dark:text-slate-300">Allow multiple poll choices</span>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedField.validation_config?.poll_allow_multiple)}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  poll_allow_multiple: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                          />
                        </label>
                      </div>
                    )}

                    {(["checkbox", "multi_select"].includes(selectedField.field_type) ||
                      (selectedField.field_type === "poll" && selectedField.validation_config?.poll_allow_multiple)) && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-[#2d2d2d]">
                        <div>
                          <label className="block text-[10px] text-slate-500">Min Selections</label>
                          <input
                            type="number"
                            min={0}
                            value={selectedField.validation_config?.min_selections ?? ""}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  min_selections: e.target.value !== "" ? Number(e.target.value) : undefined,
                                },
                              })
                            }
                            className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500">Max Selections</label>
                          <input
                            type="number"
                            min={1}
                            value={selectedField.validation_config?.max_selections ?? ""}
                            onChange={(e) =>
                              handleUpdateSelectedField({
                                validation_config: {
                                  ...(selectedField.validation_config || {}),
                                  max_selections: e.target.value !== "" ? Number(e.target.value) : undefined,
                                },
                              })
                            }
                            className="w-full text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* GOOGLE FORMS ANSWER-BASED SECTION BRANCHING ("Go to section based on answer") */}
                {BRANCHING_QUESTION_TYPES.includes(selectedField.field_type) && !(selectedField.field_type === "poll" && selectedField.validation_config?.poll_allow_multiple) && (
                  <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <div>
                        <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Go to section based on answer</p>
                        <p className="text-[10px] text-indigo-700/70 dark:text-indigo-300/70">Branch students dynamically after answering</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedField.validation_config?.go_to_section_on_answer)}
                        onChange={(e) =>
                          handleUpdateSelectedField({
                            validation_config: {
                              ...(selectedField.validation_config || {}),
                              go_to_section_on_answer: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                      />
                    </label>

                    {selectedField.validation_config?.go_to_section_on_answer && (
                      <div className="space-y-1.5 pt-1">
                        {sections.length <= 1 && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-300 font-semibold">
                            Tip: Add another section or Page Break on the canvas to jump between sections.
                          </p>
                        )}
                        {(
                          selectedField.field_type === "yes_no"
                            ? [
                                { label: "Yes", value: "yes" },
                                { label: "No", value: "no" },
                              ]
                            : [
                                ...(selectedField.options_config || []),
                                ...(selectedField.validation_config?.allow_other ? [{ label: "Other", value: "__other__" }] : []),
                              ]
                        ).map((opt) => {
                          const routes = selectedField.validation_config?.option_routes || {};
                          const curTarget = routes[opt.value] || "__next__";
                          return (
                            <div key={opt.value} className="flex items-center justify-between gap-2 bg-white dark:bg-[#141414] p-1.5 rounded-lg border border-indigo-100 dark:border-[#2d2d2d]">
                              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[100px]" title={opt.label}>
                                {opt.label}
                              </span>
                              <span className="text-[10px] text-slate-400">→</span>
                              <select
                                value={curTarget}
                                onChange={(e) => {
                                  const nextRoutes = {
                                    ...(selectedField.validation_config?.option_routes || {}),
                                    [opt.value]: e.target.value,
                                  };
                                  handleUpdateSelectedField({
                                    validation_config: {
                                      ...(selectedField.validation_config || {}),
                                      option_routes: nextRoutes,
                                    },
                                  });
                                }}
                                className="flex-1 text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                              >
                                <option value="__next__">Continue to next section</option>
                                {sections.map((sec, sIdx) => (
                                  <option key={sec.id} value={sec.id} disabled={sec.id === (selectedField.section_id || sections[0]?.id)}>
                                    Go to Section {sIdx + 1}: {sec.title}
                                  </option>
                                ))}
                                <option value="__submit__">Submit form</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-[#F5F5F5]">Conditional Visibility</p>
                      <p className="text-[10px] text-slate-400">Show or hide this question based on answers</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Array.isArray(selectedField.conditions)
                          ? selectedField.conditions
                          : selectedField.conditions?.rules || [];
                        const curLogic = !Array.isArray(selectedField.conditions) && selectedField.conditions?.logic === "or" ? "or" : "and";
                        const otherFields = fields.filter((f) => f.id !== selectedField.id);
                        if (otherFields.length === 0) {
                          setErrorMessage("Add at least one other question before creating conditional rules.");
                          return;
                        }
                        const newRule: ConditionalRule = {
                          field: otherFields[0].field_key,
                          operator: "equals",
                          value: "yes",
                          action: "show",
                        };
                        handleUpdateSelectedField({
                          conditions: { logic: curLogic, rules: [...cur, newRule] },
                        });
                      }}
                      className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold cursor-pointer shrink-0"
                    >
                      + Add Rule
                    </button>
                  </div>

                  {/* Rules list */}
                  {(() => {
                    const rules: ConditionalRule[] = Array.isArray(selectedField.conditions)
                      ? selectedField.conditions
                      : selectedField.conditions?.rules || [];
                    const logicMode: "and" | "or" =
                      !Array.isArray(selectedField.conditions) && selectedField.conditions?.logic === "or" ? "or" : "and";

                    const commitRules = (nextRules: ConditionalRule[], nextLogic = logicMode) => {
                      handleUpdateSelectedField({
                        conditions: nextRules.length ? { logic: nextLogic, rules: nextRules } : undefined,
                      });
                    };

                    if (rules.length === 0) {
                      return <p className="text-[11px] text-slate-400 italic">No conditional rules. Always visible.</p>;
                    }

                    return (
                      <div className="space-y-2">
                        {rules.length > 1 && (
                          <div className="flex items-center justify-between text-[11px] bg-white dark:bg-[#141414] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d2d]">
                            <span className="text-slate-500 font-medium">Combine rules with:</span>
                            <select
                              value={logicMode}
                              onChange={(e) => commitRules(rules, e.target.value as "and" | "or")}
                              className="font-semibold text-purple-700 dark:text-purple-300 bg-transparent cursor-pointer"
                            >
                              <option value="and">ALL match (AND)</option>
                              <option value="or">ANY matches (OR)</option>
                            </select>
                          </div>
                        )}

                        {rules.map((rule, rIdx) => {
                          const srcField = fields.find((f) => f.field_key === rule.field);
                          const srcOpts = srcField?.options_config || [];
                          return (
                            <div key={rIdx} className="p-2 rounded-lg bg-white dark:bg-[#141414] border border-slate-200 dark:border-[#2d2d2d] text-xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <select
                                  value={rule.action || "show"}
                                  onChange={(e) => {
                                    const updated = [...rules];
                                    updated[rIdx] = { ...updated[rIdx], action: e.target.value as any };
                                    commitRules(updated);
                                  }}
                                  className="text-[10px] font-bold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded"
                                >
                                  <option value="show">Show Question When</option>
                                  <option value="hide">Hide Question When</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => commitRules(rules.filter((_, i) => i !== rIdx))}
                                  className="text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>

                              {/* Source Field & Operator Dropdowns */}
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="block text-[10px] text-slate-400">If Question:</label>
                                  <select
                                    value={rule.field}
                                    onChange={(e) => {
                                      const updated = [...rules];
                                      updated[rIdx] = { ...updated[rIdx], field: e.target.value };
                                      commitRules(updated);
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

                                <div>
                                  <label className="block text-[10px] text-slate-400">Operator:</label>
                                  <select
                                    value={rule.operator}
                                    onChange={(e) => {
                                      const updated = [...rules];
                                      updated[rIdx] = { ...updated[rIdx], operator: e.target.value as any };
                                      commitRules(updated);
                                    }}
                                    className="w-full text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                  >
                                    <option value="equals">equals</option>
                                    <option value="not_equals">not equals</option>
                                    <option value="contains">contains</option>
                                    <option value="not_contains">does not contain</option>
                                    <option value="greater_than">greater than</option>
                                    <option value="less_than">less than</option>
                                    <option value="in">is one of (comma)</option>
                                    <option value="is_empty">is empty</option>
                                    <option value="is_not_empty">is not empty</option>
                                  </select>
                                </div>
                              </div>

                              {/* Target value */}
                              {!["is_empty", "is_not_empty"].includes(rule.operator) && (
                                <div className="space-y-1">
                                  <label className="block text-[10px] text-slate-400">Value:</label>
                                  <input
                                    type="text"
                                    value={rule.value || ""}
                                    placeholder="e.g. yes, other, online"
                                    onChange={(e) => {
                                      const updated = [...rules];
                                      updated[rIdx] = { ...updated[rIdx], value: e.target.value };
                                      commitRules(updated);
                                    }}
                                    className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#1c1c1c]"
                                  />
                                  {srcOpts.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {srcOpts.slice(0, 6).map((o) => (
                                        <button
                                          key={o.value}
                                          type="button"
                                          onClick={() => {
                                            const updated = [...rules];
                                            updated[rIdx] = { ...updated[rIdx], value: o.value };
                                            commitRules(updated);
                                          }}
                                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#252525] hover:bg-purple-100 text-slate-600 dark:text-slate-300 cursor-pointer"
                                        >
                                          {o.label}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
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
