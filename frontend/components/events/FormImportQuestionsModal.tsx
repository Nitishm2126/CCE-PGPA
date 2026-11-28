"use client";

import React, { useState, useEffect } from "react";
import { EventFormField, EventItem, EventTemplate } from "@/types/events";
import { eventsApi } from "@/lib/events-api";

interface FormImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEventId: string;
  onImport: (selectedFields: EventFormField[]) => void;
}

export const FormImportQuestionsModal: React.FC<FormImportQuestionsModalProps> = ({
  isOpen,
  onClose,
  currentEventId,
  onImport,
}) => {
  const [sourceTab, setSourceTab] = useState<"events" | "templates">("events");
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [templatesList, setTemplatesList] = useState<EventTemplate[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [sourceFields, setSourceFields] = useState<EventFormField[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingFields, setLoadingFields] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.all([
      eventsApi.listEvents().catch(() => ({ events: [] })),
      eventsApi.listTemplates().catch(() => ({ templates: [] })),
    ]).then(([evRes, tplRes]) => {
      if (cancelled) return;
      setError(null);
      setSelectedSourceId("");
      setSourceFields([]);
      setSelectedFieldIds([]);
      setEventsList((evRes.events || []).filter((e) => e.id !== currentEventId));
      setTemplatesList(tplRes.templates || []);
      setLoadingList(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, currentEventId]);

  const handleSelectEvent = async (evtId: string) => {
    setSelectedSourceId(evtId);
    setSelectedFieldIds([]);
    setError(null);
    if (!evtId) {
      setSourceFields([]);
      return;
    }
    setLoadingFields(true);
    try {
      const form = await eventsApi.getEventForm(evtId);
      const list = form?.fields || [];
      setSourceFields(list);
      setSelectedFieldIds(list.map((f) => f.id));
    } catch {
      setSourceFields([]);
      setError("No saved form blocks found for the selected event.");
    } finally {
      setLoadingFields(false);
    }
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedSourceId(tplId);
    setError(null);
    const tpl = templatesList.find((t) => t.id === tplId);
    const list = tpl?.fields_config || [];
    setSourceFields(list);
    setSelectedFieldIds(list.map((f, idx) => f.id || `tpl_${idx}`));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">Import Questions &amp; Content Blocks</h3>
            <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
              Reuse configured questions or blocks from existing CCE events or form templates.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#252525] text-slate-400 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Source Tabs */}
        <div className="px-5 pt-3 flex gap-2 border-b border-slate-100 dark:border-[#292929] bg-slate-50/50 dark:bg-[#141414]">
          {[
            { id: "events" as const, label: `From Existing Events (${eventsList.length})` },
            { id: "templates" as const, label: `From Templates (${templatesList.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSourceTab(t.id);
                setSelectedSourceId("");
                setSourceFields([]);
                setSelectedFieldIds([]);
                setError(null);
              }}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                sourceTab === t.id
                  ? "border-blue-600 dark:border-[#5DD62C] text-blue-600 dark:text-[#5DD62C]"
                  : "border-transparent text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loadingList ? (
            <p className="text-xs text-slate-400 text-center py-6">Loading available forms...</p>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                {sourceTab === "events" ? "Select Source Event" : "Select Source Template"}
              </label>
              <select
                value={selectedSourceId}
                onChange={(e) =>
                  sourceTab === "events" ? handleSelectEvent(e.target.value) : handleSelectTemplate(e.target.value)
                }
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-white dark:bg-[#141414]"
              >
                <option value="">-- Choose a source --</option>
                {sourceTab === "events"
                  ? eventsList.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.category} • {ev.status})
                      </option>
                    ))
                  : templatesList.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.name} ({tp.category})
                      </option>
                    ))}
              </select>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
              {error}
            </div>
          )}

          {loadingFields ? (
            <p className="text-xs text-slate-400 text-center py-6">Fetching questions from selected form...</p>
          ) : sourceFields.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Available Elements ({selectedFieldIds.length}/{sourceFields.length} selected)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFieldIds(
                      selectedFieldIds.length === sourceFields.length
                        ? []
                        : sourceFields.map((f, idx) => f.id || `src_${idx}`)
                    )
                  }
                  className="text-blue-600 dark:text-[#5DD62C] font-semibold cursor-pointer"
                >
                  {selectedFieldIds.length === sourceFields.length ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {sourceFields.map((f, idx) => {
                  const fid = f.id || `src_${idx}`;
                  const checked = selectedFieldIds.includes(fid);
                  return (
                    <label
                      key={fid}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs cursor-pointer ${
                        checked
                          ? "border-blue-500 dark:border-[#5DD62C] bg-blue-50/40 dark:bg-[#5DD62C]/10"
                          : "border-slate-200 dark:border-[#2d2d2d]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedFieldIds((prev) =>
                              e.target.checked ? [...prev, fid] : prev.filter((id) => id !== fid)
                            )
                          }
                          className="rounded text-blue-600"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-[#F5F5F5] truncate">{f.label}</p>
                          <p className="text-[10px] text-slate-400">{f.field_type}</p>
                        </div>
                      </div>
                      {f.required && (
                        <span className="text-[10px] font-bold text-rose-500 shrink-0">Required</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-[#292929] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#333] text-slate-600 dark:text-slate-300 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedFieldIds.length === 0}
            onClick={() => {
              const picked = sourceFields.filter((f, idx) =>
                selectedFieldIds.includes(f.id || `src_${idx}`)
              );
              onImport(picked);
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black cursor-pointer disabled:opacity-40"
          >
            Import {selectedFieldIds.length > 0 ? `(${selectedFieldIds.length})` : ""} Selected
          </button>
        </div>
      </div>
    </div>
  );
};
