"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import {
  SemesterResponse,
  SemesterDriveAuditReport,
  SemesterDriveProvisionResponse,
} from "@/types/achievement";

interface SemesterManagementConsoleProps {
  token?: string | null;
}

export const SemesterManagementConsole: React.FC<SemesterManagementConsoleProps> = ({
  token,
}) => {
  const [semesters, setSemesters] = useState<SemesterResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);

  // Disable Warning Modal
  const [pendingToggle, setPendingToggle] = useState<{
    semester: SemesterResponse;
    targetStatus: boolean;
  } | null>(null);

  // Drive Audit & Provisioning State
  const [auditReport, setAuditReport] = useState<SemesterDriveAuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [provisionResult, setProvisionResult] = useState<SemesterDriveProvisionResponse | null>(null);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [showLiveProvisionModal, setShowLiveProvisionModal] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>("");

  const fetchSemesters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.adminGetSemesters(token);
      setSemesters(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load semesters.";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  const handleToggleStatus = async (semester: SemesterResponse, targetStatus: boolean) => {
    if (!targetStatus && semester.is_enabled) {
      // Prompt confirmation before disabling
      setPendingToggle({ semester, targetStatus });
      return;
    }
    await executeToggle(semester.id, targetStatus);
  };

  const executeToggle = async (semesterId: string, isEnabled: boolean) => {
    try {
      setTogglingId(semesterId);
      setActionMessage(null);
      const updated = await api.adminUpdateSemesterStatus(semesterId, isEnabled, token);
      setSemesters((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      setActionMessage({
        type: "success",
        text: `${updated.display_name} has been ${
          updated.is_enabled ? "enabled for submissions" : "closed for new submissions"
        }. Existing records remain safely preserved.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update semester status.";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setTogglingId(null);
      setPendingToggle(null);
    }
  };

  const handleRunAudit = async () => {
    try {
      setIsAuditing(true);
      setActionMessage(null);
      const report = await api.adminGetSemesterDriveAudit(token);
      setAuditReport(report);
      setActionMessage({
        type: "success",
        text: `Drive audit completed: Inspected ${report.total_students} student folders across Semesters ${report.target_semesters.join(", ")}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Drive audit failed.";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleExecuteProvisioning = async (dryRun: boolean) => {
    try {
      setIsProvisioning(true);
      setActionMessage(null);
      const res = await api.adminProvisionSemesterDriveFolders(dryRun, token);
      setProvisionResult(res);
      setShowLiveProvisionModal(false);
      setActionMessage({
        type: "success",
        text: res.message,
      });
      // Refresh audit
      handleRunAudit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Drive folder provisioning failed.";
      setActionMessage({ type: "error", text: msg });
    } finally {
      setIsProvisioning(false);
    }
  };

  const filteredStudents = auditReport
    ? auditReport.students.filter(
        (s) =>
          s.student_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.register_number.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* 1. Academic Configuration Header */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Academic Configuration
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="text-xs text-slate-500">Curriculum Controls</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              Semester Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control availability of all eight academic semesters for PGPA student achievement submissions.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSemesters}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh Semesters</span>
          </button>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div
            className={`mt-4 p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
              actionMessage.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                : actionMessage.type === "warning"
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/60"
            }`}
          >
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium leading-relaxed">{actionMessage.text}</span>
          </div>
        )}

        {/* Semesters Grid */}
        <div className="mt-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="h-7 w-7 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto" />
              <p className="mt-2 text-xs text-slate-500">Loading semester configurations...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {semesters.map((sem) => {
                const isToggling = togglingId === sem.id;
                return (
                  <div
                    key={sem.id}
                    className={`p-4 rounded-xl border transition-all ${
                      sem.is_enabled
                        ? "bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-800/50 border-emerald-200 dark:border-emerald-800/60 shadow-xs"
                        : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 opacity-90"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Semester {sem.semester_number}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          {sem.display_name}
                        </h3>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sem.is_enabled
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            sem.is_enabled ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {sem.is_enabled ? "Open" : "Closed"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {sem.is_enabled
                        ? "Currently selectable by students on the achievement submission form."
                        : "Closed for new submissions. Historical records remain fully accessible."}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        SEM-{sem.semester_number}
                      </span>
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleStatus(sem, !sem.is_enabled)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                          sem.is_enabled
                            ? "border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
                        }`}
                      >
                        {isToggling ? (
                          <span className="w-3 h-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : null}
                        <span>{sem.is_enabled ? "Disable" : "Enable"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Google Drive Semester Folders Architecture & Provisioning */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Storage Architecture
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              Google Drive Semester Folder Provisioning
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hierarchical evidence storage inside each student&apos;s folder for Semesters 1, 2, and 3.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunAudit}
              disabled={isAuditing}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition flex items-center gap-1.5"
            >
              {isAuditing ? (
                <span className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              )}
              <span>Run Dry-Run Audit</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLiveProvisionModal(true)}
              disabled={isProvisioning}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Provision Semesters 1–3</span>
            </button>
          </div>
        </div>

        {/* Folder Hierarchy Breadcrumb Card */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            Intended Drive Directory Hierarchy:
          </div>
          <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            CCE-PGPA Evidence (Root: 1Qdkvrmb8XDZQSEAhSbrbuIRzaYbR2gWI) &rarr; Student Folder ({`{REG_NO}_{NAME}`}) &rarr; Semester 1 / Semester 2 / Semester 3
          </p>
        </div>

        {/* Audit Report Findings */}
        {auditReport && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Audited Students: {auditReport.total_students} | Target Semesters: {auditReport.target_semesters.join(", ")}
              </span>

              <input
                type="text"
                placeholder="Search students in audit..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Register No</th>
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Student Folder</th>
                    <th className="px-4 py-3 text-center">Semester 1</th>
                    <th className="px-4 py-3 text-center">Semester 2</th>
                    <th className="px-4 py-3 text-center">Semester 3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.slice(0, 20).map((st) => (
                    <tr key={st.student_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {st.register_number}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                        {st.student_name}
                      </td>
                      <td className="px-4 py-2.5">
                        {st.has_student_folder ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {st.existing_student_folder_id?.slice(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                            Missing
                          </span>
                        )}
                      </td>
                      {st.semesters.map((sem) => (
                        <td key={sem.semester_number} className="px-4 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              sem.status === "EXISTS_MAPPED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : sem.status === "EXISTS_IN_DRIVE"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {sem.status === "EXISTS_MAPPED"
                              ? "Mapped"
                              : sem.status === "EXISTS_IN_DRIVE"
                              ? "Found in Drive"
                              : "Missing"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredStudents.length > 20 && (
              <p className="text-[11px] text-slate-400 text-center">
                Showing first 20 of {filteredStudents.length} students. Use search to filter.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Disabling a Semester */}
      {pendingToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Disable {pendingToggle.semester.display_name}?
                </h3>
                <p className="text-xs text-slate-500">
                  Please confirm closing this academic semester.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Disabling this semester will exclude it from new student achievement submissions.
              All existing achievements, verification reviews, and evidence files in Google Drive
              will remain completely intact and accessible.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPendingToggle(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeToggle(pendingToggle.semester.id, false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Disable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Live Folder Provisioning */}
      {showLiveProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Provision Semesters 1–3 Folders
                </h3>
                <p className="text-xs text-slate-500">
                  Execute live subfolder provisioning in Google Drive
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-600 dark:text-slate-300">
              <p>
                <strong>What this operation does:</strong>
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Inspects all 61 student folders under the parent Google Drive folder.</li>
                <li>Creates missing &quot;Semester 1&quot;, &quot;Semester 2&quot;, and &quot;Semester 3&quot; subfolders inside each respective student folder.</li>
                <li>Reuses any existing matching semester folders without creating duplicates.</li>
                <li>Persists the mapping in the PostgreSQL database.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowLiveProvisionModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProvisioning}
                onClick={() => handleExecuteProvisioning(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
              >
                {isProvisioning ? (
                  <>
                    <span className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Provisioning Folders...</span>
                  </>
                ) : (
                  <span>Start Live Provisioning</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
