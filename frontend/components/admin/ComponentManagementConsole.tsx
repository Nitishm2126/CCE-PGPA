"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api, ApiError } from "@/lib/api-client";
import {
  AdminSemesterMatrixResponse,
  AdminMatrixComponentItem,
  PGPAComponentResponse,
} from "@/types/achievement";

interface ComponentManagementConsoleProps {
  token?: string | null;
}

export const ComponentManagementConsole: React.FC<ComponentManagementConsoleProps> = ({
  token,
}) => {
  const [matrixData, setMatrixData] = useState<AdminSemesterMatrixResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingCell, setUpdatingCell] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [modeFilter, setModeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"matrix" | "catalogue" | "evidence">("evidence");
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Edit Component Modal State
  const [editingComp, setEditingComp] = useState<AdminMatrixComponentItem | null>(null);
  const [editCredit, setEditCredit] = useState<number>(3);
  const [editMode, setEditMode] = useState<string>("student_submission");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editRequiresVerification, setEditRequiresVerification] = useState<boolean>(true);
  const [editPdfRequirement, setEditPdfRequirement] = useState<"required" | "optional" | "disabled">("optional");
  const [editAllowOtherEvidence, setEditAllowOtherEvidence] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Visibility Confirmation Modal State
  const [visibilityModalComp, setVisibilityModalComp] = useState<AdminMatrixComponentItem | null>(null);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState<boolean>(false);

  const fetchMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.adminGetComponentSemesterMatrix(token);
      setMatrixData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load component semester matrix.";
      setActionFeedback({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // Handle cell toggle
  const handleToggleSemester = async (
    componentId: string,
    semesterId: string,
    semesterNumber: number,
    currentStatus: boolean
  ) => {
    const cellKey = `${componentId}-${semesterId}`;
    setUpdatingCell(cellKey);
    setActionFeedback(null);

    // Optimistic update
    setMatrixData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        components: prev.components.map((comp) => {
          if (comp.component_id === componentId) {
            return {
              ...comp,
              semesters: {
                ...comp.semesters,
                [String(semesterNumber)]: !currentStatus,
              },
            };
          }
          return comp;
        }),
      };
    });

    try {
      await api.adminUpdateComponentSemester(
        componentId,
        semesterId,
        { is_enabled: !currentStatus },
        token
      );
      setActionFeedback({
        type: "success",
        text: `Updated semester availability successfully.`,
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: unknown) {
      // Revert optimistic update
      setMatrixData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          components: prev.components.map((comp) => {
            if (comp.component_id === componentId) {
              return {
                ...comp,
                semesters: {
                  ...comp.semesters,
                  [String(semesterNumber)]: currentStatus,
                },
              };
            }
            return comp;
          }),
        };
      });
      const msg = err instanceof Error ? err.message : "Failed to update semester configuration.";
      setActionFeedback({ type: "error", text: msg });
    } finally {
      setUpdatingCell(null);
    }
  };

  // Open Edit Modal
  const openEditModal = (comp: AdminMatrixComponentItem) => {
    setEditingComp(comp);
    setEditCredit(comp.credit_value);
    setEditMode(comp.submission_mode);
    setEditIsActive(comp.is_active);
    setEditRequiresVerification(comp.requires_verification);
    setEditPdfRequirement(comp.pdf_requirement || (comp.pdf_required ? "required" : "optional"));
    setEditAllowOtherEvidence(comp.allow_other_evidence_types ?? false);
  };

  // Quick update evidence rule from table
  const handleQuickUpdateEvidence = async (
    componentId: string,
    field: "pdf_requirement" | "allow_other_evidence_types" | "is_active",
    value: string | boolean
  ) => {
    setActionFeedback(null);
    // Optimistic update
    setMatrixData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        components: prev.components.map((c) => {
          if (c.component_id === componentId) {
            return {
              ...c,
              [field]: value,
              ...(field === "pdf_requirement" ? { pdf_required: value === "required" } : {}),
            };
          }
          return c;
        }),
      };
    });

    try {
      await api.adminUpdateComponent(
        componentId,
        { [field]: value },
        token
      );
      setActionFeedback({
        type: "success",
        text: `Updated component configuration successfully.`,
      });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: unknown) {
      await fetchMatrix();
      const msg = err instanceof Error ? err.message : "Failed to update component settings.";
      setActionFeedback({ type: "error", text: msg });
    }
  };

  // Save Edit Component
  const handleSaveEdit = async () => {
    if (!editingComp) return;
    setIsSavingEdit(true);
    setActionFeedback(null);
    try {
      await api.adminUpdateComponent(
        editingComp.component_id,
        {
          credit_value: editCredit,
          submission_mode: editMode,
          is_active: editIsActive,
          requires_verification: editRequiresVerification,
          pdf_requirement: editPdfRequirement,
          allow_other_evidence_types: editAllowOtherEvidence,
        },
        token
      );
      setActionFeedback({
        type: "success",
        text: `Successfully updated '${editingComp.name}' configuration.`,
      });
      setEditingComp(null);
      await fetchMatrix();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update component settings.";
      setActionFeedback({ type: "error", text: msg });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm Visibility Toggle
  const handleConfirmVisibilityToggle = async () => {
    if (!visibilityModalComp) return;
    const comp = visibilityModalComp;
    const targetVisibility = comp.is_visible === false ? true : false;
    setIsUpdatingVisibility(true);
    setActionFeedback(null);

    // Optimistic update
    setMatrixData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        components: prev.components.map((c) =>
          c.component_id === comp.component_id ? { ...c, is_visible: targetVisibility } : c
        ),
      };
    });

    try {
      const res = await api.adminUpdateComponentVisibility(comp.component_id, targetVisibility, token);
      setActionFeedback({
        type: "success",
        text: res.message || `Visibility for '${comp.name}' updated successfully.`,
      });
      setVisibilityModalComp(null);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: unknown) {
      // Revert optimistic update
      setMatrixData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          components: prev.components.map((c) =>
            c.component_id === comp.component_id ? { ...c, is_visible: comp.is_visible } : c
          ),
        };
      });
      const msg = err instanceof Error ? err.message : "Failed to update component visibility.";
      setActionFeedback({ type: "error", text: msg });
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  // Filtered components
  const filteredComponents = useMemo(() => {
    if (!matrixData) return [];
    return matrixData.components.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesMode =
        modeFilter === "all" || c.submission_mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [matrixData, searchTerm, modeFilter]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                PGPA Component Management & Semester Matrix
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure credits, submission channels (Student Submission vs. HOD Excel Import), and semester availability across Semesters 1 through 8.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Components</span>
                <span className="font-bold text-slate-900 dark:text-white">14 Official</span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Semesters</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">8 Configured</span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Grading</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">Table B (O-C)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchMatrix}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Refresh Matrix"
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-center justify-between border ${
              actionFeedback.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            <span>{actionFeedback.text}</span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              &times;
            </button>
          </div>
        )}

        {/* Navigation Tabs & Search Toolbar */}
        <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab("evidence")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "evidence"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Evidence & PDF Rules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("matrix")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "matrix"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Semester Matrix View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("catalogue")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === "catalogue"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Credits & Mode Catalogue
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-60"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Modes</option>
              <option value="student_submission">Student Submission</option>
              <option value="hod_excel_import">HOD Excel Import</option>
              <option value="both">Both Modes</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Main View Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-xs text-slate-500">Loading component semester matrix...</p>
        </div>
      ) : activeTab === "evidence" ? (
        /* ================= EVIDENCE & PDF RULES VIEW ================= */
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span>Evidence & PDF Requirement Policies</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  All 14 Official Components
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure PDF requirement (Required, Optional, or Disabled) and evidence types per component. Changes apply dynamically to student forms.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  <th className="py-3 px-4 min-w-[200px]">Component Name</th>
                  <th className="py-3 px-3 min-w-[140px]">Student Submission</th>
                  <th className="py-3 px-3 min-w-[230px]">PDF Evidence Requirement</th>
                  <th className="py-3 px-3 min-w-[140px]">Other Evidence</th>
                  <th className="py-3 px-3 min-w-[200px]">Applicable Semesters</th>
                  <th className="py-3 px-3 text-right min-w-[80px]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredComponents.map((comp) => {
                  const isStudentSubmissionAllowed = comp.is_active && comp.submission_mode !== "hod_excel_import";
                  const req = comp.pdf_requirement || (comp.pdf_required ? "required" : "optional");
                  const allowsOther = comp.allow_other_evidence_types ?? false;

                  return (
                    <tr key={comp.component_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                      {/* 1. Component Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {comp.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 mt-0.5">
                            {comp.slug} &bull; {comp.credit_value} Credits
                          </span>
                        </div>
                      </td>

                      {/* 2. Whether student submission is enabled */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                              isStudentSubmissionAllowed
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isStudentSubmissionAllowed ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {isStudentSubmissionAllowed ? "Enabled" : "HOD Import Only"}
                          </span>
                        </div>
                      </td>

                      {/* 3. Whether PDF evidence is required (Independent System Admin selector) */}
                      <td className="py-3.5 px-3">
                        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100/70 dark:bg-slate-800">
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateEvidence(comp.component_id, "pdf_requirement", "required")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                              req === "required"
                                ? "bg-rose-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            title="Mandatory PDF evidence for student submission"
                          >
                            Required
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateEvidence(comp.component_id, "pdf_requirement", "optional")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                              req === "optional"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            title="Optional PDF evidence"
                          >
                            Optional
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateEvidence(comp.component_id, "pdf_requirement", "disabled")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                              req === "disabled"
                                ? "bg-slate-700 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                            title="PDF evidence disabled for this component"
                          >
                            Disabled
                          </button>
                        </div>
                      </td>

                      {/* 4. Whether other evidence types are allowed */}
                      <td className="py-3.5 px-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowsOther}
                            onChange={(e) => handleQuickUpdateEvidence(comp.component_id, "allow_other_evidence_types", e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className={`text-[11px] ${allowsOther ? "text-indigo-600 dark:text-indigo-400 font-semibold" : "text-slate-500"}`}>
                            {allowsOther ? "Allowed (Images/Docs)" : "PDF Only"}
                          </span>
                        </label>
                      </td>

                      {/* 5. Applicable semester settings, respecting existing semester matrix */}
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {matrixData?.semesters.map((s) => {
                            const isSemActive = comp.semesters[String(s.number)] && s.is_enabled;
                            return (
                              <span
                                key={s.id}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isSemActive
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through"
                                }`}
                                title={`Semester ${s.number}: ${isSemActive ? "Active" : "Unavailable"}`}
                              >
                                S{s.number}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(comp)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] transition cursor-pointer"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>Configuring evidence requirements for all 14 official PGPA components.</span>
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              Changes take effect immediately on student submission forms.
            </span>
          </div>
        </div>
      ) : activeTab === "matrix" ? (
        /* ================= MATRIX VIEW ================= */
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  <th className="py-3 px-4 min-w-[220px]">PGPA Component</th>
                  <th className="py-3 px-3 min-w-[90px]">Credits</th>
                  <th className="py-3 px-3 min-w-[130px]">Mode</th>
                  {matrixData?.semesters.map((sem) => (
                    <th key={sem.id} className="py-3 px-2.5 text-center min-w-[70px]">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-slate-900 dark:text-white">Sem {sem.number}</span>
                        <span className={`text-[9px] font-semibold ${sem.is_enabled ? "text-emerald-600" : "text-slate-400"}`}>
                          {sem.is_enabled ? "Active" : "Closed"}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-right min-w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredComponents.map((comp) => (
                  <tr key={comp.component_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                    {/* Component Name & Slug */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {comp.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {comp.slug}
                        </span>
                      </div>
                    </td>

                    {/* Credit Value */}
                    <td className="py-3 px-3">
                      {comp.credit_value === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          GPA (0 cr)
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {comp.credit_value} Credits
                        </span>
                      )}
                    </td>

                    {/* Submission Mode */}
                    <td className="py-3 px-3">
                      {comp.submission_mode === "hod_excel_import" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          HOD Excel Only
                        </span>
                      ) : comp.submission_mode === "both" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Student & HOD
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Student Submission
                        </span>
                      )}
                    </td>

                    {/* Semester 1-8 Toggles */}
                    {matrixData?.semesters.map((sem) => {
                      const isEnabled = comp.semesters[String(sem.number)] ?? true;
                      const cellKey = `${comp.component_id}-${sem.id}`;
                      const isBusy = updatingCell === cellKey;

                      return (
                        <td key={sem.id} className="py-2.5 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleSemester(
                                comp.component_id,
                                sem.id,
                                sem.number,
                                isEnabled
                              )
                            }
                            disabled={isBusy}
                            title={`${comp.name} - Semester ${sem.number}: Click to ${isEnabled ? "Disable" : "Enable"}`}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition cursor-pointer ${
                              isEnabled
                                ? "bg-emerald-500 text-white shadow-xs hover:bg-emerald-600 ring-2 ring-emerald-500/20"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            } ${isBusy ? "opacity-50 cursor-wait animate-pulse" : ""}`}
                          >
                            {isBusy ? (
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            ) : isEnabled ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">&mdash;</span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Row Edit Action */}
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditModal(comp)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold text-[11px] transition cursor-pointer"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <span>Showing {filteredComponents.length} of 14 PGPA components.</span>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                Enabled for Semester
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 inline-block" />
                Disabled for Semester
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ================= CATALOGUE VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredComponents.map((comp) => (
            <div
              key={comp.component_id}
              className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-800 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {comp.name}
                    </h3>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                      {comp.slug}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {comp.credit_value} Credits
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Submission Mode</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {comp.submission_mode.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Grading Strategy</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                      {comp.grading_strategy.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Mentor Verification</span>
                    <span className={`font-semibold ${comp.requires_verification ? "text-emerald-600" : "text-slate-400"}`}>
                      {comp.requires_verification ? "Required" : "Automated (HOD)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">Status</span>
                    <span className={`font-semibold ${comp.is_active ? "text-emerald-600" : "text-rose-500"}`}>
                      {comp.is_active ? "Active" : "Archived"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-500">Visibility Status</span>
                    {comp.is_visible !== false ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Visible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-400 dark:text-slate-500">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        Hidden
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setVisibilityModalComp(comp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    comp.is_visible !== false
                      ? "bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/80 dark:border-slate-700"
                      : "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  {comp.is_visible !== false ? "Hide Component" : "Show Component"}
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(comp)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 text-xs font-semibold text-slate-700 dark:text-slate-300 transition cursor-pointer"
                >
                  Configure Component
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Edit Component Modal */}
      {editingComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Configure {editingComp.name}
                </h3>
                <p className="font-mono text-xs text-slate-400">{editingComp.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingComp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Credit Value (Table B)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={editCredit}
                  onChange={(e) => setEditCredit(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Official guidelines: GATE (4cr), NPTEL (4cr), Innovation (4cr), Online Cert (2cr), Academics (0cr in A1), others (3cr).
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Submission Channel / Mode
                </label>
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="student_submission">Student Submission Only</option>
                  <option value="hod_excel_import">HOD Excel Import Only</option>
                  <option value="both">Both (Student Form & HOD Excel)</option>
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Components with 'HOD Excel Import' can be uploaded in bulk via .xlsx by Department Head.
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Requires Mentor Verification
                  </span>
                  <span className="text-[10px] text-slate-400">
                    If enabled, student drafts require Torch Bearer approval before grading.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editRequiresVerification}
                  onChange={(e) => setEditRequiresVerification(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              {/* PDF Evidence Requirement */}
              <div className="py-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <label className="block font-semibold text-slate-800 dark:text-slate-200">
                  PDF Evidence Requirement
                </label>
                <select
                  value={editPdfRequirement}
                  onChange={(e) => setEditPdfRequirement(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="required">Required — Mandatory PDF attachment to submit</option>
                  <option value="optional">Optional — Evidence upload available, not mandatory</option>
                  <option value="disabled">Disabled — No evidence upload required for submissions</option>
                </select>
                <span className="text-[10px] text-slate-400 block">
                  System Admin control: independently configure whether students must attach a PDF document for this component.
                </span>
              </div>

              {/* Allow Other Evidence Types */}
              <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Allow Other Evidence Types
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Allow students to attach images (.png, .jpg) in addition to PDF documents.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editAllowOtherEvidence}
                  onChange={(e) => setEditAllowOtherEvidence(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Component Active Status
                  </span>
                  <span className="text-[10px] text-slate-400">
                    If deactivated, component will not appear for students or HOD.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingComp(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 4. Visibility Confirmation Modal */}
      {visibilityModalComp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {visibilityModalComp.is_visible !== false ? "Hide Component" : "Show Component"}
                </h3>
                <p className="font-mono text-xs text-slate-400">{visibilityModalComp.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setVisibilityModalComp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {visibilityModalComp.is_visible !== false
                ? "Are you sure you want to hide this component? Students will no longer be able to view or submit new activities under it."
                : "Make this component visible to Students, Mentors and HOD?"}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setVisibilityModalComp(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVisibilityToggle}
                disabled={isUpdatingVisibility}
                className={`px-4 py-2 rounded-xl font-semibold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 ${
                  visibilityModalComp.is_visible !== false
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {isUpdatingVisibility
                  ? "Updating..."
                  : visibilityModalComp.is_visible !== false
                  ? "Hide Component"
                  : "Show Component"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
