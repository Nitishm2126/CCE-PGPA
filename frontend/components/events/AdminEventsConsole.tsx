"use client";

import React, { useState, useEffect } from "react";
import { EventItem, EventStatus } from "@/types/events";
import { eventsApi } from "@/lib/events-api";
import { EventStatusBadge, EventModeBadge } from "@/components/events/EventStatusBadge";
import { EventCreateModal } from "@/components/events/EventCreateModal";
import { EventFormBuilder } from "@/components/events/EventFormBuilder";
import { EventResponsesManager } from "@/components/events/EventResponsesManager";
import { SemesterResponse } from "@/types/achievement";
import { api } from "@/lib/api-client";

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

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

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
    if (!confirm(`Are you sure you want to publish "${event.title}"? Eligible students will immediately be able to register.`)) return;
    try {
      await eventsApi.publishEvent(event.id);
      loadEvents();
    } catch (err: any) {
      alert("Publish failed: " + err.message);
    }
  };

  const handleClose = async (event: EventItem) => {
    if (!confirm(`Are you sure you want to close registration for "${event.title}"? No new submissions will be accepted.`)) return;
    try {
      await eventsApi.closeEvent(event.id);
      loadEvents();
    } catch (err: any) {
      alert("Close failed: " + err.message);
    }
  };

  const handleReopen = async (event: EventItem) => {
    if (!confirm(`Reopen registration for "${event.title}"?`)) return;
    try {
      await eventsApi.reopenEvent(event.id);
      loadEvents();
    } catch (err: any) {
      alert("Reopen failed: " + err.message);
    }
  };

  const handleDeleteOrArchive = async (event: EventItem) => {
    const hasSubmissions = (event.total_submissions || 0) > 0;
    const isPublishedOrClosed = event.status === "published" || event.status === "closed";

    if (hasSubmissions || isPublishedOrClosed) {
      if (
        !confirm(
          `Event "${event.title}" has ${event.total_submissions || 0} response(s) or has been active.\n\nTo preserve historical audit integrity and student response records, this event will be safely ARCHIVED instead of destroyed.\n\nProceed with Archiving?`
        )
      ) {
        return;
      }
    } else {
      if (!confirm(`Permanently delete draft event "${event.title}"? This cannot be undone.`)) {
        return;
      }
    }

    try {
      await eventsApi.deleteEvent(event.id);
      loadEvents();
    } catch (err: any) {
      alert("Action failed: " + err.message);
    }
  };

  // Switch to Form Builder
  const handleOpenFormBuilder = (event: EventItem) => {
    setActiveEvent(event);
    setViewState("form_builder");
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
        onBack={handleBackToList}
        onSaved={() => {
          loadEvents();
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
              Phase 1.1 Pro
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                  statusFilter === tab.id
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

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* Events Grid / Listing */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-300 dark:border-[#292929] text-center space-y-3">
          <span className="text-3xl">🗓</span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">No Events Found</h3>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] max-w-sm mx-auto">
            Get started by creating an event, configuring audience permissions, and building its registration form.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingEvent(null);
              setIsCreateModalOpen(true);
            }}
            className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black font-semibold text-xs px-4 py-2 cursor-pointer shadow-2xs"
          >
            Create Your First Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((evt) => {
            const hasCapacity = typeof evt.registration_capacity === "number" && evt.registration_capacity > 0;
            const subCount = evt.total_submissions || 0;
            const capacityRatio = hasCapacity ? Math.min(100, Math.round((subCount / (evt.registration_capacity || 1)) * 100)) : 0;
            const isFull = hasCapacity && subCount >= (evt.registration_capacity || 0);

            return (
              <div
                key={evt.id}
                className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] overflow-hidden shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                {/* Optional Poster Banner */}
                {evt.banner_image_url && (
                  <div className="w-full h-32 bg-slate-100 dark:bg-[#121212] relative overflow-hidden border-b border-slate-100 dark:border-[#262626]">
                    <img
                      src={evt.banner_image_url}
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
                      <EventStatusBadge status={evt.status} size="sm" />
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300">
                          {evt.form_layout_mode === "multi_step" ? "⚡ Wizard" : "📄 Single Page"}
                        </span>
                        {!evt.banner_image_url && <EventModeBadge mode={evt.mode} />}
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
                              className={`h-full rounded-full transition-all ${
                                isFull
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

                        {/* Safe Delete / Archive Button */}
                        {evt.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteOrArchive(evt)}
                            className="px-1.5 py-0.5 text-rose-500 hover:text-rose-700 font-semibold text-[11px] cursor-pointer"
                            title={evt.status === "draft" && subCount === 0 ? "Delete Draft" : "Archive Event"}
                          >
                            {evt.status === "draft" && subCount === 0 ? "Delete" : "Archive"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Event Create / Edit Modal */}
      <EventCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingEvent(null);
        }}
        onSuccess={() => {
          loadEvents();
        }}
        initialEvent={editingEvent}
        semesters={semestersList}
      />
    </div>
  );
};
