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
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";
import { EventTemplatesLibraryModal } from "@/components/events/EventTemplatesLibraryModal";
import { DynamicStudentFormRenderer } from "@/components/events/DynamicStudentFormRenderer";
import { FormThemeCustomizer } from "@/components/events/FormThemeCustomizer";
import { FormImportQuestionsModal } from "@/components/events/FormImportQuestionsModal";
import { GoogleFormsFieldCard } from "@/components/events/GoogleFormsFieldCard";
import {
  DEFAULT_FORM_THEME,
  generateUniqueId,
  getResolvedTheme,
  getFontFamilyCss,
  getRadiusClass,
  parseVideoEmbedUrl,
  sanitizeRichHtml,
} from "@/lib/form-utils";

interface EventFormBuilderProps {
  event: EventItem;
  initialFields?: EventFormField[];
  initialSections?: FormSection[];
  initialFormSettings?: FormSettings | null;
  onSaved?: () => void;
  onBack?: () => void;
  onSwitchEvent?: (nextEvent: EventItem) => void;
}

const LAYOUT_TYPES = [
  "title_block",
  "heading",
  "subheading",
  "description",
  "rich_text_block",
  "divider",
  "page_break",
  "info",
  "info_card",
  "image_block",
  "video_block",
  "pdf_link",
  "notice",
];
const CHOICE_TYPES = ["dropdown", "radio", "checkbox", "multi_select", "poll"];
const UPLOAD_TYPES = ["file", "pdf_upload", "document_upload", "image_upload", "gallery_upload", "camera_capture", "geo_photo"];
const RATING_TYPES = ["star_rating", "numeric_rating", "satisfaction_rating", "difficulty_rating", "custom_scale"];

function buildDefaultBlock(
  type: FormFieldType,
  sectionId: string,
  orderIndex: number,
  totalCount: number
): EventFormField {
  const newId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newKey = `f_${type}_${totalCount + 1}_${Math.random().toString(36).substring(2, 4)}`;

  const labelMap: Record<string, string> = {
    title_block: "Untitled Section Title",
    heading: "Untitled Heading",
    description: "Instructions for Participants",
    rich_text_block: "Important Notes & Details",
    image_block: "Event Visual / Poster",
    video_block: "Reference Video",
    divider: "Divider",
    text: "Untitled Question",
    textarea: "Detailed Response",
    radio: "Multiple Choice Question",
    checkbox: "Checkbox Question",
    dropdown: "Dropdown Question",
    yes_no: "Yes / No Question",
    poll: "Quick Student Poll",
    number: "Numeric Answer",
    email: "Email Address",
    phone: "Phone Number",
    date: "Select Date",
    time: "Select Time",
    datetime: "Date & Time",
    file: "Upload File",
    image_upload: "Upload Image",
    numeric_rating: "Linear Scale",
    star_rating: "Rating",
  };

  const defaultOptions: FormFieldOption[] = CHOICE_TYPES.includes(type)
    ? [
        { label: "Option 1", value: "option_1" },
        { label: "Option 2", value: "option_2" },
      ]
    : [];

  let defaultRatingConfig: RatingConfig | undefined;
  if (type === "star_rating") {
    defaultRatingConfig = { max_rating: 5, min_label: "Poor", max_label: "Excellent", scale_type: "stars" };
  } else if (type === "numeric_rating" || type === "custom_scale") {
    defaultRatingConfig = { min_rating: 1, max_rating: 5, min_label: "Low", max_label: "High", scale_type: "numbers" };
  } else if (type === "satisfaction_rating") {
    defaultRatingConfig = { options: ["Poor", "Fair", "Good", "Very Good", "Excellent"], scale_type: "labels" };
  } else if (type === "difficulty_rating") {
    defaultRatingConfig = { options: ["Beginner", "Intermediate", "Advanced"], scale_type: "labels" };
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
        { id: `rep_sub_2_${Date.now()}`, field_key: "role", field_type: "text", label: "Role", required: true, display_order: 1, enabled: true },
      ],
    };
  }

  const isLayout = LAYOUT_TYPES.includes(type);
  const valCfg: NonNullable<EventFormField["validation_config"]> = {};
  if (UPLOAD_TYPES.includes(type)) {
    valCfg.allowed_types =
      type === "pdf_upload"
        ? ["pdf"]
        : type.includes("image") || type === "gallery_upload"
        ? ["jpg", "jpeg", "png", "webp"]
        : ["pdf", "doc", "docx", "png", "jpg"];
    valCfg.max_size_mb = 10;
    valCfg.allow_multiple_files = type === "gallery_upload";
    valCfg.max_files = type === "gallery_upload" ? 5 : 1;
  } else if (type === "title_block" || type === "heading") {
    valCfg.block_style = { alignment: "left", font_size: "xl", font_weight: "bold", subtitle: "" };
  } else if (type === "description" || type === "rich_text_block") {
    valCfg.block_style = { alignment: "left", font_size: "md", variant: "instructions" };
    valCfg.rich_html = "<p>Please read all instructions carefully before submitting the form.</p>";
  } else if (type === "image_block") {
    valCfg.media_config = { alignment: "center", width_percent: 85, caption: "" };
  } else if (type === "video_block") {
    valCfg.media_config = { video_url: "", video_description: "" };
  } else if (type === "number") {
    valCfg.number_mode = "decimal";
  }

  return {
    id: newId,
    field_key: newKey,
    field_type: type,
    label: labelMap[type] || "Untitled Block",
    description: type === "description" ? "Please read all instructions carefully before submitting the form." : "",
    placeholder: "",
    required: !isLayout,
    display_order: orderIndex,
    enabled: true,
    section_id: sectionId,
    options_config: defaultOptions,
    rating_config: defaultRatingConfig,
    repeatable_config: defaultRepeatable,
    validation_config: valCfg,
  };
}

