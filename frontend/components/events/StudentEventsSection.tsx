"use client";

import React, { useState, useEffect } from "react";
import { EventItem, EventFormVersion, EventSubmissionItem } from "@/types/events";
import { eventsApi, resolveEventAssetUrl } from "@/lib/events-api";
import { getStoredToken } from "@/lib/api-client";
import { EventStatusBadge, EventModeBadge } from "@/components/events/EventStatusBadge";
import { DynamicStudentFormRenderer } from "@/components/events/DynamicStudentFormRenderer";

interface StudentEventsSectionProps {
  initialEventId?: string | null;
  onConsumedInitialEventId?: () => void;
}

export const StudentEventsSection: React.FC<StudentEventsSectionProps> = ({
  initialEventId = null,
  onConsumedInitialEventId,
}) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const authToken = getStoredToken();

  // Filters: All Events, Upcoming, Registration Open, Registered, Completed
  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "open" | "registered" | "completed">("all");

  // Event details modal
  const [viewingEventDetails, setViewingEventDetails] = useState<EventItem | null>(null);

  // Registration modal states
  const [registeringEvent, setRegisteringEvent] = useState<EventItem | null>(null);
  const [eventForm, setEventForm] = useState<EventFormVersion | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<EventSubmissionItem | null>(null);
  const [loadingForm, setLoadingForm] = useState<boolean>(false);

  // View submission modal
  const [viewingSubmission, setViewingSubmission] = useState<EventSubmissionItem | null>(null);
  const [loadingMySub, setLoadingMySub] = useState<boolean>(false);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eventsApi.listStudentEvents();
      setEvents(res.events || []);
    } catch (err: any) {
      setError(err.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Deep-link from in-app notification bell / popup
  useEffect(() => {
    if (!initialEventId) return;
    const matched = events.find((e) => e.id === initialEventId);
    if (matched) {
      queueMicrotask(() => {
        setActiveTab("all");
        setViewingEventDetails(matched);
        onConsumedInitialEventId?.();
      });
      return;
    }
    if (!loading) {
      eventsApi
        .getStudentEvent(initialEventId)
        .then((evt) => {
          setActiveTab("all");
          setViewingEventDetails(evt);
        })
        .catch((err) => {
          setError(err?.message || "Selected event could not be loaded.");
        })
        .finally(() => {
          onConsumedInitialEventId?.();
        });
    }
  }, [initialEventId, events, loading, onConsumedInitialEventId]);

  // Filter events based on activeTab
  const nowIso = new Date().toISOString();
  const isEventUpcoming = (evt: EventItem) =>
    evt.effective_status === "scheduled" ||
    (evt.status === "published" && Boolean(evt.registration_start_at) && nowIso < evt.registration_start_at);

  const isEventRegOpen = (evt: EventItem) =>
    evt.status === "published" &&
    evt.is_registration_enabled !== false &&
    (!evt.registration_start_at || nowIso >= evt.registration_start_at) &&
    (!evt.close_after_deadline || !evt.registration_deadline || nowIso <= evt.registration_deadline);

  const isEventCompleted = (evt: EventItem) =>
    evt.effective_status === "completed" ||
    evt.status === "closed" ||
    (Boolean(evt.event_end_at) && nowIso > evt.event_end_at) ||
    (!isEventUpcoming(evt) && !isEventRegOpen(evt));

  const filteredEvents = events.filter((evt) => {
    if (activeTab === "upcoming") return isEventUpcoming(evt);
    if (activeTab === "open") return isEventRegOpen(evt);
    if (activeTab === "registered") return Boolean(evt.has_submitted);
    if (activeTab === "completed") return isEventCompleted(evt);
    return true; // "all"
  });

  const handleOpenEventDetails = async (evt: EventItem) => {
    setViewingEventDetails(evt);
    try {
      const fullEvt = await eventsApi.getStudentEvent(evt.id);
      setViewingEventDetails(fullEvt);
    } catch {
      // Keep summary card data if full refresh fails transiently
    }
  };

  // Open Registration Modal
  const handleOpenRegistration = async (evt: EventItem) => {
    setRegisteringEvent(evt);
    setLoadingForm(true);
    setEventForm(null);
    setExistingSubmission(null);
    try {
      const formRes = await eventsApi.getStudentEventForm(evt.id);
      setEventForm(formRes.form);

      // If already submitted and editing allowed, fetch submission
      if (evt.has_submitted) {
        try {
          const sub = await eventsApi.getStudentMySubmission(evt.id);
          setExistingSubmission(sub);
        } catch {
          // No previous sub or not fetchable
        }
      }
    } catch (err: any) {
      alert("Unable to open registration form: " + err.message);
      setRegisteringEvent(null);
    } finally {
      setLoadingForm(false);
    }
  };

  // Open View My Submission Modal
  const handleViewMySubmission = async (evt: EventItem) => {
    setLoadingMySub(true);
    try {
      const sub = await eventsApi.getStudentMySubmission(evt.id);
      setViewingSubmission(sub);
    } catch (err: any) {
      alert("Failed to load your submission: " + err.message);
    } finally {
      setLoadingMySub(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-[#5DD62C]" />
            <h2 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
              Department Events &amp; Registration Forms
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
            Discover workshops, hackathons, and guest lectures. Register and submit requested forms directly.
          </p>
        </div>

        <button
          type="button"
          onClick={loadEvents}
          className="p-2 rounded-xl border border-slate-200 dark:border-[#292929] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer self-start sm:self-auto"
          title="Refresh Events"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-2 shadow-2xs">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: `All Events (${events.length})` },
            { id: "upcoming", label: "Upcoming" },
            { id: "open", label: "Registration Open" },
            { id: "registered", label: `Registered (${events.filter((e) => e.has_submitted).length})` },
            { id: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black shadow-2xs"
                  : "bg-slate-50 dark:bg-[#202020] text-slate-600 dark:text-[#A3A3A3] hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Grid / Listing with Adaptive Empty State, Skeletons and Retryable Error */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] p-4 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-slate-200 dark:bg-[#262626] rounded-md w-1/4" />
              <div className="h-5 bg-slate-200 dark:bg-[#262626] rounded-md w-3/4" />
              <div className="h-14 bg-slate-100 dark:bg-[#202020] rounded-xl" />
              <div className="h-9 bg-slate-100 dark:bg-[#202020] rounded-xl" />
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
              ? "Connection Problem"
              : "Unable to Load Events"}
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
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-300 dark:border-[#292929] text-center space-y-2 max-w-md mx-auto my-6">
          <span className="text-3xl">🗓</span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">
            No Events Available
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3] max-w-sm mx-auto">
            {activeTab === "upcoming"
              ? "No upcoming scheduled events found right now."
              : activeTab === "open"
              ? "No events are currently open for registration. Check All Events or check back soon."
              : activeTab === "registered"
              ? "You haven't submitted any event registrations yet."
              : activeTab === "completed"
              ? "No past or completed events to display."
              : "No department events are currently published for you. Check back soon for workshops, competitions, and surveys."}
          </p>
          {activeTab !== "all" && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className="text-xs font-semibold text-blue-600 dark:text-[#5DD62C] hover:underline cursor-pointer"
              >
                View All Events →
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((evt) => {
            const isRegOpen = isEventRegOpen(evt);
            const hasCapacity = typeof evt.registration_capacity === "number" && evt.registration_capacity > 0;
            const subCount = evt.total_submissions || 0;
            const isFull = hasCapacity && subCount >= (evt.registration_capacity || 0);
            const bannerSrc = resolveEventAssetUrl(evt.banner_image_url || evt.poster_url, authToken);
            const meetingLink = evt.online_meeting_url || evt.meeting_url;

            return (
              <div
                key={evt.id}
                className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] overflow-hidden shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                {/* Optional Banner Image */}
                {bannerSrc && (
                  <div
                    onClick={() => handleOpenEventDetails(evt)}
                    className="w-full h-36 bg-slate-100 dark:bg-[#121212] relative overflow-hidden border-b border-slate-100 dark:border-[#262626] cursor-pointer"
                  >
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

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
                        {evt.custom_category || evt.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <EventStatusBadge status={evt.effective_status || evt.status} size="sm" />
                        {!bannerSrc && <EventModeBadge mode={evt.mode} />}
                      </div>
                    </div>

                    <div>
                      <h3
                        onClick={() => handleOpenEventDetails(evt)}
                        className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] line-clamp-1 cursor-pointer hover:text-blue-600 dark:hover:text-[#5DD62C]"
                      >
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

                    <div className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-[#202020]/40 border border-slate-100 dark:border-[#262626] space-y-1.5 text-[11px] text-slate-600 dark:text-[#A3A3A3]">
                      <div className="flex items-center justify-between">
                        <span>📅 Date:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(evt.event_start_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {evt.venue && (
                        <div className="flex items-center justify-between">
                          <span>📍 Venue:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                            {evt.venue}
                          </span>
                        </div>
                      )}
                      {meetingLink && (
                        <div className="flex items-center justify-between">
                          <span>🌐 Meeting:</span>
                          <a
                            href={meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-[#5DD62C] hover:underline font-semibold"
                          >
                            Join Link ↗
                          </a>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>⏰ Deadline:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {new Date(evt.registration_deadline).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      {hasCapacity && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-[#333]">
                          <span>👥 Capacity:</span>
                          <span
                            className={`font-semibold ${
                              isFull ? "text-rose-500 font-bold" : "text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {isFull ? "Registration Full" : `${(evt.registration_capacity || 0) - subCount} spots left`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Attachments preview if available */}
                    {evt.attachments && evt.attachments.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Downloads / Guidelines
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {evt.attachments.map((att, idx) => (
                            <a
                              key={att.id || att.url || idx}
                              href={resolveEventAssetUrl(att.url, authToken, true)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#262626] text-[10px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors"
                            >
                              📎 {att.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer Action */}
                  <div className="pt-2 border-t border-slate-100 dark:border-[#292929] space-y-1.5">
                    {evt.has_submitted ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ Registered
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEventDetails(evt)}
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer"
                          >
                            Info
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewMySubmission(evt)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 text-slate-800 dark:text-[#F5F5F5] font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                          >
                            My Submission
                          </button>
                          {evt.allow_edit_submission && isRegOpen && (
                            <button
                              type="button"
                              onClick={() => handleOpenRegistration(evt)}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-600 dark:text-[#5DD62C] font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    ) : isRegOpen && !isFull ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEventDetails(evt)}
                          className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#333] hover:bg-slate-50 dark:hover:bg-[#222] text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRegistration(evt)}
                          className="flex-1 rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs py-2 shadow-2xs active:scale-95 transition-all cursor-pointer text-center"
                        >
                          {evt.notification_cta_label || "Register / Fill Form"} →
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEventDetails(evt)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#333] text-slate-700 dark:text-slate-200 font-semibold text-xs cursor-pointer"
                        >
                          Details
                        </button>
                        <div className="flex-1 py-1.5 rounded-xl bg-slate-100 dark:bg-[#202020] text-slate-400 font-semibold text-xs text-center">
                          {isFull ? "Capacity Reached" : isEventUpcoming(evt) ? "Opens Soon" : "Registration Closed"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RICH EVENT DETAILS MODAL */}
      {viewingEventDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
                    {viewingEventDetails.custom_category || viewingEventDetails.category}
                  </span>
                  <EventStatusBadge status={viewingEventDetails.effective_status || viewingEventDetails.status} size="sm" />
                  <EventModeBadge mode={viewingEventDetails.mode} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F5F5F5] mt-1">
                  {viewingEventDetails.title}
                </h3>
                {viewingEventDetails.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">{viewingEventDetails.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewingEventDetails(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {(viewingEventDetails.banner_image_url || viewingEventDetails.poster_url) && (
                <div className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 dark:border-[#292929] bg-slate-100 dark:bg-[#121212]">
                  <img
                    src={resolveEventAssetUrl(viewingEventDetails.banner_image_url || viewingEventDetails.poster_url, authToken)}
                    alt={viewingEventDetails.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {(viewingEventDetails.detailed_description || viewingEventDetails.short_description) && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3]">Overview</span>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                    {viewingEventDetails.detailed_description || viewingEventDetails.short_description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#202020] border border-slate-200 dark:border-[#2d2d2d]">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Event Schedule</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {new Date(viewingEventDetails.event_start_at).toLocaleString()} — {new Date(viewingEventDetails.event_end_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Registration Window</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {new Date(viewingEventDetails.registration_start_at).toLocaleString()} — {new Date(viewingEventDetails.registration_deadline).toLocaleString()}
                  </p>
                </div>
                {viewingEventDetails.venue && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Venue</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{viewingEventDetails.venue}</p>
                  </div>
                )}
                {(viewingEventDetails.online_meeting_url || viewingEventDetails.meeting_url) && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Meeting Link</span>
                    <a
                      href={viewingEventDetails.online_meeting_url || viewingEventDetails.meeting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-600 dark:text-[#5DD62C] hover:underline mt-0.5 inline-block break-all"
                    >
                      Join Online Session ↗
                    </a>
                  </div>
                )}
              </div>

              {(viewingEventDetails.contact_person || viewingEventDetails.contact_email || viewingEventDetails.contact_phone) && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Coordinator Contact</span>
                  <p className="text-slate-800 dark:text-slate-200 font-semibold">
                    {[viewingEventDetails.contact_person, viewingEventDetails.contact_email, viewingEventDetails.contact_phone].filter(Boolean).join(" • ")}
                  </p>
                </div>
              )}

              {viewingEventDetails.instructions && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-1">
                  <span className="font-bold text-blue-900 dark:text-blue-200 block">📋 Participation Instructions</span>
                  <p className="whitespace-pre-line text-blue-800 dark:text-blue-300 leading-relaxed">{viewingEventDetails.instructions}</p>
                </div>
              )}

              {viewingEventDetails.terms_conditions && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-1">
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">⚖️ Terms &amp; Conditions</span>
                  <p className="whitespace-pre-line text-amber-800 dark:text-amber-300 leading-relaxed">{viewingEventDetails.terms_conditions}</p>
                </div>
              )}

              {viewingEventDetails.gallery_images && viewingEventDetails.gallery_images.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Event Gallery</span>
                  <div className="grid grid-cols-3 gap-2">
                    {viewingEventDetails.gallery_images.map((imgUrl, idx) => (
                      <a
                        key={idx}
                        href={resolveEventAssetUrl(imgUrl, authToken)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#292929] aspect-video block"
                      >
                        <img src={resolveEventAssetUrl(imgUrl, authToken)} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {viewingEventDetails.attachments && viewingEventDetails.attachments.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Rulebooks &amp; Downloads</span>
                  <div className="space-y-1.5">
                    {viewingEventDetails.attachments.map((att, idx) => (
                      <a
                        key={att.id || att.url || idx}
                        href={resolveEventAssetUrl(att.url, authToken, true)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50 dark:bg-[#202020] hover:border-blue-500 font-semibold text-blue-600 dark:text-[#5DD62C]"
                      >
                        <span>📎 {att.name}</span>
                        <span>Download ↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-[#292929] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingEventDetails(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-[#333] cursor-pointer"
              >
                Close
              </button>
              {viewingEventDetails.has_submitted ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingEventDetails;
                    setViewingEventDetails(null);
                    handleViewMySubmission(target);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 text-white cursor-pointer"
                >
                  View My Submission →
                </button>
              ) : isEventRegOpen(viewingEventDetails) ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingEventDetails;
                    setViewingEventDetails(null);
                    handleOpenRegistration(target);
                  }}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 dark:bg-[#5DD62C] text-white dark:text-black cursor-pointer"
                >
                  {viewingEventDetails.notification_cta_label || "Register / Fill Form"} →
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL WITH DYNAMIC FORM */}
      {registeringEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
                  Event Registration
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5] mt-0.5">
                  {registeringEvent.title}
                </h3>
                {registeringEvent.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">{registeringEvent.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRegisteringEvent(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Optional Instructions */}
              {registeringEvent.instructions && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                  <span className="font-bold flex items-center gap-1">📋 Instructions &amp; Guidelines:</span>
                  <p className="whitespace-pre-line text-[11px] leading-relaxed text-blue-800 dark:text-blue-300">
                    {registeringEvent.instructions}
                  </p>
                </div>
              )}

              {loadingForm ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading registration form...</div>
              ) : eventForm ? (
                <DynamicStudentFormRenderer
                  event={registeringEvent}
                  form={eventForm}
                  existingSubmission={existingSubmission}
                  onSubmitted={(sub) => {
                    loadEvents();
                  }}
                  onCancel={() => setRegisteringEvent(null)}
                  onViewMySubmission={() => {
                    const evt = registeringEvent;
                    setRegisteringEvent(null);
                    handleViewMySubmission(evt);
                  }}
                />
              ) : (
                <p className="text-xs text-rose-500 py-6 text-center">Form could not be loaded.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MY SUBMISSION MODAL */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  My Registration Details
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5] mt-0.5">
                  {viewingSubmission.student_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Submitted at: </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(viewingSubmission.submitted_at).toLocaleString()}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 uppercase">
                  {viewingSubmission.submission_status}
                </span>
              </div>

              {/* Answers */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] block">
                  Your Submitted Answers
                </span>
                {viewingSubmission.values &&
                  Object.entries(viewingSubmission.values).map(([key, valObj]: [string, any]) => {
                    const label = valObj?.label || key;
                    const val = valObj?.value !== undefined ? valObj.value : valObj;

                    // Repeatable group render
                    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
                      return (
                        <div
                          key={key}
                          className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] space-y-2"
                        >
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3]">{label}</p>
                          <div className="space-y-1.5">
                            {val.map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 rounded-lg bg-slate-50 dark:bg-[#202020] text-xs space-y-1"
                              >
                                <span className="text-[10px] font-bold text-blue-600 dark:text-[#5DD62C]">
                                  #{idx + 1}
                                </span>
                                {Object.entries(item).map(([innerK, innerV]: [string, any]) => (
                                  <div key={innerK} className="flex justify-between gap-2">
                                    <span className="text-slate-400 capitalize">{innerK}:</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                      {String(innerV)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // Geo-photo render
                    if (val && typeof val === "object" && "has_geo" in val) {
                      return (
                        <div
                          key={key}
                          className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] space-y-1"
                        >
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3]">{label}</p>
                          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                            {val.photo_url && (
                              <img src={val.photo_url} alt="Photo" className="h-24 w-auto rounded-lg object-cover" />
                            )}
                            <p className="text-[11px] text-emerald-600 font-medium">
                              📍 Lat: {val.latitude}, Long: {val.longitude}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={key}
                        className="p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] space-y-1"
                      >
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-[#A3A3A3]">{label}</p>
                        <p className="text-xs font-medium text-slate-900 dark:text-[#F5F5F5] break-words">
                          {Array.isArray(val)
                            ? val.join(", ")
                            : val !== null && val !== undefined && val !== ""
                            ? String(val)
                            : <span className="text-slate-400 italic">Not provided</span>}
                        </p>
                      </div>
                    );
                  })}
              </div>

              {/* Files */}
              {viewingSubmission.files && viewingSubmission.files.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-[#292929]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] block">
                    Attached Files ({viewingSubmission.files.length})
                  </span>
                  <div className="space-y-2">
                    {viewingSubmission.files.map((file) => {
                      const previewUrl = resolveEventAssetUrl(file.file_url || file.storage_reference, authToken, false);
                      const downloadUrl = resolveEventAssetUrl(file.download_url || file.file_url || file.storage_reference, authToken, true);
                      return (
                        <div
                          key={file.id}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>📎</span>
                            <span className="font-semibold truncate">{file.original_filename}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {previewUrl && (
                              <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-[#5DD62C] font-semibold hover:underline"
                              >
                                View
                              </a>
                            )}
                            {downloadUrl && (
                              <a
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold hover:underline"
                              >
                                Download ↓
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

            <div className="px-5 py-3 border-t border-slate-100 dark:border-[#292929] flex justify-end">
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#202020] text-slate-800 dark:text-[#F5F5F5] hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
