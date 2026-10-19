"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ProvisioningPreviewResponse,
  ProvisioningExecuteResponse,
  ProvisioningPreviewItem,
  ProvisioningResultItem,
} from "@/types/auth";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface BulkProvisioningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkProvisioningModal: React.FC<BulkProvisioningModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();

  // State
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ProvisioningPreviewResponse | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeResult, setExecuteResult] = useState<ProvisioningExecuteResponse | null>(null);

  // User confirmations
  const [confirmed, setConfirmed] = useState(false);
  const [resetExistingPasswords, setResetExistingPasswords] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Fetch dry-run preview when modal opens
  useEffect(() => {
    if (!isOpen || !token) return;

    let isMounted = true;
    const fetchPreview = async () => {
      try {
        setLoadingPreview(true);
        setPreviewError(null);
        setExecuteResult(null);
        setExecuteError(null);
        setConfirmed(false);
        const res = await api.getProvisioningPreview(token);
        if (isMounted) {
          setPreviewData(res);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Failed to load provisioning dry-run preview.";
          setPreviewError(msg);
        }
      } finally {
        if (isMounted) {
          setLoadingPreview(false);
        }
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [isOpen, token]);

  // Filter items in dry run table
  const filteredItems = useMemo(() => {
    if (!previewData?.items) return [];
    return previewData.items.filter((item: ProvisioningPreviewItem) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.full_name.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchRole =
        roleFilter === "all" || item.role === roleFilter;

      return matchQuery && matchStatus && matchRole;
    });
  }, [previewData, searchQuery, statusFilter, roleFilter]);

  // Execute provisioning handler
  const handleExecute = async () => {
    if (!token || !confirmed) return;

    try {
      setIsExecuting(true);
      setExecuteError(null);
      const res = await api.executeProvisioning(
        {
          confirm: true,
          initial_password: previewData?.initial_password || "cce@123",
          reset_existing_passwords: resetExistingPasswords,
        },
        token
      );
      setExecuteResult(res);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Bulk provisioning failed to execute.";
      setExecuteError(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="provisioning-modal-title"
    >
      <div className="relative w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-sky-50/70 via-indigo-50/30 to-white dark:from-slate-900 dark:to-slate-800/80 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-sm">
                ⚡
              </span>
              <h3
                id="provisioning-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Bulk Login Account Provisioning
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                Firebase Email/Password
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Audit PostgreSQL user directory against Firebase Authentication, preview account actions, and safely provision missing credentials with mandatory first-login password change.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isExecuting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-900 dark:text-slate-100">
          {/* Loading Dry-Run State */}
          {loadingPreview && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Auditing PostgreSQL directory and inspecting Firebase Authentication accounts...
              </p>
              <p className="text-xs text-slate-400">Preparing read-only dry-run preview.</p>
            </div>
          )}

          {/* Error State */}
          {previewError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-600">⚠</span>
                <span>{previewError}</span>
              </div>
              <button
                onClick={() => {
                  setLoadingPreview(true);
                  api.getProvisioningPreview(token)
                    .then((d) => {
                      setPreviewData(d);
                      setPreviewError(null);
                    })
                    .catch((e) => setPreviewError(e.message))
                    .finally(() => setLoadingPreview(false));
                }}
                className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* Execution Error Banner */}
          {executeError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <span>⚠ Provisioning Execution Error</span>
              </div>
              <p className="text-xs">{executeError}</p>
            </div>
          )}

          {/* Execution Completed Summary */}
          {executeResult && (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                    ✓
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                      Provisioning Execution Completed
                    </h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      {executeResult.message}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold bg-emerald-200/70 dark:bg-emerald-900/60 px-2.5 py-1 rounded-md">
                  {executeResult.total_processed} processed
                </span>
              </div>

              {/* Execution Metric Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Created in Firebase</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {executeResult.created_count}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Reused & Linked</span>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {executeResult.reused_count}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Skipped (Active)</span>
                  <p className="text-xl font-black text-slate-600 dark:text-slate-400 mt-0.5">
                    {executeResult.skipped_count}
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Failed</span>
                  <p className={`text-xl font-black mt-0.5 ${executeResult.failed_count > 0 ? "text-rose-600" : "text-slate-400"}`}>
                    {executeResult.failed_count}
                  </p>
                </div>
              </div>

              {/* Execution Details Table */}
              <div className="border border-emerald-200 dark:border-emerald-800/80 rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-56 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3 font-semibold">User Email</th>
                      <th className="py-2 px-3 font-semibold">Role</th>
                      <th className="py-2 px-3 font-semibold">Action</th>
                      <th className="py-2 px-3 font-semibold">Firebase UID</th>
                      <th className="py-2 px-3 font-semibold">Status / Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {executeResult.details.map((item: ProvisioningResultItem) => (
                      <tr key={item.user_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">
                          {item.email}
                        </td>
                        <td className="py-2 px-3 capitalize text-slate-600 dark:text-slate-400">
                          {item.role}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.action === "created"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : item.action === "reused_linked"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : item.action === "failed"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {item.action.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                          {item.firebase_uid || "—"}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                          {item.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dry-Run Preview Content (shown when previewData is loaded and not currently finished executing) */}
          {previewData && !loadingPreview && !executeResult && (
            <>
              {/* Institutional Safety Advisory & Admin Preservation Banner */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 dark:border-sky-900/60 dark:bg-sky-950/30 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
                    <span>🛡</span> Safety & Compliance Verification
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-200/70 text-sky-900 dark:bg-sky-900 dark:text-sky-200 text-[11px] font-bold">
                    Dry-Run Mode
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <p>
                    • <strong>Initial Password:</strong> <code className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-sky-300 font-bold text-sky-800 dark:text-sky-300">cce@123</code>
                  </p>
                  <p>
                    • <strong>First Login Rule:</strong> Mandatory password change will be enforced immediately upon login.
                  </p>
                  <p>
                    • <strong>Admin Account:</strong> Preserved untouched (<code className="font-mono text-sky-900 dark:text-sky-300">{previewData.admin_account_email}</code>).
                  </p>
                  <p>
                    • <strong>Mentor Assignments:</strong> Existing student-mentor relationships are strictly preserved.
                  </p>
                </div>
              </div>

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Total Users</span>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                    {previewData.total_users}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {previewData.by_role.student || 0}S &bull; {previewData.by_role.mentor || 0}M &bull; {previewData.by_role.hod || 0}H
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Need Creation</span>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {previewData.needs_creation_count}
                  </p>
                  <span className="text-[10px] text-amber-600/80">Missing from Firebase</span>
                </div>

                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Already Linked</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {previewData.already_linked_count}
                  </p>
                  <span className="text-[10px] text-emerald-600/80">Active credentials</span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Unlinked in FB</span>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {previewData.exists_unlinked_count}
                  </p>
                  <span className="text-[10px] text-slate-400">Will link UID</span>
                </div>

                <div className={`rounded-xl border p-3 text-center ${previewData.conflicts_count > 0 ? "border-rose-300 bg-rose-50 dark:bg-rose-950/40" : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60"}`}>
                  <span className={`text-[10px] uppercase font-bold ${previewData.conflicts_count > 0 ? "text-rose-700 dark:text-rose-400" : "text-slate-500"}`}>
                    Conflicts
                  </span>
                  <p className={`text-2xl font-black mt-0.5 ${previewData.conflicts_count > 0 ? "text-rose-600" : "text-slate-900 dark:text-white"}`}>
                    {previewData.conflicts_count}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {previewData.invalid_email_count > 0 ? `${previewData.invalid_email_count} invalid emails` : "0 invalid emails"}
                  </span>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 pl-9 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-800 dark:text-white"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <option value="all">All Statuses ({previewData.items.length})</option>
                    <option value="needs_creation">Needs Creation ({previewData.needs_creation_count})</option>
                    <option value="already_linked">Already Linked ({previewData.already_linked_count})</option>
                    <option value="exists_unlinked">Unlinked in Firebase ({previewData.exists_unlinked_count})</option>
                    <option value="conflict">Conflicts ({previewData.conflicts_count})</option>
                  </select>

                  {/* Role Filter */}
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <option value="all">All Roles</option>
                    <option value="student">Students ({previewData.by_role.student || 0})</option>
                    <option value="mentor">Mentors ({previewData.by_role.mentor || 0})</option>
                    <option value="hod">HOD ({previewData.by_role.hod || 0})</option>
                    <option value="admin">Admin ({previewData.by_role.admin || 0})</option>
                  </select>
                </div>
              </div>

              {/* Dry-Run Details Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-64 overflow-y-auto shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3.5 font-semibold">User Details</th>
                      <th className="py-2.5 px-3 font-semibold">Role</th>
                      <th className="py-2.5 px-3 font-semibold">Status Action</th>
                      <th className="py-2.5 px-3 font-semibold">PostgreSQL UID</th>
                      <th className="py-2.5 px-3.5 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No matching records found for the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr
                          key={item.user_id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3.5">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {item.full_name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {item.email}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 capitalize">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.role === "student"
                                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300"
                                  : item.role === "mentor"
                                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                                  : item.role === "hod"
                                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {item.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === "needs_creation"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                  : item.status === "already_linked"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : item.status === "exists_unlinked"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              }`}
                            >
                              {item.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                            {item.firebase_uid ? item.firebase_uid.slice(0, 14) + "..." : "None"}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-400 text-[11px]">
                            {item.notes}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Admin Confirmation Safety Controls */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    <strong>Admin Confirmation:</strong> I confirm provisioning {previewData.needs_creation_count} missing user accounts in Firebase Authentication using initial password <code className="font-bold text-blue-600">cce@123</code>. Newly provisioned accounts will be required to change their password on first login.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none pl-6">
                  <input
                    type="checkbox"
                    checked={resetExistingPasswords}
                    onChange={(e) => setResetExistingPasswords(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Reset passwords for the {previewData.already_linked_count} already linked accounts (Not recommended; leave unchecked to preserve current credentials).
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            {executeResult ? "Done / Close" : "Cancel"}
          </button>

          {!executeResult ? (
            <button
              type="button"
              onClick={handleExecute}
              disabled={!confirmed || isExecuting || loadingPreview || (previewData?.needs_creation_count === 0 && !resetExistingPasswords)}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isExecuting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Provisioning Accounts...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>
                    Execute Bulk Provisioning ({previewData?.needs_creation_count || 0} Accounts)
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-500/20 transition"
            >
              <span>✓</span>
              <span>Complete & Return to Console</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
