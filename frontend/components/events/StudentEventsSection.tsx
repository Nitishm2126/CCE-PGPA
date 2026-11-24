"use client";

import React, { useState, useEffect } from "react";
import { EventItem, EventFormVersion, EventSubmissionItem } from "@/types/events";
import { eventsApi } from "@/lib/events-api";
import { EventStatusBadge, EventModeBadge } from "@/components/events/EventStatusBadge";
import { DynamicStudentFormRenderer } from "@/components/events/DynamicStudentFormRenderer";

export const StudentEventsSection: React.FC = () => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"all" | "open" | "my_registrations" | "closed">("open");

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

  // Filter events based on activeTab
  const nowIso = new Date().toISOString();
  const filteredEvents = events.filter((evt) => {
    const isRegOpen =
      evt.status === "published" &&
      evt.is_registration_enabled &&
      (!evt.registration_start_at || nowIso >= evt.registration_start_at) &&
      (!evt.close_after_deadline || !evt.registration_deadline || nowIso <= evt.registration_deadline);

    if (activeTab === "open") return isRegOpen;
    if (activeTab === "my_registrations") return evt.has_submitted;
    if (activeTab === "closed") return !isRegOpen;
    return true; // "all"
  });

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
            { id: "open", label: "Open for Registration" },
            { id: "all", label: "All Eligible Events" },
            { id: "my_registrations", label: `My Registrations (${events.filter((e) => e.has_submitted).length})` },
            { id: "closed", label: "Past / Closed" },
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

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading department events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 rounded-2xl border border-dashed border-slate-300 dark:border-[#292929] text-center space-y-2">
          <span className="text-3xl">🗓</span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5]">No Events in this Category</h3>
          <p className="text-xs text-slate-500 dark:text-[#A3A3A3]">
            {activeTab === "my_registrations"
              ? "You haven't submitted any event registrations yet."
              : "Check back soon for new department activities."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((evt) => {
            const isRegOpen =
              evt.status === "published" &&
              evt.is_registration_enabled &&
              (!evt.registration_start_at || nowIso >= evt.registration_start_at) &&
              (!evt.close_after_deadline || !evt.registration_deadline || nowIso <= evt.registration_deadline);

            const hasCapacity = typeof evt.registration_capacity === "number" && evt.registration_capacity > 0;
            const subCount = evt.total_submissions || 0;
            const isFull = hasCapacity && subCount >= (evt.registration_capacity || 0);

            return (
              <div
                key={evt.id}
                className="rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] overflow-hidden shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
              >
                {/* Optional Banner Image */}
                {evt.banner_image_url && (
                  <div className="w-full h-36 bg-slate-100 dark:bg-[#121212] relative overflow-hidden border-b border-slate-100 dark:border-[#262626]">
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

                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-[#5DD62C]">
                        {evt.custom_category || evt.category}
                      </span>
                      {!evt.banner_image_url && <EventModeBadge mode={evt.mode} />}
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-[#F5F5F5] line-clamp-1">
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
                      {evt.online_meeting_url && (
                        <div className="flex items-center justify-between">
                          <span>🌐 Meeting:</span>
                          <a
                            href={evt.online_meeting_url}
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
                              href={att.url}
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
                  <div className="pt-2 border-t border-slate-100 dark:border-[#292929]">
                    {evt.has_submitted ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          ✓ Registered
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewMySubmission(evt)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#202020] hover:bg-slate-200 text-slate-800 dark:text-[#F5F5F5] font-semibold text-xs cursor-pointer active:scale-95 transition-all"
                          >
                            View Details
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
                      <button
                        type="button"
                        onClick={() => handleOpenRegistration(evt)}
                        className="w-full rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs py-2 shadow-2xs active:scale-95 transition-all cursor-pointer text-center"
                      >
                        Register / Fill Form →
                      </button>
                    ) : (
                      <div className="w-full py-1.5 rounded-xl bg-slate-100 dark:bg-[#202020] text-slate-400 font-semibold text-xs text-center">
                        {isFull ? "Capacity Reached" : "Registration Closed"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
                    {viewingSubmission.files.map((file) => (
                      <div
                        key={file.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>📎</span>
                          <span className="font-semibold truncate">{file.original_filename}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">Uploaded ✓</span>
                      </div>
                    ))}
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
