"use client";

import React, { useState, useRef } from "react";
import { FormSettings, FormThemeConfig } from "@/types/events";
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";
import { DEFAULT_FORM_THEME } from "@/lib/form-utils";

interface FormThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  formSettings: FormSettings;
  onChangeSettings: (next: FormSettings) => void;
  eventTitle: string;
}

const THEME_SWATCHES = [
  { label: "Google Purple", theme: "#673ab7", bg: "#f0ebf8" },
  { label: "Royal Blue", theme: "#2563eb", bg: "#eff6ff" },
  { label: "Indigo", theme: "#4f46e5", bg: "#eef2ff" },
  { label: "Emerald", theme: "#10b981", bg: "#ecfdf5" },
  { label: "Teal", theme: "#0d9488", bg: "#f0fdfa" },
  { label: "Crimson", theme: "#e11d48", bg: "#fff1f2" },
  { label: "Amber", theme: "#d97706", bg: "#fffbeb" },
  { label: "Slate Dark", theme: "#1e293b", bg: "#f1f5f9" },
];

export const FormThemeCustomizer: React.FC<FormThemeCustomizerProps> = ({
  isOpen,
  onClose,
  formSettings,
  onChangeSettings,
  eventTitle,
}) => {
  const [tab, setTab] = useState<"theme" | "settings">("theme");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const authToken = getStoredToken();

  if (!isOpen) return null;

  const theme: Required<FormThemeConfig> = {
    ...DEFAULT_FORM_THEME,
    ...(formSettings.theme || {}),
  };

  const updateTheme = (patch: Partial<FormThemeConfig>) => {
    onChangeSettings({
      ...formSettings,
      theme: {
        ...theme,
        ...patch,
      },
    });
  };

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    setBannerError(null);
    try {
      const res = await eventsApi.uploadEventFile(file, { uploadScope: "event_media" });
      updateTheme({ banner_image_url: res.file_url || res.storage_reference });
    } catch (err: unknown) {
      setBannerError(err instanceof Error ? err.message : "Failed to upload banner image.");
    } finally {
      setUploadingBanner(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white dark:bg-[#181818] border-l border-slate-200 dark:border-[#2d2d2d] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 dark:border-[#282828] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">Customize Form</h3>
          <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">Theme, typography, cards &amp; behavior</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-500 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="p-2 border-b border-slate-100 dark:border-[#282828] flex gap-1 bg-slate-50 dark:bg-[#141414]">
        <button
          type="button"
          onClick={() => setTab("theme")}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tab === "theme"
              ? "bg-white dark:bg-[#222] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          🎨 Design &amp; Theme
        </button>
        <button
          type="button"
          onClick={() => setTab("settings")}
          className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tab === "settings"
              ? "bg-white dark:bg-[#222] text-blue-600 dark:text-[#5DD62C] shadow-2xs"
              : "text-slate-600 dark:text-slate-400"
          }`}
        >
          ⚙ Form Settings
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {tab === "theme" ? (
          <>
            {/* Theme Color Swatches */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 dark:text-[#F5F5F5] block">Color Palette Presets</span>
              <div className="grid grid-cols-4 gap-2">
                {THEME_SWATCHES.map((sw) => {
                  const active = theme.theme_color.toLowerCase() === sw.theme.toLowerCase();
                  return (
                    <button
                      key={sw.label}
                      type="button"
                      onClick={() => updateTheme({ theme_color: sw.theme, background_color: sw.bg })}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                        active ? "border-slate-900 dark:border-white ring-1 ring-slate-900/20" : "border-slate-200 dark:border-[#2d2d2d]"
                      }`}
                      title={sw.label}
                    >
                      <span
                        className="block w-6 h-6 rounded-full mx-auto shadow-xs border border-black/10"
                        style={{ backgroundColor: sw.theme }}
                      />
                      <span className="block text-[9px] font-semibold text-slate-600 dark:text-slate-300 mt-1 truncate">
                        {sw.label.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Theme Accent</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={theme.theme_color}
                      onChange={(e) => updateTheme({ theme_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={theme.theme_color}
                      onChange={(e) => updateTheme({ theme_color: e.target.value })}
                      className="flex-1 text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#121212]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">Background Color</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={theme.background_color}
                      onChange={(e) => updateTheme({ background_color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={theme.background_color}
                      onChange={(e) => updateTheme({ background_color: e.target.value })}
                      className="flex-1 text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#121212]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Header / Banner Image */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#282828]">
              <span className="font-bold text-slate-800 dark:text-[#F5F5F5] block">Header / Banner Image</span>
              {theme.banner_image_url && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-[#2d2d2d]">
                  <img
                    src={resolveEventAssetUrl(theme.banner_image_url, authToken)}
                    alt="Header banner preview"
                    className="w-full h-24 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => updateTheme({ banner_image_url: "" })}
                    className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-lg bg-black/70 text-white text-[10px] font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBannerUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] bg-slate-50 dark:bg-[#222] text-xs font-semibold hover:bg-slate-100 cursor-pointer disabled:opacity-50"
                >
                  {uploadingBanner ? "Uploading..." : "Upload Banner"}
                </button>
                <input
                  type="text"
                  value={theme.banner_image_url}
                  placeholder="Or paste image URL..."
                  onChange={(e) => updateTheme({ banner_image_url: e.target.value })}
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                />
              </div>
              {bannerError && <p className="text-[11px] text-rose-500 font-semibold">{bannerError}</p>}
            </div>

            {/* Typography */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-[#282828]">
              <span className="font-bold text-slate-800 dark:text-[#F5F5F5] block">Typography</span>
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Font Family</label>
                <select
                  value={theme.font_family}
                  onChange={(e) => updateTheme({ font_family: e.target.value as FormThemeConfig["font_family"] })}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                >
                  <option value="sans">Modern Sans (System / Inter)</option>
                  <option value="serif">Formal Serif (Georgia)</option>
                  <option value="display">Playful Geometric (Display)</option>
                  <option value="mono">Technical Monospace</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Heading Size</label>
                  <select
                    value={theme.heading_font_size}
                    onChange={(e) => updateTheme({ heading_font_size: e.target.value as FormThemeConfig["heading_font_size"] })}
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                  >
                    <option value="sm">Small</option>
                    <option value="md">Medium</option>
                    <option value="lg">Large</option>
                    <option value="xl">Extra Large</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Body Size</label>
                  <select
                    value={theme.body_font_size}
                    onChange={(e) => updateTheme({ body_font_size: e.target.value as FormThemeConfig["body_font_size"] })}
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                  >
                    <option value="sm">Compact</option>
                    <option value="md">Standard</option>
                    <option value="lg">Comfortable</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card, Border & Button Styling */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-[#282828]">
              <span className="font-bold text-slate-800 dark:text-[#F5F5F5] block">Cards, Alignment &amp; Buttons</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Card Appearance</label>
                  <select
                    value={theme.card_appearance}
                    onChange={(e) => updateTheme({ card_appearance: e.target.value as FormThemeConfig["card_appearance"] })}
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                  >
                    <option value="elevated">Elevated Shadow</option>
                    <option value="bordered">Clean Bordered</option>
                    <option value="soft">Soft Minimal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Border Style</label>
                  <select
                    value={theme.border_style}
                    onChange={(e) => updateTheme({ border_style: e.target.value as FormThemeConfig["border_style"] })}
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                  >
                    <option value="solid">Solid Outline</option>
                    <option value="subtle">Subtle Hairline</option>
                    <option value="none">Borderless</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Corner Radius</label>
                  <select
                    value={theme.corner_radius}
                    onChange={(e) => updateTheme({ corner_radius: e.target.value as FormThemeConfig["corner_radius"] })}
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                  >
                    <option value="none">Sharp</option>
                    <option value="md">Classic Rounded</option>
                    <option value="xl">Modern Rounded</option>
                    <option value="2xl">Pill Cards</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Button Style</label>
                  <select
                    value={theme.button_style}
                    onChange={(e) => updateTheme({ button_style: e.target.value as FormThemeConfig["button_style"] })}
                    className="w-full px-2 py-1.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                  >
                    <option value="solid">Solid Filled</option>
                    <option value="pill">Pill Rounded</option>
                    <option value="outline">Outlined</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-1">Form Header Alignment</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["left", "center"] as const).map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => updateTheme({ content_alignment: al })}
                      className={`py-1.5 rounded-xl border text-xs font-semibold capitalize cursor-pointer ${
                        theme.content_alignment === al
                          ? "border-blue-600 dark:border-[#5DD62C] bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-700 dark:text-[#5DD62C]"
                          : "border-slate-200 dark:border-[#2d2d2d]"
                      }`}
                    >
                      {al} Aligned
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => updateTheme(DEFAULT_FORM_THEME)}
                className="w-full py-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 border border-dashed border-slate-300 dark:border-[#333] rounded-xl cursor-pointer"
              >
                Reset Theme to Default
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Form Title</label>
              <input
                type="text"
                value={formSettings.form_title || ""}
                placeholder={eventTitle}
                onChange={(e) => onChangeSettings({ ...formSettings, form_title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Form Description</label>
              <textarea
                rows={2}
                value={formSettings.form_description || ""}
                placeholder="Brief overview shown at the top of the student registration form..."
                onChange={(e) => onChangeSettings({ ...formSettings, form_description: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Custom Instructions</label>
              <textarea
                rows={2}
                value={formSettings.custom_instructions || ""}
                placeholder="Highlighted participant instructions box..."
                onChange={(e) => onChangeSettings({ ...formSettings, custom_instructions: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Submit Label</label>
                <input
                  type="text"
                  value={formSettings.submit_button_label || ""}
                  placeholder="Submit Registration"
                  onChange={(e) => onChangeSettings({ ...formSettings, submit_button_label: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Capacity</label>
                <input
                  type="number"
                  min={1}
                  value={formSettings.registration_capacity ?? ""}
                  placeholder="Unlimited"
                  onChange={(e) =>
                    onChangeSettings({
                      ...formSettings,
                      registration_capacity: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Success Confirmation Message</label>
              <textarea
                rows={2}
                value={formSettings.success_message || ""}
                placeholder="Thank you! Your registration has been recorded successfully."
                onChange={(e) => onChangeSettings({ ...formSettings, success_message: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Form Submission Deadline Override</label>
              <input
                type="datetime-local"
                value={formSettings.submission_deadline ? String(formSettings.submission_deadline).slice(0, 16) : ""}
                onChange={(e) =>
                  onChangeSettings({
                    ...formSettings,
                    submission_deadline: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#121212]"
              />
            </div>

            <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50 dark:bg-[#141414] space-y-2.5">
              <p className="font-bold text-slate-800 dark:text-[#F5F5F5]">Response &amp; Navigation Controls</p>
              {[
                { key: "allow_multiple_responses" as const, title: "Allow Multiple Responses" },
                { key: "allow_edit_submission" as const, title: "Allow Editing After Submission" },
                { key: "allow_resubmission" as const, title: "Allow Resubmission" },
                { key: "show_progress_indicator" as const, title: "Show Progress Bar", defaultTrue: true },
                { key: "show_section_navigation" as const, title: "Show Section Navigation", defaultTrue: true },
              ].map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.title}</span>
                  <input
                    type="checkbox"
                    checked={item.defaultTrue ? formSettings[item.key] !== false : Boolean(formSettings[item.key])}
                    onChange={(e) => onChangeSettings({ ...formSettings, [item.key]: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 dark:text-[#5DD62C] cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
