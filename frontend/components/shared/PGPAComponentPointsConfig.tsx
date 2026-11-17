"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api, getStoredToken } from "@/lib/api-client";
import {
  ComponentPointSettingsResponse,
  ComponentPointSettingsUpdatePayload,
  SemesterPointConfig,
} from "@/types/point-settings";

interface PGPAComponentPointsConfigProps {
  token?: string | null;
  onClose?: () => void;
  isModal?: boolean;
}

export const PGPAComponentPointsConfig: React.FC<PGPAComponentPointsConfigProps> = ({
  token,
  onClose,
  isModal = false,
}) => {
  const [configs, setConfigs] = useState<ComponentPointSettingsResponse[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("skillrack");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editSemesters, setEditSemesters] = useState<SemesterPointConfig[]>([]);
  const [editUnit, setEditUnit] = useState<string>("");
  const [editGuideline, setEditGuideline] = useState<string>("");
  const [editScaleLabel, setEditScaleLabel] = useState<string>("");

  // Confirmation dialog modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Search filter
  const [searchFilter, setSearchFilter] = useState<string>("");

  const activeToken = token || getStoredToken();

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await api.getComponentPointSettings(activeToken);
      setConfigs(data);
      if (data.length > 0 && !data.some((c) => c.component_slug === selectedSlug)) {
        setSelectedSlug(data[0].component_slug);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load point settings.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeToken, selectedSlug]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const activeComponent = useMemo(() => {
    return configs.find((c) => c.component_slug === selectedSlug) || configs[0] || null;
  }, [configs, selectedSlug]);

  // Sync edit state when component changes or when entering edit mode
  const initEditState = useCallback((comp: ComponentPointSettingsResponse) => {
    setEditSemesters(JSON.parse(JSON.stringify(comp.semesters)));
    setEditUnit(comp.unit || "");
    setEditGuideline(comp.guideline || "");
    setEditScaleLabel(comp.scale_label || "");
  }, []);

  useEffect(() => {
    if (activeComponent) {
      initEditState(activeComponent);
      setIsEditing(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [activeComponent, initEditState]);

  const handleStartEdit = () => {
    if (!activeComponent) return;
    initEditState(activeComponent);
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    if (!activeComponent) return;
    initEditState(activeComponent);
    setIsEditing(false);
    setErrorMsg(null);
  };

  const handleSemesterFieldChange = (
    semesterNumber: number,
    field: keyof SemesterPointConfig,
    value: any
  ) => {
    setEditSemesters((prev) =>
      prev.map((s) => (s.semester_number === semesterNumber ? { ...s, [field]: value } : s))
    );
  };

  const handleThresholdChange = (
    semesterNumber: number,
    gradeKey: string,
    value: number
  ) => {
    setEditSemesters((prev) =>
      prev.map((s) => {
        if (s.semester_number === semesterNumber) {
          const currentThresholds = { ...(s.grade_thresholds || {}) };
          currentThresholds[gradeKey] = value;
          return { ...s, grade_thresholds: currentThresholds };
        }
        return s;
      })
    );
  };

  const validateEditState = (): boolean => {
    if (!activeComponent) return false;
    for (const s of editSemesters) {
      if (s.min_points < 0) {
        setErrorMsg(`Semester ${s.semester_number}: Min points cannot be negative.`);
        return false;
      }
      if (s.max_points < s.min_points) {
        setErrorMsg(
          `Semester ${s.semester_number}: Max points (${s.max_points}) must be >= min points (${s.min_points}).`
        );
        return false;
      }
    }
    return true;
  };

  const handleRequestSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validateEditState()) return;
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!activeComponent || !activeToken) return;
    setIsConfirmModalOpen(false);

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const payload: ComponentPointSettingsUpdatePayload = {
        unit: editUnit.trim() || activeComponent.unit,
        guideline: editGuideline.trim() || activeComponent.guideline,
        scale_label: editScaleLabel.trim() || activeComponent.scale_label,
        semesters: editSemesters,
      };

      const updated = await api.updateComponentPointSettings(
        activeComponent.component_id,
        payload,
        activeToken
      );

      setConfigs((prev) =>
        prev.map((c) => (c.component_id === updated.component_id ? updated : c))
      );
      setSuccessMsg(
        `Successfully updated official points configuration for "${activeComponent.component_name}". Changes are now active institution-wide.`
      );
      setIsEditing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save points configuration.";
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredComponents = configs.filter((c) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return c.component_name.toLowerCase().includes(term) || c.component_slug.toLowerCase().includes(term);
  });

  const content = (
    <div className="space-y-5 text-slate-900 dark:text-[#F8F8F8]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-[#2e2e2e]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-[#337418]/30 text-emerald-700 dark:text-[#5DD62C] border border-emerald-200 dark:border-[#337418]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#F8F8F8]">
                PGPA Component Points &amp; Scoring Configuration
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#B0B0B0]">
                Single Source of Truth for Semester 1 to Semester 8 Points, Scales, and Grading Thresholds
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#202020] text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] hover:bg-slate-100 dark:hover:bg-[#282828] transition cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-[#337418]/25 border border-emerald-200 dark:border-[#337418] text-emerald-800 dark:text-[#5DD62C] text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 dark:text-[#5DD62C] hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-700 dark:text-rose-300 hover:text-rose-900 font-bold ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Component Selector Header & Filter */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#808080]">
            Select Component ({configs.length})
          </span>
          <div className="w-48 sm:w-64">
            <input
              type="text"
              placeholder="Search component..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-slate-900 dark:text-[#F8F8F8] px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 dark:focus:ring-[#5DD62C]"
            />
          </div>
        </div>

        {/* 14 Component Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {filteredComponents.map((comp) => {
            const isSelected = comp.component_slug === selectedSlug;
            return (
              <button
                key={comp.component_id}
                type="button"
                onClick={() => {
                  if (isEditing) {
                    if (!confirm("Discard unsaved edits and switch component?")) return;
                  }
                  setSelectedSlug(comp.component_slug);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                  isSelected
                    ? "bg-emerald-600 dark:bg-[#337418] text-white border-emerald-600 dark:border-[#5DD62C] shadow-xs"
                    : "bg-white dark:bg-[#202020] text-slate-700 dark:text-[#B0B0B0] border-slate-200 dark:border-[#2e2e2e] hover:bg-slate-50 dark:hover:bg-[#282828]"
                }`}
              >
                <span>{comp.component_name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    isSelected
                      ? "bg-emerald-700 dark:bg-[#5DD62C] text-white dark:text-black font-bold"
                      : "bg-slate-100 dark:bg-[#161616] text-slate-600 dark:text-[#808080]"
                  }`}
                >
                  {comp.unit}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400 dark:text-[#808080]">
          <span className="inline-block h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p>Loading centralized component scoring settings...</p>
        </div>
      ) : activeComponent ? (
        <div className="space-y-4">
          {/* Active Component Overview Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#202020] border border-slate-200 dark:border-[#2e2e2e] shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#F8F8F8]">
                    {activeComponent.component_name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#161616] font-mono text-slate-600 dark:text-[#5DD62C] border border-slate-200 dark:border-[#2e2e2e]">
                    {activeComponent.component_slug}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-[#B0B0B0] mt-0.5">
                  {activeComponent.guideline}
                </p>
              </div>

              {/* Mode Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    id="btn-edit-component-points"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-[#337418] dark:hover:bg-[#275913] text-white text-xs font-bold shadow-2xs transition cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    <span>Edit Point Settings</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] hover:bg-slate-100 dark:hover:bg-[#282828] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestSave}
                      disabled={isSaving}
                      id="btn-save-component-points"
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-[#337418] dark:hover:bg-[#275913] text-white text-xs font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span>Save Changes</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Meta tags */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-[#2e2e2e] text-xs">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-[#808080] uppercase tracking-wider block">
                  Scoring Unit
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full mt-1 text-xs px-2 py-1 rounded border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-slate-900 dark:text-[#F8F8F8]"
                  />
                ) : (
                  <span className="font-bold text-slate-800 dark:text-[#F8F8F8]">
                    {activeComponent.unit}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-[#808080] uppercase tracking-wider block">
                  Default Scale Label
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editScaleLabel}
                    onChange={(e) => setEditScaleLabel(e.target.value)}
                    className="w-full mt-1 text-xs px-2 py-1 rounded border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-slate-900 dark:text-[#F8F8F8]"
                  />
                ) : (
                  <span className="font-bold text-slate-800 dark:text-[#F8F8F8]">
                    {activeComponent.scale_label}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-[#808080] uppercase tracking-wider block">
                  Credit Value
                </span>
                <span className="font-bold text-slate-800 dark:text-[#F8F8F8]">
                  {activeComponent.credit_value} Credits
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 dark:text-[#808080] uppercase tracking-wider block">
                  Last Updated
                </span>
                <span className="font-medium text-slate-600 dark:text-[#B0B0B0]">
                  {activeComponent.updated_at
                    ? `${new Date(activeComponent.updated_at).toLocaleDateString()} (${activeComponent.updated_by_name || "Official"})`
                    : "Official Default"}
                </span>
              </div>
            </div>
          </div>

          {/* Semester 1 to Semester 8 Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-[#B0B0B0]">
                Semester Scoring Matrix (Semesters 1 — 8)
              </h4>
              {isEditing && (
                <span className="text-[11px] text-emerald-600 dark:text-[#5DD62C] font-semibold animate-pulse">
                  Editing Mode Active — Review values before saving
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {(isEditing ? editSemesters : activeComponent.semesters).map((sem) => {
                const sNum = sem.semester_number;
                return (
                  <div
                    key={sNum}
                    className={`p-4 rounded-xl border transition ${
                      sem.is_enabled
                        ? "bg-white dark:bg-[#161616] border-slate-200 dark:border-[#2e2e2e]"
                        : "bg-slate-50/60 dark:bg-[#111111] border-slate-200/60 dark:border-[#222222] opacity-75"
                    }`}
                  >
                    {/* Semester Card Top Row */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-[#202020]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-[#337418]/40 text-emerald-800 dark:text-[#5DD62C] font-bold text-xs">
                          {sNum}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-[#F8F8F8]">
                          Semester {sNum}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-[#B0B0B0] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sem.is_enabled}
                              onChange={(e) =>
                                handleSemesterFieldChange(sNum, "is_enabled", e.target.checked)
                              }
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Applicable</span>
                          </label>
                        ) : sem.is_enabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-[#337418]/30 text-emerald-700 dark:text-[#5DD62C] border border-emerald-200 dark:border-[#337418]">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#202020] text-slate-500 dark:text-[#808080] border border-slate-200 dark:border-[#2e2e2e]">
                            Disabled
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Numeric Points Configuration */}
                    <div className="grid grid-cols-2 gap-3 pt-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#808080] mb-1">
                          Max / Target ({activeComponent.unit})
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={sem.max_points}
                            onChange={(e) =>
                              handleSemesterFieldChange(
                                sNum,
                                "max_points",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#202020] text-slate-900 dark:text-[#5DD62C] focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          <span className="font-mono font-bold text-sm text-emerald-700 dark:text-[#5DD62C]">
                            {sem.max_points} {activeComponent.unit}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-[#808080] mb-1">
                          Credits
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={sem.credit_value}
                            onChange={(e) =>
                              handleSemesterFieldChange(
                                sNum,
                                "credit_value",
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#202020] text-slate-900 dark:text-[#F8F8F8] focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          <span className="font-mono font-bold text-sm text-slate-800 dark:text-[#F8F8F8]">
                            {sem.credit_value} Credits
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Grade Thresholds (if present) */}
                    {sem.grade_thresholds && (
                      <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-[#202020]">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#808080] mb-1.5">
                          Grade Cutoff Thresholds
                        </span>
                        <div className="grid grid-cols-5 gap-1 text-[11px]">
                          {["O", "A+", "A", "B+", "B"].map((gKey) => {
                            const val = sem.grade_thresholds?.[gKey];
                            return (
                              <div
                                key={gKey}
                                className="p-1 rounded bg-slate-50 dark:bg-[#202020] text-center border border-slate-100 dark:border-[#2e2e2e]"
                              >
                                <span className="font-bold text-[10px] block text-emerald-700 dark:text-[#5DD62C]">
                                  {gKey}
                                </span>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="any"
                                    value={val !== undefined ? val : ""}
                                    onChange={(e) =>
                                      handleThresholdChange(
                                        sNum,
                                        gKey,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-full text-[10px] font-mono text-center p-0.5 rounded border border-slate-200 dark:border-[#337418] bg-white dark:bg-[#161616] text-slate-900 dark:text-[#F8F8F8]"
                                  />
                                ) : (
                                  <span className="font-mono text-[10px] text-slate-700 dark:text-[#B0B0B0]">
                                    {val !== undefined ? val : "—"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Guideline / Rules Description */}
                    <div className="pt-2 mt-2 text-[11px] text-slate-500 dark:text-[#808080]">
                      {isEditing ? (
                        <input
                          type="text"
                          placeholder="Semester guideline..."
                          value={sem.guideline || ""}
                          onChange={(e) =>
                            handleSemesterFieldChange(sNum, "guideline", e.target.value)
                          }
                          className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#202020] text-slate-900 dark:text-[#F8F8F8]"
                        />
                      ) : (
                        <span>{sem.guideline || sem.scale_label}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation Dialog Modal */}
      {isConfirmModalOpen && activeComponent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-apple-fade"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-[#2e2e2e] p-6 shadow-2xl space-y-4 text-slate-900 dark:text-[#F8F8F8]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-[#FFD84D]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-900 dark:text-[#F8F8F8]">
                  Confirm Point Settings Update
                </h4>
                <p className="text-xs text-slate-500 dark:text-[#B0B0B0]">
                  Target Component: {activeComponent.component_name}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-[#202020] border border-amber-200/80 dark:border-[#337418]/60 text-xs text-amber-900 dark:text-[#F8F8F8] space-y-2">
              <p className="font-semibold">
                Are you sure you want to update the official scoring rules across Semesters 1 to 8?
              </p>
              <p className="text-[11px] text-slate-600 dark:text-[#B0B0B0]">
                This updated configuration will immediately serve as the institutional single source of truth across all student submissions, mentor evaluations, manual points, and performance tracking.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] hover:bg-slate-100 dark:hover:bg-[#282828] cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-[#337418] dark:hover:bg-[#275913] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Yes, Update Scoring Rules"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-apple-fade overflow-y-auto"
      >
        <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-[#2e2e2e] p-5 sm:p-7 shadow-2xl transition-colors">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