export const EventFormBuilder: React.FC<EventFormBuilderProps> = ({
  event,
  initialFields = [],
  initialSections = [],
  initialFormSettings = null,
  onSaved,
  onBack,
  onSwitchEvent,
}) => {
  const authToken = getStoredToken();

  // Sections state
  const [sections, setSections] = useState<FormSection[]>(() => {
    if (initialSections && initialSections.length > 0) {
      return [...initialSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return [{ id: "sec_default", title: "General Details", description: "", order: 0 }];
  });

  // Fields / Content Blocks state
  const [fields, setFields] = useState<EventFormField[]>(() => {
    if (initialFields && initialFields.length > 0) {
      return initialFields.map((f, idx) => ({
        ...f,
        section_id: f.section_id || (initialSections[0]?.id || "sec_default"),
        display_order: f.display_order ?? idx,
      }));
    }
    return [
      {
        id: "field_name_default",
        field_key: "full_name",
        field_type: "text",
        label: "Student Name",
        description: "",
        placeholder: "Enter your full name",
        required: true,
        display_order: 0,
        enabled: true,
        section_id: "sec_default",
      },
      {
        id: "field_reg_default",
        field_key: "register_number",
        field_type: "text",
        label: "Register Number",
        placeholder: "e.g. 24CCE001",
        required: true,
        display_order: 1,
        enabled: true,
        section_id: "sec_default",
      },
    ];
  });

  // Form Settings + Theme state
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
    theme: {
      ...DEFAULT_FORM_THEME,
      ...(initialFormSettings?.theme || {}),
    },
  }));

  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0]?.id || "sec_default");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id || null);
  const [layoutMode, setLayoutMode] = useState<FormLayoutMode>(event.form_layout_mode || "single_page");
  const [eventStatus, setEventStatus] = useState<string>(event.status);

  // Overlays / Drawers / Modes
  const [viewMode, setViewMode] = useState<"editor" | "preview">("editor");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showThemeDrawer, setShowThemeDrawer] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);
  const [pendingTemplate, setPendingTemplate] = useState<EventTemplate | null>(null);
  const [confirmScratch, setConfirmScratch] = useState<boolean>(false);
  const [editingSectionLogicId, setEditingSectionLogicId] = useState<string | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);

  // Template saving state
  const [tplName, setTplName] = useState<string>("");
  const [tplCategory, setTplCategory] = useState<string>(event.category || "Workshop");
  const [tplPurpose, setTplPurpose] = useState<string>("");
  const [tplDescription, setTplDescription] = useState<string>("");
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);

  // Save / Publish / Duplicate status
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isDuplicating, setIsDuplicating] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const theme = useMemo(() => getResolvedTheme(formSettings.theme), [formSettings.theme]);

  // Detect invalid destination IDs, circular loops, and invalid video URLs before saving
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

    const state = new Map<string, number>();
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
        warnings.push("Circular navigation detected between sections. Branches must move forward or end with 'Submit form'.");
        break;
      }
    }
    return warnings;
  }, [sections, fields]);

  // Insert block right after selected field (or at end of active section)
  const insertBlockAtCursor = (type: FormFieldType) => {
    setSaveSuccess(null);
    setErrorMessage(null);
    const selected = fields.find((f) => f.id === selectedFieldId);
    const targetSecId = selected?.section_id || activeSectionId || sections[0]?.id || "sec_default";
    const newBlock = buildDefaultBlock(type, targetSecId, fields.length, fields.length);

    setFields((prev) => {
      const next = [...prev];
      if (selectedFieldId) {
        const idx = next.findIndex((f) => f.id === selectedFieldId);
        if (idx !== -1) {
          next.splice(idx + 1, 0, newBlock);
          return next.map((f, i) => ({ ...f, display_order: i }));
        }
      }
      let lastIdx = -1;
      for (let i = next.length - 1; i >= 0; i--) {
        if ((next[i].section_id || sections[0]?.id) === targetSecId) {
          lastIdx = i;
          break;
        }
      }
      if (lastIdx !== -1) next.splice(lastIdx + 1, 0, newBlock);
      else next.push(newBlock);
      return next.map((f, i) => ({ ...f, display_order: i }));
    });
    setActiveSectionId(targetSecId);
    setSelectedFieldId(newBlock.id);
  };

  // Import selected blocks right at the cursor position
  const handleImportBlocks = (imported: EventFormField[]) => {
    const selected = fields.find((f) => f.id === selectedFieldId);
    const targetSecId = selected?.section_id || activeSectionId || sections[0]?.id || "sec_default";
    const cloned = imported.map((f, i) => ({
      ...JSON.parse(JSON.stringify(f)),
      id: `imp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      field_key: `${f.field_key}_imp_${Math.floor(Math.random() * 900 + 100)}`,
      section_id: targetSecId,
    }));

    setFields((prev) => {
      const next = [...prev];
      const idx = selectedFieldId ? next.findIndex((f) => f.id === selectedFieldId) : -1;
      if (idx !== -1) next.splice(idx + 1, 0, ...cloned);
      else next.push(...cloned);
      return next.map((f, i) => ({ ...f, display_order: i }));
    });
    if (cloned[0]) setSelectedFieldId(cloned[0].id);
    setSaveSuccess(`Imported ${cloned.length} block(s) into "${sections.find((s) => s.id === targetSecId)?.title || "Section"}".`);
  };

  const handleUpdateField = (id: string, patch: Partial<EventFormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleChangeFieldType = (id: string, nextType: FormFieldType) => {
    const target = fields.find((f) => f.id === id);
    if (!target) return;
    const blueprint = buildDefaultBlock(nextType, target.section_id || activeSectionId, target.display_order, fields.length);
    const patch: Partial<EventFormField> = { field_type: nextType };
    if (CHOICE_TYPES.includes(nextType) && (!target.options_config || target.options_config.length === 0)) {
      patch.options_config = blueprint.options_config;
    }
    if (RATING_TYPES.includes(nextType)) {
      patch.rating_config = blueprint.rating_config;
    }
    if (nextType === "repeatable_group" && !target.repeatable_config) {
      patch.repeatable_config = blueprint.repeatable_config;
    }
    if (UPLOAD_TYPES.includes(nextType)) {
      patch.validation_config = { ...(target.validation_config || {}), ...(blueprint.validation_config || {}) };
    }
    if (LAYOUT_TYPES.includes(nextType)) {
      patch.required = false;
    }
    handleUpdateField(id, patch);
  };

  const handleDuplicateField = (field: EventFormField) => {
    const newId = generateUniqueId("field");
    const dup: EventFormField = {
      ...JSON.parse(JSON.stringify(field)),
      id: newId,
      field_key: generateUniqueId(`${field.field_key}_copy`),
      label: `${field.label} (Copy)`,
    };
    setFields((prev) => {
      const next = [...prev];
      const idx = next.findIndex((f) => f.id === field.id);
      if (idx !== -1) next.splice(idx + 1, 0, dup);
      else next.push(dup);
      return next.map((f, i) => ({ ...f, display_order: i }));
    });
    setSelectedFieldId(newId);
  };

  const handleDeleteField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, display_order: i }));
      if (selectedFieldId === id) setSelectedFieldId(next[0]?.id || null);
      return next;
    });
  };

  const handleMoveField = (id: string, direction: "up" | "down") => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
      // Adopt neighbor's section so moving up/down naturally traverses sections
      copy[targetIdx] = { ...copy[targetIdx], section_id: prev[targetIdx].section_id };
      return copy.map((f, i) => ({ ...f, display_order: i }));
    });
  };

  // Sections
  const handleAddSection = () => {
    const selected = fields.find((f) => f.id === selectedFieldId);
    const curSecId = selected?.section_id || activeSectionId;
    const curIdx = sections.findIndex((s) => s.id === curSecId);
    const insertAt = curIdx !== -1 ? curIdx + 1 : sections.length;
    const newSecId = generateUniqueId("sec");
    const newSec: FormSection = {
      id: newSecId,
      title: `Section ${sections.length + 1}`,
      description: "",
      order: insertAt,
      after_section_action: "__next__",
    };
    setSections((prev) => {
      const next = [...prev];
      next.splice(insertAt, 0, newSec);
      return next.map((s, idx) => ({ ...s, order: idx }));
    });
    setActiveSectionId(newSecId);
    if (sections.length >= 1) {
      setLayoutMode("multi_step");
    }
    setSaveSuccess(`Added "${newSec.title}".`);
  };

  const handleUpdateSection = (secId: string, patch: Partial<FormSection>) => {
    setSections((prev) => prev.map((s) => (s.id === secId ? { ...s, ...patch } : s)));
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

  const handleDuplicateSection = (secId: string) => {
    const src = sections.find((s) => s.id === secId);
    if (!src) return;
    const newSecId = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const newSec: FormSection = {
      ...JSON.parse(JSON.stringify(src)),
      id: newSecId,
      title: `${src.title} (Copy)`,
      order: sections.length,
    };
    const secFields = fields.filter((f) => (f.section_id || sections[0]?.id) === secId);
    const clonedFields = secFields.map((f, i) => ({
      ...JSON.parse(JSON.stringify(f)),
      id: `field_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
      field_key: `${f.field_key}_copy_${Math.floor(Math.random() * 900 + 100)}`,
      section_id: newSecId,
    }));
    setSections((prev) => [...prev, newSec].map((s, idx) => ({ ...s, order: idx })));
    setFields((prev) => [...prev, ...clonedFields].map((f, idx) => ({ ...f, display_order: idx })));
    setActiveSectionId(newSecId);
  };

  const handleRemoveSection = (secId: string) => {
    if (sections.length <= 1) {
      setErrorMessage("A form must have at least one section.");
      return;
    }
    const remaining = sections.filter((s) => s.id !== secId).map((s, i) => ({ ...s, order: i }));
    const fallbackId = remaining[0].id;
    setSections(remaining);
    setFields((prev) =>
      prev.map((f) => (f.section_id === secId ? { ...f, section_id: fallbackId } : f))
    );
    if (activeSectionId === secId) setActiveSectionId(fallbackId);
  };

  // Drag and Drop
  const handleDropOnField = (targetFieldId: string, targetSectionId: string) => {
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

  // Template / Scratch Handlers
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
    setPendingTemplate(null);
    setShowTemplatesModal(false);
    setSaveSuccess(`Loaded "${tpl.name}" template. Click Save Draft or Publish Form to apply.`);
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
    const firstQ = buildDefaultBlock("text", blankSecId, 0, 0);
    setSections([{ id: blankSecId, title: "Section 1", description: "", order: 0 }]);
    setFields([firstQ]);
    setActiveSectionId(blankSecId);
    setSelectedFieldId(firstQ.id);
    setConfirmScratch(false);
    setSaveSuccess("Started a fresh blank form.");
  };

  const handleSaveAsCustomTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;
    setSavingTemplate(true);
    setErrorMessage(null);
    try {
      await eventsApi.saveCustomTemplate({
        name: tplName.trim(),
        category: tplCategory || "Workshop",
        purpose: tplPurpose.trim() || `Template from ${event.title}`,
        description: tplDescription.trim() || `${sections.length} sections, ${fields.length} blocks`,
        form_layout_mode: layoutMode,
        sections_config: sections,
        fields_config: fields,
      });
      setShowSaveTemplateModal(false);
      setTplName("");
      setTplPurpose("");
      setTplDescription("");
      setSaveSuccess(`Saved custom template "${tplName.trim()}"!`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Validate all content blocks (video URLs, cycles, non-empty) & prepare payload
  const validateAndSaveForm = async (): Promise<boolean> => {
    if (fields.length === 0) {
      setErrorMessage("Add at least one block or question before saving.");
      return false;
    }
    if (navigationWarnings.length > 0) {
      setErrorMessage(navigationWarnings[0]);
      return false;
    }

    // Validate video URLs and sanitize rich HTML before saving
    const preparedFields: EventFormField[] = [];
    for (let i = 0; i < fields.length; i++) {
      const f = { ...fields[i], display_order: i };
      const vCfg = { ...(f.validation_config || {}) };

      if (f.field_type === "video_block") {
        const vidUrl = String(vCfg.media_config?.video_url || f.default_value || "").trim();
        if (!vidUrl) {
          setErrorMessage(`Video block "${f.label}" requires a valid YouTube, Vimeo, or Google Drive URL.`);
          setSelectedFieldId(f.id);
          return false;
        }
        const parsed = parseVideoEmbedUrl(vidUrl);
        if (!parsed.valid) {
          setErrorMessage(`Video block "${f.label}": ${parsed.error}`);
          setSelectedFieldId(f.id);
          return false;
        }
        vCfg.media_config = { ...(vCfg.media_config || {}), video_url: vidUrl, embed_url: parsed.embedUrl };
        f.default_value = parsed.embedUrl;
      }

      if ((f.field_type === "description" || f.field_type === "rich_text_block") && vCfg.rich_html) {
        vCfg.rich_html = sanitizeRichHtml(vCfg.rich_html);
      }
      if (f.help_text !== undefined) {
        vCfg.help_text = f.help_text;
      }
      f.validation_config = vCfg;
      preparedFields.push(f);
    }

    const hasBranching =
      sections.some((s) => Boolean(s.after_section_action && s.after_section_action !== "__next__") || Boolean(s.navigation_rules?.length)) ||
      preparedFields.some((f) => Boolean(f.validation_config?.go_to_section_on_answer));
    const effectiveLayout: FormLayoutMode = sections.length > 1 && (hasBranching || layoutMode === "multi_step") ? "multi_step" : layoutMode;

    if (effectiveLayout !== event.form_layout_mode) {
      await eventsApi.updateEvent(event.id, { form_layout_mode: effectiveLayout });
      setLayoutMode(effectiveLayout);
    }

    await eventsApi.saveEventForm(event.id, preparedFields, sections, formSettings);
    return true;
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(null);
    try {
      const ok = await validateAndSaveForm();
      if (ok) {
        setSaveSuccess("Form design, content blocks, theme & logic saved successfully!");
        if (onSaved) onSaved();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save form changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishForm = async () => {
    setIsPublishing(true);
    setErrorMessage(null);
    setSaveSuccess(null);
    try {
      const ok = await validateAndSaveForm();
      if (!ok) return;
      const pubRes = await eventsApi.publishEvent(event.id);
      if (pubRes?.event?.status) setEventStatus(pubRes.event.status);
      else setEventStatus("published");
      setSaveSuccess("Form saved and published live to target students!");
      if (onSaved) onSaved();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to publish form.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDuplicateEvent = async () => {
    setIsDuplicating(true);
    setErrorMessage(null);
    try {
      const ok = await validateAndSaveForm();
      if (!ok) return;
      const res = await eventsApi.duplicateEvent(event.id);
      setSaveSuccess(res?.message || "Form & event duplicated as a new draft!");
      if (onSaved) onSaved();
      if (res?.event && onSwitchEvent) {
        onSwitchEvent(res.event);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to duplicate form.");
    } finally {
      setIsDuplicating(false);
    }
  };

  const radiusCls = getRadiusClass(theme.corner_radius);

  // Floating Google Forms 6-icon right toolbar items (+ Quick Text Block)
  const floatingTools: Array<{ icon: string; label: string; action: () => void }> = [
    { icon: "⊕", label: "Add Question", action: () => insertBlockAtCursor("radio") },
    { icon: "📥", label: "Import Questions", action: () => setShowImportModal(true) },
    { icon: "Tᴛ", label: "Add Title Block", action: () => insertBlockAtCursor("title_block") },
    { icon: "¶", label: "Add Description / Text Block", action: () => insertBlockAtCursor("description") },
    { icon: "🖼", label: "Add Image Block", action: () => insertBlockAtCursor("image_block") },
    { icon: "▶", label: "Add Video Block", action: () => insertBlockAtCursor("video_block") },
    { icon: "▭", label: "Add Section / Page", action: handleAddSection },
  ];

  return (
    <div className="space-y-4">
      {/* ===================================================================== */}
      {/* GOOGLE FORMS TOP STICKY HEADER BAR                                    */}
      {/* ===================================================================== */}
      <div className="sticky top-2 z-30 rounded-2xl border border-slate-200 dark:border-[#2d2d2d] bg-white/95 dark:bg-[#181818]/95 backdrop-blur-md px-4 py-3 shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
              title="Back to Events List"
            >
              ←
            </button>
          )}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs"
            style={{ backgroundColor: theme.theme_color }}
          >
            ☰
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] truncate">
                {formSettings.form_title || event.title}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                  eventStatus === "published"
                    ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                }`}
              >
                {eventStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">
              {sections.length} Section{sections.length > 1 ? "s" : ""} • {fields.length} Block{fields.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowThemeDrawer(true)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#222] hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            🎨 Customize Theme
          </button>

          <button
            type="button"
            onClick={() => setViewMode(viewMode === "editor" ? "preview" : "editor")}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              viewMode === "preview"
                ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50 dark:bg-[#5DD62C]/15 text-blue-700 dark:text-[#5DD62C]"
                : "border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#222] text-slate-700 dark:text-slate-200"
            }`}
          >
            {viewMode === "preview" ? "🛠 Back to Editor" : "👁 Preview"}
          </button>

          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#222] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            title="Load Starter or Custom Template"
          >
            📚 Templates
          </button>

          <button
            type="button"
            onClick={() => {
              setTplName(`${event.title} Template`);
              setTplCategory(event.category || "Workshop");
              setShowSaveTemplateModal(true);
            }}
            disabled={fields.length === 0}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#222] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-40"
            title="Save Form as Reusable Template"
          >
            ⭐ Template
          </button>

          <button
            type="button"
            onClick={handleDuplicateEvent}
            disabled={isDuplicating}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#222] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
            title="Save and Duplicate Entire Form as New Draft"
          >
            {isDuplicating ? "Cloning..." : "📑 Duplicate"}
          </button>

          <button
            type="button"
            onClick={() => setConfirmScratch(true)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#222] text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Clear Canvas & Start Blank"
          >
            ✨ Clear
          </button>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving || isPublishing}
            className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-[#3d3d3d] bg-white dark:bg-[#222] hover:bg-slate-50 text-xs font-bold text-slate-800 dark:text-[#F5F5F5] cursor-pointer disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "💾 Save Draft"}
          </button>

          <button
            type="button"
            onClick={handlePublishForm}
            disabled={isSaving || isPublishing}
            style={{ backgroundColor: theme.theme_color }}
            className="px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isPublishing ? "Publishing..." : eventStatus === "published" ? "✓ Update Published" : "🚀 Publish Form"}
          </button>
        </div>
      </div>

      {/* Inline Warnings & Banners */}
      {navigationWarnings.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-bold">⚠️ Branching Navigation Warning</p>
          {navigationWarnings.map((w, i) => (
            <p key={i}>• {w}</p>
          ))}
        </div>
      )}

      {pendingTemplate && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            Replace canvas with <strong>&ldquo;{pendingTemplate.name}&rdquo;</strong> template?
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPendingTemplate(null)} className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-xs font-semibold cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={() => applyTemplateNow(pendingTemplate)} className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-semibold cursor-pointer">
              Confirm Load
            </button>
          </div>
        </div>
      )}

      {confirmScratch && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>Clear current blocks and start a blank form?</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmScratch(false)} className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-xs font-semibold cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={handleResetScratch} className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer">
              Reset Blank
            </button>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
          <span>✓ {saveSuccess}</span>
          <button type="button" onClick={() => setSaveSuccess(null)} className="cursor-pointer">×</button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="cursor-pointer">×</button>
        </div>
      )}

      {/* Modals & Side Drawers */}
      <FormThemeCustomizer
        isOpen={showThemeDrawer}
        onClose={() => setShowThemeDrawer(false)}
        formSettings={formSettings}
        onChangeSettings={setFormSettings}
        eventTitle={event.title}
      />

      <FormImportQuestionsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        currentEventId={event.id}
        onImport={handleImportBlocks}
      />

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
              <button type="button" onClick={() => setShowSaveTemplateModal(false)} className="text-slate-400 cursor-pointer">✕</button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#121212]"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Category</label>
                <select
                  value={tplCategory}
                  onChange={(e) => setTplCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#121212]"
                >
                  <option value="Workshop">Workshop</option>
                  <option value="Hackathon">Hackathon</option>
                  <option value="Internship">Internship</option>
                  <option value="Examination">Examination</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={tplDescription}
                  onChange={(e) => setTplDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#121212]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowSaveTemplateModal(false)} className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={savingTemplate} className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white cursor-pointer disabled:opacity-50">
                {savingTemplate ? "Saving..." : "Save Template"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 1: LIVE PREVIEW (DESKTOP / MOBILE)                               */}
      {/* ===================================================================== */}
      {viewMode === "preview" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-[#5DD62C]">
              Live Form Preview — Conditional branching, rich content blocks &amp; theme active (test inputs stay temporary)
            </span>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-[#202020] p-1 border border-slate-200 dark:border-[#2d2d2d]">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
                  previewDevice === "desktop" ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black" : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                🖥 Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`px-3 py-1 text-xs font-semibold rounded cursor-pointer ${
                  previewDevice === "mobile" ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black" : "text-slate-600 dark:text-[#A3A3A3]"
                }`}
              >
                📱 Mobile
              </button>
            </div>
          </div>

          <div
            className={`mx-auto transition-all ${
              previewDevice === "mobile"
                ? "max-w-sm border-4 border-slate-800 rounded-3xl p-2 shadow-2xl"
                : "max-w-3xl"
            }`}
          >
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
        /* =================================================================== */
        /* VIEW 2: GOOGLE FORMS-STYLE CENTERED CANVAS + FLOATING TOOLBAR       */
        /* =================================================================== */
        <div
          className="rounded-3xl border border-slate-200 dark:border-[#292929] p-4 sm:p-8 min-h-[75vh] transition-colors"
          style={{
            backgroundColor: theme.background_color,
            fontFamily: getFontFamilyCss(theme.font_family),
          }}
        >
          <div className="max-w-4xl mx-auto flex items-start justify-center gap-4">
            {/* MAIN GOOGLE FORMS EDITING COLUMN */}
            <div className="flex-1 max-w-3xl space-y-4">
              {/* Optional Banner Header Image */}
              {theme.banner_image_url && (
                <div className={`overflow-hidden border border-slate-200 dark:border-[#2d2d2d] shadow-xs bg-white ${radiusCls}`}>
                  <img
                    src={resolveEventAssetUrl(theme.banner_image_url, authToken)}
                    alt="Form Header Banner"
                    className="w-full h-36 sm:h-48 object-cover"
                  />
                </div>
              )}

              {/* FORM TITLE & DESCRIPTION HEADER CARD */}
              <div
                className={`bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2d2d2d] p-5 sm:p-6 shadow-sm space-y-2.5 border-t-[10px] ${radiusCls} ${
                  theme.content_alignment === "center" ? "text-center" : "text-left"
                }`}
                style={{ borderTopColor: theme.theme_color }}
              >
                <input
                  type="text"
                  value={formSettings.form_title ?? ""}
                  placeholder={event.title}
                  onChange={(e) => setFormSettings((s) => ({ ...s, form_title: e.target.value }))}
                  className={`w-full font-bold text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-1 ${
                    theme.content_alignment === "center" ? "text-center" : ""
                  } ${
                    theme.heading_font_size === "xl"
                      ? "text-2xl sm:text-3xl"
                      : theme.heading_font_size === "sm"
                      ? "text-lg"
                      : theme.heading_font_size === "md"
                      ? "text-xl"
                      : "text-xl sm:text-2xl"
                  }`}
                />
                <textarea
                  rows={2}
                  value={formSettings.form_description ?? ""}
                  placeholder={event.short_description || "Form description shown to students..."}
                  onChange={(e) => setFormSettings((s) => ({ ...s, form_description: e.target.value }))}
                  className={`w-full text-xs sm:text-sm text-slate-600 dark:text-[#A3A3A3] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden resize-none ${
                    theme.content_alignment === "center" ? "text-center" : ""
                  }`}
                />
              </div>

              {/* SECTIONS & ORDERED BLOCKS */}
              {sections.map((sec, secIdx) => {
                const secFields = fields.filter((f) => (f.section_id || sections[0]?.id) === sec.id);
                const isSecActive = activeSectionId === sec.id;
                const secRules: ConditionalRule[] = Array.isArray(sec.conditions)
                  ? sec.conditions
                  : sec.conditions?.rules || [];

                return (
                  <div key={sec.id} className="space-y-3 pt-2">
                    {/* Google Forms Section Banner Card */}
                    <div
                      onClick={() => setActiveSectionId(sec.id)}
                      className={`bg-white dark:bg-[#181818] border transition-all p-4 sm:p-5 shadow-xs space-y-2.5 cursor-pointer ${radiusCls} ${
                        isSecActive
                          ? "border-slate-300 dark:border-[#3d3d3d] ring-1 ring-black/5"
                          : "border-slate-200 dark:border-[#2d2d2d]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full"
                          style={{ backgroundColor: theme.theme_color }}
                        >
                          Section {secIdx + 1} of {sections.length}
                        </span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={secIdx === 0}
                            onClick={() => handleMoveSection(sec.id, "up")}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 text-xs cursor-pointer"
                            title="Move Section Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={secIdx === sections.length - 1}
                            onClick={() => handleMoveSection(sec.id, "down")}
                            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 text-xs cursor-pointer"
                            title="Move Section Down"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSectionLogicId(editingSectionLogicId === sec.id ? null : sec.id)}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                              secRules.length > 0
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-[#252525]"
                            }`}
                            title="Section Conditional Skip / Visibility"
                          >
                            ⚡ {secRules.length > 0 ? `${secRules.length} Rule(s)` : "Visibility"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateSection(sec.id)}
                            className="p-1 text-slate-400 hover:text-blue-500 text-xs cursor-pointer"
                            title="Duplicate Section"
                          >
                            📑
                          </button>
                          {sections.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSection(sec.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 text-xs cursor-pointer"
                              title="Delete Section"
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={sec.title}
                        onChange={(e) => handleUpdateSection(sec.id, { title: e.target.value })}
                        placeholder="Section title..."
                        className="w-full text-base font-bold text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-0.5"
                      />
                      <input
                        type="text"
                        value={sec.description || ""}
                        onChange={(e) => handleUpdateSection(sec.id, { description: e.target.value })}
                        placeholder="Section description (optional)..."
                        className="w-full text-xs text-slate-500 dark:text-[#A3A3A3] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden"
                      />

                      {/* Section Visibility Editor */}
                      {editingSectionLogicId === sec.id && (
                        <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/40 dark:bg-purple-950/20 space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-900 dark:text-purple-200">Section Conditional Visibility Rules</span>
                            <button
                              type="button"
                              onClick={() => {
                                const src = fields.find((f) => (f.section_id || sections[0]?.id) !== sec.id) || fields[0];
                                if (!src) return;
                                handleUpdateSection(sec.id, {
                                  conditions: {
                                    logic: "and",
                                    rules: [...secRules, { field: src.field_key, operator: "equals", value: "yes", action: "show" }],
                                  },
                                });
                              }}
                              className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 cursor-pointer"
                            >
                              + Add Rule
                            </button>
                          </div>
                          {secRules.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">No rules — section visibility controlled by flow / answer branches.</p>
                          ) : (
                            secRules.map((r, rIdx) => (
                              <div key={rIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-white dark:bg-[#141414] p-1.5 rounded-lg border border-purple-200/70 dark:border-[#2d2d2d]">
                                <select
                                  value={r.action || "show"}
                                  onChange={(e) => {
                                    const updated = [...secRules];
                                    updated[rIdx] = { ...updated[rIdx], action: e.target.value as ConditionalRule["action"] };
                                    handleUpdateSection(sec.id, { conditions: { logic: "and", rules: updated } });
                                  }}
                                  className="sm:col-span-3 text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333]"
                                >
                                  <option value="show">Show If</option>
                                  <option value="skip">Skip If</option>
                                </select>
                                <select
                                  value={r.field}
                                  onChange={(e) => {
                                    const updated = [...secRules];
                                    updated[rIdx] = { ...updated[rIdx], field: e.target.value };
                                    handleUpdateSection(sec.id, { conditions: { logic: "and", rules: updated } });
                                  }}
                                  className="sm:col-span-4 text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333]"
                                >
                                  {fields.map((f) => (
                                    <option key={f.field_key} value={f.field_key}>{f.label}</option>
                                  ))}
                                </select>
                                <select
                                  value={r.operator}
                                  onChange={(e) => {
                                    const updated = [...secRules];
                                    updated[rIdx] = { ...updated[rIdx], operator: e.target.value as ConditionalRule["operator"] };
                                    handleUpdateSection(sec.id, { conditions: { logic: "and", rules: updated } });
                                  }}
                                  className="sm:col-span-2 text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333]"
                                >
                                  <option value="equals">=</option>
                                  <option value="not_equals">≠</option>
                                  <option value="contains">contains</option>
                                </select>
                                <div className="sm:col-span-3 flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={r.value || ""}
                                    onChange={(e) => {
                                      const updated = [...secRules];
                                      updated[rIdx] = { ...updated[rIdx], value: e.target.value };
                                      handleUpdateSection(sec.id, { conditions: { logic: "and", rules: updated } });
                                    }}
                                    className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#333]"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = secRules.filter((_, i) => i !== rIdx);
                                      handleUpdateSection(sec.id, {
                                        conditions: updated.length ? { logic: "and", rules: updated } : undefined,
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-500 px-1 cursor-pointer"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section Dropzone & Cards */}
                    <div
                      className="space-y-3"
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
                          className={`p-6 border-2 border-dashed border-slate-300 dark:border-[#333] bg-white/70 dark:bg-[#181818]/70 text-center space-y-2 ${radiusCls}`}
                        >
                          <p className="text-xs text-slate-500">This section has no blocks yet.</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSectionId(sec.id);
                              setSelectedFieldId(null);
                              const b = buildDefaultBlock("text", sec.id, fields.length, fields.length);
                              setFields((prev) => [...prev, b].map((x, i) => ({ ...x, display_order: i })));
                              setSelectedFieldId(b.id);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
                            style={{ backgroundColor: theme.theme_color }}
                          >
                            + Add First Question Here
                          </button>
                        </div>
                      ) : (
                        secFields.map((f) => {
                          const globalIdx = fields.findIndex((item) => item.id === f.id);
                          return (
                            <GoogleFormsFieldCard
                              key={f.id}
                              field={f}
                              allFields={fields}
                              sections={sections}
                              theme={theme}
                              isSelected={selectedFieldId === f.id}
                              isDragging={draggedFieldId === f.id}
                              canMoveUp={globalIdx > 0}
                              canMoveDown={globalIdx < fields.length - 1}
                              onSelect={() => {
                                setSelectedFieldId(f.id);
                                setActiveSectionId(sec.id);
                              }}
                              onUpdate={(patch) => handleUpdateField(f.id, patch)}
                              onChangeType={(nextType) => handleChangeFieldType(f.id, nextType)}
                              onDuplicate={() => handleDuplicateField(f)}
                              onDelete={() => handleDeleteField(f.id)}
                              onMoveUp={() => handleMoveField(f.id, "up")}
                              onMoveDown={() => handleMoveField(f.id, "down")}
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
                                  handleDropOnField(f.id, sec.id);
                                }
                              }}
                            />
                          );
                        })
                      )}
                    </div>

                    {/* Google Forms Footer Navigation Rule per Section */}
                    {sections.length > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white/80 dark:bg-[#181818]/90 border border-slate-200 dark:border-[#2d2d2d] text-xs">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          After section {secIdx + 1}:
                        </span>
                        <select
                          value={sec.after_section_action || "__next__"}
                          onChange={(e) => handleUpdateSection(sec.id, { after_section_action: e.target.value })}
                          className="text-xs font-semibold px-3 py-1 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#141414]"
                        >
                          <option value="__next__">Continue to next section</option>
                          {sections.map((targetSec, tIdx) => (
                            <option key={targetSec.id} value={targetSec.id} disabled={targetSec.id === sec.id}>
                              Go to Section {tIdx + 1}: {targetSec.title}
                            </option>
                          ))}
                          <option value="__submit__">Submit form</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* FLOATING RIGHT-SIDE GOOGLE FORMS TOOLBAR (Desktop Sticky Column) */}
            <div className="hidden md:flex flex-col gap-1.5 sticky top-24 p-2 rounded-2xl bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2d2d2d] shadow-lg shrink-0">
              {floatingTools.map((tool) => (
                <button
                  key={tool.label}
                  type="button"
                  onClick={tool.action}
                  title={tool.label}
                  className="group/tb relative w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] flex items-center justify-center text-base font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
                >
                  <span>{tool.icon}</span>
                  <span className="pointer-events-none opacity-0 group-hover/tb:opacity-100 transition-opacity absolute right-12 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold shadow-lg">
                    {tool.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Sticky Floating Insert Toolbar */}
          <div className="md:hidden sticky bottom-3 z-20 mt-6 mx-auto max-w-md flex items-center justify-around gap-1 p-2 rounded-2xl bg-white/95 dark:bg-[#181818]/95 backdrop-blur-md border border-slate-200 dark:border-[#2d2d2d] shadow-xl">
            {floatingTools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={tool.action}
                title={tool.label}
                className="flex flex-col items-center justify-center p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <span className="text-sm font-bold">{tool.icon}</span>
                <span className="text-[9px] font-semibold truncate max-w-[46px]">{tool.label.replace("Add ", "").replace(" Block", "")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
