"use client";

import React, { useState, useEffect } from "react";
import { EventTemplate } from "@/types/events";
import { eventsApi } from "@/lib/events-api";

interface EventTemplatesLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: EventTemplate) => void;
}

export const EventTemplatesLibraryModal: React.FC<EventTemplatesLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const [templates, setTemplates] = useState<EventTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<EventTemplate | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadTemplates();
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.listTemplates();
      setTemplates(res.templates || []);
    } catch (err: any) {
      setError(err.message || "Failed to load event templates.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const categories = ["all", "Workshop", "Competition", "Exam", "Internship", "Feedback"];

  const filteredTemplates = templates.filter((t) => {
    const matchCat =
      selectedCategory === "all" || t.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchQuery =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.purpose.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#262626] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
                Event &amp; Form Templates Library
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200">
                5 Pro Starters
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
              Choose a starter template to pre-populate sections, questions, and validation rules. Fully customizable before publishing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-slate-100 dark:border-[#262626] bg-slate-50/50 dark:bg-[#1c1c1c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-all ${
                  selectedCategory === cat
                    ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black shadow-2xs"
                    : "bg-white dark:bg-[#262626] text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                {cat === "all" ? "All Templates" : cat}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full sm:w-56 px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-[#333] bg-white dark:bg-[#222] text-slate-900 dark:text-[#F5F5F5]"
          />
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-400 animate-pulse">
              Loading starter templates library...
            </div>
          ) : error ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs text-rose-500 font-semibold">{error}</p>
              <button
                type="button"
                onClick={loadTemplates}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#262626] text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400">
              No templates match your search criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((tpl) => {
                const secCount = tpl.sections_config?.length || 0;
                const fieldCount = tpl.fields_config?.length || 0;
                const isStarter = Boolean(tpl.is_starter);

                return (
                  <div
                    key={tpl.id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#202020] hover:border-blue-400 dark:hover:border-[#5DD62C] transition-all flex flex-col justify-between shadow-2xs space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {tpl.category}
                        </span>
                        {isStarter && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            ★ STARTER
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">
                          {tpl.name}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 line-clamp-1">
                          {tpl.purpose}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-[#888] mt-1 line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#282828] font-medium">
                          📑 {secCount} Sections
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#282828] font-medium">
                          📝 {fieldCount} Fields
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#282828] font-medium">
                          {tpl.form_layout_mode === "single_page" ? "📄 Single Page" : "⚡ Multi-Step"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-[#2b2b2b] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(tpl)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] hover:bg-slate-100 dark:hover:bg-[#262626] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        👁 Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectTemplate(tpl);
                          onClose();
                        }}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black text-xs font-semibold cursor-pointer shadow-2xs active:scale-95 transition-all"
                      >
                        Use Template →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Template Detail Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in zoom-in-95 duration-100">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-200 dark:border-[#333] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
                  Template Blueprint Preview
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5] mt-0.5">
                  {previewTemplate.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#202020] text-xs space-y-1">
                <span className="font-bold text-slate-800 dark:text-slate-200">Recommended Usage:</span>
                <p className="text-slate-600 dark:text-slate-300">{previewTemplate.purpose}</p>
              </div>

              {/* Sections Breakdown */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
                  Included Form Sections ({previewTemplate.sections_config?.length || 0})
                </span>
                <div className="space-y-2">
                  {previewTemplate.sections_config?.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-[#282828] bg-white dark:bg-[#1f1f1f] space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 rounded-full bg-blue-100 dark:bg-[#5DD62C]/20 text-blue-700 dark:text-[#5DD62C] font-mono text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">
                          {sec.title}
                        </h4>
                      </div>
                      {sec.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                          {sec.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Questions */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#282828]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#888]">
                  Pre-configured Fields ({previewTemplate.fields_config?.length || 0})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {previewTemplate.fields_config?.map((f) => (
                    <div
                      key={f.field_key}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-[#262626] bg-slate-50/50 dark:bg-[#202020]/60 space-y-0.5"
                    >
                      <span className="text-[10px] font-mono text-blue-600 dark:text-[#5DD62C] uppercase font-bold">
                        {f.field_type} {f.required && "• Required"}
                      </span>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {f.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 dark:border-[#292929] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#222] text-slate-700 dark:text-slate-300"
              >
                Back to Templates
              </button>

              <button
                type="button"
                onClick={() => {
                  const t = previewTemplate;
                  setPreviewTemplate(null);
                  onSelectTemplate(t);
                  onClose();
                }}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black cursor-pointer shadow-2xs"
              >
                Apply this Template →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
