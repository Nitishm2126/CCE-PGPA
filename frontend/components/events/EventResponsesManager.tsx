"use client";

import React, { useState, useEffect } from "react";
import { EventItem, EventResponsesResponse, EventSubmissionItem } from "@/types/events";
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";

interface EventResponsesManagerProps {
  event: EventItem;
  onBack: () => void;
}

export const EventResponsesManager: React.FC<EventResponsesManagerProps> = ({ event, onBack }) => {
  const [data, setData] = useState<EventResponsesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"submissions" | "not_submitted">("submissions");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [selectedSubmission, setSelectedSubmission] = useState<EventSubmissionItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  const loadResponses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.getEventResponses(event.id, {
        search: searchQuery || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load event responses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResponses();
  }, [event.id, statusFilter]);

  // View individual submission detail
  const handleViewDetail = async (submissionId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await eventsApi.getSubmissionDetail(event.id, submissionId);
      setSelectedSubmission(detail);
    } catch (err: any) {
      alert("Failed to load submission details: " + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              title="Back to Events"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
              Responses: <span className="text-blue-600 dark:text-[#5DD62C]">{event.title}</span>
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
            View structured student form responses and track participation.
          </p>
        </div>

        {/* Stats Chips */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            {data?.total_submissions || 0} Submitted
          </div>
          <div className="px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold">
            {data?.total_not_submitted || 0} Not Submitted
          </div>
          <button
            type="button"
            onClick={loadResponses}
            className="p-2 rounded-xl border border-slate-200 dark:border-[#292929] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            title="Refresh Responses"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Tabs & Search / Filter Controls */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("submissions")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === "submissions"
                  ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black shadow-2xs"
                  : "bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-[#A3A3A3]"
              }`}
            >
              Registered Responses ({data?.total_submissions || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("not_submitted")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === "not_submitted"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-[#A3A3A3]"
              }`}
            >
              Not Submitted Students ({data?.total_not_submitted || 0})
            </button>
          </div>

          {activeTab === "submissions" && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadResponses()}
                placeholder="Search name, reg number..."
                className="w-48 sm:w-56 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="updated">Updated</option>
                <option value="resubmitted">Resubmitted</option>
              </select>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* Content Table */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading responses...</div>
        ) : activeTab === "submissions" ? (
          data?.submissions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No responses found for this event matching filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#292929] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">
                    <th className="py-2.5 px-3">Register No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Section / Year</th>
                    <th className="py-2.5 px-3">Submission Date</th>
                    <th className="py-2.5 px-3">Version</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#292929]">
                  {data?.submissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-[#202020]/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-[#F5F5F5]">
                        {sub.register_number || "-"}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 dark:text-[#F5F5F5]">{sub.student_name}</p>
                        <p className="text-[10px] text-slate-400">{sub.student_email}</p>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-[#A3A3A3]">
                        Sec {sub.section || "A"} &bull; Year {sub.academic_year || "2"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-[#A3A3A3]">
                        {new Date(sub.submitted_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          v{sub.version_number}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 uppercase">
                          {sub.submission_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleViewDetail(sub.id)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-600 dark:text-[#5DD62C] hover:bg-blue-100 font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                        >
                          View Response
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Not Submitted Students Tab */
          data?.not_submitted_students.length === 0 ? (
            <div className="p-8 text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold">
              ✓ All eligible students have submitted their registration response!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#292929] text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">
                    <th className="py-2.5 px-3">Register No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Section / Year</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#292929]">
                  {data?.not_submitted_students.map((stu) => (
                    <tr
                      key={stu.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-[#202020]/40 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-[#F5F5F5]">
                        {stu.register_number || "-"}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-[#F5F5F5]">
                        {stu.full_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-[#A3A3A3]">{stu.email}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-[#A3A3A3]">
                        Sec {stu.section || "A"} &bull; Year {stu.year || "2"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          Not Submitted
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* INDIVIDUAL RESPONSE DETAIL MODAL */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
                  Form Version {selectedSubmission.version_number} Snapshot
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5] mt-0.5">
                  Submission from {selectedSubmission.student_name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">
                  {selectedSubmission.register_number} &bull; {selectedSubmission.student_email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Submitted at: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(selectedSubmission.submitted_at).toLocaleString()}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 uppercase">
                  {selectedSubmission.submission_status}
                </span>
              </div>

              {/* Dynamic Field Values Display based on the form version */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] block">
                  Submitted Form Answers
                </span>

                {selectedSubmission.form_version?.fields?.map((field) => {
                  if (field.field_type === "title_block" || field.field_type === "heading" || field.field_type === "subheading") {
                    return (
                      <div key={field.id} className="pt-3 border-t border-slate-100 dark:border-[#292929]">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">{field.label}</h4>
                      </div>
                    );
                  }
                  if (["description", "rich_text_block", "divider", "info", "info_card", "image_block", "video_block", "pdf_link", "notice"].includes(field.field_type)) {
                    return null;
                  }

                  const ansObj = selectedSubmission.values?.[field.field_key];
                  const rawVal = ansObj?.value !== undefined ? ansObj.value : ansObj;
                  const token = getStoredToken();

                  const renderFormattedAnswer = (val: any) => {
                    if (val === null || val === undefined || val === "") {
                      return <span className="text-slate-400 italic">Not provided</span>;
                    }
                    if (Array.isArray(val)) {
                      if (val.length === 0) return <span className="text-slate-400 italic">None</span>;
                      if (typeof val[0] === "object" && val[0] !== null) {
                        return (
                          <div className="space-y-1.5 mt-1">
                            {val.map((entry: any, idx: number) => (
                              <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#2d2d2d] text-[11px] space-y-0.5">
                                <span className="font-bold text-slate-600 dark:text-slate-300">Entry #{idx + 1}</span>
                                {typeof entry.original_filename === "string" && (
                                  <div className="flex items-center justify-between gap-2">
                                    <span>📎 {entry.original_filename}</span>
                                    {(entry.file_url || entry.storage_reference) && (
                                      <a
                                        href={resolveEventAssetUrl(entry.file_url || entry.storage_reference, token, true)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-[#5DD62C] underline font-semibold"
                                      >
                                        Download
                                      </a>
                                    )}
                                  </div>
                                )}
                                {!entry.original_filename && Object.entries(entry).map(([k, v]) => (
                                  <div key={k}><span className="text-slate-400">{k}:</span> {String(v)}</div>
                                ))}
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return val.join(", ");
                    }
                    if (typeof val === "object") {
                      if ("start" in val || "end" in val) {
                        return `${val.start || "—"} to ${val.end || "—"}`;
                      }
                      if (val.storage_reference || val.file_url) {
                        const fileHref = resolveEventAssetUrl(val.file_url || val.storage_reference, token, true);
                        const previewHref = resolveEventAssetUrl(val.file_url || val.storage_reference, token, false);
                        return (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>📎 {val.original_filename || val.storage_reference}</span>
                              {fileHref && (
                                <a href={previewHref} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-[#5DD62C] underline font-semibold">
                                  View / Download
                                </a>
                              )}
                            </div>
                            {val.geo?.lat !== undefined && (
                              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                📍 GPS Verified: {Number(val.geo.lat).toFixed(5)}, {Number(val.geo.lng).toFixed(5)} (±{Math.round(val.geo.accuracy || 0)}m)
                              </p>
                            )}
                          </div>
                        );
                      }
                      return JSON.stringify(val);
                    }
                    return String(val);
                  };

                  return (
                    <div
                      key={field.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] space-y-1"
                    >
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3]">
                        {field.label}
                      </p>
                      <div className="text-xs font-medium text-slate-900 dark:text-[#F5F5F5] break-words">
                        {renderFormattedAnswer(rawVal)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Uploaded Files Section */}
              {selectedSubmission.files && selectedSubmission.files.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#292929]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] block">
                    Uploaded Supporting Evidence ({selectedSubmission.files.length})
                  </span>
                  <div className="space-y-2">
                    {selectedSubmission.files.map((file) => {
                      const token = getStoredToken();
                      const previewUrl = resolveEventAssetUrl(file.file_url || file.storage_reference, token, false);
                      const downloadUrl = resolveEventAssetUrl(file.download_url || file.file_url || file.storage_reference, token, true);
                      return (
                        <div
                          key={file.id}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>📎</span>
                            <span className="font-semibold truncate">{file.original_filename}</span>
                            <span className="text-[10px] text-slate-400">
                              ({(file.file_size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">
                              {file.mime_type}
                            </span>
                            {previewUrl && (
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#333] hover:bg-white dark:hover:bg-[#181818] text-[11px] font-semibold text-blue-600 dark:text-[#5DD62C]"
                              >
                                View
                              </a>
                            )}
                            {downloadUrl && (
                              <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black text-[11px] font-semibold"
                              >
                                Download
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-[#292929] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#202020] text-slate-800 dark:text-[#F5F5F5] hover:bg-slate-200 cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
