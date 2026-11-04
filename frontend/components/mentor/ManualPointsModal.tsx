"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { MentorStudentItem } from "@/types/auth";
import {
  PGPAComponentResponse,
  SemesterResponse,
  ManualComponentPointResponse,
} from "@/types/achievement";

interface ManualPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: MentorStudentItem | null;
  token: string | null;
  components: PGPAComponentResponse[];
  semesters: SemesterResponse[];
}

export const ManualPointsModal: React.FC<ManualPointsModalProps> = ({
  isOpen,
  onClose,
  student,
  token,
  components,
  semesters,
}) => {
  const [manualPoints, setManualPoints] = useState<ManualComponentPointResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [pointsInput, setPointsInput] = useState<string>("");
  const [remarksInput, setRemarksInput] = useState<string>("");

  const loadPoints = useCallback(async () => {
    if (!student || !token) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await api.getMenteeManualPoints(student.student_id, token);
      setManualPoints(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load manual points.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [student, token]);

  useEffect(() => {
    if (isOpen && student) {
      loadPoints();
      // Preselect default component and semester if available
      if (components.length > 0 && !selectedComponentId) {
        setSelectedComponentId(components[0].id);
      }
      if (semesters.length > 0 && !selectedSemesterId) {
        setSelectedSemesterId(semesters[0].id);
      }
      setPointsInput("");
      setRemarksInput("");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, student, components, semesters, loadPoints, selectedComponentId, selectedSemesterId]);

  if (!isOpen || !student) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !student) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const pts = parseFloat(pointsInput.trim());
    if (isNaN(pts) || pts < 0 || pts > 10) {
      setErrorMsg("Points must be a valid number between 0.0 and 10.0 according to Table B guidelines.");
      return;
    }

    if (!remarksInput.trim() || remarksInput.trim().length < 3) {
      setErrorMsg("Please provide an explanatory remark explaining the manual point award (min 3 characters).");
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
      await api.createMentorManualPoint(
        {
          student_id: student.student_id,
          component_id: selectedComponentId,
          semester_id: selectedSemesterId,
          points: pts,
          remarks: remarksInput.trim(),
        },
        token
      );
      setSuccessMsg(`Successfully awarded ${pts} points.`);
      setPointsInput("");
      setRemarksInput("");
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
    if (!confirm("Are you sure you want to deactivate this manual point record? This action will be audited.")) {
      return;
    }

    try {
      setDeletingId(pointId);
      setErrorMsg(null);
      await api.deleteMentorManualPoint(pointId, token);
      setSuccessMsg("Manual point entry removed.");
      await loadPoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete manual point.";
      setErrorMsg(msg);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-apple-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-points-title"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#292929] shadow-2xl text-slate-900 dark:text-[#F5F5F5] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#292929] shrink-0">
          <div>
            <h2 id="manual-points-title" className="text-base font-bold text-slate-900 dark:text-white">
              Manual Component Points
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
              Award authorized PGPA component points to {student.full_name} ({student.register_number || "Pending"})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:text-[#A3A3A3] dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Messages */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between">
              <span>{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 text-sm font-bold"
              >
                &times;
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-700 dark:text-rose-400 hover:text-rose-900 text-sm font-bold"
              >
                &times;
              </button>
            </div>
          )}

          {/* Form: Award New Points */}
          <form
            onSubmit={handleSave}
            className="p-4 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#292929] space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-[#FFD84D]">
                Award / Update Points
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">
                Scale: 0.0 to 10.0 Grade Points
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  PGPA Component *
                </label>
                <select
                  value={selectedComponentId}
                  onChange={(e) => setSelectedComponentId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#111111] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#FFD84D]/40"
                >
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.credit_value} Credits)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Semester *
                </label>
                <select
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#111111] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#FFD84D]/40"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Points Awarded (0 - 10) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  placeholder="e.g. 9.0"
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#111111] px-3 py-2 text-xs font-mono text-slate-900 dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#FFD84D]/40"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Reason / Remarks *
                </label>
                <input
                  type="text"
                  value={remarksInput}
                  onChange={(e) => setRemarksInput(e.target.value)}
                  placeholder="e.g. Excellent technical symposium paper presentation"
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#111111] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#FFD84D]/40"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 dark:bg-[#FFD84D] dark:hover:bg-[#FACC15] text-white dark:text-black font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Saving Entry..." : "Save Manual Points"}
              </button>
            </div>
          </form>

          {/* Section: Existing Points Awarded */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 dark:text-[#D4D4D4] uppercase tracking-wider">
              Awarded Points History ({manualPoints.length})
            </h3>

            {isLoading ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading records...</div>
            ) : manualPoints.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-[#292929] text-center text-xs text-slate-400 dark:text-[#737373]">
                No manual points awarded to this student yet.
              </div>
            ) : (
              <div className="space-y-2">
                {manualPoints.map((mp) => (
                  <div
                    key={mp.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#111111] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-[#F5F5F5]">
                          {mp.component_name || "PGPA Component"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-amber-950/40 text-purple-700 dark:text-[#FFD84D] font-semibold border border-purple-200 dark:border-amber-900/60">
                          {mp.semester_name || `Sem ${mp.semester_number || ""}`}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-[#A3A3A3] text-[11px]">
                        {mp.remarks}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-[#737373]">
                        Awarded by {mp.mentor_name || "Faculty Mentor"} on{" "}
                        {new Date(mp.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-sm text-purple-700 dark:text-[#FFD84D]">
                        {mp.points.toFixed(1)} pts
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(mp.id)}
                        disabled={deletingId === mp.id}
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 font-semibold text-[11px] cursor-pointer disabled:opacity-50"
                        title="Deactivate manual point award"
                      >
                        {deletingId === mp.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#292929] bg-slate-50 dark:bg-[#141414] flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#111111] text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] hover:bg-slate-100 dark:hover:bg-[#181818] transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
