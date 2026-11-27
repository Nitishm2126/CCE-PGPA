"use client";

import React, { useState, useEffect } from "react";
import { EventItem, EventStatus } from "@/types/events";
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { EventStatusBadge, EventModeBadge } from "@/components/events/EventStatusBadge";
import { EventCreateModal } from "@/components/events/EventCreateModal";
import { EventFormBuilder } from "@/components/events/EventFormBuilder";
import { EventResponsesManager } from "@/components/events/EventResponsesManager";
import { SemesterResponse } from "@/types/achievement";
import { api, getStoredToken } from "@/lib/api-client";

interface AdminEventsConsoleProps {
  userRole?: string;
  semesters?: SemesterResponse[];
}

export const AdminEventsConsole: React.FC<AdminEventsConsoleProps> = ({ userRole = "admin", semesters = [] }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [semestersList, setSemestersList] = useState<SemesterResponse[]>(semesters);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (semesters && semesters.length > 0) {
      setSemestersList(semesters);
    } else {
      api
        .getSemesters()
        .then((res) => {
          if (res && Array.isArray(res)) {
            setSemestersList(res);
          }
        })
        .catch((e) => {
          console.error("Failed to load semesters in AdminEventsConsole", e);
        });
    }
  }, [semesters]);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [semesterFilter, setSemesterFilter] = useState<string>("all");

  // Sub-views
  const [viewState, setViewState] = useState<"list" | "form_builder" | "responses">("list");
  const [activeEvent, setActiveEvent] = useState<EventItem | null>(null);

  // Modals & Delete Confirmation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load events
  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.listEvents({
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
        semester_id: semesterFilter !== "all" ? semesterFilter : undefined,
      });
      setEvents(res.events || []);
    } catch (err: any) {
      setError(err.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [statusFilter, semesterFilter]);

  // Lifecycle actions
  const handlePublish = async (event: EventItem) => {
    const notifyNotice = event.notify_students
      ? "\n\n🔔 'Notify Students' is enabled: An in-app notification will automatically be dispatched to the eligible student audience."
      : "";
    if (
      !confirm(
        `Are you sure you want to publish "${event.title}"? Eligible students will immediately be able to view and register for this event.${notifyNotice}`
      )
    )
      return;
    setActionFeedback(null);
    try {
      await eventsApi.publishEvent(event.id);
      setActionFeedback({ type: "success", message: `Event "${event.title}" published successfully.` });
      await loadEvents();
    } catch (err: any) {
      setActionFeedback({ type: "error", message: `Publish failed: ${err.message}` });
    }
  };

  const handleClose = async (event: EventItem) => {
    if (!confirm(`Are you sure you want to close registration for "${event.title}"? No new submissions will be accepted.`)) return;
    setActionFeedback(null);
    try {
      await eventsApi.closeEvent(event.id);
      setActionFeedback({ type: "success", message: `Registration closed for "${event.title}".` });
      await loadEvents();
    } catch (err: any) {
      setActionFeedback({ type: "error", message: `Close failed: ${err.message}` });
    }
  };

  const handleReopen = async (event: EventItem) => {
    if (!confirm(`Reopen registration for "${event.title}"?`)) return;
    setActionFeedback(null);
    try {
      await eventsApi.reopenEvent(event.id);
      setActionFeedback({ type: "success", message: `Registration reopened for "${event.title}".` });
      await loadEvents();
    } catch (err: any) {
      setActionFeedback({ type: "error", message: `Reopen failed: ${err.message}` });
    }
  };

  const handleOpenDeleteModal = (event: EventItem) => {
    setDeleteError(null);
    setDeletingEvent(event);
  };

  const handleConfirmDelete = async () => {
    if (!deletingEvent) return;
    setIsDeleting(true);
    setDeleteError(null);
    setActionFeedback(null);
    try {
      const res = await eventsApi.deleteEvent(deletingEvent.id);
      const targetTitle = deletingEvent.title;
      setDeletingEvent(null);
      setActionFeedback({
        type: "success",
        message:
          res?.message ||
          (res?.action === "archived"
            ? `Event "${targetTitle}" safely archived to preserve student submissions.`
            : `Event "${targetTitle}" deleted successfully.`),
      });
      await loadEvents();
    } catch (err: any) {
      setDeleteError(err?.message || "Failed to delete event. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Switch to Form Builder (also fetch latest event & form details so form_settings/versions stay current)
  const handleOpenFormBuilder = async (event: EventItem) => {
    setActiveEvent(event);
    setViewState("form_builder");
    try {
      const fresh = await eventsApi.getEvent(event.id);
      if (fresh) setActiveEvent(fresh);
    } catch {
      // Keep cached event summary if background refresh fails
    }
  };

  // Switch to Responses
  const handleOpenResponses = (event: EventItem) => {
    setActiveEvent(event);
    setViewState("responses");
  };

  // Back to list
  const handleBackToList = () => {
    setViewState("list");
    setActiveEvent(null);
    loadEvents();
  };

  // If viewing Form Builder
  if (viewState === "form_builder" && activeEvent) {
    return (
      <EventFormBuilder
        event={activeEvent}
        initialFields={activeEvent.current_form?.fields}
        initialSections={activeEvent.current_form?.sections_config}
        initialFormSettings={activeEvent.current_form?.form_settings}
        onBack={handleBackToList}
        onSaved={async () => {
          await loadEvents();
          try {
            const fresh = await eventsApi.getEvent(activeEvent.id);
            if (fresh) setActiveEvent(fresh);
          } catch {
            // Non-fatal
          }
        }}
      />
    );
  }

  // If viewing Responses
  if (viewState === "responses" && activeEvent) {
    return <EventResponsesManager event={activeEvent} onBack={handleBackToList} />;
  }

  return (
    <div className="space-y-4">
      {/* Module Title Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-[#5DD62C]" />
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
              CCE Events &amp; Forms Console
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 uppercase">
              Phase 1.2 &amp; 2
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
            Create events with rich media, configure multi-section dynamic forms, conditional logic, and inspect submissions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingEvent(null);
            setIsCreateModalOpen(true);
          }}
          className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-4 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer min-h-[38px] flex items-center justify-center gap-1.5"
        >
          <span className="text-sm">+</span> Create New Event
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "All Events" },
              { id: "published", label: "Published" },
              { id: "draft", label: "Drafts" },
              { id: "closed", label: "Closed" },
              { id: "archived", label: "Archived" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${statusFilter === tab.id
                  ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black shadow-2xs"
                  : "bg-slate-100 dark:bg-[#202020] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Semester Filter */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadEvents()}
              placeholder="Search event title or category..."
              className="w-48 sm:w-60 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
            />

            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#202020] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
            >
              <option value="all">All Semesters</option>
              {semestersList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadEvents}
              className="p-1.5 rounded-xl border border-slate-200 dark:border-[#292929] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

          {/* Action Feedback Banner (Success / Error) */}
          {actionFeedback && (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
                actionFeedback.type === "success"
                  ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300"
                  : "border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{actionFeedback.type === "success" ? "✓" : "⚠️"}</span>
                <span>{actionFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                className="text-current opacity-70 hover:opacity-100 px-1 cursor-pointer"
                aria-label="Dismiss notification"
              >
                ✕
              </button>
            </div>
          )}

      {/* Events Grid / Listing with Adaptive Empty State and Reliable Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-200 dark:bg-[#262626] rounded-md w-1/4" />
                <div className="h-4 bg-slate-200 dark:bg-[#262626] rounded-md w-1/5" />
              </div>
              <div className="h-5 bg-slate-200 dark:bg-[#262626] rounded-md w-3/4" />
              <div className="h-14 bg-slate-100 dark:bg-[#202020] rounded-xl" />
              <div className="h-10 bg-slate-100 dark:bg-[#202020] rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-center space-y-3 max-w-lg mx-auto my-6">
          <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-lg font-bold">
            ⚠️
          </div>
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            {error.includes("Not Found")
              ? "Events API Endpoint Unavailable (404)"
              : error.includes("Network error") || error.includes("timed out")
                ? "Unable to Reach Events Service"
                : error.includes("Unauthorized") || error.includes("Access denied")
                  ? "Authorization Required"
                  : "Failed to Load Events"}
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-300/90 break-words">{error}</p>
          <button
            type="button"
            onClick={loadEvents}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
          >
            <span>↻</span> Retry Request
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-300 dark:border-[#292929] text-center space-y-3 max-w-md mx-auto my-6">
          <div className="text-4xl">📅</div>
          <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
            No Events Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] max-w-sm mx-auto">
            {statusFilter === "published"
              ? "No published events are available yet. Publish a draft event for students to see it."
              : statusFilter === "draft"
                ? "No draft events are currently waiting for edits or publishing."
                : statusFilter === "closed"
                  ? "No closed events found matching your current filter."
                  : statusFilter === "archived"
                    ? "No archived events found."
                    : searchQuery || semesterFilter !== "all"
                      ? "No events match your current search or semester filters."
                      : "Get started by creating your first event or choosing from the starter templates library."}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setIsCreateModalOpen(true);
              }}
              className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black font-semibold text-xs px-4 py-2 cursor-pointer shadow-2xs hover:opacity-90"
            >
              + Create Your First Event
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((evt) => {
            const hasCapacity = typeof evt.registration_capacity === "number" && evt.registration_capacity > 0;
            const subCount = evt.total_submissions || 0;
            const capacityRatio = hasCapacity ? Math.min(100, Math.round((subCount / (evt.registration_capacity || 1)) * 100)) : 0;
            const isFull = hasCapacity && subCount >= (evt.registration_capacity || 0);
            const bannerSrc = resolveEventAssetUrl(evt.banner_image_url || evt.poster_url, getStoredToken());

            return (
              <div
                key={evt.id}
                className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] overflow-hidden shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                {/* Optional Poster Banner */}
                {bannerSrc && (
                  <div className="w-full h-32 bg-slate-100 dark:bg-[#121212] relative overflow-hidden border-b border-slate-100 dark:border-[#262626]">
                    <img
                      src={bannerSrc}
                      alt={evt.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-black/60 backdrop-blur-xs text-white uppercase">
                        {evt.mode}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    {/* Header row: Status & Mode / Layout */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <EventStatusBadge status={evt.effective_status || evt.status} size="sm" />
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300">
                          {evt.form_layout_mode === "multi_step" ? "⚡ Wizard" : "📄 Single Page"}
                        </span>
                        {!bannerSrc && <EventModeBadge mode={evt.mode} />}
                      </div>
                    </div>

                    {/* Title & Category & Subtitle */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
                          {evt.custom_category || evt.category}
                        </span>
                        {evt.attachments && evt.attachments.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium" title={`${evt.attachments.length} attachment(s)`}>
                            📎 {evt.attachments.length}
                          </span>
                        )}
                        {evt.gallery_images && evt.gallery_images.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-medium" title={`${evt.gallery_images.length} gallery image(s)`}>
                            🖼️ {evt.gallery_images.length}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] line-clamp-1 mt-0.5">
                        {evt.title}
                      </h3>
                      {evt.subtitle && (
                        <p className="text-xs text-blue-600 dark:text-[#5DD62C] font-medium line-clamp-1">
                          {evt.subtitle}
                        </p>
                      )}
                      {evt.short_description && (
                        <p className="text-xs text-slate-500 dark:text-[#A3A3A3] line-clamp-2 mt-1">
                          {evt.short_description}
                        </p>
                      )}
                    </div>

                    {/* Key Details */}
                    <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-[#202020]/40 border border-slate-100 dark:border-[#262626] space-y-1.5 text-[11px] text-slate-600 dark:text-[#A3A3A3]">
                      <div className="flex items-center justify-between">
                        <span>📅 Event Date:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(evt.event_start_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>⏰ Reg Deadline:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(evt.registration_deadline).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🎯 Target Audience:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">
                          {evt.audience_type?.replace("_", " ") || "All"}
                        </span>
                      </div>

                      {/* Capacity & Submissions */}
                      <div className="pt-1 border-t border-slate-200/60 dark:border-[#333] space-y-1">
                        <div className="flex items-center justify-between">
                          <span>📝 Responses:</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-[#5DD62C]">
                            {subCount} {hasCapacity ? `/ ${evt.registration_capacity}` : ""}
                            {isFull && <span className="ml-1 text-[10px] text-rose-500 font-bold">(Full)</span>}
                          </span>
                        </div>
                        {hasCapacity && (
                          <div className="w-full bg-slate-200 dark:bg-[#262626] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${isFull
                                ? "bg-rose-500"
                                : capacityRatio > 80
                                  ? "bg-amber-500"
                                  : "bg-blue-600 dark:bg-[#5DD62C]"
                                }`}
                              style={{ width: `${capacityRatio}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 dark:border-[#292929] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenFormBuilder(evt)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 dark:hover:bg-[#282828] text-slate-800 dark:text-[#F5F5F5] font-semibold text-xs transition-all cursor-pointer text-center"
                      >
                        🛠 Form Builder
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenResponses(evt)}
                        className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-[#5DD62C]/10 hover:bg-blue-100 text-blue-700 dark:text-[#5DD62C] font-semibold text-xs transition-all cursor-pointer text-center"
                      >
                        📊 Responses ({subCount})
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-1 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEvent(evt);
                          setIsCreateModalOpen(true);
                        }}
                        className="text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900 dark:hover:text-white font-medium cursor-pointer"
                      >
                        Edit Details
                      </button>

                      <div className="flex items-center gap-1.5">
                        {evt.status === "draft" && (
                          <button
                            type="button"
                            onClick={() => handlePublish(evt)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                          >
                            Publish
                          </button>
                        )}

                        {evt.status === "published" && (
                          <button
                            type="button"
                            onClick={() => handleClose(evt)}
                            className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] cursor-pointer"
                          >
                            Close
                          </button>
                        )}

                        {evt.status === "closed" && (
                          <button
                            type="button"
                            onClick={() => handleReopen(evt)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] cursor-pointer"
                          >
                            Reopen
                          </button>
                        )}

                        {/* Delete Event Button (Accessible on both active and archived events) */}
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(evt)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-semibold text-[11px] transition-colors cursor-pointer"
                          title={subCount > 0 ? "Delete / Archive Event" : "Delete Event"}
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

          {/* Delete Event Confirmation Dialog */}
          {deletingEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-event-dialog-title"
                className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 id="delete-event-dialog-title" className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
                        Delete Event
                      </h3>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 break-words">
                        &ldquo;{deletingEvent.title}&rdquo;
                      </p>
                    </div>
                  </div>

                  {(deletingEvent.total_submissions || 0) > 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                      <p className="font-bold">Safe Soft-Delete / Archive Protection</p>
                      <p className="leading-relaxed">
                        This event has <span className="font-bold">{deletingEvent.total_submissions}</span> student submission(s). To preserve student responses and Google Drive evidence, confirming will{" "}
                        <span className="font-semibold">archive</span> the event and remove it from active student portals without destroying historical data.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-900 dark:text-rose-200 space-y-1.5">
                      <p className="font-bold">This action cannot be reversed.</p>
                      <p className="leading-relaxed">
                        This event has 0 student registrations. Confirming will permanently delete the event, its form builder configuration, and any linked student notification.
                      </p>
                    </div>
                  )}

                  {deleteError && (
                    <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs font-semibold text-rose-800 dark:text-rose-200">
                      ⚠️ {deleteError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-1">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => {
                        setDeletingEvent(null);
                        setDeleteError(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#333] bg-white dark:bg-[#202020] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#282828] text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5"
                    >
                      {isDeleting ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <span>{(deletingEvent.total_submissions || 0) > 0 ? "Confirm Archive" : "Confirm Delete"}</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Event Create / Edit Modal */}
      <EventCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingEvent(null);
        }}
        onSuccess={(savedEvent, wasEditMode) => {
          loadEvents();
          if (!wasEditMode && savedEvent) {
            setActiveEvent(savedEvent);
            setViewState("form_builder");
          }
        }}
        initialEvent={editingEvent}
        semesters={semestersList}
      />
    </div>
  );
};
