"use client";

import React, { useState, useRef } from "react";
import {
  EventFormField,
  FormFieldType,
  FormSection,
  ConditionalRule,
  FormThemeConfig,
  ContentBlockStyle,
  MediaBlockConfig,
  FormFieldValidationConfig,
} from "@/types/events";
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";
import { RichTextBlockEditor } from "@/components/events/RichTextBlockEditor";
import {
  normalizeGoogleDriveImageUrl,
  parseVideoEmbedUrl,
  getRadiusClass,
} from "@/lib/form-utils";

export const QUESTION_TYPE_OPTIONS: Array<{ type: FormFieldType; label: string; icon: string }> = [
  { type: "text", label: "Short Answer", icon: "Aa" },
  { type: "textarea", label: "Paragraph", icon: "¶" },
  { type: "radio", label: "Multiple Choice", icon: "◉" },
  { type: "checkbox", label: "Checkboxes", icon: "☑" },
  { type: "dropdown", label: "Dropdown", icon: "▼" },
  { type: "yes_no", label: "Yes / No", icon: "⚖" },
  { type: "poll", label: "Poll", icon: "📊" },
  { type: "number", label: "Number", icon: "#" },
  { type: "email", label: "Email", icon: "@" },
  { type: "phone", label: "Phone", icon: "📞" },
  { type: "url", label: "Website / URL", icon: "🔗" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "time", label: "Time", icon: "⏰" },
  { type: "datetime", label: "Date and Time", icon: "🗓" },
  { type: "date_range", label: "Date Range", icon: "↔" },
  { type: "file", label: "File Upload", icon: "📎" },
  { type: "image_upload", label: "Image Upload", icon: "🖼" },
  { type: "gallery_upload", label: "Multi-Image Upload", icon: "🗂" },
  { type: "pdf_upload", label: "PDF Upload", icon: "📕" },
  { type: "document_upload", label: "Document Upload", icon: "📃" },
  { type: "camera_capture", label: "Camera Photo", icon: "📷" },
  { type: "geo_photo", label: "Geo-tagged Photo", icon: "📍" },
  { type: "numeric_rating", label: "Linear Scale", icon: "🔟" },
  { type: "star_rating", label: "Rating", icon: "★" },
  { type: "satisfaction_rating", label: "Satisfaction Scale", icon: "😊" },
  { type: "difficulty_rating", label: "Difficulty Scale", icon: "⚡" },
  { type: "custom_scale", label: "Custom Scale", icon: "⚖" },
  { type: "repeatable_group", label: "Repeatable Group", icon: "👥" },
];

const CHOICE_TYPES = ["radio", "checkbox", "dropdown", "poll", "multi_select"];
const BRANCHABLE_TYPES = ["radio", "yes_no", "dropdown", "poll"];
const UPLOAD_TYPES = ["file", "image_upload", "gallery_upload", "pdf_upload", "document_upload", "camera_capture", "geo_photo"];
const RATING_TYPES = ["star_rating", "numeric_rating", "satisfaction_rating", "difficulty_rating", "custom_scale"];

