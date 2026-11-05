"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";
import { MentorStudentItem } from "@/types/auth";
import {
  PGPAComponentResponse,
  SemesterResponse,
  ManualComponentPointResponse,
} from "@/types/achievement";

export interface ComponentScaleRule {
  min: number;
  max: number;
  step: number;
  unit: string;
  scaleLabel: string;
  guideline: string;
}

export const OFFICIAL_COMPONENT_SCALES: Record<string, ComponentScaleRule> = {
  "skillrack": {
    min: 0,
    max: 64000,
    step: 1,
    unit: "Problems / Pts",
    scaleLabel: "0.0 - 64,000.0 Problems / Score",
    guideline: "Table 1.1 thresholds (Sem 1: 500, Sem 2: 1000, ..., Sem 8: 64000)",
  },
  "academics-gpa": {
    min: 0,
    max: 10.0,
    step: 0.01,
    unit: "GPA",
    scaleLabel: "0.00 - 10.00 GPA",
    guideline: "Anna University Semester GPA scale (0.00 - 10.00)",
  },
  "amcat": {
    min: 0,
    max: 100,
    step: 0.1,
    unit: "Score / %ile",
    scaleLabel: "0.0 - 100.0 Score / Percentile",
    guideline: "Table 2.1 score ranges or Table B scale",
  },
  "clubs-and-cells": {
    min: 0,
    max: 6000,
    step: 1,
    unit: "Points",
    scaleLabel: "0.0 - 6,000.0 Points",
    guideline: "Table 7.1 point allocations (100 - 700 pts/event, up to 6,000 cumulative)",
  },
  "sairam-innovation-eco-system": {
    min: 0,
    max: 10.0,
    step: 0.5,
    unit: "Grade Points",
    scaleLabel: "0.0 - 10.0 Grade Points",
    guideline: "Table 5.1 & Table B grade points (Overall Winner=10, SDG Winner=9, Top 15=7, Participant=3)",
  },
  "nptel-non-credit-transfer": {
    min: 0,
    max: 100,
    step: 1,
    unit: "Marks / GP",
    scaleLabel: "0.0 - 100.0 Marks or 0.0 - 10.0 Grade Points",
    guideline: "Table 10.1 marks (Topper 90+=10, Gold 75+=9, Silver 60+=7, Elite 50+=5, Pass=3)",
  },
  "sail": {
    min: 0,
    max: 560,
    step: 1,
    unit: "SAIL Points",
    scaleLabel: "0.0 - 560.0 SAIL Points",
    guideline: "Table 6.2 cumulative semester thresholds (Sem 1: 70, ..., Sem 8: 560)",
  },
  "online-certifications": {
    min: 0,
    max: 100,
    step: 1,
    unit: "Marks / GP",
    scaleLabel: "0.0 - 100.0 Marks or 0.0 - 10.0 Grade Points",
    guideline: "Table B grade points or marks (Coursera, edX, Spoken Tutorial)",
  },
  "fit-india-certifications": {
    min: 0,
    max: 100,
    step: 1,
    unit: "Fitness Score",
    scaleLabel: "0.0 - 100.0 Fitness Score",
    guideline: "Table 13.1 fitness challenge score (100=O, 75=A+, 50=A, 30=B+)",
  },
  "internship": {
    min: 0,
    max: 10.0,
    step: 0.5,
    unit: "Grade Points",
    scaleLabel: "0.0 - 10.0 Grade Points",
    guideline: "Table 3.3 grade points (Core/Stipend min A+=9/O=10, Others upto A=7)",
  },
  "sairam-sdg-action-programme": {
    min: 0,
    max: 100,
    step: 1,
    unit: "SAP Points",
    scaleLabel: "0.0 - 100.0 SAP Points",
    guideline: "Table 4.2 SAP points (75+=O, 60+=A+, 45+=A, 30+=B+, 11+=B)",
  },
  "sports-and-games": {
    min: 0,
    max: 1000,
    step: 1,
    unit: "Points",
    scaleLabel: "0.0 - 1,000.0 Points",
    guideline: "Table 8.1 medal matrix points (5 - 115 pts/event, cumulative up to 700+ for O)",
  },
  "scouts-for-sdgs": {
    min: 0,
    max: 50,
    step: 1,
    unit: "Hours / GP",
    scaleLabel: "0.0 - 50.0 Service Hours or 0.0 - 10.0 Grade Points",
    guideline: "Table 12.1 service hours (20+ hrs = O) or grade points",
  },
  "gate": {
    min: 0,
    max: 1000,
    step: 1,
    unit: "Score",
    scaleLabel: "0.0 - 1,000.0 GATE Score",
    guideline: "Table 9.1 GATE marks / score (Qualify=O:10, min score=A+:9)",
  },
};

