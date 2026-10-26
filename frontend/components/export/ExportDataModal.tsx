"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { PGPAComponentResponse, SemesterResponse } from "@/types/achievement";

export interface ExportStudentOption {
  id: string;
  full_name: string;
  register_number?: string | null;
}

interface ExportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: "mentor" | "hod";
  students: ExportStudentOption[];
  components?: PGPAComponentResponse[];
  semesters?: SemesterResponse[];
  token?: string | null;
  initialStudentId?: string;
}

export const ExportDataModal: React.FC<ExportDataModalProps> = ({
  isOpen,
  onClose,
  role,
  students,
  components: propComponents,
  semesters: propSemesters,
  token,
  initialStudentId,
}) => {
  const [format, setFormat] = useState<"excel" | "pdf">("excel");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || "all");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("all");
  const [selectedComponentId, setSelectedComponentId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [components, setComponents] = useState<PGPAComponentResponse[]>(propComponents || []);
  const [semesters, setSemesters] = useState<SemesterResponse[]>(propSemesters || []);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Sync initial student id if provided
  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  // Fetch components/semesters if not supplied
  useEffect(() => {
    if (!isOpen) return;
    if (!propComponents || propComponents.length === 0) {
      api.getComponents({ token }).then(setComponents).catch(() => {});
    }
    if (!propSemesters || propSemesters.length === 0) {
      api.getSemesters(token).then(setSemesters).catch(() => {});
    }
  }, [isOpen, propComponents, propSemesters, token]);

  if (!isOpen) return null;

  const handleExecuteExport = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      setDownloadSuccess(false);

      const filters = {
        semester_id: selectedSemesterId !== "all" ? selectedSemesterId : undefined,
        component_id: selectedComponentId !== "all" ? selectedComponentId : undefined,
        student_id: selectedStudentId !== "all" ? selectedStudentId : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
      };

      let result: { blob: Blob; filename: string };
      if (role === "mentor") {
        result = await api.exportMentorReport(format, filters, token);
      } else {
        result = await api.exportHODReport(format, filters, token);
      }

      // Trigger automatic browser download
      const blobUrl = window.URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate report export.";
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const roleTitle = role === "mentor" ? "Faculty Mentor" : "Department HOD";
  const defaultScopeLabel = role === "mentor" ? "All Assigned Mentees" : "All Department Students";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Export Academic Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                CCE Achieve PGPA Assessment Data • {roleTitle} Access
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Error Alert */}
        {exportError && (
          <div className="p-3 text-xs bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200 rounded-xl border border-rose-200 dark:border-rose-900/60 flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{exportError}</span>
          </div>
        )}

        {/* Success Alert */}
        {downloadSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">Report generated and download started successfully!</span>
          </div>
        )}

        {/* 1. Format Selector Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Export Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Excel Option */}
            <div
              onClick={() => setFormat("excel")}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                format === "excel"
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/50"
              }`}
            >
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>Excel Workbook (.xlsx)</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                    Multi-Tab
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  4 separate worksheets: Summary, 8-Semester Matrix, 14 Component Breakdown, and Submissions.
                </p>
              </div>
            </div>

            {/* PDF Option */}
            <div
              onClick={() => setFormat("pdf")}
              className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                format === "pdf"
                  ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-sm"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-800/50"
              }`}
            >
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>Printable PDF (.pdf)</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                    Official
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Landscape layout with institutional header, summary metrics, semester matrix, and page counts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Filter Controls */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Report Scope &amp; Filters
          </label>

          {/* Student / Scope Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Cohort Scope / Individual Student Report
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={isExporting}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">
                -- {defaultScopeLabel} ({students.length} students) --
              </option>
              {students.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.register_number ? `${st.register_number} — ` : ""}
                  {st.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Semester Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Semester
              </label>
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                disabled={isExporting}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Semesters (1 to 8)</option>
                {semesters.map((sem) => (
                  <option key={sem.id} value={sem.id}>
                    {sem.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Component Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                PGPA Component
              </label>
              <select
                value={selectedComponentId}
                onChange={(e) => setSelectedComponentId(e.target.value)}
                disabled={isExporting}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none truncate"
              >
                <option value="all">All 14 Components</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Submission Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={isExporting}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="all">All Submissions</option>
                <option value="approved">Approved Only</option>
                <option value="pending">Pending Review Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Informational Scope Note */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>Role-Based Access Enforcement</span>
          </div>
          <p className="leading-relaxed">
            {role === "mentor"
              ? "Exports are strictly restricted to students actively assigned to your faculty mentor account."
              : "Exports are strictly restricted to enrolled students within your department supervisory scope."}
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting}
            className={`px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 ${
              format === "excel"
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-rose-600 hover:bg-rose-500"
            }`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Generating {format.toUpperCase()}...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Download {format === "excel" ? "Excel Report (.xlsx)" : "PDF Report (.pdf)"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