interface GoogleFormsFieldCardProps {
  field: EventFormField;
  allFields: EventFormField[];
  sections: FormSection[];
  theme: Required<FormThemeConfig>;
  isSelected: boolean;
  isDragging: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<EventFormField>) => void;
  onChangeType: (nextType: FormFieldType) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export const GoogleFormsFieldCard: React.FC<GoogleFormsFieldCardProps> = ({
  field,
  allFields,
  sections,
  theme,
  isSelected,
  isDragging,
  canMoveUp,
  canMoveDown,
  onSelect,
  onUpdate,
  onChangeType,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [imgUploadErr, setImgUploadErr] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement | null>(null);
  const authToken = getStoredToken();

  const radiusCls = getRadiusClass(theme.corner_radius);
  const borderCls =
    theme.border_style === "none"
      ? "border-transparent"
      : theme.border_style === "subtle"
      ? "border-slate-200/70 dark:border-[#252525]"
      : "border-slate-200 dark:border-[#2d2d2d]";
  const cardShadowCls =
    theme.card_appearance === "soft"
      ? "bg-white/95 dark:bg-[#191919] shadow-none"
      : theme.card_appearance === "bordered"
      ? "bg-white dark:bg-[#181818] shadow-2xs"
      : "bg-white dark:bg-[#181818] shadow-sm hover:shadow-md";

  const valCfg = field.validation_config || {};
  const blockStyle = valCfg.block_style || {};
  const mediaCfg = valCfg.media_config || {};

  const updateValCfg = (patch: Partial<NonNullable<EventFormField["validation_config"]>>) => {
    onUpdate({
      validation_config: {
        ...valCfg,
        ...patch,
      },
    });
  };

  const hasVisibilityRules = Boolean(
    Array.isArray(field.conditions) ? field.conditions.length > 0 : field.conditions?.rules?.length
  );

  // Common card bottom controls bar
  const renderFooterBar = (showRequiredToggle: boolean, showSettingsBtn: boolean) => (
    <div
      className="pt-3 mt-3 border-t border-slate-100 dark:border-[#262626] flex flex-wrap items-center justify-between gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        {sections.length > 1 && (
          <select
            value={field.section_id || sections[0]?.id}
            onChange={(e) => onUpdate({ section_id: e.target.value })}
            className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] text-slate-600 dark:text-slate-300"
            title="Move block to section"
          >
            {sections.map((s, idx) => (
              <option key={s.id} value={s.id}>
                Sec {idx + 1}: {s.title}
              </option>
            ))}
          </select>
        )}
        {hasVisibilityRules && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
            ⚡ Conditional
          </span>
        )}
        {valCfg.go_to_section_on_answer && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
            ↱ Branching
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 disabled:opacity-25 text-xs cursor-pointer"
          title="Move Up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 disabled:opacity-25 text-xs cursor-pointer"
          title="Move Down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 hover:text-blue-600 text-xs cursor-pointer"
          title="Duplicate"
        >
          📑
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-500 hover:text-rose-600 text-xs cursor-pointer"
          title="Delete"
        >
          🗑
        </button>

        {showRequiredToggle && (
          <>
            <span className="h-5 w-px bg-slate-200 dark:bg-[#333] mx-1" />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
              <span>Required</span>
              <input
                type="checkbox"
                checked={Boolean(field.required)}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
              />
            </label>
          </>
        )}

        {showSettingsBtn && (
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`ml-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
              showAdvanced
                ? "bg-slate-900 dark:bg-[#5DD62C] text-white dark:text-black border-transparent"
                : "border-slate-200 dark:border-[#333] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#222]"
            }`}
            title="Validation, Help Text, Branching & Visibility Logic"
          >
            ⚙ Settings {showAdvanced ? "▴" : "▾"}
          </button>
        )}
      </div>
    </div>
  );

  // =========================================================================
  // 1. TITLE BLOCK (Standalone Title + Subtitle + Typography Customization)
  // =========================================================================
  const isTitleBlock = field.field_type === "title_block" || field.field_type === "heading" || field.field_type === "subheading";
  const isTextDescBlock = field.field_type === "description" || field.field_type === "rich_text_block" || field.field_type === "info_card" || field.field_type === "info" || field.field_type === "notice";
  const isImageBlock = field.field_type === "image_block";
  const isVideoBlock = field.field_type === "video_block";
  const isDivider = field.field_type === "divider";

  const alignClass =
    blockStyle.alignment === "center"
      ? "text-center"
      : blockStyle.alignment === "right"
      ? "text-right"
      : "text-left";

  const handleImageFileUpload = async (file: File) => {
    setUploadingImg(true);
    setImgUploadErr(null);
    try {
      const res = await eventsApi.uploadEventFile(file, { uploadScope: "event_media" });
      const url = res.file_url || res.storage_reference;
      updateValCfg({
        media_config: {
          ...mediaCfg,
          image_url: url,
          drive_file_id: res.drive_file_id,
        },
      });
      onUpdate({ default_value: url });
    } catch (err: unknown) {
      setImgUploadErr(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingImg(false);
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      style={isSelected ? { borderLeftColor: theme.theme_color } : undefined}
      className={`group relative border p-4 sm:p-5 transition-all ${radiusCls} ${borderCls} ${cardShadowCls} ${
        isDragging ? "opacity-40 scale-[0.99]" : ""
      } ${isSelected ? "border-l-[6px] ring-1 ring-black/5 dark:ring-white/10" : "cursor-pointer"}`}
    >
      {/* Top Drag Grip Handle (Google Forms Style) */}
      <div className="flex justify-center -mt-2 mb-2">
        <span
          className="px-3 py-0.5 rounded-full text-slate-300 dark:text-slate-600 group-hover:text-slate-500 cursor-grab active:cursor-grabbing text-xs select-none tracking-widest"
          title="Drag block to reorder"
        >
          ⋮⋮
        </span>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* BLOCK A: TITLE BLOCK                                                */}
      {/* ------------------------------------------------------------------- */}
      {isTitleBlock && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#252525] text-slate-500">
              Title Block
            </span>
            {isSelected && (
              <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <select
                  value={blockStyle.alignment || "left"}
                  onChange={(e) => updateValCfg({ block_style: { ...blockStyle, alignment: e.target.value as ContentBlockStyle["alignment"] } })}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                >
                  <option value="left">Align Left</option>
                  <option value="center">Align Center</option>
                  <option value="right">Align Right</option>
                </select>
                <select
                  value={blockStyle.font_size || (field.field_type === "subheading" ? "md" : "xl")}
                  onChange={(e) => updateValCfg({ block_style: { ...blockStyle, font_size: e.target.value as ContentBlockStyle["font_size"] } })}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">XL</option>
                  <option value="2xl">2XL</option>
                </select>
                <select
                  value={blockStyle.font_weight || "bold"}
                  onChange={(e) => updateValCfg({ block_style: { ...blockStyle, font_weight: e.target.value as ContentBlockStyle["font_weight"] } })}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                >
                  <option value="medium">Medium</option>
                  <option value="semibold">Semibold</option>
                  <option value="bold">Bold</option>
                  <option value="extrabold">Extra Bold</option>
                </select>
                <input
                  type="color"
                  value={blockStyle.text_color || "#0f172a"}
                  onChange={(e) => updateValCfg({ block_style: { ...blockStyle, text_color: e.target.value } })}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Title text color"
                />
              </div>
            )}
          </div>

          <input
            type="text"
            value={field.label}
            placeholder="Title text..."
            onChange={(e) => onUpdate({ label: e.target.value })}
            style={blockStyle.text_color ? { color: blockStyle.text_color } : undefined}
            className={`w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-1 text-slate-900 dark:text-[#F5F5F5] ${alignClass} ${
              blockStyle.font_size === "2xl"
                ? "text-2xl"
                : blockStyle.font_size === "xl"
                ? "text-xl"
                : blockStyle.font_size === "lg"
                ? "text-lg"
                : blockStyle.font_size === "sm"
                ? "text-sm"
                : "text-base"
            } ${
              blockStyle.font_weight === "extrabold"
                ? "font-extrabold"
                : blockStyle.font_weight === "semibold"
                ? "font-semibold"
                : blockStyle.font_weight === "medium"
                ? "font-medium"
                : "font-bold"
            }`}
          />
          <input
            type="text"
            value={blockStyle.subtitle ?? field.description ?? ""}
            placeholder="Optional subtitle..."
            onChange={(e) => {
              onUpdate({ description: e.target.value });
              updateValCfg({ block_style: { ...blockStyle, subtitle: e.target.value } });
            }}
            className={`w-full text-xs text-slate-500 dark:text-[#A3A3A3] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-0.5 ${alignClass}`}
          />
          {renderFooterBar(false, false)}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* BLOCK B: DESCRIPTION / RICH TEXT BLOCK                              */}
      {/* ------------------------------------------------------------------- */}
      {isTextDescBlock && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              {blockStyle.variant === "instructions"
                ? "Instructions Block"
                : blockStyle.variant === "note"
                ? "Note Block"
                : blockStyle.variant === "announcement"
                ? "Announcement Block"
                : "Description / Text Block"}
            </span>
          </div>
          <input
            type="text"
            value={field.label}
            placeholder="Section note or instructions heading..."
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full text-sm font-bold text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-0.5"
          />
          <RichTextBlockEditor
            htmlValue={valCfg.rich_html || ""}
            plainFallback={field.description || ""}
            styleConfig={blockStyle}
            isSelected={isSelected}
            onChangeHtml={(html, plainText) => {
              onUpdate({ description: plainText });
              updateValCfg({ rich_html: html });
            }}
            onChangeStyle={(patch) =>
              updateValCfg({ block_style: { ...blockStyle, ...patch } })
            }
          />
          {renderFooterBar(false, false)}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* BLOCK C: DIVIDER                                                    */}
      {/* ------------------------------------------------------------------- */}
      {isDivider && (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Divider</span>
          <hr className="border-slate-200 dark:border-[#333]" />
          {renderFooterBar(false, false)}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* BLOCK D: IMAGE BLOCK                                                */}
      {/* ------------------------------------------------------------------- */}
      {isImageBlock && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
              Image Block
            </span>
            {isSelected && (
              <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <select
                  value={mediaCfg.alignment || "center"}
                  onChange={(e) => updateValCfg({ media_config: { ...mediaCfg, alignment: e.target.value as MediaBlockConfig["alignment"] } })}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                >
                  <option value="left">Left Align</option>
                  <option value="center">Center Align</option>
                  <option value="right">Right Align</option>
                </select>
                <select
                  value={mediaCfg.width_percent || 100}
                  onChange={(e) => updateValCfg({ media_config: { ...mediaCfg, width_percent: Number(e.target.value) } })}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                >
                  <option value={40}>Small (40%)</option>
                  <option value={65}>Medium (65%)</option>
                  <option value={85}>Large (85%)</option>
                  <option value={100}>Full Width (100%)</option>
                </select>
              </div>
            )}
          </div>

          <input
            type="text"
            value={field.label}
            placeholder="Image title (optional)..."
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full text-sm font-bold text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-0.5"
          />

          {(() => {
            const rawImg = mediaCfg.image_url || field.default_value || field.placeholder || "";
            const imgSrc = rawImg
              ? resolveEventAssetUrl(normalizeGoogleDriveImageUrl(rawImg), authToken)
              : "";
            const alignFlex =
              mediaCfg.alignment === "left"
                ? "justify-start"
                : mediaCfg.alignment === "right"
                ? "justify-end"
                : "justify-center";
            return imgSrc ? (
              <div className={`flex ${alignFlex}`}>
                <div
                  className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-[#2d2d2d]"
                  style={{ width: `${mediaCfg.width_percent || 100}%` }}
                >
                  <img src={imgSrc} alt={mediaCfg.caption || field.label} className="w-full h-auto max-h-96 object-contain bg-slate-50 dark:bg-[#141414]" />
                  {isSelected && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateValCfg({ media_config: { ...mediaCfg, image_url: "", drive_file_id: undefined } });
                        onUpdate({ default_value: "" });
                      }}
                      className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 text-white text-[10px] font-semibold cursor-pointer"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-[#2d2d2d] text-center space-y-2">
                <p className="text-xs text-slate-500">Upload an image or paste a Google Drive / web image link below</p>
              </div>
            );
          })()}

          {isSelected && (
            <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={imgInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFileUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  disabled={uploadingImg}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {uploadingImg ? "Uploading..." : "Upload Image"}
                </button>
                <input
                  type="url"
                  value={mediaCfg.image_url || field.default_value || ""}
                  placeholder="Or paste Google Drive / HTTPS image URL..."
                  onChange={(e) => {
                    updateValCfg({ media_config: { ...mediaCfg, image_url: e.target.value } });
                    onUpdate({ default_value: e.target.value });
                  }}
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414]"
                />
              </div>
              {imgUploadErr && <p className="text-[11px] text-rose-500 font-semibold">{imgUploadErr}</p>}
              <input
                type="text"
                value={mediaCfg.caption ?? field.description ?? ""}
                placeholder="Image caption (optional)..."
                onChange={(e) => {
                  updateValCfg({ media_config: { ...mediaCfg, caption: e.target.value } });
                  onUpdate({ description: e.target.value });
                }}
                className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414]"
              />
            </div>
          )}

          {!isSelected && (mediaCfg.caption || field.description) && (
            <p className="text-xs text-slate-500 text-center italic">{mediaCfg.caption || field.description}</p>
          )}
          {renderFooterBar(false, false)}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* BLOCK E: VIDEO BLOCK                                                */}
      {/* ------------------------------------------------------------------- */}
      {isVideoBlock && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300">
              Video Block (YouTube / Vimeo / Drive)
            </span>
          </div>
          <input
            type="text"
            value={field.label}
            placeholder="Video title..."
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="w-full text-sm font-bold text-slate-900 dark:text-[#F5F5F5] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-0.5"
          />

          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="url"
              value={mediaCfg.video_url || field.default_value || ""}
              placeholder="Paste YouTube, Vimeo, or Google Drive video URL..."
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw.trim() ? parseVideoEmbedUrl(raw) : { valid: false };
                updateValCfg({
                  media_config: {
                    ...mediaCfg,
                    video_url: raw,
                    embed_url: parsed.valid ? parsed.embedUrl : undefined,
                  },
                });
                onUpdate({ default_value: parsed.valid ? parsed.embedUrl : raw });
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414]"
            />

            {(() => {
              const raw = mediaCfg.video_url || field.default_value || "";
              if (!raw.trim()) {
                return (
                  <p className="text-[11px] text-slate-400">
                    Supported: YouTube (youtube.com / youtu.be), Vimeo, or Google Drive video share URLs.
                  </p>
                );
              }
              const parsed = parseVideoEmbedUrl(raw);
              if (!parsed.valid) {
                return <p className="text-[11px] font-semibold text-rose-500">⚠️ {parsed.error}</p>;
              }
              return (
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 dark:border-[#2d2d2d] bg-black">
                  <iframe
                    src={parsed.embedUrl}
                    title={field.label || "Embedded Video"}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            })()}

            <input
              type="text"
              value={mediaCfg.video_description ?? field.description ?? ""}
              placeholder="Video description or instructions (optional)..."
              onChange={(e) => {
                updateValCfg({ media_config: { ...mediaCfg, video_description: e.target.value } });
                onUpdate({ description: e.target.value });
              }}
              className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414]"
            />
          </div>
          {renderFooterBar(false, false)}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* BLOCK F: QUESTION BLOCK (All 17+ Question Types + Inline Editing)   */}
      {/* ------------------------------------------------------------------- */}
      {!isTitleBlock && !isTextDescBlock && !isDivider && !isImageBlock && !isVideoBlock && (
        <div className="space-y-3">
          {/* Header Row: Inline Question Title + Question Type Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <input
              type="text"
              value={field.label}
              placeholder="Question title..."
              onChange={(e) => onUpdate({ label: e.target.value })}
              className="flex-1 text-sm font-semibold text-slate-900 dark:text-[#F5F5F5] bg-slate-50/70 dark:bg-[#141414] px-3 py-2 rounded-xl border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-[#121212] focus:outline-hidden"
            />
            <select
              value={field.field_type}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onChangeType(e.target.value as FormFieldType)}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414] text-slate-800 dark:text-[#F5F5F5] cursor-pointer"
            >
              {QUESTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.type} value={opt.type}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Inline Optional Question Description / Help Text */}
          {(isSelected || field.description) && (
            <input
              type="text"
              value={field.description || ""}
              placeholder="Question description / instructions (optional)..."
              onChange={(e) => onUpdate({ description: e.target.value })}
              className="w-full text-xs text-slate-500 dark:text-[#A3A3A3] bg-transparent border-b border-transparent hover:border-slate-200 focus:border-blue-500 focus:outline-hidden pb-0.5"
            />
          )}

          {/* CHOICE & POLL INLINE OPTIONS EDITOR */}
          {CHOICE_TYPES.includes(field.field_type) && (
            <div className="space-y-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
              {(field.options_config || []).map((opt, oIdx) => {
                const isCheck = field.field_type === "checkbox" || field.field_type === "multi_select" || (field.field_type === "poll" && valCfg.poll_allow_multiple);
                const optionRouteTarget = valCfg.option_routes?.[opt.value] || "__next__";
                return (
                  <div key={oIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <span className="text-slate-400 text-xs w-4 text-center shrink-0">
                      {field.field_type === "dropdown" ? `${oIdx + 1}.` : isCheck ? "☐" : "○"}
                    </span>
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const updated = [...(field.options_config || [])];
                        const oldVal = updated[oIdx].value;
                        const nextVal = e.target.value.toLowerCase().replace(/\s+/g, "_") || `option_${oIdx + 1}`;
                        updated[oIdx] = { label: e.target.value, value: nextVal };
                        const nextRoutes = { ...(valCfg.option_routes || {}) };
                        if (oldVal !== nextVal && nextRoutes[oldVal]) {
                          nextRoutes[nextVal] = nextRoutes[oldVal];
                          delete nextRoutes[oldVal];
                        }
                        onUpdate({
                          options_config: updated,
                          validation_config: { ...valCfg, option_routes: nextRoutes },
                        });
                      }}
                      className="flex-1 min-w-[140px] text-xs px-2.5 py-1.5 rounded-lg border border-transparent hover:border-slate-200 focus:border-blue-500 bg-slate-50/60 dark:bg-[#141414] focus:outline-hidden"
                    />
                    {valCfg.go_to_section_on_answer && BRANCHABLE_TYPES.includes(field.field_type) && (
                      <select
                        value={optionRouteTarget}
                        onChange={(e) =>
                          updateValCfg({
                            option_routes: { ...(valCfg.option_routes || {}), [opt.value]: e.target.value },
                          })
                        }
                        className="text-[11px] px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200"
                      >
                        <option value="__next__">Continue to next section</option>
                        {sections.map((s, sIdx) => (
                          <option key={s.id} value={s.id} disabled={s.id === (field.section_id || sections[0]?.id)}>
                            Go to Sec {sIdx + 1}: {s.title}
                          </option>
                        ))}
                        <option value="__submit__">Submit form</option>
                      </select>
                    )}
                    {isSelected && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={oIdx === 0}
                          onClick={() => {
                            const cur = [...(field.options_config || [])];
                            [cur[oIdx - 1], cur[oIdx]] = [cur[oIdx], cur[oIdx - 1]];
                            onUpdate({ options_config: cur });
                          }}
                          className="p-1 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={oIdx === (field.options_config || []).length - 1}
                          onClick={() => {
                            const cur = [...(field.options_config || [])];
                            [cur[oIdx + 1], cur[oIdx]] = [cur[oIdx], cur[oIdx + 1]];
                            onUpdate({ options_config: cur });
                          }}
                          className="p-1 text-[10px] text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (field.options_config || []).filter((_, i) => i !== oIdx);
                            onUpdate({ options_config: updated });
                          }}
                          className="p-1 text-xs text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {valCfg.allow_other && (
                <div className="flex items-center gap-2 text-xs text-slate-500 pl-6">
                  <span>Other... (student custom input)</span>
                  {valCfg.go_to_section_on_answer && BRANCHABLE_TYPES.includes(field.field_type) && (
                    <select
                      value={valCfg.option_routes?.__other__ || "__next__"}
                      onChange={(e) =>
                        updateValCfg({
                          option_routes: { ...(valCfg.option_routes || {}), __other__: e.target.value },
                        })
                      }
                      className="text-[11px] px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30"
                    >
                      <option value="__next__">Continue to next section</option>
                      {sections.map((s, sIdx) => (
                        <option key={s.id} value={s.id} disabled={s.id === (field.section_id || sections[0]?.id)}>
                          Go to Sec {sIdx + 1}: {s.title}
                        </option>
                      ))}
                      <option value="__submit__">Submit form</option>
                    </select>
                  )}
                </div>
              )}

              {isSelected && (
                <div className="flex flex-wrap items-center gap-3 pt-1 pl-6 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = field.options_config || [];
                      const n = cur.length + 1;
                      onUpdate({
                        options_config: [...cur, { label: `Option ${n}`, value: `option_${n}` }],
                      });
                    }}
                    className="font-semibold text-blue-600 dark:text-[#5DD62C] hover:underline cursor-pointer"
                  >
                    + Add option
                  </button>
                  {["radio", "checkbox", "multi_select", "poll"].includes(field.field_type) && (
                    <button
                      type="button"
                      onClick={() => updateValCfg({ allow_other: !valCfg.allow_other })}
                      className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold cursor-pointer"
                    >
                      {valCfg.allow_other ? '✓ "Other" included' : '+ Add "Other"'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* YES / NO PREVIEW & DIRECT BRANCHING */}
          {field.field_type === "yes_no" && (
            <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
              {[
                { label: "Yes", value: "yes" },
                { label: "No", value: "no" },
              ].map((yn) => (
                <div key={yn.value} className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/60 dark:bg-[#141414] text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{yn.value === "yes" ? "✓ Yes" : "✕ No"}</span>
                  {valCfg.go_to_section_on_answer && (
                    <select
                      value={valCfg.option_routes?.[yn.value] || "__next__"}
                      onChange={(e) =>
                        updateValCfg({
                          option_routes: { ...(valCfg.option_routes || {}), [yn.value]: e.target.value },
                        })
                      }
                      className="text-[11px] px-2 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-[#181818]"
                    >
                      <option value="__next__">Continue to next section</option>
                      {sections.map((s, sIdx) => (
                        <option key={s.id} value={s.id} disabled={s.id === (field.section_id || sections[0]?.id)}>
                          Go to Section {sIdx + 1}: {s.title}
                        </option>
                      ))}
                      <option value="__submit__">Submit form</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* RATING / LINEAR SCALE PREVIEW */}
          {RATING_TYPES.includes(field.field_type) && (
            <div className="p-3 rounded-xl border border-slate-200/80 dark:border-[#2d2d2d] bg-slate-50/50 dark:bg-[#141414] space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <label className="block text-slate-400">Min Value</label>
                  <input
                    type="number"
                    value={field.rating_config?.min_rating ?? (field.field_type === "numeric_rating" ? 1 : 1)}
                    onChange={(e) => onUpdate({ rating_config: { ...field.rating_config, min_rating: Number(e.target.value) } })}
                    className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Max Value</label>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={field.rating_config?.max_rating ?? 5}
                    onChange={(e) => onUpdate({ rating_config: { ...field.rating_config, max_rating: Number(e.target.value) } })}
                    className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Min Label</label>
                  <input
                    type="text"
                    value={field.rating_config?.min_label || ""}
                    placeholder="Poor"
                    onChange={(e) => onUpdate({ rating_config: { ...field.rating_config, min_label: e.target.value } })}
                    className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                  />
                </div>
                <div>
                  <label className="block text-slate-400">Max Label</label>
                  <input
                    type="text"
                    value={field.rating_config?.max_label || ""}
                    placeholder="Excellent"
                    onChange={(e) => onUpdate({ rating_config: { ...field.rating_config, max_label: e.target.value } })}
                    className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* FILE UPLOAD PREVIEW & INLINE RULES */}
          {UPLOAD_TYPES.includes(field.field_type) && (
            <div className="p-3 rounded-xl border border-dashed border-slate-300 dark:border-[#333] bg-slate-50/40 dark:bg-[#141414] space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between text-slate-500">
                <span>📎 Student file upload to Google Drive (&lt;Student&gt;/Events/&lt;Event&gt;)</span>
                <span className="font-mono text-[10px]">
                  Max {valCfg.max_size_mb ?? 10} MB • {valCfg.max_files ?? 1} file(s)
                </span>
              </div>
              {isSelected && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-400">Allowed Extensions</label>
                    <input
                      type="text"
                      value={(valCfg.allowed_types || []).join(", ")}
                      placeholder="pdf, jpg, png, doc, docx"
                      onChange={(e) => updateValCfg({ allowed_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      className="w-full text-xs px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Max Size (MB, ≤15)</label>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={valCfg.max_size_mb ?? 10}
                      onChange={(e) => updateValCfg({ max_size_mb: e.target.value ? Math.min(15, Number(e.target.value)) : 10 })}
                      className="w-full text-xs px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Max Files</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={valCfg.max_files ?? 1}
                      onChange={(e) => {
                        const n = e.target.value ? Math.max(1, Math.min(10, Number(e.target.value))) : 1;
                        updateValCfg({ max_files: n, allow_multiple_files: n > 1 });
                      }}
                      className="w-full text-xs px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STANDARD INPUT PREVIEW PLACEHOLDER */}
          {!CHOICE_TYPES.includes(field.field_type) &&
            field.field_type !== "yes_no" &&
            !RATING_TYPES.includes(field.field_type) &&
            !UPLOAD_TYPES.includes(field.field_type) &&
            field.field_type !== "repeatable_group" && (
              <div className="px-3 py-2 rounded-xl border border-dashed border-slate-200 dark:border-[#2d2d2d] text-xs text-slate-400 bg-slate-50/40 dark:bg-[#141414]">
                {field.placeholder || `${QUESTION_TYPE_OPTIONS.find((q) => q.type === field.field_type)?.label || field.field_type} answer...`}
              </div>
            )}

          {/* EXPANDABLE MORE SETTINGS DRAWER (Validation, Poll, Branching & Visibility Logic) */}
          {showAdvanced && (
            <div
              className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/80 dark:bg-[#141414] space-y-3 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Placeholder, Help Text, Default Value */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder || ""}
                    onChange={(e) => onUpdate({ placeholder: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">Help Text</label>
                  <input
                    type="text"
                    value={field.help_text ?? valCfg.help_text ?? ""}
                    onChange={(e) => {
                      onUpdate({ help_text: e.target.value });
                      updateValCfg({ help_text: e.target.value });
                    }}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500">Default Answer</label>
                  <input
                    type="text"
                    value={typeof field.default_value === "string" || typeof field.default_value === "number" ? String(field.default_value) : ""}
                    onChange={(e) => onUpdate({ default_value: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                  />
                </div>
              </div>

              {/* Branching toggle for Radio / Yes-No / Dropdown / Poll */}
              {BRANCHABLE_TYPES.includes(field.field_type) && !(field.field_type === "poll" && valCfg.poll_allow_multiple) && (
                <div className="p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-indigo-900 dark:text-indigo-200">Go to section based on answer</p>
                    <p className="text-[10px] text-indigo-700/70 dark:text-indigo-300/70">
                      Turn on to route each answer to a specific section or Submit form above.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(valCfg.go_to_section_on_answer)}
                    onChange={(e) => updateValCfg({ go_to_section_on_answer: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 cursor-pointer"
                  />
                </div>
              )}

              {/* Poll Options */}
              {field.field_type === "poll" && (
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818] space-y-2">
                  <span className="font-bold block">Poll Privacy &amp; Selection Settings</span>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(valCfg.show_poll_results)}
                        onChange={(e) => updateValCfg({ show_poll_results: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Allow students to see anonymized poll results</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(valCfg.poll_allow_multiple)}
                        onChange={(e) => updateValCfg({ poll_allow_multiple: e.target.checked })}
                        className="rounded text-blue-600"
                      />
                      <span>Allow multiple selections</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Checkbox / Multi-select Min & Max */}
              {(field.field_type === "checkbox" || field.field_type === "multi_select" || (field.field_type === "poll" && valCfg.poll_allow_multiple)) && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">Min Selections</label>
                    <input
                      type="number"
                      min={0}
                      value={valCfg.min_selections ?? ""}
                      onChange={(e) => updateValCfg({ min_selections: e.target.value !== "" ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Max Selections</label>
                    <input
                      type="number"
                      min={1}
                      value={valCfg.max_selections ?? ""}
                      onChange={(e) => updateValCfg({ max_selections: e.target.value !== "" ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                </div>
              )}

              {/* Text & Number & Date/Time Validation */}
              {["text", "textarea", "rich_text"].includes(field.field_type) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">Min Chars</label>
                    <input
                      type="number"
                      min={0}
                      value={valCfg.min_len ?? ""}
                      onChange={(e) => updateValCfg({ min_len: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Max Chars</label>
                    <input
                      type="number"
                      min={1}
                      value={valCfg.max_len ?? ""}
                      onChange={(e) => updateValCfg({ max_len: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Regex Pattern</label>
                    <input
                      type="text"
                      value={valCfg.regex_pattern || ""}
                      placeholder="e.g. ^[A-Z0-9]+$"
                      onChange={(e) => updateValCfg({ regex_pattern: e.target.value || undefined })}
                      className="w-full font-mono px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Custom Error</label>
                    <input
                      type="text"
                      value={valCfg.custom_error || ""}
                      onChange={(e) => updateValCfg({ custom_error: e.target.value || undefined })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                </div>
              )}

              {field.field_type === "number" && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500">Number Format</label>
                    <select
                      value={valCfg.number_mode || "decimal"}
                      onChange={(e) => updateValCfg({ number_mode: e.target.value as FormFieldValidationConfig["number_mode"] })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    >
                      <option value="decimal">Decimal / Any</option>
                      <option value="integer">Integer Only</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Min Value</label>
                    <input
                      type="number"
                      step="any"
                      value={valCfg.min_val ?? ""}
                      onChange={(e) => updateValCfg({ min_val: e.target.value !== "" ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500">Max Value</label>
                    <input
                      type="number"
                      step="any"
                      value={valCfg.max_val ?? ""}
                      onChange={(e) => updateValCfg({ max_val: e.target.value !== "" ? Number(e.target.value) : undefined })}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818]"
                    />
                  </div>
                </div>
              )}

              {/* Conditional Question Visibility Rules */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#2d2d2d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-[#F5F5F5]">⚡ Conditional Question Visibility</span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur: ConditionalRule[] = Array.isArray(field.conditions)
                        ? field.conditions
                        : field.conditions?.rules || [];
                      const curLogic = !Array.isArray(field.conditions) && field.conditions?.logic === "or" ? "or" : "and";
                      const candidates = allFields.filter((f) => f.id !== field.id && !["divider", "page_break", "image_block", "video_block"].includes(f.field_type));
                      if (candidates.length === 0) return;
                      onUpdate({
                        conditions: {
                          logic: curLogic,
                          rules: [...cur, { field: candidates[0].field_key, operator: "equals", value: "yes", action: "show" }],
                        },
                      });
                    }}
                    className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 cursor-pointer"
                  >
                    + Add Visibility Rule
                  </button>
                </div>

                {(() => {
                  const rules: ConditionalRule[] = Array.isArray(field.conditions)
                    ? field.conditions
                    : field.conditions?.rules || [];
                  const logicMode: "and" | "or" = !Array.isArray(field.conditions) && field.conditions?.logic === "or" ? "or" : "and";
                  const commit = (nextRules: ConditionalRule[], nextLogic = logicMode) =>
                    onUpdate({ conditions: nextRules.length ? { logic: nextLogic, rules: nextRules } : undefined });

                  if (rules.length === 0) {
                    return <p className="text-[10px] text-slate-400 italic">Always visible unless a rule is added.</p>;
                  }

                  return (
                    <div className="space-y-1.5">
                      {rules.map((r, rIdx) => (
                        <div key={rIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center bg-white dark:bg-[#181818] p-1.5 rounded-lg border border-slate-200 dark:border-[#2d2d2d]">
                          <select
                            value={r.action || "show"}
                            onChange={(e) => {
                              const next = [...rules];
                              next[rIdx] = { ...next[rIdx], action: e.target.value as ConditionalRule["action"] };
                              commit(next);
                            }}
                            className="sm:col-span-2 text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                          >
                            <option value="show">Show If</option>
                            <option value="hide">Hide If</option>
                          </select>
                          <select
                            value={r.field}
                            onChange={(e) => {
                              const next = [...rules];
                              next[rIdx] = { ...next[rIdx], field: e.target.value };
                              commit(next);
                            }}
                            className="sm:col-span-4 text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                          >
                            {allFields
                              .filter((f) => f.id !== field.id)
                              .map((f) => (
                                <option key={f.field_key} value={f.field_key}>{f.label}</option>
                              ))}
                          </select>
                          <select
                            value={r.operator}
                            onChange={(e) => {
                              const next = [...rules];
                              next[rIdx] = { ...next[rIdx], operator: e.target.value as ConditionalRule["operator"] };
                              commit(next);
                            }}
                            className="sm:col-span-3 text-[11px] px-1.5 py-1 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                          >
                            <option value="equals">equals</option>
                            <option value="not_equals">not equals</option>
                            <option value="contains">contains</option>
                            <option value="not_contains">does not contain</option>
                            <option value="is_not_empty">is answered</option>
                            <option value="is_empty">not answered</option>
                          </select>
                          <div className="sm:col-span-3 flex items-center gap-1">
                            {!["is_empty", "is_not_empty"].includes(r.operator) && (
                              <input
                                type="text"
                                value={r.value || ""}
                                placeholder="Value..."
                                onChange={(e) => {
                                  const next = [...rules];
                                  next[rIdx] = { ...next[rIdx], value: e.target.value };
                                  commit(next);
                                }}
                                className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#141414]"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => commit(rules.filter((_, i) => i !== rIdx))}
                              className="text-slate-400 hover:text-rose-500 px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {renderFooterBar(true, true)}
        </div>
      )}
    </div>
  );
};
