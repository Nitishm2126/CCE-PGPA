"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api, ApiError } from "@/lib/api-client";
import {
  PGPAComponentResponse,
  SemesterResponse,
  HODImportPreviewResponse,
  HODImportConfirmResult,
  HODImportBatchItem,
  StudentComponentResultItem,
} from "@/types/achievement";

interface HODExcelImportConsoleProps {
  token?: string | null;
}

export const HODExcelImportConsole: React.FC<HODExcelImportConsoleProps> = ({
  token,
}) => {
  // Navigation sub-tabs within HOD Console
  const [subTab, setSubTab] = useState<"import" | "results" | "history">("import");

  // Selection states
  const [components, setComponents] = useState<PGPAComponentResponse[]>([]);
  const [semesters, setSemesters] = useState<SemesterResponse[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  // Loading & feedback states
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // File & Preview states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<HODImportPreviewResponse | null>(null);
  const [confirmResult, setConfirmResult] = useState<HODImportConfirmResult | null>(null);

  // History & Results states
  const [importHistory, setImportHistory] = useState<HODImportBatchItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [componentResults, setComponentResults] = useState<StudentComponentResultItem[]>([]);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [resultsSearch, setResultsSearch] = useState<string>("");

  // Correction Modal state
  const [editingResult, setEditingResult] = useState<StudentComponentResultItem | null>(null);
  const [correctGrade, setCorrectGrade] = useState<string>("O");
  const [correctScore, setCorrectScore] = useState<string>("");
  const [correctReason, setCorrectReason] = useState<string>("");
  const [isSavingCorrection, setIsSavingCorrection] = useState<boolean>(false);

  // Initial Load: Components & Semesters
  const loadMetadata = useCallback(async () => {
    try {
      setLoadingInitial(true);
      const [comps, sems] = await Promise.all([
        api.hodGetEligibleComponents(undefined, token),
        api.studentGetSemesters(token),
      ]);
      setComponents(comps);
      setSemesters(sems);
      if (comps.length > 0) setSelectedComponentId(comps[0].id);
      if (sems.length > 0) setSelectedSemesterId(sems[0].id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load components and semesters.";
      setAlert({ type: "error", message: msg });
    } finally {
      setLoadingInitial(false);
    }
  }, [token]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load History
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const batches = await api.hodGetImportHistory(token);
      setImportHistory(batches);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load import history.";
      setAlert({ type: "error", message: msg });
    } finally {
      setLoadingHistory(false);
    }
  }, [token]);

  // Load Component Results
  const loadResults = useCallback(async () => {
    try {
      setLoadingResults(true);
      const data = await api.hodGetComponentResults(undefined, token);
      setComponentResults(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load department component results.";
      setAlert({ type: "error", message: msg });
    } finally {
      setLoadingResults(false);
    }
  }, [token]);

  useEffect(() => {
    if (subTab === "history") loadHistory();
    if (subTab === "results") loadResults();
  }, [subTab, loadHistory, loadResults]);

  // Handle Download Pre-filled Template
  const handleDownloadTemplate = async () => {
    if (!selectedComponentId || !selectedSemesterId) {
      setAlert({ type: "error", message: "Please select both a component and a semester." });
      return;
    }
    const comp = components.find((c) => c.id === selectedComponentId);
    const sem = semesters.find((s) => s.id === selectedSemesterId);
    try {
      setDownloadingTemplate(true);
      setAlert(null);
      const blob = await api.hodDownloadImportTemplate(selectedComponentId, selectedSemesterId, token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CCE_PGPA_${comp?.slug || "component"}_Sem${sem?.semester_number || 1}_Template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setAlert({
        type: "success",
        message: `Template downloaded successfully with pre-filled cohort student records.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to download template.";
      setAlert({ type: "error", message: msg });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      setPreviewData(null);
      setConfirmResult(null);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setPreviewData(null);
      setConfirmResult(null);
    }
  };

  // Upload and Parse Preview
  const handleUploadAndPreview = async () => {
    if (!selectedFile) {
      setAlert({ type: "error", message: "Please select an Excel or CSV file to upload." });
      return;
    }
    if (!selectedComponentId || !selectedSemesterId) {
      setAlert({ type: "error", message: "Please select both a component and a semester." });
      return;
    }

    try {
      setIsUploading(true);
      setAlert(null);
      setPreviewData(null);
      setConfirmResult(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("component_id", selectedComponentId);
      formData.append("semester_id", selectedSemesterId);

      const preview = await api.hodPreviewImport(formData, token);
      setPreviewData(preview);
      if (preview.valid_rows > 0) {
        setAlert({
          type: "info",
          message: `Preview generated: ${preview.valid_rows} valid rows ready for transactional commit. Review rows below and click 'Confirm Import Batch'.`,
        });
      } else {
        setAlert({
          type: "error",
          message: `Preview generated with 0 valid rows. Please check error descriptions in table below.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse upload spreadsheet.";
      setAlert({ type: "error", message: msg });
    } finally {
      setIsUploading(false);
    }
  };

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!previewData || !previewData.preview_token) return;
    try {
      setIsConfirming(true);
      setAlert(null);
      const res = await api.hodConfirmImport(previewData.preview_token, token);
      setConfirmResult(res);
      setPreviewData(null);
      setSelectedFile(null);
      setAlert({
        type: "success",
        message: `${res.message} Students' PGPA scores have been recalculated.`,
      });
      // Refresh results in background
      loadResults();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import transaction failed.";
      setAlert({ type: "error", message: msg });
    } finally {
      setIsConfirming(false);
    }
  };

  // Open Correction Modal
  const openCorrection = (res: StudentComponentResultItem) => {
    setEditingResult(res);
    setCorrectGrade(res.grade || "O");
    setCorrectScore(res.raw_score !== null && res.raw_score !== undefined ? String(res.raw_score) : "");
    setCorrectReason("");
  };

  // Save Correction
  const handleSaveCorrection = async () => {
    if (!editingResult) return;
    if (!correctReason.trim()) {
      setAlert({ type: "error", message: "A justification reason is required for HOD grade corrections." });
      return;
    }
    try {
      setIsSavingCorrection(true);
      setAlert(null);
      await api.hodCorrectComponentResult(
        editingResult.id,
        {
          grade: correctGrade,
          raw_score: correctScore ? parseFloat(correctScore) : undefined,
          reason: correctReason.trim(),
        },
        token
      );
      setAlert({
        type: "success",
        message: `Successfully corrected grade for ${editingResult.student_name}. Student PGPA recalculated.`,
      });
      setEditingResult(null);
      loadResults();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save grade correction.";
      setAlert({ type: "error", message: msg });
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // Filtered department results
  const filteredResults = useMemo(() => {
    if (!componentResults) return [];
    if (!resultsSearch.trim()) return componentResults;
    const q = resultsSearch.toLowerCase().trim();
    return componentResults.filter((r) =>
      (r.student_name && r.student_name.toLowerCase().includes(q)) ||
      (r.student_register_number && r.student_register_number.toLowerCase().includes(q)) ||
      (r.component_name && r.component_name.toLowerCase().includes(q))
    );
  }, [componentResults, resultsSearch]);

  const activeCompObj = components.find((c) => c.id === selectedComponentId);
  const activeSemObj = semesters.find((s) => s.id === selectedSemesterId);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
                HOD Component Excel Import & Department Grading
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate pre-filled student templates, upload batch spreadsheets, review row validations, and trigger automated PGPA calculation.
            </p>
          </div>

          {/* Sub Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSubTab("import")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                subTab === "import"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Batch Upload
            </button>
            <button
              type="button"
              onClick={() => setSubTab("results")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                subTab === "results"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Verified Results ({componentResults.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab("history")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                subTab === "history"
                  ? "bg-purple-700 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Import History
            </button>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-center justify-between border ${
              alert.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : alert.type === "info"
                ? "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
            }`}
          >
            <span>{alert.message}</span>
            <button type="button" onClick={() => setAlert(null)} className="text-slate-400 hover:text-slate-600">
              &times;
            </button>
          </div>
        )}
      </div>

      {/* 2. Sub-Tab 1: BATCH IMPORT WORKFLOW */}
      {subTab === "import" && (
        <div className="space-y-6">
          {/* Step 1 & 2: Component Selection & Template Download */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 1: Select PGPA Component & Academic Semester
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  PGPA Component
                </label>
                <select
                  value={selectedComponentId}
                  onChange={(e) => {
                    setSelectedComponentId(e.target.value);
                    setPreviewData(null);
                    setConfirmResult(null);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.credit_value ?? 3} Cr - {c.submission_mode?.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Academic Semester
                </label>
                <select
                  value={selectedSemesterId}
                  onChange={(e) => {
                    setSelectedSemesterId(e.target.value);
                    setPreviewData(null);
                    setConfirmResult(null);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name} {s.is_enabled ? "(Active)" : "(Closed)"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 ${downloadingTemplate ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>{downloadingTemplate ? "Generating Template..." : "Download Pre-filled Template (.xlsx)"}</span>
                </button>
              </div>
            </div>

            {/* Active Component Guide Info */}
            {activeCompObj && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">{activeCompObj.name}</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-purple-600 dark:text-purple-400 font-semibold">{activeCompObj.credit_value ?? 3} Credits</span>
                  <span className="text-slate-400">&bull;</span>
                  <span className="text-slate-500 capitalize">{activeCompObj.grading_strategy || "Table B"}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Pre-filled template includes all active CCE department students with register numbers and names.
                </span>
              </div>
            )}
          </div>

          {/* Step 3: Drag & Drop File Upload */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Step 2: Upload Completed Spreadsheet (.xlsx or .csv)
            </h2>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer ${
                dragActive
                  ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
                  : "border-slate-200 dark:border-slate-700 hover:border-purple-400 bg-slate-50/50 dark:bg-slate-800/20"
              }`}
            >
              <input
                id="file-upload-input"
                type="file"
                accept=".xlsx,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload-input" className="cursor-pointer block">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                {selectedFile ? (
                  <div>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white block">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click or drag to replace
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">
                      Click to choose file or drag & drop here
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Accepts official Excel template (.xlsx) or CSV file (Max 5MB)
                    </span>
                  </div>
                )}
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Uploaded data is validated against active student rosters before confirmation.
              </span>
              <button
                type="button"
                onClick={handleUploadAndPreview}
                disabled={!selectedFile || isUploading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <svg className={`w-4 h-4 ${isUploading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>{isUploading ? "Parsing Spreadsheet..." : "Inspect & Preview Rows"}</span>
              </button>
            </div>
          </div>

          {/* Step 4: Preview Table & Confirmation Action */}
          {previewData && (
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Step 3: Import Preview & Validation Audit
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {previewData.summary_message}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {previewData.valid_rows} Valid
                  </span>
                  {previewData.error_rows > 0 && (
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      {previewData.error_rows} Errors
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={previewData.valid_rows === 0 || isConfirming}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <svg className={`w-4 h-4 ${isConfirming ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{isConfirming ? "Committing..." : `Confirm Import (${previewData.valid_rows} Records)`}</span>
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Register Number</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Uploaded Value</th>
                      <th className="py-2.5 px-3 text-center">Calculated Grade</th>
                      <th className="py-2.5 px-3 text-center">Grade Points</th>
                      <th className="py-2.5 px-3">Validation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewData.rows.map((r) => (
                      <tr
                        key={r.row_number}
                        className={
                          r.is_valid
                            ? "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                            : "bg-rose-50/40 dark:bg-rose-950/20"
                        }
                      >
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{r.row_number}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {r.register_number}
                        </td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                          {r.student_name || "—"}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {r.result_value}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {r.calculated_grade ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {r.calculated_grade}
                            </span>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {r.grade_points !== null && r.grade_points !== undefined ? r.grade_points : "—"}
                        </td>
                        <td className="py-2 px-3">
                          {r.is_valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                              </svg>
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-[11px]" title={r.error_message || ""}>
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{r.error_message}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm Success Box */}
          {confirmResult && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 p-6 shadow-xs text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 mx-auto flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-extrabold text-base text-emerald-900 dark:text-emerald-200">
                Import Batch Committed Successfully!
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-md mx-auto">
                {confirmResult.imported_count} student results for {confirmResult.component_name} ({confirmResult.semester_name}) have been recorded and PGPA scores recalculated.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSubTab("results")}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                >
                  View Department Results
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Sub-Tab 2: VERIFIED RESULTS & HOD CORRECTION */}
      {subTab === "results" && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                Department Component Results & PGPA Breakdown
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified grades from HOD Excel imports and mentor approvals. Authorized corrections recalculate student PGPA.
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search by student or register #..."
                value={resultsSearch}
                onChange={(e) => setResultsSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-60 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {loadingResults ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent mb-2" />
              <p>Loading results...</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No component results match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Register #</th>
                    <th className="py-2.5 px-3">Component</th>
                    <th className="py-2.5 px-3 text-center">Semester</th>
                    <th className="py-2.5 px-3 text-center">Credits</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                    <th className="py-2.5 px-3 text-center">Grade Points</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredResults.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {r.student_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {r.student_register_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                        {r.component_name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                        Sem {r.semester_number}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {r.credit_value} cr
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-extrabold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {r.grade || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        {r.grade_points ?? "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          {r.source.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openCorrection(r)}
                          className="px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold text-[11px] transition cursor-pointer"
                        >
                          Correct
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. Sub-Tab 3: IMPORT HISTORY */}
      {subTab === "history" && (
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
              HOD Excel Import Batch Audit Log
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Historical record of all bulk uploads, source filenames, valid row tallies, and timestamps.
            </p>
          </div>

          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Loading batch history...
            </div>
          ) : importHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No historical batches recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                    <th className="py-2.5 px-3">Batch ID</th>
                    <th className="py-2.5 px-3">Component</th>
                    <th className="py-2.5 px-3">Semester</th>
                    <th className="py-2.5 px-3">Filename</th>
                    <th className="py-2.5 px-3 text-center">Valid / Total</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Uploaded By</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {importHistory.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                        {b.id.substring(0, 8)}...
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {b.component_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                        {b.semester_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {b.source_filename}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                        {b.valid_rows} / {b.total_rows}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 capitalize">
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {b.uploaded_by_name || "Department HOD"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. HOD Grade Correction Modal */}
      {editingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  HOD Grade Correction
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingResult.student_name} ({editingResult.student_register_number})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingResult(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Component</span>
                  <span className="font-bold text-slate-900 dark:text-white">{editingResult.component_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Semester</span>
                  <span className="font-bold text-slate-900 dark:text-white">Sem {editingResult.semester_number}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Corrected Grade (Table B)
                </label>
                <select
                  value={correctGrade}
                  onChange={(e) => setCorrectGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                >
                  <option value="O">O &mdash; Outstanding (10 Points)</option>
                  <option value="A+">A+ &mdash; Excellent (9 Points)</option>
                  <option value="A">A &mdash; Very Good (7 Points)</option>
                  <option value="B+">B+ &mdash; Good (5 Points)</option>
                  <option value="B">B &mdash; Above Average (3 Points)</option>
                  <option value="C">C &mdash; Average (1 Point)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Raw Score / GPA (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={correctScore}
                  onChange={(e) => setCorrectScore(e.target.value)}
                  placeholder="e.g. 8.75 or 550"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Justification / Reason (Mandatory for Audit Trail)
                </label>
                <textarea
                  rows={3}
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  placeholder="State the institutional reason for grade adjustment (e.g. university re-evaluation, verified physical certificate)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingResult(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCorrection}
                disabled={isSavingCorrection || !correctReason.trim()}
                className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isSavingCorrection ? "Saving & Recalculating..." : "Apply & Recalculate PGPA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
