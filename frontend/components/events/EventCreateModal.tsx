"use client";

import React, { useState, useEffect } from "react";
import { EventItem, EventCreateRequest, EventMode, AudienceType } from "@/types/events";
import { eventsApi } from "@/lib/events-api";
import { api } from "@/lib/api-client";
import { AdminStudentItem } from "@/types/auth";
import { SemesterResponse } from "@/types/achievement";

interface EventCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (event: EventItem) => void;
  initialEvent?: EventItem | null;
  semesters?: SemesterResponse[];
}

export const EventCreateModal: React.FC<EventCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialEvent,
  semesters = [],
}) => {
  const isEdit = !!initialEvent;

  // Active section inside the modal
  const [activeTab, setActiveTab] = useState<"basic" | "audience" | "rules">("basic");

  // Section A: Basic Information
  const [title, setTitle] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [detailedDescription, setDetailedDescription] = useState("");
  const [category, setCategory] = useState("Workshop");
  const [posterUrl, setPosterUrl] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [venue, setVenue] = useState("");
  const [mode, setMode] = useState<EventMode>("Offline");
  const [meetingUrl, setMeetingUrl] = useState("");

  const [eventStartDate, setEventStartDate] = useState("");
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventEndTime, setEventEndTime] = useState("17:00");

  const [regStartDate, setRegStartDate] = useState("");
  const [regStartTime, setRegStartTime] = useState("09:00");
  const [regDeadlineDate, setRegDeadlineDate] = useState("");
  const [regDeadlineTime, setRegDeadlineTime] = useState("23:59");

  const [academicYear, setAcademicYear] = useState("2024-2025");
  const [semesterId, setSemesterId] = useState("");

  // Section B: Target Audience
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("A");
  const [selectedYear, setSelectedYear] = useState<string>("2");
  const [studentSearch, setStudentSearch] = useState("");
  const [allStudents, setAllStudents] = useState<AdminStudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Section C: Rules
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(false);
  const [allowEditSubmission, setAllowEditSubmission] = useState(false);
  const [closeAfterDeadline, setCloseAfterDeadline] = useState(true);
  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(true);

  // Status & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset or populate state when modal opens or initialEvent changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      setTitle(initialEvent.title || "");
      setShortDescription(initialEvent.short_description || "");
      setDetailedDescription(initialEvent.detailed_description || "");
      setCategory(initialEvent.category || "Workshop");
      setPosterUrl(initialEvent.poster_url || "");
      setDocumentUrl(initialEvent.document_url || "");
      setVenue(initialEvent.venue || "");
      setMode(initialEvent.mode || "Offline");
      setMeetingUrl(initialEvent.meeting_url || "");

      if (initialEvent.event_start_at) {
        const [d, t] = initialEvent.event_start_at.split("T");
        setEventStartDate(d || "");
        setEventStartTime(t ? t.substring(0, 5) : "09:00");
      }
      if (initialEvent.event_end_at) {
        const [d, t] = initialEvent.event_end_at.split("T");
        setEventEndDate(d || "");
        setEventEndTime(t ? t.substring(0, 5) : "17:00");
      }
      if (initialEvent.registration_start_at) {
        const [d, t] = initialEvent.registration_start_at.split("T");
        setRegStartDate(d || "");
        setRegStartTime(t ? t.substring(0, 5) : "09:00");
      }
      if (initialEvent.registration_deadline) {
        const [d, t] = initialEvent.registration_deadline.split("T");
        setRegDeadlineDate(d || "");
        setRegDeadlineTime(t ? t.substring(0, 5) : "23:59");
      }

      setAcademicYear(initialEvent.academic_year || "2024-2025");
      setSemesterId(initialEvent.semester_id || "");

      setAudienceType(initialEvent.audience_type || "all");
      if (initialEvent.audience_type === "specific_students" && Array.isArray(initialEvent.audience_payload)) {
        setSelectedStudents(initialEvent.audience_payload);
      } else if (initialEvent.audience_type === "section" && typeof initialEvent.audience_payload === "string") {
        setSelectedSection(initialEvent.audience_payload);
      }

      setAllowMultipleResponses(Boolean(initialEvent.allow_multiple_responses));
      setAllowEditSubmission(Boolean(initialEvent.allow_edit_submission));
      setCloseAfterDeadline(initialEvent.close_after_deadline !== false);
      setIsRegistrationEnabled(initialEvent.is_registration_enabled !== false);
    } else {
      // Default dates (today & tomorrow)
      const today = new Date().toISOString().split("T")[0];
      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
      const eventDay = new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0];

      setTitle("");
      setShortDescription("");
      setDetailedDescription("");
      setCategory("Workshop");
      setPosterUrl("");
      setDocumentUrl("");
      setVenue("Auditorium / Seminar Hall");
      setMode("Offline");
      setMeetingUrl("");

      setEventStartDate(eventDay);
      setEventStartTime("09:00");
      setEventEndDate(eventDay);
      setEventEndTime("16:30");

      setRegStartDate(today);
      setRegStartTime("09:00");
      setRegDeadlineDate(nextWeek);
      setRegDeadlineTime("23:59");

      setAcademicYear("2024-2025");
      setSemesterId(semesters[0]?.id || "");
      setAudienceType("all");
      setSelectedStudents([]);
      setSelectedSection("A");
      setSelectedYear("2");

      setAllowMultipleResponses(false);
      setAllowEditSubmission(false);
      setCloseAfterDeadline(true);
      setIsRegistrationEnabled(true);
    }

    setActiveTab("basic");
    setError(null);
  }, [isOpen, initialEvent, semesters]);

  // Load students for audience picker
  useEffect(() => {
    if (isOpen && audienceType === "specific_students" && allStudents.length === 0) {
      setLoadingStudents(true);
      api
        .adminGetStudents()
        .then((res: AdminStudentItem[]) => {
          setAllStudents(res || []);
        })
        .catch((e: unknown) => {
          console.error("Failed to load students for audience picker", e);
        })
        .finally(() => setLoadingStudents(false));
    }
  }, [isOpen, audienceType, allStudents.length]);

  if (!isOpen) return null;

  // Handle poster file upload
  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPoster(true);
    try {
      const res = await eventsApi.uploadEventFile(file);
      setPosterUrl(res.storage_reference);
    } catch (err: any) {
      setError(err.message || "Failed to upload poster image");
    } finally {
      setUploadingPoster(false);
    }
  };

  // Handle document upload
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const res = await eventsApi.uploadEventFile(file);
      setDocumentUrl(res.storage_reference);
    } catch (err: any) {
      setError(err.message || "Failed to upload event document");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide an Event Title.");
      setActiveTab("basic");
      return;
    }

    if (!eventStartDate || !eventEndDate || !regStartDate || !regDeadlineDate) {
      setError("Please fill out all event and registration dates.");
      setActiveTab("basic");
      return;
    }

    const eventStartAt = `${eventStartDate}T${eventStartTime}:00`;
    const eventEndAt = `${eventEndDate}T${eventEndTime}:00`;
    const regStartAt = `${regStartDate}T${regStartTime}:00`;
    const regDeadlineAt = `${regDeadlineDate}T${regDeadlineTime}:00`;

    if (eventEndAt < eventStartAt) {
      setError("Event end date cannot be earlier than event start date.");
      setActiveTab("basic");
      return;
    }

    if (regDeadlineAt < regStartAt) {
      setError("Registration deadline cannot be earlier than registration start date.");
      setActiveTab("basic");
      return;
    }

    let audiencePayload: any = null;
    if (audienceType === "specific_students") {
      if (selectedStudents.length === 0) {
        setError("Please select at least one student for the target audience.");
        setActiveTab("audience");
        return;
      }
      audiencePayload = selectedStudents;
    } else if (audienceType === "section") {
      audiencePayload = selectedSection;
    } else if (audienceType === "academic_year") {
      audiencePayload = selectedYear;
    }

    const payload: EventCreateRequest = {
      title: title.trim(),
      short_description: shortDescription.trim() || undefined,
      detailed_description: detailedDescription.trim() || undefined,
      category,
      poster_url: posterUrl || undefined,
      document_url: documentUrl || undefined,
      venue: venue.trim() || undefined,
      mode,
      meeting_url: mode !== "Offline" ? meetingUrl.trim() || undefined : undefined,
      event_start_at: eventStartAt,
      event_end_at: eventEndAt,
      registration_start_at: regStartAt,
      registration_deadline: regDeadlineAt,
      academic_year: academicYear,
      semester_id: semesterId || undefined,
      audience_type: audienceType,
      audience_payload: audiencePayload,
      allow_multiple_responses: allowMultipleResponses,
      allow_edit_submission: allowEditSubmission,
      close_after_deadline: closeAfterDeadline,
      is_registration_enabled: isRegistrationEnabled,
    };

    setIsSubmitting(true);
    try {
      let savedEvent: EventItem;
      if (isEdit && initialEvent) {
        savedEvent = await eventsApi.updateEvent(initialEvent.id, payload);
      } else {
        savedEvent = await eventsApi.createEvent(payload);
      }
      onSuccess(savedEvent);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save event. Please check inputs and retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter students for search
  const filteredStudents = allStudents.filter(
    (s) =>
      (s.full_name || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.register_number || "").toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#292929] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#F5F5F5]">
              {isEdit ? "Edit Event Details" : "Create New Event"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#A3A3A3] mt-0.5">
              Configure event schedule, target audience, and registration settings
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 px-5 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "basic"
                ? "border-blue-600 dark:border-[#5DD62C] text-blue-600 dark:text-[#5DD62C]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Section A: Basic Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audience")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "audience"
                ? "border-blue-600 dark:border-[#5DD62C] text-blue-600 dark:text-[#5DD62C]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Section B: Target Audience
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("rules")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "rules"
                ? "border-blue-600 dark:border-[#5DD62C] text-blue-600 dark:text-[#5DD62C]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Section C: Participation Rules
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 font-semibold flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-rose-500">×</button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* SECTION A: BASIC EVENT INFORMATION */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Event Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Generative AI & Cloud Hackathon 2025"
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px] font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Event Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  >
                    <option value="Workshop">Workshop</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Hackathon">Hackathon</option>
                    <option value="Competition">Competition</option>
                    <option value="Cultural">Cultural</option>
                    <option value="Sports">Sports</option>
                    <option value="Placement">Placement &amp; Training</option>
                    <option value="Certification">Certification Drive</option>
                    <option value="Other">Other Institutional Event</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Event Mode
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as EventMode)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  >
                    <option value="Offline">Offline (On Campus)</option>
                    <option value="Online">Online (Virtual)</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="One-line summary for event cards"
                  maxLength={180}
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                  Detailed Event Overview
                </label>
                <textarea
                  rows={3}
                  value={detailedDescription}
                  onChange={(e) => setDetailedDescription(e.target.value)}
                  placeholder="Provide complete event agenda, speaker details, and guidelines..."
                  className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Event Venue / Location
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. CCE Lab 3 / Sigma Auditorium"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  />
                </div>

                {mode !== "Offline" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                      Meeting URL (Google Meet / Zoom)
                    </label>
                    <input
                      type="url"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                    />
                  </div>
                )}
              </div>

              {/* Event Schedule Dates */}
              <div className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 p-3.5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#D4D4D4] block">
                  Event Schedule Dates
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Event Start Date &amp; Time *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={eventStartDate}
                        onChange={(e) => setEventStartDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={eventStartTime}
                        onChange={(e) => setEventStartTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Event End Date &amp; Time *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={eventEndTime}
                        onChange={(e) => setEventEndTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Registration Window Dates */}
              <div className="rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 p-3.5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#D4D4D4] block">
                  Registration Window Dates
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Registration Start Date &amp; Time *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={regStartDate}
                        onChange={(e) => setRegStartDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={regStartTime}
                        onChange={(e) => setRegStartTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-[#A3A3A3] mb-1">
                      Registration Deadline &amp; Time *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        required
                        value={regDeadlineDate}
                        onChange={(e) => setRegDeadlineDate(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                      <input
                        type="time"
                        value={regDeadlineTime}
                        onChange={(e) => setRegDeadlineTime(e.target.value)}
                        className="w-24 rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-2 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic Year and Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2024-2025"
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3.5 py-2 text-xs text-slate-900 dark:text-[#F5F5F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Applicable Semester
                  </label>
                  <select
                    value={semesterId}
                    onChange={(e) => setSemesterId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-2 text-xs text-slate-900 dark:text-[#F5F5F5] min-h-[38px]"
                  >
                    <option value="">-- All Semesters --</option>
                    {semesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Poster Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Event Poster / Banner (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePosterUpload}
                    disabled={uploadingPoster}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#202020] dark:file:text-[#5DD62C] cursor-pointer"
                  />
                  {uploadingPoster && <span className="text-[11px] text-blue-500 mt-1 block">Uploading poster...</span>}
                  {posterUrl && <span className="text-[11px] text-emerald-600 mt-1 block">✓ Poster uploaded</span>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1">
                    Brochure / Guidelines (PDF)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleDocumentUpload}
                    disabled={uploadingDoc}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-[#202020] dark:file:text-[#5DD62C] cursor-pointer"
                  />
                  {uploadingDoc && <span className="text-[11px] text-blue-500 mt-1 block">Uploading document...</span>}
                  {documentUrl && <span className="text-[11px] text-emerald-600 mt-1 block">✓ Document uploaded</span>}
                </div>
              </div>
            </div>
          )}

          {/* SECTION B: TARGET AUDIENCE */}
          {activeTab === "audience" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                  Select Event Target Audience
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: "all", title: "All Department Students", desc: "Open to all enrolled students" },
                    { id: "section", title: "Specific Section", desc: "Target section A or B specifically" },
                    { id: "academic_year", title: "Specific Year / Batch", desc: "Target by student year (2nd Year)" },
                    { id: "specific_students", title: "Custom Student Selection", desc: "Select specific register numbers" },
                  ].map((aud) => (
                    <label
                      key={aud.id}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        audienceType === aud.id
                          ? "border-blue-500 dark:border-[#5DD62C] bg-blue-50/40 dark:bg-[#5DD62C]/10 shadow-2xs"
                          : "border-slate-200 dark:border-[#292929] bg-white dark:bg-[#181818] hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="audienceType"
                        value={aud.id}
                        checked={audienceType === aud.id}
                        onChange={() => setAudienceType(aud.id as AudienceType)}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">{aud.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3] mt-0.5">{aud.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Audience Specific: Section */}
              {audienceType === "section" && (
                <div className="rounded-xl border border-slate-200 dark:border-[#292929] p-3.5 bg-slate-50/50 dark:bg-[#202020]/40">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                    Target Section
                  </label>
                  <div className="flex gap-4">
                    {["A", "B", "C"].map((sec) => (
                      <label key={sec} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="targetSection"
                          value={sec}
                          checked={selectedSection === sec}
                          onChange={(e) => setSelectedSection(e.target.value)}
                        />
                        <span>Section {sec}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Audience Specific: Year */}
              {audienceType === "academic_year" && (
                <div className="rounded-xl border border-slate-200 dark:border-[#292929] p-3.5 bg-slate-50/50 dark:bg-[#202020]/40">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-[#D4D4D4] mb-1.5">
                    Target Year Cohort
                  </label>
                  <div className="flex gap-4">
                    {["1", "2", "3", "4"].map((yr) => (
                      <label key={yr} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="targetYear"
                          value={yr}
                          checked={selectedYear === yr}
                          onChange={(e) => setSelectedYear(e.target.value)}
                        />
                        <span>Year {yr}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Audience Specific: Specific Students Multi-Select */}
              {audienceType === "specific_students" && (
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-[#292929] p-3.5 bg-slate-50/50 dark:bg-[#202020]/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-[#D4D4D4]">
                      Selected: {selectedStudents.length} Students
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedStudents.length === filteredStudents.length) {
                          setSelectedStudents([]);
                        } else {
                          setSelectedStudents(filteredStudents.map((s) => s.id));
                        }
                      }}
                      className="text-xs font-semibold text-blue-600 dark:text-[#5DD62C] hover:underline cursor-pointer"
                    >
                      {selectedStudents.length === filteredStudents.length ? "Deselect All" : "Select All Matching"}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search by student name or register number..."
                    className="w-full rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] px-3 py-1.5 text-xs text-slate-900 dark:text-[#F5F5F5]"
                  />

                  {loadingStudents ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Loading student records...</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-[#292929] rounded-xl p-2 bg-white dark:bg-[#181818]">
                      {filteredStudents.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-2">No matching students found.</p>
                      ) : (
                        filteredStudents.map((s) => {
                          const isChecked = selectedStudents.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer ${
                                isChecked
                                  ? "bg-blue-50 dark:bg-[#5DD62C]/10 text-blue-900 dark:text-[#5DD62C] font-semibold"
                                  : "hover:bg-slate-50 dark:hover:bg-[#202020] text-slate-700 dark:text-[#A3A3A3]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudents([...selectedStudents, s.id]);
                                  } else {
                                    setSelectedStudents(selectedStudents.filter((id) => id !== s.id));
                                  }
                                }}
                                className="rounded text-blue-600"
                              />
                              <span className="font-mono text-[11px] font-bold">{s.register_number || "—"}</span>
                              <span className="truncate">{s.full_name}</span>
                              <span className="text-[10px] text-slate-400 ml-auto">{s.section || "Sec A"}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION C: RULES & PARTICIPATION SETTINGS */}
          {activeTab === "rules" && (
            <div className="space-y-3.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#A3A3A3] block">
                Submission &amp; Registration Constraints
              </span>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!allowMultipleResponses}
                  onChange={(e) => setAllowMultipleResponses(!e.target.checked)}
                  className="mt-0.5 rounded text-blue-600"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Limit to 1 Response per Student</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">
                    Recommended. Prevents duplicate registrations from the same authenticated student account.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowEditSubmission}
                  onChange={(e) => setAllowEditSubmission(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Allow Students to Edit Submissions</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">
                    Allows students to modify their answers until the registration deadline passes.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={closeAfterDeadline}
                  onChange={(e) => setCloseAfterDeadline(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Auto-Close on Registration Deadline</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">
                    Automatically disables new form submissions when the registration deadline arrives.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-[#292929] bg-slate-50/50 dark:bg-[#202020]/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRegistrationEnabled}
                  onChange={(e) => setIsRegistrationEnabled(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600"
                />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-[#F5F5F5]">Student Registration Active</p>
                  <p className="text-[11px] text-slate-500 dark:text-[#A3A3A3]">
                    When unchecked, registration is paused and students cannot submit.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-100 dark:border-[#292929] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-[#292929] bg-white dark:bg-[#181818] text-slate-700 dark:text-[#D4D4D4] hover:bg-slate-50 dark:hover:bg-[#202020] cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {activeTab !== "rules" ? (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === "basic" ? "audience" : "rules")}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-[#202020] text-slate-800 dark:text-[#F5F5F5] hover:bg-slate-200 dark:hover:bg-[#282828] cursor-pointer"
                >
                  Next Section →
                </button>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-blue-600 dark:bg-[#5DD62C] hover:bg-blue-700 dark:hover:bg-[#4cb824] text-white dark:text-black font-semibold text-xs px-5 py-2 shadow-2xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                {isSubmitting ? "Saving Event..." : isEdit ? "Update Event" : "Create Event & Configure Form"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