const DEFAULT_SCALE: ComponentScaleRule = {
  min: 0,
  max: 1000,
  step: 1,
  unit: "Points",
  scaleLabel: "0.0 - 1,000.0 Points",
  guideline: "Official Component Guidelines",
};

interface ManualPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: MentorStudentItem | null;
  students?: MentorStudentItem[];
  onSelectStudent?: (student: MentorStudentItem) => void;
  token: string | null;
  components: PGPAComponentResponse[];
  semesters: SemesterResponse[];
}

export const ManualPointsModal: React.FC<ManualPointsModalProps> = ({
  isOpen,
  onClose,
  student,
  students = [],
  onSelectStudent,
  token,
  components,
  semesters,
}) => {
  // Current active student
  const activeStudent = student || (students.length > 0 ? students[0] : null);

  const [manualPoints, setManualPoints] = useState<ManualComponentPointResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter history by semester
  const [historySemesterFilter, setHistorySemesterFilter] = useState<string>("all");

  // Form states
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [pointsInput, setPointsInput] = useState<string>("");
  const [remarksInput, setRemarksInput] = useState<string>("");

  // Determine current component scale rule
  const currentScaleRule = useMemo<ComponentScaleRule>(() => {
    const comp = components.find((c) => c.id === selectedComponentId);
    if (!comp) return DEFAULT_SCALE;
    return OFFICIAL_COMPONENT_SCALES[comp.slug] || DEFAULT_SCALE;
  }, [components, selectedComponentId]);

  const loadPoints = useCallback(async () => {
    if (!activeStudent || !token) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.getMenteeManualPoints(activeStudent.student_id, token);
      setManualPoints(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load manual points.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeStudent, token]);

  // Reset form when modal opens or student changes
  useEffect(() => {
    if (isOpen && activeStudent) {
      loadPoints();
      if (components.length > 0 && !selectedComponentId) {
        setSelectedComponentId(components[0].id);
      }
      if (semesters.length > 0 && !selectedSemesterId) {
        setSelectedSemesterId(semesters[0].id);
      }
      setEditingPointId(null);
      setPointsInput("");
      setRemarksInput("");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, activeStudent, components, semesters, loadPoints, selectedComponentId, selectedSemesterId]);

  if (!isOpen || !activeStudent) return null;

  const handleStartEdit = (mp: ManualComponentPointResponse) => {
    setEditingPointId(mp.id);
    setSelectedComponentId(mp.component_id);
    setSelectedSemesterId(mp.semester_id);
    setPointsInput(mp.points.toString());
    setRemarksInput(mp.remarks);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingPointId(null);
    setPointsInput("");
    setRemarksInput("");
    setErrorMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !activeStudent) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const pts = parseFloat(pointsInput.trim());
    if (isNaN(pts)) {
      setErrorMsg("Please enter a valid numeric points value.");
      return;
    }

    if (pts < currentScaleRule.min || pts > currentScaleRule.max) {
      setErrorMsg(
        `Points must be within official scale: ${currentScaleRule.scaleLabel} (${currentScaleRule.guideline})`
      );
      return;
    }

    if (!remarksInput.trim() || remarksInput.trim().length < 3) {
      setErrorMsg("Please provide an explanatory remark explaining the manual award (min 3 characters).");
      return;
    }

    if (!selectedComponentId) {
      setErrorMsg("Please select a target PGPA component.");
      return;
    }

    if (!selectedSemesterId) {
      setErrorMsg("Please select an academic semester.");
      return;
    }

    try {
      setIsSaving(true);
      if (editingPointId) {
        // Update existing record
        await api.updateMentorManualPoint(
          editingPointId,
          {
            points: pts,
            remarks: remarksInput.trim(),
          },
          token
        );
        setSuccessMsg(`Successfully updated manual point record to ${pts} ${currentScaleRule.unit}.`);
      } else {
        // Create new record
        await api.createMentorManualPoint(
          {
            student_id: activeStudent.student_id,
            component_id: selectedComponentId,
            semester_id: selectedSemesterId,
            points: pts,
            remarks: remarksInput.trim(),
          },
          token
        );
        setSuccessMsg(`Successfully awarded ${pts} ${currentScaleRule.unit}.`);
      }
      handleCancelEdit();
      await loadPoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record manual points.";
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (pointId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to deactivate this manual point record? This action will be recorded in audit logs.")) {
      return;
    }

    try {
      setDeletingId(pointId);
      setErrorMsg(null);
      await api.deleteMentorManualPoint(pointId, token);
      setSuccessMsg("Manual point entry removed.");
      if (editingPointId === pointId) {
        handleCancelEdit();
      }
      await loadPoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete manual point.";
      setErrorMsg(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredHistory = manualPoints.filter((mp) => {
    if (historySemesterFilter === "all") return true;
    return mp.semester_id === historySemesterFilter || mp.semester_number?.toString() === historySemesterFilter;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-apple-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-points-title"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#0F0F0F] border border-slate-200 dark:border-[#2e2e2e] shadow-2xl text-slate-900 dark:text-[#F8F8F8] overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#202020] bg-slate-50/70 dark:bg-[#161616] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-[#337418]/30 text-emerald-700 dark:text-[#5DD62C] border border-emerald-200 dark:border-[#337418]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 id="manual-points-title" className="text-base font-bold text-slate-900 dark:text-[#F8F8F8]">
                Manual Component Points
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#B0B0B0] mt-0.5">
                Award and manage semester-wise points for all 14 official PGPA components
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:text-[#808080] dark:hover:text-[#F8F8F8] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Mentee Switcher Banner */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-[#2e2e2e] bg-slate-50/70 dark:bg-[#202020] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#808080]">
                Target Mentee
              </span>
              <p className="font-bold text-sm text-slate-900 dark:text-[#F8F8F8]">
                {activeStudent.full_name}
              </p>
              <p className="text-xs font-mono text-slate-500 dark:text-[#B0B0B0]">
                {activeStudent.register_number || "Register No. Pending"} &bull; {activeStudent.department || "CCE"}
              </p>
            </div>

            {/* If multiple students available, let mentor switch mentee */}
            {students.length > 1 && onSelectStudent && (
              <div className="sm:w-60">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#808080] mb-1">
                  Switch Mentee
                </label>
                <select
                  value={activeStudent.student_id}
                  onChange={(e) => {
                    const found = students.find((s) => s.student_id === e.target.value);
                    if (found) onSelectStudent(found);
                  }}
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-slate-900 dark:text-[#F8F8F8] px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 dark:focus:ring-[#5DD62C]"
                >
                  {students.map((st) => (
                    <option key={st.student_id} value={st.student_id}>
                      {st.full_name} ({st.register_number || "No Reg"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Feedback Messages */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-[#337418]/25 border border-emerald-200 dark:border-[#337418] text-emerald-800 dark:text-[#5DD62C] text-xs font-semibold flex items-center justify-between">
              <span>{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-700 dark:text-[#5DD62C] hover:text-emerald-900 font-bold ml-2"
              >
                &times;
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-700 dark:text-rose-300 hover:text-rose-900 font-bold ml-2"
              >
                &times;
              </button>
            </div>
          )}

          {/* Form: Award / Edit Points */}
          <form
            onSubmit={handleSave}
            className="p-4 rounded-xl bg-slate-50/60 dark:bg-[#202020] border border-slate-200 dark:border-[#2e2e2e] space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-[#5DD62C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-[#F8F8F8]">
                  {editingPointId ? "Edit Awarded Points" : "Award Component Points"}
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-[#5DD62C]">
                Scale: {currentScaleRule.scaleLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] mb-1">
                  PGPA Component * (14 Components)
                </label>
                <select
                  value={selectedComponentId}
                  onChange={(e) => setSelectedComponentId(e.target.value)}
                  disabled={isSaving || !!editingPointId}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] px-3 py-2 text-xs text-slate-900 dark:text-[#F8F8F8] focus:outline-hidden focus:ring-1 focus:ring-emerald-500 dark:focus:ring-[#5DD62C] disabled:opacity-70"
                >
                  {components.map((c) => {
                    const rule = OFFICIAL_COMPONENT_SCALES[c.slug];
                    const unitSuffix = rule ? ` [${rule.unit}]` : "";
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {unitSuffix} ({c.credit_value} Credits)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] mb-1">
                  Academic Semester *
                </label>
                <select
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                  disabled={isSaving || !!editingPointId}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] px-3 py-2 text-xs text-slate-900 dark:text-[#F8F8F8] focus:outline-hidden focus:ring-1 focus:ring-emerald-500 dark:focus:ring-[#5DD62C] disabled:opacity-70"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Component-Specific Guidelines Notice */}
            <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-[#337418]/15 border border-emerald-200/60 dark:border-[#337418]/40 text-[11px] text-emerald-800 dark:text-[#5DD62C]">
              <span className="font-bold">Evaluation Rule: </span>
              {currentScaleRule.guideline}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] mb-1">
                  Points Awarded ({currentScaleRule.unit}) *
                </label>
                <input
                  type="number"
                  step={currentScaleRule.step}
                  min={currentScaleRule.min}
                  max={currentScaleRule.max}
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  placeholder={`e.g. ${currentScaleRule.max >= 100 ? currentScaleRule.max / 2 : 8.5}`}
                  required
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-[#5DD62C] focus:outline-hidden focus:ring-1 focus:ring-emerald-500 dark:focus:ring-[#5DD62C]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] mb-1">
                  Mandatory Remarks / Justification *
                </label>
                <input
                  type="text"
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                  placeholder="e.g. Verified paper presentation award in National Symposium"
                  required
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] px-3 py-2 text-xs text-slate-900 dark:text-[#F8F8F8] focus:outline-hidden focus:ring-1 focus:ring-emerald-500 dark:focus:ring-[#5DD62C]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {editingPointId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-xs font-semibold text-slate-700 dark:text-[#B0B0B0] hover:bg-slate-100 dark:hover:bg-[#202020] transition cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 dark:bg-[#337418] dark:hover:bg-[#275913] text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                <span>{editingPointId ? "Update Awarded Points" : "Save Manual Points"}</span>
              </button>
            </div>
          </form>

          {/* Section: Awarded Points History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 dark:text-[#B0B0B0] uppercase tracking-wider">
                Awarded Points History ({filteredHistory.length})
              </h3>

              {/* Semester filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[11px] text-slate-500 dark:text-[#808080]">Filter:</span>
                <select
                  value={historySemesterFilter}
                  onChange={(e) => setHistorySemesterFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] text-slate-800 dark:text-[#F8F8F8] px-2 py-1 text-xs"
                >
                  <option value="all">All Semesters</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-[#808080]">
                Loading records...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-[#2e2e2e] text-center text-xs text-slate-400 dark:text-[#808080]">
                No manual component points awarded for this selection yet.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((mp) => (
                  <div
                    key={mp.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2e2e2e] bg-white dark:bg-[#161616] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-[#F8F8F8] truncate">
                          {mp.component_name || "PGPA Component"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-[#337418]/30 text-emerald-700 dark:text-[#5DD62C] font-semibold border border-emerald-200 dark:border-[#337418]">
                          {mp.semester_name || `Sem ${mp.semester_number || ""}`}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-[#B0B0B0] text-xs break-words">
                        {mp.remarks}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-[#808080]">
                        Awarded by {mp.mentor_name || "Faculty Mentor"} on{" "}
                        {new Date(mp.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-sm text-emerald-700 dark:text-[#5DD62C]">
                        {mp.points} pts
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(mp)}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold text-slate-600 dark:text-[#B0B0B0] hover:bg-slate-100 dark:hover:bg-[#202020] transition cursor-pointer"
                          title="Edit this manual point award"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(mp.id)}
                          disabled={deletingId === mp.id}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer disabled:opacity-50"
                          title="Deactivate manual point award"
                        >
                          {deletingId === mp.id ? "Removing..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#202020] bg-slate-50 dark:bg-[#161616] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#2e2e2e] bg-white dark:bg-[#202020] text-xs font-semibold text-slate-700 dark:text-[#F8F8F8] hover:bg-slate-100 dark:hover:bg-[#282828] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
